import { resetMatches } from '../mocks/store'
import { getNetworkScenario, scenarioDescriptions, scenarios, setNetworkScenario, type NetworkScenario } from '../mocks/networkScenario'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resetPendingMatches } from '../data/pendingMatches'

export function NetworkControls() {
  const [scenario, setScenario] = useState(getNetworkScenario)
  const queryClient = useQueryClient()
  const changeScenario = (value: NetworkScenario) => {
    setNetworkScenario(value); setScenario(value)
    // Cancelamento chega ao Axios; caches do cenário anterior não reaparecem.
    void queryClient.resetQueries({ queryKey: ['ranking'] })
    void queryClient.resetQueries({ queryKey: ['match-history'] })
  }
  return <section className="network-controls" aria-label="Network mock controls"><h2>Mock network scenario</h2><label>Scenario<select aria-describedby="network-scenario-status" value={scenario} onChange={(event) => changeScenario(event.target.value as NetworkScenario)}>{scenarios.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><p id="network-scenario-status" className="sr-only" role="status">{scenarioDescriptions[scenario]}</p><button className="button button-text" type="button" onClick={() => { resetPendingMatches(); resetMatches(); setNetworkScenario('normal'); window.location.reload() }}>Reset mock data</button></section>
}
