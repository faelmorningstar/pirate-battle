export const scenarios = ['normal', 'slow', 'empty', 'ranking-error', 'history-error', 'paginated', 'variable-latency', 'out-of-order', 'timeout', 'connection-error', 'http-400', 'http-503', 'post-timeout', 'post-unavailable'] as const
export type NetworkScenario = typeof scenarios[number]
const SCENARIO_KEY = 'pirate-battle:network-scenario'
export const NETWORK_SCENARIO_CHANGED = 'pirate-battle:network-scenario-changed'
export const scenarioDescriptions: Record<NetworkScenario, string> = {
  normal: 'Normal local fixtures and successful requests.', slow: 'Fixed latency: 900 ms.', empty: 'Both lists are empty.',
  'ranking-error': 'Ranking alone returns HTTP 503.', 'history-error': 'Match History alone returns HTTP 503.',
  paginated: 'Twelve additional fixtures, three pages for each list.',
  'variable-latency': 'Repeatable latency cycle: 1200, 150, 700 ms per endpoint.',
  'out-of-order': 'Odd reads wait 1200 ms; even reads wait 150 ms, using request-time snapshots.',
  timeout: 'Reads take 4500 ms, beyond the 4000 ms client timeout.',
  'connection-error': 'Reads fail with a connection error.', 'http-400': 'Reads return HTTP 400, without automatic retry.',
  'http-503': 'Reads return HTTP 503.', 'post-timeout': 'Match is saved before a 4500 ms response delay.',
  'post-unavailable': 'Match registration returns HTTP 503 without saving.',
}

export function getNetworkScenario(): NetworkScenario {
  const value = localStorage.getItem(SCENARIO_KEY)
  return scenarios.includes(value as NetworkScenario) ? value as NetworkScenario : 'normal'
}

export function setNetworkScenario(scenario: NetworkScenario) {
  localStorage.setItem(SCENARIO_KEY, scenario)
  window.dispatchEvent(new Event(NETWORK_SCENARIO_CHANGED))
}

const counters = new Map<string, number>()
// Cada endpoint tem sua sequência, reiniciada ao selecionar/restaurar um cenário.
window.addEventListener(NETWORK_SCENARIO_CHANGED, () => counters.clear())
export function scenarioLatency(scenario: NetworkScenario, endpoint: string) {
  const count = counters.get(endpoint) ?? 0
  counters.set(endpoint, count + 1)
  if (scenario === 'slow') return 900
  if (scenario === 'variable-latency') return [1200, 150, 700][count % 3]
  if (scenario === 'out-of-order') return count % 2 === 0 ? 1200 : 150
  if (scenario === 'timeout') return 4500
  return 0
}
