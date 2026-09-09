#!/usr/bin/env node
/** Foreground activity-renderer timing; one disclosed park-entry fixture, real Watch buttons. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import { chromium } from 'playwright'

const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-sports-performance'
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3091/world/index.html')
for (const [key, value] of Object.entries({ debug: '1', seed: 'FIXED', tier: 'medium', hour: '14' })) url.searchParams.set(key, value)
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--use-angle=metal'] })
const report = { device: { cpu: os.cpus()[0].model, ramBytes: os.totalmem(), browser: browser.version() }, viewport: { width: 1440, height: 900 }, method: 'Foreground requestAnimationFrame intervals, not GPU timestamps. Warm-up excluded. One park-entry position fixture; real E and Watch buttons. Activity simulation runs normally with no timer/score writes. Watching measures the separate sports renderer, not player skill or mobile performance.', runs: [], errors: [] }
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)]
try {
  const page = await browser.newPage({ viewport: report.viewport })
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(url.href)
  await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120000 })
  await page.locator('#boot-start').click()
  await page.evaluate(() => { RAFFI_WORLD.dismissDialogue(); RAFFI_WORLD.teleport(-310, -406) })
  await page.waitForTimeout(300)
  await page.keyboard.press('e')
  await page.locator('#park-sports').waitFor({ state: 'visible' })
  for (const sport of ['Tennis', 'Soccer', 'Boxing']) {
    await page.locator('#sports-intent').fill(sport)
    await page.locator('.sports-form button').click()
    await page.getByRole('button', { name: 'Watch first', exact: true }).click()
    await page.waitForFunction(() => { const game = RAFFI_WORLD.sportsSnapshot().game; return (game?.time ?? game?.clock ?? 0) > 2 }, null, { timeout: 120000 })
    await page.bringToFront()
    const before = await page.evaluate(() => RAFFI_WORLD.sportsSnapshot())
    const samples = await page.evaluate(() => new Promise(resolve => {
      const samples = [], start = performance.now(); let previous = start
      function frame(now) {
        samples.push({ ms: now - previous, visible: document.visibilityState === 'visible', focused: document.hasFocus() }); previous = now
        if (now - start >= 20000) resolve(samples); else requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    }))
    const after = await page.evaluate(() => RAFFI_WORLD.sportsSnapshot())
    const renderer = await page.locator('#sports-view').evaluate(canvas => {
      const gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info')
      return { name: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), width: canvas.width, height: canvas.height }
    })
    assert.match(renderer.name, /Apple.*Metal|Metal.*Apple/i)
    const elapsed = (after.game.time ?? after.game.clock) - (before.game.time ?? before.game.clock)
    assert.ok(elapsed > 15, 'Activity simulation did not advance throughout measurement')
    assert.ok(samples.every(sample => sample.visible && sample.focused), 'Foreground profile lost visibility/focus')
    const times = samples.slice(1).map(sample => sample.ms)
    report.runs.push({ sport, renderer, graphics: after.graphics, gameSeconds: elapsed, frames: times.length, medianMs: quantile(times, .5), p95Ms: quantile(times, .95), p99Ms: quantile(times, .99), framesOver50ms: times.filter(ms => ms > 50).length, foregroundFraction: 1, samples })
    await page.screenshot({ path: `${out}/${sport.toLowerCase()}.png` })
    process.stdout.write(`${sport}: ${report.runs.at(-1).medianMs.toFixed(1)} ms median\n`)
    await page.getByRole('button', { name: 'Choose another game', exact: true }).click()
  }
  await page.keyboard.press('Escape')
  assert.equal(await page.evaluate(() => RAFFI_WORLD.sportsSnapshot().open), false)
  assert.deepEqual(report.errors, [])
} catch (error) { report.failure = error.stack; process.exitCode = 1 }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close() }
