import { expect, test, type Page } from '@playwright/test'
import type { GameConfig } from '../src/game/config'

const state = (page: Page) => page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.snapshot())
async function start(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => page.evaluate(() => window.__PIRATE_BATTLE_TEST__?.game?.snapshot().active ?? false)).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__PIRATE_BATTLE_TEST__ = { manual: true } })
  await page.goto('/')
})

test('keeps only two session options with inclusive limits and refresh persistence', async ({ page }) => {
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  const duration = page.getByLabel('Game session time', { exact: false })
  const spawn = page.getByLabel('Enemy spawn time', { exact: false })
  await expect(page.locator('input')).toHaveCount(2)
  await expect(duration).toHaveAttribute('min', '60')
  await expect(duration).toHaveAttribute('max', '180')
  await expect(spawn).toHaveAttribute('min', '1')
  await expect(spawn).toHaveAttribute('max', '12')
  await duration.fill('59')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Options', exact: true })).toBeVisible()
  await duration.fill('180')
  await spawn.fill('12')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:config')!))).toEqual({ sessionDurationSeconds: 180, enemySpawnIntervalSeconds: 12 })
  await page.reload()
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await expect(duration).toHaveValue('180')
  await expect(spawn).toHaveValue('12')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await start(page)
  const current = await state(page)
  expect(current.config.sessionDurationSeconds).toBe(180)
  expect(current.config.enemySpawnIntervalSeconds).toBe(12)
  expect(current.health).toBe(3)
  expect(current.config.projectiles.speed).toBe(620)
})

test('uses an immutable independent balance snapshot until end and applies changed Options only to a new session', async ({ page }) => {
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByLabel('Game session time', { exact: false }).fill('60')
  await page.getByLabel('Enemy spawn time', { exact: false }).fill('6')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await start(page)
  const initial = await state(page)
  // O estado exposto é o da sessão real. Reflect.set confirma proteção também em runtime.
  const protection = await page.evaluate(() => {
    const config = window.__PIRATE_BATTLE_TEST__!.game!.snapshot().config
    const frozen = (value: unknown): boolean => value === null || typeof value !== 'object'
      || (Object.isFrozen(value) && Object.values(value).every(frozen))
    return { frozen: frozen(config), topMutation: Reflect.set(config, 'sessionDurationSeconds', 180), nestedMutation: Reflect.set(config.player, 'speed', 1), arrayMutation: Reflect.set(config.spawns.distribution, '0', 'shooter') }
  })
  expect(protection).toEqual({ frozen: true, topMutation: false, nestedMutation: false, arrayMutation: false })
  // Alterar preferências armazenadas durante a partida não reescreve sua configuração.
  await page.evaluate(() => localStorage.setItem('pirate-battle:config', JSON.stringify({ sessionDurationSeconds: 180, enemySpawnIntervalSeconds: 12 })))
  await page.keyboard.down('w')
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.advance(0.1))
  await page.keyboard.up('w')
  let current = await state(page)
  expect(initial.player.y - current.player.y).toBeCloseTo(22)
  expect(current.config).toEqual(initial.config)
  expect(current.time).toBeCloseTo(59.9)
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.advance(6.95))
  current = await state(page)
  expect(current.spawns.map((spawn) => spawn.type)).toEqual(['chaser', 'shooter'])
  expect(current.spawns[1].time - current.spawns[0].time).toBeCloseTo(6, 1)
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.frame(60))
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible()
  expect((await state(page)).config).toEqual(initial.config)
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click()
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByLabel('Game session time', { exact: false }).fill('120')
  await page.getByLabel('Enemy spawn time', { exact: false }).fill('2')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await state(page)).config).toEqual(initial.config)
  await start(page)
  current = await state(page)
  expect(current.config.sessionDurationSeconds).toBe(120)
  expect(current.config.enemySpawnIntervalSeconds).toBe(2)
  expect(current.time).toBe(120)
  expect(current.enemies).toHaveLength(0)
})

test('snapshot factory copies adjustable nested settings without changing defaults or legacy stored options', async ({ page }) => {
  // O import local exercita a mesma fábrica usada por Play, com outro balanceamento em memória.
  const result = await page.evaluate(async () => {
    const modulePath = '/src/game/config.ts'
    const { DEFAULT_GAME_CONFIG, createGameConfigSnapshot } = await import(modulePath)
    const source: GameConfig = structuredClone(DEFAULT_GAME_CONFIG)
    const changed = { ...source, player: { ...source.player, speed: 230 }, projectiles: { ...source.projectiles, broadside: { ...source.projectiles.broadside, offsets: [-10, 0, 10] } } }
    const options = { sessionDurationSeconds: 120, enemySpawnIntervalSeconds: 6, player: { speed: 999 } }
    const snapshot = createGameConfigSnapshot(options, changed)
    changed.player.speed = 1
    changed.projectiles.broadside.offsets[0] = -99
    options.sessionDurationSeconds = 60
    return { speed: snapshot.player.speed, offsets: snapshot.projectiles.broadside.offsets, duration: snapshot.sessionDurationSeconds, defaultSpeed: DEFAULT_GAME_CONFIG.player.speed, shared: snapshot.player === changed.player }
  })
  expect(result).toEqual({ speed: 230, offsets: [-10, 0, 10], duration: 120, defaultSpeed: 220, shared: false })
  await page.evaluate(() => localStorage.setItem('pirate-battle:config', JSON.stringify({ sessionDurationSeconds: 120, enemySpawnIntervalSeconds: 6, player: { maxHealth: 99 } })))
  await page.reload()
  await start(page)
  const current = await state(page)
  expect(current.time).toBe(120)
  expect(current.config.enemySpawnIntervalSeconds).toBe(6)
  expect(current.health).toBe(3)
})
