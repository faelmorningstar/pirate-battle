import { pirateAsset } from '../game/assets'

type IconName = 'turn_left' | 'turn_right' | 'forward' | 'fire_front' | 'fire_left' | 'fire_right' | 'pause' | 'play' | 'home' | 'restart' | 'settings' | 'close'

export function OfficialIcon({ name }: { name: IconName }) {
  return <img className="official-icon" src={pirateAsset(`ui/controls/icon_${name}.png`)} alt="" aria-hidden="true" draggable={false} />
}

export function HealthMeter({ health, maxHealth }: { health: number; maxHealth: number }) {
  const ratio = Math.max(0, Math.min(1, health / maxHealth))
  const color = ratio > 0.5 ? 'green' : ratio > 1 / 3 ? 'amber' : 'red'
  // O recorte usa a área lógica do preenchimento, mantendo a textura sem compressão.
  const right = 100 * (1 - (30 + 196 * ratio) / 256)
  return <span className="health-meter" aria-hidden="true">
    <img src={pirateAsset('ui/hud/health_frame.png')} alt="" draggable={false} />
    <img src={pirateAsset(`ui/hud/health_fill_${color}.png`)} style={{ clipPath: `inset(0 ${right}% 0 0)` }} alt="" draggable={false} />
  </span>
}
