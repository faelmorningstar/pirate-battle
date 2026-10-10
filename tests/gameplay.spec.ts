import { expect, test, type Page } from '@playwright/test'
import type { GameplaySnapshot } from '../src/game/gameplayTest'

const state = (page: Page): Promise<GameplaySnapshot> => page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.snapshot())
const advance = (page: Page, seconds: number) => page.evaluate((time) => window.__PIRATE_BATTLE_TEST__!.game!.advance(time), seconds)
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const errors = new WeakMap<Page, string[]>()

async function start(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean(window.__PIRATE_BATTLE_TEST__?.game))).toBe(true)
}

async function hold(page: Page, key: string, seconds: number) {
  await page.keyboard.down(key)
  await advance(page, seconds)
  await page.keyboard.up(key)
}

async function aim(page: Page, target: { x: number; y: number }) {
  const { player } = await state(page)
  const desired = Math.atan2(target.x - player.x, -(target.y - player.y))
  const change = Math.atan2(Math.sin(desired - player.rotation), Math.cos(desired - player.rotation))
  if (Math.abs(change) > 0.001) await hold(page, change > 0 ? 'd' : 'a', Math.abs(change) / 2.8)
}

test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (error) => errors.get(page)!.push(error.message))
  // O relógio é manual, mas inputs, renderização e regras continuam sendo os reais.
  await page.addInitScript(() => { window.__PIRATE_BATTLE_TEST__ = { manual: true } })
  await page.goto('/')
  await start(page)
})

test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]) })

test('movement, rotation, island blocking and arena bounds survive resize', async ({ page }) => {
  const initial = await state(page)
  await hold(page, 'w', 0.1)
  expect(initial.player.y - (await state(page)).player.y).toBeCloseTo(22, 3)
  await hold(page, 'w', 0.7)
  let current = await state(page)
  expect(distance(current.player, current.island)).toBeGreaterThanOrEqual(current.player.radius + current.island.radius)
  await hold(page, 'd', Math.PI / 2.8)
  current = await state(page)
  expect(current.player.rotation).toBeCloseTo(Math.PI, 4)
  await hold(page, 'w', 0.8)
  current = await state(page)
  expect(current.player.y).toBeLessThanOrEqual(current.height - current.player.radius)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.setViewportSize({ width: 844, height: 390 })
  await expect.poll(async () => (await state(page)).width).toBe(844)
  current = await state(page)
  expect(current.island.x).toBeCloseTo(current.width * 0.52)
  for (const ship of [current.player, ...current.enemies]) {
    expect(ship.x).toBeGreaterThanOrEqual(ship.radius)
    expect(ship.x).toBeLessThanOrEqual(current.width - ship.radius)
    expect(ship.y).toBeLessThanOrEqual(current.height - ship.radius)
    expect(distance(ship, current.island)).toBeGreaterThanOrEqual(ship.radius + current.island.radius)
  }
})

test('front and parallel broadsides respect independent cooldowns and projectile cleanup', async ({ page }) => {
  await page.keyboard.down('Space')
  await advance(page, 0.01)
  let current = await state(page)
  expect(current.projectiles).toHaveLength(1)
  expect(current.shots.front).toBe(1)
  await advance(page, 0.2)
  expect((await state(page)).shots.front).toBe(1)
  await advance(page, 0.2)
  expect((await state(page)).shots.front).toBe(2)
  await page.keyboard.up('Space')
  await hold(page, 'q', 0.01)
  current = await state(page)
  const broadside = current.projectiles.slice(-3)
  expect(broadside).toHaveLength(3)
  expect(new Set(broadside.map((p) => `${p.vx},${p.vy}`)).size).toBe(1)
  expect(distance(broadside[0], broadside[1])).toBeCloseTo(15)
  await hold(page, 'q', 0.4)
  expect((await state(page)).shots.port).toBe(1)
  await hold(page, 'e', 0.01)
  expect((await state(page)).shots.starboard).toBe(1)
  const paused = await state(page)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await advance(page, 10)
  expect((await state(page)).cooldowns).toEqual(paused.cooldowns)
  expect((await state(page)).projectiles).toEqual(paused.projectiles)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await advance(page, 0.95)
  expect((await state(page)).projectiles.filter((p) => p.owner === 'player')).toHaveLength(0)
})

test('spawns alternate on the configured interval while existing enemies remain alive', async ({ page }) => {
  await advance(page, 5.02)
  const current = await state(page)
  expect(current.spawns.map((spawn) => spawn.type)).toEqual(['chaser', 'shooter'])
  expect(current.enemies.map((enemy) => enemy.type)).toEqual(['chaser', 'shooter'])
  expect(current.spawns[1].time - current.spawns[0].time).toBeCloseTo(4, 1)
  for (const spawn of current.spawns) {
    expect(distance(spawn, current.island)).toBeGreaterThanOrEqual(current.island.radius + 25)
    expect(distance(spawn, { x: spawn.playerX, y: spawn.playerY })).toBeGreaterThanOrEqual(107)
  }
  for (const enemy of current.enemies) {
    expect(distance(enemy, current.island)).toBeGreaterThanOrEqual(current.island.radius + enemy.radius)
    expect(enemy.x).toBeGreaterThanOrEqual(enemy.radius)
    expect(enemy.y).toBeLessThanOrEqual(current.height - enemy.radius)
  }
})

test('Chaser pursues, damages once on contact, explodes and never awards collision points', async ({ page }, testInfo) => {
  await advance(page, 1.02)
  const spawned = await state(page)
  const chaser = spawned.enemies.find((enemy) => enemy.type === 'chaser')!
  await advance(page, 0.5)
  expect(distance((await state(page)).enemies.find((enemy) => enemy.id === chaser.id)!, spawned.player)).toBeLessThan(distance(chaser, spawned.player))
  let current = await state(page)
  for (let step = 0; step < 240 && current.health === 3; step += 1) { await advance(page, 0.05); current = await state(page) }
  expect(current.health).toBe(2)
  expect(current.enemies.some((enemy) => enemy.id === chaser.id)).toBe(false)
  expect(current.score).toBe(0)
  expect(current.effects).toBeGreaterThan(0)
  expect(current.player.damaged).toBe(true)
  expect(current.player.impact).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('damage-feedback.png') })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await advance(page, 1)
  expect((await state(page)).effects).toBe(current.effects)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await advance(page, 0.6)
  expect((await state(page)).effects).toBe(0)
})

test('island stops cannonballs even when a controlled slow frame crosses the whole obstacle', async ({ page }) => {
  await hold(page, 'Space', 0.01)
  expect((await state(page)).projectiles).toHaveLength(1)
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.frame(0.75))
  const current = await state(page)
  expect(current.projectiles).toHaveLength(0)
  expect(current.score).toBe(0)
  expect(current.health).toBe(3)
})

test('Shooter approaches and only fires within range on its cooldown', async ({ page }) => {
  await advance(page, 5.02)
  let current = await state(page)
  const shooter = current.enemies.find((enemy) => enemy.type === 'shooter')!
  const initialDistance = distance(shooter, current.player)
  await advance(page, 0.5)
  current = await state(page)
  const approaching = current.enemies.find((enemy) => enemy.id === shooter.id)!
  expect(distance(approaching, current.player)).toBeLessThan(initialDistance)
  if (distance(approaching, current.player) > 300) expect(current.shots.enemy).toBe(0)
  for (let step = 0; step < 200 && current.shots.enemy === 0; step += 1) { await advance(page, 0.05); current = await state(page) }
  expect(current.shots.enemy).toBe(1)
  expect(distance(current.enemies.find((enemy) => enemy.id === shooter.id)!, current.player)).toBeLessThanOrEqual(300)
  await advance(page, 0.6)
  expect((await state(page)).shots.enemy).toBe(1)
  await advance(page, 0.8)
  expect((await state(page)).shots.enemy).toBeGreaterThanOrEqual(2)
})

test('real cannon inputs damage and destroy an enemy with exactly one point', async ({ page }) => {
  await advance(page, 1.02)
  const id = (await state(page)).enemies[0].id
  let damaged = false
  let impact = false
  for (let step = 0; step < 50; step += 1) {
    const current = await state(page)
    const target = current.enemies.find((enemy) => enemy.id === id)
    if (!target) break
    damaged ||= target.damaged
    impact ||= target.impact
    await aim(page, target)
    await hold(page, 'Space', 0.1)
  }
  const current = await state(page)
  expect(damaged).toBe(true)
  expect(impact).toBe(true)
  expect(current.enemies.some((enemy) => enemy.id === id)).toBe(false)
  expect(current.score).toBe(1)
  await advance(page, 0.3)
  expect((await state(page)).score).toBe(1)
})

test('a single cannonball deals one hit and is removed before it can damage again', async ({ page }) => {
  await advance(page, 1.02)
  let current = await state(page)
  const id = current.enemies[0].id
  // Esperamos o Chaser contornar a ilha; o disparo precisa ter uma linha de tiro livre.
  for (let step = 0; step < 200 && distance(current.enemies.find((enemy) => enemy.id === id)!, current.player) > 190; step += 1) {
    await advance(page, 0.05)
    current = await state(page)
  }
  await aim(page, current.enemies[0])
  current = await state(page)
  await aim(page, current.enemies.find((enemy) => enemy.id === id)!)
  await hold(page, 'Space', 0.01)
  current = await state(page)
  for (let step = 0; step < 80 && current.enemies[0]?.health === 2; step += 1) { await advance(page, 0.025); current = await state(page) }
  expect(current.shots.front).toBe(1)
  expect(current.enemies.find((enemy) => enemy.id === id)?.health).toBe(1)
  expect(current.projectiles.filter((projectile) => projectile.owner === 'player')).toHaveLength(0)
  expect(current.score).toBe(0)
  await advance(page, 0.2)
  expect((await state(page)).enemies.find((enemy) => enemy.id === id)?.health).toBe(1)
})

test('blur and hidden pages pause and clear keyboard and simultaneous touch holds until manual resume', async ({ page }, testInfo) => {
  await page.keyboard.down('w')
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Fire front cannon' }).dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch' })
    await page.getByRole('button', { name: 'Move forward' }).dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch' })
  } else await page.keyboard.down('Space')
  await advance(page, 0.05)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const paused = await state(page)
  expect(paused.paused).toBe(true)
  await advance(page, 5)
  expect(await state(page)).toEqual(paused)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  expect((await state(page)).paused).toBe(true)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await advance(page, 0.2)
  let current = await state(page)
  expect(current.player).toEqual(paused.player)
  expect(current.shots).toEqual(paused.shots)
  await page.keyboard.up('w')
  await page.keyboard.up('Space')
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  current = await state(page)
  expect(current.paused).toBe(true)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
  await advance(page, 5)
  expect(await state(page)).toEqual(current)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await advance(page, 0.1)
  expect((await state(page)).time).toBeLessThan(current.time)
})

test('death stops every simulation system and restart restores the session', async ({ page }) => {
  await advance(page, 40)
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:last-result')!).reason)).toBe('death')
  const ended = await state(page)
  expect(ended.ended).toBe(true)
  expect(ended.health).toBe(0)
  await page.keyboard.down('Space')
  await advance(page, 40)
  expect(await state(page)).toEqual(ended)
  const captured = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', { code: 'KeyW', cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(captured).toBe(false)
  await page.keyboard.up('Space')
  await page.getByRole('button', { name: 'Play Again' }).click()
  await expect.poll(async () => (await state(page)).active).toBe(true)
  const reset = await state(page)
  expect(reset.health).toBe(3)
  expect(reset.score).toBe(0)
  expect(reset.time).toBe(90)
  expect(reset.enemies).toHaveLength(0)
  expect(reset.projectiles).toHaveLength(0)
})

test('time expiry stops before attacks, spawns or points and abandonment releases input', async ({ page }) => {
  const initial = await state(page)
  await page.keyboard.down('Space')
  // Um frame controlado cruza o limite do cronômetro e exercita a barreira de encerramento.
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.frame(90))
  await expect(page.getByText('The session timer reached zero.')).toBeVisible()
  const ended = await state(page)
  expect(ended.time).toBe(0)
  expect(ended.shots).toEqual(initial.shots)
  expect(ended.spawns).toHaveLength(0)
  expect(ended.health).toBe(3)
  await advance(page, 5)
  expect(await state(page)).toEqual(ended)
  await page.keyboard.up('Space')
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await start(page)
  await expect.poll(async () => (await state(page)).active).toBe(true)
  await page.getByRole('button', { name: 'Exit game' }).click()
  expect(await page.evaluate(() => { const e = new KeyboardEvent('keydown', { code: 'Space', cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented })).toBe(false)
})
