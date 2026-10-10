type Props = { muted: boolean; onToggle: () => void }

export function SoundButton({ muted, onToggle }: Props) {
  return <button type="button" className="button sound-toggle" aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted} onClick={onToggle}>
    <svg className="sound-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
      {muted ? <path d="m16 9 6 6m0-6-6 6" /> : <path d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14" />}
    </svg>
  </button>
}
