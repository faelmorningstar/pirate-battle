import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { HealthMeter, OfficialIcon } from './OfficialUi'
import { pirateAsset } from '../game/assets'
import { createCombatVisual, createTexturedIsland, createTexturedSea, loadArenaTextures } from '../game/arenaVisuals'
import type { GameConfig } from '../game/config'
import type { GameAudio } from '../game/audio'
import { SoundButton } from './SoundButton'
import { circleContact, clampToArena } from '../game/collisions'
import { prepareShipFeedback, showShipImpact, updateShipFeedback } from '../game/shipFeedback'
import type { GameplaySnapshot } from '../game/gameplayTest'

export type GameHud = { health: number; score: number; timeLeft: number; paused: boolean }
export type GameResult = { score: number; durationSeconds: number; reason: 'time' | 'death' }
type Props = { config: GameConfig; hud: GameHud; onHudChange: (hud: GameHud) => void; onEnd: (result: GameResult) => void; onExit: () => void; audio: GameAudio; soundMuted: boolean; onToggleSound: () => void }
type Projectile = { graphic: Graphics | Sprite; velocityX: number; velocityY: number; remainingLife: number; owner: 'player' | 'enemy' }
type Enemy = { id: number; type: 'chaser' | 'shooter'; graphic: Container; healthBar: Graphics; health: number; fireCooldown: number }

const PLAYER_RADIUS = 26
const ISLAND_RADIUS = window.matchMedia('(pointer: coarse)').matches ? 68 : 88
const PLAYER_SPEED = 220
const TURN_SPEED = 2.8
const PROJECTILE_SPEED = 620
const FRONT_FIRE_COOLDOWN = 0.35
const BROADSIDE_FIRE_COOLDOWN = 0.8
const CHASER_RADIUS = 25
const CHASER_SPEED = 118
const SHOOTER_SPEED = 92
const SHOOTER_ATTACK_RANGE = 300
const SHOOTER_FIRE_COOLDOWN = 1.35
const ENEMY_MAX_HEALTH = 2
const PLAYER_SHIP_ASSET = pirateAsset('ships/ship_12.png')
const CHASER_SHIP_ASSET = pirateAsset('ships/ship_5.png')
const SHOOTER_SHIP_ASSET = pirateAsset('ships/ship_20.png')

const ASSET_LOAD_TIMEOUT_MS = 2500

function drawSea(sea: Graphics, width: number, height: number) {
  sea.clear().rect(0, 0, width, height).fill(0x09364d)
  // Faixas suaves de profundidade e linhas desenhadas apenas na montagem ou resize.
  for (let band = 0; band < 16; band += 1) {
    sea.rect(0, height * band / 16, width, height / 16)
      .fill({ color: 0x1a7685, alpha: 0.16 * (1 - band / 16) })
  }
  for (let row = 0; row * 64 < height; row += 1) {
    for (let column = 0; column * 116 < width; column += 1) {
      const x = column * 116 + (row % 2) * 48 + 12
      const y = row * 64 + 22 + Math.sin(column * 2 + row) * 12
      const length = 22 + ((row * 7 + column * 11) % 26)
      sea.moveTo(x, y).quadraticCurveTo(x + length / 2, y + 5, x + length, y)
        .stroke({ color: 0x78bec4, width: 1.3, alpha: 0.13 })
      if ((row + column) % 3 === 0) {
        sea.moveTo(x + 8, y + 7).lineTo(x + length - 4, y + 8)
          .stroke({ color: 0x78bec4, width: 1, alpha: 0.07 })
      }
    }
  }
}

function drawPalm(island: Graphics, x: number, y: number, size: number) {
  island.ellipse(x + 6 * size, y + 3 * size, 15 * size, 6 * size)
    .fill({ color: 0x183e30, alpha: 0.22 })
  island.moveTo(x, y).quadraticCurveTo(x - 5 * size, y - 12 * size, x + 2 * size, y - 25 * size)
    .stroke({ color: 0x70482e, width: 6 * size, cap: 'round' })
  island.moveTo(x - size, y - 2 * size).quadraticCurveTo(x - 4 * size, y - 13 * size, x + size, y - 23 * size)
    .stroke({ color: 0xba8550, width: 2 * size, cap: 'round' })
  const crownX = x + 2 * size
  const crownY = y - 25 * size
  for (let leaf = 0; leaf < 6; leaf += 1) {
    const angle = leaf * Math.PI / 3 + 0.2
    const tipX = crownX + Math.cos(angle) * 23 * size
    const tipY = crownY + Math.sin(angle) * 16 * size
    const middleX = crownX + Math.cos(angle) * 12 * size
    const middleY = crownY + Math.sin(angle) * 8 * size
    island.moveTo(crownX, crownY)
      .quadraticCurveTo(middleX - Math.sin(angle) * 8 * size, middleY + Math.cos(angle) * 8 * size, tipX, tipY)
      .quadraticCurveTo(middleX, middleY, crownX, crownY)
      .fill(leaf % 2 === 0 ? 0x226d42 : 0x39894b)
    island.moveTo(crownX, crownY).lineTo(tipX, tipY)
      .stroke({ color: 0x9aba5f, alpha: 0.45, width: size })
  }
  island.circle(crownX, crownY, 2.5 * size).fill(0xc09a52)
}

function createIsland(radius: number) {
  const island = new Graphics()
  // Só a espuma translúcida passa da costa; a areia termina no raio da colisão.
  island.circle(0, 0, radius + 7).fill({ color: 0x53b9b1, alpha: 0.12 })
  island.circle(0, 0, radius).fill(0xc49a58)
  island.circle(-1, -2, radius - 3).fill(0xe6c682)
  island.ellipse(-radius * 0.05, -radius * 0.08, radius * 0.78, radius * 0.75).fill(0x547e43)
  island.ellipse(-radius * 0.12, -radius * 0.16, radius * 0.67, radius * 0.62).fill(0x71934d)
  for (let detail = 0; detail < 9; detail += 1) {
    const angle = detail * Math.PI * 2 / 9 + 0.15
    const x = Math.cos(angle) * radius * 0.87
    const y = Math.sin(angle) * radius * 0.87
    island.ellipse(x, y, radius * 0.045, radius * 0.028).fill(detail % 3 === 0 ? 0x7d8170 : 0xf2d99e)
    if (detail % 2 === 0) {
      island.moveTo(Math.cos(angle) * (radius + 3), Math.sin(angle) * (radius + 3))
        .arc(0, 0, radius + 3, angle, angle + 0.28)
        .stroke({ color: 0xd0ece1, width: 1.5, alpha: 0.42 })
    }
    island.circle(Math.cos(angle) * radius * 0.52, Math.sin(angle) * radius * 0.48, radius * 0.065)
      .fill({ color: 0x395f38, alpha: 0.35 })
  }
  const palmScale = radius / 88
  drawPalm(island, -25 * palmScale, -8 * palmScale, palmScale)
  drawPalm(island, 25 * palmScale, 4 * palmScale, palmScale * 0.9)
  drawPalm(island, -3 * palmScale, 36 * palmScale, palmScale * 0.85)
  return island
}

function distanceSquared(aX: number, aY: number, bX: number, bY: number) {
  const x = aX - bX
  const y = aY - bY
  return x * x + y * y
}

function createShip(color: number, texture?: Texture) {
  const ship = new Container()
  if (texture) {
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.width = 58
    sprite.height = 74
    ship.addChild(sprite)
    return ship
  }
  const fallback = new Graphics()
  fallback.poly([0, -34, 25, 27, 10, 34, -10, 34, -25, 27]).fill(color).stroke({ color: 0x3a241b, width: 5 })
  fallback.rect(-4, -18, 8, 34).fill(0x5c3826)
  fallback.poly([2, -17, 2, 10, 23, 1]).fill(0xf2e4bc).stroke({ color: 0x6d4d37, width: 2 })
  ship.addChild(fallback)
  return ship
}

type HealthTextures = Partial<Record<string, Texture>>
const HEALTH_IMAGES = ['health_frame', 'health_fill_green', 'health_fill_amber', 'health_fill_red', 'enemy_health_frame', 'enemy_health_fill_green', 'enemy_health_fill_red']

function createHealthBar(textures: HealthTextures, enemy = false) {
  const bar = new Graphics()
  const width = enemy ? 64 : 96
  const height = enemy ? 16 : 18
  const prefix = enemy ? 'enemy_health' : 'health'
  const fills = new Graphics({ label: 'fills' })
  const mask = new Graphics({ label: 'fill-mask' })
  if (textures[`${prefix}_frame`]) {
    const frame = new Sprite(textures[`${prefix}_frame`])
    frame.position.set(-width / 2, -height / 2)
    frame.width = width
    frame.height = height
    bar.addChild(frame, fills, mask)
    for (const color of enemy ? ['green', 'red'] : ['green', 'amber', 'red']) {
      const fill = new Sprite({ texture: textures[`${prefix}_fill_${color}`], label: color })
      fill.position.copyFrom(frame.position)
      fill.width = width
      fill.height = height
      fills.addChild(fill)
    }
    fills.mask = mask
  }
  // Números complementam o preenchimento e a cor também nas barras dos inimigos.
  const value = new Text({ text: '', label: 'value', style: { fontSize: 11, fontWeight: 'bold', fill: '#fff7df', stroke: { color: '#061d2c', width: 3 } } })
  value.anchor.set(0.5, 0)
  value.y = height / 2 + 1
  bar.addChild(value)
  return bar
}

function drawHealthBar(bar: Graphics, x: number, y: number, health: number, maxHealth: number) {
  const ratio = Math.max(0, Math.min(1, health / maxHealth))
  const enemy = maxHealth === ENEMY_MAX_HEALTH
  const fills = bar.getChildByLabel('fills') as Graphics | null
  if (fills) {
    const width = enemy ? 64 : 96
    const height = enemy ? 16 : 18
    const scale = enemy ? width / 160 : width / 256
    const rect = enemy ? { x: 24, y: 12, w: 112, h: 15 } : { x: 30, y: 15, w: 196, h: 20 }
    const mask = bar.getChildByLabel('fill-mask') as Graphics
    mask.clear().rect(-width / 2 + rect.x * scale, -height / 2 + rect.y * scale, rect.w * scale * ratio, rect.h * scale).fill(0xffffff)
    const color = ratio > 0.5 ? 'green' : !enemy && ratio > 1 / 3 ? 'amber' : 'red'
    for (const fill of fills.children) fill.visible = fill.label === color
  } else {
    // Mantemos a barra geométrica caso uma imagem local não possa ser carregada.
    bar.clear().roundRect(-24, -4, 48, 8, 3).fill(0x2b2020)
    bar.roundRect(-22, -2, 44 * ratio, 4, 2).fill(ratio > 0.5 ? 0x75d16e : 0xe86950)
  }
  const value = bar.getChildByLabel('value') as Text
  value.text = `${health}/${maxHealth}`
  bar.position.set(x, y - 48)
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export function GameCanvas({ config, hud, onHudChange, onEnd, onExit, audio, soundMuted, onToggleSound }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const togglePauseRef = useRef<() => void>(() => {})
  const touchPressedRef = useRef(new Set<string>())
  const [assetStatus, setAssetStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const canvasHost = host
    const app = new Application()
    let initialized = false
    let cleanupScenery: (() => void) | undefined
    const pressed = new Set<string>()
    const touchPressed = touchPressedRef.current
    const isPressed = (code: string) => pressed.has(code) || touchPressed.has(code)
    const projectiles: Projectile[] = []
    let active = true
    let fireCooldown = 0
    let portFireCooldown = 0
    let starboardFireCooldown = 0
    const enemies: Enemy[] = []
    let spawnCountdown = 1
    let nextEnemy: 'chaser' | 'shooter' = 'chaser'
    let playerHealth = 3
    let score = 0
    let remainingTime = config.sessionDurationSeconds
    let reportedSecond = Math.ceil(remainingTime)
    let paused = false
    let ended = false
    let islandX = 0
    let islandY = 0

    const reportHud = () => onHudChange({ health: playerHealth, score, timeLeft: Math.max(0, Math.ceil(remainingTime)), paused })
    const finish = (reason: GameResult['reason']) => {
      if (ended) return
      ended = true
      pressed.clear()
      touchPressed.clear()
      onEnd({ score, durationSeconds: Math.round(config.sessionDurationSeconds - remainingTime), reason })
    }
    const togglePause = () => {
      if (ended) return
      paused = !paused
      audio.pauseBattle(paused)
      pressed.clear()
      touchPressed.clear()
      reportHud()
    }
    const onVisibilityChange = () => {
      if (document.hidden && !paused && !ended) togglePause()
    }
    const onBlur = () => { if (!paused && !ended) togglePause() }
    togglePauseRef.current = togglePause
    const onKeyDown = (event: KeyboardEvent) => {
      if (ended || !active) return
      const accepted = ['KeyW', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'KeyP']
      if (!accepted.includes(event.code)) return
      if (accepted.includes(event.code)) event.preventDefault()
      if (event.code === 'KeyP' && !event.repeat) togglePause()
      else if (!paused) pressed.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.code)
    const removeProjectile = (projectile: Projectile) => {
      projectile.graphic.removeFromParent()
      projectile.graphic.destroy({ children: true })
      projectiles.splice(projectiles.indexOf(projectile), 1)
    }

    async function mount() {
      await app.init({ background: '#09364d', resizeTo: canvasHost, antialias: true, resolution: Math.min(window.devicePixelRatio, 2) })
      initialized = true

      if (!active) { app.destroy(true); return }
      canvasHost.appendChild(app.canvas)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('blur', onBlur)
      document.addEventListener('visibilitychange', onVisibilityChange)

      const arenaTexturesPromise = loadArenaTextures(ASSET_LOAD_TIMEOUT_MS)
      let playerTexture: Texture | undefined
      let chaserTexture: Texture | undefined
      let shooterTexture: Texture | undefined
     try {
  const textures = await Promise.race([
    Promise.all([
      Assets.load<Texture>(PLAYER_SHIP_ASSET),
      Assets.load<Texture>(CHASER_SHIP_ASSET),
      Assets.load<Texture>(SHOOTER_SHIP_ASSET),
    ]),
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('Ship assets took too long to load')),
        ASSET_LOAD_TIMEOUT_MS,
      )
    }),
  ])

  ;[playerTexture, chaserTexture, shooterTexture] = textures
  if (active) setAssetStatus('ready')
} catch {
  if (active) setAssetStatus('fallback')
}
      const healthTextures: HealthTextures = {}
      const healthResults = await Promise.allSettled(HEALTH_IMAGES.map(async (name) => {
        const texture = await Assets.load<Texture>(pirateAsset(`ui/hud/${name}.png`))
        return [name, texture] as const
      }))
      if (!active) return
      if (healthResults.every((result) => result.status === 'fulfilled')) {
        for (const result of healthResults) {
          if (result.status === 'fulfilled') healthTextures[result.value[0]] = result.value[1]
        }
      }
      const arenaTextures = await arenaTexturesPromise
      if (!active) return
      const sea = arenaTextures.water ? createTexturedSea(arenaTextures.water) : new Graphics()
      const resizeSea = () => {
        if (sea instanceof Graphics) drawSea(sea, app.screen.width, app.screen.height)
        else { sea.width = app.screen.width; sea.height = app.screen.height }
      }
      resizeSea()
      app.renderer.on('resize', resizeSea)
      app.stage.addChild(sea)
      const island = createTexturedIsland(ISLAND_RADIUS, arenaTextures) ?? createIsland(ISLAND_RADIUS)
      cleanupScenery = () => {
        app.renderer.off('resize', resizeSea)
        sea.destroy({ children: true })
        island.destroy({ children: true })
      }
      islandX = app.screen.width * 0.52
      islandY = app.screen.height * 0.45
      island.position.set(islandX, islandY)
      app.stage.addChild(island)

      const player = createShip(0xf2c35e, playerTexture)
      prepareShipFeedback(player)
      player.position.set(app.screen.width * 0.5, app.screen.height * 0.78)
      app.stage.addChild(player)
      const playerHealthBar = createHealthBar(healthTextures)
      app.stage.addChild(playerHealthBar)
      reportHud()

      const effects: { graphic: Graphics | Sprite; elapsed: number; scaleX: number; scaleY: number }[] = []
      const shots = { front: 0, port: 0, starboard: 0, enemy: 0 }
      const spawnHistory: GameplaySnapshot['spawns'] = []
      const testHarness = import.meta.env.DEV ? window.__PIRATE_BATTLE_TEST__ : undefined
      let enemyId = 0
      let finalSnapshot: GameplaySnapshot | undefined

      const distanceToIsland = (point: { x: number; y: number }) => distanceSquared(point.x, point.y, islandX, islandY)
      const safePosition = (point: { x: number; y: number }, radius: number) => {
        const clamped = clampToArena(point, radius, app.screen.width, app.screen.height)
        if (distanceToIsland(clamped) >= (radius + ISLAND_RADIUS) ** 2) return clamped
        // Só reposicionamos no resize ou na montagem, quando o espaço visível mudou.
        const candidates = [
          { x: radius, y: radius }, { x: app.screen.width - radius, y: radius },
          { x: radius, y: app.screen.height - radius }, { x: app.screen.width - radius, y: app.screen.height - radius },
        ].filter((candidate) => distanceToIsland(candidate) >= (radius + ISLAND_RADIUS) ** 2)
        return candidates.sort((a, b) => distanceSquared(a.x, a.y, clamped.x, clamped.y) - distanceSquared(b.x, b.y, clamped.x, clamped.y))[0] ?? clamped
      }
      const resizeArena = () => {
        islandX = app.screen.width * 0.52
        islandY = app.screen.height * 0.45
        island.position.set(islandX, islandY)
        player.position.copyFrom(safePosition(player, PLAYER_RADIUS))
        for (const enemy of enemies) enemy.graphic.position.copyFrom(safePosition(enemy.graphic, CHASER_RADIUS))
      }
      resizeArena()
      app.renderer.on('resize', resizeArena)
      const cleanupSea = cleanupScenery
      cleanupScenery = () => {
        finalSnapshot = snapshot()
        app.renderer.off('resize', resizeArena)
        cleanupSea?.()
      }

      const spawnEnemy = () => {
        const point = [
          { x: 56, y: 56 }, { x: app.screen.width - 56, y: 56 },
          { x: 56, y: app.screen.height - 56 }, { x: app.screen.width - 56, y: app.screen.height - 56 },
        ].filter((candidate) => candidate.x >= CHASER_RADIUS && candidate.x <= app.screen.width - CHASER_RADIUS
          && candidate.y >= CHASER_RADIUS && candidate.y <= app.screen.height - CHASER_RADIUS
          && distanceToIsland(candidate) >= (CHASER_RADIUS + ISLAND_RADIUS) ** 2
          && distanceSquared(candidate.x, candidate.y, player.x, player.y) >= (PLAYER_RADIUS + CHASER_RADIUS + 56) ** 2)
          .sort((a, b) => distanceSquared(b.x, b.y, player.x, player.y) - distanceSquared(a.x, a.y, player.x, player.y))[0]
        if (!point) return
        const type = nextEnemy
        nextEnemy = type === 'chaser' ? 'shooter' : 'chaser'
        const graphic = createShip(type === 'chaser' ? 0xd65c4b : 0x6bc4d4, type === 'chaser' ? chaserTexture : shooterTexture)
        graphic.position.copyFrom(point)
        prepareShipFeedback(graphic)
        const enemy: Enemy = { id: ++enemyId, type, graphic, healthBar: createHealthBar(healthTextures, true), health: ENEMY_MAX_HEALTH, fireCooldown: 0 }
        enemies.push(enemy)
        app.stage.addChild(graphic, enemy.healthBar)
        if (testHarness) spawnHistory.push({ id: enemy.id, type, time: config.sessionDurationSeconds - remainingTime, ...point, playerX: player.x, playerY: player.y })
      }
      const removeEnemy = (enemy: Enemy) => {
        enemies.splice(enemies.indexOf(enemy), 1)
        enemy.graphic.destroy({ children: true })
        enemy.healthBar.destroy({ children: true })
      }
      const explode = (x: number, y: number) => {
        audio.play('ship_explosion_1')
        const graphic = createCombatVisual(arenaTextures.explosion, 12, 0xffb648)
        graphic.position.set(x, y)
        app.stage.addChild(graphic)
        effects.push({ graphic, elapsed: 0, scaleX: graphic.scale.x, scaleY: graphic.scale.y })
      }
      const addProjectile = (x: number, y: number, angle: number, radius: number, speed: number, life: number, owner: Projectile['owner']) => {
        const graphic = createCombatVisual(arenaTextures.cannonball, radius, owner === 'player' ? 0x17120d : 0x732c25, owner === 'player' ? 0xffe2a4 : 0xffb070)
        if (owner === 'enemy' && graphic instanceof Sprite) graphic.tint = 0xf4ad97
        graphic.position.set(x, y)
        app.stage.addChild(graphic)
        projectiles.push({ graphic, velocityX: Math.sin(angle) * speed, velocityY: -Math.cos(angle) * speed, remainingLife: life, owner })
      }
      const fireFront = () => {
        if (fireCooldown > 0) return
        fireCooldown = FRONT_FIRE_COOLDOWN
        shots.front += 1
        audio.play('cannon_fire_1')
        addProjectile(player.x + Math.sin(player.rotation) * 38, player.y - Math.cos(player.rotation) * 38, player.rotation, 6, PROJECTILE_SPEED, 1.1, 'player')
      }
      const fireBroadside = (side: 'port' | 'starboard') => {
        const isPort = side === 'port'
        if (isPort ? portFireCooldown > 0 : starboardFireCooldown > 0) return
        if (isPort) portFireCooldown = BROADSIDE_FIRE_COOLDOWN
        else starboardFireCooldown = BROADSIDE_FIRE_COOLDOWN
        shots[side] += 1
        audio.play('cannon_broadside')
        const angle = player.rotation + (isPort ? -Math.PI / 2 : Math.PI / 2)
        for (const offset of [-15, 0, 15]) {
          addProjectile(player.x + Math.sin(angle) * 33 + Math.sin(player.rotation) * offset,
            player.y - Math.cos(angle) * 33 - Math.cos(player.rotation) * offset, angle, 5, PROJECTILE_SPEED, 0.9, 'player')
        }
      }
      const fireEnemy = (enemy: Enemy) => {
        if (enemy.fireCooldown > 0) return
        enemy.fireCooldown = SHOOTER_FIRE_COOLDOWN
        shots.enemy += 1
        audio.play('cannon_fire_1')
        addProjectile(enemy.graphic.x + Math.sin(enemy.graphic.rotation) * 38,
          enemy.graphic.y - Math.cos(enemy.graphic.rotation) * 38, enemy.graphic.rotation, 6, PROJECTILE_SPEED * 0.72, 1.4, 'enemy')
      }
      const moveShip = (ship: Container, radius: number, speed: number, seconds: number) => {
        const next = clampToArena({ x: ship.x + Math.sin(ship.rotation) * speed * seconds, y: ship.y - Math.cos(ship.rotation) * speed * seconds }, radius, app.screen.width, app.screen.height)
        if (circleContact(ship, next, { x: islandX, y: islandY }, ISLAND_RADIUS + radius) !== undefined) return false
        ship.position.copyFrom(next)
        return true
      }
      const damagePlayer = () => {
        audio.play('ship_wood_hit_1')
        playerHealth = Math.max(0, playerHealth - 1)
        showShipImpact(player)
        updateShipFeedback(player, playerHealth, 3, 0)
        reportHud()
        if (playerHealth === 0) finish('death')
      }
      const update = (ticker: { deltaMS: number }) => {
        if (!active || ended || paused) return
        const seconds = ticker.deltaMS / 1000
        remainingTime = Math.max(0, remainingTime - seconds)
        const nextSecond = Math.ceil(remainingTime)
        if (nextSecond !== reportedSecond) { reportedSecond = nextSecond; reportHud() }
        if (remainingTime <= 0) { finish('time'); return }
        fireCooldown = Math.max(0, fireCooldown - seconds)
        portFireCooldown = Math.max(0, portFireCooldown - seconds)
        starboardFireCooldown = Math.max(0, starboardFireCooldown - seconds)
        spawnCountdown -= seconds
        if (spawnCountdown <= 0) {
          spawnEnemy()
          // O intervalo depende do relógio, não de destruir o inimigo anterior.
          spawnCountdown += config.enemySpawnIntervalSeconds
        }
        if (isPressed('KeyA')) player.rotation -= TURN_SPEED * seconds
        if (isPressed('KeyD')) player.rotation += TURN_SPEED * seconds
        if (isPressed('KeyW')) moveShip(player, PLAYER_RADIUS, PLAYER_SPEED, seconds)
        if (isPressed('Space')) fireFront()
        if (isPressed('KeyQ')) fireBroadside('port')
        if (isPressed('KeyE')) fireBroadside('starboard')

        for (let index = enemies.length - 1; index >= 0; index -= 1) {
          const enemy = enemies[index]
          const ship = enemy.graphic
          enemy.fireCooldown = Math.max(0, enemy.fireCooldown - seconds)
          const targetAngle = Math.atan2(player.x - ship.x, -(player.y - ship.y))
          ship.rotation += normalizeAngle(targetAngle - ship.rotation) * Math.min(1, seconds * (enemy.type === 'chaser' ? 3 : 2.4))
          const inRange = distanceSquared(ship.x, ship.y, player.x, player.y) <= SHOOTER_ATTACK_RANGE ** 2
          if (enemy.type === 'chaser' || !inRange) {
            if (!moveShip(ship, CHASER_RADIUS, enemy.type === 'chaser' ? CHASER_SPEED : SHOOTER_SPEED, seconds)) ship.rotation += Math.PI / 2
          } else fireEnemy(enemy)
          if (enemy.type === 'chaser' && distanceSquared(ship.x, ship.y, player.x, player.y) < (CHASER_RADIUS + PLAYER_RADIUS) ** 2) {
            explode(ship.x, ship.y)
            removeEnemy(enemy)
            damagePlayer()
            if (ended) return
          }
        }
        // Percorremos o trajeto e escolhemos só o primeiro impacto, inclusive contra a ilha.
        for (let index = projectiles.length - 1; index >= 0; index -= 1) {
          const projectile = projectiles[index]
          const start = { x: projectile.graphic.x, y: projectile.graphic.y }
          const travelTime = Math.min(seconds, projectile.remainingLife)
          const end = { x: start.x + projectile.velocityX * travelTime, y: start.y + projectile.velocityY * travelTime }
          let contact = circleContact(start, end, { x: islandX, y: islandY }, ISLAND_RADIUS)
          let hit: Enemy | 'player' | undefined
          if (projectile.owner === 'player') {
            for (const enemy of enemies) {
              const targetContact = circleContact(start, end, enemy.graphic, CHASER_RADIUS + 6)
              if (targetContact !== undefined && (contact === undefined || targetContact < contact)) { contact = targetContact; hit = enemy }
            }
          } else {
            const targetContact = circleContact(start, end, player, PLAYER_RADIUS + 6)
            if (targetContact !== undefined && (contact === undefined || targetContact < contact)) { contact = targetContact; hit = 'player' }
          }
          const outsideStart = start.x < 0 || start.x > app.screen.width || start.y < 0 || start.y > app.screen.height
          projectile.graphic.position.set(end.x, end.y)
          projectile.remainingLife -= seconds
          if (!outsideStart && hit === 'player') damagePlayer()
          else if (!outsideStart && hit && hit !== 'player') {
            audio.play('ship_wood_hit_1')
            hit.health -= 1
            showShipImpact(hit.graphic)
            updateShipFeedback(hit.graphic, hit.health, ENEMY_MAX_HEALTH, 0)
            if (hit.health === 0) {
              explode(hit.graphic.x, hit.graphic.y)
              removeEnemy(hit)
              score += 1
              audio.play('score_point')
              reportHud()
            }
          }
          const outside = end.x < 0 || end.x > app.screen.width || end.y < 0 || end.y > app.screen.height
          if (projectile.remainingLife <= 0 || contact !== undefined || outside || outsideStart) removeProjectile(projectile)
          if (ended) return
        }
        for (let index = effects.length - 1; index >= 0; index -= 1) {
          const effect = effects[index]
          effect.elapsed += seconds
          effect.graphic.scale.set(effect.scaleX * (1 + effect.elapsed * 4), effect.scaleY * (1 + effect.elapsed * 4))
          effect.graphic.alpha = Math.max(0, 1 - effect.elapsed * 2)
          if (effect.elapsed >= 0.5) { effect.graphic.destroy({ children: true }); effects.splice(index, 1) }
        }
        updateShipFeedback(player, playerHealth, 3, seconds)
        drawHealthBar(playerHealthBar, player.x, player.y, playerHealth, 3)
        for (const enemy of enemies) {
          updateShipFeedback(enemy.graphic, enemy.health, ENEMY_MAX_HEALTH, seconds)
          drawHealthBar(enemy.healthBar, enemy.graphic.x, enemy.graphic.y, enemy.health, ENEMY_MAX_HEALTH)
        }
      }
      const snapshot = (): GameplaySnapshot => finalSnapshot ? { ...finalSnapshot, active: false } : ({
        active, ended, paused, health: playerHealth, score, time: remainingTime,
        width: app.screen.width, height: app.screen.height, island: { x: islandX, y: islandY, radius: ISLAND_RADIUS },
        player: { x: player.x, y: player.y, rotation: player.rotation, radius: PLAYER_RADIUS, damaged: player.getChildByLabel('damage')?.visible ?? false, impact: player.getChildByLabel('impact')?.visible ?? false },
        enemies: enemies.map((enemy) => ({ id: enemy.id, type: enemy.type, x: enemy.graphic.x, y: enemy.graphic.y, rotation: enemy.graphic.rotation, health: enemy.health, radius: CHASER_RADIUS, damaged: enemy.graphic.getChildByLabel('damage')?.visible ?? false, impact: enemy.graphic.getChildByLabel('impact')?.visible ?? false })),
        projectiles: projectiles.map((p) => ({ x: p.graphic.x, y: p.graphic.y, vx: p.velocityX, vy: p.velocityY, life: p.remainingLife, owner: p.owner })),
        cooldowns: { front: fireCooldown, port: portFireCooldown, starboard: starboardFireCooldown }, shots: { ...shots }, spawns: spawnHistory.map((spawn) => ({ ...spawn })), effects: effects.length,
      })
      if (testHarness?.manual) {
        // Instrumentação opt-in de desenvolvimento: observa entidades e controla só o relógio.
        app.ticker.stop()
        testHarness.game = {
          snapshot,
          frame: (seconds) => { update({ deltaMS: seconds * 1000 }); if (active && !ended) app.render() },
          advance: (seconds) => {
            for (let remaining = seconds; remaining > 0.000001 && active && !ended; remaining -= 1 / 60) update({ deltaMS: Math.min(remaining, 1 / 60) * 1000 })
            if (active && !ended) app.render()
          },
        }
      } else app.ticker.add(update)
      update({ deltaMS: 0 })

    }

    void mount()
    return () => {
      active = false
      // As transições pertencem ao App; este cleanup remove apenas sons de combate.
      audio.stopCombat()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      touchPressed.clear()
      cleanupScenery?.()
      if (initialized) app.destroy(true, { children: true })
    }
  }, [config, onHudChange, onEnd, audio])

  const touchControl = (code: string) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); touchPressedRef.current.add(code) },
    onPointerUp: () => touchPressedRef.current.delete(code),
    onPointerCancel: () => touchPressedRef.current.delete(code),
    onPointerLeave: () => touchPressedRef.current.delete(code),
  })
  return <main className="game-screen">
    <header className="game-header">
      <div className="official-hud">
        <span className="hull-counter"><img className="hud-icon" src={pirateAsset('ui/hud/icon_heart.png')} alt="" aria-hidden="true" /><HealthMeter health={hud.health} maxHealth={3} /><span>Hull: {hud.health}/3</span></span>
        <span className="hud-counter"><img className="hud-icon" src={pirateAsset('ui/hud/icon_score.png')} alt="" aria-hidden="true" />Score: {hud.score}</span>
        <span className="hud-counter"><img className="hud-icon" src={pirateAsset('ui/hud/icon_time.png')} alt="" aria-hidden="true" />Time: {hud.timeLeft}s</span>
      </div>
      <div className="game-actions">
        <SoundButton muted={soundMuted} onToggle={onToggleSound} />
        <button type="button" className="button button-secondary" onClick={() => togglePauseRef.current()}><OfficialIcon name={hud.paused ? 'play' : 'pause'} /><span className="game-action-label">{hud.paused ? 'Resume' : 'Pause'}</span></button>
        <button type="button" className="button button-secondary" onClick={onExit}><OfficialIcon name="home" /><span className="game-action-label">Exit game</span></button>
      </div>
    </header>
    {assetStatus !== 'ready' && <div className="asset-message" role="status">{assetStatus === 'loading' ? 'Loading battle assets…' : 'Asset fallback enabled.'}</div>}
    {hud.paused && <div className="pause-message official-panel" role="status"><OfficialIcon name="pause" />Paused — press P or Resume to continue.</div>}
    <div className="game-canvas" ref={hostRef} aria-label="Pirate Battle game arena" />
    <nav className="touch-controls" aria-label="Touch controls">
      <div>
        <button type="button" aria-label="Turn left" {...touchControl('KeyA')}><OfficialIcon name="turn_left" /></button>
        <button type="button" aria-label="Move forward" {...touchControl('KeyW')}><OfficialIcon name="forward" /></button>
        <button type="button" aria-label="Turn right" {...touchControl('KeyD')}><OfficialIcon name="turn_right" /></button>
      </div>
      <div>
        <button type="button" aria-label="Fire port broadside" {...touchControl('KeyQ')}><OfficialIcon name="fire_left" /></button>
        <button type="button" aria-label="Fire front cannon" {...touchControl('Space')}><OfficialIcon name="fire_front" /></button>
        <button type="button" aria-label="Fire starboard broadside" {...touchControl('KeyE')}><OfficialIcon name="fire_right" /></button>
      </div>
    </nav>
  </main>
}
