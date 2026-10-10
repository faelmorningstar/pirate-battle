import { expect, test } from '@playwright/test'

test('reuses the local arena across resize, pause and repeated sessions', async ({ page }) => {
  const errors: string[] = []
  const assets = new Set<string>()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (response.ok() && /pirate-battle\/(tiles|ship_parts|effects)\//.test(path)) assets.add(path)
  })
  await page.goto('/')
  // As saídas rápidas também exercitam o retorno de um carregamento após desmontagem.
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Exit game' }).click()
  for (let session = 0; session < 2; session += 1) {
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.locator('.game-canvas canvas')).toHaveCount(1)
    await expect.poll(() => assets.size).toBe(8)
    await expect(page.locator('.asset-message')).toHaveCount(0)
    await page.keyboard.press('q')
    await page.keyboard.press('e')
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page.setViewportSize({ width: 700 + session * 50, height: 600 })
    await expect(page.locator('.game-canvas canvas')).toBeVisible()
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await page.getByRole('button', { name: 'Exit game' }).click()
    await expect(page.locator('canvas')).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('keeps the arena playable when all phase 2 images fail', async ({ page }) => {
  const errors: string[] = []
  const failedAssets = new Set<string>()
  page.on('pageerror', (error) => errors.push(error.message))
  // Abortamos só as novas imagens; interface e navios continuam disponíveis.
  await page.context().route(/\/assets\/pirate-battle\/(tiles|ship_parts|effects)\//, (route) => {
    failedAssets.add(new URL(route.request().url()).pathname)
    return route.abort()
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  // O service worker dos dados não deve contornar a falha de imagens simulada.
  const network = await page.context().newCDPSession(page)
  await network.send('Network.setBypassServiceWorker', { bypass: true })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => failedAssets.size).toBe(8)
  await expect(page.locator('.game-canvas canvas')).toBeVisible()
  // O carregamento tem prazo de 2,5 s; depois dele o desenho antigo precisa operar.
  await page.waitForTimeout(3000)
  await expect(page.getByText('Hull: 3/3', { exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Paused')
  await page.getByRole('button', { name: 'Exit game' }).click()
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(errors).toEqual([])
})
