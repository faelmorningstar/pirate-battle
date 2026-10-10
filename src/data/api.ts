import axios from 'axios'
import type { MatchRecord, Page, RankingEntry } from './contracts'

const client = axios.create({ baseURL: '/api', timeout: 4_000 })

export async function getRanking(page = 1, signal?: AbortSignal) {
  const response = await client.get<Page<RankingEntry>>('/ranking', { params: { page }, signal })
  return response.data
}

export async function getMatchHistory(playerId: string, page = 1, signal?: AbortSignal) {
  const response = await client.get<Page<MatchRecord>>('/matches', { params: { playerId, page }, signal })
  return response.data
}

export async function registerMatch(record: MatchRecord) {
  const response = await client.post<MatchRecord>('/matches', record)
  return response.data
}
