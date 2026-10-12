import assert from "node:assert/strict"
import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fillRect
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      const name = this.canvas.getAttribute("aria-label") || ""
      if (name.startsWith("Brick —") && h === 4) this.canvas.dataset.paddleX = String(x)
      if (name.startsWith("Snake —") && w === 10 && h === 10) this.canvas.dataset.headY = String(y)
      return fill.call(this, x, y, w, h)
    }
    const arc = CanvasRenderingContext2D.prototype.arc
    CanvasRenderingContext2D.prototype.arc = function (x, y, r, ...args) {
      if (this.canvas.getAttribute("aria-label")?.startsWith("Parachute —") && r === 7) this.canvas.dataset.chuteX = String(x)
      return arc.call(this, x, y, r, ...args)
    }
  })
  const cdp = await context.newCDPSession(page)
  for (const [name, id, observed] of [["Brick", "brick", "paddleX"], ["Parachute", "parachute", "chuteX"], ["Snake", "snake", "headY"]]) {
    await page.goto((process.env.RAFFI_APP_URL || "http://127.0.0.1:3000") + "/?app=ipod")
    for (const label of ["Extras", "Games", name]) await page.getByRole("button", { name: label, exact: true }).click()
    const screen = page.locator(`[data-ipod-game="${id}"]`)
    await screen.tap()
    assert.equal(await screen.getAttribute("data-phase"), "playing")
    const canvas = screen.locator("canvas")
    await page.waitForFunction(({ id, observed }) => Number.isFinite(Number(document.querySelector(`[data-ipod-game="${id}"] canvas`)?.dataset[observed])), { id, observed })
    const initial = Number(await canvas.getAttribute(`data-${observed.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`))
    const box = await screen.boundingBox()
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }
    const end = { x: start.x + (id === "snake" ? 0 : box.width * 0.3), y: start.y + (id === "snake" ? 40 : 0), id: 1 }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await page.waitForFunction(({ id, observed, initial }) => Number(document.querySelector(`[data-ipod-game="${id}"] canvas`)?.dataset[observed]) > initial + 4, { id, observed, initial }, { timeout: 3000 })
    await page.getByRole("button", { name: "Pause or resume game", exact: true }).tap()
    assert.equal(await screen.getAttribute("data-phase"), "paused")
    const paused = await canvas.screenshot()
    await page.waitForTimeout(200)
    assert.deepEqual(await canvas.screenshot(), paused)
    await screen.tap()
    assert.equal(await screen.getAttribute("data-phase"), "playing")
    await page.evaluate(() => window.dispatchEvent(new Event("blur")))
    assert.equal(await screen.getAttribute("data-phase"), "paused")
    console.info(`PASS iPod ${name}: screen start, ${id === "snake" ? "directional swipe" : "direct drag"}, click-wheel pause, screen resume, blur pause`)
  }
  assert.deepEqual(errors, [])
} finally { await browser.close() }
