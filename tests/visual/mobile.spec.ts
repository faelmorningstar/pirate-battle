import { expect, test } from '@playwright/test'
import { prepareVisualPage, startStableArena, screenshotOptions } from './helpers'

test.use({ viewport: { width: 393, height: 852 } })

test('stable mobile arena visual baseline and bounded Home attribution', async ({ page }) => {
  await prepareVisualPage(page)
  const logo = page.getByRole('img', { name: 'Official assets by Jungle Gaming' })
  await expect(logo).toBeVisible()
  const size = await logo.boundingBox()
  expect(size!.width).toBeLessThanOrEqual(112)
  expect(size!.height).toBeLessThanOrEqual(56)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  // O crédito fica dentro da moldura, sem criar conteúdo fora do painel mobile.
  const panel = await page.locator('.menu-card').boundingBox()
  expect(size!.y + size!.height).toBeLessThanOrEqual(panel!.y + panel!.height)
  await startStableArena(page)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  await expect(page).toHaveScreenshot('arena.png', screenshotOptions)
})
