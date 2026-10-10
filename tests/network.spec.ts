import { expect, test, type Page } from '@playwright/test'
import type { MatchRecord } from '../src/data/contracts'
import type { NetworkScenario } from '../src/mocks/networkScenario'

const pending = (page: Page): Promise<MatchRecord[]> => page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:pending-matches') ?? '[]'))
const records = (page: Page): Promise<MatchRecord[]> => page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:matches') ?? '[]'))
const notice = (page: Page) => page.getByRole('region', { name: 'Pending match registration' })
const errors = new WeakMap<Page, string[]>()

async function openNetworkTools(page: Page) {
  await page.getByRole('tab', { name: 'Home', exact: true }).click()
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByText('Network testing tools', { exact: true }).click()
}

async function scenario(page: Page, value: NetworkScenario) {
  await openNetworkTools(page)
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(value)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
}

async function finish(page: Page) {
  const play = page.getByRole('button', { name: /^(Play|Play Again)$/ })
  await play.click()
  await expect.poll(() => page.evaluate(() => window.__PIRATE_BATTLE_TEST__?.game?.snapshot().active)).toBe(true)
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.frame(90))
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible()
}

async function quietlyRecover(page: Page) {
  // Mudamos a preferência real sem evento para exercitar a ação explícita de retry.
  await page.evaluate(() => localStorage.setItem('pirate-battle:network-scenario', 'normal'))
}

test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (error) => errors.get(page)!.push(error.message))
  // Contextos isolados do Playwright: não apagamos dados no refresh do mesmo teste.
  await page.addInitScript(() => { window.__PIRATE_BATTLE_TEST__ = { manual: true } })
  await page.goto('/')
})
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]) })

test('Home hides network tools and Options exposes a collapsed accessible testing section', async ({ page }) => {
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reset mock data' })).toHaveCount(0)
  await expect(page.getByText('Network testing tools', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  const details = page.locator('details.network-tools')
  const summary = details.locator('summary')
  await expect(details).not.toHaveAttribute('open', '')
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toBeHidden()
  await summary.focus()
  await page.keyboard.press('Space')
  await expect(details).toHaveAttribute('open', '')
  await expect(summary).toBeFocused()
  expect(await summary.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid')
  await expect(details).toContainText('Simulate ranking and match history network conditions.')
  const select = page.getByRole('combobox', { name: 'Scenario', exact: true })
  await expect(select).toHaveValue('normal')
  await select.selectOption('http-503')
  await expect(select).toHaveValue('http-503')
  await expect(details.getByRole('status')).not.toBeEmpty()
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(select).toHaveCount(0)
  await openNetworkTools(page)
  await expect(select).toHaveValue('http-503')
})

test('normal registration refreshes both previously cached lists', async ({ page }) => {
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
  await expect(page.getByText('Captain Ada')).toBeVisible()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByText('Your completed battles will appear here.')).toBeVisible()
  await scenario(page, 'normal')
  await finish(page)
  await expect(page.getByRole('status')).toHaveText('Match record saved.')
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
  await expect(page.getByText('Captain Rafael', { exact: false })).toBeVisible()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.locator('.data-panel li')).toHaveCount(1)
  expect(await pending(page)).toEqual([])
  expect((await records(page)).filter((item) => item.playerId === 'captain-rafael')).toHaveLength(1)
})

test('both lists paginate forwards and backwards with correct boundaries', async ({ page }) => {
  await scenario(page, 'paginated')
  await page.reload()
  await openNetworkTools(page)
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveValue('paginated')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  for (const tab of ['Ranking', 'Match History']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await expect(page.getByText('Page 1 of 3')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await expect(page.locator('.data-panel li')).toHaveCount(5)
    const first = await page.locator('.data-panel li').allTextContents()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Page 2 of 3')).toBeVisible()
    expect(await page.locator('.data-panel li').allTextContents()).not.toEqual(first)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Page 3 of 3')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
    await expect(page.locator('.data-panel li')).toHaveCount(tab === 'Ranking' ? 5 : 2)
    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByText('Page 2 of 3')).toBeVisible()
    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByText('Page 1 of 3')).toBeVisible()
    expect(await page.locator('.data-panel li').allTextContents()).toEqual(first)
  }
})

test('empty lists expose accessible empty states', async ({ page }) => {
  await scenario(page, 'empty')
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('No completed battles yet.')
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('status')).toHaveText('Your completed battles will appear here.')
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0)
})

for (const latency of ['slow', 'variable-latency'] as const) {
  test(`${latency} shows loading and has a repeatable latency schedule`, async ({ page }) => {
    await scenario(page, latency)
    await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Loading ranking…')
    await expect(page.getByText('Captain Ada')).toBeVisible()
    await page.getByRole('tab', { name: 'Match History' }).click()
    await expect(page.getByRole('status')).toHaveText('Loading match history…')
    await expect(page.getByText('Your completed battles will appear here.')).toBeVisible()
    const durations = await page.evaluate(async (value) => {
      const path = '/src/mocks/networkScenario.ts'
      const { setNetworkScenario } = await import(path)
      const apiPath = '/src/data/api.ts'
      const { getRanking } = await import(apiPath)
      setNetworkScenario(value)
      const times: number[] = []
      for (let index = 0; index < 3; index += 1) {
        const start = performance.now(); await getRanking(); times.push(performance.now() - start)
      }
      return times
    }, latency)
    const minimum = latency === 'slow' ? [850, 850, 850] : [1150, 100, 650]
    durations.forEach((duration, index) => expect(duration).toBeGreaterThanOrEqual(minimum[index]))
    if (latency === 'variable-latency') expect(durations[0]).toBeGreaterThan(durations[1])
  })
}

for (const failure of ['timeout', 'connection-error', 'http-400', 'http-503', 'ranking-error', 'history-error'] as const) {
  test(`${failure} is isolated as specified and manual retry recovers`, async ({ page }) => {
    test.setTimeout(45000)
    await scenario(page, failure)
    for (const tab of ['Ranking', 'Match History']) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      const isolatedHealthy = (failure === 'ranking-error' && tab === 'Match History') || (failure === 'history-error' && tab === 'Ranking')
      if (isolatedHealthy) {
        await expect(page.getByText(tab === 'Ranking' ? 'Captain Ada' : 'Your completed battles will appear here.')).toBeVisible()
      } else {
        await expect(page.getByRole('alert')).toHaveText(tab === 'Ranking' ? 'Could not load ranking.' : 'Could not load match history.', { timeout: 15000 })
        await quietlyRecover(page)
        await page.getByRole('button', { name: 'Try again', exact: true }).click()
        await expect(page.getByText(tab === 'Ranking' ? 'Captain Ada' : 'Your completed battles will appear here.')).toBeVisible()
        // Restauramos a falha entre abas sem criar outro mock ou recarregar a aplicação.
        await scenario(page, failure)
      }
    }
  })
}

for (const endpoint of ['ranking', 'history'] as const) {
  test(`out-of-order ${endpoint} responses arrive late without replacing fresh UI`, async ({ page }) => {
    await scenario(page, 'out-of-order')
    const tab = endpoint === 'ranking' ? 'Ranking' : 'Match History'
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Loading')
    // A primeira consulta é cancelada ao sair da aba; o mock ainda guarda sua foto antiga.
    await page.getByRole('tab', { name: 'Home', exact: true }).click()
    await finish(page)
    await expect(page.getByRole('status')).toHaveText('Match record saved.')
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await page.getByRole('tab', { name: tab, exact: true }).click()
    const fresh = page.locator('.data-panel')
    await expect(fresh).toBeVisible()
    await expect(fresh).toContainText(endpoint === 'ranking' ? 'Captain Rafael' : '0 points')
    const content = await fresh.textContent()
    // Esperamos além do atraso antigo, não avançamos o relógio do combate.
    await page.waitForTimeout(1400)
    await expect(fresh).toHaveText(content!)
    // Duas chamadas Axios reais comprovam também a inversão de chegada no MSW.
    const order = await page.evaluate(async (target) => {
      const scenarioPath = '/src/mocks/networkScenario.ts'
      const { setNetworkScenario } = await import(scenarioPath)
      const apiPath = '/src/data/api.ts'
      const { getRanking, getMatchHistory } = await import(apiPath)
      setNetworkScenario('out-of-order')
      const read = () => target === 'ranking' ? getRanking() : getMatchHistory('captain-rafael')
      const arrival: number[] = []
      await Promise.all([read().then(() => arrival.push(1)), read().then(() => arrival.push(2))])
      return arrival
    }, endpoint)
    expect(order).toEqual([2, 1])
  })
}

test('timeout after save survives refresh and confirms the same record once', async ({ page }) => {
  await scenario(page, 'post-timeout')
  await finish(page)
  await expect(notice(page)).toContainText('Saving pending')
  const [record] = await pending(page)
  await expect(notice(page)).toContainText('pending. You can start', { timeout: 7000 })
  expect((await records(page)).filter((item) => item.id === record.id)).toHaveLength(1)
  await page.reload()
  expect((await pending(page))[0].id).toBe(record.id)
  await expect(notice(page)).toBeVisible()
  await scenario(page, 'normal')
  await expect(notice(page)).toHaveCount(0)
  expect(await pending(page)).toEqual([])
  expect((await records(page)).filter((item) => item.id === record.id)).toHaveLength(1)
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
  await expect(page.getByText('Captain Rafael', { exact: false })).toBeVisible()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.locator('.data-panel li')).toHaveCount(1)
})

test('refresh during an in-flight write and repeated retry clicks never duplicate', async ({ page }) => {
  await scenario(page, 'post-timeout')
  await finish(page)
  const [record] = await pending(page)
  await expect.poll(async () => (await records(page)).some((item) => item.id === record.id)).toBe(true)
  await page.reload()
  await quietlyRecover(page)
  let posts = 0
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/matches')) posts += 1 })
  await page.getByRole('button', { name: 'Retry pending matches' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click() })
  await expect(notice(page)).toHaveCount(0)
  expect(posts).toBe(1)
  expect((await records(page)).filter((item) => item.id === record.id)).toHaveLength(1)
})

test('unavailable completion persists multiple sessions and online recovery confirms each once', async ({ page }) => {
  await scenario(page, 'post-unavailable')
  await finish(page)
  await expect(notice(page)).toContainText('1 match record(s) pending')
  await finish(page)
  await expect(notice(page)).toContainText('2 match record(s) pending')
  const ids = (await pending(page)).map((record) => record.id)
  expect(new Set(ids).size).toBe(2)
  expect((await records(page)).filter((item) => ids.includes(item.id))).toHaveLength(0)
  await page.reload()
  await expect(notice(page)).toContainText('2 match record(s) pending')
  await quietlyRecover(page)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(notice(page)).toHaveCount(0)
  const saved = (await records(page)).filter((item) => ids.includes(item.id))
  expect(saved).toHaveLength(2)
  expect(new Set(saved.map((item) => item.id)).size).toBe(2)
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.locator('.data-panel li')).toHaveCount(2)
})

test('reset restores normal fixtures, pending queue and latency sequence without changing options', async ({ page }) => {
  await scenario(page, 'post-unavailable')
  await finish(page)
  await expect(notice(page)).toContainText('pending')
  await page.getByRole('button', { name: 'Main Menu' }).click()
  const options = await page.evaluate(() => localStorage.getItem('pirate-battle:config'))
  await openNetworkTools(page)
  await page.getByRole('button', { name: 'Reset mock data' }).click()
  await expect(page.getByRole('button', { name: 'Options', exact: true })).toBeVisible()
  await openNetworkTools(page)
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveValue('normal')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(notice(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('pirate-battle:config'))).toBe(options)
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
  await expect(page.locator('.data-panel li')).toHaveCount(3)
  await expect(page.getByText('Captain Ada')).toBeVisible()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByText('Your completed battles will appear here.')).toBeVisible()
})

test('read retries are bounded and HTTP 4xx is not retried automatically', async ({ page }) => {
  for (const failure of ['http-400', 'http-503', 'connection-error'] as const) {
    await scenario(page, failure)
    let attempts = 0
    const countResponse = (response: import('@playwright/test').Response) => {
      if (new URL(response.url()).pathname === '/api/ranking') attempts += 1
    }
    const countFailure = (request: import('@playwright/test').Request) => {
      // Strict Mode pode cancelar uma montagem inicial; isso não é um retry de erro.
      if (new URL(request.url()).pathname === '/api/ranking' && request.failure()?.errorText !== 'net::ERR_ABORTED') attempts += 1
    }
    page.on('response', countResponse)
    page.on('requestfailed', countFailure)
    await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Could not load ranking.')
    expect(attempts).toBe(failure === 'http-400' ? 1 : 2)
    page.off('response', countResponse)
    page.off('requestfailed', countFailure)
  }
})

test('recovery during an in-flight timeout is not lost or duplicated', async ({ page }) => {
  await scenario(page, 'post-timeout')
  await finish(page)
  const [record] = await pending(page)
  await expect.poll(async () => (await records(page)).some((item) => item.id === record.id)).toBe(true)
  await quietlyRecover(page)
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online')) })
  await expect(notice(page)).toHaveCount(0, { timeout: 7000 })
  expect((await records(page)).filter((item) => item.id === record.id)).toHaveLength(1)
})
