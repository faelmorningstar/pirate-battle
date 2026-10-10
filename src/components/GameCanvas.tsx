import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Application, Assets, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { HealthMeter, OfficialIcon } from './OfficialUi'
import { pirateAsset } from '../game/assets'
import { createCombatVisual, createTexturedIsland, createTexturedSea, loadArenaTextures } from '../game/arenaVisuals'
import type { GameConfig } from '../game/config'

export type GameHud = { health: number; score: number; timeLeft: number; paused: boolean }
export type GameResult = { score: number; durationSeconds: number; reason: 'time' | 'death' }
type Props = { config: GameConfig; hud: GameHud; onHudChange: (hud: GameHud) => void; onEnd: (result: GameResult) => void; onExit: () => void }
type Projectile = { graphic: Graphics | Sprite; velocityX: number; velocityY: number; remainingLife: number; owner: 'player' | 'enemy' }

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
  const ship = new Graphics()
  if (texture) {
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.width = 58
    sprite.height = 74
    ship.addChild(sprite)
    return ship
  }
  ship.poly([0, -34, 25, 27, 10, 34, -10, 34, -25, 27]).fill(color).stroke({ color: 0x3a241b, width: 5 })
  ship.rect(-4, -18, 8, 34).fill(0x5c3826)
  ship.poly([2, -17, 2, 10, 23, 1]).fill(0xf2e4bc).stroke({ color: 0x6d4d37, width: 2 })
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

export function GameCanvas({ config, hud, onHudChange, onEnd, onExit }: Props) {
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
    let chaser: Graphics | null = null
    let shooter: Graphics | null = null
    let chaserHealthBar: Graphics | null = null
    let shooterHealthBar: Graphics | null = null
    let chaserRespawn = 1
    let nextEnemy: 'chaser' | 'shooter' = 'chaser'
    let shooterFireCooldown = 0
    let playerHealth = 3
    let score = 0
    let chaserHealth = ENEMY_MAX_HEALTH
    let shooterHealth = ENEMY_MAX_HEALTH
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
      onEnd({ score, durationSeconds: Math.round(config.sessionDurationSeconds - remainingTime), reason })
    }
    const togglePause = () => {
      if (ended) return
      paused = !paused
      pressed.clear()
      reportHud()
    }
    const onVisibilityChange = () => {
      if (document.hidden && !paused && !ended) togglePause()
    }
    togglePauseRef.current = togglePause
    const onKeyDown = (event: KeyboardEvent) => {
      const accepted = ['KeyW', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'KeyP']
      if (accepted.includes(event.code)) event.preventDefault()
      if (event.code === 'KeyP' && !event.repeat) togglePause()
      pressed.add(event.code)
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
      player.position.set(app.screen.width * 0.5, app.screen.height * 0.78)
      app.stage.addChild(player)
      const playerHealthBar = createHealthBar(healthTextures)
      app.stage.addChild(playerHealthBar)
      reportHud()

      const spawnChaser = () => {
        const spawnPoints = [
          { x: 56, y: 56 },
          { x: app.screen.width - 56, y: 56 },
          { x: 56, y: app.screen.height - 56 },
          { x: app.screen.width - 56, y: app.screen.height - 56 },
        ]
        const point = spawnPoints.sort((a, b) => distanceSquared(b.x, b.y, player.x, player.y) - distanceSquared(a.x, a.y, player.x, player.y))[0]
        chaserHealth = ENEMY_MAX_HEALTH
        chaser = createShip(0xd65c4b, chaserTexture)
        chaser.position.set(point.x, point.y)
        app.stage.addChild(chaser)
        chaserHealthBar = createHealthBar(healthTextures, true)
        app.stage.addChild(chaserHealthBar)
      }

      const spawnShooter = () => {
        const spawnPoints = [
          { x: 56, y: 56 }, { x: app.screen.width - 56, y: 56 },
          { x: 56, y: app.screen.height - 56 }, { x: app.screen.width - 56, y: app.screen.height - 56 },
        ]
        const point = spawnPoints.sort((a, b) => distanceSquared(b.x, b.y, player.x, player.y) - distanceSquared(a.x, a.y, player.x, player.y))[0]
        shooterHealth = ENEMY_MAX_HEALTH
        shooter = createShip(0x6bc4d4, shooterTexture)
        shooter.position.set(point.x, point.y)
        app.stage.addChild(shooter)
        shooterHealthBar = createHealthBar(healthTextures, true)
        app.stage.addChild(shooterHealthBar)
      }

      const explode = (x: number, y: number) => {
        const effect = createCombatVisual(arenaTextures.explosion, 12, 0xffb648)
        // A expansão parte do tamanho lógico, não do tamanho original do PNG.
        const initialScaleX = effect.scale.x
        const initialScaleY = effect.scale.y
        effect.position.set(x, y)
        app.stage.addChild(effect)
        let elapsed = 0
        const animate = (ticker: { deltaMS: number }) => {
          elapsed += ticker.deltaMS / 1000
          effect.scale.set(initialScaleX * (1 + elapsed * 4), initialScaleY * (1 + elapsed * 4))
          effect.alpha = Math.max(0, 1 - elapsed * 2)
          if (elapsed >= 0.5) {
            app.ticker.remove(animate)
            effect.destroy()
          }
        }
        app.ticker.add(animate)
      }

      const fireFront = () => {
        if (fireCooldown > 0) return
        fireCooldown = FRONT_FIRE_COOLDOWN
        const graphic = createCombatVisual(arenaTextures.cannonball, 6, 0x17120d, 0xffe2a4)
        const directionX = Math.sin(player.rotation)
        const directionY = -Math.cos(player.rotation)
        graphic.position.set(player.x + directionX * 38, player.y + directionY * 38)
        app.stage.addChild(graphic)
        projectiles.push({ graphic, velocityX: directionX * PROJECTILE_SPEED, velocityY: directionY * PROJECTILE_SPEED, remainingLife: 1.1, owner: 'player' })
      }

      const fireBroadside = (side: 'port' | 'starboard') => {
        const isPort = side === 'port'
        if (isPort ? portFireCooldown > 0 : starboardFireCooldown > 0) return
        if (isPort) portFireCooldown = BROADSIDE_FIRE_COOLDOWN
        else starboardFireCooldown = BROADSIDE_FIRE_COOLDOWN
        const broadsideAngle = player.rotation + (isPort ? -Math.PI / 2 : Math.PI / 2)
        const directionX = Math.sin(broadsideAngle)
        const directionY = -Math.cos(broadsideAngle)
        const forwardX = Math.sin(player.rotation)
        const forwardY = -Math.cos(player.rotation)
        for (const offset of [-15, 0, 15]) {
          const graphic = createCombatVisual(arenaTextures.cannonball, 5, 0x17120d, 0xffe2a4)
          graphic.position.set(player.x + directionX * 33 + forwardX * offset, player.y + directionY * 33 + forwardY * offset)
          app.stage.addChild(graphic)
          projectiles.push({ graphic, velocityX: directionX * PROJECTILE_SPEED, velocityY: directionY * PROJECTILE_SPEED, remainingLife: 0.9, owner: 'player' })
        }
      }

      const fireEnemy = () => {
        if (!shooter || shooterFireCooldown > 0) return
        shooterFireCooldown = SHOOTER_FIRE_COOLDOWN
        const graphic = createCombatVisual(arenaTextures.cannonball, 6, 0x732c25, 0xffb070)
        if (graphic instanceof Sprite) graphic.tint = 0xf4ad97
        const directionX = Math.sin(shooter.rotation)
        const directionY = -Math.cos(shooter.rotation)
        graphic.position.set(shooter.x + directionX * 38, shooter.y + directionY * 38)
        app.stage.addChild(graphic)
        projectiles.push({ graphic, velocityX: directionX * (PROJECTILE_SPEED * 0.72), velocityY: directionY * (PROJECTILE_SPEED * 0.72), remainingLife: 1.4, owner: 'enemy' })
      }

      app.ticker.add((ticker) => {
        if (ended || paused) return
        const seconds = ticker.deltaMS / 1000
        remainingTime = Math.max(0, remainingTime - seconds)
        const nextSecond = Math.ceil(remainingTime)
        if (nextSecond !== reportedSecond) { reportedSecond = nextSecond; reportHud() }
        if (remainingTime <= 0) { finish('time'); return }
        fireCooldown = Math.max(0, fireCooldown - seconds)
        portFireCooldown = Math.max(0, portFireCooldown - seconds)
        starboardFireCooldown = Math.max(0, starboardFireCooldown - seconds)
        chaserRespawn -= seconds
        shooterFireCooldown = Math.max(0, shooterFireCooldown - seconds)
        if (!chaser && !shooter && chaserRespawn <= 0 && playerHealth > 0) {
          if (nextEnemy === 'chaser') spawnChaser()
          else spawnShooter()
        }
        if (isPressed('KeyA')) player.rotation -= TURN_SPEED * seconds
        if (isPressed('KeyD')) player.rotation += TURN_SPEED * seconds
        if (isPressed('KeyW')) {
          const nextX = player.x + Math.sin(player.rotation) * PLAYER_SPEED * seconds
          const nextY = player.y - Math.cos(player.rotation) * PLAYER_SPEED * seconds
          const hitsIsland = distanceSquared(nextX, nextY, islandX, islandY) < (PLAYER_RADIUS + ISLAND_RADIUS) ** 2
          if (!hitsIsland) {
            player.x = Math.max(PLAYER_RADIUS, Math.min(app.screen.width - PLAYER_RADIUS, nextX))
            player.y = Math.max(PLAYER_RADIUS, Math.min(app.screen.height - PLAYER_RADIUS, nextY))
          }
        }
        if (isPressed('Space')) fireFront()
        if (isPressed('KeyQ')) fireBroadside('port')
        if (isPressed('KeyE')) fireBroadside('starboard')

        if (chaser) {
          const targetAngle = Math.atan2(player.x - chaser.x, -(player.y - chaser.y))
          chaser.rotation += normalizeAngle(targetAngle - chaser.rotation) * Math.min(1, seconds * 3)
          const nextX = chaser.x + Math.sin(chaser.rotation) * CHASER_SPEED * seconds
          const nextY = chaser.y - Math.cos(chaser.rotation) * CHASER_SPEED * seconds
          const hitsIsland = distanceSquared(nextX, nextY, islandX, islandY) < (CHASER_RADIUS + ISLAND_RADIUS) ** 2
          if (!hitsIsland) {
            chaser.x = Math.max(CHASER_RADIUS, Math.min(app.screen.width - CHASER_RADIUS, nextX))
            chaser.y = Math.max(CHASER_RADIUS, Math.min(app.screen.height - CHASER_RADIUS, nextY))
          } else {
            chaser.rotation += Math.PI / 2
          }
          if (distanceSquared(chaser.x, chaser.y, player.x, player.y) < (CHASER_RADIUS + PLAYER_RADIUS) ** 2) {
            explode(chaser.x, chaser.y)
            chaser.destroy()
            chaser = null
            chaserHealthBar?.destroy({ children: true })
            chaserHealthBar = null
            playerHealth -= 1
            player.tint = playerHealth === 2 ? 0xffd17f : playerHealth === 1 ? 0xff7f7f : 0x555555
            reportHud()
            chaserRespawn = config.enemySpawnIntervalSeconds
            nextEnemy = 'shooter'
            if (playerHealth <= 0) finish('death')
          }
        }
        if (shooter) {
          const targetAngle = Math.atan2(player.x - shooter.x, -(player.y - shooter.y))
          shooter.rotation += normalizeAngle(targetAngle - shooter.rotation) * Math.min(1, seconds * 2.4)
          const distanceToPlayer = Math.sqrt(distanceSquared(shooter.x, shooter.y, player.x, player.y))
          if (distanceToPlayer > SHOOTER_ATTACK_RANGE) {
            const nextX = shooter.x + Math.sin(shooter.rotation) * SHOOTER_SPEED * seconds
            const nextY = shooter.y - Math.cos(shooter.rotation) * SHOOTER_SPEED * seconds
            const hitsIsland = distanceSquared(nextX, nextY, islandX, islandY) < (CHASER_RADIUS + ISLAND_RADIUS) ** 2
            if (!hitsIsland) { shooter.x = Math.max(CHASER_RADIUS, Math.min(app.screen.width - CHASER_RADIUS, nextX)); shooter.y = Math.max(CHASER_RADIUS, Math.min(app.screen.height - CHASER_RADIUS, nextY)) }
          } else fireEnemy()
        }
        for (const projectile of [...projectiles]) {
          projectile.graphic.x += projectile.velocityX * seconds
          projectile.graphic.y += projectile.velocityY * seconds
          projectile.remainingLife -= seconds
          const hitsIsland = distanceSquared(projectile.graphic.x, projectile.graphic.y, islandX, islandY) < ISLAND_RADIUS ** 2
          const outside = projectile.graphic.x < 0 || projectile.graphic.x > app.screen.width || projectile.graphic.y < 0 || projectile.graphic.y > app.screen.height
          const hitsChaser = projectile.owner === 'player' && chaser && distanceSquared(projectile.graphic.x, projectile.graphic.y, chaser.x, chaser.y) < (CHASER_RADIUS + 6) ** 2
          const hitsShooter = projectile.owner === 'player' && shooter && distanceSquared(projectile.graphic.x, projectile.graphic.y, shooter.x, shooter.y) < (CHASER_RADIUS + 6) ** 2
          const hitsPlayer = projectile.owner === 'enemy' && distanceSquared(projectile.graphic.x, projectile.graphic.y, player.x, player.y) < (PLAYER_RADIUS + 6) ** 2
          if (hitsChaser && chaser) {
            chaserHealth -= 1
            if (chaserHealth <= 0) {
              explode(chaser.x, chaser.y)
              chaser.destroy()
              chaser = null
              chaserHealthBar?.destroy({ children: true })
              chaserHealthBar = null
              score += 1
              reportHud()
              chaserRespawn = config.enemySpawnIntervalSeconds
              nextEnemy = 'shooter'
            } else chaser.tint = 0xffaaa0
          }
          if (hitsShooter && shooter) {
            shooterHealth -= 1
            if (shooterHealth <= 0) {
              explode(shooter.x, shooter.y)
              shooter.destroy()
              shooter = null
              shooterHealthBar?.destroy({ children: true })
              shooterHealthBar = null
              score += 1
              reportHud()
              chaserRespawn = config.enemySpawnIntervalSeconds
              nextEnemy = 'chaser'
            } else shooter.tint = 0xffaaa0
          }
          if (hitsPlayer) {
            playerHealth -= 1
            player.tint = playerHealth === 2 ? 0xffd17f : playerHealth === 1 ? 0xff7f7f : 0x555555
            reportHud()
            if (playerHealth <= 0) finish('death')
          }
          if (projectile.remainingLife <= 0 || hitsIsland || outside || hitsChaser || hitsShooter || hitsPlayer) removeProjectile(projectile)
        }
        drawHealthBar(playerHealthBar, player.x, player.y, playerHealth, 3)
        if (chaser && chaserHealthBar) drawHealthBar(chaserHealthBar, chaser.x, chaser.y, chaserHealth, ENEMY_MAX_HEALTH)
        if (shooter && shooterHealthBar) drawHealthBar(shooterHealthBar, shooter.x, shooter.y, shooterHealth, ENEMY_MAX_HEALTH)
      })
    }

    void mount()
    return () => {
      active = false
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      touchPressed.clear()
      cleanupScenery?.()
      if (initialized) app.destroy(true, { children: true })
    }
  }, [config, onHudChange, onEnd])

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
