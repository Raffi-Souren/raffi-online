#!/usr/bin/env node
/** Real cheat delivery, pause preferences, hood driving and return to foot. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-camera-preferences'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] })
const report = { checks: [], errors: [] }
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage()
    page.on('pageerror', e => report.errors.push(e.message))
    await page.goto(`${base}?tier=${mobile ? 'low' : 'medium'}&hour=14&seed=FIXED`, { waitUntil: 'domcontentloaded' })
    await page.locator('#boot-start').click({ timeout: 120000 })
    await page.evaluate(async () => {
      window.cameraTest = { ...(await import('/world/engine/state.js')), ...(await import('/world/engine/camera.js')) }
    })
    await page.locator('#game-question').click()
    await page.locator('#cheat-code').fill('WHIP')
    await page.locator('#cheat-form button').click()
    await page.locator('#cheat-close').click()
    await page.waitForFunction(() => cameraTest.state.mode === 'vehicle')
    await page.locator(mobile ? '#btn-pause' : '#desktop-pause').click()
    await page.locator('[data-pause="driving-view"]').click()
    await page.locator('[data-pause="motion"]').click()
    assert.match(await page.locator('[data-pause="driving-view"]').textContent(), /Hood/)
    assert.match(await page.locator('[data-pause="motion"]').textContent(), /Reduced/)
    await page.locator('[data-pause="resume"]').click()
    await page.waitForTimeout(400)
    const pose = await page.evaluate(() => {
      const { state, cam } = cameraTest, p = state.player
      const direction = cam.camera.getWorldDirection(cam.camera.position.clone())
      return { distance: Math.hypot(cam.camera.position.x - p.x, cam.camera.position.z - p.z), y: cam.camera.position.y - p.y, dot: direction.x * Math.sin(p.yaw) + direction.z * Math.cos(p.yaw), reduced: cam.reducedMotion }
    })
    assert.ok(pose.distance < 1.2 && pose.distance > 0.7)
    assert.ok(pose.y > 1.2 && pose.y < 1.5)
    assert.ok(pose.dot > 0.99)
    assert.equal(pose.reduced, true)
    await page.screenshot({ path: `${out}/${mobile ? 'phone' : 'desktop'}-hood.png` })
    if (mobile) await page.locator('#btn-exit').tap()
    else await page.keyboard.press('e')
    await page.waitForFunction(() => cameraTest.state.mode === 'foot')
    await page.waitForTimeout(450)
    assert.ok(await page.evaluate(() => cameraTest.cam.camera.position.y - cameraTest.state.player.y > 2))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('#boot-start').click({ timeout: 120000 })
    await page.locator(mobile ? '#btn-pause' : '#desktop-pause').click()
    assert.match(await page.locator('[data-pause="driving-view"]').textContent(), /Hood/)
    assert.match(await page.locator('[data-pause="motion"]').textContent(), /Reduced/)
    report.checks.push(`${mobile ? 'Touch' : 'Desktop'}: explicit hood and reduced-motion settings, clear forward car view, normal foot view after exit, preferences survive reload`)
    await context.close()
  }
  assert.deepEqual(report.errors, [])
} catch (e) { report.failure = e.stack; throw e }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close() }
