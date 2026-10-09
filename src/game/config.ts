export type GameConfig = { sessionDurationSeconds: number; enemySpawnIntervalSeconds: number }
export const DEFAULT_GAME_CONFIG: GameConfig = { sessionDurationSeconds: 90, enemySpawnIntervalSeconds: 4 }
export function loadGameConfig(): GameConfig {
  try { const saved = localStorage.getItem('pirate-battle:config'); if (!saved) return DEFAULT_GAME_CONFIG; const parsed = JSON.parse(saved) as Partial<GameConfig>; if (typeof parsed.sessionDurationSeconds !== 'number' || typeof parsed.enemySpawnIntervalSeconds !== 'number') return DEFAULT_GAME_CONFIG; return { ...DEFAULT_GAME_CONFIG, ...parsed } } catch { return DEFAULT_GAME_CONFIG }
}
