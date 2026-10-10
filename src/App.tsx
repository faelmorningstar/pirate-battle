import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { MatchHistoryPanel, RankingPanel } from './components/DataPanels'
import { NetworkControls } from './components/NetworkControls'
import { GameCanvas, type GameHud, type GameResult } from './components/GameCanvas'
import { OptionsPanel } from './components/OptionsPanel'
import { PLAYER_ID, useRegisterMatch } from './data/queries'
import type { MatchRecord } from './data/contracts'
import { createGameConfigSnapshot, DEFAULT_GAME_CONFIG, DEFAULT_GAME_SESSION_OPTIONS, loadGameSessionOptions, type GameConfig, type GameSessionOptions } from './game/config'
import { OfficialIcon } from './components/OfficialUi'
import { pirateAsset } from './game/assets'
import { GameAudio } from './game/audio'
import './App.css'

type Screen = 'menu' | 'options' | 'game' | 'result'
type MenuTab = 'home' | 'ranking' | 'history'
type RegistrationState = 'idle' | 'saving' | 'saved' | 'failed'
const INITIAL_HUD: GameHud = { health: DEFAULT_GAME_CONFIG.player.maxHealth, score: 0, timeLeft: 0, paused: false }

function App() {
  const [audio] = useState(() => new GameAudio())
  const [soundMuted, setSoundMuted] = useState(() => audio.muted)
  const toggleSound = useCallback(() => setSoundMuted(audio.toggleMuted()), [audio])
  const menuClick = (event: MouseEvent<HTMLElement>) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null
    // Play tem seu próprio som; os demais cliques de menu recebem só um efeito.
    if (button && !button.disabled && button.dataset.sound !== 'game_start') {
      audio.stopAll()
      audio.activate('ui_click')
    }
  }
  const [screen, setScreen] = useState<Screen>('menu')
  const [menuTab, setMenuTab] = useState<MenuTab>('home')
  const [config, setConfig] = useState<GameSessionOptions>(loadGameSessionOptions)
  const [sessionConfig, setSessionConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG)
  const [hud, setHud] = useState<GameHud>(INITIAL_HUD)
  const [result, setResult] = useState<GameResult | null>(null)
  const [registration, setRegistration] = useState<RegistrationState>('idle')
  const { mutate: registerMatch } = useRegisterMatch()

  useEffect(() => { localStorage.setItem('pirate-battle:config', JSON.stringify(config)) }, [config])
  useEffect(() => { if (result) localStorage.setItem('pirate-battle:last-result', JSON.stringify(result)) }, [result])
  useEffect(() => {
    const silenceHiddenPage = () => { if (document.hidden) audio.stopAll() }
    document.addEventListener('visibilitychange', silenceHiddenPage)
    return () => { document.removeEventListener('visibilitychange', silenceHiddenPage); audio.dispose() }
  }, [audio])

  const primeAudio = () => { audio.unlockAudio() }
  const startGame = () => {
    // Também cobre Enter/VoiceOver, que podem acionar click sem pointerdown.
    const unlocked = audio.unlockAudio()
    audio.startBattle(unlocked)
    const snapshot = createGameConfigSnapshot(config)
    setSessionConfig(snapshot)
    setHud({ ...INITIAL_HUD, health: snapshot.player.maxHealth, timeLeft: snapshot.sessionDurationSeconds }); setResult(null); setRegistration('idle'); setScreen('game')
  }
  const exitGame = useCallback(() => { audio.exitBattle(); setScreen('menu') }, [audio])
  const endGame = useCallback((nextResult: GameResult) => {
    audio.endBattle()
    setResult(nextResult)
    setRegistration('saving')
    setScreen('result')
    const record: MatchRecord = { id: crypto.randomUUID(), playerId: PLAYER_ID, playerName: 'Captain Rafael', completedAt: new Date().toISOString(), score: nextResult.score, durationSeconds: nextResult.durationSeconds, endReason: nextResult.reason, configuration: { sessionDurationSeconds: sessionConfig.sessionDurationSeconds, enemySpawnIntervalSeconds: sessionConfig.enemySpawnIntervalSeconds } }
    registerMatch(record, { onSuccess: () => setRegistration('saved'), onError: () => setRegistration('failed') })
  }, [audio, sessionConfig, registerMatch])

  if (screen === 'game') return <GameCanvas config={sessionConfig} hud={hud} onHudChange={setHud} onEnd={endGame} onExit={exitGame} audio={audio} soundMuted={soundMuted} onToggleSound={toggleSound} />
  if (screen === 'result' && result) return <main className="app-shell" onClickCapture={menuClick}><section className="menu-card result-card"><p className="eyebrow">Battle report</p><h1>Session complete</h1><p className="lead">{result.reason === 'time' ? 'The session timer reached zero.' : 'Your ship was sunk.'}</p><dl className="result-stats"><div><dt>Score</dt><dd>{result.score}</dd></div><div><dt>Time played</dt><dd>{result.durationSeconds}s</dd></div></dl><p className="registration-status" role="status">{registration === 'saving' && 'Saving match record…'}{registration === 'saved' && 'Match record saved.'}{registration === 'failed' && 'Could not save this record. You can still start another battle.'}</p><div className="menu-actions"><button className="button button-primary" type="button" data-sound="game_start" onPointerDown={primeAudio} onClick={startGame}><OfficialIcon name="restart" />Play Again</button><button className="button button-secondary" type="button" onClick={() => setScreen('menu')}><OfficialIcon name="home" />Main Menu</button></div></section></main>

  const home = <><div className="menu-actions"><button className="button button-primary" type="button" data-sound="game_start" onPointerDown={primeAudio} onClick={startGame}><OfficialIcon name="play" />Play</button><button className="button button-secondary" type="button" onClick={() => setScreen('options')}><OfficialIcon name="settings" />Options</button></div><div className="controls"><h2>Controls</h2><p><kbd>W</kbd> Move forward <kbd>A</kbd>/<kbd>D</kbd> Turn</p><p><kbd>Space</kbd> Front fire <kbd>Q</kbd>/<kbd>E</kbd> Broadside fire</p><p><kbd>P</kbd> Pause</p></div><NetworkControls /><footer className="brand-attribution"><img src={pirateAsset('branding/logo_jungle_gaming.svg')} alt="Official assets by Jungle Gaming" width="112" height="56" /></footer></>
  return <main className="app-shell" onClickCapture={menuClick}><section className="menu-card" aria-labelledby="game-title"><h1 id="game-title" className="sr-only">Pirate Battle</h1><div className="official-title"><img src={pirateAsset('ui/menu/title_pirate_battle.png')} alt="" aria-hidden="true" width="384" height="128" /></div><p className="lead">Sail the arena, sink hostile ships and survive the session.</p>{screen === 'options' ? <OptionsPanel config={config} onSave={(next) => { setConfig(next); setScreen('menu') }} onCancel={() => setScreen('menu')} onReset={() => setConfig(DEFAULT_GAME_SESSION_OPTIONS)} /> : <><div className="tabs" role="tablist" aria-label="Menu sections"><button type="button" role="tab" aria-selected={menuTab === 'home'} onClick={() => setMenuTab('home')}>Home</button><button type="button" role="tab" aria-selected={menuTab === 'ranking'} onClick={() => setMenuTab('ranking')}>Ranking</button><button type="button" role="tab" aria-selected={menuTab === 'history'} onClick={() => setMenuTab('history')}>Match History</button></div>{menuTab === 'home' && home}{menuTab === 'ranking' && <RankingPanel />}{menuTab === 'history' && <MatchHistoryPanel />}</>}</section></main>
}
export default App
