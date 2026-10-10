import { expect, test } from '@playwright/test'

test('keeps desktop HUD in flow and floats a compact touch HUD over the arena', async ({ page, isMobile }) => {
  // A medição do HUD não depende do combate: congelamos só o relógio, sem enfraquecer as verificações.
  await page.addInitScript(() => { window.__PIRATE_BATTLE_TEST__ = { manual: true } })
  await page.goto('/')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.game-canvas canvas')).toBeVisible()

  if (!isMobile) {
    const header = await page.locator('.game-header').boundingBox()
    const arena = await page.locator('.game-canvas').boundingBox()
    expect(arena!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
    await expect(page.locator('.game-action-label').first()).toHaveCSS('position', 'static')
    return
  }

  // Retrato estreito e paisagem precisam liberar a arena sem perder os controles.
  for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    const arena = await page.locator('.game-canvas').boundingBox()
    const screen = await page.locator('.game-screen').boundingBox()
    expect(arena!.y).toBe(screen!.y)
    const stats = await page.locator('.official-hud > span').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { top: rect.top, right: rect.right }
    }))
    expect(new Set(stats.map((stat) => stat.top)).size).toBe(1)
    expect(Math.max(...stats.map((stat) => stat.right))).toBeLessThanOrEqual(viewport.width)
    const header = await page.locator('.game-header').boundingBox()
    expect(header!.height).toBeLessThanOrEqual(90)
    await expect(page.locator('.game-header')).toHaveCSS('pointer-events', 'none')
    for (const name of ['Pause', 'Exit game']) {
      const button = page.getByRole('button', { name, exact: true })
      await expect(button).toHaveCount(1)
      const rect = await button.boundingBox()
      expect(rect!.width).toBeGreaterThanOrEqual(44)
      expect(rect!.height).toBeGreaterThanOrEqual(44)
      await expect(button).toHaveCSS('pointer-events', 'auto')
      await expect(button.locator('img')).toHaveCSS('pointer-events', 'none')
    }
    await expect(page.getByRole('button', { name: 'Move forward' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  // Esconder a legenda visual não pode remover o foco nem o nome acessível.
  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  await page.keyboard.press('Tab')
  await pause.focus()
  await expect(pause).toHaveCSS('outline-style', 'solid')
  await pause.click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
})
