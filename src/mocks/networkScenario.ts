export type NetworkScenario = 'normal' | 'slow' | 'empty' | 'ranking-error' | 'history-error'

const SCENARIO_KEY = 'pirate-battle:network-scenario'

export const scenarios: NetworkScenario[] = ['normal', 'slow', 'empty', 'ranking-error', 'history-error']

export function getNetworkScenario(): NetworkScenario {
  const value = localStorage.getItem(SCENARIO_KEY)
  return scenarios.includes(value as NetworkScenario) ? value as NetworkScenario : 'normal'
}

export function setNetworkScenario(scenario: NetworkScenario) { localStorage.setItem(SCENARIO_KEY, scenario) }
