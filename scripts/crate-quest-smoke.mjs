// Run npm test first to compile the shared engine used for pathfinding.
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
const require = createRequire(new URL("../package.json", import.meta.url))
const { chromium } = require("playwright")
const engine = require("./.test-build/lib/crate-quest-engine.js")
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/raffi-crate-quest-qa"
const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3000"
await fs.mkdir(out, { recursive: true })
const report = { checks: [], errors: [] }
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
const pass = (text) => {
  report.checks.push(text)
  console.info("PASS " + text)
}
try {
  for (const [name, width, height, touch] of [
    ["desktop", 1280, 900, false],
    ["phone", 390, 844, true],
    ["landscape", 844, 390, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch })
    const page = await context.newPage()
    page.on("pageerror", (e) => report.errors.push(e.message))
    // Test-only telemetry observes the player's actual draw calls; production has no test hooks.
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.fillRect
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
        if (this.fillStyle === "#cf875f" && width === 12 && height === 12) {
          this.canvas.dataset.playerX = String((x + 6) / 24)
          this.canvas.dataset.playerY = String((y + 9) / 24)
        }
        return original.call(this, x, y, width, height)
      }
    })
    await page.goto(base + "/?app=world&auto=1&debug=1&seed=FIXED", { waitUntil: "domcontentloaded" })
    await page.locator('iframe[title="RAFFI WORLD"]').waitFor()
    const frame = page.frames().find((frame) => frame.url().includes("/world/index.html"))
    assert.ok(frame)
    await frame.waitForFunction(() => window.RAFFI_WORLD?.ready, { timeout: 120000 })
    await frame.evaluate(async () => {
      window.RAFFI_WORLD.dismissDialogue()
      const { teleportPlayer } = await import("/world/game/player.js")
      teleportPlayer(-60, 112, 0)
    })
    await frame
      .locator("#interaction-label")
      .filter({ hasText: "DIG THE BACK-ROOM CRATES" })
      .waitFor({ timeout: 10000 })
    const before = await frame.evaluate(() => window.RAFFI_WORLD.getState().player)
    await page.locator('iframe[title="RAFFI WORLD"]').focus()
    await page.keyboard.press("e")
    const quest = page.getByRole("region", { name: "Crate Quest — record shop mission", exact: true })
    await quest.getByRole("button", { name: "Start digging", exact: true }).waitFor()
    await page.screenshot({ path: out + "/" + name + "-intro.png" })
    await quest.getByRole("button", { name: "Start digging", exact: true }).click()
    const canvas = quest.locator("canvas")
    const position = () => canvas.evaluate((el) => ({ x: Number(el.dataset.playerX), y: Number(el.dataset.playerY) }))
    const step = async (code, ms) => {
      await canvas.focus()
      await page.keyboard.down(code)
      await page.waitForTimeout(ms)
      await page.keyboard.up(code)
      await page.waitForTimeout(120)
    }
    await step("ArrowUp", 2200)
    const against = await position()
    assert.ok(against.y >= 14.06 && against.y < 14.3, "held input walked through Mara")
    await quest.getByRole("button", { name: "Talk", exact: true }).click()
    await quest.getByRole("region", { name: "Collector dialogue", exact: true }).waitFor()
    await quest.getByRole("button", { name: "Continue", exact: true }).first().click()
    await page.screenshot({ path: out + "/" + name + "-courtyard.png" })
    if (name === "desktop") {
      const moveTo = async (target) => {
        for (const axis of ["x", "y"])
          for (let attempts = 0; attempts < 12; attempts++) {
            const at = await position(),
              delta = target[axis] - at[axis]
            if (Math.abs(delta) < 0.12) break
            const code = axis === "x" ? (delta > 0 ? "ArrowRight" : "ArrowLeft") : delta > 0 ? "ArrowDown" : "ArrowUp"
            await step(code, Math.max(22, Math.min(360, (Math.abs(delta) / engine.CRATE_QUEST_SPEED) * 1000)))
            if (attempts === 11)
              throw new Error(
                "Movement blocked on " +
                  axis +
                  " to " +
                  JSON.stringify(target) +
                  " from " +
                  JSON.stringify(await position()),
              )
          }
      }
      const visit = async (id) => {
        const entity = engine.QUEST_ENTITIES.find((e) => e.id === id),
          at = await position()
        const start = { x: Math.floor(at.x), y: Math.floor(at.y), path: [] },
          queue = [start],
          seen = new Set([start.x + "," + start.y])
        let route
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i]
          if (Math.hypot(p.x + 0.5 - entity.x, p.y + 0.5 - entity.y) <= 1.05) {
            route = p.path
            break
          }
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const x = p.x + dx,
              y = p.y + dy,
              key = x + "," + y
            if (seen.has(key) || !engine.canWalkCrateQuest(x + 0.5, y + 0.5)) continue
            seen.add(key)
            queue.push({ x, y, path: [...p.path, { x: x + 0.5, y: y + 0.5 }] })
          }
        }
        assert.ok(route)
        await moveTo({ x: start.x + 0.5, y: start.y + 0.5 })
        for (const p of route) await moveTo(p)
        await quest.getByRole("status").filter({ hasText: entity.label }).waitFor({ timeout: 3000 })
        await canvas.focus()
        await page.keyboard.press("e")
        if (id !== "mara") {
          await quest.getByRole("region", { name: "Collector dialogue", exact: true }).waitFor()
          await quest.getByRole("button", { name: "Continue", exact: true }).first().click()
        }
      }
      await visit("warmup-bin")
      await page.screenshot({ path: out + "/desktop-shop.png" })
      await visit("peak-bin")
      await visit("milo")
      await visit("yard-bin")
      for (const role of ["Warm-up", "Peak-time", "Closer"])
        await quest.getByText(role + " ✓", { exact: true }).waitFor()
      await visit("mara")
      await quest.getByRole("region", { name: "Set complete", exact: true }).waitFor()
      assert.equal(
        (await frame.evaluate(() => window.RAFFI_WORLD.missionSnapshot().completed)).includes("crate-quest"),
        false,
      )
      await page.screenshot({ path: out + "/desktop-complete.png" })
      await quest.getByRole("button", { name: "Return to Raffi World", exact: true }).click()
      await quest.waitFor({ state: "detached" })
      await frame.waitForFunction(() => window.RAFFI_WORLD.missionSnapshot().completed.includes("crate-quest"))
      pass(
        "Desktop: real keyboard full hunt, three unique records, Milo clue, explicit finish then World mission completion",
      )
    } else {
      const old = await position()
      const cdpsession = await context.newCDPSession(page)
      const box = await quest.getByRole("button", { name: "Walk right", exact: true }).boundingBox()
      await cdpsession.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
      })
      await page.waitForTimeout(450)
      await cdpsession.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await page.waitForTimeout(120)
      assert.ok((await position()).x > old.x + 0.5, "touch pad did not move player")
      await quest.getByRole("button", { name: "Pause hunt", exact: true }).click()
      const paused = await position()
      await step("ArrowDown", 350)
      assert.deepEqual(await position(), paused)
      await quest.getByRole("button", { name: "Resume hunt", exact: true }).last().click()
      await quest.getByRole("button", { name: "Pause hunt", exact: true }).click()
      await quest.getByRole("button", { name: "Start over", exact: true }).click()
      await quest.getByRole("button", { name: "Start digging", exact: true }).waitFor()
      // The React intro can appear before the next canvas animation frame.
      await page.waitForFunction(
        (el) => Number(el.dataset.playerX) === 14.5 && Number(el.dataset.playerY) === 16.5,
        await canvas.elementHandle(),
      )
      assert.deepEqual(await position(), { x: 14.5, y: 16.5 })
      await quest.getByRole("button", { name: "Leave hunt", exact: true }).click()
      await quest.waitFor({ state: "detached" })
      assert.equal(
        (await frame.evaluate(() => window.RAFFI_WORLD.missionSnapshot().completed)).includes("crate-quest"),
        false,
      )
      pass(
        name +
          ": touch movement, solid NPC contact, dialogue, pause freeze, fresh restart and exit without mission credit",
      )
    }
    const after = await frame.evaluate(() => window.RAFFI_WORLD.getState().player)
    assert.ok(
      Math.abs(after.x - before.x) < 0.05 && Math.abs(after.z - before.z) < 0.05,
      "World return position changed",
    )
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await context.close()
  }
  assert.deepEqual(report.errors, [])
} catch (error) {
  report.failure = error.stack
  console.error(error)
  process.exitCode = 1
  for (const context of browser.contexts())
    for (const page of context.pages()) await page.screenshot({ path: out + "/failure.png" }).catch(() => {})
} finally {
  await fs.writeFile(out + "/report.json", JSON.stringify(report, null, 2))
  await browser.close()
}
