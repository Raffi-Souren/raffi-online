#!/usr/bin/env node
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { chromium } from "playwright"

const base = process.env.RAFFI_WORLD_URL || "http://127.0.0.1:3005/world/index.html"
const out = process.env.RAFFI_SMOKE_OUT || "/tmp/raffi-minimap-smoke"
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
const errors = []
const samples = []
try {
  for (const [name, width, height] of [
    ["desktop", 1280, 800],
    ["phone", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: name === "phone",
      hasTouch: name === "phone",
    })
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    const url = new URL(base)
    url.searchParams.set("auto", "1")
    url.searchParams.set("debug", "1")
    url.searchParams.set("seed", "FIXED")
    if (process.env.RAFFI_FUNCTIONAL_TIER) url.searchParams.set("tier", process.env.RAFFI_FUNCTIONAL_TIER)
    await page.goto(url.href, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => window.RAFFI_WORLD?.ready, null, { timeout: 120_000 })
    await page.addStyleTag({ content: "#debug { display: none !important; }" })
    await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${out}/${name}-initial-classic.png` })
    await page.evaluate(() => {
      window.RAFFI_WORLD.dismissDialogue()
      window.RAFFI_WORLD.teleport(-438, -101)
      window.RAFFI_WORLD.setQuality("balanced")
    })
    await page.evaluate(async () => { window.__MINIMAP_STATE__ = (await import("/world/engine/state.js")).state })
    for (const mode of ["classic", "chase", "free", "birds"]) {
      await page.evaluate((mode) => window.RAFFI_WORLD.setCameraMode(mode), mode)
      const frame = await page.evaluate(() => window.__MINIMAP_STATE__.frame + 3)
      await page.waitForFunction((target) => window.__MINIMAP_STATE__.frame >= target, frame, { timeout: 60_000 })
      const sample = await page.evaluate(async () => {
        const { cam } = await import("/world/engine/camera.js")
        const { state, data } = await import("/world/engine/state.js")
        const { mapViewAngle, mapPlaces, visibleMapPlaces } = await import("/world/game/minimap-details.js")
        cam.camera.updateMatrixWorld(true)
        const e = cam.camera.matrixWorld.elements
        const length = Math.hypot(e[8], e[10])
        const angle = mapViewAngle(state.camera.yaw)
        const dot = (Math.cos(angle) * -e[8]) / length + (Math.sin(angle) * -e[10]) / length
        const radius = 256 * 0.455
        const places = visibleMapPlaces(mapPlaces(data.world), {
          x: state.player.x,
          z: state.player.z,
          scale: radius / 115,
          radius,
          waypoint: state.navigation.waypoint,
        })
        return { dot, places: places.map((place) => place.label), ...window.RAFFI_WORLD.stats() }
      })
      samples.push({ name, mode, ...sample })
      assert.ok(sample.dot > 0.999, `${name}/${mode}: view sector does not match camera`)
      assert.ok(sample.places.length > 0, `${name}/${mode}: no landmarks at the garage approach`)
      // WORLD-BIBLE section 5 explicitly supersedes the old 120 draw / 60k
      // total-triangle kit. Keep the same Medium contract as camera-budget.
      assert.equal(sample.quality, "balanced", `${name}/${mode}: budget must measure Medium`)
      assert.ok(sample.drawCalls < 250 && sample.visibleTriangles < 150_000,
        `${name}/${mode}: Medium budget exceeded (${sample.drawCalls} draws, ${sample.visibleTriangles} visible triangles)`)
    }
    await page.evaluate(() => window.RAFFI_WORLD.setCameraMode("classic"))
    await page.addStyleTag({ content: "#debug { display: none !important; }" })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${out}/${name}.png` })
    await page.locator("#minimap").screenshot({ path: `${out}/${name}-map.png` })
    await page.evaluate(async () => {
      const { setWaypoint } = await import("/world/game/hud.js")
      setWaypoint(null)
    })
    // Clearing navigation updates the accessible map on its next three-frame
    // redraw. Slow software-rendered CI may not complete that redraw in 150ms.
    await page.waitForFunction(
      () => /Free roam\. Nearby:/.test(document.querySelector("#minimap")?.getAttribute("aria-label") || ""),
      null,
      { timeout: 15_000 },
    )
    assert.match(await page.locator("#minimap").getAttribute("aria-label"), /Free roam\. Nearby:/)
    await context.close()
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify(samples, null, 2))
  console.log(
    JSON.stringify({
      passed: samples.length,
      maxDraws: Math.max(...samples.map((s) => s.drawCalls)),
      maxTriangles: Math.max(...samples.map((s) => s.triangles)),
      errors,
      out,
    }),
  )
} catch (error) {
  await fs.writeFile(`${out}/failure.json`, JSON.stringify({ error: error.stack, samples, errors }, null, 2))
  throw error
} finally {
  await browser.close()
}
