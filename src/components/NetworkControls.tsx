import { resetMatches } from '../mocks/store'
import { getNetworkScenario, scenarios, setNetworkScenario, type NetworkScenario } from '../mocks/networkScenario'

export function NetworkControls() {
  const scenario = getNetworkScenario()
  const changeScenario = (value: NetworkScenario) => { setNetworkScenario(value); window.location.reload() }
  return <section className="network-controls" aria-label="Network mock controls"><h2>Mock network scenario</h2><label>Scenario<select value={scenario} onChange={(event) => changeScenario(event.target.value as NetworkScenario)}>{scenarios.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><button className="button button-text" type="button" onClick={() => { resetMatches(); window.location.reload() }}>Reset mock data</button></section>
}
