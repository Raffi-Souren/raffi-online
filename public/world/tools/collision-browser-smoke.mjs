#!/usr/bin/env node

/** Generated actors + live keyboard collisions, in a temporary testing browser only. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp'
const world = JSON.parse(await fs.readFile(new URL('../data/world.json', import.meta.url), 'utf8'))
const url = new URL(base)
url.searchParams.set('debug', '1')
url.searchParams.set('auto', '1')
url.searchParams.set('seed', 'FIXED')

// No system-browser fallback and no persistent profile: this is the bundled
// Playwright binary with a fresh context, unrelated to anyone's open tabs.
const browser = await chromium.launch({
  executablePath: chromium.executablePath(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []
const report = {}

async function holdForward(page, milliseconds = 1600) {
  await page.keyboard.down('Shift')
  await page.keyboard.down('w')
  try {
    await page.waitForTimeout(milliseconds)
  } finally {
    await page.keyboard.up('w')
    await page.keyboard.up('Shift')
  }
}

async function positionPlayer(page, pose) {
  await page.evaluate(async ({ x, z, yaw }) => {
    const { teleportPlayer } = await import('/world/game/player.js')
    window.RAFFI_WORLD.dismissDialogue()
    window.RAFFI_WORLD.setCameraMode('chase')
    teleportPlayer(x, z, yaw)
  }, pose)
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForFunction(
    () => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0,
    null,
    { timeout: 120_000 },
  )
  await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())

  // Use a naturally moving, generated pedestrian. Sample every rendered frame
  // while both the player and NPC simulation are running normally.
  const pedestrian = await page.evaluate(async () => {
    const { gfx } = await import('/world/engine/render.js')
    const peds = gfx.scene.children.filter((object) => object.visible && object.userData?.rig === 'biped')
    const before = new Map(peds.map((ped) => [ped.uuid, ped.position.clone()]))
    await new Promise((resolve) => setTimeout(resolve, 700))
    const candidates = peds
      .map((ped) => {
        const old = before.get(ped.uuid)
        const dx = ped.position.x - old.x,
          dz = ped.position.z - old.z
        return { ped, dx, dz, movement: Math.hypot(dx, dz) }
      })
      .filter(
        ({ ped, movement }) =>
          movement > 0.05 &&
          peds.every((other) => other === ped || other.position.distanceTo(ped.position) > 2.5),
      )
    candidates.sort((a, b) => b.movement - a.movement)
    const chosen = candidates[0]
    if (!chosen) throw new Error('No moving pedestrian found for collision smoke')
    const { ped, dx, dz, movement } = chosen
    return {
      uuid: ped.uuid,
      x: ped.position.x + dx / movement,
      z: ped.position.z + dz / movement,
      yaw: Math.atan2(-dx, -dz),
      movement,
    }
  })
  await positionPlayer(page, pedestrian)
  await page.keyboard.down('Shift')
  await page.keyboard.down('w')
  try {
    report.pedestrian = await page.evaluate(async (uuid) => {
      const { gfx } = await import('/world/engine/render.js')
      const { state } = await import('/world/engine/state.js')
      const ped = gfx.scene.children.find((object) => object.uuid === uuid)
      let minimum = Infinity
      const start = ped.position.clone()
      for (let frame = 0; frame < 70; frame++) {
        await new Promise(requestAnimationFrame)
        minimum = Math.min(
          minimum,
          Math.hypot(state.player.x - ped.position.x, state.player.z - ped.position.z),
        )
      }
      return { minimum, npcMovement: ped.position.distanceTo(start), frames: 70 }
    }, pedestrian.uuid)
  } finally {
    await page.keyboard.up('w')
    await page.keyboard.up('Shift')
  }
  assert.ok(
    report.pedestrian.minimum >= 0.84,
    'moving pedestrian overlap: ' + JSON.stringify(report.pedestrian),
  )
  assert.ok(report.pedestrian.minimum < 1, 'the player never reached pedestrian contact')
  assert.ok(report.pedestrian.npcMovement > 0.05, 'NPC simulation stopped during the collision test')
  await page.screenshot({ path: out + '/raffi-world-pedestrian-collision.png' })

  const car = await page.evaluate(async () => {
    const { gfx } = await import('/world/engine/render.js')
    const actors = gfx.scene.children.filter((object) => object.visible && object.userData?.rig)
    const mesh = gfx.scene.children.find(
      (object) =>
        object.visible &&
        object.userData?.width > 1.2 &&
        object.userData?.length > 2 &&
        actors.every((ped) => ped.position.distanceTo(object.position) > 7),
    )
    if (!mesh) throw new Error('No isolated parked car found')
    const rx = Math.cos(mesh.rotation.y),
      rz = -Math.sin(mesh.rotation.y)
    const hx = mesh.userData.width / 2
    return {
      x: mesh.position.x - rx * (hx + 2),
      z: mesh.position.z - rz * (hx + 2),
      yaw: Math.atan2(rx, rz),
      centerX: mesh.position.x,
      centerZ: mesh.position.z,
      rx,
      rz,
      hx,
      name: mesh.name,
    }
  })
  await positionPlayer(page, car)
  await holdForward(page)
  const afterCar = await page.evaluate(() => window.RAFFI_WORLD.getState().player)
  report.car = {
    name: car.name,
    side: (afterCar.x - car.centerX) * car.rx + (afterCar.z - car.centerZ) * car.rz,
    halfWidth: car.hx,
  }
  assert.ok(
    report.car.side <= -car.hx - 0.43,
    'player walked inside a parked car: ' + JSON.stringify(report.car),
  )
  assert.ok(report.car.side > -car.hx - 0.8, 'player never reached the parked car')
  await page.screenshot({ path: out + '/raffi-world-car-collision.png' })

  const stadium = world.landmarks.find((landmark) => landmark.type === 'stadium')
  const angle = 0.4
  const pole = {
    x: stadium.at.x + Math.cos(angle) * (stadium.radius + 8),
    z: stadium.at.z + Math.sin(angle) * (stadium.radius + 8),
  }
  await positionPlayer(page, {
    x: pole.x + Math.cos(angle) * 3.5,
    z: pole.z + Math.sin(angle) * 3.5,
    yaw: Math.atan2(-Math.cos(angle), -Math.sin(angle)),
  })
  await holdForward(page)
  const afterPole = await page.evaluate(() => window.RAFFI_WORLD.getState().player)
  report.pole = { clearance: Math.hypot(afterPole.x - pole.x, afterPole.z - pole.z) }
  assert.ok(
    report.pole.clearance >= 1.44 && report.pole.clearance < 1.65,
    'floodlight solid missing: ' + JSON.stringify(report.pole),
  )
  await page.screenshot({ path: out + '/raffi-world-prop-collision.png' })

  report.interiors = []
  for (const spec of world.interiors) {
    await positionPlayer(page, { ...spec.exit, yaw: 0 })
    await page.waitForTimeout(120)
    assert.match(
      await page.locator('#interaction-prompt').textContent(),
      /ENTER/,
      `${spec.id} entrance inaccessible`,
    )
    await page.keyboard.press('e')
    await page.waitForFunction((id) => window.RAFFI_WORLD.interiorSnapshot().active === id, spec.id)
    if (spec.id === 'club-floor') {
      await positionPlayer(page, { x: 0, z: -18, yaw: Math.PI })
      await holdForward(page)
      const position = await page.evaluate(() => window.RAFFI_WORLD.getState().player)
      assert.ok(position.z >= -20.36 && position.z < -20, 'DJ booth must be solid')
    }
    const exit = await page.evaluate(async () =>
      (await import('/world/game/interiors.js')).interiorDoorContext(),
    )
    await positionPlayer(page, { x: exit.x, z: exit.z, yaw: 0 })
    await page.waitForTimeout(100)
    assert.match(await page.locator('#interaction-prompt').textContent(), /EXIT/)
    await page.keyboard.press('e')
    await page.waitForFunction(() => window.RAFFI_WORLD.interiorSnapshot().active === null)
    report.interiors.push(spec.id)
  }

  assert.deepEqual(errors, [], 'browser runtime errors')
  await fs.writeFile(out + '/raffi-world-collision-smoke.json', JSON.stringify(report, null, 2))
  process.stdout.write(JSON.stringify({ passed: true, ...report }, null, 2) + '\n')
  await context.close()
} finally {
  await browser.close()
}
