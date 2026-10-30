#!/usr/bin/env node

/**
 * Feel pass smoke: wall slide, corner hold, pedestrian bump, pole sway, car
 * impact and reduced motion, all driven by real held keys in a production
 * build. Every wait and measurement is in simulation time (state.time /
 * state.frame), so a CPU-only CI renderer at a few frames per second measures
 * the same thing as a laptop GPU. Test walls are placed in an open, off-road
 * spot through the debug collision hook; no teleports during measured holds.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-world-feel'
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

/** Holds keys until `seconds` of simulation time have passed. */
async function hold(keys, seconds) {
  const until = await page.evaluate((seconds) => window.__FEEL__.state.time + seconds, seconds)
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.waitForFunction((until) => window.__FEEL__.state.time >= until, until, { timeout: 120_000 })
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key)
  }
}

async function simWait(seconds) {
  const until = await page.evaluate((seconds) => window.__FEEL__.state.time + seconds, seconds)
  await page.waitForFunction((until) => window.__FEEL__.state.time >= until, until, { timeout: 120_000 })
}

/** Starts a per-simulation-frame recorder in the page; stop() returns the samples. */
async function record(name, body) {
  await page.evaluate(({ name, body }) => {
    const sample = new Function('ctx', body)
    const log = { active: true, samples: [], lastFrame: -1 }
    window.__FEEL__.records[name] = log
    const tick = () => {
      if (!log.active) return
      const { state } = window.__FEEL__
      if (state.frame !== log.lastFrame) {
        log.lastFrame = state.frame
        log.samples.push({ frame: state.frame, time: state.time, ...sample(window.__FEEL__) })
      }
      requestAnimationFrame(tick)
    }
    tick()
  }, { name, body })
  return async () => page.evaluate((name) => {
    const log = window.__FEEL__.records[name]
    log.active = false
    return log.samples
  }, name)
}

/** Teleports (outside any measured hold) and aligns the chase camera behind the pose. */
async function place(pose) {
  await page.evaluate(async ({ x, z, yaw }) => {
    const { teleportPlayer, player } = window.__FEEL__.playerModule
    const { updateCamera } = window.__FEEL__.camera
    window.RAFFI_WORLD.dismissDialogue()
    if (player.vehicle) window.__FEEL__.playerModule.exitVehicle()
    teleportPlayer(x, z, yaw)
    window.RAFFI_WORLD.setCameraMode('chase')
    updateCamera(0, { x, y: 0, z }, { x: 0, z: 0 }, innerWidth / innerHeight)
  }, pose)
  // Wait on where the player actually stands (contacts may settle the pose).
  await page.waitForFunction(({ yaw }) => {
    const { cam, movementBasis } = window.__FEEL__.camera
    const p = window.__FEEL__.state.player
    const basis = movementBasis()
    return Math.hypot(cam.target.x - p.x, cam.target.z - p.z) < 0.05 && basis.fx * Math.sin(yaw) + basis.fz * Math.cos(yaw) > 0.9995
  }, pose, { timeout: 60_000 })
}

/** Evidence capture with the World held still, as the desktop pauses a background World. */
async function capture(name) {
  const setActive = (active) => page.evaluate((active) => window.postMessage({ type: 'raffi-world:activity', active }, location.origin), active)
  await setActive(false)
  try { await page.screenshot({ path: `${out}/${name}.png`, timeout: 120_000 }) } finally { await setActive(true) }
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.bringToFront()
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0, null, { timeout: 120_000 })
  await page.evaluate(async () => {
    const { state, data } = await import('/world/engine/state.js')
    const physics = await import('/world/engine/physics.js')
    window.__FEEL__ = {
      state,
      data,
      physics,
      camera: await import('/world/engine/camera.js'),
      playerModule: await import('/world/game/player.js'),
      render: await import('/world/engine/render.js'),
      atlas: await import('/world/gen/atlas.js'),
      roads: await import('/world/gen/roads.js'),
      npcs: await import('/world/game/npc-sim.js'),
      records: {},
    }
    window.RAFFI_WORLD.dismissDialogue()
  })

  // An open, off-road spot with no solids or people within reach for the fixtures.
  const site = await page.evaluate(() => {
    const { state, data, physics, roads, render } = window.__FEEL__
    const collision = window.RAFFI_WORLD.collision()
    const graph = roads.buildRoadGraph(data.world)
    const people = render.gfx.scene.children.filter((object) => object.visible && object.userData?.rig)
    const b = data.world.bounds
    const spots = []
    for (let x = b.minX + 40; x <= b.maxX - 40; x += 6) {
      for (let z = b.minZ + 40; z <= b.maxZ - 40; z += 6) {
        if (roads.isOnRoad(graph, x, z, 26)) continue
        if (physics.penetrationDepth(collision, x, z, 22) > 0) continue
        if (people.some((person) => Math.hypot(person.position.x - x, person.position.z - z) < 26)) continue
        spots.push({ x, z, d: Math.hypot(x - state.player.x, z - state.player.z) })
      }
    }
    spots.sort((a, b) => a.d - b.d)
    if (!spots.length) throw new Error('No open fixture site found')
    return spots[0]
  })
  report.site = site

  // ---- wall slide: run at 40° into a straight wall and keep going along it.
  const wall = { x: site.x - 4, z: site.z, hx: 0.2, hz: 9 }
  await page.evaluate((wall) => window.RAFFI_WORLD.collision().add({ type: 'box', ...wall, tag: 'feel-smoke-wall' }), wall)
  const face = wall.x - wall.hx
  const slideYaw = 40 * Math.PI / 180
  await place({ x: face - 2.2, z: wall.z - 7.5, yaw: slideYaw })
  let stop = await record('slide', `
    const p = ctx.state.player
    const prompt = document.querySelector('#interaction-prompt')
    return { x: p.x, z: p.z, hint: !!(prompt?.classList.contains('show') && prompt.textContent.includes('PATH BLOCKED')) }`)
  await hold(['Shift', 'w'], 2.6)
  let samples = await stop()
  const contact = samples.findIndex((s) => s.x + 0.45 >= face - 0.03)
  assert.ok(contact >= 0, 'never reached the wall: ' + JSON.stringify(samples.at(-1)))
  const sliding = samples.slice(contact)
  const slidePenetration = Math.max(...samples.map((s) => s.x + 0.45 - face))
  const slideTime = sliding.at(-1).time - sliding[0].time
  const slideSpeed = (sliding.at(-1).z - sliding[0].z) / Math.max(slideTime, 1e-6)
  report.wallSlide = { penetration: slidePenetration, alongSpeed: slideSpeed, frames: sliding.length, hint: sliding.some((s) => s.hint) }
  assert.ok(slidePenetration <= 0.03, 'wall penetration: ' + JSON.stringify(report.wallSlide))
  assert.ok(slideSpeed >= 0.7 * 6 * Math.cos(slideYaw), 'slide lost too much speed: ' + JSON.stringify(report.wallSlide))
  assert.equal(report.wallSlide.hint, false, 'PATH BLOCKED shown while sliding along a straight wall')

  // ---- concave corner: run diagonally into an L and hold.
  const cornerAt = { x: site.x + 8, z: site.z + 4 }
  const corner = [
    { x: cornerAt.x + 0.2, z: cornerAt.z - 3, hx: 0.2, hz: 3 },
    { x: cornerAt.x - 3, z: cornerAt.z + 0.2, hx: 3, hz: 0.2 },
  ]
  await page.evaluate((boxes) => { for (const box of boxes) window.RAFFI_WORLD.collision().add({ type: 'box', ...box, tag: 'feel-smoke-corner' }) }, corner)
  await place({ x: cornerAt.x - 4, z: cornerAt.z - 4, yaw: Math.PI / 4 })
  stop = await record('corner', `const p = ctx.state.player; return { x: p.x, z: p.z }`)
  await hold(['Shift', 'w'], 3)
  samples = await stop()
  const cornerPenetration = Math.max(...samples.map((s) => Math.max(s.x + 0.45 - cornerAt.x, s.z + 0.45 - cornerAt.z)))
  const settled = samples.filter((s) => s.time >= samples.at(-1).time - 1)
  const end = samples.at(-1)
  const oscillation = Math.max(...settled.map((s) => Math.hypot(s.x - end.x, s.z - end.z)))
  report.corner = { penetration: cornerPenetration, oscillation, frames: settled.length }
  assert.ok(cornerPenetration <= 0.03, 'corner penetration: ' + JSON.stringify(report.corner))
  assert.ok(oscillation <= 0.01, 'corner jitter: ' + JSON.stringify(report.corner))
  report.stuckEvents = (await page.evaluate(() => window.RAFFI_WORLD.feel())).stuckEvents
  assert.equal(report.stuckEvents, 0, 'the walking controller started a step embedded')

  // ---- pedestrian bump: sprint into someone walking ahead of you.
  const heatBefore = await page.evaluate(() => window.RAFFI_WORLD.complianceSnapshot?.().heat ?? 0)
  const walker = await page.evaluate(async () => {
    const { render, state } = window.__FEEL__
    const before = new Map(render.gfx.scene.children.filter((o) => o.visible && o.userData?.rig === 'biped').map((o) => [o.uuid, o.position.clone()]))
    const start = state.time
    await new Promise((resolve) => { const wait = () => (state.time >= start + 0.7 ? resolve() : requestAnimationFrame(wait)); wait() })
    const people = render.gfx.scene.children.filter((o) => o.visible && before.has(o.uuid))
    const moving = people.map((person) => {
      const old = before.get(person.uuid)
      const dx = person.position.x - old.x, dz = person.position.z - old.z
      return { person, dx, dz, moved: Math.hypot(dx, dz) }
    }).filter(({ person, dx, dz, moved }) => {
      if (!(moved > 0.2) || !people.every((other) => other === person || other.position.distanceTo(person.position) > 3)) return false
      // The standing spot and the run-up between it and the walker must be open.
      const collision = window.RAFFI_WORLD.collision()
      for (const k of [1.2, 2.2, 3.2]) {
        if (window.__FEEL__.physics.penetrationDepth(collision, person.position.x - dx / moved * k, person.position.z - dz / moved * k, 0.6) > 0) return false
      }
      return true
    })
    moving.sort((a, b) => b.moved - a.moved)
    const chosen = moving[0]
    if (!chosen) throw new Error('No walking pedestrian found')
    const { person, dx, dz, moved } = chosen
    // Start 3.2 m behind them, heading the same way: a full sprint run-up
    // whatever their pace, closing on them from behind.
    return { uuid: person.uuid, x: person.position.x - dx / moved * 3.2, z: person.position.z - dz / moved * 3.2, yaw: Math.atan2(dx, dz) }
  })
  await place(walker)
  await page.evaluate((uuid) => { window.__FEEL__.bumpTarget = window.__FEEL__.render.gfx.scene.children.find((o) => o.uuid === uuid); window.__FEEL__.bumpStart = window.RAFFI_WORLD.feel().events }, walker.uuid)
  stop = await record('bump', `
    const target = ctx.bumpTarget
    const bump = target.userData.bump
    return { px: target.position.x, pz: target.position.z, tier: bump?.tier || 0, distance: bump?.distance || 0, applied: bump?.applied || 0 }`)
  await hold(['Shift', 'w'], 2.0)
  await simWait(1.0)
  samples = await stop()
  const hit = samples.findIndex((s) => s.tier > 0)
  assert.ok(hit >= 0, 'no bump registered: ' + JSON.stringify(await page.evaluate(() => window.RAFFI_WORLD.feel())))
  const bumpPlan = samples.filter((s) => s.tier > 0).at(-1)
  const shoveSamples = samples.slice(hit)
  const pushedFrom = samples[hit]
  const furthest = Math.max(...shoveSamples.map((s) => Math.hypot(s.px - pushedFrom.px, s.pz - pushedFrom.pz)))
  report.bump = { tier: bumpPlan.tier, shove: bumpPlan.distance, applied: Math.max(...shoveSamples.map((s) => s.applied)), displacement: furthest, feel: (await page.evaluate(() => window.RAFFI_WORLD.feel())).lastBump }
  assert.ok(report.bump.tier >= 2, 'a sprint bump should stumble or buckle: ' + JSON.stringify(report.bump))
  assert.ok(report.bump.shove >= 0.4 && report.bump.shove <= 1.2, 'shove distance: ' + JSON.stringify(report.bump))
  assert.ok(report.bump.displacement >= 0.4, 'the pedestrian did not move away: ' + JSON.stringify(report.bump))
  await simWait(3.0)
  const recovery = await page.evaluate(() => {
    const { bumpTarget: target, npcs, state } = window.__FEEL__
    const actor = npcs.npcActivitySnapshot().reduce((best, a) => (!best || Math.hypot(a.x - target.position.x, a.z - target.position.z) < Math.hypot(best.x - target.position.x, best.z - target.position.z) ? a : best), null)
    return { bumpCleared: !target.userData.bump, startled: (target.userData.streetReaction?.until ?? -1) > state.time, verb: actor?.verb }
  })
  const heatAfter = await page.evaluate(() => window.RAFFI_WORLD.complianceSnapshot?.().heat ?? 0)
  report.bump.recovery = recovery
  report.bump.heat = { before: heatBefore, after: heatAfter }
  assert.equal(recovery.bumpCleared, true, 'bump never finished: ' + JSON.stringify(recovery))
  assert.equal(recovery.startled, false, 'still startled 4 s later: ' + JSON.stringify(recovery))
  assert.notEqual(recovery.verb, 'flee', 'still fleeing 4 s later')
  assert.equal(heatAfter, heatBefore, 'an accidental bump changed Heat')

  // ---- pole sway: walk into a lamp post or neon pole.
  const pole = await page.evaluate(() => {
    const { physics, render } = window.__FEEL__
    const collision = window.RAFFI_WORLD.collision()
    const swaying = new Set(['streetlight-heritage', 'streetlight-modern', 'streetlight-strip', 'neon-pole'])
    const people = render.gfx.scene.children.filter((object) => object.visible && object.userData?.rig)
    for (const candidate of collision.all) {
      if (candidate.type !== 'circle' || !swaying.has(candidate.tag)) continue
      if (people.some((person) => Math.hypot(person.position.x - candidate.x, person.position.z - candidate.z) < 6)) continue
      for (let k = 0; k < 8; k++) {
        const angle = k / 8 * Math.PI * 2
        const sx = candidate.x + Math.cos(angle) * 3.2, sz = candidate.z + Math.sin(angle) * 3.2
        const mx = candidate.x + Math.cos(angle) * 1.6, mz = candidate.z + Math.sin(angle) * 1.6
        if (physics.penetrationDepth(collision, sx, sz, 0.8) > 0 || physics.penetrationDepth(collision, mx, mz, 0.6) > 0) continue
        return { tag: candidate.tag, x: candidate.x, z: candidate.z, r: candidate.r, start: { x: sx, z: sz, yaw: Math.atan2(candidate.x - sx, candidate.z - sz) } }
      }
    }
    throw new Error('No clear swaying pole found')
  })
  await place(pole.start)
  stop = await record('pole', `const p = ctx.state.player; return { x: p.x, z: p.z, shake: ctx.camera.cam.shake }`)
  await hold(['w'], 2.0)
  samples = await stop()
  const sway = await page.evaluate((pole) => window.RAFFI_WORLD.feel().wobbles.find((w) => Math.hypot(w.x - pole.x, w.z - pole.z) < 0.01), pole)
  const clearance = Math.min(...samples.map((s) => Math.hypot(s.x - pole.x, s.z - pole.z)))
  report.pole = { tag: pole.tag, clearance, minimumAllowed: pole.r + 0.45 - 0.03, peakDeg: sway?.peakDeg ?? 0, event: (await page.evaluate(() => window.RAFFI_WORLD.feel())).lastPropEvent }
  assert.equal(report.pole.event?.reaction, 'wobble', 'no pole reaction: ' + JSON.stringify(report.pole))
  assert.ok(report.pole.peakDeg > 0.3, 'the pole did not sway: ' + JSON.stringify(report.pole))
  assert.ok(clearance >= report.pole.minimumAllowed, 'walked through the pole: ' + JSON.stringify(report.pole))
  await capture('pole-sway')
  await simWait(2.5)
  const residual = await page.evaluate((pole) => window.RAFFI_WORLD.feel().wobbles.find((w) => Math.hypot(w.x - pole.x, w.z - pole.z) < 0.01)?.angleDeg ?? 0, pole)
  report.pole.residualDeg = residual
  assert.ok(Math.abs(residual) < 0.1, 'the sway did not settle within 2.5 s: ' + JSON.stringify(report.pole))

  // ---- car impact: drive into a wall, feel it, then reverse away.
  // A clear 34 m lane heading +z, off the roads, with a test barrier at its end.
  const crashAt = await page.evaluate(() => {
    const { state, data, physics, roads, render } = window.__FEEL__
    const collision = window.RAFFI_WORLD.collision()
    const graph = roads.buildRoadGraph(data.world)
    const people = render.gfx.scene.children.filter((object) => object.visible && object.userData?.rig)
    const b = data.world.bounds
    const lanes = []
    for (let x = b.minX + 40; x <= b.maxX - 40; x += 6) {
      for (let z = b.minZ + 40; z <= b.maxZ - 80; z += 6) {
        let clear = true
        for (let k = 0; k <= 34 && clear; k += 2) {
          clear = !roads.isOnRoad(graph, x, z + k, 6) && physics.penetrationDepth(collision, x, z + k, 4.5) === 0 &&
            people.every((person) => Math.hypot(person.position.x - x, person.position.z - z - k) > 8)
        }
        if (clear) lanes.push({ x, z, d: Math.hypot(x - state.player.x, z - state.player.z) })
      }
    }
    lanes.sort((a, b) => a.d - b.d)
    if (!lanes.length) throw new Error('No clear driving lane found')
    return lanes[0]
  })
  report.crashLane = crashAt
  await page.evaluate((at) => window.RAFFI_WORLD.collision().add({ type: 'box', x: at.x, z: at.z + 32, hx: 6, hz: 0.3, tag: 'feel-smoke-barrier' }), crashAt)
  await page.evaluate(({ x, z }) => {
    const { playerModule, render, atlas } = window.__FEEL__
    window.RAFFI_WORLD.dismissDialogue()
    window.RAFFI_WORLD.teleport(x, z)
    const car = playerModule.spawnVehicle(render.gfx.scene, render.gfx.materials, atlas, 'grand-tourer', x, z, 0, 'feel-smoke')
    playerModule.enterVehicle(car)
    window.__FEEL__.car = car
  }, crashAt)
  stop = await record('car', `const car = ctx.car; return { z: car.z, speed: car.speed, impact: car.lastImpact || 0, shake: ctx.camera.cam.shake }`)
  await hold(['w'], 5)
  await simWait(0.3)
  samples = await stop()
  const impactEvent = (await page.evaluate(() => window.RAFFI_WORLD.feel())).lastImpactEvent
  report.car = { topSpeed: Math.max(...samples.map((s) => s.speed)), maxImpact: Math.max(...samples.map((s) => s.impact)), maxShake: Math.max(...samples.map((s) => s.shake)), event: impactEvent }
  assert.ok(report.car.topSpeed >= 8, 'the car never reached 8 m/s: ' + JSON.stringify(report.car))
  assert.ok(impactEvent?.impact > 2, 'the impact was not felt: ' + JSON.stringify(report.car))
  assert.ok(report.car.maxShake > 0, 'no camera shake on impact: ' + JSON.stringify(report.car))
  const atWall = await page.evaluate(() => window.__FEEL__.car.z)
  await hold(['s'], 1.5)
  const reversed = await page.evaluate(() => window.__FEEL__.car.z)
  report.car.reverseEscape = atWall - reversed
  assert.ok(report.car.reverseEscape > 0.5, 'reverse could not free the car: ' + JSON.stringify(report.car))
  await page.evaluate(() => window.__FEEL__.playerModule.exitVehicle(window.RAFFI_WORLD.collision()))

  // ---- reduced motion: the same sway and a run produce no shake or bob.
  await page.evaluate(() => window.__FEEL__.camera.setReducedMotion(true))
  await simWait(1.5)
  await place(pole.start)
  stop = await record('reduced', `const cam = ctx.camera.cam; return { shake: cam.shake, bob: cam.bob }`)
  await hold(['Shift', 'w'], 1.6)
  samples = await stop()
  const reducedFeel = await page.evaluate(() => window.RAFFI_WORLD.feel())
  report.reducedMotion = { maxShake: Math.max(...samples.map((s) => s.shake)), maxBob: Math.max(...samples.map((s) => Math.abs(s.bob))), event: reducedFeel.lastPropEvent?.time, wobbles: reducedFeel.wobbles.length }
  await page.evaluate(() => window.__FEEL__.camera.setReducedMotion(false))
  assert.equal(report.reducedMotion.maxShake, 0, 'shake under reduced motion: ' + JSON.stringify(report.reducedMotion))
  assert.equal(report.reducedMotion.maxBob, 0, 'head bob under reduced motion: ' + JSON.stringify(report.reducedMotion))
  assert.equal(report.reducedMotion.wobbles, 0, 'pole sway under reduced motion: ' + JSON.stringify(report.reducedMotion))

  assert.deepEqual(errors, [])
  report.passed = true
} catch (error) {
  report.failure = error.stack || String(error)
  report.errors = errors
  throw error
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ passed: report.passed, wallSlide: report.wallSlide, corner: report.corner, bump: report.bump && { tier: report.bump.tier, shove: report.bump.shove, displacement: report.bump.displacement }, pole: report.pole && { tag: report.pole.tag, peakDeg: report.pole.peakDeg, clearance: report.pole.clearance }, car: report.car && { topSpeed: report.car.topSpeed, impact: report.car.event?.impact, maxShake: report.car.maxShake, reverseEscape: report.car.reverseEscape }, reducedMotion: report.reducedMotion }, null, 2))
