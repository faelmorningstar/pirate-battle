import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { installProfileObserver } from './profile-observer.mjs'
import { renderProfileReport } from './profile-report.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null
const port = Number(process.env.PROFILE_PORT ?? 4188)
const origin = `http://127.0.0.1:${port}`
const viewport = { width: 1024, height: 1024 }
const options = { sessionDurationSeconds: 180, enemySpawnIntervalSeconds: 4 }
const keys = new Set()
let browser, server

function build() {
  // Executamos exatamente as duas etapas de npm run build, sem shell intermediário.
  execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-b'], { cwd: root, stdio: 'inherit' })
  execFileSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'inherit' })
}

async function startServer() {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let output = ''
  server.stdout.on('data', (chunk) => { output += chunk })
  server.stderr.on('data', (chunk) => { output += chunk })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Preview failed: ${output}`)
    try { if ((await fetch(origin)).ok) return } catch { /* Aguardamos o servidor local. */ }
    await sleep(100)
  }
  throw new Error(`Preview did not start: ${output}`)
}

async function setKeys(page, wanted) {
  for (const key of keys) if (!wanted.includes(key)) { await page.keyboard.up(key); keys.delete(key) }
  for (const key of wanted) if (!keys.has(key)) { await page.keyboard.down(key); keys.add(key) }
}

async function start(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.game-canvas canvas')).toBeVisible()
  await expect(page.locator('.asset-message')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__PIRATE_PROFILE__.last?.player))).toBe(true)
}

async function steer(page) {
  const scene = await page.evaluate(() => globalThis.__PIRATE_PROFILE__.last)
  if (!scene?.player) return false
  const { player, width, height } = scene
  // O piloto navega até a costa sul e usa a ilha real como proteção; não muda entidades.
  const center = { x: width * 0.52, y: height * 0.45 }
  const target = { x: center.x, y: center.y + 116 }
  if (Math.hypot(target.x - player.x, target.y - player.y) < 9) {
    await setKeys(page, ['Space', 'q', 'e'])
    return true
  }
  const desired = Math.atan2(target.x - player.x, -(target.y - player.y))
  const error = Math.atan2(Math.sin(desired - player.rotation), Math.cos(desired - player.rotation))
  const wanted = ['Space', 'q', 'e']
  if (Math.abs(error) < 0.5) wanted.push('w')
  await setKeys(page, wanted)
  if (Math.abs(error) > 0.04) {
    const turn = error > 0 ? 'd' : 'a'
    await page.keyboard.down(turn)
    await sleep(Math.min(100, Math.abs(error) / 2.8 * 1000))
    await page.keyboard.up(turn)
  }
  return true
}

async function memory(cdp, page, collect = false) {
  if (collect) await cdp.send('HeapProfiler.collectGarbage')
  const heap = await cdp.send('Runtime.getHeapUsage')
  const dom = await cdp.send('Memory.getDOMCounters')
  const state = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll('.game-canvas canvas').length,
    liveApplication: Boolean(globalThis.__PIRATE_PROFILE__.app),
    created: globalThis.__PIRATE_PROFILE__.applicationsCreated,
    destroyed: globalThis.__PIRATE_PROFILE__.applicationsDestroyed,
  }))
  return { collectedGarbage: collect, ...heap, ...dom, ...state }
}

async function main() {
  build()
  await startServer()
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(installProfileObserver)
  await page.goto(origin)
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByLabel('Game session time', { exact: false }).fill('180')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const cdp = await context.newCDPSession(page)
  await cdp.send('HeapProfiler.enable')
  const browserCdp = await browser.newBrowserCDPSession()
  let systemInfo
  try { systemInfo = await browserCdp.send('SystemInfo.getInfo') } catch (error) { systemInfo = { error: error.message } }
  const initial = await memory(cdp, page, true)
  const cycles = []
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    const before = await memory(cdp, page, true)
    await start(page)
    const started = performance.now()
    while (performance.now() - started < 5000) { await steer(page); await sleep(200) }
    const playedWallMs = performance.now() - started
    await setKeys(page, [])
    const playing = await memory(cdp, page)
    await page.getByRole('button', { name: 'Exit game' }).click()
    await expect(page.locator('.game-canvas canvas')).toHaveCount(0)
    await sleep(1000)
    const afterUncollected = await memory(cdp, page)
    const after = await memory(cdp, page, true)
    cycles.push({ cycle, playedWallMs, before, playing, afterUncollected, after, retainedDeltaBytes: after.usedSize - before.usedSize })
    console.log(`Memory cycle ${cycle}/5: ${after.usedSize} bytes after GC, ${after.canvasCount} canvases.`)
  }
  await start(page)
  const canvasSize = await page.evaluate(() => ({ width: globalThis.__PIRATE_PROFILE__.last.width, height: globalThis.__PIRATE_PROFILE__.last.height }))
  await page.evaluate(() => {
    const state = globalThis.__PIRATE_PROFILE__
    state.frames = []; state.samples = []; state.observerCostsMs = []
    state.startedAt = performance.now(); state.lastSample = -Infinity; state.recording = true
  })
  const wallStart = performance.now()
  let lastProgress = 0
  while (performance.now() - wallStart < 210000) {
    if (!(await steer(page))) break
    const elapsed = performance.now() - wallStart
    if (elapsed - lastProgress >= 30000) {
      console.log(`Real session: ${(elapsed / 1000).toFixed(0)} seconds; ${await page.locator('.official-hud').textContent()}`)
      lastProgress = elapsed
    }
    await sleep(200)
  }
  await setKeys(page, [])
  const wallElapsedMs = performance.now() - wallStart
  const resultVisible = await page.getByRole('heading', { name: 'Session complete' }).isVisible()
  const final = await page.evaluate(() => {
    const state = globalThis.__PIRATE_PROFILE__
    state.recording = false
    state.endedAt ??= performance.now()
    return {
      startedAt: state.startedAt, endedAt: state.endedAt, frameTimestampsMs: state.frames,
      entitySamples: state.samples, entityMaxima: state.max, observerCostsMs: state.observerCostsMs,
      renderer: state.renderer, pixiVersion: state.pixiVersion,
      result: JSON.parse(localStorage.getItem('pirate-battle:last-result') ?? 'null'),
      options: JSON.parse(localStorage.getItem('pirate-battle:config') ?? 'null'),
      developmentProbePresent: Boolean(globalThis.__PIRATE_BATTLE_TEST__),
      visibility: document.visibilityState,
    }
  })
  const timestamps = final.frameTimestampsMs
  const intervals = timestamps.slice(1).map((time, index) => time - timestamps[index])
  const fps = intervals.length * 1000 / (timestamps.at(-1) - timestamps[0])
  const complete = resultVisible && final.result?.reason === 'time' && final.result.durationSeconds === 180 && wallElapsedMs >= 179000
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  let priorIncompleteAttempts = []
  try {
    const previous = JSON.parse(await readFile(path.join(root, 'performance/profile-results.json'), 'utf8'))
    priorIncompleteAttempts = previous.complete ? (previous.priorIncompleteAttempts ?? []) : [previous]
  } catch { /* A primeira execução não tem arquivo anterior. */ }
  const report = {
    schemaVersion: 1, measuredAt: new Date().toISOString(), complete,
    methodology: { build: 'tsc -b && vite build; vite preview --strictPort', clock: 'real wall clock; no Playwright clock, pause, time advance or gameplay overrides', fps: 'screen-stage Pixi postrender intervals, performance.now(); interval count / first-to-last elapsed time', entities: 'every-render live stage sprites classified by official texture URLs; maxima exclude player, scenery and health bars', memory: 'page V8 heap via CDP; before/after forced GC, playing/uncollected also recorded', pilot: '200 ms keyboard feedback; W/A/D to south island shore, then hold Space/Q/E; real collision protection, no overrides', cyclePlaySeconds: 5 },
    environment: {
      node: process.version, os: { platform: os.platform(), release: os.release(), version: os.version(), arch: os.arch() },
      hardware: { cpus: os.cpus().map(({ model, speed }) => ({ model, speedMHz: speed })), logicalCpuCount: os.cpus().length, totalMemoryBytes: os.totalmem(), windowsCim: 'Detailed CIM queries denied by environment; Node/CDP data used instead.' },
      chromium: browser.version(), headless: true, viewport, deviceScaleFactor: 1, systemInfo,
      buildIndexSha256: createHash('sha256').update(await readFile(path.join(root, 'dist/index.html'))).digest('hex'),
      dependencyRanges: packageJson.dependencies,
    },
    configuration: options,
    session: { ...final, canvasSize, wallElapsedMs, frameIntervalsMs: intervals, metrics: { averageFps: fps, p95FrameIntervalMs: percentile(intervals, 0.95), maximumFrameIntervalMs: Math.max(...intervals), frames: timestamps.length, observerP95Ms: percentile(final.observerCostsMs, 0.95) } },
    memory: { initial, cycles, final: await memory(cdp, page, true) }, pageErrors: errors, priorIncompleteAttempts,
    limitations: ['Headless Chromium render submissions do not prove display presentation or physical-device FPS.', 'V8 heap excludes GPU allocations, browser total RSS and worker isolates.', 'Forced GC and external observation influence measurements; no GC forced during the timed session.', 'One run is insufficient to prove absence of memory leaks or hardware-wide 60 FPS.'],
  }
  await mkdir(path.join(root, 'performance'), { recursive: true })
  await writeFile(path.join(root, 'performance/profile-results.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(path.join(root, 'PERFORMANCE_REPORT.md'), renderProfileReport(report))
  console.log(JSON.stringify({ complete, metrics: report.session.metrics, entityMaxima: final.entityMaxima, result: final.result, wallElapsedMs }, null, 2))
  if (!complete || errors.length) process.exitCode = 1
}

try { await main() }
catch (error) { console.error(error); process.exitCode = 1 }
finally {
  await browser?.close()
  if (server && server.exitCode === null) {
    server.kill()
    await Promise.race([once(server, 'exit'), sleep(3000)])
  }
}
