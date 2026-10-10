import { Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import { pirateAsset } from './assets'

export const ARENA_IMAGES = {
  water: 'tiles/tile_73.png',
  sand: 'tiles/tile_18.png',
  coast: 'tiles/tile_1.png',
  grass: 'tiles/tile_39.png',
  palm: 'tiles/tile_71.png',
  rock: 'tiles/tile_66.png',
  cannonball: 'ship_parts/cannon_ball.png',
  explosion: 'effects/explosion_1.png',
} as const

export type ArenaTextures = Partial<Record<keyof typeof ARENA_IMAGES, Texture>>

export async function loadArenaTextures(timeoutMs: number): Promise<ArenaTextures> {
  let timeout: number | undefined
  // Uma falha não impede os demais assets; o prazo limita a espera pelo novo visual.
  const loading = Promise.allSettled(Object.entries(ARENA_IMAGES).map(async ([name, path]) => {
    const texture = await Assets.load<Texture>(pirateAsset(path))
    return [name, texture] as const
  })).then((results) => {
    const textures: ArenaTextures = {}
    for (const result of results) {
      if (result.status === 'fulfilled') textures[result.value[0] as keyof ArenaTextures] = result.value[1]
    }
    return textures
  })
  try {
    return await Promise.race([
      loading,
      new Promise<ArenaTextures>((resolve) => { timeout = window.setTimeout(() => resolve({}), timeoutMs) }),
    ])
  } finally {
    window.clearTimeout(timeout)
  }
}

export function createTexturedSea(texture: Texture) {
  // Um único objeto repete a água, sem criar sprites por tile ou por frame.
  return new TilingSprite({ texture, tileScale: { x: 0.75, y: 0.75 } })
}

export function createTexturedIsland(radius: number, textures: ArenaTextures): Container | undefined {
  const { sand, coast, grass, palm, rock } = textures
  if (!sand || !coast || !grass || !palm || !rock) return undefined
  const island = new Container()
  const scale = radius / 88
  const shore = new Graphics().circle(0, 0, radius + 2).stroke({ color: 0xd4f7ec, alpha: 0.35, width: 3 })
  const sandLayer = new Container()
  const sandBase = new TilingSprite({ texture: sand, width: radius * 2, height: radius * 2, tileScale: { x: scale * 0.5, y: scale * 0.5 } })
  sandBase.position.set(-radius, -radius)
  sandLayer.addChild(sandBase)
  for (let corner = 0; corner < 4; corner += 1) {
    const beach = new Sprite({ texture: coast, anchor: 1, width: radius, height: radius, rotation: corner * Math.PI / 2 })
    sandLayer.addChild(beach)
  }
  // O recorte da areia termina exatamente no raio físico; só a espuma passa dele.
  const sandMask = new Graphics().circle(0, 0, radius).fill(0xffffff)
  sandLayer.mask = sandMask
  const grassLayer = new Sprite({ texture: grass, width: radius * 2, height: radius * 2 })
  grassLayer.position.set(-radius, -radius)
  const grassMask = new Graphics()
    .moveTo(0, -radius * 0.7)
    .bezierCurveTo(radius * 0.25, -radius * 0.8, radius * 0.75, -radius * 0.45, radius * 0.65, -radius * 0.05)
    .bezierCurveTo(radius * 0.82, radius * 0.35, radius * 0.42, radius * 0.76, radius * 0.05, radius * 0.64)
    .bezierCurveTo(-radius * 0.3, radius * 0.8, -radius * 0.76, radius * 0.35, -radius * 0.65, 0)
    .bezierCurveTo(-radius * 0.8, -radius * 0.38, -radius * 0.36, -radius * 0.8, 0, -radius * 0.7)
    .closePath().fill(0xffffff)
  grassLayer.mask = grassMask
  island.addChild(shore, sandLayer, sandMask, grassLayer, grassMask)
  const decorate = (texture: Texture, x: number, y: number, size: number) => {
    const sprite = new Sprite({ texture, anchor: 0.5, width: size, height: size })
    sprite.position.set(x, y)
    island.addChild(sprite)
  }
  // A composição é feita uma vez e cresce junto com o raio já escolhido pelo jogo.
  decorate(palm, -radius * 0.28, -radius * 0.28, radius * 0.62)
  decorate(palm, radius * 0.3, radius * 0.15, radius * 0.55)
  decorate(palm, -radius * 0.16, radius * 0.4, radius * 0.42)
  decorate(rock, radius * 0.45, -radius * 0.43, radius * 0.42)
  decorate(rock, -radius * 0.4, radius * 0.46, radius * 0.3)
  return island
}

export function createCombatVisual(texture: Texture | undefined, radius: number, color: number, strokeColor?: number) {
  if (texture) {
    return new Sprite({ texture, anchor: 0.5, width: radius * 2, height: radius * 2 })
  }
  const graphic = new Graphics().circle(0, 0, radius).fill(color)
  if (strokeColor !== undefined) graphic.stroke({ color: strokeColor, width: 2 })
  return graphic
}
