import { pirateAsset } from './assets'

export const SOUND_FILES = [
  'ui_click', 'game_start', 'game_pause', 'game_resume', 'cannon_fire_1',
  'cannon_broadside', 'ship_wood_hit_1', 'ship_explosion_1', 'score_point', 'game_over',
] as const
type SoundName = typeof SOUND_FILES[number]
const COMBAT_SOUNDS = new Set<SoundName>(['cannon_fire_1', 'cannon_broadside', 'ship_wood_hit_1', 'ship_explosion_1', 'score_point'])
const PREFERENCE_KEY = 'pirate-battle:sound-muted'

export class GameAudio {
  muted = false
  private context?: AudioContext
  private gain?: GainNode
  private primingSource?: AudioBufferSourceNode
  private buffers = new Map<SoundName, Promise<AudioBuffer | undefined>>()
  private voices = new Map<SoundName, AudioBufferSourceNode>()
  private epoch = 0
  private combatEpoch = 0
  private playing = false
  private requests = new AbortController()

  constructor() {
    try { this.muted = localStorage.getItem(PREFERENCE_KEY) === 'true' } catch { /* A preferência não é obrigatória para jogar. */ }
  }

  // Criação, resume e preparação ocorrem na própria pilha do gesto, sem await.
  unlockAudio(): Promise<void> | undefined {
    if (this.muted || document.hidden) return
    try {
      if (!this.context) {
        const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Context) return
        this.context = new Context()
        this.gain = this.context.createGain()
        this.gain.gain.value = 0.45
        this.gain.connect(this.context.destination)
      }
      const context = this.context
      // Mesmo um contexto "running" pode precisar renovar a liberação no iOS.
      const ready = context.resume()
      void ready.catch(() => {})
      this.stopPriming()
      try {
        const source = context.createBufferSource()
        this.primingSource = source
        // Repetimos no click: um pointerdown de toque pode ainda não liberar o iOS.
        // Um único sample zerado é silencioso e não depende de carregar um WAV.
        source.buffer = context.createBuffer(1, 1, context.sampleRate)
        source.connect(context.destination)
        source.onended = () => {
          source.disconnect()
          if (this.primingSource === source) this.primingSource = undefined
        }
        source.start(0)
      } catch { this.stopPriming() }
      return ready
    } catch { /* A liberação bloqueada nunca impede a ação do jogador. */ }
  }

  // Só a reprodução dos efeitos aguarda resume, download e decodificação.
  activate(sound?: SoundName, unlocked?: Promise<void>) {
    if (this.muted || document.hidden) return
    try {
      const ready = unlocked ?? this.unlockAudio()
      const context = this.context
      if (!ready || !context) return
      const epoch = this.epoch
      void ready.then(() => {
        if (context !== this.context || epoch !== this.epoch || this.muted) return
        for (const name of SOUND_FILES) this.load(name, context)
        if (sound) this.play(sound)
      }).catch(() => {})
    } catch { /* Navegadores sem áudio continuam executando a partida normalmente. */ }
  }

  private load(name: SoundName, context: AudioContext) {
    let buffer = this.buffers.get(name)
    if (!buffer) {
      buffer = fetch(pirateAsset(`sounds/${name}.wav`), { signal: this.requests.signal })
        .then((response) => { if (!response.ok) throw new Error('Sound unavailable'); return response.arrayBuffer() })
        .then((bytes) => context.decodeAudioData(bytes))
        .catch(() => undefined)
      this.buffers.set(name, buffer)
    }
    return buffer
  }

  play(name: SoundName) {
    const context = this.context
    if (!context || this.muted || document.hidden || context.state !== 'running') return
    const epoch = this.epoch
    const combatEpoch = this.combatEpoch
    const requestedAt = performance.now()
    void this.load(name, context).then((buffer) => {
      // Sons atrasados ou pertencentes a uma cena anterior não voltam a tocar.
      if (!buffer || context !== this.context || epoch !== this.epoch || this.muted || document.hidden || context.state !== 'running') return
      if (COMBAT_SOUNDS.has(name) && (!this.playing || combatEpoch !== this.combatEpoch)) return
      if (performance.now() - requestedAt > 500 || this.voices.has(name) || this.voices.size >= 4) return
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(this.gain!)
      source.onended = () => {
        if (this.voices.get(name) === source) this.voices.delete(name)
        source.disconnect()
      }
      this.voices.set(name, source)
      source.start()
    }).catch(() => {})
  }

  startBattle(unlocked?: Promise<void>) { this.stopAll(); this.playing = true; this.activate('game_start', unlocked) }
  pauseBattle(paused: boolean) {
    this.stopAll()
    this.playing = !paused
    this.activate(paused ? 'game_pause' : 'game_resume')
  }
  endBattle() { this.stopAll(); this.playing = false; this.play('game_over') }
  exitBattle() { this.stopAll(); this.playing = false }

  toggleMuted() {
    this.muted = !this.muted
    this.stopAll()
    if (this.gain) this.gain.gain.value = this.muted ? 0 : 0.45
    try { localStorage.setItem(PREFERENCE_KEY, String(this.muted)) } catch { /* Armazenamento bloqueado não impede alternar o som. */ }
    if (!this.muted) this.activate()
    return this.muted
  }

  private stopVoice(name: SoundName, source: AudioBufferSourceNode) {
    source.onended = null
    try { source.stop() } catch { /* A fonte pode já ter terminado. */ }
    source.disconnect()
    this.voices.delete(name)
  }
  private stopPriming() {
    const source = this.primingSource
    if (!source) return
    source.onended = null
    try { source.stop() } catch { /* O sample silencioso pode já ter terminado. */ }
    source.disconnect()
    this.primingSource = undefined
  }
  stopCombat() {
    this.combatEpoch += 1
    for (const [name, source] of this.voices) if (COMBAT_SOUNDS.has(name)) this.stopVoice(name, source)
  }
  stopAll() {
    this.epoch += 1
    this.combatEpoch += 1
    for (const [name, source] of this.voices) this.stopVoice(name, source)
  }
  dispose() {
    this.exitBattle()
    this.stopPriming()
    this.requests.abort()
    this.requests = new AbortController()
    this.buffers.clear()
    const context = this.context
    this.context = undefined
    this.gain = undefined
    if (context) void context.close().catch(() => {})
  }
}
