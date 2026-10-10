import type { GameSessionOptions } from '../game/config'

export type EndReason = 'time' | 'death'

export type MatchRecord = {
  id: string
  playerId: string
  playerName: string
  completedAt: string
  score: number
  durationSeconds: number
  endReason: EndReason
  configuration: GameSessionOptions
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }
export type RankingEntry = Pick<MatchRecord, 'id' | 'playerId' | 'playerName' | 'completedAt' | 'score' | 'configuration'>

// Persistência e HTTP cruzam a fronteira dos tipos; validamos o formato em runtime.
export function isMatchRecord(value: unknown): value is MatchRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<MatchRecord>
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.playerId === 'string' && typeof record.playerName === 'string'
    && typeof record.completedAt === 'string' && Number.isFinite(Date.parse(record.completedAt))
    && typeof record.score === 'number' && Number.isInteger(record.score) && record.score >= 0
    && typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds) && record.durationSeconds >= 0
    && (record.endReason === 'time' || record.endReason === 'death')
    && Boolean(record.configuration && Number.isInteger(record.configuration.sessionDurationSeconds) && Number.isInteger(record.configuration.enemySpawnIntervalSeconds))
}
