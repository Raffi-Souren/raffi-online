#!/usr/bin/env node
/** Real pause slider, storage reload, walking inputs and measured audio output. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html')
url.searchParams.set('tier', 'low'); url.searchParams.set('debug', '1'); url.searchParams.set('seed', 'FIXED'); url.searchParams.delete('auto')
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-audio-browser'; await fs.mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] })
const report = { checks: [], errors: [] }; let page
async function boot() {
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120000 }); await page.locator('#boot-start').click()
  await page.evaluate(async () => { window.__AUDIO_CITY__ = (await import('/world/engine/state.js')).state; window.RAFFI_WORLD.dismissDialogue() })
}
async function audio() { return page.evaluate(() => window.RAFFI_WORLD.audioSnapshot()) }
async function frames(n = 3) { const target = await page.evaluate((n) => window.__AUDIO_CITY__.frame + n, n); await page.waitForFunction((n) => window.__AUDIO_CITY__.frame >= n, target, { timeout: 15000 }) }
async function walk(seconds = 1.8) {
  const target = await page.evaluate((s) => window.__AUDIO_CITY__.time + s, seconds)
  await page.keyboard.down('w')
  try { await page.waitForFunction((s) => window.__AUDIO_CITY__.time >= s, target, { timeout: 20000 }) } finally { await page.keyboard.up('w') }
  await frames()
}
async function volume(steps) {
  await page.keyboard.press('Escape'); await page.locator('#pause').waitFor({ state: 'visible' }); await frames(); await page.locator('#sound-volume').focus(); await page.keyboard.press('Home')
  for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('#sound-volume').inputValue(), String(steps * 5)); assert.equal(await page.locator('#sound-volume-value').textContent(), steps * 5 + '%')
  await page.locator('[data-pause="resume"]').click(); await frames()
}
try {
  page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  page.on('pageerror', (e) => report.errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()) }); page.on('response', (r) => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`) })
  await boot(); const initial = await audio(); assert.equal(initial.volume, 1)
  await walk(); const street = await audio(); assert.ok(street.footsteps > initial.footsteps); assert.equal(street.footstepSurface, 'concrete'); report.street = street
  report.checks.push('Real walking generates original concrete footsteps from physical distance')
  await volume(7); assert.equal((await audio()).volume, 0.35)
  assert.equal(await page.evaluate(() => localStorage.getItem('raffi-world-volume')), '0.35')
  await page.keyboard.press('Escape'); await page.locator('#pause').waitFor({ state: 'visible' }); await frames(); const paused = await audio(); await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w'); assert.equal((await audio()).footsteps, paused.footsteps)
  await page.screenshot({ path: OUT + '/01-volume-control.png' }); await page.locator('[data-pause="resume"]').click()
  await boot(); assert.equal((await audio()).volume, 0.35); report.checks.push('Keyboard-accessible volume slider persists across reload; pause suppresses footsteps')
  await page.evaluate(() => window.RAFFI_WORLD.enterInterior('club-floor')); await frames(); await walk(); const wood = await audio(); assert.equal(wood.footstepSurface, 'wood'); assert.ok(wood.footsteps > 0); report.wood = wood
  await page.evaluate(() => window.RAFFI_WORLD.exitInterior()); await frames(); report.checks.push('Same movement in the club produces its authored wood-surface instrument')
  await volume(0); await page.waitForFunction(() => window.RAFFI_WORLD.audioSnapshot().rms < 0.00001, null, { timeout: 5000 }); assert.equal((await audio()).volume, 0)
  await volume(12); await page.waitForFunction(() => window.RAFFI_WORLD.audioSnapshot().rms > 0.00001, null, { timeout: 5000 }); report.restored = await audio(); report.checks.push('Zero volume produces measured silence; restoring60% produces measurable audio again')
  assert.deepEqual(report.errors, []); console.log('Audio browser smoke passed: ' + report.checks.length + ' checks')
} catch (error) { report.failure = error.stack || String(error); try { report.last = await audio(); await page.screenshot({ path: OUT + '/failure.png' }) } catch {}; console.error(report.failure); process.exitCode = 1 }
finally { await fs.writeFile(OUT + '/report.json', JSON.stringify(report, null, 2)); await browser.close() }
