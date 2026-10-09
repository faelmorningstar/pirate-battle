import type { MatchRecord } from '../data/contracts'

const STORAGE_KEY = 'pirate-battle:matches'

const fixtures: MatchRecord[] = [
  { id: 'fixture-1', playerId: 'captain-ada', playerName: 'Captain Ada', completedAt: '2026-10-01T10:00:00.000Z', score: 12, durationSeconds: 90, endReason: 'time', configuration: { sessionDurationSeconds: 90, enemySpawnIntervalSeconds: 4 } },
  { id: 'fixture-2', playerId: 'captain-lin', playerName: 'Captain Lin', completedAt: '2026-10-02T10:00:00.000Z', score: 9, durationSeconds: 75, endReason: 'death', configuration: { sessionDurationSeconds: 90, enemySpawnIntervalSeconds: 4 } },
  { id: 'fixture-3', playerId: 'captain-jo', playerName: 'Captain Jo', completedAt: '2026-10-03T10:00:00.000Z', score: 7, durationSeconds: 90, endReason: 'time', configuration: { sessionDurationSeconds: 90, enemySpawnIntervalSeconds: 4 } },
]

export function readMatches() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as MatchRecord[] : fixtures
  } catch { return fixtures }
}

export function saveMatch(record: MatchRecord) {
  const matches = readMatches()
  const existing = matches.find((match) => match.id === record.id)
  if (existing) return existing
  const next = [...matches, record]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return record
}

export function resetMatches() { localStorage.removeItem(STORAGE_KEY) }
