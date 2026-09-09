#!/usr/bin/env node
/** Real browser storage/reload tests. All contexts are disposable QA profiles. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html')
url.searchParams.set('debug', '1')
url.searchParams.set('seed', 'FIXED')
url.searchParams.set('tier', 'low')
url.searchParams.delete('auto')
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-save-browser'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { checks: [], errors: [] }
let page

async function ready() {
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120_000 })
  await page.locator('#boot-start').click()
  await page.evaluate(async () => {
    window.__SAVES__ = await import('/world/game/saves.js')
    window.__SAVE_STATE__ = (await import('/world/engine/state.js')).state
    window.RAFFI_WORLD.dismissDialogue()
  })
  await frames()
}

async function frames(n = 2) {
  const target = await page.evaluate((count) => window.__SAVE_STATE__.frame + count, n)
  await page.waitForFunction((frame) => window.__SAVE_STATE__.frame >= frame, target, { timeout: 15_000 })
}

async function inspect() {
  return page.evaluate(() => ({
    player: window.RAFFI_WORLD.getState().player,
    mission: window.RAFFI_WORLD.missionSnapshot(),
    radio: { ...window.__SAVE_STATE__.radio },
    grade: window.__SAVE_STATE__.grade.forced,
    slots: window.__SAVES__.saveSlots(),
  }))
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  page = await context.newPage()
  page.on('pageerror', (error) => report.errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()) })
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`) })
  await ready()
  assert.equal((await inspect()).slots.filter((slot) => slot.empty).length, 4)
  let result = await page.evaluate(() => window.__SAVES__.saveGame('slot-1'))
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal((await inspect()).slots.find((slot) => slot.slot === 'slot-1').valid, true)
  const firstSave = await page.evaluate(() => localStorage.getItem('raffi-world:save:v1:slot-1'))
  report.checks.push('Three manual slots and one autosave exist; first save persists valid browser storage')

  // Mount an actual authored board before saving; a new document must rebuild
  // the ride safely without trying to deserialize Three objects or controls.
  await page.evaluate(async () => {
    const { data } = await import('/world/engine/state.js')
    const board = data.world.landmarks.find((item) => item.type === 'mobility-hub').rides.find((item) => item.archetype === 'skateboard')
    window.RAFFI_WORLD.teleport(board.at.x, board.at.z)
    window.RAFFI_WORLD.setGrade('night')
  })
  await frames()
  await page.keyboard.press('e')
  await frames()
  assert.equal((await inspect()).player.vehicle, 'skateboard')
  await page.keyboard.press('r')
  await frames()
  const beforeReload = await inspect()
  result = await page.evaluate(() => window.__SAVES__.saveGame('slot-2'))
  assert.equal(result.ok, true)
  await ready()
  result = await page.evaluate(() => window.__SAVES__.loadGame('slot-2'))
  assert.equal(result.ok, true, JSON.stringify(result))
  await frames()
  let after = await inspect()
  assert.equal(after.player.vehicle, 'skateboard')
  assert.ok(Math.hypot(after.player.x - beforeReload.player.x, after.player.z - beforeReload.player.z) < 0.8)
  assert.equal(after.radio.stationIndex, beforeReload.radio.stationIndex)
  assert.equal(after.radio.on, beforeReload.radio.on)
  assert.equal(after.grade, 'night')
  const countVehicles = () => page.evaluate(async () => (await import('/world/engine/render.js')).gfx.scene.children.filter((object) => object.name.startsWith('vehicle:')).length)
  const overlap = await page.evaluate(async () => {
    const { gfx } = await import('/world/engine/render.js')
    const { player } = await import('/world/game/player.js')
    return gfx.scene.children.filter((mesh) => mesh.name.startsWith('vehicle:') && mesh !== player.vehicle.mesh && Math.hypot(mesh.position.x - player.vehicle.x, mesh.position.z - player.vehicle.z) < 0.5).length
  })
  assert.equal(overlap, 0, 'Loading a saved hub ride duplicated another ride at its exact position')
  const count = await countVehicles()
  for (let i = 0; i < 3; i++) assert.equal((await page.evaluate(() => window.__SAVES__.loadGame('slot-2'))).ok, true)
  assert.equal(await countVehicles(), count, 'repeated load leaked generated rides')
  report.checks.push('Reload restores a mounted generated ride, position, radio and grade; repeated loads do not leak vehicles')

  // A storage error must preserve the last good save and the running session.
  const denied = await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new DOMException('Quota full', 'QuotaExceededError') }
    try { return window.__SAVES__.saveGame('slot-1', { quiet: true }) }
    finally { Storage.prototype.setItem = original }
  })
  assert.equal(denied.ok, false)
  assert.equal(await page.evaluate(() => localStorage.getItem('raffi-world:save:v1:slot-1')), firstSave)
  report.checks.push('Full/blocked browser storage reports failure and preserves the last good save')

  await page.keyboard.press('Escape')
  await page.locator('#pause').waitFor({ state: 'visible' })
  const beforeCorrupt = await inspect()
  const corrupt = await page.evaluate(() => {
    localStorage.setItem('raffi-world:save:v1:slot-3', '{damaged')
    return window.__SAVES__.loadGame('slot-3')
  })
  assert.equal(corrupt.ok, false)
  after = await inspect()
  assert.deepEqual(after.player, beforeCorrupt.player)
  assert.deepEqual(after.mission, beforeCorrupt.mission)
  assert.equal(after.slots.find((slot) => slot.slot === 'slot-3').valid, false)
  await page.locator('[data-pause="resume"]').click()
  await frames()
  report.checks.push('Corrupt slot fails validation without changing player or campaign state')

  await page.evaluate(() => window.__SAVES__.loadGame('slot-1'))
  await page.evaluate(() => {
    window.RAFFI_WORLD.startMissionById('deal-clock')
    window.RAFFI_WORLD.confirmMissionBriefing()
    window.RAFFI_WORLD.dismissDialogue()
  })
  await frames()
  assert.equal((await inspect()).mission.status, 'active')
  assert.equal((await page.evaluate(() => window.__SAVES__.saveGame('slot-3'))).ok, true)
  await page.evaluate(() => {
    window.RAFFI_WORLD.teleport(-300, 20)
    window.RAFFI_WORLD.setComplianceTier(4)
  })
  result = await page.evaluate(() => window.__SAVES__.loadGame('slot-3'))
  assert.equal(result.ok, true)
  assert.equal(result.checkpoint, true)
  after = await inspect()
  assert.equal(after.mission.active, 'deal-clock')
  assert.equal(after.mission.status, 'briefing')
  assert.equal(after.mission.elapsed, 0)
  assert.equal(after.player.vehicle, null)
  assert.ok(Math.hypot(after.player.x - 60, after.player.z + 250) < 0.8)
  assert.equal(await page.evaluate(() => window.RAFFI_WORLD.getState().compliance.tier), 0)
  report.checks.push('Active-mission save restores its clear briefing checkpoint with a fresh timer and no stale pursuit or ride')

  await page.evaluate(async () => {
    window.__SAVES__.loadGame('slot-1')
    ;(await import('/world/game/missions.js')).completeCrateQuest()
  })
  const auto = await page.evaluate(() => JSON.parse(localStorage.getItem('raffi-world:save:v1:auto')))
  assert.ok(auto.completed.includes('crate-quest'))
  await ready()
  assert.equal((await page.evaluate(() => window.__SAVES__.loadGame('auto'))).ok, true)
  assert.ok((await inspect()).mission.completed.includes('crate-quest'))
  report.checks.push('Completed checkpoint autosaves and survives a new page load')
  report.final = await inspect()
  await page.screenshot({ path: `${out}/saved-game-loaded.png` })
  assert.deepEqual(report.errors, [])
  process.stdout.write(`Save browser smoke passed: ${report.checks.length} checks\n`)
} catch (error) {
  report.failure = error.stack || error.message
  await page?.screenshot({ path: `${out}/failure.png`, timeout: 5_000 }).catch(() => {})
  throw error
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
