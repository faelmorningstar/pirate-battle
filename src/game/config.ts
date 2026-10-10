export type EnemyType = 'chaser' | 'shooter'

// Somente estes dois parâmetros são editáveis na tela Options e persistidos como preferências.
export type GameSessionOptions = Readonly<{
  sessionDurationSeconds: number
  enemySpawnIntervalSeconds: number
}>

export type WeaponConfig = Readonly<{
  cooldownSeconds: number
  lifetimeSeconds: number
  visualRadius: number
  muzzleOffset: number
}>

export type GameConfig = Readonly<GameSessionOptions & {
  player: Readonly<{ maxHealth: number; radius: number; speed: number; turnSpeed: number }>
  enemies: Readonly<{
    maxHealth: number; radius: number
    chaser: Readonly<{ speed: number; rotationResponse: number; contactDamage: number }>
    shooter: Readonly<{ speed: number; rotationResponse: number; attackRange: number }>
  }>
  arena: Readonly<{ islandRadius: Readonly<{ desktop: number; touch: number }> }>
  spawns: Readonly<{ initialDelaySeconds: number; inset: number; playerClearance: number; distribution: readonly [EnemyType, ...EnemyType[]] }>
  projectiles: Readonly<{
    speed: number; enemySpeedMultiplier: number; damage: number; collisionRadius: number
    front: WeaponConfig
    broadside: WeaponConfig & Readonly<{ offsets: readonly number[] }>
    enemy: WeaponConfig
  }>
  effects: Readonly<{ explosionSeconds: number; explosionRadius: number; explosionExpansion: number; explosionFade: number; impactSeconds: number }>
  scorePerKill: number
}>

// Limites inclusivos em segundos inteiros; o intervalo de spawn é sempre positivo.
export const GAME_SESSION_LIMITS = Object.freeze({
  sessionDurationSeconds: Object.freeze({ min: 60, max: 180 }),
  enemySpawnIntervalSeconds: Object.freeze({ min: 1, max: 12 }),
})

function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child)
    Object.freeze(value)
  }
  return value
}

// Valores transportados da simulação existente, sem mudança de balanceamento.
export const DEFAULT_GAME_CONFIG: GameConfig = freezeTree<GameConfig>({
  sessionDurationSeconds: 90,
  enemySpawnIntervalSeconds: 4,
  player: { maxHealth: 3, radius: 26, speed: 220, turnSpeed: 2.8 },
  enemies: {
    maxHealth: 2, radius: 25,
    chaser: { speed: 118, rotationResponse: 3, contactDamage: 1 },
    shooter: { speed: 92, rotationResponse: 2.4, attackRange: 300 },
  },
  arena: { islandRadius: { desktop: 88, touch: 68 } },
  spawns: { initialDelaySeconds: 1, inset: 56, playerClearance: 56, distribution: ['chaser', 'shooter'] },
  projectiles: {
    speed: 620, enemySpeedMultiplier: 0.72, damage: 1, collisionRadius: 6,
    front: { cooldownSeconds: 0.35, lifetimeSeconds: 1.1, visualRadius: 6, muzzleOffset: 38 },
    broadside: { cooldownSeconds: 0.8, lifetimeSeconds: 0.9, visualRadius: 5, muzzleOffset: 33, offsets: [-15, 0, 15] },
    enemy: { cooldownSeconds: 1.35, lifetimeSeconds: 1.4, visualRadius: 6, muzzleOffset: 38 },
  },
  effects: { explosionSeconds: 0.5, explosionRadius: 12, explosionExpansion: 4, explosionFade: 2, impactSeconds: 0.18 },
  scorePerKill: 1,
})

export const DEFAULT_GAME_SESSION_OPTIONS: GameSessionOptions = Object.freeze({
  sessionDurationSeconds: DEFAULT_GAME_CONFIG.sessionDurationSeconds,
  enemySpawnIntervalSeconds: DEFAULT_GAME_CONFIG.enemySpawnIntervalSeconds,
})

export function createGameConfigSnapshot(options: GameSessionOptions, defaults: GameConfig = DEFAULT_GAME_CONFIG): GameConfig {
  // A cópia profunda elimina referências compartilhadas; o congelamento também protege em runtime.
  return freezeTree({
    ...structuredClone(defaults),
    sessionDurationSeconds: options.sessionDurationSeconds,
    enemySpawnIntervalSeconds: options.enemySpawnIntervalSeconds,
  })
}

export function loadGameSessionOptions(): GameSessionOptions {
  try {
    const saved = localStorage.getItem('pirate-battle:config')
    if (!saved) return DEFAULT_GAME_SESSION_OPTIONS
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_GAME_SESSION_OPTIONS
    const values = parsed as Partial<GameSessionOptions>
    const valid = (value: unknown, limits: { min: number; max: number }): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value >= limits.min && value <= limits.max
    if (!valid(values.sessionDurationSeconds, GAME_SESSION_LIMITS.sessionDurationSeconds)
      || !valid(values.enemySpawnIntervalSeconds, GAME_SESSION_LIMITS.enemySpawnIntervalSeconds)) return DEFAULT_GAME_SESSION_OPTIONS
    // Dados antigos continuam compatíveis; campos extras não viram configuração interna.
    return { sessionDurationSeconds: values.sessionDurationSeconds, enemySpawnIntervalSeconds: values.enemySpawnIntervalSeconds }
  } catch { return DEFAULT_GAME_SESSION_OPTIONS }
}
