// Esta função só é injetada pelo Playwright; não é importada pelo aplicativo.
export function installProfileObserver() {
  const state = {
    app: null, pixiVersion: null, applicationsCreated: 0, applicationsDestroyed: 0,
    recording: false, startedAt: null, endedAt: null, frames: [], samples: [],
    max: { enemies: 0, projectiles: 0, effects: 0, combined: 0 }, last: null,
    observerCostsMs: [], lastSample: -Infinity, renderer: null,
  }
  const texturePath = (sprite) => {
    const source = sprite?.texture?.source
    return source?.resource?.src ?? source?.label ?? ''
  }
  const countScene = (app) => {
    const counts = { enemies: 0, projectiles: 0, effects: 0, combined: 0 }
    let player = null
    for (const child of app.stage.children) {
      if (child.destroyed) continue
      const path = texturePath(child)
      if (path.includes('cannon_ball.png')) counts.projectiles += 1
      else if (path.includes('explosion_1.png')) counts.effects += 1
      else if (child.children?.length) {
        const ship = texturePath(child.children[0])
        if (ship.includes('ship_5.png') || ship.includes('ship_20.png')) counts.enemies += 1
        else if (ship.includes('ship_12.png')) player = { x: child.x, y: child.y, rotation: child.rotation }
      }
    }
    counts.combined = counts.enemies + counts.projectiles + counts.effects
    return { counts, player, width: app.screen.width, height: app.screen.height }
  }
  globalThis.__PIRATE_PROFILE__ = state
  globalThis.__PIXI_APP_INIT__ = (app, version) => {
    state.app = app
    state.pixiVersion = version
    state.applicationsCreated += 1
    const gl = app.renderer.gl
    const extension = gl?.getExtension('WEBGL_debug_renderer_info')
    state.renderer = {
      type: app.renderer.type, resolution: app.renderer.resolution,
      gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
    }
    const observer = { postrender(options) {
      if (options.container !== app.stage || !app.renderer.renderingToScreen) return
      const start = performance.now()
      // Só observamos cenas ativas; o renderer pode iniciar antes de carregar as imagens.
      if (!app.stage?.children) return
      const scene = countScene(app)
      state.last = scene
      if (!state.recording || !scene.player) return
      state.frames.push(start)
      for (const key of Object.keys(state.max)) state.max[key] = Math.max(state.max[key], scene.counts[key])
      if (start - state.lastSample >= 1000) {
        const hud = document.querySelector('.official-hud')?.textContent ?? ''
        state.samples.push({ elapsedMs: start - state.startedAt, ...scene.counts, hud })
        state.lastSample = start
      }
      state.observerCostsMs.push(performance.now() - start)
    } }
    app.renderer.runners.postrender.add(observer)
    app.stage.once('destroyed', () => {
      // Não retemos aplicações destruídas, nem seus sprites, na medição de memória.
      if (state.app === app) { state.app = null; state.last = null }
      state.applicationsDestroyed += 1
      if (state.recording) { state.recording = false; state.endedAt = performance.now() }
    })
  }
}
