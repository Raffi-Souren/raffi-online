#!/usr/bin/env node
/** Real typed choices and skill inputs; route position fixtures keep this focused on story regressions. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html')
url.searchParams.set('debug', '1'); url.searchParams.set('seed', 'FIXED'); url.searchParams.set('tier', 'low'); url.searchParams.delete('auto')
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-story-browser'
await fs.mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { checks: [], errors: [], routePositionFixtures: true, realTypedChoices: true, realKeyboardSkill: true }
let page
async function observers() {
  await page.evaluate(async () => { window.__STORY__ = await import('/world/game/story.js'); window.__CITY__ = await import('/world/engine/state.js'); window.__SAVES__ = await import('/world/game/saves.js') })
}
async function snap() { return page.evaluate(() => ({ story: window.__STORY__.storySnapshot(), paused: window.__CITY__.state.paused, time: window.__CITY__.state.time, player: { ...window.__CITY__.state.player }, mission: window.RAFFI_WORLD.missionSnapshot(), audio: window.RAFFI_WORLD.audioSnapshot() })) }
async function frames(n = 2) { const target = await page.evaluate((n) => window.__CITY__.state.frame + n, n); await page.waitForFunction((n) => window.__CITY__.state.frame >= n, target, { timeout: 20000 }) }
async function at(id) {
  await page.evaluate(async (id) => {
    const cfg = window.__CITY__.data.conversations
    const { storyTargets } = await import('/world/game/story-core.js')
    const target = id === 'owner' ? cfg.owner : storyTargets(window.__STORY__.storySnapshot(), cfg).find((item) => item.id === id)
    if (!target) throw new Error('Missing story route: ' + id)
    window.RAFFI_WORLD.teleport(target.at.x, target.at.z)
  }, id)
  await frames(3)
}
async function interact(id) {
  await at(id); await page.keyboard.press('e')
  await page.locator('#last-crate').waitFor({ state: 'visible', timeout: 10000 })
}
async function type(text) { await page.locator('#last-crate-input').fill(text); await page.locator('.last-crate-form button').click(); await frames() }
async function close() { await page.locator('.last-crate-close').click(); await page.locator('#last-crate').waitFor({ state: 'hidden' }); await frames() }
async function fresh() {
  if (await page.locator('#last-crate').isVisible()) await close()
  await page.evaluate(() => { window.__STORY__.restoreStory(null); window.RAFFI_WORLD.dismissDialogue() })
  await interact('owner')
}
async function saveWithUI(slot = 'slot-1') {
  await page.keyboard.press('Escape'); await page.locator('[data-pause="saves"]').click()
  await page.locator(`[data-save-slot="${slot}"][data-save-action="save"]`).click()
  assert.match(await page.locator('#save-notice').textContent(), /Saved/)
  await page.locator('#save-close').click(); await page.locator('[data-pause="resume"]').click(); await frames()
}
async function perform() {
  await page.locator('[data-story-start]').click()
  for (let i = 0; i < 30; i++) {
    const s = (await snap()).story
    if (!s.challenge) break
    const next = (s.challenge.next + 1) * 60 / s.challenge.bpm
    await page.waitForFunction((next) => { const run = window.__STORY__.storySnapshot().challenge; return !run || run.elapsed >= next - 0.075 }, next, { polling: 'raf', timeout: 6000 })
    if (!(await snap()).story.challenge) break
    await page.keyboard.press('Space')
  }
  await page.waitForFunction(() => !window.__STORY__.storySnapshot().challenge, null, { timeout: 10000 })
}
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  page = await context.newPage()
  page.on('pageerror', (e) => report.errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()) })
  page.on('response', (r) => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`) })
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120000 }); await page.locator('#boot-start').click(); await observers()
  await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
  await fresh()
  const initial = await snap()
  await type('Can I return the personal records?'); assert.equal((await snap()).story.branch, null)
  await type("Maybe I'll cover the gig"); assert.equal((await snap()).story.branch, null)
  await type("I'll return the records or cover the gig"); assert.equal((await snap()).story.branch, null)
  const afterQuestions = await snap(); assert.equal(afterQuestions.time, initial.time); assert.equal(afterQuestions.player.x, initial.player.x); assert.equal(afterQuestions.player.z, initial.player.z)
  await page.screenshot({ path: OUT + '/01-clarification.png' })
  await type('No thanks'); assert.equal((await snap()).story.status, 'declined')
  await close(); await interact('owner'); await type("I'll bring them home"); assert.equal((await snap()).story.branch, 'return')
  await close(); await saveWithUI()
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#boot-continue').waitFor({ state: 'visible', timeout: 120000 }); await page.locator('#boot-continue').click(); await observers(); await frames()
  assert.equal((await snap()).story.branch, 'return'); assert.equal((await snap()).story.stage, 'delivery')
  report.checks.push('Typed questions/ambiguity/refusal never commit; explicit return saved with pause UI and boot Continue reload')
  await interact('delivery'); assert.equal((await snap()).story.trust, 2); await close()
  await interact('owner'); assert.equal((await snap()).story.callbackSeen, true); assert.match(await page.locator('.last-crate-reply').textContent(), /Lena called/); await close()
  await interact('listening'); await page.locator('.last-crate-sleeve').first().click()
  await page.waitForFunction(() => window.__CITY__.state.storyPlayingMusic && window.RAFFI_WORLD.audioSnapshot().state === 'running' && window.RAFFI_WORLD.audioSnapshot().rms > 0.00001, null, { timeout: 8000 })
  const listening = await snap(); report.listeningAudio = listening.audio
  await page.evaluate(() => window.postMessage({ type: 'raffi-world:activity', active: false }, location.origin))
  await page.waitForTimeout(150)
  const heldSide = (await snap()).story.challenge.elapsed
  await page.waitForTimeout(1100)
  assert.equal((await snap()).story.challenge.elapsed, heldSide)
  await page.evaluate(() => window.postMessage({ type: 'raffi-world:activity', active: true }, location.origin))
  await frames(2)
  assert.ok((await snap()).story.challenge.elapsed - heldSide < 0.7, 'Returning to the window must not count its hidden time toward the side')
  report.checks.push('Host inactivity freezes the listening side and resumes its clock without charging hidden time')
  await page.screenshot({ path: OUT + '/02-listening.png' })
  await page.waitForFunction(() => window.__STORY__.storySnapshot().listeningDone, null, { timeout: 25000 })
  assert.equal((await snap()).story.trust, 3); await close()
  report.checks.push('Return delivery, remembered later invitation, original audible listening side and idempotent trust')
  await fresh(); await type('I can DJ tonight'); await close()
  for (const id of ['plaza-dub', 'lot-breaks', 'backdoor-soul']) await at(id)
  assert.equal((await snap()).story.stage, 'gig')
  await interact('gig'); await page.locator('[data-story-start]').click()
  await page.waitForFunction(() => !window.__STORY__.storySnapshot().challenge, null, { timeout: 10000 })
  assert.equal((await snap()).story.gigs, 0); assert.match(await page.locator('.last-crate-reply').textContent(), /try/i); await close()
  await interact('gig'); await perform()
  const cover = (await snap()).story; assert.equal(cover.status, 'complete', JSON.stringify(cover)); assert.equal(cover.gigs, 1)
  await page.screenshot({ path: OUT + '/03-cover-complete.png' }); await close()
  await interact('owner'); assert.equal((await snap()).story.callbackSeen, true); await close(); await interact('future-gig'); await perform(); assert.equal((await snap()).story.gigs, 2); await close()
  report.checks.push('Three replacement pickups, real-time failure and keyboard retry, successful DJ set, remembered second playable gig')
  for (const terms of ['deposit', 'favor']) {
    await fresh(); await type("I'll negotiate the handoff"); assert.equal((await snap()).story.branch, null)
    await page.getByRole('button', { name: terms === 'deposit' ? 'Leave $25 refundable deposit' : 'Promise the flyer-run favor', exact: true }).click()
    assert.equal((await snap()).story.terms, terms); await close(); await interact('handoff'); await close()
    await saveWithUI('slot-2')
    await page.evaluate(() => window.__SAVES__.loadGame('slot-2')); await frames()
    assert.equal((await snap()).story.stage, terms === 'deposit' ? 'sleeve' : 'flyers')
    await interact(terms === 'deposit' ? 'sleeve' : 'flyers')
    const settled = (await snap()).story; assert.equal(settled.wallet, 40); assert.equal(settled.escrow, 0); assert.equal(settled.favorsOwed, 0); assert.equal(settled.trust, 1)
    await page.screenshot({ path: OUT + `/04-${terms}-settled.png` }); await close(); await interact('owner'); assert.match(await page.locator('.last-crate-reply').textContent(), /settled/); await close()
    report.checks.push(`Explicit ${terms} terms, saved post-handoff obligation and one-time settlement remembered later`)
  }
  const final = await snap(); assert.deepEqual(final.mission.completed, []); assert.equal(final.mission.active, null)
  await page.setViewportSize({ width: 390, height: 844 }); await fresh(); await type('What would I owe?')
  await page.screenshot({ path: OUT + '/05-phone-dialogue.png' })
  const overflow = await page.evaluate(() => document.querySelector('.last-crate-card').getBoundingClientRect().right > innerWidth)
  assert.equal(overflow, false)
  await page.keyboard.press('Escape'); await page.locator('#last-crate').waitFor({ state: 'hidden' }); assert.equal((await snap()).paused, false)
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'view', 'Escape must return focus to the game canvas')
  const resumed = await snap()
  await page.keyboard.down('w')
  try { await page.waitForFunction((time) => window.__CITY__.state.time >= time, resumed.time + 0.3, { timeout: 10000 }) } finally { await page.keyboard.up('w') }
  const moved = (await snap()).player
  assert.ok(Math.hypot(moved.x - resumed.player.x, moved.z - resumed.player.z) > 0.25, 'Closing typed dialogue left walking input trapped')
  report.checks.push('Campaign remains untouched; phone layout fits; Escape returns canvas focus and real W movement')
  assert.deepEqual(report.errors, [])
  console.log('Story browser smoke passed: ' + report.checks.length + ' checks')
} catch (error) {
  report.failure = error.stack || String(error)
  try { report.last = await snap(); await page.screenshot({ path: OUT + '/failure.png' }) } catch {}
  console.error(report.failure); process.exitCode = 1
} finally { await fs.writeFile(OUT + '/report.json', JSON.stringify(report, null, 2)); await browser.close() }
