#!/usr/bin/env node

/** Real boot and keyboard journey. Engine imports below are read-only observers. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-playable-journey'
const worldData = JSON.parse(await fs.readFile(new URL('../data/world.json', import.meta.url), 'utf8'))
const transitName = worldData.landmarks.find((landmark) => landmark.type === 'mobility-hub').transit.name
const vehicles = JSON.parse(await fs.readFile(new URL('../data/vehicles.json', import.meta.url), 'utf8'))
await fs.mkdir(OUT, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])],
})
const startedAt = Date.now()
const report = { checks: [], samples: [], errors: [] }
let page
let touchSession = null
let platform = 'desktop'

async function observe() {
  return page.evaluate(() => {
    const { state, basis, missionSnapshot, isDialogueBlocking } = window.__JOURNEY_OBSERVERS__
    return {
      player: { ...state.player },
      time: state.time,
      frame: state.frame,
      camera: state.camera.mode,
      basis: basis(),
      mission: missionSnapshot(),
      dialogue: document.querySelector('#subtitle').classList.contains('show'),
      blocking: isDialogueBlocking(),
      paused: state.paused,
      stats: { ...state.stats },
      prompt: document.querySelector('#interaction-prompt').textContent.trim(),
    }
  })
}

async function frames(count = 2) {
  const target = (await observe()).frame + count
  await page.waitForFunction((frame) => window.__JOURNEY_OBSERVERS__.state.frame >= frame, target, { timeout: 30_000 })
}

async function hold(keys, seconds) {
  const target = (await observe()).time + seconds
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.waitForFunction((time) => window.__JOURNEY_OBSERVERS__.state.time >= time, target, { timeout: 30_000 })
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key)
  }
}

async function press(key) {
  await page.keyboard.press(key)
  await frames()
}

async function touchHold(selector, seconds) {
  const rect = await page.locator(selector).boundingBox()
  assert.ok(rect, `${selector} is not visible for touch input`)
  const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  try { await hold([], seconds) }
  finally { await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
  await frames()
}

async function action() {
  if (touchSession) { await page.locator('#btn-action').tap(); await frames() }
  else await press('e')
}

async function exitRide() {
  if (touchSession) { await page.locator('#btn-exit').tap(); await frames() }
  else await press('e')
}

async function walkInput(horizontal, forward, seconds) {
  if (!touchSession) {
    const keys = []
    if (horizontal > 0.32) keys.push('d')
    else if (horizontal < -0.32) keys.push('a')
    if (forward > 0.32) keys.push('w')
    else if (forward < -0.32) keys.push('s')
    await hold(keys, seconds)
    return
  }
  const rect = await page.locator('#stick-zone').boundingBox()
  const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  try {
    await touchSession.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ ...start, x: start.x + horizontal * 52, y: start.y - forward * 52 }],
    })
    await hold([], seconds)
  } finally {
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
}

async function finishCall() {
  for (let i = 0; i < 140 && (await observe()).dialogue; i++) {
    if ((await observe()).blocking) await action()
    else await hold([], 0.3)
  }
  assert.equal((await observe()).dialogue, false, 'normal E input did not finish the call')
}

// Choose among the same eight directions available to a keyboard player. We
// observe position to stop near a landmark; never teleport, inject controls,
// advance simulation time, bypass collision or alter mission state.
async function walkTo(x, z, radius = 1.1) {
  const started = await observe()
  let lastDistance = Infinity
  let stuck = 0
  for (let i = 0; i < 140; i++) {
    const sample = await observe()
    const dx = x - sample.player.x, dz = z - sample.player.z
    const distance = Math.hypot(dx, dz)
    if (i > 0 && i % 30 === 0) process.stdout.write(`Journey ${platform}: walking to ${x},${z}; ${distance.toFixed(1)} m left\n`)
    if (distance <= radius) {
      await hold([], 0.15)
      return
    }
    const { rx, rz, fx, fz } = sample.basis
    const horizontal = (dx * rx + dz * rz) / distance
    const forward = (dx * fx + dz * fz) / distance
    await walkInput(horizontal, forward, Math.min(0.22, Math.max(0.06, (distance - radius) / 4)))
    stuck = distance >= lastDistance - 0.02 ? stuck + 1 : 0
    lastDistance = distance
    assert.ok(stuck < 20, `walking path blocked toward ${x},${z}: ${JSON.stringify(sample)}`)
  }
  assert.fail(`could not walk from ${JSON.stringify(started.player)} to ${x},${z}`)
}

async function checkpoint(label) {
  const sample = await observe()
  report.samples.push({ platform, label, ...sample })
  await page.screenshot({ path: `${OUT}/${platform}-${label}.png` })
  process.stdout.write(`Journey ${platform}: ${label}\n`)
}

try {
for (const device of [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
].filter((device) => !process.env.RAFFI_JOURNEY_DEVICE || device.name === process.env.RAFFI_JOURNEY_DEVICE)) {
  platform = device.name
  const { name, ...options } = device
  const context = await browser.newContext({ ...options, ...(process.env.RAFFI_RECORD_VIDEO === "1" ? { recordVideo: { dir: OUT + "/video", size: options.viewport } } : {}) })
  page = await context.newPage()
  touchSession = device.hasTouch ? await context.newCDPSession(page) : null
  page.on('pageerror', (error) => report.errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(message.text())
  })
  page.on('requestfailed', (request) => report.errors.push(`${request.url()}: ${request.failure()?.errorText}`))
  const url = new URL(BASE)
  url.searchParams.set('seed', 'FIXED')
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120_000 })
  assert.equal(await page.evaluate(() => Boolean(window.RAFFI_WORLD)), false, 'journey accidentally enabled the debug API')
  if (touchSession) await page.locator('#boot-start').tap()
  else await page.locator('#boot-start').click()
  await page.locator('#hud').waitFor({ state: 'visible' })
  await page.evaluate(async () => {
    const { state } = await import('/world/engine/state.js')
    const { movementBasis } = await import('/world/engine/camera.js')
    const { missionSnapshot } = await import('/world/game/missions.js')
    const { isDialogueBlocking } = await import('/world/game/dialogue.js')
    window.__JOURNEY_OBSERVERS__ = { state, basis: movementBasis, missionSnapshot, isDialogueBlocking }
  })
  await frames()
  await finishCall()
  await checkpoint('01-spawn')
  report.checks.push(`${platform}: Manual boot button, readable first frame, opening call accepted through normal input, no debug API`)

  // Go around the greeter, approach the authored skateboard on foot.
  await walkTo(-455, -151)
  await walkTo(-461, -144)
  await walkTo(-465.5, -144.5, 1)
  assert.match((await observe()).prompt, /RIDE SKATEBOARD/)
  await action()
  assert.equal((await observe()).player.vehicle, 'skateboard')
  await finishCall()
  const boardStart = (await observe()).player
  if (touchSession) await touchHold('#btn-action', 1.8)
  else await hold(['w'], 1.8)
  const boardEnd = (await observe()).player
  assert.ok(Math.hypot(boardEnd.x - boardStart.x, boardEnd.z - boardStart.z) > 3, 'mounted skateboard did not move through real keyboard input')
  if (touchSession) await exitRide()
  else await press('Space')
  assert.equal((await observe()).player.vehicle, null)
  await checkpoint('02-skateboard')
  report.checks.push(`${platform}: Walk around spawn NPC to garage, mount skateboard, ride through normal throttle, dismount`)

  await finishCall()
  await walkTo(-460, -136)
  await walkTo(-457, -137, 1)
  assert.ok((await observe()).prompt.includes(transitName), `Expected ${transitName}: ${(await observe()).prompt}`)
  await action()
  await page.locator('#travel').waitFor({ state: 'visible' })
  await page.locator('#travel').waitFor({ state: 'hidden', timeout: 15_000 })
  await finishCall()
  await frames()
  assert.match((await observe()).prompt, /START DEAL CLOCK/)
  await action()
  assert.equal((await observe()).mission.status, 'briefing')
  await finishCall()
  assert.equal((await observe()).mission.status, 'active')
  await checkpoint('03-mission')
  report.checks.push(`${platform}: Walk from parked board to subway, use visible transit, accept first mission through its marker and call`)

  await walkTo(66, -257)
  await walkTo(70, -258, 0.55)
  assert.ok((await observe()).prompt.includes(vehicles.archetypes.compact.label.toUpperCase()), `loaner interaction unavailable: ${JSON.stringify(await observe())}`)
  await action()
  assert.equal((await observe()).player.vehicle, 'compact')
  await finishCall()
  const carStart = (await observe()).player
  if (touchSession) await touchHold('#btn-action', 1.5)
  else await hold(['w'], 1.5)
  const carEnd = (await observe()).player
  assert.ok(Math.hypot(carEnd.x - carStart.x, carEnd.z - carStart.z) > 3, 'mission loaner cannot leave its spawn under normal gas input')
  await checkpoint('04-driving')
  report.checks.push(`${platform}: Reach mission loaner on foot, mount through visible action, drive out under normal gas input`)

  // Pause freezes both the real driving physics and the mission clock. Resume
  // must restore input without leaving the throttle stuck from a touch hold.
  if (touchSession) await page.locator('#btn-pause').tap()
  else await press('Escape')
  await page.locator('#pause').waitFor({ state: 'visible' })
  const paused = await observe()
  await page.waitForTimeout(350)
  const stillPaused = await observe()
  assert.equal(stillPaused.time, paused.time, 'pause advanced simulation time')
  assert.deepEqual(stillPaused.player, paused.player, 'pause advanced driving physics')
  if (touchSession) await page.locator('[data-pause="resume"]').tap()
  else await page.locator('[data-pause="resume"]').click()
  await page.locator('#pause').waitFor({ state: 'hidden' })
  await frames()
  assert.equal((await observe()).paused, false)

  const initialMode = (await observe()).camera
  const modes = new Set([initialMode])
  for (let i = 0; i < 4; i++) {
    if (touchSession) { await page.locator('#btn-cam').tap(); await frames() }
    else await press('c')
    modes.add((await observe()).camera)
  }
  assert.deepEqual([...modes].sort(), ['birds', 'chase', 'classic', 'free'])
  assert.equal((await observe()).camera, initialMode)
  await checkpoint('05-pause-and-cameras')
  report.checks.push(`${platform}: Pause freezes mission and moving car, resume restores play, all four camera modes cycle through normal controls`)
  assert.deepEqual(report.errors, [])
  await context.close()
}
  process.stdout.write(`Playable journey passed: ${report.checks.length} stages\n`)
} catch (error) {
  report.failure = error.stack || error.message
  report.failureSample = await observe().catch(() => null)
  if (page) await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {})
  throw error
} finally {
  report.elapsedWallSeconds = (Date.now() - startedAt) / 1000
  await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
