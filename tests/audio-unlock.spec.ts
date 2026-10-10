import { expect, test } from '@playwright/test'

type UnlockCall = { operation: string; event: string; trusted: boolean; inGame: boolean }
type ProbeWindow = Window & { unlockCalls: UnlockCall[]; unlockContext?: AudioContext }

test.beforeEach(async ({ page }) => {
  // Observamos somente a ordem das chamadas; nenhuma saída sonora é medida.
  await page.addInitScript(() => {
    const probe = window as ProbeWindow
    probe.unlockCalls = []
    const record = (operation: string) => {
      const event = window.event
      probe.unlockCalls.push({ operation, event: event?.type ?? '', trusted: event?.isTrusted ?? false, inGame: !!document.querySelector('.game-screen') })
    }
    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) { super(options); probe.unlockContext = this; record('create') }
      resume() { record('resume'); return super.resume() }
      createBufferSource() {
        const source = super.createBufferSource()
        const start = source.start.bind(source)
        source.start = (when?: number, offset?: number, duration?: number) => {
          if (source.buffer?.length === 1) record('prime')
          start(when, offset, duration)
        }
        return source
      }
    }
  })
})

test('unlocks synchronously on Play pointerdown before the session exists', async ({ page, isMobile }) => {
  await page.goto('/')
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeVisible()
  expect(await page.evaluate(() => (window as ProbeWindow).unlockCalls)).toEqual([])
  if (isMobile) await play.tap()
  else await play.click()
  await expect(page.locator('.game-canvas canvas')).toBeVisible()
  const calls = await page.evaluate(() => (window as ProbeWindow).unlockCalls)
  for (const operation of ['create', 'resume', 'prime']) {
    expect(calls.find((call) => call.operation === operation)).toMatchObject({ event: 'pointerdown', trusted: true, inGame: false })
  }
  expect(calls.filter((call) => call.operation === 'create')).toHaveLength(1)
  expect(calls.find((call) => call.operation === 'prime' && call.event === 'click')).toMatchObject({ trusted: true, inGame: false })
  await page.getByRole('button', { name: 'Exit game', exact: true }).click()
})

test('unlocks on click-only Play and retries synchronously from Unmute', async ({ page }) => {
  await page.goto('/')
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await play.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.game-canvas canvas')).toBeVisible()
  let calls = await page.evaluate(() => (window as ProbeWindow).unlockCalls)
  expect(calls.find((call) => call.operation === 'resume')).toMatchObject({ event: 'click', trusted: true, inGame: false })
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click()
  // O Unmute também deve recuperar o mesmo contexto quando o iOS o suspende.
  await page.evaluate(async () => {
    const probe = window as ProbeWindow
    await probe.unlockContext!.suspend()
    probe.unlockCalls = []
  })
  await page.getByRole('button', { name: 'Unmute sound', exact: true }).click()
  calls = await page.evaluate(() => (window as ProbeWindow).unlockCalls)
  expect(calls.some((call) => call.operation === 'create')).toBe(false)
  expect(calls.find((call) => call.operation === 'resume')).toMatchObject({ event: 'click', trusted: true, inGame: true })
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.game-canvas canvas')).toBeVisible()
  // A preferência mute impede até a criação do contexto na nova página.
  expect(await page.evaluate(() => (window as ProbeWindow).unlockCalls)).toEqual([])
  const unmute = page.getByRole('button', { name: 'Unmute sound', exact: true })
  await expect(unmute).toHaveAttribute('aria-pressed', 'true')
  await unmute.click()
  await expect(page.getByRole('button', { name: 'Mute sound', exact: true })).toHaveAttribute('aria-pressed', 'false')
  calls = await page.evaluate(() => (window as ProbeWindow).unlockCalls)
  for (const operation of ['create', 'resume', 'prime']) {
    expect(calls.find((call) => call.operation === operation)).toMatchObject({ event: 'click', trusted: true, inGame: true })
  }
  expect(await page.evaluate(() => localStorage.getItem('pirate-battle:sound-muted'))).toBe('false')
  await page.getByRole('button', { name: 'Exit game', exact: true }).click()
})
