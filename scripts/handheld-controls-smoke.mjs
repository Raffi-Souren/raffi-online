import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { chromium } from "playwright"

const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3000"
const output = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/handheld-controls-qa"
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
const errors = []
const reports = []
try {
  for (const [name, width, height] of [["desktop", 1280, 900], ["phone", 390, 844], ["small-phone", 360, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: name !== "desktop", hasTouch: true })
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    await page.route("**/api/scores**", (route) => route.fulfill({ json: { scores: [] } }))
    // Observe rendered coordinates without changing production game state.
    await page.addInitScript(() => {
      const fill = CanvasRenderingContext2D.prototype.fillRect
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
        if (this.fillStyle === "#1a5c1a" && w === 18 && h === 18) {
          this.canvas.dataset.playerX = String(x - 1)
          this.canvas.dataset.playerY = String(y - 1)
        }
        return fill.call(this, x, y, w, h)
      }
      const arc = CanvasRenderingContext2D.prototype.arc
      CanvasRenderingContext2D.prototype.arc = function (x, y, radius, ...rest) {
        if (radius === 18) {
          this.canvas.dataset.playerX = String(x)
          this.canvas.dataset.playerY = String(y + 15)
        }
        return arc.call(this, x, y, radius, ...rest)
      }
    })
    const cdp = await context.newCDPSession(page)
    const touch = async (element, horizontal, vertical, duration = 150) => {
      await element.scrollIntoViewIfNeeded()
      const box = await element.boundingBox()
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart", touchPoints: [{ x: box.x + box.width * horizontal, y: box.y + box.height * vertical, id: 1 }],
      })
      await page.waitForTimeout(duration)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    }
    await page.goto(base + "/?app=games", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Play Snake", exact: true }).click()
    let console = page.getByRole("region", { name: "Snake handheld console", exact: true })
    let canvas = console.locator("canvas")
    const position = () => canvas.evaluate((element) => ({ x: Number(element.dataset.playerX), y: Number(element.dataset.playerY) }))
    await console.getByRole("button", { name: "Start or pause game", exact: true }).first().click()
    await touch(console.getByRole("group", { name: "Snake movement stick", exact: true }), 0.5, 0.2, 140)
    assert.ok((await position()).y < 200, "Snake thumbstick must turn upwards")
    await page.getByRole("button", { name: "Pause", exact: true }).click()
    const paused = await position()
    await page.waitForTimeout(180)
    assert.deepEqual(await position(), paused, "Snake must remain paused")
    await console.getByRole("button", { name: "Buttons", exact: true }).click()
    assert.equal(await console.getByRole("button", { name: "Move left", exact: true }).isDisabled(), true)
    await page.getByRole("button", { name: "Restart", exact: true }).click()
    await console.getByRole("button", { name: "Move down", exact: true }).dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 4 })
    await page.waitForTimeout(140)
    await console.getByRole("button", { name: "Move down", exact: true }).dispatchEvent("pointerup", { pointerType: "touch", pointerId: 4 })
    assert.ok((await position()).y > 200, "Snake buttons must remain usable")
    await page.getByRole("button", { name: "Pause", exact: true }).click()
    const snakeBounds = await canvas.boundingBox()
    const downBounds = await console.getByRole("button", { name: "Move down", exact: true }).boundingBox()
    assert.ok(snakeBounds.y >= 45 && downBounds.y + downBounds.height <= height - 40, "Snake field and complete D-pad should fit together")
    await page.screenshot({ path: `${output}/${name}-snake.png` })

    await page.goto(base + "/?app=games", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Play Parachute", exact: true }).click()
    console = page.getByRole("region", { name: "Parachute handheld console", exact: true })
    canvas = console.locator("canvas")
    await console.getByRole("button", { name: "Start or pause game", exact: true }).first().click()
    await touch(console.getByRole("group", { name: "Parachute movement stick", exact: true }), 0.2, 0.5, 160)
    const afterStick = await position()
    assert.ok(afterStick.x < 190, "Parachute thumbstick must steer left")
    await page.waitForTimeout(150)
    assert.equal((await position()).x, afterStick.x, "Parachute must stop steering on thumb release")
    await page.getByRole("button", { name: "Pause", exact: true }).click()
    const parachutePaused = await position()
    await page.waitForTimeout(150)
    assert.deepEqual(await position(), parachutePaused, "Parachute must freeze on pause")
    await console.getByRole("button", { name: "Buttons", exact: true }).click()
    await page.getByRole("button", { name: "Resume", exact: true }).click()
    await touch(console.getByRole("button", { name: "Move right", exact: true }), 0.5, 0.5, 130)
    assert.ok((await position()).x > afterStick.x + 12, "Parachute buttons must steer")
    await page.getByRole("button", { name: "Pause", exact: true }).click()
    const chuteBounds = await canvas.boundingBox()
    const rightBounds = await console.getByRole("button", { name: "Move right", exact: true }).boundingBox()
    assert.ok(chuteBounds.y >= 45 && rightBounds.y + rightBounds.height <= height - 40, "Parachute field and steering should fit together")
    await page.screenshot({ path: `${output}/${name}-parachute.png` })

    await page.goto(base + "/?app=games", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Play Minesweeper", exact: true }).click()
    const firstCell = page.getByRole("button", { name: "Row 1, column 1: hidden", exact: true })
    await page.getByRole("button", { name: "Tap to flag", exact: true }).click()
    await firstCell.tap()
    await page.getByRole("button", { name: "Row 1, column 1: flagged", exact: true }).tap()
    await firstCell.waitFor()
    await page.getByRole("button", { name: "Tap to reveal", exact: true }).click()
    await touch(firstCell, 0.5, 0.5, 650)
    await page.getByRole("button", { name: "Row 1, column 1: flagged", exact: true }).waitFor()
    await page.getByRole("button", { name: "New Game", exact: true }).click()
    await firstCell.tap()
    assert.equal(await page.getByText("You hit a mine!", { exact: true }).count(), 0, "first Minesweeper reveal must be safe")
    await page.getByRole("button", { name: "Larger cells", exact: true }).click()
    const cellSize = await page.getByRole("button", { name: /^Row 1, column 1:/ }).boundingBox()
    assert.ok(cellSize.width >= 43 && cellSize.height >= 43, "larger Minesweeper cells need finger-sized targets")
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Minesweeper zoom must scroll inside its board")
    await page.screenshot({ path: `${output}/${name}-minesweeper.png` })
    reports.push(`${name}: Snake stick/buttons/pause, Parachute proportional steering/release/buttons/pause, Minesweeper flag mode/hold/safe first reveal/larger cells`)
    await context.close()
  }
  assert.deepEqual(errors, [])
  process.stdout.write(reports.join("\n") + "\n")
} finally {
  await fs.writeFile(`${output}/report.json`, JSON.stringify({ reports, errors }, null, 2))
  await browser.close()
}
