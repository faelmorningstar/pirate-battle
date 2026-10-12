import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'

type Props = { disabled: boolean; onInput: (codes: string[]) => void }
const TOUCH_QUERY = '(hover: none), (pointer: coarse)'
const DEAD_ZONE = 0.18

export function MobileJoystick({ disabled, onInput }: Props) {
  const baseRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<number | null>(null)
  const inputRef = useRef(onInput)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  useLayoutEffect(() => { inputRef.current = onInput }, [onInput])

  const reset = () => {
    const pointer = pointerRef.current
    pointerRef.current = null
    if (pointer !== null && baseRef.current?.hasPointerCapture(pointer)) baseRef.current.releasePointerCapture(pointer)
    setOffset({ x: 0, y: 0 })
    inputRef.current([])
  }

  useEffect(() => {
    const media = window.matchMedia(TOUCH_QUERY)
    const release = () => reset()
    const visibility = () => { if (document.hidden) reset() }
    window.addEventListener('blur', release)
    window.addEventListener('resize', release)
    media.addEventListener('change', release)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('blur', release)
      window.removeEventListener('resize', release)
      media.removeEventListener('change', release)
      document.removeEventListener('visibilitychange', visibility)
      inputRef.current([])
    }
  }, [])

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || pointerRef.current !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = rect.width / 2 - 22
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const scale = Math.min(1, radius / (Math.hypot(dx, dy) || 1))
    const x = dx * scale / radius, y = dy * scale / radius
    setOffset({ x: x * radius, y: y * radius })
    // O vetor aciona as mesmas teclas: não existe marcha à ré nem velocidade nova.
    const codes = []
    if (y < -DEAD_ZONE) codes.push('KeyW')
    if (x < -DEAD_ZONE) codes.push('KeyA')
    if (x > DEAD_ZONE) codes.push('KeyD')
    inputRef.current(codes)
    event.preventDefault()
  }

  const keyboard = (event: KeyboardEvent<HTMLDivElement>, down: boolean) => {
    if (!['ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    if (disabled) return
    // O teclado global do jogo continua sendo a única fonte de W/A/D.
    if (down) inputRef.current([event.key === 'ArrowUp' ? 'KeyW' : event.key === 'ArrowLeft' ? 'KeyA' : 'KeyD'])
    else reset()
  }

  return <div ref={baseRef} className="mobile-joystick" role="group" aria-label="Movement joystick" aria-describedby="joystick-help" aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
    onPointerDown={(event) => {
      if (disabled || pointerRef.current !== null || event.button !== 0) return
      pointerRef.current = event.pointerId
      // Captura mantém o dedo responsável pelo movimento mesmo fora da base.
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Eventos sintéticos não têm ponteiro ativo. */ }
      move(event)
    }} onPointerMove={move}
    onPointerUp={(event) => { if (pointerRef.current === event.pointerId) reset() }}
    onPointerCancel={(event) => { if (pointerRef.current === event.pointerId) reset() }}
    onLostPointerCapture={(event) => { if (pointerRef.current === event.pointerId) reset() }}
    onKeyDown={(event) => keyboard(event, true)} onKeyUp={(event) => keyboard(event, false)} onBlur={reset}>
    <span id="joystick-help" className="sr-only">Move forward: drag up. Turn left or right: drag sideways. Use arrow keys when focused.</span>
    <span className="joystick-knob" aria-hidden="true" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} />
  </div>
}
