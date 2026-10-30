import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(new URL("../package.json", import.meta.url))
const { chromium } = require("playwright")
const base = (process.env.RAFFI_APP_URL || "http://127.0.0.1:3100").replace(/\/$/, "")
const origin = new URL(base).origin
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/raffi-lab-qa"
await fs.mkdir(out, { recursive: true })

const report = {
  checks: [], failures: [], errors: [], screenshots: [], gear: [], architecture: [], limits: [], interceptedScoreWrites: 0, interceptedRafOsWrites: 0,
  audio: "SoundCloud widget API is stubbed. This checks shared-player integration, not external stream availability or audible playback.",
}

// Intercept the provider at its existing API boundary. The production player,
// context, and controls still execute normally, without sending audio traffic.
const soundCloudFixture = `(() => {
  const events = { READY: "READY", PLAY_PROGRESS: "PLAY_PROGRESS", PLAY: "PLAY", FINISH: "FINISH", ERROR: "ERROR" };
  const evidence = window.__labSoundCloudFixture = { calls: [], lastUrl: null, blockPlayback: false };
  function Widget(iframe) {
    const listeners = new Map();
    evidence.lastUrl = new URL(iframe.src).searchParams.get("url");
    const emit = (event, value = {}) => setTimeout(() => listeners.get(event)?.(value), 0);
    return {
      bind(event, listener) { listeners.set(event, listener); if (event === events.READY) emit(events.READY); },
      unbind(event) { listeners.delete(event); },
      play() { evidence.calls.push("play"); if (!evidence.blockPlayback) emit(events.PLAY); },
      pause() { evidence.calls.push("pause"); },
      seekTo(value) { evidence.calls.push("seek"); emit(events.PLAY_PROGRESS, { currentPosition: value }); },
      setVolume() {},
      getDuration(callback) { callback(180000); },
      load(url, options) { evidence.lastUrl = url; evidence.calls.push("load"); setTimeout(options.callback, 0); }
    };
  }
  Widget.Events = events;
  window.SC = { Widget };
})();`

const browser = await chromium.launch({
  headless: true,
  ...(process.env.RAFFI_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.RAFFI_BROWSER_EXECUTABLE_PATH } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
const dialog = (page) => page.locator('[role="dialog"][data-window-id="lab"]')
const task = (page) => page.locator('[data-window-task="lab"]')
const tape = (page) => page.locator('[data-lab-experiment="tape-shelf"]')
const gear = (page) => page.locator('[data-lab-experiment="gear-anatomy"]')
const nowPlaying = (page) => page.locator('[aria-label="Playback controls"]').locator("..").locator("..")

async function screenshot(page, name) {
  const path = `${out}/${name}.png`
  await page.screenshot({ path })
  report.screenshots.push(path)
}

async function check(name, viewport, page, run) {
  try {
    await run()
    report.checks.push({ viewport, name })
    console.info(`PASS ${viewport}: ${name}`)
  } catch (error) {
    const path = `${out}/${viewport}-${name.replace(/[^a-z0-9-]+/gi, "-")}-failure.png`
    await page.screenshot({ path }).catch(() => {})
    const evidence = await page.evaluate(() => ({
      url: location.href,
      labTask: document.querySelector('[data-window-task="lab"]')?.getAttribute("data-window-state"),
      activePost: document.querySelector("[data-lab-post]")?.getAttribute("data-lab-post"),
      selectedTape: document.querySelector("[data-selected-tape]")?.getAttribute("data-selected-tape"),
      gearStage: document.querySelector('[data-testid="gear-stage"]')?.dataset,
      architectureStage: document.querySelector('[data-testid="architecture-stage"]')?.dataset,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    })).catch(() => null)
    report.failures.push({ viewport, name, error: error.stack || error.message, evidence, screenshot: path })
    console.error(`FAIL ${viewport}: ${name}: ${error.message}`)
  }
}

async function openLab(page, slug = "tape-shelf") {
  const response = await page.goto(`${base}/lab/${slug}`, { waitUntil: "domcontentloaded" })
  assert.equal(response?.status(), 200, `Expected a successful permalink for ${slug}`)
  await page.bringToFront()
  await dialog(page).waitFor({ state: "visible", timeout: 60000 })
  await page.waitForFunction(() => {
    const shell = document.querySelector('[role="dialog"][data-window-id="lab"]')
    return shell?.getAttribute("aria-modal") === "true"
      && !shell.closest('[inert], [aria-hidden="true"]')
      && document.querySelector('[data-window-task="lab"]')?.getAttribute("data-window-state") === "active"
  })
  await page.locator(`[data-lab-post="${slug}"]`).waitFor()
  await page.locator(`[data-lab-stage="${slug}"]`).scrollIntoViewIfNeeded()
  return dialog(page)
}

async function minimize(page) {
  await dialog(page).getByRole("group", { name: "Window controls", exact: true })
    .getByRole("button", { name: /^Minimize / }).click()
  await dialog(page).waitFor({ state: "hidden" })
  assert.equal(await task(page).getAttribute("data-window-state"), "minimized")
  assert.equal(await dialog(page).count(), 1, "Minimize must preserve the mounted Lab")
}

async function restore(page) {
  await task(page).click()
  await dialog(page).waitFor({ state: "visible" })
  await page.waitForFunction(() => document.querySelector('[data-window-task="lab"]')?.getAttribute("data-window-state") === "active")
}

async function assertBounds(page) {
  const viewport = page.viewportSize()
  const box = await dialog(page).boundingBox()
  const bar = await page.getByRole("region", { name: "Desktop taskbar", exact: true }).boundingBox()
  assert.ok(box && bar, "Expected visible Lab and taskbar bounds")
  assert.ok(box.x >= -1 && box.y >= -1, "Lab starts outside the viewport")
  assert.ok(box.x + box.width <= viewport.width + 1, "Lab exceeds viewport width")
  assert.ok(box.y + box.height <= bar.y + 1, "Lab overlaps the taskbar")
  const controls = dialog(page).getByRole("group", { name: "Window controls", exact: true }).getByRole("button")
  assert.equal(await controls.count(), 3, "Expected close, minimize, and maximize controls")
  for (const control of await controls.all()) {
    const bounds = await control.boundingBox()
    assert.ok(bounds && bounds.width >= 36 && bounds.height >= 36, "Window control is too small or missing")
    assert.ok(bounds.x >= box.x - 1 && bounds.x + bounds.width <= box.x + box.width + 1, "Window control is horizontally clipped")
    assert.ok(bounds.y >= box.y - 1 && bounds.y + bounds.height <= bar.y + 1, "Window control is vertically clipped")
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Document has horizontal overflow")
}

async function gearVariant(page, viewport) {
  const stage = page.getByTestId("gear-stage")
  await stage.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-testid="gear-stage"]')
    return stage?.dataset.gearRendered === "true"
      || document.querySelector('[data-lab-experiment="gear-anatomy"]')?.textContent.includes("3D view needs WebGL")
  }, null, { timeout: 30000 })
  const rendered = await stage.getAttribute("data-gear-rendered") === "true"
  if (rendered) {
    assert.equal(await stage.locator("canvas").count(), 1, "Render hook requires a canvas")
    const canvas = await stage.locator("canvas").evaluate((element) => ({ width: element.width, height: element.height }))
    assert.ok(canvas.width > 0 && canvas.height > 0, "Rendered canvas has no drawing surface")
  }
  report.gear.push({ viewport, variant: rendered ? "rendered" : "fallback", renderedChecks: rendered ? 1 : 0 })
  if (!rendered) report.limits.push(`${viewport}: WebGL fallback shown. Model rendering and rendered geometry changes were not verified.`)
  return rendered
}

async function architectureVariant(page, viewport) {
  const stage = page.getByTestId("architecture-stage")
  await stage.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-testid="architecture-stage"]')
    return stage?.dataset.architectureRendered === "true"
      || document.querySelector('[data-lab-experiment="architecture-studio"]')?.textContent.includes("3D view is unavailable")
  }, null, { timeout: 30000 })
  const rendered = await stage.getAttribute("data-architecture-rendered") === "true"
  if (rendered) {
    assert.equal(await stage.locator("canvas").count(), 1, "Architecture render hook requires a canvas")
    const canvas = await stage.locator("canvas").evaluate((element) => ({ width: element.width, height: element.height }))
    assert.ok(canvas.width > 0 && canvas.height > 0, "Architecture canvas has no drawing surface")
  }
  report.architecture.push({ viewport, variant: rendered ? "rendered" : "fallback", renderedChecks: rendered ? 1 : 0 })
  if (!rendered) report.limits.push(`${viewport}: Architecture 3D fallback shown. The diagram and room controls are verified separately; 3D rendering is unverified.`)
  return rendered
}

try {
  for (const [viewport, width, height] of [["desktop", 1280, 900], ["phone", 393, 852], ["small-phone", 320, 640]]) {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: viewport !== "desktop", hasTouch: viewport !== "desktop",
      reducedMotion: "no-preference", serviceWorkers: "block",
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", (error) => report.errors.push({ viewport, error: error.message }))
    await context.route("**/*", (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === origin) {
        if (url.pathname.startsWith("/api/scores")) {
          if (!["GET", "HEAD"].includes(request.method())) report.interceptedScoreWrites++
          return route.fulfill({ json: { scores: [], success: true } })
        }
        if (url.pathname === "/api/raf-os") {
          if (!["GET", "HEAD"].includes(request.method())) report.interceptedRafOsWrites++
          return route.fulfill({ json: { available: false, providers: [] } })
        }
        return route.continue()
      }
      if (url.hostname === "w.soundcloud.com" && url.pathname === "/player/api.js") {
        return route.fulfill({ contentType: "application/javascript", body: soundCloudFixture })
      }
      if (url.hostname === "w.soundcloud.com" && url.pathname === "/player/") {
        return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Silent SoundCloud test fixture</title>" })
      }
      return route.abort()
    })

    // Each viewport starts in a fresh context: this covers first visit, a saved
    // dismissal after reload, and the visible Start-menu route back to welcome.
    await check("welcome-dismiss-reload-and-restore", viewport, page, async () => {
      const response = await page.goto(base, { waitUntil: "domcontentloaded" })
      assert.equal(response?.status(), 200)
      const welcome = page.locator('[data-desktop-welcome="true"]')
      await welcome.waitFor({ state: "visible" })
      assert.equal(await welcome.getAttribute("data-collapsed"), "false")
      await welcome.getByRole("button", { name: "Dismiss welcome", exact: true }).click()
      await welcome.waitFor({ state: "hidden" })
      await page.reload({ waitUntil: "domcontentloaded" })
      const start = page.getByRole("region", { name: "Desktop taskbar", exact: true }).getByRole("button", { name: "Start menu", exact: true })
      await start.click()
      const menu = page.getByRole("menu", { name: "Start menu", exact: true })
      await menu.waitFor({ state: "visible" })
      // Opening the menu confirms that the reloaded desktop has hydrated before
      // checking that the dismissed welcome did not return.
      assert.equal(await welcome.count(), 0, "Reload brought back the dismissed welcome")
      await menu.getByRole("menuitem", { name: "welcome.txt", exact: true }).click()
      await welcome.waitFor({ state: "visible" })
      assert.equal(await welcome.getAttribute("data-collapsed"), "false", "Start must restore the expanded welcome")
      await page.reload({ waitUntil: "domcontentloaded" })
      await welcome.waitFor({ state: "visible" })
      assert.equal(await welcome.getAttribute("data-collapsed"), "false", "Restored welcome did not survive reload")
      await welcome.getByRole("button", { name: "Open Lab", exact: true }).click()
      await dialog(page).waitFor({ state: "visible" })
      assert.equal(new URL(page.url()).pathname, "/lab/tape-shelf", "Welcome did not open the Lab")
    })

    await check("permalink-window-and-start-bounds", viewport, page, async () => {
      await openLab(page)
      await tape(page).waitFor()
      await assertBounds(page)
      const start = page.getByRole("region", { name: "Desktop taskbar", exact: true }).getByRole("button", { name: "Start menu", exact: true })
      const evidence = await start.evaluate((button) => {
        const box = button.getBoundingClientRect()
        const style = getComputedStyle(button)
        const clippedBy = []
        for (let ancestor = button.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const parentStyle = getComputedStyle(ancestor)
          const parent = ancestor.getBoundingClientRect()
          if (["hidden", "clip"].includes(parentStyle.overflowY)
            && (box.top < parent.top - 1 || box.bottom > parent.bottom + 1)) clippedBy.push(ancestor.tagName)
        }
        const childrenFit = [...button.children].every((child) => {
          const rect = child.getBoundingClientRect()
          return rect.left >= box.left - 1 && rect.right <= box.right + 1
            && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1
        })
        return { width: box.width, height: box.height, radius: parseFloat(style.borderTopLeftRadius), childrenFit, clippedBy }
      })
      assert.ok(evidence.width >= 72 && evidence.height >= 30, "Start button is too small")
      assert.ok(evidence.radius >= 6, "Start button lost its rounded corners")
      assert.ok(evidence.childrenFit, "Start text or logo is clipped inside the button")
      assert.deepEqual(evidence.clippedBy, [], "Start button is clipped by an overflow ancestor")
      const navigation = dialog(page).getByRole("navigation", { name: "Lab collection", exact: true })
      assert.deepEqual(await navigation.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), [
        "/lab/tape-shelf", "/lab/gear-anatomy", "/lab/research", "/lab/architecture-studio",
      ], "The four experiment doors must stay available")
      if (viewport !== "desktop") {
        const row = await navigation.locator("a, button").evaluateAll((items) => items.map((item) => {
          const box = item.getBoundingClientRect()
          return { x: box.x, y: box.y, height: box.height }
        }))
        assert.equal(row.length, 4, "Expected the four experiment links")
        assert.ok(row.every((item) => Math.abs(item.y - row[0].y) <= 1 && item.height >= 44), "Phone Lab navigation wrapped or lost usable tap targets")
        assert.ok(row.every((item, index) => index === 0 || item.x > row[index - 1].x), "Phone Lab navigation must remain a horizontal row")
        assert.equal(await dialog(page).locator(".lab-subtitle").isVisible(), false, "Phone subtitle crowds the compact Lab header")
      }
      await screenshot(page, `${viewport}-tape-shelf`)
    })

    await check("standalone-raf-os-preserves-draft-without-submitting", viewport, page, async () => {
      await openLab(page)
      assert.equal(await page.locator('[data-desktop-app="startup"]').count(), 1, "RAF OS should retain its standalone desktop shortcut")
      assert.equal(await dialog(page).getByRole("button", { name: "Open RAF OS pitch review", exact: true }).count(), 0, "RAF OS should not appear as a Lab tool")
      const writesBefore = report.interceptedRafOsWrites
      const start = page.getByRole("region", { name: "Desktop taskbar", exact: true }).getByRole("button", { name: "Start menu", exact: true })
      await start.click()
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === "/api/raf-os" && response.request().method() === "GET"),
        page.getByRole("menu", { name: "Start menu", exact: true }).getByRole("menuitem", { name: "RAF OS", exact: true }).click(),
      ])
      const terminal = page.locator('[role="dialog"][data-window-id="startup"]')
      await terminal.waitFor({ state: "visible" })
      await terminal.getByRole("heading", { name: "VENTURE REVIEW", exact: true }).waitFor()
      const pitch = terminal.getByRole("textbox", { name: "Your pitch", exact: true })
      assert.equal(await pitch.inputValue(), "", "Opening RAF OS should not invent or submit a pitch")
      const draft = "A local smoke-test draft. Do not submit."
      await pitch.fill(draft)
      await terminal.getByRole("group", { name: "Window controls", exact: true }).getByRole("button", { name: /^Minimize / }).click()
      await terminal.waitFor({ state: "hidden" })
      const terminalTask = page.locator('[data-window-task="startup"]')
      await terminalTask.click()
      await terminal.waitFor({ state: "visible" })
      assert.equal(await terminal.count(), 1, "Taskbar restoration opened a duplicate terminal")
      assert.equal(await pitch.inputValue(), draft, "Restoring RAF OS lost the existing terminal session")
      assert.equal(await terminalTask.getAttribute("data-window-state"), "active")
      await start.click()
      await page.getByRole("menu", { name: "Start menu", exact: true }).getByRole("menuitem", { name: "welcome.txt", exact: true }).click()
      await page.locator('[data-desktop-welcome="true"]').waitFor({ state: "visible" })
      await terminal.waitFor({ state: "hidden" })
      assert.equal(await terminalTask.getAttribute("data-window-state"), "minimized", "Welcome restoration should reveal the desktop without closing the terminal")
      assert.equal(await page.locator('[data-desktop-welcome="true"]').getAttribute("data-collapsed"), "false")
      await terminalTask.click()
      await terminal.waitFor({ state: "visible" })
      assert.equal(await pitch.inputValue(), draft, "Restoring the terminal after welcome lost its draft")
      assert.equal(report.interceptedRafOsWrites, writesBefore, "Opening or restoring RAF OS submitted a review request")
    })

    await check("silent-browsing-and-shared-playback", viewport, page, async () => {
      await openLab(page)
      await tape(page).waitFor()
      const spines = tape(page).locator("[data-tape-id]")
      assert.ok(await spines.count() >= 2, "Need multiple real mixes to verify selection")
      assert.equal(await page.locator('[aria-label="Playback controls"]').count(), 0, "Shelf auto-started a mix")
      const firstSelected = await tape(page).getAttribute("data-selected-tape")
      // Use a known different accessible tape instead of depending on catalog size.
      const different = await spines.evaluateAll((buttons, selected) => buttons.find((button) => button.getAttribute("data-tape-id") !== selected)?.getAttribute("data-tape-id"), firstSelected)
      assert.ok(different, "No alternate tape found")
      await tape(page).locator(`[data-tape-id="${different}"]`).click()
      assert.equal(await tape(page).getAttribute("data-selected-tape"), different)
      assert.equal(await page.locator('[aria-label="Playback controls"]').count(), 0, "Selecting a spine unexpectedly started audio")

      await tape(page).getByRole("button", { name: "Pick a mix for me", exact: true }).click()
      await page.waitForFunction((previous) => document.querySelector("[data-selected-tape]")?.getAttribute("data-selected-tape") !== previous, different)
      const picked = await tape(page).getAttribute("data-selected-tape")
      const title = await tape(page).locator("[data-tape-title]").innerText()
      await nowPlaying(page).getByText(title, { exact: true }).waitFor()
      await page.waitForFunction(() => window.__labSoundCloudFixture?.calls.includes("play"))
      await tape(page).getByRole("button", { name: "Pause selected mix", exact: true }).waitFor()
      assert.equal(await page.locator('iframe[src^="https://w.soundcloud.com/player/"]').count(), 1, "Expected the single global player, not another audio instance")

      await tape(page).getByRole("button", { name: "Pause selected mix", exact: true }).click()
      await nowPlaying(page).getByRole("button", { name: "Play", exact: true }).waitFor()
      await tape(page).getByRole("button", { name: "Play selected mix", exact: true }).click()
      await nowPlaying(page).getByRole("button", { name: "Pause", exact: true }).waitFor()
      await tape(page).getByRole("button", { name: "Pick a mix for me", exact: true }).click()
      await page.waitForFunction((previous) => document.querySelector("[data-selected-tape]")?.getAttribute("data-selected-tape") !== previous, picked)
      await nowPlaying(page).getByText(await tape(page).locator("[data-tape-title]").innerText(), { exact: true }).waitFor()

      // BadCompany Radio is a SoundCloud playlist, not a single track. It must
      // use the same player and remain recognizable as the selected mix.
      await tape(page).locator('[data-tape-id="bc-1"]').click()
      const playlistPlay = tape(page).getByRole("button", { name: "Play selected mix", exact: true })
      if (await playlistPlay.count()) await playlistPlay.click()
      await nowPlaying(page).getByText("BadCompany Radio", { exact: true }).waitFor()
      await page.waitForFunction(() => window.__labSoundCloudFixture?.lastUrl?.includes("/playlists/"))
      await tape(page).getByRole("button", { name: "Pause selected mix", exact: true }).waitFor()
      await assertBounds(page)
    })

    await check("automatic-os-reduced-motion-across-desktop-and-lab", viewport, page, async () => {
      // Set the OS preference before navigating, so the fresh document sees it
      // during hydration rather than relying on an in-app motion toggle.
      await page.emulateMedia({ reducedMotion: "reduce" })
      try {
        await openLab(page)
        await tape(page).waitFor()
        assert.equal(await tape(page).getAttribute("data-motion-paused"), "true")
        assert.equal(await page.getByRole("button", { name: /^(Pause|Resume) (movement|mystery box movement)$/ }).count(), 0, "Manual movement controls should not crowd the site")
        const tapePackTransitions = await tape(page).locator(".tape-shelf-reel").evaluateAll((reels) => reels.map((reel) => {
          const pack = reel.parentElement?.previousElementSibling
          return pack ? getComputedStyle(pack).transitionDuration : null
        }))
        assert.deepEqual(tapePackTransitions, ["0s", "0s"], "Reduced-motion tape packs should update progress without animating")
        await tape(page).getByRole("button", { name: "Play selected mix", exact: true }).click()
        await tape(page).getByRole("button", { name: "Pause selected mix", exact: true }).waitFor()
        const reelMotion = await tape(page).locator(".tape-shelf-reel").evaluateAll((reels) => reels.map((reel) => getComputedStyle(reel).animationPlayState))
        assert.deepEqual(reelMotion, ["paused", "paused"], "Playing audio must not animate tape reels under reduced motion")
        await minimize(page)
        const start = page.getByRole("region", { name: "Desktop taskbar", exact: true }).getByRole("button", { name: "Start menu", exact: true })
        await start.click()
        await page.getByRole("menu", { name: "Start menu", exact: true }).getByRole("menuitem", { name: "welcome.txt", exact: true }).click()
        const welcome = page.locator('[data-desktop-welcome="true"]')
        await welcome.waitFor({ state: "visible" })
        await welcome.locator('.welcome-deck[data-deck="playing"]').waitFor()
        assert.equal(await welcome.getAttribute("data-motion-paused"), "true")
        const welcomeMotion = await welcome.locator(".welcome-reel, .welcome-eq span").evaluateAll((items) => items.map((item) => getComputedStyle(item).animationName))
        assert.ok(welcomeMotion.length >= 2 && welcomeMotion.every((name) => name === "none"), "Playing welcome cassette must respect reduced motion")
        await welcome.getByRole("button", { name: "Dismiss welcome", exact: true }).click()
        const mystery = page.locator('[data-mystery-chase="true"]')
        await mystery.waitFor({ state: "visible" })
        const stationary = await mystery.getByRole("button", { name: "Question block: unlock a secret level", exact: true }).evaluate(async (block) => {
          const before = getComputedStyle(block).transform
          await new Promise((resolve) => {
            let frames = 0
            const step = () => { if (++frames === 6) resolve(); else requestAnimationFrame(step) }
            requestAnimationFrame(step)
          })
          return before === getComputedStyle(block).transform
        })
        assert.equal(stationary, true, "Mystery block moved despite the OS reduced-motion preference")
        await restore(page)
        await dialog(page).getByRole("navigation", { name: "Lab collection", exact: true }).locator('a[href="/lab/gear-anatomy"]').click()
        await gear(page).waitFor()
        assert.equal(await gear(page).getByRole("checkbox", { name: /Auto-rotate/ }).isDisabled(), true)
      } finally {
        await page.emulateMedia({ reducedMotion: "no-preference" })
      }
    })

    await check("blocked-playback-recovery-tap", viewport, page, async () => {
      await openLab(page)
      await tape(page).waitFor()
      // Let the existing idle warm-up load its silent fixture, then choose a
      // different mix so the normal stream-load callback requests playback.
      await page.waitForFunction(() => Boolean(window.__labSoundCloudFixture))
      await page.evaluate(() => { window.__labSoundCloudFixture.blockPlayback = true })
      await tape(page).locator('[data-tape-id="bc-2"]').click()
      await tape(page).getByRole("button", { name: "Play selected mix", exact: true }).click()
      const tapToPlay = tape(page).getByRole("button", { name: "Tap to play selected mix", exact: true })
      await tapToPlay.waitFor()
      const selected = await tape(page).getAttribute("data-selected-tape")
      const reels = tape(page).locator(".tape-shelf-reel")
      for (const reel of await reels.all()) assert.equal(await reel.evaluate((element) => getComputedStyle(element).animationPlayState), "paused")
      await page.evaluate(() => { window.__labSoundCloudFixture.blockPlayback = false })
      await tapToPlay.click()
      await tape(page).getByRole("button", { name: "Pause selected mix", exact: true }).waitFor()
      assert.equal(await tape(page).getAttribute("data-selected-tape"), selected, "Recovery tap changed the selected mix")
      await tape(page).getByRole("status").filter({ hasText: "Playing on the desktop" }).waitFor()
    })

    await check("copy-link-or-visible-fallback", viewport, page, async () => {
      await openLab(page)
      await dialog(page).getByRole("button", { name: "Copy experiment link", exact: true }).click()
      await page.waitForFunction(() => {
        const copy = document.querySelector('button[aria-label="Copy experiment link"]')
        return copy?.textContent.includes("Link copied")
          || [...document.querySelectorAll('a[href="/lab/tape-shelf"]')].some((link) => link.textContent.includes("Open or copy"))
      })
      if (await dialog(page).getByText("Link copied", { exact: true }).count()) {
        let copied
        try { copied = await page.evaluate(() => navigator.clipboard.readText()) } catch {
          report.limits.push(`${viewport}: copy success was visible; clipboard readback permission was unavailable.`)
        }
        if (copied !== undefined) assert.equal(copied, `${origin}/lab/tape-shelf`)
      } else {
        const fallback = dialog(page).getByRole("link", { name: /Open or copy this experiment/ })
        assert.equal(await fallback.getAttribute("href"), "/lab/tape-shelf")
      }
    })

    await check("history-between-experiments", viewport, page, async () => {
      await openLab(page)
      await dialog(page).getByRole("navigation", { name: "Lab collection", exact: true }).locator('a[href="/lab/gear-anatomy"]').click()
      await page.locator('[data-lab-post="gear-anatomy"]').waitFor()
      assert.equal(new URL(page.url()).pathname, "/lab/gear-anatomy")
      await page.goBack()
      await page.locator('[data-lab-post="tape-shelf"]').waitFor()
      assert.equal(new URL(page.url()).pathname, "/lab/tape-shelf")
      await page.goForward()
      await page.locator('[data-lab-post="gear-anatomy"]').waitFor()
      assert.equal(new URL(page.url()).pathname, "/lab/gear-anatomy")
      assert.equal(await task(page).getAttribute("data-window-state"), "active")
    })

    await check("gear-setup-layers-and-minimize-state", viewport, page, async () => {
      await openLab(page, "gear-anatomy")
      await gear(page).waitFor()
      const rendered = await gearVariant(page, viewport)
      const stage = page.getByTestId("gear-stage")
      const white = gear(page).getByRole("button", { name: "White XDJ-XZ", exact: true })
      const rotary = gear(page).getByRole("button", { name: "Black rotary", exact: true })
      assert.equal(await white.getAttribute("aria-pressed"), "true")
      await rotary.click()
      assert.equal(await rotary.getAttribute("aria-pressed"), "true")
      assert.match(await stage.getAttribute("aria-label"), /black rotary/)
      if (rendered) await page.waitForFunction(() => document.querySelector('[data-testid="gear-stage"]')?.dataset.gearSetup === "rotary")

      await gear(page).getByRole("button", { name: "Disassemble", exact: true }).click()
      const slider = gear(page).getByRole("slider", { name: "Layer separation", exact: true })
      assert.equal(await slider.inputValue(), "1")
      if (rendered) {
        await stage.scrollIntoViewIfNeeded()
        await page.waitForFunction(() => Number(document.querySelector('[data-testid="gear-stage"]')?.dataset.gearSeparation) >= 0.99)
      }
      await slider.focus()
      await slider.press("Home")
      await slider.press("ArrowRight")
      assert.equal(await slider.inputValue(), "0.01", "Layer slider did not respond to keyboard input")
      if (rendered) {
        await stage.scrollIntoViewIfNeeded()
        await page.waitForFunction(() => Number(document.querySelector('[data-testid="gear-stage"]')?.dataset.gearSeparation) <= 0.02)
      }

      await minimize(page)
      await restore(page)
      assert.equal(await rotary.getAttribute("aria-pressed"), "true", "Minimize reset the selected setup")
      assert.equal(await slider.inputValue(), "0.01", "Minimize reset layer separation")
      await assertBounds(page)
      await stage.scrollIntoViewIfNeeded()
      await screenshot(page, `${viewport}-gear-${rendered ? "rendered" : "fallback"}`)
    })

    await check("research-catalogue-links-and-notes", viewport, page, async () => {
      await openLab(page, "research")
      const library = page.locator('[data-research-library="true"]')
      await library.waitFor()
      const catalogue = library.getByRole("combobox", { name: /Browse the catalogue/ })
      const firstId = await catalogue.inputValue()
      await library.getByRole("button", { name: "Next research paper", exact: true }).click()
      assert.notEqual(await catalogue.inputValue(), firstId, "Next paper did not change selection")
      await library.getByRole("button", { name: "Previous research paper", exact: true }).click()
      assert.equal(await catalogue.inputValue(), firstId, "Previous paper did not restore selection")
      await catalogue.selectOption("llm-output-drift")
      await library.locator('[data-research-paper="llm-output-drift"]').waitFor()
      const read = library.getByRole("link", { name: "Read paper", exact: true })
      assert.equal(await read.getAttribute("href"), "https://arxiv.org/abs/2511.07585")
      assert.equal(await read.getAttribute("target"), "_blank")
      assert.match(await read.getAttribute("rel"), /noopener/)
      await library.getByRole("button", { name: "CHECK THE MARGIN", exact: true }).click()
      await library.locator("#research-margin-note").waitFor()
      assert.equal(await library.getByRole("button", { name: "CHECK THE MARGIN", exact: true }).getAttribute("aria-expanded"), "true")
      assert.equal(await catalogue.inputValue(), "llm-output-drift", "Opening a margin note changed the paper")
      await assertBounds(page)
      await screenshot(page, `${viewport}-research`)

      await library.getByRole("button", { name: "Explore the architecture", exact: true }).click()
      await page.locator('[data-lab-post="architecture-studio"]').waitFor()
      assert.equal(new URL(page.url()).pathname, "/lab/architecture-studio")
      await page.locator('[data-lab-experiment="architecture-studio"][data-architecture-project="output-drift"]').waitFor()
      await page.locator('[data-lab-experiment="architecture-studio"]').getByRole("button", { name: "More research", exact: true }).click()
      await library.waitFor()
      await library.getByRole("button", { name: "Own papers in Notes", exact: true }).click()
      const notes = page.locator('[role="dialog"][data-window-id="notes"]')
      await notes.waitFor()
      await page.waitForFunction(() => document.querySelector('[data-window-task="notes"]')?.getAttribute("data-window-state") === "active")
      assert.equal(await notes.getByRole("button", { name: /Papers/ }).getAttribute("aria-pressed"), "true")
      await notes.getByRole("button", { name: /Articles/ }).click()
      await task(page).click()
      await library.getByRole("button", { name: "Own papers in Notes", exact: true }).click()
      assert.equal(await notes.getByRole("button", { name: /Papers/ }).getAttribute("aria-pressed"), "true", "A repeated explicit Notes request did not select Papers")
    })

    await check("architecture-rooms-projects-and-diagram", viewport, page, async () => {
      await openLab(page, "architecture-studio")
      const studio = page.locator('[data-lab-experiment="architecture-studio"]')
      await studio.waitFor()
      const rendered = await architectureVariant(page, viewport)
      assert.equal(await studio.getAttribute("data-architecture-project"), "dfah")
      const rooms = studio.getByRole("group", { name: "Room directory", exact: true }).getByRole("button")
      assert.ok(await rooms.count() >= 3, "Expected a navigable room route")
      const roomTwoLabel = await rooms.nth(1).getAttribute("aria-label")
      await rooms.nth(1).click()
      assert.equal(await studio.getAttribute("data-architecture-mode"), "room")
      assert.equal(await page.getByTestId("architecture-inspector").getByRole("heading", { level: 4 }).innerText(), roomTwoLabel.replace(/^Enter room \d+: /, ""))
      if (rendered) {
        await page.getByTestId("architecture-stage").scrollIntoViewIfNeeded()
        await page.waitForFunction(() => document.querySelector('[data-testid="architecture-stage"]')?.dataset.architectureStation === "2")
      }
      await studio.getByRole("button", { name: "Next stop", exact: true }).click()
      assert.equal(await rooms.nth(2).getAttribute("aria-pressed"), "true")
      await studio.getByRole("button", { name: "Back to mall", exact: true }).click()
      assert.equal(await studio.getAttribute("data-architecture-mode"), "mall")

      await studio.getByRole("group", { name: "Research projects", exact: true }).getByRole("button", { name: "LLM Output Drift", exact: true }).click()
      assert.equal(await studio.getAttribute("data-architecture-project"), "output-drift")
      await studio.getByRole("button", { name: "2D diagram", exact: true }).click()
      await page.getByTestId("architecture-diagram").waitFor()
      assert.match(await page.getByTestId("architecture-diagram").getAttribute("aria-label"), /LLM Output Drift/)
      assert.equal(await studio.getByRole("link", { name: "Read the paper", exact: true }).getAttribute("href"), "https://arxiv.org/abs/2511.07585")
      await rooms.nth(1).focus()
      await rooms.nth(1).press("Enter")
      assert.equal(await studio.getAttribute("data-architecture-mode"), "room")

      await studio.getByRole("group", { name: "Research projects", exact: true }).getByRole("button", { name: "GrantDrift", exact: true }).click()
      await studio.getByText("Research preview", { exact: true }).waitFor()
      assert.equal(await studio.getAttribute("data-architecture-project"), "grantdrift")
      assert.equal(await page.getByTestId("architecture-inspector").getByRole("link").count(), 0, "Conceptual preview unexpectedly exposes a source link")
      await rooms.nth(2).click()
      await minimize(page)
      await restore(page)
      assert.equal(await studio.getAttribute("data-architecture-project"), "grantdrift", "Minimize reset the research project")
      assert.equal(await studio.getAttribute("data-architecture-mode"), "room", "Minimize reset the room view")
      assert.equal(await studio.getByRole("button", { name: "2D diagram", exact: true }).getAttribute("aria-pressed"), "true")
      assert.equal(await rooms.nth(2).getAttribute("aria-pressed"), "true")
      await rooms.last().click()
      assert.equal(await studio.getByRole("button", { name: "Next stop", exact: true }).isDisabled(), true, "Route can advance beyond its last room")
      await assertBounds(page)
      await page.getByTestId("architecture-diagram").scrollIntoViewIfNeeded()
      await screenshot(page, `${viewport}-architecture-diagram`)
    })

    await check("os-motion-preference-updates-live", viewport, page, async () => {
      await page.emulateMedia({ reducedMotion: "no-preference" })
      await openLab(page, "gear-anatomy")
      await gear(page).waitFor()
      const autoRotate = gear(page).getByRole("checkbox", { name: /Auto-rotate/ })
      await page.waitForFunction(() => document.querySelector('[data-lab-experiment="gear-anatomy"] input[type="checkbox"]')?.disabled === false)
      try {
        await page.emulateMedia({ reducedMotion: "reduce" })
        await page.waitForFunction(() => document.querySelector('[data-lab-experiment="gear-anatomy"] input[type="checkbox"]')?.disabled === true)
        assert.equal(await autoRotate.isDisabled(), true)
        await dialog(page).getByRole("navigation", { name: "Lab collection", exact: true }).locator('a[href="/lab/tape-shelf"]').click()
        await tape(page).waitFor()
        assert.equal(await tape(page).getAttribute("data-motion-paused"), "true")
        await page.emulateMedia({ reducedMotion: "no-preference" })
        await page.waitForFunction(() => document.querySelector('[data-lab-experiment="tape-shelf"]')?.getAttribute("data-motion-paused") === "false")
      } finally {
        await page.emulateMedia({ reducedMotion: "no-preference" })
      }
    })

    await check("unknown-experiment-404", viewport, page, async () => {
      const response = await page.goto(`${base}/lab/this-experiment-does-not-exist`, { waitUntil: "domcontentloaded" })
      assert.equal(response?.status(), 404, "Unknown Lab slug did not return HTTP 404")
      assert.equal(await dialog(page).count(), 0, "Unknown slug silently opened another experiment")
    })
    await context.close()
  }
} finally {
  await browser.close()
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
}

console.info(JSON.stringify({
  passed: report.checks.length,
  failed: report.failures.length,
  pageErrors: report.errors.length,
  gear: report.gear,
  architecture: report.architecture,
  limits: report.limits,
  report: `${out}/report.json`,
}, null, 2))
if (report.failures.length || report.errors.length || report.interceptedScoreWrites || report.interceptedRafOsWrites) process.exitCode = 1
