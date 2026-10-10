import type { GameConfig } from './config'

export type GameplaySnapshot = {
  config: GameConfig
  active: boolean; ended: boolean; paused: boolean; health: number; score: number; time: number
  width: number; height: number; island: { x: number; y: number; radius: number }
  player: { x: number; y: number; rotation: number; radius: number; damaged: boolean; impact: boolean }
  enemies: { id: number; type: 'chaser' | 'shooter'; x: number; y: number; rotation: number; health: number; radius: number; damaged: boolean; impact: boolean }[]
  projectiles: { x: number; y: number; vx: number; vy: number; life: number; owner: 'player' | 'enemy' }[]
  cooldowns: { front: number; port: number; starboard: number }
  shots: { front: number; port: number; starboard: number; enemy: number }
  spawns: { id: number; type: 'chaser' | 'shooter'; time: number; x: number; y: number; playerX: number; playerY: number }[]
  effects: number
}

export type GameplayProbe = { snapshot: () => GameplaySnapshot; advance: (seconds: number) => void; frame: (seconds: number) => void }

declare global {
  interface Window { __PIRATE_BATTLE_TEST__?: { manual: boolean; game?: GameplayProbe } }
}
