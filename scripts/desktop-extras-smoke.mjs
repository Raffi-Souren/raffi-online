/**
 * Desktop extras smoke: the 404 page and its tape deck, System Properties
 * (opened three ways, reading this device's World progress and scores), the
 * Konami balloon, and finger-sized targets on a phone. SoundCloud is stubbed
 * at its public widget API, so this checks the shared player's wiring, not
 * that a stream is audible.
 */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(new URL("../package.json", import.meta.url))
const { chromium } = require("playwright")
const base = (process.env.RAFFI_APP_URL || "http://127.0.0.1:3100").replace(/\/$/, "")
const origin = new URL(base).origin
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/raffi-desktop-extras"
await fs.mkdir(out, { recursive: true })

const soundCloudFixture = `(() => {
  const events = { READY: "READY", PLAY_PROGRESS: "PLAY_PROGRESS", PLAY: "PLAY", FINISH: "FINISH", ERROR: "ERROR" };
  const evidence = window.__deckFixture = { calls: [], lastUrl: null };
  function Widget(iframe) {
    const listeners = new Map();
    try { evidence.lastUrl = new URL(iframe.src).searchParams.get("url"); } catch {}
    const emit = (event, value = {}) => setTimeout(() => listeners.get(event)?.(value), 0);
    return {
      bind(event, listener) { listeners.set(event, listener); if (event === events.READY) emit(events.READY); },
      unbind(event) { listeners.delete(event); },
      play() { evidence.calls.push("play"); emit(events.PLAY); },
      pause() { evidence.calls.push("pause"); },
      seekTo() {},
      setVolume() {},
      getDuration(callback) { callback(180000); },
      load(url, options) { evidence.lastUrl = url; evidence.calls.push("load"); setTimeout(options.callback, 0); }
    };
  }
  Widget.Events = events;
  window.SC = { Widget };
})();`

// The World's own skill table. Stubbed so the card reads the same whether or
// not this build of the World ships street life yet.
const lifeFixture = { skills: { thresholds: [0, 100, 300, 700, 1500], legs: { name: "Legs" }, wheels: { name: "Wheels" }, board: { name: "Board" }, hustle: { name: "Hustle" } } }

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const report = { checks: [], errors: [] }
const check = (name) => report.checks.push(name)

async function open(options, { storage = {} } = {}) {
  const context = await browser.newContext(options)
  await context.addInitScript((entries) => {
    try { for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value) } catch {}
  }, { "raffi:welcome-dismissed": "1", ...storage })
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === "w.soundcloud.com" && url.pathname === "/player/api.js") return route.fulfill({ contentType: "application/javascript", body: soundCloudFixture })
    if (url.hostname === "w.soundcloud.com") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Silent audio fixture</title>" })
    if (url.origin === origin && url.pathname === "/world/data/life.json") return route.fulfill({ contentType: "application/json", body: JSON.stringify(lifeFixture) })
    if (url.origin !== origin || url.pathname.startsWith("/api/")) return route.abort()
    return route.continue()
  })
  const page = await context.newPage()
  page.on("pageerror", (error) => report.errors.push(error.message))
  return { context, page }
}

try {
  // ------------------------------------------------------------- 404
  {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 } })
    const response = await page.goto(`${base}/crates/that-never-existed`, { waitUntil: "domcontentloaded", timeout: 120_000 })
    assert.equal(response.status(), 404, "a missing page must still answer 404")
    const box = page.locator("[data-not-found]")
    await box.waitFor({ timeout: 30_000 })
    // The path is filled in once the page is live, which also means the deck answers presses.
    await page.waitForFunction(() => document.querySelector("[data-not-found-path]")?.textContent === "/crates/that-never-existed", null, { timeout: 30_000 })
    assert.match(await page.title(), /Page not found/)
    const mix = (await page.locator("[data-not-found-mix]").innerText()).trim()
    assert.match(mix, /^404 · .+/)
    const deck = page.locator("button.welcome-deck")
    assert.equal(await deck.getAttribute("data-deck"), "idle", "the 404 must not start sound by itself")
    assert.deepEqual(await page.evaluate(() => window.__deckFixture?.calls ?? []), [], "the 404 touched the player before a press")
    await deck.click()
    await page.waitForFunction(() => document.querySelector("button.welcome-deck")?.getAttribute("data-deck") === "playing", null, { timeout: 30_000 })
    assert.match(await deck.getAttribute("aria-label"), /^Pause the mix: /)
    await page.screenshot({ path: `${out}/not-found.png` })
    await deck.click()
    await page.waitForFunction(() => document.querySelector("button.welcome-deck")?.getAttribute("data-deck") === "idle", null, { timeout: 30_000 })
    // The same address always gets the same mix; the ways back are real links.
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => document.querySelector("[data-not-found-path]")?.textContent === "/crates/that-never-existed", null, { timeout: 30_000 })
    assert.equal((await page.locator("[data-not-found-mix]").innerText()).trim(), mix)
    assert.deepEqual(await page.locator("[data-not-found] nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), ["/lab/tape-shelf", "/?app=world", "/"])
    await page.locator("[data-not-found] nav a", { hasText: "Back to the desktop" }).click()
    await page.waitForURL(`${base}/`, { timeout: 60_000 })
    await page.locator('[aria-label="Desktop taskbar"]').waitFor({ timeout: 60_000 })
    check("404 answers 404, names the path, plays only on a press, and leads back to the desktop")
    await context.close()
  }

  // ------------------------------------------------- System Properties
  {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 } }, {
      storage: {
        "raffi:tapes-found": '["bc-1","bc-2","nope"]',
        "raffi-world:life:v1": JSON.stringify({ version: 1, cash: 81, earned: 105, photos: 1, xp: { legs: 200, wheels: 0, board: 0, hustle: 50 }, gigs: { "crate-run": { runs: 2, wins: 2, best: 88 } } }),
        "raffi-best:overtime": "1200",
        "raffi-best:minesweeper-easy": "41",
      },
    })
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.locator('[aria-label="Desktop taskbar"]').waitFor({ timeout: 60_000 })
    // Start menu → My Computer.
    await page.locator('[aria-label="Desktop taskbar"] [aria-label="Start menu"]').click()
    await page.getByRole("menuitem", { name: /My Computer/ }).click()
    const sheet = page.locator("[data-system-properties]")
    await sheet.waitFor({ timeout: 30_000 })
    assert.match(await sheet.innerText(), /raffi\.computer/)
    assert.match(await page.locator("[data-system-session]").innerText(), /^1 window open · up /)
    assert.equal(await page.locator('[data-window-task="system"]').count(), 1, "System Properties has no taskbar button")
    // Raffi World tab: this device's tapes, cash and skills.
    await page.getByRole("tab", { name: "Raffi World" }).click()
    assert.match(await page.locator("[data-system-tapes]").innerText(), /^2 of \d+ tapes found$/)
    await page.locator("[data-system-cash]").waitFor({ timeout: 30_000 })
    assert.match(await page.locator("[data-system-cash]").innerText(), /^\$81 in your pocket · 2 gigs finished · 1 photo$/)
    assert.equal(await page.getByRole("img", { name: "Legs level 2 of 5" }).count(), 1)
    await page.screenshot({ path: `${out}/system-world.png` })
    // High scores tab, by arrow key.
    await page.keyboard.press("ArrowRight")
    const scores = await page.locator("#system-panel-scores").innerText()
    assert.match(scores, /Minesweeper Easy\s+41 s/)
    assert.match(scores, /Overtime\s+1,200 pts/)
    await page.screenshot({ path: `${out}/system-scores.png` })
    // The World button opens the World window.
    await page.getByRole("tab", { name: "Raffi World" }).click()
    await page.getByRole("button", { name: "Open Raffi World" }).click()
    await page.locator('[data-window-task="world"]').waitFor({ timeout: 30_000 })
    check("System Properties opens from Start, reads World progress and scores, and opens the World")
    await context.close()
  }
  {
    // Deep link and right-click → Properties, with nothing saved.
    const { context, page } = await open({ viewport: { width: 1280, height: 800 } })
    await page.goto(`${base}/?app=system`, { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.locator("[data-system-properties]").waitFor({ timeout: 60_000 })
    await page.getByRole("tab", { name: "Raffi World" }).click()
    assert.match(await page.locator("[data-system-tapes]").innerText(), /^0 of \d+ tapes found$/)
    assert.equal(await page.locator("[data-system-cash]").count(), 0, "a profile appeared from empty storage")
    await page.getByRole("tab", { name: "High scores" }).click()
    assert.match(await page.locator("#system-panel-scores").innerText(), /Nothing yet/)
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
    await page.locator('[aria-label="Desktop taskbar"]').waitFor({ timeout: 60_000 })
    // A real right-click on empty desktop, wherever the icon grid's box reaches.
    // The taskbar is server-rendered, so retry until the page is live and the menu answers.
    const properties = page.getByText("Properties", { exact: true })
    for (let attempt = 0; attempt < 20 && !(await properties.count()); attempt++) {
      await page.mouse.click(700, 300, { button: "right" })
      await properties.waitFor({ timeout: 1_000 }).catch(() => {})
    }
    await properties.click()
    await page.locator("[data-system-properties]").waitFor({ timeout: 30_000 })
    check("System Properties opens by deep link and from the desktop's Properties, and is honest when empty")

    // ---------------------------------------------------------- Konami
    await page.keyboard.press("Escape")
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
    await page.locator('[aria-label="Desktop taskbar"]').waitFor({ timeout: 60_000 })
    const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]
    for (const key of code.slice(0, -1)) await page.keyboard.press(key)
    assert.equal(await page.locator("[data-konami-balloon]").count(), 0, "the balloon appeared before the last key")
    await page.keyboard.press("a")
    const balloon = page.locator("[data-konami-balloon]")
    await balloon.waitFor({ timeout: 10_000 })
    const link = balloon.getByRole("link", { name: "Open the emulator" })
    assert.equal(await link.getAttribute("href"), "/games/emulator")
    assert.equal(await link.getAttribute("target"), "_blank", "the emulator must not replace the desktop")
    await page.screenshot({ path: `${out}/konami.png` })
    await page.keyboard.press("Escape")
    await balloon.waitFor({ state: "detached", timeout: 10_000 })
    // With a game shelf in front, arrow keys belong to it.
    await page.goto(`${base}/?app=games`, { waitUntil: "domcontentloaded" })
    await page.locator('[data-window-task="games"]').waitFor({ timeout: 60_000 })
    for (const key of code) await page.keyboard.press(key)
    await page.waitForTimeout(400)
    assert.equal(await page.locator("[data-konami-balloon]").count(), 0, "the code fired while Games was in front")
    check("the Konami code pops the emulator balloon on the desktop only")
    await context.close()
  }

  // ------------------------------------------------------ phone targets
  {
    const { context, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
    const sizes = {}
    for (const app of ["about", "games", "notes", "projects", "blogroll"]) {
      await page.goto(`${base}/?app=${app}`, { waitUntil: "domcontentloaded", timeout: 120_000 })
      await page.locator(`[data-window-task="${app}"]`).waitFor({ timeout: 60_000 })
      await page.waitForTimeout(500)
      sizes[app] = await page.evaluate(() => [...document.querySelectorAll(".tap-target")].map((el) => {
        const box = el.getBoundingClientRect()
        return { text: (el.textContent || "").trim().slice(0, 24), height: Math.round(box.height), shown: box.width > 0 && box.height > 0 }
      }).filter((entry) => entry.shown))
      assert.ok(sizes[app].length > 0 || app === "notes", `${app} has no marked targets`)
      for (const entry of sizes[app]) assert.ok(entry.height >= 44, `${app}: "${entry.text}" is ${entry.height}px tall`)
    }
    const tabs = await page.goto(`${base}/?app=notes`, { waitUntil: "domcontentloaded" }).then(async () => {
      await page.locator('[data-window-task="notes"]').waitFor({ timeout: 60_000 })
      const notesTabs = page.locator('button[aria-pressed]', { hasText: /Articles|Papers|Events|Podcasts/ })
      await notesTabs.first().waitFor({ timeout: 30_000 })
      return notesTabs.evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().height)))
    })
    assert.ok(tabs.length >= 4 && tabs.every((height) => height >= 44), "Notes tabs under 44px: " + tabs.join(","))
    // A taskbar button answers a touch anywhere in the bar's height, not just on its 32px face.
    const bar = await page.evaluate(() => {
      const taskbar = document.querySelector('[aria-label="Desktop taskbar"]').getBoundingClientRect()
      const start = document.querySelector('[aria-label="Desktop taskbar"] [aria-label="Start menu"]')
      const box = start.getBoundingClientRect()
      const hit = (y) => document.elementFromPoint(box.left + box.width / 2, y)?.closest("button") === start
      // Just inside the bar's top edge, and the last pixel row on screen.
      const top = taskbar.top + 3, bottom = Math.min(taskbar.bottom, innerHeight) - 1
      return { face: Math.round(box.height), bar: Math.round(taskbar.height), top: hit(top), bottom: hit(bottom), middle: hit(box.top + box.height / 2) }
    })
    assert.deepEqual({ top: bar.top, bottom: bar.bottom, middle: bar.middle }, { top: true, bottom: true, middle: true }, "Start's touch area does not fill the bar: " + JSON.stringify(bar))
    report.phone = { sizes, tabs, bar }
    await page.screenshot({ path: `${out}/phone-notes.png` })
    check("marked controls are at least 44px on a phone, and taskbar buttons take taps across the bar")
    await context.close()
  }

  assert.deepEqual(report.errors, [], "page errors")
  report.ok = true
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
