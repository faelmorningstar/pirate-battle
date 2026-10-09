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
  await page
    .locator('.menu-actions')
    .getByRole('button', { name: 'Play', exact: true })
    .click()

  await expect(page.getByText(/Hull: 3\/3/)).toBeVisible()

  if (test.info().project.name === 'mobile-chromium') {
    await expect(
      page.getByRole('button', { name: 'Move forward' }),
    ).toBeVisible()
  }
})