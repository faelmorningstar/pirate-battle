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
