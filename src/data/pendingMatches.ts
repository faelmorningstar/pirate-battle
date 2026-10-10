import { useCallback, useEffect, useRef, useState } from 'react'
import { isMatchRecord, type MatchRecord } from './contracts'
import { useRegisterMatch } from './queries'
import { NETWORK_SCENARIO_CHANGED } from '../mocks/networkScenario'

const STORAGE_KEY = 'pirate-battle:pending-matches'
export const PENDING_MATCHES_RESET = 'pirate-battle:pending-matches-reset'

function readPending(): MatchRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(isMatchRecord)
  } catch { return [] }
}

export function resetPendingMatches() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(PENDING_MATCHES_RESET))
}

export function usePendingMatches() {
  const [pending, setPending] = useState(readPending)
  const queue = useRef(pending)
  const flights = useRef(new Set<string>())
  const retryRequested = useRef(new Set<string>())
  const generation = useRef(0)
  const [saving, setSaving] = useState<string[]>([])
  const [storageFailed, setStorageFailed] = useState(false)
  const { mutateAsync } = useRegisterMatch()

  const persist = useCallback((records: MatchRecord[]) => {
    queue.current = records
    setPending(records)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); setStorageFailed(false) }
    catch { setStorageFailed(true) }
  }, [])

  const send = useCallback(async function sendRecord(record: MatchRecord) {
    // O bloqueio é síncrono: dois cliques no mesmo frame geram só uma requisição.
    if (flights.current.has(record.id)) return
    const attemptGeneration = generation.current
    flights.current.add(record.id)
    setSaving([...flights.current])
    try {
      const confirmed = await mutateAsync(record)
      if (confirmed.id === record.id && generation.current === attemptGeneration) {
        persist(queue.current.filter((item) => item.id !== record.id))
      }
    } catch { /* A pendência permanece disponível para tentativa manual ou recuperação. */ }
    finally {
      flights.current.delete(record.id)
      setSaving([...flights.current])
      // Se a rede voltou durante o envio, executamos uma tentativa após sua conclusão.
      const requested = retryRequested.current.delete(record.id)
      if (requested && generation.current === attemptGeneration && queue.current.some((item) => item.id === record.id)) void sendRecord(record)
    }
  }, [mutateAsync, persist])

  const enqueue = useCallback((record: MatchRecord) => {
    if (!queue.current.some((item) => item.id === record.id)) persist([...queue.current, record])
    void send(record)
  }, [persist, send])
  const retryAll = useCallback(() => {
    queue.current.forEach((record) => {
      if (flights.current.has(record.id)) retryRequested.current.add(record.id)
      else void send(record)
    })
  }, [send])

  useEffect(() => {
    const reset = () => { generation.current += 1; retryRequested.current.clear(); persist([]) }
    window.addEventListener('online', retryAll)
    window.addEventListener(NETWORK_SCENARIO_CHANGED, retryAll)
    window.addEventListener(PENDING_MATCHES_RESET, reset)
    // Refresh restaura a fila, mas não provoca reenvio automático em rede ainda ruim.
    return () => {
      window.removeEventListener('online', retryAll)
      window.removeEventListener(NETWORK_SCENARIO_CHANGED, retryAll)
      window.removeEventListener(PENDING_MATCHES_RESET, reset)
    }
  }, [persist, retryAll])
  return { pending, saving, storageFailed, enqueue, retryAll }
}
