import { useState, type FormEvent } from 'react'
import { OfficialIcon } from './OfficialUi'
import { NetworkControls } from './NetworkControls'
import { GAME_SESSION_LIMITS, type GameSessionOptions } from '../game/config'
type Props = { config: GameSessionOptions; onSave: (config: GameSessionOptions) => void; onCancel: () => void; onReset: () => void }
export function OptionsPanel({ config, onSave, onCancel, onReset }: Props) {
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(config.sessionDurationSeconds)
  const [enemySpawnIntervalSeconds, setEnemySpawnIntervalSeconds] = useState(config.enemySpawnIntervalSeconds)
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSave({ sessionDurationSeconds, enemySpawnIntervalSeconds }) }
  return <><form className="options-form" onSubmit={submit}><h2>Options</h2><label>Game session time ({GAME_SESSION_LIMITS.sessionDurationSeconds.min}–{GAME_SESSION_LIMITS.sessionDurationSeconds.max} seconds)<input type="number" min={GAME_SESSION_LIMITS.sessionDurationSeconds.min} max={GAME_SESSION_LIMITS.sessionDurationSeconds.max} value={sessionDurationSeconds} onChange={(event) => setSessionDurationSeconds(Number(event.target.value))} /></label><label>Enemy spawn time ({GAME_SESSION_LIMITS.enemySpawnIntervalSeconds.min}–{GAME_SESSION_LIMITS.enemySpawnIntervalSeconds.max} seconds)<input type="number" min={GAME_SESSION_LIMITS.enemySpawnIntervalSeconds.min} max={GAME_SESSION_LIMITS.enemySpawnIntervalSeconds.max} value={enemySpawnIntervalSeconds} onChange={(event) => setEnemySpawnIntervalSeconds(Number(event.target.value))} /></label><div className="menu-actions"><button className="button button-primary" type="submit">Save</button><button className="button button-secondary" type="button" onClick={onCancel}><OfficialIcon name="close" />Cancel</button><button className="button button-text" type="button" onClick={onReset}><OfficialIcon name="restart" />Reset defaults</button></div></form><details className="network-tools"><summary>Network testing tools</summary><p>Simulate ranking and match history network conditions.</p><NetworkControls /></details></>
}
