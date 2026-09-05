import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
const require = createRequire(new URL("../package.json", import.meta.url))
const { chromium } = require("playwright")
const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3000"
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/brickbreaker-qa"
await fs.mkdir(out, { recursive: true })
const report = { checks: [], errors: [], publicPosts: 0 }
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, width, height] of [
    ["desktop", 1280, 900],
    ["phone", 390, 844],
    ["small-phone", 360, 800],
    ["landscape", 844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: name !== "desktop",
      hasTouch: name !== "desktop",
    })
    const page = await context.newPage()
    page.on("pageerror", (error) => report.errors.push(error.message))
    await page.route("**/api/scores**", (route) => {
      if (route.request().method() === "POST") report.publicPosts++
      return route.fulfill({ json: { scores: [], success: true } })
    })
    // Test-only observation of actual canvas drawing; no production hooks or game-state mutations.
    await page.addInitScript(() => {
      const arc = CanvasRenderingContext2D.prototype.arc
      CanvasRenderingContext2D.prototype.arc = function (x, y, radius, ...rest) {
        if (radius === 4.5) {
          this.canvas.dataset.ballX = String(x)
          this.canvas.dataset.ballY = String(y)
        }
        return arc.call(this, x, y, radius, ...rest)
      }
      const fill = CanvasRenderingContext2D.prototype.fillRect
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
        if (w === 20 && h === 3 && y === 426) this.canvas.dataset.paddle = String(x + 10)
        return fill.call(this, x, y, w, h)
      }
    })
    await page.goto(base + "/?app=games", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Play Brick Breaker", exact: true }).click()
    const game = page.getByRole("region", { name: "Brickbreaker arcade", exact: true })
    const canvas = game.locator("canvas")
    await game.getByRole("button", { name: "Start campaign", exact: true }).waitFor()
    await page.screenshot({ path: `${out}/${name}-menu.png` })
    await game.getByRole("button", { name: "Start campaign", exact: true }).click()
    await page.waitForTimeout(250)
    const position = () =>
      canvas.evaluate((el) => ({
        x: Number(el.dataset.ballX),
        y: Number(el.dataset.ballY),
        paddle: Number(el.dataset.paddle),
      }))
    const serving = await position()
    await page.waitForTimeout(150)
    assert.deepEqual(await position(), serving, "serve must wait for an explicit launch")
    if (name === "desktop") {
      await canvas.focus()
      await page.keyboard.down("ArrowRight")
      await page.waitForTimeout(160)
      await page.keyboard.up("ArrowRight")
    } else {
      const slider = game.getByRole("slider", { name: "Paddle position" })
      await slider.scrollIntoViewIfNeeded()
      const box = await slider.boundingBox(),
        cdp = await context.newCDPSession(page)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width * 0.3, y: box.y + box.height / 2, id: 1 }],
      })
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: box.x + box.width * 0.55, y: box.y + box.height / 2, id: 1 }],
      })
      await page.waitForTimeout(200)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    }
    assert.ok((await position()).paddle > serving.paddle + 20, "keyboard or relative touch steering failed")
    await game.getByRole("button", { name: "Launch or fire", exact: true }).click()
    await page.waitForTimeout(450)
    assert.ok((await position()).y < serving.y - 50, "launch did not send the ball upward")
    await game.getByRole("button", { name: "Pause Brickbreaker", exact: true }).click()
    await page.waitForTimeout(100)
    const paused = await position()
    await page.waitForTimeout(250)
    assert.deepEqual(await position(), paused, "pause moved the ball")
    await game.getByRole("button", { name: "Controls", exact: true }).click()
    await game.getByText("Rockets +3", { exact: true }).waitFor()
    await game.getByRole("button", { name: "Back to game", exact: true }).click()
    await game.getByRole("button", { name: "Resume", exact: true }).click()
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${out}/${name}-playing.png` })
    const fieldBounds = await canvas.boundingBox()
    const fireBounds = await game.getByRole("button", { name: "Launch or fire", exact: true }).boundingBox()
    assert.ok(fieldBounds.y >= 0 && fieldBounds.y + fieldBounds.height <= height - 40, "playfield is clipped by the taskbar")
    assert.ok(fireBounds.y + fireBounds.height <= height - 40, "fire control is clipped by the taskbar")
    await canvas.focus()
    await page.keyboard.press("p")
    await game.getByRole("button", { name: "Restart run", exact: true }).click()
    await page.waitForTimeout(150)
    assert.equal(await game.locator("[data-bb-score]").innerText(), "0")
    assert.match(await game.getByLabel("Game status").innerText(), /3\s*\/\s*0/)
    assert.equal((await position()).paddle, 180)
    await game.getByRole("button", { name: "Pause Brickbreaker", exact: true }).click()
    await game.getByRole("button", { name: "Menu", exact: true }).click()
    await game.getByRole("button", { name: "Practice", exact: true }).click()
    assert.equal(
      await game.getByRole("button", { name: "Practice level 2: Split signal", exact: true }).isDisabled(),
      true,
    )
    await game.getByRole("button", { name: "Practice level 1: First contact", exact: true }).click()
    await game.getByText("PRACTICE · 01 / First contact", { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    report.checks.push(
      `${name}: waiting serve, keyboard/touch steering, launch, pause, help, resume, fresh restart, locked practice levels, no horizontal overflow`,
    )
    console.info("PASS " + report.checks.at(-1))
    await context.close()
  }
  assert.deepEqual(report.errors, [])
  assert.equal(report.publicPosts, 0)
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
