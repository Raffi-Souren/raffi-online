#!/usr/bin/env node

/**
 * City life smoke: a tape found by walking up to it (once, however often you
 * stand on it, and still found after a reload), BADCO FM unlocking, the flip
 * phone on keyboard and on touch, a Lab storefront, a right-click map pin
 * that survives an interior round trip, and BADCO FM's standalone fallback.
 * Waits are in simulation time, so a CPU-only CI renderer measures the same
 * thing as a laptop GPU. Each World runs in its own context, closed before
 * the next one starts.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-world-city-life'
await fs.mkdir(out, { recursive: true })
const url = new URL(base)
url.searchParams.set('debug', '1')
url.searchParams.set('auto', '1')
url.searchParams.set('seed', 'FIXED')
if (process.env.RAFFI_FUNCTIONAL_TIER) url.searchParams.set('tier', process.env.RAFFI_FUNCTIONAL_TIER)

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []
const report = {}
let page

async function boot(context) {
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.bringToFront()
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0, null, { timeout: 120_000 })
  await page.evaluate(async () => {
    const { state, data } = await import('/world/engine/state.js')
    window.__CITY__ = {
      state,
      data,
      camera: await import('/world/engine/camera.js'),
      playerModule: await import('/world/game/player.js'),
      messages: [],
    }
    // At top level the World is its own parent, so anything it would ask a desktop for lands here.
    window.addEventListener('message', (event) => { if (event.data?.type?.startsWith('raffi-world:radio')) window.__CITY__.messages.push(event.data) })
    window.RAFFI_WORLD.dismissDialogue()
  })
}

async function simWait(seconds) {
  const until = await page.evaluate((seconds) => window.__CITY__.state.time + seconds, seconds)
  await page.waitForFunction((until) => window.__CITY__.state.time >= until, until, { timeout: 120_000 })
}

/** Teleports and aligns the chase camera behind the pose, so W walks along `yaw`. */
async function place(pose) {
  await page.evaluate(({ x, z, yaw }) => {
    const { teleportPlayer, player, exitVehicle } = window.__CITY__.playerModule
    window.RAFFI_WORLD.dismissDialogue()
    if (player.vehicle) exitVehicle()
    teleportPlayer(x, z, yaw)
    window.RAFFI_WORLD.setCameraMode('chase')
    window.__CITY__.camera.updateCamera(0, { x, y: 0, z }, { x: 0, z: 0 }, innerWidth / innerHeight)
  }, pose)
  await page.waitForFunction(({ x, z }) => {
    const p = window.__CITY__.state.player
    return Math.hypot(p.x - x, p.z - z) < 0.3
  }, pose, { timeout: 60_000 })
}

/** Holds keys until `seconds` of simulation time pass or `done` is true. */
async function holdUntil(keys, seconds, done) {
  const until = await page.evaluate((seconds) => window.__CITY__.state.time + seconds, seconds)
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.waitForFunction(({ until, done }) => window.__CITY__.state.time >= until || new Function(`return (${done})()`)(), { until, done: String(done) }, { timeout: 120_000 })
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key)
  }
}

async function capture(name) {
  const setActive = (active) => page.evaluate((active) => window.postMessage({ type: 'raffi-world:activity', active }, location.origin), active)
  await setActive(false)
  try { await page.screenshot({ path: `${out}/${name}.png`, timeout: 120_000 }) } finally { await setActive(true) }
}

const phoneOpen = () => page.evaluate(() => window.RAFFI_WORLD.phone().open && !document.getElementById('phone').classList.contains('hidden'))
const paused = () => page.evaluate(() => window.__CITY__.state.paused)
const badco = () => page.evaluate(() => {
  const { data, state } = window.__CITY__
  const index = data.radio.stations.findIndex((station) => station.hostMixes)
  return { index, unlocked: data.radio.stations[index].unlocked, tuned: state.radio.on && state.radio.stationIndex === index }
})

try {
  // ---------------------------------------------------- desktop, keyboard
  let context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await boot(context)

  const fresh = await page.evaluate(() => ({ tapes: window.RAFFI_WORLD.tapes(), stored: localStorage.getItem('raffi:tapes-found') }))
  assert.equal(fresh.tapes.total, 14)
  assert.deepEqual(fresh.tapes.found, [])
  assert.equal(fresh.tapes.markers, 0, 'tape markers show before the first find')
  assert.equal(fresh.stored, null)
  assert.equal((await badco()).unlocked, false, 'BADCO FM open on a fresh save')

  // ---- walk up to a tape.
  const tape = await page.evaluate(() => window.__CITY__.data.tapes.tapes[0])
  await place({ x: tape.at.x, z: tape.at.z + 2.6, yaw: Math.PI })
  const found = await page.evaluate(() => window.RAFFI_WORLD.tapes().found.length)
  assert.equal(found, 0, 'picked up before walking to it')
  await holdUntil(['w'], 2.5, () => window.RAFFI_WORLD.tapes().found.length > 0)
  const afterPickup = await page.evaluate(() => ({
    tapes: window.RAFFI_WORLD.tapes(),
    stored: JSON.parse(localStorage.getItem('raffi:tapes-found')),
    toast: document.getElementById('toast')?.textContent || '',
  }))
  report.pickup = afterPickup
  assert.deepEqual(afterPickup.tapes.found, [tape.id])
  assert.deepEqual(afterPickup.stored, [tape.id])
  assert.equal(afterPickup.tapes.markers, 13, 'remaining tapes are not on the map after the first find')
  assert.match(afterPickup.toast, /TAPE FOUND/)
  assert.equal((await badco()).unlocked, true, 'the first tape did not unlock BADCO FM')

  // ---- standing on it again changes nothing.
  await place({ x: tape.at.x, z: tape.at.z, yaw: 0 })
  await simWait(0.6)
  const again = await page.evaluate(() => ({ tapes: window.RAFFI_WORLD.tapes(), stored: localStorage.getItem('raffi:tapes-found') }))
  assert.deepEqual(again.tapes.found, [tape.id], 'a tape counted twice')
  assert.equal(again.stored, JSON.stringify([tape.id]))

  // ---- the phone on keyboard: P opens and pauses, Escape closes and resumes.
  await page.keyboard.press('p')
  await page.waitForFunction(() => window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  assert.equal(await paused(), true, 'the phone did not pause the street')
  const radioApp = await page.locator('#phone-panel').innerText()
  assert.match(radioApp, /BADCO FM/)
  assert.equal(await page.locator('#phone-panel button', { hasText: 'BADCO FM' }).isDisabled(), false, 'BADCO FM locked on the phone')
  await page.locator('#phone-tabs button', { hasText: 'Tapes' }).click()
  assert.match(await page.locator('#phone-panel').innerText(), /1\/14 found/)
  await capture('phone-tapes')
  await page.locator('#phone-tabs button', { hasText: 'Radio' }).click()
  await page.locator('#phone-panel button', { hasText: 'BADCO FM' }).click()
  assert.equal((await badco()).tuned, true, 'the phone did not tune BADCO FM')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  assert.equal(await paused(), false, 'closing the phone left the street paused')
  // On its own page there is no desktop player: BADCO FM falls back to its synth and asks nobody.
  await simWait(0.5)
  report.radioMessages = await page.evaluate(() => window.__CITY__.messages)
  assert.deepEqual(report.radioMessages, [], 'a standalone World asked for the desktop player')

  // ---- a Lab storefront opens its room.
  await page.evaluate(() => { window.__CITY__.opened = []; window.open = (href) => { window.__CITY__.opened.push(String(href)); return null } })
  const front = await page.evaluate(() => window.__CITY__.data.world.labFronts[0])
  const nx = Math.sin(front.ry || 0), nz = Math.cos(front.ry || 0)
  await place({ x: front.x + nx * 1.6, z: front.z + nz * 1.6, yaw: Math.atan2(-nx, -nz) })
  await page.waitForFunction(() => /OPEN IN LAB/.test(document.getElementById('interaction-prompt')?.textContent || ''), null, { timeout: 30_000 })
  await page.keyboard.press('e')
  await page.waitForFunction(() => window.__CITY__.opened.length > 0, null, { timeout: 30_000 })
  report.labFront = await page.evaluate(() => window.__CITY__.opened)
  assert.deepEqual(report.labFront, ['/lab/' + front.slug])
  await simWait(0.6)
  await capture('lab-front')

  // ---- a right-click pin, kept through an interior round trip.
  await page.keyboard.press('m')
  await page.waitForSelector('#world-map:not(.hidden)', { timeout: 30_000 })
  const canvas = await page.locator('#world-map-canvas').boundingBox()
  await page.mouse.click(canvas.x + canvas.width * 0.62, canvas.y + canvas.height * 0.4, { button: 'right' })
  const pin = await page.evaluate(() => window.RAFFI_WORLD.getWaypoint())
  assert.equal(pin?.label, 'YOUR MAP PIN', 'right-click dropped no pin')
  await page.locator('#world-map-back').click()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !window.__CITY__.state.paused, null, { timeout: 30_000 })
  await page.evaluate(() => window.RAFFI_WORLD.enterInterior('mainframe'))
  await simWait(0.3)
  assert.equal(await page.evaluate(() => window.RAFFI_WORLD.interiorSnapshot().active), 'mainframe')
  await page.evaluate(() => window.RAFFI_WORLD.exitInterior())
  await simWait(0.3)
  const kept = await page.evaluate(() => window.RAFFI_WORLD.getWaypoint())
  assert.deepEqual({ x: kept?.x, z: kept?.z, label: kept?.label }, { x: pin.x, z: pin.z, label: pin.label }, 'the interior lost the map pin')
  report.pin = kept

  // ---- reload: the tape stays found, BADCO FM stays open, the count does not move.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready, null, { timeout: 120_000 })
  const reloaded = await page.evaluate(async () => {
    const { data } = await import('/world/engine/state.js')
    return { tapes: window.RAFFI_WORLD.tapes(), badco: data.radio.stations.find((station) => station.hostMixes).unlocked }
  })
  assert.deepEqual(reloaded.tapes.found, [tape.id])
  assert.equal(reloaded.tapes.markers, 13)
  assert.equal(reloaded.badco, true)
  await context.close()

  // ---------------------------------------------------- phone, touch
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  await boot(context)
  await page.waitForSelector('#btn-phone', { state: 'visible', timeout: 30_000 })
  await page.locator('#btn-phone').tap()
  await page.waitForFunction(() => window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  assert.equal(await paused(), true)
  const tabs = await page.locator('#phone-tabs button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height))
  assert.ok(tabs.every((height) => height >= 44), 'phone tabs under 44px: ' + tabs.join(','))
  await page.locator('#phone-tabs button', { hasText: 'Contacts' }).tap()
  const contacts = page.locator('#phone-panel button.phone-row:not(:disabled)')
  report.contacts = await contacts.count()
  assert.ok(report.contacts > 0, 'nobody in Contacts on a fresh save')
  const contact = (await contacts.first().locator('strong').innerText()).trim()
  await capture('phone-touch-contacts')
  await contacts.first().tap()
  await page.waitForFunction(() => !window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  assert.equal(await paused(), false, 'picking a contact left the street paused')
  const route = await page.evaluate(() => window.RAFFI_WORLD.getWaypoint())
  assert.equal(route?.label, contact, 'the contact set no route')
  // And the close button, by touch.
  await page.locator('#btn-phone').tap()
  await page.waitForFunction(() => window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  await page.locator('#phone-close').tap()
  await page.waitForFunction(() => !window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  assert.equal(await phoneOpen(), false)
  assert.equal(await paused(), false)
  await context.close()

  assert.deepEqual(errors, [], 'page errors')
  report.ok = true
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ ...report, errors }, null, 2))
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
