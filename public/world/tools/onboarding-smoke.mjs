#!/usr/bin/env node

/** Browser smoke for the crib → mobility/subway → DEAL CLOCK vertical slice. */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import process from 'node:process'
import { chromium } from 'playwright'

const BASE = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp'

const world = JSON.parse(await fs.readFile(new URL('../data/world.json', import.meta.url), 'utf8'))
const missions = JSON.parse(await fs.readFile(new URL('../data/missions.json', import.meta.url), 'utf8'))
const dialogue = JSON.parse(await fs.readFile(new URL('../data/dialogue.json', import.meta.url), 'utf8'))
const hub = world.landmarks.find((landmark) => landmark.type === 'mobility-hub')
const dealClock = missions.missions.find((mission) => mission.id === 'deal-clock')
const repaintTuning = world.repaint || {}
const repaintShops = world.repaintShops || []
const nearestShopToSpawn = [...repaintShops].sort((a, b) =>
  Math.hypot(a.at.x - world.spawn.x, a.at.z - world.spawn.z) -
  Math.hypot(b.at.x - world.spawn.x, b.at.z - world.spawn.z)
)[0]

const executableCandidates = [
  process.env.RAFFI_AUDIT_CHROME,
  chromium.executablePath(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean)
let executablePath
for (const candidate of executableCandidates) {
  try {
    await fs.access(candidate)
    executablePath = candidate
    break
  } catch {}
}

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const errors = []

async function readyPage(context) {
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push('page: ' + error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()) })
  page.on('requestfailed', (request) => errors.push('request: ' + request.url()))
  await page.goto(BASE + '?debug=1&auto=1&seed=FIXED', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0, null, { timeout: 120_000 })
  await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
  return page
}

async function pressKey(page, key, holdMs = 70) {
  await page.keyboard.down(key)
  await page.waitForTimeout(holdMs)
  await page.keyboard.up(key)
}

try {
const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const desktop = await readyPage(desktopContext)

const initial = await desktop.evaluate(() => ({
  objective: document.querySelector('#objective')?.textContent,
  label: document.querySelector('#minimap-label')?.textContent,
  radius: getComputedStyle(document.querySelector('#minimap-canvas')).borderRadius,
}))
assert.match(initial.objective, /CHOOSE A RIDE OR TAKE THE SUBWAY/)
assert.match(initial.label, /CRIB GARAGE/)
assert.notEqual(initial.radius, '0px')

// Pause is a real mode, not decorative chrome. The two implemented controls
// must update live state, while deferred systems must say so and stay disabled.
await pressKey(desktop, 'Tab')
await desktop.waitForTimeout(80)
assert.equal(await desktop.evaluate(async () => (await import('/world/engine/state.js')).state.paused), true)
assert.equal(await desktop.locator('#pause').isVisible(), true)
await desktop.screenshot({ path: OUT + '/raffi-world-pause-desktop.png' })
await desktop.locator('[data-pause="resume"]').click()
await desktop.waitForTimeout(80)
assert.equal(
  await desktop.evaluate(async () => (await import('/world/engine/state.js')).state.paused),
  false,
  'pause RESUME button did not unpause the game'
)
assert.equal(await desktop.locator('#pause').isVisible(), false)

await pressKey(desktop, 'Tab')
// CI runners can take longer than one frame to service the key edge. Wait for
// the observable focus contract instead of racing it with a fixed sleep.
await desktop.waitForFunction(
  () => document.activeElement?.getAttribute('data-pause') === 'resume',
  null,
  { timeout: 5_000 },
)
const gradeButton = desktop.locator('[data-pause="grade"]')
assert.equal(
  await desktop.evaluate(() => document.activeElement?.getAttribute('data-pause')),
  'resume',
  'pause did not focus RESUME on open'
)
await desktop.keyboard.press('Tab')
await desktop.waitForTimeout(30)
// Next focus may be REWIND (when a run is recorded) or GRADE (when rewind is disabled).
const nextPause = await desktop.evaluate(() => document.activeElement?.getAttribute('data-pause'))
assert.ok(
  nextPause === 'grade' || nextPause === 'rewind',
  'Tab closed pause instead of moving focus to the next available control (got ' + nextPause + ')',
)
assert.equal(await desktop.evaluate(async () => (await import('/world/engine/state.js')).state.paused), true)
// Land on grade for the cycle test (skip rewind if focused).
if (nextPause === 'rewind') {
  await desktop.keyboard.press('Tab')
  await desktop.waitForTimeout(30)
}
for (const expected of ['DUSK', 'HAZE', 'NIGHT', 'AUTO']) {
  await gradeButton.click()
  await desktop.waitForTimeout(30)
  assert.match(
    await gradeButton.textContent(),
    new RegExp(expected),
    `pause grade did not show ${expected}`
  )
  const forced = await desktop.evaluate(async () => (await import('/world/engine/state.js')).state.grade.forced)
  assert.equal(
    forced,
    expected === 'AUTO' ? null : expected.toLowerCase(),
    `pause grade state did not become ${expected}`
  )
}
// The pause menu exposes supported actions only; REWIND arms after recording.
for (const action of ['map', 'quit']) {
  assert.equal(await desktop.locator(`[data-pause="${action}"]`).count(), 0, `unsupported pause action ${action} is still shown`)
}
const rewindBtn = desktop.locator('[data-pause="rewind"]')
assert.match(await rewindBtn.textContent(), /REWIND/)
await desktop.keyboard.press('Escape')
await desktop.waitForFunction(() => window.RAFFI_WORLD.getState().paused === false, null, { timeout: 5_000 })
assert.equal(await desktop.evaluate(async () => (await import('/world/engine/state.js')).state.paused), false)
assert.equal(await desktop.locator('#pause').isVisible(), false)

const board = hub.rides.find((ride) => ride.archetype === 'skateboard')
await desktop.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), board.at)
await desktop.waitForTimeout(80)
assert.match(await desktop.locator('#interaction-prompt').textContent(), /SPACE.*RIDE SKATEBOARD/s)
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(180)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, 'skateboard')
assert.match(await desktop.locator('#interaction-prompt').textContent(), /SPACE \/ E.*EXIT SKATEBOARD/s)

// A visible EXIT affordance must be live immediately, and the same parked
// ride must be available again as soon as the player steps off. This guards
// the complete mount -> exit -> remount state cycle, not merely first mount.
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(100)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  null,
  'fresh skateboard mount ignored its first exit press'
)
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(100)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  'skateboard',
  'same skateboard could not be remounted after exit'
)
const beforeBoard = await desktop.evaluate(() => window.RAFFI_WORLD.getState().player)
await desktop.keyboard.down('w')
await desktop.waitForTimeout(1800)
await desktop.keyboard.up('w')
const afterBoard = await desktop.evaluate(() => window.RAFFI_WORLD.getState().player)
const boardDistance = Math.hypot(afterBoard.x - beforeBoard.x, afterBoard.z - beforeBoard.z)
assert.ok(boardDistance > 2.5, `skateboard did not move (${boardDistance.toFixed(2)}m)`)
assert.match(await desktop.locator('#objective').textContent(), /DEAL CLOCK/)

await desktop.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(500)
const movingBoardExit = await desktop.evaluate(() => window.RAFFI_WORLD.getState().player)
assert.equal(
  movingBoardExit.vehicle,
  null,
  'Space did not dismount the skateboard'
)
assert.equal(movingBoardExit.speed, 0, 'skateboard velocity leaked into on-foot movement')
assert.match(await desktop.locator('#interaction-prompt').textContent(), /RIDE SKATEBOARD/)
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(100)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  'skateboard',
  'moving skateboard could not be remounted after exit'
)
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(100)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, null)

const cribCar = hub.rides.find((ride) => ride.archetype === 'grand-tourer')
await desktop.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), cribCar.at)
await desktop.waitForTimeout(80)
await pressKey(desktop, 'e')
await desktop.waitForTimeout(100)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, 'grand-tourer')
assert.match(await desktop.locator('#interaction-prompt').textContent(), /E.*EXIT GRAND TOURER/s)
await pressKey(desktop, 'e')
await desktop.waitForTimeout(100)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  null,
  'fresh travel-vehicle mount ignored its first exit press'
)
await pressKey(desktop, 'e')
await desktop.waitForTimeout(100)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  'grand-tourer',
  'same travel vehicle could not be remounted after exit'
)
await desktop.keyboard.down('w')
await desktop.waitForTimeout(700)
await desktop.keyboard.up('w')
const movingCar = await desktop.evaluate(() => window.RAFFI_WORLD.getState().player)
assert.ok(movingCar.speed > 0.25, `travel vehicle did not move before exit (${movingCar.speed})`)
await pressKey(desktop, 'e')
await desktop.waitForTimeout(100)
const movingCarExit = await desktop.evaluate(() => window.RAFFI_WORLD.getState().player)
assert.equal(
  movingCarExit.vehicle,
  null,
  'moving travel vehicle did not exit'
)
assert.equal(movingCarExit.speed, 0, 'travel-vehicle velocity leaked into on-foot movement')
assert.match(await desktop.locator('#interaction-prompt').textContent(), /DRIVE GRAND TOURER/)
await pressKey(desktop, 'e')
await desktop.waitForTimeout(100)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  'grand-tourer',
  'moving travel vehicle could not be remounted after exit'
)
await pressKey(desktop, 'e')
await desktop.waitForTimeout(100)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, null)

await desktop.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), hub.transit.at)
await desktop.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
await desktop.keyboard.press('e')
await desktop.waitForFunction(() => !document.querySelector('#travel').classList.contains('hidden'), null, { timeout: 4_000 })
await desktop.waitForFunction(() => document.querySelector('#travel').classList.contains('hidden'), null, { timeout: 5_000 })
const arrived = await desktop.evaluate(() => window.RAFFI_WORLD.getState().player)
assert.ok(Math.hypot(arrived.x - dealClock.marker.x, arrived.z - dealClock.marker.z) <= 8, 'subway arrived outside mission interaction range')

await desktop.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
await desktop.waitForTimeout(80)
assert.match(await desktop.locator('#interaction-prompt').textContent(), /START DEAL CLOCK/)
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(100)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.missionSnapshot())).status, 'briefing')
await desktop.keyboard.press('e')
await desktop.waitForTimeout(80)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.missionSnapshot())).status, 'briefing')
assert.equal(await desktop.locator('#subtitle-text').textContent(), dialogue.lines[dealClock.startLine].text)
assert.equal(await desktop.locator('#subtitle').evaluate((element) => element.classList.contains('show')), true)
assert.equal(await desktop.locator('#subtitle-kicker').textContent(), 'INCOMING CALL')
assert.equal(await desktop.locator('#subtitle-speaker').textContent(), 'MANAGER')
await desktop.keyboard.press('e')
await desktop.waitForTimeout(120)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.missionSnapshot())).status, 'active')

// Runtime retry, not merely a fresh pure-core object: fail the live run, close
// the authored failure call, re-enter the marker, and accept a second briefing.
await desktop.evaluate(async () => {
  const { updateMissions } = await import('/world/game/missions.js')
  updateMissions(165)
})
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.missionSnapshot())).active, null)
assert.match(await desktop.locator('#objective').textContent(), /RETRY · DEAL CLOCK/)
await desktop.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
await desktop.waitForTimeout(80)
assert.match(await desktop.locator('#interaction-prompt').textContent(), /START DEAL CLOCK/)
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(80)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.missionSnapshot())).status, 'briefing')
await desktop.keyboard.press('e')
await desktop.waitForTimeout(40)
await desktop.keyboard.press('e')
await desktop.waitForTimeout(120)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.missionSnapshot())).status, 'active')
const firstStopLabel = await desktop.locator('#minimap-label').textContent()
assert.match(firstStopLabel, /STOP 1/)

await desktop.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), dealClock.startVehicle.at)
await desktop.keyboard.press('e')
await desktop.waitForTimeout(180)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, dealClock.startVehicle.archetype)
assert.equal(await desktop.locator('#minimap-label').textContent(), firstStopLabel, 'mounting the loaner reset the active GPS stop')
await pressKey(desktop, 'Space')
await desktop.waitForTimeout(100)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  dealClock.startVehicle.archetype,
  'Space handbrake ejected the car driver'
)

let previousStop = null
for (let stopNumber = 1; stopNumber <= 4; stopNumber++) {
  const waypoint = await desktop.evaluate(() => window.RAFFI_WORLD.getWaypoint())
  assert.match(waypoint.label, new RegExp(`STOP ${stopNumber}`))
  if (previousStop) assert.notDeepEqual({ x: waypoint.x, z: waypoint.z }, previousStop)
  previousStop = { x: waypoint.x, z: waypoint.z }
  await desktop.evaluate(async ({ x, z }) => {
    const { player } = await import('/world/game/player.js')
    player.vehicle.x = x
    player.vehicle.z = z
    player.vehicle.speed = 0
    player.vehicle.mesh.position.set(x, 0, z)
  }, waypoint)
  await desktop.waitForTimeout(260)
  const stopSnapshot = await desktop.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  if (stopNumber < 4) {
    assert.equal(
      stopSnapshot.completedPoints.length,
      stopNumber,
      `GPS ${waypoint.label} did not advance (${JSON.stringify(stopSnapshot)})`
    )
  } else {
    assert.ok(
      stopSnapshot.completed.includes('deal-clock'),
      `final GPS stop did not complete DEAL CLOCK (${JSON.stringify(stopSnapshot)})`
    )
  }
}

const finished = await desktop.evaluate(() => ({
  mission: window.RAFFI_WORLD.missionSnapshot(),
  state: window.RAFFI_WORLD.getState(),
}))
assert.equal(finished.mission.active, null)
assert.ok(finished.mission.completed.includes('deal-clock'))
assert.equal(finished.state.compliance.tier, 4)

// --- COMPLIANCE pursuit / calendar catch ------------------------------------
async function advancePursuit(page, seconds, pull = false) {
  const steps = Math.ceil(seconds / 0.05)
  await page.evaluate(async ({ steps: n, pull: doPull }) => {
    const { updatePursuit, debugPullPursuersToPlayer } = await import('/world/game/pursuit.js')
    for (let i = 0; i < n; i++) {
      if (doPull) debugPullPursuersToPlayer()
      updatePursuit(0.05)
    }
  }, { steps, pull })
}

// Tier 1: drone pursues past hold without catching.
await desktop.evaluate(() => window.RAFFI_WORLD.setComplianceTier(1))
await desktop.waitForTimeout(80)
let pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.equal(pursuit.roster.kinds.drone, 1, 'tier 1 must compile one drone')
assert.equal(pursuit.roster.canCatch, 0, 'tier 1 must not be catch-capable')
await advancePursuit(desktop, 3.0, true)
pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.notEqual(pursuit.phase, 'catching', 'Tier 1 must never enter catch phase')
assert.equal(pursuit.contact.caught, false, 'Tier 1 contact must never catch')
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier, 1)

// Tier 2: catch only after full hold.
await desktop.evaluate(() => window.RAFFI_WORLD.setComplianceTier(2))
await desktop.waitForTimeout(80)
pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.equal(pursuit.roster.kinds.foot, 1)
const hold = pursuit.tuning.caughtHoldSeconds
await advancePursuit(desktop, Math.max(0.1, hold - 0.3), true)
pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.equal(pursuit.contact.caught, false, 'tier 2 must not catch before hold completes')
assert.ok(pursuit.contact.hold > 0, 'tier 2 contact hold must accumulate')
await advancePursuit(desktop, 0.5, true)
// Allow catch sequence to start
await advancePursuit(desktop, 0.2, true)
pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.ok(
  pursuit.phase === 'catching' || pursuit.phase === 'fade-out' || pursuit.phase === 'fade-in' || pursuit.phase === 'idle',
  'tier 2 full hold should enter catch sequence'
)
// Drain catch fade to restore control
for (let i = 0; i < 40; i++) {
  await advancePursuit(desktop, 0.1, false)
  pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
  if (pursuit.phase === 'idle' && (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier === 0) break
}
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier, 0, 'catch must clear COMPLIANCE')
assert.equal(pursuit.phase, 'idle', 'catch fade must complete and return control')
await desktop.screenshot({ path: OUT + '/raffi-world-pursuit-catch-desktop.png' })

// Tier 3: exactly one sedan.
await desktop.evaluate(() => window.RAFFI_WORLD.setComplianceTier(3))
await desktop.waitForTimeout(80)
pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.equal(pursuit.roster.kinds.vehicle, 1, 'tier 3 must be exactly one sedan')
assert.equal(pursuit.active.filter((a) => a.kind === 'vehicle').length, 1)
assert.ok(
  pursuit.active[0].distance > pursuit.active[0].interceptRadius,
  `sedan must not spawn already inside intercept (${pursuit.active[0].distance} vs ${pursuit.active[0].interceptRadius})`
)

// Tier 4 counts (multi-sedan surround approach — honest multi-unit chase).
await desktop.evaluate(() => window.RAFFI_WORLD.setComplianceTier(4))
await desktop.waitForTimeout(80)
pursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.equal(pursuit.roster.kinds.vehicle, 3, 'tier 4 must compile three sedans')
assert.equal(pursuit.active.filter((a) => a.kind === 'vehicle').length, 3)

// Active mission must survive a catch (restore mission-like state then catch).
await desktop.evaluate(async () => {
  const { state } = await import('/world/engine/state.js')
  state.mission.active = 'deal-clock'
  window.RAFFI_WORLD.setWaypoint({ x: 60, z: -380 }, 'DEAL CLOCK · STOP 2')
  window.RAFFI_WORLD.setComplianceTier(2)
})
await desktop.waitForTimeout(60)
const missionLabelBefore = await desktop.locator('#minimap-label').textContent()
await advancePursuit(desktop, 3.0, true)
for (let i = 0; i < 40; i++) {
  await advancePursuit(desktop, 0.1, false)
  if ((await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())).phase === 'idle') break
}
assert.equal(
  await desktop.evaluate(async () => (await import('/world/engine/state.js')).state.mission.active),
  'deal-clock',
  'catch must preserve active mission id'
)
assert.equal(
  await desktop.locator('#minimap-label').textContent(),
  missionLabelBefore,
  'catch must preserve active mission waypoint'
)
await desktop.evaluate(async () => {
  const { state } = await import('/world/engine/state.js')
  state.mission.active = null
})

// Budgets at max implemented multi-unit tier.
await desktop.evaluate(() => window.RAFFI_WORLD.setComplianceTier(4))
await desktop.waitForTimeout(100)
const pursuitBudget = await desktop.evaluate(() => window.RAFFI_WORLD.stats())
assert.ok(pursuitBudget.drawCalls < 120, `pursuit draws ${pursuitBudget.drawCalls} >= 120`)
assert.ok(pursuitBudget.triangles < 60_000, `pursuit tris ${pursuitBudget.triangles} >= 60000`)
await desktop.evaluate((g) => window.RAFFI_WORLD.setGrade(g), 'dusk')
await desktop.screenshot({ path: OUT + '/raffi-world-pursuit-desktop-dusk.png' })
await desktop.evaluate((g) => window.RAFFI_WORLD.setGrade(g), 'night')
await desktop.screenshot({ path: OUT + '/raffi-world-pursuit-desktop-night.png' })

// --- Reply All Repaint: clear COMPLIANCE after DEAL CLOCK heat ---------------
// Free-roam guidance must point at an authored shop without hardcoding coords
// in the engine (data-driven nearest shop).
await desktop.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
await desktop.waitForTimeout(120)
const repaintGuide = await desktop.evaluate(() => ({
  label: document.querySelector('#minimap-label')?.textContent,
  waypoint: window.RAFFI_WORLD.getWaypoint(),
  compliance: window.RAFFI_WORLD.getState().compliance,
}))
assert.ok(repaintGuide.compliance.tier > 0, 'DEAL CLOCK should leave nonzero COMPLIANCE for the repaint loop')
assert.match(repaintGuide.label || '', /REPLY ALL REPAINT/i, 'nonzero COMPLIANCE without active mission must route to Reply All Repaint')
assert.ok(repaintGuide.waypoint, 'repaint guidance missing waypoint')
assert.ok(
  repaintShops.some((shop) =>
    Math.hypot(shop.at.x - repaintGuide.waypoint.x, shop.at.z - repaintGuide.waypoint.z) < 0.5
  ),
  'repaint waypoint is not an authored shop from data/world.json'
)

// Stay mounted in the mission loaner (generated mesh with paint ranges).
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  dealClock.startVehicle.archetype
)

const paintBefore = await desktop.evaluate(async () => {
  const { player } = await import('/world/game/player.js')
  const color = player.vehicle.mesh.geometry.getAttribute('color')
  const range = player.vehicle.mesh.userData.paintRanges.hull
  const sample = []
  for (let i = range.start; i < Math.min(range.start + 6, range.end); i++) {
    sample.push(color.getX(i), color.getY(i), color.getZ(i))
  }
  return {
    sample,
    paint: player.vehicle.mesh.userData.paint ? [...player.vehicle.mesh.userData.paint] : null,
    archetype: player.vehicle.archetypeId,
  }
})

// Active-mission waypoint preservation: raise heat mid-mission is covered above
// via STOP labels; re-check with an explicit active run + shop teleport.
await desktop.evaluate(() => {
  window.RAFFI_WORLD.setComplianceTier(2)
})
await desktop.evaluate(async () => {
  const { startMission, missionSnapshot } = await import('/world/game/missions.js')
  // Mission already completed — use debug compliance only for foot/speed negatives.
})

// On-foot negative: exit, sit in bay, must not clear.
await pressKey(desktop, 'e')
await desktop.waitForTimeout(120)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, null)
await desktop.evaluate((shop) => {
  window.RAFFI_WORLD.setComplianceTier(3)
  window.RAFFI_WORLD.teleport(shop.at.x, shop.at.z)
}, nearestShopToSpawn)
await desktop.waitForTimeout(350)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier,
  3,
  'on-foot Reply All Repaint entry cleared COMPLIANCE'
)

// Remount generated grand tourer at the crib, then park in the bay.
const repaintCar = hub.rides.find((ride) => ride.archetype === 'grand-tourer')
await desktop.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), repaintCar.at)
await desktop.waitForTimeout(80)
await pressKey(desktop, 'e')
await desktop.waitForTimeout(150)
assert.equal((await desktop.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, 'grand-tourer')

// High-speed negative: enter bay too fast — must not clear.
await desktop.evaluate(async (shop) => {
  const { player } = await import('/world/game/player.js')
  const { updateCompliance } = await import('/world/game/compliance.js')
  player.vehicle.x = shop.at.x
  player.vehicle.z = shop.at.z
  player.vehicle.speed = 12
  player.vehicle.mesh.position.set(shop.at.x, 0, shop.at.z)
  const { state } = await import('/world/engine/state.js')
  state.player.x = shop.at.x
  state.player.z = shop.at.z
  state.player.speed = 12
  updateCompliance(0.016)
}, nearestShopToSpawn)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier,
  3,
  'high-speed bay drive-through cleared COMPLIANCE'
)

// Honest clear: crawl into bay with heat.
const paintMountedBefore = await desktop.evaluate(async () => {
  const { player } = await import('/world/game/player.js')
  const color = player.vehicle.mesh.geometry.getAttribute('color')
  const range = player.vehicle.mesh.userData.paintRanges.hull
  const sample = []
  for (let i = range.start; i < Math.min(range.start + 8, range.end); i++) {
    sample.push(color.getX(i), color.getY(i), color.getZ(i))
  }
  return { sample, paint: player.vehicle.mesh.userData.paint ? [...player.vehicle.mesh.userData.paint] : null }
})

await desktop.evaluate(async (shop) => {
  const { player } = await import('/world/game/player.js')
  const { updateCompliance } = await import('/world/game/compliance.js')
  player.vehicle.x = shop.at.x
  player.vehicle.z = shop.at.z
  player.vehicle.speed = 0.4
  player.vehicle.mesh.position.set(shop.at.x, 0, shop.at.z)
  const { state } = await import('/world/engine/state.js')
  state.player.x = shop.at.x
  state.player.z = shop.at.z
  state.player.speed = 0.4
  updateCompliance(0.016)
}, nearestShopToSpawn)
await desktop.waitForTimeout(80)

const cleared = await desktop.evaluate(async () => {
  const { player } = await import('/world/game/player.js')
  const color = player.vehicle.mesh.geometry.getAttribute('color')
  const range = player.vehicle.mesh.userData.paintRanges.hull
  const sample = []
  for (let i = range.start; i < Math.min(range.start + 8, range.end); i++) {
    sample.push(color.getX(i), color.getY(i), color.getZ(i))
  }
  return {
    compliance: window.RAFFI_WORLD.getState().compliance,
    snap: window.RAFFI_WORLD.complianceSnapshot(),
    sample,
    paint: player.vehicle.mesh.userData.paint ? [...player.vehicle.mesh.userData.paint] : null,
    pipsOn: [...document.querySelectorAll('#compliance .cl-pips i.on')].length,
  }
})
assert.equal(cleared.compliance.tier, 0, 'parked repaint did not reset COMPLIANCE tier')
assert.equal(cleared.compliance.heat, 0, 'parked repaint did not reset COMPLIANCE heat')
assert.equal(cleared.pipsOn, 0, 'HUD COMPLIANCE pips did not clear')
assert.ok(cleared.snap.clearCount >= 1, 'compliance clear was not counted')
const paintChanged =
  JSON.stringify(cleared.sample) !== JSON.stringify(paintMountedBefore.sample) ||
  JSON.stringify(cleared.paint) !== JSON.stringify(paintMountedBefore.paint)
assert.ok(
  paintChanged && cleared.paint,
  'vehicle colour buffer / paint metadata did not change after Reply All Repaint'
)
const afterRepaintPursuit = await desktop.evaluate(() => window.RAFFI_WORLD.pursuitSnapshot())
assert.equal(
  afterRepaintPursuit.active.length,
  0,
  'repaint must cancel pursuit and despawn active pursuers'
)
assert.equal(afterRepaintPursuit.phase, 'idle', 'repaint must leave pursuit idle')

// One-shot latch: remain stopped with re-applied heat — no second clear.
await desktop.evaluate(() => window.RAFFI_WORLD.setComplianceTier(2))
await desktop.evaluate(async () => {
  const { updateCompliance } = await import('/world/game/compliance.js')
  updateCompliance(0.016)
})
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier,
  2,
  'remaining in the bay re-triggered clear while latched'
)

// Leave bay, re-enter with heat — second clear allowed.
await desktop.evaluate(async (shop) => {
  const { player } = await import('/world/game/player.js')
  const { updateCompliance } = await import('/world/game/compliance.js')
  const { state } = await import('/world/engine/state.js')
  const x = shop.at.x + 40
  const z = shop.at.z
  player.vehicle.x = x
  player.vehicle.z = z
  player.vehicle.speed = 0.2
  player.vehicle.mesh.position.set(x, 0, z)
  state.player.x = x
  state.player.z = z
  updateCompliance(0.016)
}, nearestShopToSpawn)
await desktop.evaluate(async (shop) => {
  const { player } = await import('/world/game/player.js')
  const { updateCompliance } = await import('/world/game/compliance.js')
  const { state } = await import('/world/engine/state.js')
  player.vehicle.x = shop.at.x
  player.vehicle.z = shop.at.z
  player.vehicle.speed = 0.2
  player.vehicle.mesh.position.set(shop.at.x, 0, shop.at.z)
  state.player.x = shop.at.x
  state.player.z = shop.at.z
  updateCompliance(0.016)
}, nearestShopToSpawn)
assert.equal(
  (await desktop.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier,
  0,
  're-entry with COMPLIANCE did not clear after leave'
)

// Active mission waypoint must not be overwritten by repaint guidance.
await desktop.evaluate(() => window.RAFFI_WORLD.setComplianceTier(3))
await desktop.evaluate(async () => {
  // Force an active mission snapshot waypoint via public API if possible.
  const snap = window.RAFFI_WORLD.missionSnapshot()
  if (!snap.completed.includes('deal-clock')) return
})
// Use setWaypoint after marking mission active through state for the guard.
const missionLabel = 'DEAL CLOCK · STOP 1'
await desktop.evaluate(async (label) => {
  const { state } = await import('/world/engine/state.js')
  state.mission.active = 'deal-clock'
  window.RAFFI_WORLD.setWaypoint({ x: 60, z: -380 }, label)
  const { updateCompliance } = await import('/world/game/compliance.js')
  updateCompliance(0.016)
}, missionLabel)
assert.equal(
  await desktop.locator('#minimap-label').textContent(),
  missionLabel,
  'repaint guidance overwrote an active mission waypoint'
)
await desktop.evaluate(async () => {
  const { state } = await import('/world/engine/state.js')
  state.mission.active = null
})

// Visual evidence at a generated shop — dusk + night, desktop.
for (const grade of ['dusk', 'night']) {
  await desktop.evaluate(async (payload) => {
    window.RAFFI_WORLD.setGrade(payload.grade)
    const { player } = await import('/world/game/player.js')
    const { state } = await import('/world/engine/state.js')
    player.vehicle.x = payload.shop.at.x
    player.vehicle.z = payload.shop.at.z
    player.vehicle.speed = 0
    player.vehicle.mesh.position.set(payload.shop.at.x, 0, payload.shop.at.z)
    state.player.x = payload.shop.at.x
    state.player.z = payload.shop.at.z
  }, { grade, shop: nearestShopToSpawn })
  await desktop.waitForTimeout(80)
  await desktop.screenshot({ path: OUT + `/raffi-world-repaint-desktop-${grade}.png` })
}

const budgets = await desktop.evaluate(() => window.RAFFI_WORLD.stats())
assert.ok(budgets.drawCalls < 120, `draw calls ${budgets.drawCalls} >= 120`)
assert.ok(budgets.triangles < 60_000, `triangles ${budgets.triangles} >= 60000`)

await desktop.screenshot({ path: OUT + '/raffi-world-onboarding-desktop.png' })
await desktopContext.close()

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
})
const mobile = await readyPage(mobileContext)
await mobile.addStyleTag({ content: '#debug { display: none !important; }' })
const mobileInitial = await mobile.evaluate(() => ({
  objective: document.querySelector('#objective')?.textContent,
  distance: document.querySelector('#minimap-distance')?.textContent,
}))
assert.match(mobileInitial.objective, /CHOOSE A RIDE OR TAKE THE SUBWAY/)
assert.ok(Number.parseInt(mobileInitial.distance, 10) < 100, `opening walk is too far (${mobileInitial.distance})`)
assert.equal(await mobile.locator('#btn-pause').isVisible(), true, 'touch viewport has no way to open pause')
const mobilePauseBox = await mobile.locator('#btn-pause').boundingBox()
assert.ok(
  mobilePauseBox && mobilePauseBox.x >= 0 && mobilePauseBox.y >= 0 &&
    mobilePauseBox.x + mobilePauseBox.width <= 390 && mobilePauseBox.y + mobilePauseBox.height <= 844,
  `touch pause control is out of bounds (${JSON.stringify(mobilePauseBox)})`
)
await mobile.locator('#btn-pause').tap()
await mobile.waitForTimeout(80)
assert.equal(
  await mobile.evaluate(async () => (await import('/world/engine/state.js')).state.paused),
  true,
  'touch PAUSE control did not pause the game'
)
assert.equal(await mobile.locator('#pause').isVisible(), true)
await mobile.screenshot({ path: OUT + '/raffi-world-pause-mobile.png' })
await mobile.locator('[data-pause="resume"]').tap()
await mobile.waitForTimeout(80)
assert.equal(
  await mobile.evaluate(async () => (await import('/world/engine/state.js')).state.paused),
  false,
  'touch RESUME control did not unpause the game'
)
assert.equal(await mobile.locator('#pause').isVisible(), false)
await mobile.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), board.at)
await mobile.waitForTimeout(80)
const promptLayout = await mobile.evaluate(() => {
  const box = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON()
  return { prompt: box('#interaction-prompt'), action: box('#btn-action') }
})
const promptActionOverlap =
  Math.min(promptLayout.prompt.right, promptLayout.action.right) >
    Math.max(promptLayout.prompt.left, promptLayout.action.left) &&
  Math.min(promptLayout.prompt.bottom, promptLayout.action.bottom) >
    Math.max(promptLayout.prompt.top, promptLayout.action.top)
assert.equal(
  promptActionOverlap,
  false,
  `mobile ride prompt overlaps its action button (${JSON.stringify(promptLayout)})`
)
await mobile.locator('#btn-action').tap()
await mobile.waitForTimeout(180)
assert.equal((await mobile.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, 'skateboard')

assert.equal(await mobile.locator('#btn-exit').isVisible(), true)
await mobile.locator('#btn-exit').tap()
await mobile.waitForTimeout(100)
assert.equal(
  (await mobile.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  null,
  'fresh touch skateboard mount ignored its visible EXIT button'
)
await mobile.locator('#btn-action').tap()
await mobile.waitForTimeout(100)
assert.equal(
  (await mobile.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle,
  'skateboard',
  'touch could not remount the same skateboard after exit'
)

// Ride/manager captions are nonblocking: they must not turn GAS into NEXT or
// hide the driving controls while the mission clock continues.
assert.match(await mobile.locator('#btn-action').textContent(), /KICK/)
assert.equal((await mobile.locator('#touch').getAttribute('class') || '').includes('dialogue'), false)
assert.equal(await mobile.locator('#btn-second').isVisible(), true)
assert.equal(await mobile.locator('#btn-radio').isVisible(), true)
assert.equal(await mobile.locator('#btn-cam').isVisible(), true)
const beforeMobileGas = await mobile.evaluate(() => window.RAFFI_WORLD.getState().player)
await mobile.locator('#btn-action').dispatchEvent('mousedown', { button: 0 })
await mobile.waitForTimeout(1100)
await mobile.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })))
await mobile.waitForTimeout(120)
const afterMobileGas = await mobile.evaluate(() => window.RAFFI_WORLD.getState().player)
assert.equal((await mobile.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, 'skateboard', 'touch GAS ejected rider')
assert.ok(
  Math.hypot(afterMobileGas.x - beforeMobileGas.x, afterMobileGas.z - beforeMobileGas.z) > 0.7,
  'nonblocking caption stole mobile throttle'
)
assert.equal(await mobile.locator('#btn-exit').isVisible(), true)
await mobile.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
await mobile.locator('#btn-exit').tap()
await mobile.waitForTimeout(180)
assert.equal((await mobile.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, null)

await mobile.evaluate(async () => {
  const { bus } = await import('/world/engine/state.js')
  bus.emit('dialogue', { id: 'garage-choice', blocking: true })
})
await mobile.waitForTimeout(250)
assert.equal(await mobile.locator('#touch').getAttribute('class'), 'dialogue')
assert.equal(await mobile.locator('#btn-second').isVisible(), false)
assert.equal(await mobile.locator('#btn-radio').isVisible(), false)
assert.equal(await mobile.locator('#btn-cam').isVisible(), false)
const mobileLayout = await mobile.evaluate(() => {
  const rect = (selector) => {
    const box = document.querySelector(selector).getBoundingClientRect()
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
  }
  return { map: rect('#minimap'), dialogue: rect('#subtitle'), action: rect('#btn-action') }
})
assert.ok(mobileLayout.map.left >= 0 && mobileLayout.map.right <= 390)
assert.ok(mobileLayout.dialogue.left >= 0 && mobileLayout.dialogue.right <= 390)
assert.ok(
  mobileLayout.dialogue.bottom < mobileLayout.action.top,
  `dialogue overlaps touch action button (${JSON.stringify(mobileLayout)})`
)
await mobile.screenshot({ path: OUT + '/raffi-world-onboarding-mobile.png' })

// Reply All Repaint visual check on 390×844 — car in bay, dusk/night grades.
await mobile.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
const mobileCar = hub.rides.find((ride) => ride.archetype === 'grand-tourer')
await mobile.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), mobileCar.at)
await mobile.waitForTimeout(80)
await mobile.locator('#btn-action').tap()
await mobile.waitForTimeout(150)
assert.equal((await mobile.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, 'grand-tourer')
await mobile.evaluate(() => window.RAFFI_WORLD.setComplianceTier(2))
await mobile.evaluate(async (shop) => {
  const { player } = await import('/world/game/player.js')
  const { updateCompliance } = await import('/world/game/compliance.js')
  const { state } = await import('/world/engine/state.js')
  player.vehicle.x = shop.at.x
  player.vehicle.z = shop.at.z
  player.vehicle.speed = 0.3
  player.vehicle.mesh.position.set(shop.at.x, 0, shop.at.z)
  state.player.x = shop.at.x
  state.player.z = shop.at.z
  updateCompliance(0.016)
}, nearestShopToSpawn)
assert.equal((await mobile.evaluate(() => window.RAFFI_WORLD.getState())).compliance.tier, 0)
for (const grade of ['dusk', 'night']) {
  await mobile.evaluate((g) => window.RAFFI_WORLD.setGrade(g), grade)
  await mobile.waitForTimeout(60)
  await mobile.screenshot({ path: OUT + `/raffi-world-repaint-mobile-${grade}.png` })
}

await mobileContext.close()

assert.deepEqual(errors, [])
console.info('RAFFI WORLD onboarding smoke: pause, rides, subway, DEAL CLOCK, Reply All Repaint, and mobile controls passed')
} finally {
  await browser.close()
}
