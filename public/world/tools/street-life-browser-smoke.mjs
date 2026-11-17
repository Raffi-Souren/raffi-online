#!/usr/bin/env node

/**
 * Street life smoke: sprint until winded, start a gig from its ring and
 * deliver it for cash, buy a coffee, have the valet bring a car, read the
 * texts that came in, take a photo, and check it all survives a reload. It
 * also checks every gig point and tape against the generated city, so a
 * later map change cannot bury one in a wall or leave it in a traffic lane.
 * Waits are in simulation time. Each World runs in its own context, closed
 * before the next one starts.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-world-street-life'
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
    window.__LIFE__ = {
      state,
      data,
      camera: await import('/world/engine/camera.js'),
      playerModule: await import('/world/game/player.js'),
      physics: await import('/world/engine/physics.js'),
      roads: await import('/world/gen/roads.js'),
    }
    window.RAFFI_WORLD.dismissDialogue()
  })
}

async function simWait(seconds) {
  const until = await page.evaluate((seconds) => window.__LIFE__.state.time + seconds, seconds)
  await page.waitForFunction((until) => window.__LIFE__.state.time >= until, until, { timeout: 180_000 })
}

/** Teleports and aligns the chase camera behind the pose, so W walks along `yaw`. */
async function place(pose) {
  await page.evaluate(({ x, z, yaw }) => {
    const { teleportPlayer, player, exitVehicle } = window.__LIFE__.playerModule
    window.RAFFI_WORLD.dismissDialogue()
    if (player.vehicle) exitVehicle()
    teleportPlayer(x, z, yaw)
    window.RAFFI_WORLD.setCameraMode('chase')
    window.__LIFE__.camera.updateCamera(0, { x, y: 0, z }, { x: 0, z: 0 }, innerWidth / innerHeight)
  }, pose)
  await page.waitForFunction(({ x, z }) => {
    const p = window.__LIFE__.state.player
    return Math.hypot(p.x - x, p.z - z) < 0.5
  }, pose, { timeout: 60_000 })
}

/** Holds keys until `seconds` of simulation time pass or `done` is true. */
async function holdUntil(keys, seconds, done) {
  const until = await page.evaluate((seconds) => window.__LIFE__.state.time + seconds, seconds)
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.waitForFunction(({ until, done }) => window.__LIFE__.state.time >= until || new Function(`return (${done})()`)(), { until, done: String(done) }, { timeout: 240_000 })
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key)
  }
}

async function capture(name) {
  const setActive = (active) => page.evaluate((active) => window.postMessage({ type: 'raffi-world:activity', active }, location.origin), active)
  await setActive(false)
  try { await page.screenshot({ path: `${out}/${name}.png`, timeout: 120_000 }) } finally { await setActive(true) }
}

const life = () => page.evaluate(() => window.RAFFI_WORLD.life())
const gig = () => page.evaluate(() => window.RAFFI_WORLD.gig())
const paused = () => page.evaluate(() => window.__LIFE__.state.paused)
const phoneTab = (name) => page.locator(`#phone-tabs button[data-phone-app="${name.toLowerCase()}"]`)

try {
  // ---------------------------------------------------- desktop, keyboard
  let context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await boot(context)

  const fresh = await life()
  assert.equal(fresh.cash, 0)
  assert.equal(fresh.stamina.value, 1)
  assert.deepEqual(Object.values(fresh.skills).map((skill) => skill.level), [1, 1, 1, 1])
  assert.equal(await page.locator('#wallet').innerText(), '$0')
  assert.ok(fresh.carts >= 1, 'no coffee carts found in the city')

  // ---- every gig point and tape sits somewhere a person can stand.
  const points = await page.evaluate(() => {
    const { data, physics, roads } = window.__LIFE__
    const collision = window.RAFFI_WORLD.collision()
    const graph = roads.buildRoadGraph(data.world)
    const bad = []
    const check = (name, point, { road = false, radius = 1 } = {}) => {
      if (physics.penetrationDepth(collision, point.x, point.z, radius) > 0) bad.push(name + ' is inside a solid')
      else if (!road && roads.isOnRoad(graph, point.x, point.z, 0)) bad.push(name + ' is in the road')
    }
    for (const gig of data.life.gigs) {
      check(gig.id + ' start', gig.start)
      // A skate line's gates are on the street on purpose.
      for (const [index, stop] of (gig.stops || []).entries()) check(`${gig.id} stop ${index + 1}`, stop, { road: gig.kind === 'line' })
      for (const [index, spot] of (gig.spots || []).entries()) check(`${gig.id} spot ${index + 1}`, spot)
    }
    for (const tape of data.tapes.tapes) check('tape ' + tape.id, tape.at, { radius: 0.6 })
    return { bad, gigs: data.life.gigs.length, tapes: data.tapes.tapes.length, markers: window.__LIFE__.state.gigMarkers.length }
  })
  report.points = points
  assert.deepEqual(points.bad, [], 'points a player cannot stand on')
  assert.equal(points.markers, 4, 'the four Hustle 1 gigs should be on the map, Crosstown Run should not')

  // ---- sprint until winded: the meter empties, the sprint stops, Legs grows.
  await place({ x: -548, z: -257.2, yaw: Math.PI / 2 })
  await holdUntil(['Shift', 'w'], 16, () => window.RAFFI_WORLD.life().stamina.winded)
  const winded = await page.evaluate(() => ({ life: window.RAFFI_WORLD.life(), locked: window.__LIFE__.state.player.sprintLocked, bar: document.getElementById('stamina').dataset.state, shown: document.getElementById('stamina').classList.contains('show') }))
  report.winded = { stamina: winded.life.stamina, legs: winded.life.skills.legs.xp }
  assert.equal(winded.life.stamina.winded, true, 'a full sprint never ran out: ' + JSON.stringify(winded.life.stamina))
  assert.equal(winded.locked, true)
  assert.equal(winded.bar, 'winded')
  assert.equal(winded.shown, true, 'the stamina bar stayed hidden while winded')
  assert.ok(winded.life.skills.legs.xp >= 4, 'sprinting earned no Legs experience: ' + winded.life.skills.legs.xp)
  await capture('winded')
  // Still holding sprint: out of breath means a walk, not a run.
  await page.keyboard.down('Shift'); await page.keyboard.down('w')
  await simWait(0.8)
  const tired = await page.evaluate(() => ({ speed: window.__LIFE__.state.player.speed, walk: window.__LIFE__.data.movement.walkSpeed, winded: window.RAFFI_WORLD.life().stamina.winded }))
  await page.keyboard.up('w'); await page.keyboard.up('Shift')
  report.tired = tired
  if (tired.winded) assert.ok(tired.speed <= tired.walk + 0.6, 'still running while winded: ' + JSON.stringify(tired))
  // Standing still brings it back.
  await holdUntil([], 9, () => !window.RAFFI_WORLD.life().stamina.winded && window.RAFFI_WORLD.life().stamina.value > 0.6)
  const rested = (await life()).stamina
  assert.equal(rested.winded, false, 'stamina never recovered: ' + JSON.stringify(rested))

  // ---- a gig from its ring: press E, deliver three stops, get paid.
  const crate = await page.evaluate(() => window.__LIFE__.data.life.gigs.find((entry) => entry.id === 'crate-run'))
  await place({ x: crate.start.x, z: crate.start.z, yaw: 0 })
  await page.waitForFunction(() => /START CRATE RUN/.test(document.getElementById('interaction-prompt')?.textContent || ''), null, { timeout: 30_000 })
  await page.keyboard.press('e')
  await page.waitForFunction(() => window.RAFFI_WORLD.gig()?.id === 'crate-run', null, { timeout: 30_000 })
  await simWait(0.4)
  const started = await page.evaluate(() => ({ waypoint: window.RAFFI_WORLD.getWaypoint(), objective: document.getElementById('objective').textContent, markers: window.__LIFE__.state.gigMarkers.length }))
  assert.equal(started.waypoint?.label, crate.stops[0].label)
  assert.match(started.objective, /CRATE RUN · 0\/3 · \d:\d\d/)
  assert.equal(started.markers, 0, 'gig rings stayed on the map during a run')
  // Walk into the first stop; the next two are reached by standing in them.
  await place({ x: crate.stops[0].x - 12, z: crate.stops[0].z, yaw: Math.PI / 2 })
  assert.equal((await gig()).step, 0, 'a stop counted from outside its radius')
  await holdUntil(['w'], 4, () => window.RAFFI_WORLD.gig()?.step >= 1)
  assert.equal((await gig()).step, 1, 'walking into the first stop did not count')
  assert.equal((await page.evaluate(() => window.RAFFI_WORLD.getWaypoint())).label, crate.stops[1].label)
  await place({ x: crate.stops[1].x, z: crate.stops[1].z, yaw: 0 })
  await page.waitForFunction(() => window.RAFFI_WORLD.gig()?.step >= 2, null, { timeout: 30_000 })
  await place({ x: crate.stops[2].x, z: crate.stops[2].z, yaw: 0 })
  await page.waitForFunction(() => window.RAFFI_WORLD.gig() === null, null, { timeout: 30_000 })
  const paid = await page.evaluate(() => ({ life: window.RAFFI_WORLD.life(), toast: document.getElementById('toast').textContent, wallet: document.getElementById('wallet').textContent, waypoint: window.RAFFI_WORLD.getWaypoint(), stored: JSON.parse(localStorage.getItem('raffi-world:life:v1')) }))
  report.gig = { cash: paid.life.cash, record: paid.life.gigs['crate-run'], hustle: paid.life.skills.hustle.xp, toast: paid.toast }
  assert.ok(paid.life.cash >= crate.pay.base, 'the gig paid less than its base: ' + paid.life.cash)
  assert.match(paid.toast, /CRATE RUN DONE · \+\$\d+/)
  assert.equal(paid.wallet, '$' + paid.life.cash)
  assert.equal(paid.life.gigs['crate-run'].wins, 1)
  assert.ok(paid.life.gigs['crate-run'].best > 0)
  assert.equal(paid.life.skills.hustle.xp, 25)
  assert.equal(paid.waypoint, null, 'the gig left its pin behind')
  assert.equal(paid.stored.cash, paid.life.cash, 'the wallet was not saved')
  // The giver texts; the phone button says so.
  assert.ok(paid.life.unread >= 1, 'no text after the first gig')
  assert.equal(await page.locator('#desktop-phone').getAttribute('data-unread'), '', 'no unread mark on the phone button')

  // ---- coffee at a cart: costs cash, refills the sprint.
  const cart = await page.evaluate(() => {
    const { state, physics } = window.__LIFE__
    const collision = window.RAFFI_WORLD.collision()
    for (const cart of state.coffeeCarts) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = cart.x + Math.sin(angle) * 2.4, z = cart.z + Math.cos(angle) * 2.4
        if (physics.penetrationDepth(collision, x, z, 0.6) <= 0) return { x, z, yaw: angle + Math.PI }
      }
    }
    return null
  })
  assert.ok(cart, 'no open spot beside any coffee cart')
  await place(cart)
  await page.waitForFunction(() => /COFFEE · \$\d+/.test(document.getElementById('interaction-prompt')?.textContent || ''), null, { timeout: 30_000 })
  await page.keyboard.press('e')
  await page.waitForFunction((before) => window.RAFFI_WORLD.life().cash < before, paid.life.cash, { timeout: 30_000 })
  const coffee = await life()
  report.coffee = { cash: coffee.cash, stamina: coffee.stamina }
  assert.equal(coffee.cash, paid.life.cash - 4)
  assert.equal(coffee.stamina.value, 1)
  assert.ok(coffee.stamina.wired > 0, 'coffee did not make the sprint free')

  // ---- the phone: Gigs, Texts and Me, then the valet.
  await page.keyboard.press('p')
  await page.waitForFunction(() => window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  await phoneTab('Gigs').click()
  const board = await page.locator('#phone-panel').innerText()
  assert.match(board, /CRATE RUN · from \$45/)
  assert.match(board, /best \d:\d\d/)
  assert.equal(await page.locator('#phone-panel button', { hasText: 'CROSSTOWN RUN' }).isDisabled(), true, 'Crosstown Run open before Hustle 2')
  await phoneTab('Texts').click()
  assert.match(await page.locator('#phone-panel').innerText(), /Bea/)
  assert.equal((await life()).unread, 0, 'opening Texts did not mark them read')
  await phoneTab('Me').click()
  const me = await page.locator('#phone-panel').innerText()
  assert.match(me, /Hustle 1/)
  assert.match(me, /Legs 1/)
  await capture('phone-me')
  await page.locator('#phone-panel button', { hasText: 'Bring my ride' }).click()
  await page.waitForFunction(() => !window.RAFFI_WORLD.phone().open && window.__LIFE__.state.mode === 'vehicle', null, { timeout: 30_000 })
  const afterValet = await life()
  report.valet = { cash: afterValet.cash }
  assert.equal(afterValet.cash, coffee.cash - 20, 'the valet did not charge its fare')

  // ---- the camera: the street holds still, a look applies, a photo comes out.
  await page.keyboard.press('p')
  await page.waitForFunction(() => window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  await phoneTab('Camera').click()
  await page.locator('#phone-panel button', { hasText: 'Open the camera' }).click()
  await page.waitForFunction(() => window.RAFFI_WORLD.photo().open, null, { timeout: 30_000 })
  assert.equal(await paused(), true, 'the camera did not hold the street still')
  const before = await page.evaluate(() => window.RAFFI_WORLD.photo())
  await page.keyboard.press('ArrowLeft')
  await page.locator('#photo-look').click()
  const framed = await page.evaluate(() => ({ photo: window.RAFFI_WORLD.photo(), filter: document.getElementById('view').style.filter, hud: getComputedStyle(document.getElementById('hud')).visibility }))
  assert.notEqual(framed.photo.yaw, before.yaw, 'the arrow key did not turn the camera')
  assert.equal(framed.photo.look, 'disposable')
  assert.match(framed.filter, /contrast/)
  assert.equal(framed.hud, 'hidden', 'the HUD stayed in the shot')
  await capture('photo-mode')
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.locator('#photo-snap').click()])
  await download.saveAs(`${out}/photo.png`)
  const shot = { name: download.suggestedFilename(), bytes: (await fs.stat(`${out}/photo.png`)).size, note: await page.locator('#photo-note').innerText() }
  report.photo = shot
  assert.match(shot.name, /^raffi-world-\d{4}-\d\d-\d\d-\d{6}\.png$/)
  // A blank frame compresses to almost nothing; a street does not.
  assert.ok(shot.bytes > 20_000, 'the photo looks blank: ' + shot.bytes + ' bytes')
  assert.equal(shot.note, 'Saved ' + shot.name)
  assert.deepEqual(new Uint8Array(await fs.readFile(`${out}/photo.png`)).slice(0, 4), new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'the download is not a PNG')
  await page.locator('#photo-done').click()
  await page.waitForFunction(() => !window.RAFFI_WORLD.photo().open, null, { timeout: 30_000 })
  assert.equal(await paused(), false, 'closing the camera left the street paused')
  assert.equal(await page.evaluate(() => document.getElementById('view').style.filter), '', 'the look stayed on after the camera closed')
  assert.equal((await life()).photos, 1)

  // ---- reload: the wallet, the record and the skills are still there.
  const beforeReload = await life()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready, null, { timeout: 120_000 })
  const reloaded = await life()
  assert.equal(reloaded.cash, beforeReload.cash)
  assert.equal(reloaded.gigs['crate-run'].wins, 1)
  assert.equal(reloaded.skills.hustle.xp, 25)
  assert.ok(reloaded.skills.legs.xp >= winded.life.skills.legs.xp)
  assert.equal(reloaded.photos, 1)
  await context.close()

  // ---------------------------------------------------- phone, touch
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  await boot(context)
  await page.locator('#btn-phone').tap()
  await page.waitForFunction(() => window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  const tabs = await page.locator('#phone-tabs button').evaluateAll((buttons) => buttons.map((button) => { const box = button.getBoundingClientRect(); return { label: button.textContent, height: box.height, right: box.right, left: box.left } }))
  assert.equal(tabs.length, 9)
  assert.ok(tabs.every((tab) => tab.height >= 44 && tab.left >= 0 && tab.right <= 390), 'phone tabs too small or off screen: ' + JSON.stringify(tabs))
  await phoneTab('Gigs').tap()
  await capture('phone-touch-gigs')
  // Far from its ring, picking a gig routes you there.
  await page.locator('#phone-panel button', { hasText: 'FLYER DROP' }).tap()
  await page.waitForFunction(() => !window.RAFFI_WORLD.phone().open, null, { timeout: 30_000 })
  assert.equal((await page.evaluate(() => window.RAFFI_WORLD.getWaypoint()))?.label, 'FLYER DROP')
  assert.equal(await gig(), null, 'a gig started from across the city')
  // A board gig brings its own board, and dropping it pays nothing.
  const line = await page.evaluate(() => window.__LIFE__.data.life.gigs.find((entry) => entry.id === 'skate-line'))
  await place({ x: line.start.x, z: line.start.z, yaw: 0 })
  const problem = await page.evaluate(() => window.RAFFI_WORLD.startGig('skate-line'))
  assert.equal(problem, null, 'the skate line would not start: ' + problem)
  const riding = await page.evaluate(() => ({ mode: window.__LIFE__.state.mode, kind: window.__LIFE__.playerModule.player.vehicle?.kind, gig: window.RAFFI_WORLD.gig() }))
  report.line = { mode: riding.mode, kind: riding.kind, stops: riding.gig?.stops.length }
  assert.equal(riding.kind, 'skateboard', 'the skate line did not bring a board')
  assert.equal(riding.gig.id, 'skate-line')
  assert.equal(await page.evaluate(() => window.RAFFI_WORLD.dropGig()), true)
  assert.equal(await gig(), null)
  assert.equal((await life()).cash, 0, 'a dropped gig paid')
  await context.close()

  assert.deepEqual(errors, [], 'page errors')
  report.ok = true
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ ...report, errors }, null, 2))
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
