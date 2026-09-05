import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { chromium } from "playwright"

const base = process.env.RAFFI_APP_URL || "http://localhost:3005"
const out = process.env.RAFFI_SMOKE_OUT || "/tmp/signal-lost-smoke"
await fs.mkdir(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  for (const [name, width, height, touch] of [
    ["desktop", 1280, 900, false],
    ["mobile", 390, 844, true],
    ["landscape", 844, 390, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${base}/?app=games`, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: /Signal Lost/ }).click()
    await page.getByRole("button", { name: "Enter the substation" }).click()
    const game = page.locator('[data-game="signal-lost"]')
    const view = game.locator("canvas")
    await page.waitForTimeout(250)
    assert.equal(await game.getAttribute("data-phase"), "playing")
    const initialFrame = await view.screenshot()

    if (touch) {
      const cdp = await context.newCDPSession(page)
      const box = await page.getByRole("button", { name: "Move forward", exact: true }).boundingBox()
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
      })
      await page.waitForTimeout(700)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await page.getByRole("button", { name: "Fire pulse blaster" }).tap()
    } else {
      await page.keyboard.down("w")
      await page.waitForTimeout(700)
      await page.keyboard.up("w")
      await page.keyboard.press("Space")
      // Regression: combining mouse pointer lock with capture used to throw
      // InvalidStateError on the first click into the game.
      await view.click()
      await page.mouse.move(480, 320)
      await page.mouse.down()
      await page.waitForTimeout(150)
      await page.mouse.up()
    }
    await page.waitForTimeout(100)
    assert.notDeepEqual(await view.screenshot(), initialFrame, "movement/fire did not change the rendered game")
    await page.screenshot({ path: `${out}/${name}-playing.png` })

    if (touch) await page.getByRole("button", { name: "Pause Signal Lost" }).click()
    else await page.keyboard.press("p")
    await page.getByRole("button", { name: "Resume transmission" }).waitFor()
    assert.equal(await game.getAttribute("data-phase"), "paused")
    const pausedFrame = await view.screenshot()
    await page.waitForTimeout(350)
    assert.deepEqual(await view.screenshot(), pausedFrame, "paused simulation continued rendering changes")
    await page.getByRole("button", { name: "Resume transmission" }).click()
    assert.equal(await game.getAttribute("data-phase"), "playing")
    await page.getByRole("button", { name: "Pause Signal Lost" }).click()
    await page.getByRole("button", { name: "Restart", exact: true }).click()
    assert.match(await game.innerText(), /Sector 1 \/ 3/)

    if (!touch) {
      await page.locator('[data-game="signal-lost"][data-phase="lost"]').waitFor({ timeout: 45000 })
      await page.getByRole("button", { name: "Run it again" }).click()
      assert.equal(await game.getAttribute("data-phase"), "playing")
      await view.click()
      await page.mouse.move(640, 350)
      await page.keyboard.press("Space")
      await page.keyboard.press("p")
    } else await page.getByRole("button", { name: "Pause Signal Lost" }).click()
    assert.deepEqual(errors, [], `${name} runtime errors`)
    console.info(`Signal Lost ${name}: input, pause and restart passed`)
    await context.close()
  }
} finally {
  await browser.close()
}
