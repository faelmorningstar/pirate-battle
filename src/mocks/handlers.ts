import { delay, http, HttpResponse } from 'msw'
import { isMatchRecord, type RankingEntry } from '../data/contracts'
import { paginationFixtures, readMatches, saveMatch } from './store'
import { getNetworkScenario, scenarioLatency, type NetworkScenario } from './networkScenario'

const PAGE_SIZE = 5
const byScoreThenDate = <T extends { score: number; completedAt: string }>(a: T, b: T) => b.score - a.score || a.completedAt.localeCompare(b.completedAt)
const pageResult = <T>(items: T[], page: number) => ({ items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pageSize: PAGE_SIZE, total: items.length })

async function readFailure(scenario: NetworkScenario, endpoint: 'ranking' | 'history') {
  const latency = scenarioLatency(scenario, endpoint)
  if (latency) await delay(latency)
  if (scenario === 'connection-error') return HttpResponse.error()
  if (scenario === 'http-400') return HttpResponse.json({ message: 'Invalid request.' }, { status: 400 })
  if (scenario === 'http-503' || scenario === `${endpoint}-error`) return HttpResponse.json({ message: 'Service unavailable.' }, { status: 503 })
}

export const handlers = [
  http.get('/api/ranking', async ({ request }) => {
    const scenario = getNetworkScenario()
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1')
    // Fotografamos os dados antes da espera para reproduzir respostas antigas reais.
    const records = [...readMatches(), ...(scenario === 'paginated' ? paginationFixtures : [])]
    const ranking: RankingEntry[] = records.map(({ id, playerId, playerName, completedAt, score, configuration }) => ({ id, playerId, playerName, completedAt, score, configuration })).sort(byScoreThenDate)
    const failure = await readFailure(scenario, 'ranking')
    return failure ?? HttpResponse.json(pageResult(scenario === 'empty' ? [] : ranking, page))
  }),
  http.get('/api/matches', async ({ request }) => {
    const scenario = getNetworkScenario()
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const records = [...readMatches(), ...(scenario === 'paginated' ? paginationFixtures : [])]
    const matches = records.filter((match) => match.playerId === playerId).sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    const failure = await readFailure(scenario, 'history')
    return failure ?? HttpResponse.json(pageResult(scenario === 'empty' ? [] : matches, page))
  }),
  http.post('/api/matches', async ({ request }) => {
    const scenario = getNetworkScenario()
    if (scenario === 'post-unavailable') return HttpResponse.json({ message: 'Registration unavailable.' }, { status: 503 })
    let record: unknown
    try { record = await request.json() } catch { return HttpResponse.json({ message: 'Invalid JSON.' }, { status: 400 }) }
    if (!isMatchRecord(record)) return HttpResponse.json({ message: 'Invalid match record.' }, { status: 400 })
    const saved = saveMatch(record)
    // Salvamos antes do timeout; uma nova tentativa confirma o mesmo ID.
    if (scenario === 'post-timeout') await delay(4500)
    return HttpResponse.json(saved, { status: 201 })
  }),
]
