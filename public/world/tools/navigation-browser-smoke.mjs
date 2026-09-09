#!/usr/bin/env node

/** Subway entry-position fixtures only; map, travel, mission and activity choices use real UI/E. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'

const world = JSON.parse(await fs.readFile(new URL('../data/world.json', import.meta.url), 'utf8'))
const missions = JSON.parse(await fs.readFile(new URL('../data/missions.json', import.meta.url), 'utf8')).missions
const hub = world.landmarks.find(item => item.type === 'mobility-hub')
const places = ['sports', 'print'].map(kind => world.activityPlaces.find(item => item.kind === kind))
assert.ok(hub?.transit && places.every(Boolean), 'Authored subway and both activity destinations are required')
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-navigation-browser'
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html')
for (const [key, value] of Object.entries({ debug: '1', seed: 'FIXED', tier: process.env.RAFFI_TIER || 'low', hour: '14' })) url.searchParams.set(key, value)
for (const key of ['auto', 'to', 'cheat']) url.searchParams.delete(key)

async function fingerprint() {
  const hash = createHash('sha256'), root = new URL('../', import.meta.url)
  async function visit(path) {
    for (const entry of (await fs.readdir(new URL(path, root), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path + entry.name
      if (entry.isDirectory()) await visit(name + '/')
      else if (entry.isFile()) { hash.update(name); hash.update(await fs.readFile(new URL(name, root))) }
    }
  }
  for (const directory of ['engine/', 'game/', 'gen/', 'data/', 'vendor/', 'assets/']) await visit(directory)
  for (const file of ['index.html', 'style.css']) { hash.update(file); hash.update(await fs.readFile(new URL(file, root))) }
  return hash.digest('hex')
}

const report = {
  startedAt: new Date().toISOString(), contentHash: await fingerprint(), url: url.href,
  scope: 'Navigation regression with disclosed subway position fixtures; not an uncut walking journey or a performance benchmark.',
  fixtures: [], checks: [], samples: [], errors: [], videos: [], keyboardPresses: 0,
}
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] })
let context, page, scenario

async function observe() {
  return page.evaluate(() => {
    const { state, movementBasis, getWaypoint, missionSnapshot, isDialogueActive, isDialogueBlocking } = window.__NAV_OBSERVERS__
    return {
      time: state.time, frame: state.frame, player: { ...state.player }, mode: state.mode,
      paused: state.paused, interior: state.interior?.id || null,
      waypoint: getWaypoint(), savedNavigation: structuredClone(state.navigation.waypoint),
      mission: missionSnapshot(), basis: movementBasis(), dialogue: isDialogueActive(), blocking: isDialogueBlocking(),
      prompt: document.querySelector('#interaction-prompt')?.textContent.trim(),
      objective: document.querySelector('#objective')?.textContent.trim(),
      minimap: document.querySelector('#minimap')?.getAttribute('aria-label'),
    }
  })
}

async function frames(count = 2) {
  const target = (await observe()).frame + count
  await page.waitForFunction(frame => window.__NAV_OBSERVERS__.state.frame >= frame, target, { timeout: 30_000 })
}

async function hold(keys, seconds) {
  const target = (await observe()).time + seconds
  for (const key of keys) await page.keyboard.down(key)
  try { await page.waitForFunction(time => window.__NAV_OBSERVERS__.state.time >= time, target, { timeout: 30_000 }) }
  finally { for (const key of [...keys].reverse()) await page.keyboard.up(key) }
}

async function press(key) { report.keyboardPresses++; await page.keyboard.press(key) }

async function finishDialogue() {
  for (let i = 0; i < 180 && (await observe()).dialogue; i++) {
    if ((await observe()).blocking) { await press('e'); await frames() }
    else await hold([], .25)
  }
  assert.equal((await observe()).dialogue, false, 'Dialogue did not finish through real E/timed playback')
}

async function closeContext() {
  if (!context) return
  const video = page.video()
  await context.close()
  if (video) report.videos.push({ scenario, path: await video.path() })
  context = null
}

async function boot(name) {
  await closeContext()
  scenario = name
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(process.env.RAFFI_RECORD_VIDEO === '1' ? { recordVideo: { dir: out + '/video', size: { width: 1280, height: 900 } } } : {}) })
  page = await context.newPage()
  page.on('pageerror', error => report.errors.push({ scenario: name, error: error.message }))
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ scenario: name, error: message.text() }) })
  page.on('response', response => { if (response.status() >= 400) report.errors.push({ scenario: name, error: `${response.status()} ${response.url()}` }) })
  page.on('requestfailed', request => report.errors.push({ scenario: name, error: `${request.url()}: ${request.failure()?.errorText}` }))
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120_000 })
  await page.locator('#boot-start').click()
  await page.evaluate(async () => {
    const [{ state }, { movementBasis }, { getWaypoint }, { missionSnapshot }, { isDialogueActive, isDialogueBlocking }] = await Promise.all([
      import('/world/engine/state.js'), import('/world/engine/camera.js'), import('/world/game/hud.js'), import('/world/game/missions.js'), import('/world/game/dialogue.js'),
    ])
    window.__NAV_OBSERVERS__ = { state, movementBasis, getWaypoint, missionSnapshot, isDialogueActive, isDialogueBlocking }
  })
  await frames(3)
  await finishDialogue()
  assert.equal((await observe()).mission.active, null)
}

async function checkpoint(label) {
  report.samples.push({ scenario, label, ...await observe() })
  await page.screenshot({ path: `${out}/${scenario}-${label}.png` })
  process.stdout.write(`Navigation ${scenario}: ${label}\n`)
}

async function subwayFixture() {
  const before = await observe()
  assert.equal(before.mode, 'foot')
  assert.equal(before.paused, false)
  // Two metres west is the existing normal-input journey's clear subway approach.
  const at = { x: hub.transit.at.x - 2, z: hub.transit.at.z }
  report.fixtures.push({ scenario, reason: 'Skip the walk back to the only subway entrance', before: before.player, at, api: 'RAFFI_WORLD.teleport(x,z); no fly, navigation, mission, clock or collision mutations' })
  await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), at)
  await frames(3)
  assert.deepEqual((await observe()).waypoint, before.waypoint, 'Subway position fixture changed navigation')
  assert.ok((await observe()).prompt.includes(hub.transit.name), `Missing actual subway prompt: ${JSON.stringify(await observe())}`)
}

async function openMap() {
  await press('Escape')
  await page.locator('#pause').waitFor({ state: 'visible' })
  await page.locator('[data-pause="map"]').click()
  await page.locator('#world-map').waitFor({ state: 'visible' })
  assert.equal((await observe()).paused, true)
}

async function closeMap() {
  await page.locator('#world-map-back').click()
  await page.locator('#pause').waitFor({ state: 'visible' })
  await page.locator('[data-pause="resume"]').click()
  await page.locator('#pause').waitFor({ state: 'hidden' })
  await frames()
}

async function selectPlace(place) {
  await openMap()
  await page.locator('#world-map-places').getByRole('button', { name: place.name, exact: true }).click()
  const expected = { ...place.at, label: place.name, source: 'map' }, sample = await observe()
  assert.deepEqual(sample.waypoint, expected)
  assert.deepEqual(sample.savedNavigation, expected)
  assert.ok((await page.locator('#world-map-notice').textContent()).includes('Route set: ' + place.name))
  await checkpoint('map-' + place.kind)
  await closeMap()
  return expected
}

function assertLandArrival(sample, destination) {
  const p = sample.player, b = world.bounds
  assert.ok([p.x, p.y, p.z].every(Number.isFinite), 'Arrival has nonfinite position')
  assert.ok(p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ, 'Arrival outside world bounds')
  assert.ok(!world.harbor.some(h => p.x > h.minX && p.x < h.maxX && p.z > h.minZ && p.z < h.maxZ), 'Arrival inside authored water')
  assert.ok(Math.hypot(p.x - destination.x, p.z - destination.z) <= 12, `Arrival missed destination: ${JSON.stringify(sample)}`)
  assert.equal(sample.mode, 'foot')
  assert.equal(sample.interior, null)
}

async function takeSubway(destination) {
  await press('e')
  await page.locator('#travel').waitFor({ state: 'visible', timeout: 10_000 })
  assert.equal(await page.locator('#travel-destination').textContent(), 'NEXT STOP · ' + destination.label)
  await page.locator('#travel').waitFor({ state: 'hidden', timeout: 15_000 })
  await finishDialogue()
  await frames(3)
  const arrived = await observe()
  assertLandArrival(arrived, destination)
  assert.deepEqual(arrived.waypoint, destination, 'Subway replaced the selected destination')
  await checkpoint('arrival-' + (destination.source === 'map' ? 'map' : 'mission'))
  return arrived
}

// Read position and camera basis to choose ordinary WASD. Collision and time run normally.
async function walkTo(x, z, radius = .65) {
  let lastDistance = Infinity, stuck = 0
  for (let i = 0; i < 180; i++) {
    const sample = await observe(), dx = x - sample.player.x, dz = z - sample.player.z, distance = Math.hypot(dx, dz)
    if (distance <= radius) { await hold([], .1); return }
    const { rx, rz, fx, fz } = sample.basis, horizontal = (dx * rx + dz * rz) / distance, forward = (dx * fx + dz * fz) / distance
    const keys = []
    if (horizontal > .32) keys.push('d'); else if (horizontal < -.32) keys.push('a')
    if (forward > .32) keys.push('w'); else if (forward < -.32) keys.push('s')
    await hold(keys, Math.min(.22, Math.max(.06, (distance - radius) / 4)))
    stuck = distance >= lastDistance - .02 ? stuck + 1 : 0
    lastDistance = distance
    assert.ok(stuck < 20, `Arrival walking route blocked toward ${x},${z}: ${JSON.stringify(sample)}`)
  }
  assert.fail(`Could not walk to ${x},${z}`)
}

try {
  await boot('default-and-mission')
  const original = (await observe()).waypoint
  assert.deepEqual(original, { ...hub.marker, label: hub.name }, 'Fresh boot should still offer the garage without a manual map source')
  await subwayFixture()
  const offeredId = (await observe()).mission.offered
  const offered = missions.find(item => item.id === offeredId)
  assert.ok(offered, 'No offered mission in a fresh game')
  const missionDestination = { ...offered.marker, label: offered.name }
  await takeSubway(missionDestination)
  assert.ok((await observe()).prompt.includes('START ' + offered.name))
  report.checks.push('Fresh garage focus is replaced by the available mission when the subway is used without a manual map pin')

  await press('e')
  await frames()
  assert.equal((await observe()).mission.status, 'briefing')
  await finishDialogue()
  assert.equal((await observe()).mission.status, 'active')
  await openMap()
  const active = await observe()
  for (const place of places) {
    await page.locator('#world-map-places').getByRole('button', { name: place.name, exact: true }).click()
    assert.match(await page.locator('#world-map-notice').textContent(), /active mission keeps its route/i)
    assert.deepEqual((await observe()).waypoint, active.waypoint)
    assert.deepEqual((await observe()).mission, active.mission, 'Map selection changed the paused mission')
  }
  await checkpoint('mission-refuses-map')
  await closeMap()
  report.checks.push('Mission accepted through actual marker/E and briefing; park and print map selections both refuse to replace its route')

  await boot('manual-map')
  for (const place of places) {
    await subwayFixture()
    const destination = await selectPlace(place)
    const arrival = await takeSubway(destination)
    assert.equal((await observe()).mission.active, null)
    if (place.kind === 'sports') {
      await walkTo(place.at.x, place.at.z - 2.5)
      assert.match((await observe()).prompt, /Talk to Jules/i)
      await press('e')
      await page.locator('#park-sports').waitFor({ state: 'visible' })
      await checkpoint('park-usable')
      await press('Escape')
      await page.locator('#park-sports').waitFor({ state: 'hidden' })
    } else {
      // Current z−7 transit offset lands north of the park's southern fence.
      // Walk through the central gate and around the table, never through either collider.
      const route = arrival.player.z < -407.6
        ? [[-315, -411], [-315, -403], [place.at.x + 2, place.at.z]]
        : [[place.at.x + 2, place.at.z]]
      report.samples.push({ scenario, label: 'print-walking-detour', arrival: arrival.player, route, reason: 'Use the real park gate between the subway arrival and Mae’s table' })
      for (const [x, z] of route) await walkTo(x, z)
      assert.match((await observe()).prompt, /Make a print with Mae/i)
      await press('e')
      await page.locator('#print-studio').waitFor({ state: 'visible' })
      await checkpoint('print-usable')
      await press('Escape')
      await page.locator('#print-studio').waitFor({ state: 'hidden' })
    }
    await frames(3)
    assert.equal((await observe()).paused, false)
    assert.deepEqual((await observe()).waypoint, destination)
    report.checks.push(`${place.kind}: actual named map button survives subway E, arrives on land near the chosen pin, then ordinary WASD/E reaches and opens the activity`)
  }
  assert.deepEqual(report.errors, [])
  process.stdout.write(`Navigation browser smoke passed ${report.checks.length} checks\n`)
} catch (error) {
  report.failure = error.stack || String(error)
  try { report.last = await observe(); await page.screenshot({ path: out + '/failure.png' }) } catch {}
  process.stderr.write(report.failure + '\n')
  process.exitCode = 1
} finally {
  await closeContext()
  await browser.close()
  report.contentHashAfter = await fingerprint()
  if (report.contentHashAfter !== report.contentHash) { report.failure = 'Runtime or assets changed during the navigation check'; process.exitCode = 1 }
  report.finishedAt = new Date().toISOString()
  await fs.writeFile(out + '/report.json', JSON.stringify(report, null, 2))
}
