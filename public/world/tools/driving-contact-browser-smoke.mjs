#!/usr/bin/env node
/** Live keyboard contact against an actual ambient car and a production pedestrian fixture. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html')
url.searchParams.set('debug', '1'); url.searchParams.set('tier', 'low'); url.searchParams.set('seed', 'FIXED'); url.searchParams.delete('auto')
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-driving-contact'; await fs.mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { checks: [], errors: [], fixturePositions: true, realKeyboardDriving: true }; let page
async function hold(key, seconds) {
  const target = await page.evaluate((seconds) => window.__CONTACT__.state.time + seconds, seconds)
  await page.keyboard.down(key)
  try { await page.waitForFunction((time) => window.__CONTACT__.state.time >= time, target, { timeout: 25000 }) } finally { await page.keyboard.up(key) }
}
async function frame() { const n = await page.evaluate(() => window.__CONTACT__.state.frame + 3); await page.waitForFunction((n) => window.__CONTACT__.state.frame >= n, n) }
try {
  page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  page.on('pageerror', (e) => report.errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()) })
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.locator('#boot-start').waitFor({ state: 'visible', timeout: 120000 }); await page.locator('#boot-start').click()
  const setup = await page.evaluate(async () => {
    const { state, data } = await import('/world/engine/state.js'); const { gfx } = await import('/world/engine/render.js'); const playerModule = await import('/world/game/player.js'); const traffic = await import('/world/game/traffic.js')
    window.RAFFI_WORLD.dismissDialogue()
    const atlas = await import('/world/gen/atlas.js')
    const fleet = traffic.trafficSnapshot().cars
    const target = fleet.find((car) => car.active && !car.local && car.junctionEntry - car.progress > 45 && fleet.every((other) => other.id === car.id || Math.hypot(other.x - (car.x - Math.sin(car.yaw) * 14), other.z - (car.z - Math.cos(car.yaw) * 14)) > 10))
    if (!target) throw new Error('No safe straight ambient-car fixture')
    const x = target.x - Math.sin(target.yaw) * 14, z = target.z - Math.cos(target.yaw) * 14
    window.RAFFI_WORLD.teleport(x, z)
    const probe = playerModule.spawnVehicle(gfx.scene, gfx.materials, atlas, 'grand-tourer', x, z, target.yaw, 'contact-regression')
    playerModule.enterVehicle(probe)
    window.__CONTACT__ = { state, data, gfx, atlas, playerModule, traffic, target, probe }
    return { target, probe: { x, z, yaw: target.yaw } }
  })
  report.setup = setup
  await hold('w', 3)
  const carContact = await page.evaluate(() => {
    const { probe, traffic, target } = window.__CONTACT__, lead = traffic.trafficSnapshot().cars.find((car) => car.id === target.id)
    const ahead = (lead.x - probe.x) * Math.sin(probe.yaw) + (lead.z - probe.z) * Math.cos(probe.yaw)
    return { gap: ahead - lead.length / 2 - probe.mesh.userData.length / 2, impact: probe.lastImpact, speed: probe.speed, x: probe.x, z: probe.z, lead }
  })
  report.carContact = carContact
  assert.ok(carContact.gap >= -0.12 && carContact.gap < 2, JSON.stringify(carContact))
  await page.screenshot({ path: OUT + '/01-ambient-car-contact.png' })
  await hold('s', 1)
  const backed = await page.evaluate(() => ({ x: window.__CONTACT__.probe.x, z: window.__CONTACT__.probe.z }))
  const retreat = (backed.x - carContact.x) * Math.sin(setup.probe.yaw) + (backed.z - carContact.z) * Math.cos(setup.probe.yaw)
  assert.ok(retreat < -0.3, 'Reverse did not free the car after contact')
  report.checks.push('Actual ambient car blocks player-car nose under sustained W; S backs out safely')
  await page.evaluate(async () => {
    const { state, data, gfx, atlas, playerModule, probe } = window.__CONTACT__
    window.RAFFI_WORLD.teleport(0, -377.2)
    Object.assign(probe, { x: 0, z: -377.2, y: 0, yaw: Math.PI / 2, speed: 0, lateral: 0, angularVel: 0 }); probe.mesh.position.set(probe.x, 0, probe.z); probe.mesh.rotation.y = probe.yaw
    const { makePed } = await import('/world/gen/peds.js')
    const pedestrian = makePed(data.npcs, 'commuter', 'contact-pedestrian', gfx.materials.actor, atlas, data.blocks.vertexLighting)
    pedestrian.name = 'ped:contact-fixture'; pedestrian.position.set(14, 0, -377.2); gfx.scene.add(pedestrian)
    window.__CONTACT__.pedestrian = pedestrian
    playerModule.enterVehicle(probe)
    state.player.yaw = probe.yaw
  })
  await frame(); await hold('w', 3)
  const pedestrianContact = await page.evaluate(() => { const { probe, pedestrian } = window.__CONTACT__; return { gap: pedestrian.position.x - (probe.x + probe.mesh.userData.length / 2), x: probe.x, speed: probe.speed } })
  report.pedestrianContact = pedestrianContact
  assert.ok(pedestrianContact.gap >= 0.38 && pedestrianContact.gap < 1, JSON.stringify(pedestrianContact)); assert.ok(pedestrianContact.speed < 0.1)
  await page.screenshot({ path: OUT + '/02-pedestrian-contact.png' })
  await hold('s', 0.8); assert.ok(await page.evaluate((x) => window.__CONTACT__.probe.x < x - 0.7, pedestrianContact.x))
  report.checks.push('Production pedestrian body stops the visible car nose, and reverse remains controllable')
  assert.deepEqual(report.errors, []); console.log('Driving contact browser passed: ' + report.checks.length + ' checks')
} catch (error) { report.failure = error.stack || String(error); try { await page.screenshot({ path: OUT + '/failure.png' }) } catch {}; console.error(report.failure); process.exitCode = 1 }
finally { await fs.writeFile(OUT + '/report.json', JSON.stringify(report, null, 2)); await browser.close() }
