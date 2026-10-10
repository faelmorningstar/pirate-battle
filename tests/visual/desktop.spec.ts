import { expect, test } from '@playwright/test'
import { prepareVisualPage, settleVisualPage, startStableArena, screenshotOptions } from './helpers'

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeEach(async ({ page }) => { await prepareVisualPage(page) })

test('Home desktop visual baseline and official attribution', async ({ page }) => {
  const logo = page.getByRole('img', { name: 'Official assets by Jungle Gaming' })
  await expect(logo).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCount(1)
  await expect(page).toHaveScreenshot('home.png', { ...screenshotOptions, fullPage: true })
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click()
  await expect(logo).toHaveCount(0)
  await page.getByRole('tab', { name: 'Home', exact: true }).click()
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await expect(logo).toHaveCount(0)
})

test('stable desktop arena visual baseline', async ({ page }) => {
  await startStableArena(page)
  await expect(page).toHaveScreenshot('arena.png', screenshotOptions)
})

test('completed session visual baseline', async ({ page }) => {
  await startStableArena(page)
  // Encerramos pelo timer real, evitando combate e dados de resultado inventados.
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.frame(90))
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Match record saved.')
  await settleVisualPage(page)
  await expect(page).toHaveScreenshot('result.png', screenshotOptions)
})
