import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { chromium } from "playwright"

const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3000"
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/raffi-crate-controls"
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
try {
  for (const [name, width, height] of [["desktop", 1280, 900], ["phone", 390, 844], ["small-phone", 375, 667], ["landscape", 844, 390]]) {
    if (process.env.RAFFI_QA_VIEWPORT && process.env.RAFFI_QA_VIEWPORT !== name) continue
    const context = await browser.newContext({ viewport: { width, height }, isMobile: name !== "desktop", hasTouch: true, reducedMotion: "reduce" })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    // Observe the real canvas draw calls without changing the game simulation.
    await page.addInitScript(() => {
      const fill = CanvasRenderingContext2D.prototype.fillRect
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
        if (this.canvas.getAttribute("aria-label")?.startsWith("Downtown Dig") && w === 8 && h === 4 && this.fillStyle === "#ffc94a") {
          this.canvas.dataset.playerX = String(x - 1)
          this.canvas.dataset.playerY = String(y - 7)
        }
        return fill.call(this, x, y, w, h)
      }
    })
    await page.goto(base, { waitUntil: "load" })
    await page.getByRole("button", { name: "Explore", exact: true }).tap()
    await page.getByRole("button", { name: "Question block: unlock a secret level", exact: true }).tap()
    const game = page.locator('[data-game="brooklyn-dig"]')
    await game.waitFor()
    await game.getByRole("button", { name: "Start", exact: true }).click()
    const canvas = game.locator("canvas")
    const position = () => canvas.evaluate((el) => ({ x: Number(el.dataset.playerX), y: Number(el.dataset.playerY) }))
    await page.waitForFunction(() => Number.isFinite(Number(document.querySelector('[data-game="brooklyn-dig"] canvas')?.dataset.playerX)))
    const initial = await position()
    const stick = game.getByRole("group", { name: "Downtown Dig run stick", exact: true })
    await stick.scrollIntoViewIfNeeded()
    const s = await stick.boundingBox(), j = await game.getByRole("button", { name: "Jump", exact: true }).boundingBox()
    const cdp = await context.newCDPSession(page)
    const movement = { x: s.x + s.width * 0.82, y: s.y + s.height / 2, id: 1 }
    const jump = { x: j.x + j.width / 2, y: j.y + j.height / 2, id: 2 }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [movement] })
    await page.waitForFunction((x) => Number(document.querySelector('[data-game="brooklyn-dig"] canvas')?.dataset.playerX) > x + 5, initial.x, { timeout: 3000 })
    assert.ok((await position()).x > initial.x + 5, `${name}: stick does not run`)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [movement, jump] })
    await page.waitForFunction((y) => Number(document.querySelector('[data-game="brooklyn-dig"] canvas')?.dataset.playerY) < y - 10, initial.y, { timeout: 3000 })
    assert.ok((await position()).y < initial.y - 10, `${name}: simultaneous jump does not rise`)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [movement] })
    await page.waitForTimeout(60)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await page.waitForTimeout(600)
    const released = await position()
    await page.waitForTimeout(200)
    assert.equal((await position()).x, released.x, `${name}: stick remains held after release`)
    const jumpButton = game.getByRole("button", { name: "Jump", exact: true })
    const grounded = await position()
    await jumpButton.tap()
    await page.waitForTimeout(100)
    assert.ok((await position()).y < grounded.y - 4, `${name}: a quick touch tap must jump`)
    await page.waitForTimeout(600)
    await jumpButton.focus()
    const keyboardGrounded = await position()
    await page.keyboard.press("Space")
    await page.waitForTimeout(100)
    assert.ok((await position()).y < keyboardGrounded.y - 4, `${name}: focused Jump must accept Space`)
    await page.waitForTimeout(600)
    await game.getByRole("button", { name: "Pause Downtown Dig", exact: true }).click()
    assert.equal(await game.getAttribute("data-phase"), "paused")
    await page.waitForTimeout(150)
    const paused = await position()
    await page.waitForTimeout(200)
    assert.deepEqual(await position(), paused)
    await game.getByRole("button", { name: "Buttons", exact: true }).click()
    await game.getByRole("button", { name: "Resume", exact: true }).click()
    await game.getByRole("button", { name: "Move left", exact: true }).waitFor()
    const field = await canvas.boundingBox(), controls = await game.getByRole("button", { name: "Jump", exact: true }).boundingBox()
    assert.ok(field.width >= 220 && field.height >= 130, `${name}: game field is too small`)
    assert.ok(field.y >= 0 && field.y + field.height <= height - 40 && controls.y + controls.height <= height - 40, `${name}: game and jump must be visible together`)
    await page.screenshot({ path: `${out}/${name}-brooklyn-dig.png` })
    await game.getByRole("button", { name: "Skip to the crate", exact: true }).click()
    const crate = page.locator('[aria-roledescription="record crate"]')
    const first = await crate.getAttribute("aria-label")
    await page.getByRole("button", { name: "Next record", exact: true }).click()
    assert.notEqual(await crate.getAttribute("aria-label"), first)
    await page.getByRole("button", { name: "Previous record", exact: true }).click()
    assert.equal(await crate.getAttribute("aria-label"), first)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.deepEqual(errors, [])
    console.info(`PASS ${name}: ? block opens, stick + jump, quick tap and focused Space jump, neutral release, pause, button option, record crate navigation`)
    await context.close()
  }
} finally {
  await browser.close()
}
