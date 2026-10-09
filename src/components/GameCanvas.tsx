import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Application, Assets, Graphics, Sprite, Texture } from 'pixi.js'
import type { GameConfig } from '../game/config'

export type GameHud = { health: number; score: number; timeLeft: number; paused: boolean }
export type GameResult = { score: number; durationSeconds: number; reason: 'time' | 'death' }
type Props = { config: GameConfig; hud: GameHud; onHudChange: (hud: GameHud) => void; onEnd: (result: GameResult) => void; onExit: () => void }
type Projectile = { graphic: Graphics; velocityX: number; velocityY: number; remainingLife: number; owner: 'player' | 'enemy' }

const PLAYER_RADIUS = 26
const ISLAND_RADIUS = window.matchMedia('(pointer: coarse)').matches ? 56 : 88
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
const PLAYER_SHIP_ASSET = 'https://raw.githubusercontent.com/junglegaming/game-developer-challenge/main/assets/png/default/ships/ship_12.png'
const CHASER_SHIP_ASSET = 'https://raw.githubusercontent.com/junglegaming/game-developer-challenge/main/assets/png/default/ships/ship_5.png'
const SHOOTER_SHIP_ASSET = 'https://raw.githubusercontent.com/junglegaming/game-developer-challenge/main/assets/png/default/ships/ship_20.png'

const ASSET_LOAD_TIMEOUT_MS = 2500

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

function createHealthBar() { return new Graphics() }
function drawHealthBar(bar: Graphics, x: number, y: number, health: number, maxHealth: number) {
  bar.clear().roundRect(-24, -4, 48, 8, 3).fill(0x2b2020)
  bar.roundRect(-22, -2, Math.max(0, 44 * health / maxHealth), 4, 2).fill(health / maxHealth > 0.5 ? 0x75d16e : 0xe86950)
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
      projectile.graphic.destroy()
      projectiles.splice(projectiles.indexOf(projectile), 1)
    }

    async function mount() {
      await app.init({ background: '#0b5672', resizeTo: canvasHost, antialias: true, resolution: Math.min(window.devicePixelRatio, 2) })
      initialized = true

      if (!active) { app.destroy(true); return }
      canvasHost.appendChild(app.canvas)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      document.addEventListener('visibilitychange', onVisibilityChange)

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
      const island = new Graphics().circle(0, 0, ISLAND_RADIUS).fill(0x79a64d).stroke({ color: 0x315923, width: 9 })
      islandX = app.screen.width * 0.52
      islandY = app.screen.height * 0.45
      island.position.set(islandX, islandY)
      app.stage.addChild(island)

      const player = createShip(0xf2c35e, playerTexture)
      player.position.set(app.screen.width * 0.5, app.screen.height * 0.78)
      app.stage.addChild(player)
      const playerHealthBar = createHealthBar()
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
        chaserHealthBar = createHealthBar()
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
        shooterHealthBar = createHealthBar()
        app.stage.addChild(shooterHealthBar)
      }

      const explode = (x: number, y: number) => {
        const effect = new Graphics().circle(0, 0, 12).fill(0xffb648)
        effect.position.set(x, y)
        app.stage.addChild(effect)
        let elapsed = 0
        const animate = (ticker: { deltaMS: number }) => {
          elapsed += ticker.deltaMS / 1000
          effect.scale.set(1 + elapsed * 4)
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
        const graphic = new Graphics().circle(0, 0, 6).fill(0x17120d).stroke({ color: 0xffe2a4, width: 2 })
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
          const graphic = new Graphics().circle(0, 0, 5).fill(0x17120d).stroke({ color: 0xffe2a4, width: 2 })
          graphic.position.set(player.x + directionX * 33 + forwardX * offset, player.y + directionY * 33 + forwardY * offset)
          app.stage.addChild(graphic)
          projectiles.push({ graphic, velocityX: directionX * PROJECTILE_SPEED, velocityY: directionY * PROJECTILE_SPEED, remainingLife: 0.9, owner: 'player' })
        }
      }

      const fireEnemy = () => {
        if (!shooter || shooterFireCooldown > 0) return
        shooterFireCooldown = SHOOTER_FIRE_COOLDOWN
        const graphic = new Graphics().circle(0, 0, 6).fill(0x732c25).stroke({ color: 0xffb070, width: 2 })
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
            chaserHealthBar?.destroy()
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
              chaserHealthBar?.destroy()
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
              shooterHealthBar?.destroy()
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
      if (initialized) app.destroy(true)
    }
  }, [config, onHudChange, onEnd])

  const touchControl = (code: string) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); touchPressedRef.current.add(code) },
    onPointerUp: () => touchPressedRef.current.delete(code),
    onPointerCancel: () => touchPressedRef.current.delete(code),
    onPointerLeave: () => touchPressedRef.current.delete(code),
  })
  return <main className="game-screen"><header className="game-header"><span>Hull: {hud.health}/3 · Score: {hud.score} · Time: {hud.timeLeft}s</span><div className="game-actions"><button type="button" className="button button-secondary" onClick={() => togglePauseRef.current()}>{hud.paused ? 'Resume' : 'Pause'}</button><button type="button" className="button button-secondary" onClick={onExit}>Exit game</button></div></header>{assetStatus !== 'ready' && <div className="asset-message" role="status">{assetStatus === 'loading' ? 'Loading battle assets…' : 'Asset fallback enabled.'}</div>}{hud.paused && <div className="pause-message" role="status">Paused — press P or Resume to continue.</div>}<div className="game-canvas" ref={hostRef} aria-label="Pirate Battle game arena" /><nav className="touch-controls" aria-label="Touch controls"><div><button type="button" aria-label="Turn left" {...touchControl('KeyA')}>↶</button><button type="button" aria-label="Move forward" {...touchControl('KeyW')}>▲</button><button type="button" aria-label="Turn right" {...touchControl('KeyD')}>↷</button></div><div><button type="button" aria-label="Fire port broadside" {...touchControl('KeyQ')}>Q</button><button type="button" aria-label="Fire front cannon" {...touchControl('Space')}>●</button><button type="button" aria-label="Fire starboard broadside" {...touchControl('KeyE')}>E</button></div></nav></main>
}
