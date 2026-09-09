#!/usr/bin/env node
/** Real browser-engine boot, keyboard motion, touch pause and graphics transitions.
 * Viewport emulation is not a real-phone performance or thermal measurement. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { webkit, firefox, chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html'
const out = process.env.RAFFI_COMPAT_OUT || '/tmp/raffi-compatibility'
const names = (process.env.RAFFI_BROWSERS || 'webkit,firefox').split(',')
const report = { description: 'Normal manual boot, actual keyboard walking, pause/resume and in-menu quality changes. Mobile viewport uses touch pause. No teleport or game state writes. This is compatibility coverage, not phone performance evidence.', runs: [] }
await fs.mkdir(out, { recursive: true })
try {
 for (const name of names) {
  const type = { webkit, firefox, chromium }[name]
  const browser = await type.launch({ headless: true, ...(name === 'chromium' ? { args: ['--use-angle=metal'] } : {}) })
  try {
   for (const mobile of (name === 'webkit' ? [false, true] : [false])) {
    const id = `${name}-${mobile ? 'touch' : 'desktop'}`
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, deviceScaleFactor: 1 })
    const page = await context.newPage(), errors = []
    const run = { id, browser: browser.version(), errors, checks: [] }
    report.runs.push(run)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(base + `?tier=${mobile ? 'low' : 'medium'}&hour=14&seed=FIXED`, { timeout: 120000 })
    await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120000 })
    await page.locator('#boot-start').click()
    await page.waitForFunction(() => document.querySelector('#boot').classList.contains('hidden'))
    await page.evaluate(async () => {
      const { state } = await import('/world/engine/state.js')
      const { gfx, getQuality } = await import('/world/engine/render.js')
      const { cam } = await import('/world/engine/camera.js')
      window.compat = { state, gfx, cam, getQuality }
    })
    for (let i = 0; i < 10 && await page.locator('#subtitle-next').isVisible(); i++) {
      await page.locator('#subtitle-next').click()
      await page.waitForTimeout(100)
    }
    const before = await page.evaluate(() => ({ ...compat.state.player }))
    await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowDown')
    const after = await page.evaluate(() => ({ ...compat.state.player }))
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > .5, `${id}: keyboard movement did not move player`)
    run.checks.push('Manual boot and real walking input')
    await page.locator(mobile ? '#btn-pause' : '#desktop-pause').click()
    await page.waitForFunction(() => compat.state.paused)
    const paused = await page.evaluate(() => ({ time: compat.state.time, x: compat.state.player.x, z: compat.state.player.z }))
    await page.waitForTimeout(250)
    assert.deepEqual(await page.evaluate(() => ({ time: compat.state.time, x: compat.state.player.x, z: compat.state.player.z })), paused)
    await page.locator('[data-pause="quality"]').click()
    await page.locator('[data-pause="resume"]').click()
    await page.waitForFunction(() => !compat.state.paused)
    await page.waitForTimeout(1500)
    run.state = await page.evaluate(() => {
      const { gfx, state, cam, getQuality } = compat
      const gl = gfx.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info')
      return { quality: getQuality(), stats: { ...state.stats }, renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), camera: cam.camera.position.toArray(), debugHidden: document.querySelector('#debug').classList.contains('hidden'), arrivalHidden: document.querySelector('#district-name').hidden, viewport: [innerWidth, innerHeight], internal: [gfx.internal.w, gfx.internal.h], overflow: document.documentElement.scrollWidth > innerWidth, contextLost: gl.isContextLost() }
    })
    assert.ok(run.state.camera.every(Number.isFinite)); assert.equal(run.state.contextLost, false)
    assert.equal(run.state.debugHidden, true); assert.equal(run.state.overflow, false)
    assert.ok(run.state.stats.visibleTriangles > 1000)
    run.checks.push('Pause freezes simulation; graphics menu transition resumes without context/shader errors; normal HUD hides debug')
    if (mobile) {
      for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport)
        await page.waitForTimeout(150)
        const targets = await page.evaluate(() => {
          const nodes = ['btn-pause', 'game-question'].map(id => document.getElementById(id))
          return nodes.map(node => {
            const r = node.getBoundingClientRect()
            return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height, hittable:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) }
          })
        })
        const [pause, question] = targets
        assert.ok(pause.right <= question.x || question.right <= pause.x || pause.bottom <= question.y || question.bottom <= pause.y, 'Pause and question button overlap')
        assert.ok(targets.every(target => target.hittable && target.width >= 44 && target.height >= 44), 'touch action needs an unobstructed 44px target')
        await page.locator('#game-question').tap()
        await page.locator('#cheat-menu').waitFor({ state:'visible' })
        await page.locator('#cheat-close').tap()
        assert.equal(await page.evaluate(() => compat.state.paused), false)
      }
      await page.setViewportSize({ width:390, height:844 })
      await page.waitForFunction(() => Math.abs(compat.cam.persp.aspect - innerWidth / innerHeight) < .001)
      await page.waitForTimeout(250)
      run.checks.push('Portrait/landscape Pause and question controls have separate 44px hit targets; actual taps open and exit cheats')
    }
    await page.screenshot({ path: `${out}/${id}.png` })
    assert.deepEqual(errors, [])
    await context.close()
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
    process.stdout.write(`${id}: passed\n`)
   }
  } finally { await browser.close() }
 }
} catch (error) { report.failure = error.stack; throw error }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) }
