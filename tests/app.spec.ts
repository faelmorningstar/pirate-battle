import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('persists valid game options', async ({ page }) => {
  await page.getByRole('button', { name: 'Options' }).click()
  const inputs = page.locator('input[type="number"]')
  await inputs.nth(0).fill('120')
  await inputs.nth(1).fill('6')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(inputs.nth(0)).toHaveValue('120')
  await expect(inputs.nth(1)).toHaveValue('6')
})

test('loads the ranking through the mocked API', async ({ page }) => {
  await page.getByRole('tab', { name: 'Ranking' }).click()
  await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible()
  await expect(page.getByText('Captain Ada')).toBeVisible()
})

test('starts a playable session with touch controls', async ({ page }) => {
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await expect(play).toHaveCount(1)
  await expect(play).toBeVisible()
  await play.click()

  await expect(page.getByText(/Hull: 3\/3/)).toBeVisible()

  if (test.info().project.name === 'mobile-chromium') {
    await expect(
      page.getByRole('button', { name: 'Move forward' }),
    ).toBeVisible()
  }
})

test('renders local official assets and preserves pause and exit actions', async ({ page }) => {
  const foreignImages: string[] = []
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.resourceType() === 'image' && new URL(request.url()).hostname !== '127.0.0.1') foreignImages.push(request.url())
  })
  // Bloquear imagens externas garante que os navios são servidos pela própria entrega.
  await page.route('https://**/*', (route) => route.abort())
  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible()
  await expect.poll(() => page.locator('.official-title img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(768)
  await page.locator('.menu-actions').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.game-canvas canvas')).toBeVisible()
  await expect(page.locator('.asset-message')).toHaveCount(0)
  await expect(page.getByText('Hull: 3/3', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const time = await page.locator('.hud-counter').last().textContent()
  await page.waitForTimeout(1100)
  await expect(page.locator('.hud-counter').last()).toHaveText(time!)
  await expect(page.getByRole('status')).toContainText('Paused')
  await page.keyboard.press('p')
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Exit game' }).click()
  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible()
  expect(foreignImages).toEqual([])
  expect(errors).toEqual([])
})

test('keeps official UI readable within narrow and landscape viewports', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible()
    await page.getByRole('button', { name: 'Options', exact: true }).click()
    await expect(page.locator('input[type="number"]').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await expect(page.getByText('Captain Ada')).toBeVisible()
    await page.getByRole('tab', { name: 'Home', exact: true }).click()
    await page.locator('.menu-actions').getByRole('button', { name: 'Play', exact: true }).click()
    const forward = page.getByRole('button', { name: 'Move forward' })
    await expect(forward).toBeVisible()
    const box = (await forward.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    await expect.poll(() => page.locator('.touch-controls img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    await page.getByRole('button', { name: 'Exit game' }).click()
  }
})
