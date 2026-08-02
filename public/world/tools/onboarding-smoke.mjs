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
await desktop.waitForTimeout(60)
const gradeButton = desktop.locator('[data-pause="grade"]')
assert.equal(
  await desktop.evaluate(() => document.activeElement?.getAttribute('data-pause')),
  'resume',
  'pause did not focus RESUME on open'
)
await desktop.keyboard.press('Tab')
await desktop.waitForTimeout(30)
assert.equal(
  await desktop.evaluate(() => document.activeElement?.getAttribute('data-pause')),
  'grade',
  'Tab closed pause instead of moving focus to the next available control'
)
assert.equal(await desktop.evaluate(async () => (await import('/world/engine/state.js')).state.paused), true)
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
for (const action of ['rewind', 'map', 'quit']) {
  const deferred = desktop.locator(`[data-pause="${action}"]`)
  assert.equal(await deferred.isDisabled(), true, `deferred pause action ${action} still presents as enabled`)
  assert.match(await deferred.textContent(), /COMING SOON/)
}
await desktop.keyboard.press('Escape')
await desktop.waitForTimeout(60)
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
await mobileContext.close()

assert.deepEqual(errors, [])
console.info('RAFFI WORLD onboarding smoke: pause, immediate/moving ride remounts, subway, DEAL CLOCK, and mobile controls passed')
} finally {
  await browser.close()
}
