import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { chromium } from "playwright"

const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3000"
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/crate-quest-mobile-qa"
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
const errors = []
try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    // Observe real drawing coordinates without changing the game state.
    await page.addInitScript(() => {
      const fill = CanvasRenderingContext2D.prototype.fillRect
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
        if (this.fillStyle === "#cf875f" && width === 12 && height === 12) {
          this.canvas.dataset.playerX = String((x + 6) / 24)
          this.canvas.dataset.playerY = String((y + 9) / 24)
        }
        return fill.call(this, x, y, width, height)
      }
    })
    await page.goto(base + "/?app=world", { waitUntil: "domcontentloaded" })
    const iframe = page.locator('iframe[title="RAFFI WORLD"]')
    await iframe.waitFor()
    const frame = await (await iframe.elementHandle()).contentFrame()
    // Exercise the existing origin/source-checked entry message from its real iframe.
    await frame.evaluate(() => parent.postMessage({ type: "raffi-world:crate-quest", action: "open" }, location.origin))
    const quest = page.getByRole("region", { name: "Crate Quest — record shop mission", exact: true })
    const canvas = quest.locator("canvas")
    await quest.getByRole("button", { name: "Start digging", exact: true }).click()
    await page.waitForFunction((element) => !!element.dataset.playerX, await canvas.elementHandle())
    const area = await canvas.boundingBox()
    assert.ok(area.height >= 180, `Crate Quest playfield collapsed at ${width}×${height}: ${area.height}px`)
    assert.equal(await quest.locator("footer").evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true)
    const position = () => canvas.evaluate((element) => ({ x: Number(element.dataset.playerX), y: Number(element.dataset.playerY) }))
    const cdp = await context.newCDPSession(page)
    const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints })
    const point = async (control, fraction, id) => {
      const box = await control.boundingBox()
      assert.ok(box.y >= 0 && box.y + box.height <= height, "movement control is outside the viewport")
      return { id, x: box.x + box.width * fraction, y: box.y + box.height / 2 }
    }
    const still = async () => {
      await page.waitForTimeout(90)
      const released = await position()
      await page.waitForTimeout(180)
      assert.deepEqual(await position(), released, "released control kept moving")
      return released
    }
    const stick = quest.getByRole("group", { name: "Crate Quest walking stick", exact: true })
    let before = await position()
    await touch("touchStart", [await point(stick, .85, 1)])
    await page.waitForTimeout(280)
    await touch("touchEnd", [])
    assert.ok((await still()).x > before.x + .45, "thumbstick did not walk right")
    before = await position()
    await touch("touchStart", [await point(stick, .15, 2)])
    await page.waitForTimeout(220)
    await touch("touchCancel", [])
    assert.ok((await still()).x < before.x - .3, "thumbstick did not walk left")

    await touch("touchStart", [await point(stick, .85, 3)])
    await quest.getByRole("button", { name: "Pause hunt", exact: true }).click()
    await touch("touchCancel", [])
    const paused = await still()
    await canvas.focus()
    await page.keyboard.down("ArrowRight")
    await page.waitForTimeout(180)
    await page.keyboard.up("ArrowRight")
    assert.deepEqual(await position(), paused, "paused hunt accepted movement")
    await quest.getByRole("button", { name: "Resume hunt", exact: true }).last().click()
    await still()

    await touch("touchStart", [await point(stick, .85, 4)])
    await quest.getByRole("button", { name: "Buttons", exact: true }).click()
    await touch("touchCancel", [])
    await still()
    const left = quest.getByRole("button", { name: "Walk left", exact: true })
    assert.ok((await left.boundingBox()).height >= 44)
    before = await position()
    await touch("touchStart", [await point(left, .5, 5)])
    await page.waitForTimeout(230)
    await touch("touchEnd", [])
    assert.ok((await still()).x < before.x - .35, "arrow option did not walk left")
    assert.equal(await quest.locator("footer").evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true)
    await quest.getByRole("button", { name: "Thumbstick", exact: true }).click()
    await still()
    await page.screenshot({ path: `${out}/${width}x${height}.png` })
    process.stdout.write(`Crate Quest ${width}×${height}: ${area.height}px playfield, stick/arrows, release/cancel, pause and control switches passed.\n`)
    await context.close()
  }
  assert.deepEqual(errors, [])
} catch (error) {
  process.stderr.write(error.stack + "\n")
  process.exitCode = 1
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: out + "/failure.png" }).catch(() => {})
} finally {
  await browser.close()
}
