#!/usr/bin/env node
/** Same settled street pose; only the on-foot rig parameters differ. */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const out = process.env.RAFFI_CAMERA_OUT || '/tmp/raffi-foot-camera'
const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] })
const report = { fixture: 'Identical paused daylight street, player position(-460,-145), heading east and viewport1440x900. Only foot distance/pitch/focus height changes. Camera comparison is an art fixture, not a performance or movement test.', captures: [], errors: [] }
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
 page.on('pageerror', e => report.errors.push(e.message))
 await page.goto(base + '?debug=1&auto=1&tier=medium&hour=14&seed=FIXED')
 await page.waitForFunction(() => window.RAFFI_WORLD?.ready, null, { timeout: 120000 })
 await page.evaluate(async () => {
  const { data, state } = await import('/world/engine/state.js')
  const { cam, updateCamera } = await import('/world/engine/camera.js')
  const { gfx, renderFrame } = await import('/world/engine/render.js')
  window.cameraCompare = { data, state, cam, updateCamera, gfx, renderFrame }
  RAFFI_WORLD.dismissDialogue(); RAFFI_WORLD.teleport(-460, -145); RAFFI_WORLD.setGrade('haze')
  state.player.yaw = Math.PI / 2; cam.desiredYaw = cam.currentYaw = Math.PI * 1.5
 })
 await page.waitForTimeout(4500)
 await page.addStyleTag({ content: '#debug{display:none!important}' })
 for (const [name, footDistance, footPitch, footFocusHeight] of [['before', 6.8, .28, 1.55], ['after', 6.2, .24, 1.45]]) {
  const capture = await page.evaluate(({ footDistance, footPitch, footFocusHeight }) => {
   const { data, state, cam, updateCamera, renderFrame } = cameraCompare
   state.paused = true; cam.orbitHold = 0; cam.pinch = 1
   Object.assign(data.world.camera, { footDistance, footPitch, footFocusHeight })
   for (let i = 0; i < 180; i++) updateCamera(1 / 60, state.player, { x: 0, z: 0 }, 1440 / 900)
   renderFrame(cam.camera)
   return { parameters: { footDistance, footPitch, footFocusHeight }, position: cam.camera.position.toArray(), target: cam.target.toArray(), stats: { ...state.stats } }
  }, { footDistance, footPitch, footFocusHeight })
  await page.screenshot({ path: `${out}/${name}.png` })
  report.captures.push({ name, ...capture })
 }
 assert.deepEqual(report.errors, [])
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close() }
