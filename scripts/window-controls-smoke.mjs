import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(new URL("../package.json", import.meta.url))
const { chromium } = require("playwright")
const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3100"
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/raffi-window-qa"
await fs.mkdir(out, { recursive: true })
const report = { checks: [], failures: [], errors: [], interceptedScorePosts: 0 }
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
const shell = (page, app) => page.locator(`[role="dialog"][data-window-id="${app}"]`)
const task = (page, app) => page.locator(`[data-window-task="${app}"]`)
const pause = (page) => page.waitForTimeout(120)
async function check(name, page, run) {
  if (process.env.RAFFI_QA_FILTER && !new RegExp(process.env.RAFFI_QA_FILTER).test(name)) return
  try {
    await run()
    report.checks.push(name)
    console.info(`PASS ${name}`)
  } catch (error) {
    const dom = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][data-window-id="games"]')
      const card = dialog?.querySelector('button[aria-label="Play Minesweeper"]')
      const ancestors = []
      for (let element = card ?? dialog; element; element = element.parentElement) {
        const style = getComputedStyle(element)
        ancestors.push({ tag: element.tagName, ariaHidden: element.getAttribute("aria-hidden"), inert: element.hasAttribute("inert"), display: style.display, visibility: style.visibility })
      }
      return {
        url: location.href,
        gameTaskState: document.querySelector('[data-window-task="games"]')?.getAttribute("data-window-state"),
        gameShellModal: dialog?.getAttribute("aria-modal"),
        gameButtonLabels: Array.from(dialog?.querySelectorAll("button") ?? []).map((button) => button.getAttribute("aria-label") ?? button.textContent?.trim()),
        minesweeperCount: dialog?.querySelectorAll('button[aria-label="Play Minesweeper"]').length,
        minesweeperHtml: card?.outerHTML,
        ancestors,
      }
    }).catch((failure) => ({ unavailable: failure.message }))
    const minesweeperRoleCount = await page.getByRole("button", { name: "Play Minesweeper", exact: true }).count().catch(() => null)
    report.failures.push({ name, error: error.stack, dom, minesweeperRoleCount })
    console.error(`FAIL ${name}: ${error.message}`)
    await page.screenshot({ path: `${out}/${name.replace(/[^a-z0-9-]+/gi, "-")}-failure.png` }).catch(() => {})
  }
}
async function open(page, app, query = "") {
  await page.goto(`${base}/?app=${app}${query}`, { waitUntil: "domcontentloaded" })
  await shell(page, app).waitFor({ state: "visible", timeout: 60000 })
  await task(page, app).waitFor()
  // Visible chrome can arrive before its activity/focus contract settles.
  // Wait for the usable app, rather than giving a role query a fixed head start.
  await page.waitForFunction((app) => {
    const dialog = document.querySelector(`[role="dialog"][data-window-id="${app}"]`)
    const button = document.querySelector(`[data-window-task="${app}"]`)
    return button?.getAttribute("data-window-state") === "active"
      && dialog?.getAttribute("aria-modal") === "true"
      && !dialog.closest('[aria-hidden="true"], [inert]')
  }, app)
  // Projects loads inside a parent-owned shell, so its initial shell can be
  // visible before the dynamic content has established its natural height.
  if (app === "projects") await shell(page, app).getByRole("heading", { name: "Projects", exact: true }).waitFor()
  return shell(page, app)
}
async function bounds(page, dialog, name) {
  const viewport = page.viewportSize()
  const box = await dialog.boundingBox()
  const bar = await page.getByRole("region", { name: "Desktop taskbar", exact: true }).boundingBox()
  assert.ok(box && bar, `${name}: missing visible window/taskbar bounds`)
  assert.ok(box.x >= -1 && box.y >= -1, `${name}: window starts outside viewport`)
  assert.ok(box.x + box.width <= viewport.width + 1, `${name}: window exceeds viewport width`)
  assert.ok(box.y + box.height <= bar.y + 1, `${name}: window overlaps taskbar`)
  const controls = dialog.getByRole("group", { name: "Window controls", exact: true })
  assert.equal(await controls.getByRole("button").count(), 3, `${name}: expected red/yellow/green controls`)
  for (const button of await controls.getByRole("button").all()) {
    const b = await button.boundingBox()
    assert.ok(b && b.width >= 36 && b.height >= 36, `${name}: control is too small or hidden`)
    assert.ok(b.x >= box.x && b.x + b.width <= box.x + box.width + 1, `${name}: title control clipped`)
    assert.ok(b.y >= box.y && b.y + b.height <= bar.y + 1, `${name}: control is outside usable viewport`)
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  return box
}
async function minimize(page, app) {
  const dialog = shell(page, app)
  await dialog.getByRole("group", { name: "Window controls" }).getByRole("button", { name: /^Minimize / }).click()
  await dialog.waitFor({ state: "hidden" })
  assert.equal(await task(page, app).getAttribute("data-window-state"), "minimized")
  assert.match(await task(page, app).getAttribute("aria-label"), /^Restore /)
  assert.equal(await dialog.count(), 1, `${app}: minimize unmounted component`)
  assert.equal(await dialog.evaluate((node) => Boolean(node.closest('[aria-hidden="true"]'))), true)
  await page.waitForFunction((app) => document.activeElement?.getAttribute("data-window-task") === app, app)
}
async function restore(page, app) {
  await task(page, app).click()
  const dialog = shell(page, app)
  await dialog.waitFor({ state: "visible" })
  await page.waitForFunction((app) => document.querySelector(`[data-window-id="${app}"]`)?.contains(document.activeElement), app)
  assert.equal(await task(page, app).getAttribute("data-window-state"), "active")
  return dialog
}
try {
  for (const [name, width, height] of [
    ["desktop", 1280, 900],
    ["phone", 393, 852],
    ["small-phone", 320, 640],
    ["landscape", 852, 393],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: name !== "desktop", hasTouch: name !== "desktop" })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", (error) => report.errors.push({ viewport: name, error: error.message }))
    await page.route("**/*", (route) => {
      const request = route.request(), url = new URL(request.url())
      if (url.pathname.startsWith("/api/scores")) {
        if (request.method() === "POST") report.interceptedScorePosts++
        return route.fulfill({ json: { scores: [], success: true } })
      }
      if (url.pathname === "/api/raf-os") return route.fulfill({ json: { available: false, providers: [] } })
      if (url.origin !== new URL(base).origin) return route.abort()
      return route.continue()
    })
    // Observe real render output; no production hooks or game-state changes.
    await page.addInitScript(() => {
      const fill = CanvasRenderingContext2D.prototype.fillRect
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
        if (w === 20 && h === 3 && y === 426) this.canvas.dataset.qaPaddle = String(x + 10)
        return fill.call(this, x, y, w, h)
      }
      const arc = CanvasRenderingContext2D.prototype.arc
      CanvasRenderingContext2D.prototype.arc = function (x, y, radius, ...rest) {
        if (radius === 4.5) this.canvas.dataset.qaBall = JSON.stringify([x, y])
        return arc.call(this, x, y, radius, ...rest)
      }
    })
    for (const app of ["notes", "blogroll", "about", "projects", "ipod", "crates", "games", "startup", "counter"]) {
      await check(`${name}-${app}-controls`, page, async () => {
        const dialog = await open(page, app)
        const original = await bounds(page, dialog, app)
        await dialog.getByRole("button", { name: "Maximize window", exact: true }).click()
        const expanded = await bounds(page, dialog, `${app} maximized`)
        assert.ok(expanded.width >= original.width && expanded.height >= original.height, `${app}: maximize shrank window`)
        await page.screenshot({ path: `${out}/${name}-${app}-maximized.png` })
        await dialog.getByRole("button", { name: "Restore window", exact: true }).click()
        const restored = await bounds(page, dialog, `${app} restored`)
        for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(restored[key] - original[key]) < 2, `${app}: restore changed ${key}: ${JSON.stringify({ original, restored })}`)
        await minimize(page, app)
        await restore(page, app)
        await task(page, app).click()
        await dialog.waitFor({ state: "hidden" })
        assert.equal(await task(page, app).getAttribute("data-window-state"), "minimized")
        await restore(page, app)
        await dialog.getByRole("button", { name: "Close window", exact: true }).click()
        await task(page, app).waitFor({ state: "detached" })
        await dialog.waitFor({ state: "hidden" })
        await page.waitForFunction((app) => {
          const launcher = document.querySelector(`[data-desktop-app="${app}"] button`)
          return document.activeElement === (launcher || document.querySelector('button[aria-label="Start menu"]'))
        }, app)
      })
    }
    await check(`${name}-blogroll-filter-and-notes-tab`, page, async () => {
      const blog = await open(page, "blogroll")
      await blog.getByRole("textbox", { name: "Search sites", exact: true }).fill("music")
      await minimize(page, "blogroll")
      await restore(page, "blogroll")
      assert.equal(await blog.getByRole("textbox", { name: "Search sites", exact: true }).inputValue(), "music")
      // Notes has category tabs, rather than a text filter.
      const notes = await open(page, "notes")
      await notes.getByRole("button", { name: "🎓 Papers", exact: true }).click()
      await minimize(page, "notes")
      await restore(page, "notes")
      assert.equal(await notes.getByRole("button", { name: "🎓 Papers", exact: true }).getAttribute("aria-pressed"), "true")
    })
    await check(`${name}-crate-quick-launch-preserves-session`, page, async () => {
      const dialog = await open(page, "crates")
      const currentTitle = () => dialog.locator("h2").last().innerText()
      const before = await currentTitle()
      const handle = await dialog.elementHandle()
      await minimize(page, "crates")
      await page.getByRole("button", { name: "Digging in the Crates", exact: true }).click()
      await dialog.waitFor({ state: "visible" })
      assert.equal(await currentTitle(), before, "restoring crate selected another track")
      assert.ok(await dialog.evaluate((node, old) => node === old, handle))
      await page.getByRole("button", { name: "Digging in the Crates", exact: true }).click()
      assert.equal(await task(page, "crates").getAttribute("data-window-state"), "active", "quick launch minimized active crate")
    })
    await check(`${name}-background-window-switching`, page, async () => {
      const notes = await open(page, "notes")
      await notes.getByRole("button", { name: "🎓 Papers", exact: true }).click()
      await page.getByRole("button", { name: "Start menu", exact: true }).click()
      await page.getByRole("menuitem", { name: "Blogroll", exact: true }).click()
      const blog = shell(page, "blogroll")
      await blog.waitFor({ state: "visible" })
      await blog.getByRole("textbox", { name: "Search sites", exact: true }).fill("music")
      assert.equal(await task(page, "notes").getAttribute("data-window-state"), "background")
      await task(page, "notes").click()
      assert.equal(await task(page, "notes").getAttribute("data-window-state"), "active")
      assert.equal(await notes.getByRole("button", { name: "🎓 Papers", exact: true }).getAttribute("aria-pressed"), "true")
      await notes.getByRole("group", { name: "Window controls" }).getByRole("button", { name: /^Minimize / }).click()
      await notes.waitFor({ state: "hidden" })
      assert.equal(await task(page, "blogroll").getAttribute("data-window-state"), "active")
      await page.waitForFunction(() => document.querySelector('[data-window-id="blogroll"]')?.contains(document.activeElement))
      assert.equal(await blog.getByRole("textbox", { name: "Search sites", exact: true }).inputValue(), "music")
      await page.screenshot({ path: `${out}/${name}-taskbar-switching.png` })
    })
    await check(`${name}-game-pause-and-input-isolation`, page, async () => {
      const dialog = await open(page, "games")
      await page.getByRole("button", { name: "Play Brick Breaker", exact: true }).click()
      const game = dialog.locator('[aria-label="Brickbreaker arcade"]')
      await game.getByRole("button", { name: "Start campaign", exact: true }).click()
      const canvas = game.locator("canvas"), handle = await canvas.elementHandle()
      await game.getByRole("button", { name: "Launch or fire", exact: true }).click()
      await page.waitForTimeout(250)
      await minimize(page, "games")
      await pause(page)
      const pose = () => canvas.evaluate((node) => ({ paddle: node.dataset.qaPaddle, ball: node.dataset.qaBall }))
      const before = await pose()
      await page.keyboard.down("ArrowRight")
      await page.waitForTimeout(220)
      await page.keyboard.up("ArrowRight")
      assert.deepEqual(await pose(), before, "hidden game moved after keyboard input")
      await restore(page, "games")
      assert.ok(await canvas.evaluate((node, old) => node === old, handle), "restoring replaced the selected game")
      await game.getByRole("button", { name: "Resume Brickbreaker", exact: true }).waitFor()
      assert.equal(await dialog.getByRole("button", { name: "Play Brick Breaker", exact: true }).count(), 0)
      await game.getByRole("button", { name: "Resume Brickbreaker", exact: true }).click()
      await game.getByRole("button", { name: "Pause Brickbreaker", exact: true }).waitFor()
      await page.screenshot({ path: `${out}/${name}-game-restored.png` })
      await dialog.getByRole("button", { name: "Close window", exact: true }).click()
      await task(page, "games").waitFor({ state: "detached" })
      await dialog.waitFor({ state: "hidden" })
    })
    await check(`${name}-signal-lost-pause-on-hide`, page, async () => {
      await open(page, "games")
      await page.getByRole("button", { name: "Play Signal Lost", exact: true }).click()
      const game = page.locator('[data-game="signal-lost"]')
      await game.getByRole("button", { name: "Enter the substation", exact: true }).click()
      await page.waitForTimeout(200)
      await minimize(page, "games")
      await page.waitForFunction(() => document.querySelector('[data-game="signal-lost"]')?.getAttribute("data-phase") === "paused")
      const pausedHud = await game.textContent()
      await page.keyboard.down("w")
      await page.waitForTimeout(300)
      await page.keyboard.up("w")
      assert.equal(await game.textContent(), pausedHud, "hidden Signal Lost HUD changed")
      await restore(page, "games")
      assert.equal(await game.getAttribute("data-phase"), "paused")
      await game.getByRole("button", { name: "Resume transmission", exact: true }).click()
      await game.getByRole("button", { name: "Pause Signal Lost", exact: true }).waitFor()
    })
    await check(`${name}-minesweeper-timer-on-hide`, page, async () => {
      const dialog = await open(page, "games")
      await page.getByRole("button", { name: "Play Minesweeper", exact: true }).click()
      await dialog.getByRole("button", { name: "Row 4, column 4: hidden", exact: true }).click()
      const clock = dialog.locator('[aria-label^="Elapsed time "]')
      await page.waitForTimeout(350)
      const seconds = async () => Number((await clock.getAttribute("aria-label")).match(/[\d.]+/)[0])
      assert.ok(await seconds() > 0, "Minesweeper timer did not start")
      await minimize(page, "games")
      const before = await seconds()
      await page.waitForTimeout(750)
      assert.equal(await seconds(), before, "hidden Minesweeper timer advanced")
      await restore(page, "games")
      assert.ok(await seconds() - before < 0.3, "Minesweeper included minimized time")
      await page.waitForTimeout(350)
      assert.ok(await seconds() > before, "Minesweeper timer did not resume")
    })
    if (name === "desktop" || name === "phone") await check(`${name}-world-frame-preservation`, page, async () => {
      const dialog = await open(page, "world", "&debug=1&auto=1&seed=FIXED&lowfi=1")
      const iframe = dialog.locator('iframe[title="RAFFI WORLD"]'), handle = await iframe.elementHandle()
      const frame = await handle.contentFrame()
      await frame.waitForFunction(() => window.RAFFI_WORLD?.ready, undefined, { timeout: 120000 })
      const token = await frame.evaluate(() => {
        window.__windowQaToken = `session-${Math.random()}`
        window.RAFFI_WORLD.dismissDialogue()
        return window.__windowQaToken
      })
      await bounds(page, dialog, "World")
      await minimize(page, "world")
      await pause(page)
      const position = () => frame.evaluate(() => {
        const { x, y, z } = window.RAFFI_WORLD.getState().player
        return { x, y, z }
      })
      const before = await position()
      await page.keyboard.down("ArrowUp")
      await page.waitForTimeout(250)
      await page.keyboard.up("ArrowUp")
      assert.deepEqual(await position(), before, "hidden World accepted movement")
      await restore(page, "world")
      assert.ok(await iframe.evaluate((node, old) => node === old, handle), "World iframe DOM node changed")
      assert.equal(await frame.evaluate(() => window.__windowQaToken), token, "World browsing context reloaded")
      assert.deepEqual(await position(), before, "World restore changed player position")
      await dialog.getByRole("button", { name: "Maximize window", exact: true }).click()
      await bounds(page, dialog, "World maximized")
      await page.screenshot({ path: `${out}/${name}-world-restored.png` })
      await dialog.getByRole("button", { name: "Close window", exact: true }).click()
      await task(page, "world").waitFor({ state: "detached" })
      assert.ok(await handle.evaluate((node) => node.isConnected), "World close destroyed persistent iframe")
      await dialog.waitFor({ state: "hidden" })
    })
    await context.close()
  }
  if (report.failures.length || report.errors.length) process.exitCode = 1
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
