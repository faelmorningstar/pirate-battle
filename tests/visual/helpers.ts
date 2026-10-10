import { expect, type Page } from '@playwright/test'

export async function prepareVisualPage(page: Page) {
  // Fixamos datas e preferências; a rede usa os fixtures locais reais do MSW.
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00Z'))
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('pirate-battle:network-scenario', 'normal')
    window.__PIRATE_BATTLE_TEST__ = { manual: true }
  })
  await page.goto('/')
  await settleVisualPage(page)
}

export async function settleVisualPage(page: Page) {
  // Também aguardamos texturas e fundos CSS locais, não só imagens HTML.
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(Array.from(document.images, (image) => image.decode()))
  })
  // Retiramos foco e hover antes da foto sem alterar o estado do gameplay.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(0, 0)
}

export async function startStableArena(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__PIRATE_BATTLE_TEST__?.game?.snapshot().active)).toBe(true)
  await settleVisualPage(page)
  // O relógio existente avança a simulação real; não criamos entidades de teste.
  await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.advance(5.02))
  await expect(page.locator('.asset-message')).toHaveCount(0)
  expect(await page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.game!.snapshot().enemies.map((enemy) => enemy.type))).toEqual(['chaser', 'shooter'])
  await expect(page.getByRole('img', { name: 'Official assets by Jungle Gaming' })).toHaveCount(0)
}

export const screenshotOptions = { animations: 'disabled', caret: 'hide', scale: 'css' } as const
