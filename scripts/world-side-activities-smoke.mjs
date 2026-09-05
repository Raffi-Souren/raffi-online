import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
const require = createRequire(new URL("../package.json", import.meta.url)),
  { chromium } = require("playwright")
const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3000"
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/world-side-qa"
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
const report = { checks: [], errors: [] }
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
    page.on("pageerror", (e) => report.errors.push(e.message))
    await page.goto(base + "/world/index.html?auto=1&debug=1&seed=FIXED", { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => window.RAFFI_WORLD?.ready, {}, { timeout: 120000 })
    await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${out}/${name}-world.png` })
    await page.getByRole("button", { name: "Crib Garage · G" }).click()
    const dialog = page.getByRole("dialog", { name: "The Crib Garage" })
    await dialog.getByRole("button", { name: "Miami", exact: true }).click()
    assert.match(await dialog.getByRole("status").first().innerText(), /Miami applied/)
    await dialog.getByRole("button", { name: "Fit street tires" }).click()
    await dialog.getByText("Open the glovebox", { exact: true }).click()
    await dialog.getByRole("button", { name: "Play Night Shift" }).click()
    await page.keyboard.down("ArrowRight")
    await page.waitForTimeout(500)
    await page.keyboard.up("ArrowRight")
    await page.screenshot({ path: `${out}/${name}-handheld.png` })
    assert.equal(await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1), false)
    await dialog.getByRole("button", { name: "Return to World" }).click()
    assert.equal(await dialog.count(), 0)
    await page.getByRole("button", { name: "Crib Garage · G" }).click()
    await dialog.getByRole("button", { name: "Start street time trial" }).click()
    await page.waitForTimeout(200)
    const before = await page.evaluate(async () => {
      const { state } = await import("/world/engine/state.js")
      return { x: state.player.x, z: state.player.z }
    })
    await page.keyboard.down("w")
    await page.waitForTimeout(1500)
    await page.keyboard.up("w")
    const after = await page.evaluate(async () => {
      const { state } = await import("/world/engine/state.js")
      return { x: state.player.x, z: state.player.z }
    })
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 3, "race car did not respond to normal gas input")
    assert.match(await page.locator("#sprint-status").innerText(), /HARBOR SPRINT/)
    await page.screenshot({ path: `${out}/${name}-sprint.png` })
    await page.getByRole("button", { name: "End sprint" }).click()
    assert.equal(await page.locator("#sprint-status").innerText(), "")
    report.checks.push(
      `${name}: garage paint/tuning, glovebox game, no overflow, close/reopen, real keyboard driving and sprint cancellation`,
    )
    await context.close()
  }
  assert.deepEqual(report.errors, [])
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
