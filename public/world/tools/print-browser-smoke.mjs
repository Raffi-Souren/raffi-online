#!/usr/bin/env node
/** Entry placement fixture; the print itself uses real text, keys, buttons and touch drags. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-print-browser'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=metal'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: out + '/video', size: { width: 1280, height: 900 } } })
const page = await context.newPage(), report = { checks: [], errors: [], fixture: 'Only entry position is placed once; all design, registration and ink pulls use ordinary browser input.' }
page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()) })
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html'); for (const [key, value] of Object.entries({ debug: '1', tier: 'low', seed: 'FIXED', hour: '14' })) url.searchParams.set(key, value)
const snapshot = () => page.evaluate(async () => ({ print: RAFFI_WORLD.printStudioSnapshot(), world: { ...(await import('/world/engine/state.js')).state.player }, time: (await import('/world/engine/state.js')).state.time, paused: (await import('/world/engine/state.js')).state.paused }))
const shot = name => page.screenshot({ path: `${out}/${name}.png` })
async function enter() { await page.evaluate(() => { RAFFI_WORLD.dismissDialogue(); RAFFI_WORLD.teleport(-333, -401) }); await page.waitForTimeout(250); await page.keyboard.press('e'); await page.locator('#print-studio').waitFor({ state: 'visible' }) }
async function align() {
  const o = (await snapshot()).print.job.offset; await page.locator('.print-workbench canvas').focus()
  for (let i = 0; i < Math.abs(o.x); i++) await page.keyboard.press(o.x > 0 ? 'ArrowLeft' : 'ArrowRight')
  for (let i = 0; i < Math.abs(o.y); i++) await page.keyboard.press(o.y > 0 ? 'ArrowUp' : 'ArrowDown')
  assert.deepEqual((await snapshot()).print.job.offset, { x: 0, y: 0 })
  await page.getByRole('button', { name: 'Clamp screen · add ink', exact: true }).click()
}
async function keyboardPull() { await page.locator('.print-workbench canvas').focus(); await page.keyboard.down('Space'); await page.waitForTimeout(2250); await page.keyboard.up('Space'); await page.locator('[data-print-lift]').click() }
try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120000 }); await page.locator('#boot-start').click(); await enter()
  const initial = await snapshot()
  await page.locator('[name=format]').selectOption('sleeve'); await page.locator('[name=motif]').selectOption('city-grid'); await page.locator('[name=palette]').selectOption('court-side'); await page.locator('[name=title]').fill('A NIGHT ON WILLOW'); await shot('01-design')
  assert.equal((await snapshot()).time, initial.time); assert.deepEqual((await snapshot()).world, initial.world)
  await page.getByRole('button', { name: 'Set up the first screen' }).click(); await align(); await keyboardPull(); assert.equal((await snapshot()).print.job.layer, 1)
  await align(); await keyboardPull(); const result = await snapshot(); assert.equal(result.print.job.phase, 'done'); assert.equal(result.print.progress.printed, 1); assert.equal(result.print.progress.last.design.title, 'A NIGHT ON WILLOW'); await shot('02-finished-sleeve')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('raffi-world:save:v1:auto'))); assert.deepEqual(saved.printing, result.print.progress); assert.ok(saved.radio.unlocked.includes('KFLP')); report.checks.push('Text/design choices + two real keyboard registration and ink passes produce a saved sleeve and once-only radio introduction')
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save a PNG of my print' }).click(); const download = await downloadEvent; await download.saveAs(out + '/my-print.png')
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); assert.equal((await snapshot()).paused, false); assert.equal(await page.evaluate(() => document.activeElement.id), 'view')
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#boot-continue').waitFor({ state: 'visible', timeout: 120000 }); await page.locator('#boot-continue').click(); assert.deepEqual((await snapshot()).print.progress, result.print.progress); await enter(); assert.match(await page.locator('.print-instructions').textContent(), /remember your sleeve/)
  await page.getByRole('button', { name: 'See my last print' }).click(); assert.equal((await snapshot()).print.progress.printed, 1); await shot('03-remembered-edition'); report.checks.push('PNG export works; reload reproduces both ink layers and Mae remembers the exact format without duplicating the reward')
  await page.getByRole('button', { name: 'Make another edition' }).click(); await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[name=format]').selectOption('shirt'); await page.locator('[name=motif]').selectOption('sound-system'); await page.getByRole('button', { name: 'Set up the first screen' }).click(); await shot('04-phone-registration')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: 'Clamp screen · add ink' }).click(); await page.locator('.print-workbench canvas').scrollIntoViewIfNeeded()
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
  const b = await page.locator('.print-workbench canvas').boundingBox(), scale = Math.min(b.width / 600, b.height / 720), ox = b.x + (b.width - 600 * scale) / 2, oy = b.y + (b.height - 720 * scale) / 2
  for (let i = 0; i <= 55; i++) { const p = { x: ox + 300 * scale, y: oy + (195 + i / 55 * 345) * scale, id: 1, force: .5 }; await cdp.send('Input.dispatchTouchEvent', { type: i === 0 ? 'touchStart' : 'touchMove', touchPoints: [p] }); await page.waitForTimeout(32) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); assert.ok((await snapshot()).print.job.coverage.reduce((a, b) => a + b, 0) / 48 > .88); await shot('05-phone-ink')
  await page.locator('[data-print-lift]').click(); await page.keyboard.press('Escape'); assert.equal((await snapshot()).print.progress.printed, 1); report.checks.push('Phone controls fit, actual touch squeegee deposits ink, and leaving an unfinished second edition grants no reward')
  assert.deepEqual(report.errors, [])
} catch (error) { report.failure = error.stack; report.last = await snapshot().catch(() => null); await shot('failure').catch(() => {}); process.exitCode = 1 }
finally { await context.close(); report.video = await page.video().path(); await fs.writeFile(out + '/report.json', JSON.stringify(report, null, 2)); process.stdout.write(JSON.stringify(report, null, 2) + '\n'); await browser.close() }
