import { useState, type FormEvent } from 'react'
import { OfficialIcon } from './OfficialUi'
import type { GameConfig } from '../game/config'
type Props = { config: GameConfig; onSave: (config: GameConfig) => void; onCancel: () => void; onReset: () => void }
export function OptionsPanel({ config, onSave, onCancel, onReset }: Props) {
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(config.sessionDurationSeconds)
  const [enemySpawnIntervalSeconds, setEnemySpawnIntervalSeconds] = useState(config.enemySpawnIntervalSeconds)
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSave({ sessionDurationSeconds, enemySpawnIntervalSeconds }) }
  return <form className="options-form" onSubmit={submit}><h2>Options</h2><label>Game session time (60–180 seconds)<input type="number" min="60" max="180" value={sessionDurationSeconds} onChange={(event) => setSessionDurationSeconds(Number(event.target.value))} /></label><label>Enemy spawn time (1–12 seconds)<input type="number" min="1" max="12" value={enemySpawnIntervalSeconds} onChange={(event) => setEnemySpawnIntervalSeconds(Number(event.target.value))} /></label><div className="menu-actions"><button className="button button-primary" type="submit">Save</button><button className="button button-secondary" type="button" onClick={onCancel}><OfficialIcon name="close" />Cancel</button><button className="button button-text" type="button" onClick={onReset}><OfficialIcon name="restart" />Reset defaults</button></div></form>
}
