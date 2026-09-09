#!/usr/bin/env node
/** Real moving street actors plus pause, yield and player-ownership integration. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html')
url.searchParams.set('tier', 'low'); url.searchParams.set('debug', '1'); url.searchParams.set('auto', '1'); url.searchParams.set('seed', 'FIXED')
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-traffic-browser'; await fs.mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { checks: [], errors: [] }; let page
async function frames(n = 3) { const target = await page.evaluate((n) => window.__CITY__.state.frame + n, n); await page.waitForFunction((n) => window.__CITY__.state.frame >= n, target, { timeout: 15000 }) }
async function sim(seconds) { const target = await page.evaluate((n) => window.__TRAFFIC__.trafficSnapshot().time + n, seconds); await page.waitForFunction((n) => window.__TRAFFIC__.trafficSnapshot().time >= n, target, { timeout: 120000 }) }
async function snapshot() { return page.evaluate(() => window.__TRAFFIC__.trafficSnapshot()) }
try {
  page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  page.on('pageerror', (e) => report.errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()) }); page.on('response', (r) => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`) })
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForFunction(() => window.RAFFI_WORLD?.ready, null, { timeout: 120000 })
  await page.evaluate(async () => { window.__CITY__ = await import('/world/engine/state.js'); window.__TRAFFIC__ = await import('/world/game/traffic.js'); window.__PLAYER__ = await import('/world/game/player.js'); window.RAFFI_WORLD.dismissDialogue() })
  await frames()
  const initial = await snapshot(); report.initial = initial
  assert.ok(initial.active >= 6, JSON.stringify(initial))
  const first = initial.cars.find((car) => car.active && car.from === '-489|-145')
  assert.ok(first, 'Willow Place must have one real eastbound car in the opening')
  await page.evaluate((car) => window.RAFFI_WORLD.teleport(car.x + Math.sin(car.yaw) * 8, car.z + Math.cos(car.yaw) * 8), first)
  await sim(5)
  const yielded = (await snapshot()).cars.find((car) => car.id === first.id)
  assert.equal(yielded.speed, 0); assert.ok(['pedestrian', 'traffic'].includes(yielded.reason)); assert.ok(Math.hypot(yielded.x - first.x, yielded.z - first.z) < 6)
  await page.screenshot({ path: OUT + '/01-crossing-yield.png' }); report.checks.push('Authored local street receives moving traffic; driver yields to player crossing')
  await page.evaluate((car) => window.RAFFI_WORLD.teleport(car.x + Math.cos(car.yaw) * 2.5, car.z - Math.sin(car.yaw) * 2.5), yielded)
  await frames(); await page.keyboard.press('e'); await frames()
  const mounted = await page.evaluate(() => { window.__CLAIMED__ = window.__PLAYER__.player.vehicle; return { id: window.__CLAIMED__?.id, mode: window.__CITY__.state.mode } })
  assert.equal(mounted.id, first.id); assert.equal(mounted.mode, 'vehicle')
  assert.equal((await snapshot()).cars.find((car) => car.id === first.id).claimed, true)
  await page.keyboard.down('w'); await sim(1); await page.keyboard.up('w'); await page.keyboard.press('e'); await frames()
  const parked = await page.evaluate(() => ({ x: window.__CLAIMED__.x, z: window.__CLAIMED__.z }))
  await sim(3); const after = await page.evaluate(() => ({ x: window.__CLAIMED__.x, z: window.__CLAIMED__.z, ai: window.__CLAIMED__.traffic, mode: window.__CITY__.state.mode }))
  assert.equal(after.x, parked.x); assert.equal(after.z, parked.z); assert.equal(after.ai, false); assert.equal(after.mode, 'foot')
  report.checks.push('Real E claims stopped traffic car; W drives it; E exits and AI never takes it back')
  await page.keyboard.press('Escape'); await frames(); const frozen = await snapshot(); await frames(14); assert.deepEqual(await snapshot(), frozen); await page.locator('[data-pause="resume"]').click(); await frames()
  report.checks.push('Pause freezes fleet positions, intersection state and clocks')
  await sim(24); const final = await snapshot(); report.final = final
  assert.ok(final.junctions > initial.junctions + 2, JSON.stringify(final)); assert.ok(final.moving > 0)
  await page.screenshot({ path: OUT + '/02-traffic-junctions.png' })
  report.checks.push('Remaining fleet continues connected routes and clears multiple intersections')
  assert.deepEqual(report.errors, []); console.log('Traffic browser smoke passed: ' + report.checks.length + ' checks')
} catch (error) { report.failure = error.stack || String(error); try { report.last = await snapshot(); await page.screenshot({ path: OUT + '/failure.png' }) } catch {}; console.error(report.failure); process.exitCode = 1 }
finally { await fs.writeFile(OUT + '/report.json', JSON.stringify(report, null, 2)); await browser.close() }
