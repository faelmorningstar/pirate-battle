import { Container, Graphics } from 'pixi.js'

type Feedback = { damage: Graphics; severe: Graphics; impact: Graphics; remaining: number }
const feedback = new WeakMap<Container, Feedback>()

export function prepareShipFeedback(ship: Container) {
  // Marcas persistentes complementam a cor; os desenhos são criados uma vez por navio.
  const damage = new Graphics({ label: 'damage' }).moveTo(-15, 18).lineTo(-5, 9).lineTo(-9, 1).lineTo(2, -9)
    .stroke({ color: 0x302018, width: 3 }).moveTo(-18, 20).lineTo(-6, 15).stroke({ color: 0xeac38b, width: 2 })
  const severe = new Graphics({ label: 'severe-damage' }).moveTo(13, -18).lineTo(3, -8).lineTo(8, 3).lineTo(-1, 16)
    .stroke({ color: 0x302018, width: 4 }).poly([3, -17, 14, -6, 4, -2]).fill({ color: 0x302018, alpha: 0.8 })
  const impact = new Graphics({ label: 'impact' }).circle(0, 0, 30).stroke({ color: 0xfff1b5, width: 4, alpha: 0.9 })
  damage.visible = severe.visible = impact.visible = false
  ship.addChild(damage, severe, impact)
  feedback.set(ship, { damage, severe, impact, remaining: 0 })
}

export function showShipImpact(ship: Container) {
  const state = feedback.get(ship)
  if (state) { state.remaining = 0.18; state.impact.visible = true }
}

export function updateShipFeedback(ship: Container, health: number, maxHealth: number, seconds: number) {
  const state = feedback.get(ship)
  if (!state) return
  state.damage.visible = health < maxHealth
  state.severe.visible = health / maxHealth <= 1 / 3
  ship.tint = health === maxHealth ? 0xffffff : health / maxHealth > 1 / 3 ? 0xe9bd91 : 0xcd9583
  state.remaining = Math.max(0, state.remaining - seconds)
  state.impact.visible = state.remaining > 0
  state.impact.alpha = state.remaining / 0.18
}
