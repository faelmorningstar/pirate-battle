import { delay, http, HttpResponse } from 'msw'
import type { MatchRecord, RankingEntry } from '../data/contracts'
import { readMatches, saveMatch } from './store'
import { getNetworkScenario } from './networkScenario'

const PAGE_SIZE = 5
const byScoreThenDate = <T extends { score: number; completedAt: string }>(a: T, b: T) => b.score - a.score || a.completedAt.localeCompare(b.completedAt)
const pageResult = <T>(items: T[], page: number) => ({ items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pageSize: PAGE_SIZE, total: items.length })

export const handlers = [
  http.get('/api/ranking', async ({ request }) => {
    const scenario = getNetworkScenario()
    if (scenario === 'ranking-error') return HttpResponse.json({ message: 'Ranking service unavailable.' }, { status: 503 })
    if (scenario === 'slow') await delay(900)
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1')
    const ranking: RankingEntry[] = readMatches().map(({ id, playerId, playerName, completedAt, score, configuration }) => ({ id, playerId, playerName, completedAt, score, configuration })).sort(byScoreThenDate)
    return scenario === 'empty' ? HttpResponse.json(pageResult([], page)) : HttpResponse.json(pageResult(ranking, page))
  }),
  http.get('/api/matches', async ({ request }) => {
    const scenario = getNetworkScenario()
    if (scenario === 'history-error') return HttpResponse.json({ message: 'History service unavailable.' }, { status: 503 })
    if (scenario === 'slow') await delay(900)
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const matches = readMatches().filter((match) => match.playerId === playerId).sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    return scenario === 'empty' ? HttpResponse.json(pageResult([], page)) : HttpResponse.json(pageResult(matches, page))
  }),
  http.post('/api/matches', async ({ request }) => {
    const record = await request.json() as MatchRecord
    return HttpResponse.json(saveMatch(record), { status: 201 })
  }),
]
