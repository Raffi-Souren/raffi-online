#!/usr/bin/env node
// Play-readiness gate for raffi.computer.
//
// For every game (the Games shelf, the "?" block secret level, Raffi World) and every
// target screen (phone portrait, phone landscape, small landscape, laptop, desktop) it
// checks what a first-time player actually needs:
//   1. the start control is on screen and tappable without scrolling
//   2. after starting, every in-game control is on screen, hit-testable, not overlapping
//      another control, and thumb sized (>= 44 x 44 CSS px) on touch screens
//   3. in touch landscape, movement sits on the left and the main action on the right
//   4. the game is not over after 3 seconds without input (a new player is still looking)
//   5. the "?" block level actually responds to touch (the view scrolls while running)
//   6. Raffi World: start button fits, HUD controls do not overlap, no keyboard-only hints
//      on touch, and nothing in the world draws above an open modal
//   7. no first-party console errors or page errors
//
// Usage (from the repo root, with a production server running):
//   pnpm build && pnpm start --hostname 127.0.0.1 --port 3100 &
//   RAFFI_APP_URL=http://127.0.0.1:3100 node scripts/qa/play-readiness.mjs
// Flags:
//   --only=dig,snake,world        limit targets (ids below)
//   --profiles=phone-landscape    limit screens (comma list)
//   --report-only                 never exit non-zero (baseline runs)
// Env:
//   RAFFI_QA_OUTPUT_DIR           screenshots + report.json (default /tmp/raffi-play-readiness)
//   RAFFI_CHROMIUM                optional Chromium executable path
//
// Stable hooks: the gate prefers [data-qa="start"] and [data-qa="primary-action"] when
// present and falls back to today's accessible names, so renaming a button does not
// silently disable a check.

import { chromium } from "playwright"
import fs from "node:fs/promises"
import path from "node:path"

const BASE = process.env.RAFFI_APP_URL ?? "http://127.0.0.1:3100"
const OUT = process.env.RAFFI_QA_OUTPUT_DIR ?? "/tmp/raffi-play-readiness"
const EXECUTABLE = process.env.RAFFI_CHROMIUM || undefined
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1]
const REPORT_ONLY = process.argv.includes("--report-only")
const ONLY = arg("only")?.split(",")
const ONLY_PROFILES = arg("profiles")?.split(",")
const MIN_TARGET = 44
const MIN_CELL = 28
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TOUCH_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const PROFILES = {
  "phone-portrait": { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: TOUCH_UA },
  "phone-landscape": { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: TOUCH_UA },
  "small-landscape": { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: TOUCH_UA },
  laptop: { viewport: { width: 1280, height: 720 } },
  desktop: { viewport: { width: 1440, height: 900 } },
}

// start: accessible name of the first control a player must press.
// mustSee: an extra element that has to be fully visible before play (e.g. the far corner of a board).
// action: the main action button that belongs on the right thumb in landscape.
const TARGETS = [
  { id: "dig", open: "/?app=crates", start: /^Start$/, action: /^Jump$/, touchProbe: true },
  { id: "borough-gp", card: "Borough Grand Prix", start: /^Start race$/, action: /^Gas$/ },
  { id: "overtime", card: "Overtime", start: /^Kick off$/, action: /^Jump$/ },
  { id: "snake", card: "Snake", start: /^Start or pause game$/ },
  { id: "parachute", card: "Parachute", start: /^Start or pause game$/ },
  { id: "brickbreaker", card: "Brick Breaker", start: /^Start campaign$/, action: /^Launch/ },
  { id: "minesweeper", card: "Minesweeper", start: /^Row 1, column 1/, mustSee: /^Row 10, column 10/ },
  { id: "block-party-brawl", card: "Block Party Brawl", start: /^Hit the street$/, action: /^Punch$/ },
  { id: "dockyard", card: "Dockyard", start: /^Open the dock$/ },
  { id: "signal-lost", card: "Signal Lost", start: /^Enter the substation$/, action: /Fire/ },
  { id: "world", open: "/?app=world", world: true },
].filter((t) => !ONLY || ONLY.includes(t.id))

const THIRD_PARTY = /soundcloud|vimeo|youtube|emulatorjs|_vercel\/insights|google|gstatic/i

function rectOk(r, vw, vh) {
  return r && r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1
}

async function touchTap(cdp, x, y) {
  const p = { x: Math.round(x), y: Math.round(y), id: 7, radiusX: 6, radiusY: 6, force: 1 }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] })
  await sleep(50)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [p] })
}

async function press(page, cdp, touch, box) {
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  if (touch) await touchTap(cdp, x, y)
  else await page.mouse.click(x, y)
}

// Collect the active window's controls with geometry and hit-testing, in page coordinates.
async function collectControls(page) {
  return page.evaluate(({ MIN_TARGET, MIN_CELL }) => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.getAttribute("aria-modal") === "true")
    const dialog = dialogs[dialogs.length - 1]
    if (!dialog) return { error: "no active window" }
    const chrome = dialog.querySelector('[aria-label="Window controls"]')
    const nodes = [...dialog.querySelectorAll('button, [data-game-joystick], [role="slider"], input, select, [data-qa="primary-action"]')]
      .filter((el) => !chrome?.contains(el))
      .filter((el) => {
        const cs = getComputedStyle(el)
        if (cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden], [inert], [aria-hidden='true']")) return false
        const r = el.getBoundingClientRect()
        return r.width > 2 && r.height > 2
      })
    const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40)
    // Share of the element left visible after every clipping ancestor and the viewport.
    const visibleFraction = (el) => {
      const r = el.getBoundingClientRect()
      let left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom)
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if (!/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) continue
        const ar = a.getBoundingClientRect()
        left = Math.max(left, ar.left); top = Math.max(top, ar.top); right = Math.min(right, ar.right); bottom = Math.min(bottom, ar.bottom)
      }
      const area = Math.max(0, right - left) * Math.max(0, bottom - top)
      return r.width * r.height ? area / (r.width * r.height) : 0
    }
    return {
      controls: nodes.map((el, index) => {
        const r = el.getBoundingClientRect()
        const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2))
        const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))
        const hit = document.elementFromPoint(cx, cy)
        const cell = /^Row \d+, column \d+/.test(el.getAttribute("aria-label") || "")
        return {
          index,
          name: name(el),
          rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
          hittable: !!hit && (hit === el || el.contains(hit)),
          visible: visibleFraction(el),
          minSize: cell ? MIN_CELL : MIN_TARGET,
          joystick: el.hasAttribute("data-game-joystick"),
          primary: el.getAttribute("data-qa") === "primary-action",
          parentIndex: nodes.findIndex((other) => other !== el && other.contains(el)),
        }
      }),
      vw: innerWidth,
      vh: innerHeight,
    }
  }, { MIN_TARGET, MIN_CELL })
}

function overlaps(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 6 && h > 6
}

async function findStart(page, target) {
  const qa = page.locator('[role="dialog"][aria-modal="true"] [data-qa="start"]').first()
  if (await qa.count()) return qa
  return page.getByRole("button", { name: target.start }).first()
}

async function runShelfOrDig(page, cdp, profileName, target, touch, result) {
  if (target.card) {
    await page.goto(`${BASE}/?app=games`, { waitUntil: "networkidle" })
    await sleep(600)
    const card = page.getByRole("button", { name: `Play ${target.card}` })
    await card.scrollIntoViewIfNeeded()
    await press(page, cdp, touch, await card.boundingBox())
  } else {
    await page.goto(`${BASE}${target.open}`, { waitUntil: "networkidle" })
  }
  await sleep(2200)

  const vw = page.viewportSize().width
  const vh = page.viewportSize().height
  const start = await findStart(page, target)
  const startBox = (await start.count()) ? await start.boundingBox() : null
  const startHit = startBox
    ? await start.evaluate((el) => {
        const r = el.getBoundingClientRect()
        // A cross of points (not corners) so rounded or rotated buttons are judged fairly.
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const points = [[cx, cy], [cx - r.width * 0.3, cy], [cx + r.width * 0.3, cy], [cx, cy - r.height * 0.25], [cx, cy + r.height * 0.25]]
        return points.every(([x, y]) => { const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit)) })
      })
    : false
  const startVisible = !!startBox && rectOk({ ...startBox, left: startBox.x, top: startBox.y, right: startBox.x + startBox.width, bottom: startBox.y + startBox.height }, vw, vh) && startHit
  result.checks.push({ check: "start control visible without scrolling", pass: startVisible, detail: startBox ? `${Math.round(startBox.x)},${Math.round(startBox.y)} ${Math.round(startBox.width)}x${Math.round(startBox.height)} hit=${startHit}` : "not found" })

  if (target.mustSee) {
    const must = page.getByRole("button", { name: target.mustSee }).first()
    const b = (await must.count()) ? await must.boundingBox() : null
    const ok = !!b && rectOk({ left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height, width: b.width, height: b.height }, vw, vh)
    result.checks.push({ check: "whole board visible without scrolling", pass: ok, detail: b ? `${Math.round(b.x)},${Math.round(b.y)}` : "not found" })
  }

  if (startBox) {
    // Press it even when it is off screen: the remaining checks are about play, not discovery.
    await start.scrollIntoViewIfNeeded().catch(() => {})
    await press(page, cdp, touch, await start.boundingBox())
  }
  await sleep(600)
  await page.screenshot({ path: path.join(OUT, profileName, `${target.id}.png`) })

  const snap = await collectControls(page)
  if (snap.error) {
    result.checks.push({ check: "active window found", pass: false, detail: snap.error })
    return
  }
  const offscreen = snap.controls.filter((c) => !rectOk(c.rect, snap.vw, snap.vh) || !c.hittable || c.visible < 0.9)
  result.checks.push({ check: "in-game controls on screen, unclipped and tappable", pass: offscreen.length === 0, detail: offscreen.map((c) => `${c.name}${c.visible < 0.9 ? ` (${Math.round(c.visible * 100)}% visible)` : ""}`).slice(0, 8).join(" | ") })

  const pairs = []
  for (let i = 0; i < snap.controls.length; i++)
    for (let j = i + 1; j < snap.controls.length; j++) {
      const a = snap.controls[i]
      const b = snap.controls[j]
      if (a.parentIndex === j || b.parentIndex === i) continue
      if (overlaps(a.rect, b.rect)) pairs.push(`${a.name} x ${b.name}`)
    }
  result.checks.push({ check: "controls do not overlap", pass: pairs.length === 0, detail: pairs.slice(0, 6).join(" | ") })

  if (touch) {
    const small = snap.controls.filter((c) => c.rect.width < c.minSize - 0.5 || c.rect.height < c.minSize - 0.5)
    result.checks.push({ check: `touch targets >= ${MIN_TARGET}px`, pass: small.length === 0, detail: small.map((c) => `${c.name}(${Math.round(c.rect.width)}x${Math.round(c.rect.height)})`).slice(0, 8).join(" | ") })
  }

  if (touch && vw > vh) {
    const stick = snap.controls.find((c) => c.joystick)
    const action = snap.controls.find((c) => c.primary) ?? (target.action ? snap.controls.find((c) => target.action.test(c.name)) : null)
    if (stick && action) {
      const stickX = (stick.rect.left + stick.rect.right) / 2
      const actionX = (action.rect.left + action.rect.right) / 2
      const ok = stickX < vw * 0.5 && actionX > vw * 0.5
      result.checks.push({ check: "landscape: stick left thumb, action right thumb", pass: ok, detail: `stick x=${Math.round(stickX)} action(${action.name}) x=${Math.round(actionX)} of ${vw}` })
    }
  }

  // A first-time player who is still finding the controls must not lose in the first seconds.
  await sleep(3000)
  const lostEarly = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.getAttribute("aria-modal") === "true").pop()
    return !!dialog && /\bGAME OVER\b|\bYou lost\b|\bDefeated\b/i.test(dialog.innerText)
  })
  result.checks.push({ check: "no game over within 3s of idle", pass: !lostEarly, detail: lostEarly ? "game ended before any input" : "" })

  if (target.touchProbe && touch) {
    // Ambient animation (stars, pulsing blocks, the passing train) changes a few pixels on its
    // own, so compare how much of the frame changes while idle with how much changes while
    // holding right. Scrolling the street changes most of the frame.
    const snap = () =>
      page.evaluate(() => {
        const c = document.querySelector('[data-game="brooklyn-dig"] canvas') ?? document.querySelector('[role="dialog"][aria-modal="true"] canvas')
        const ctx = c?.getContext("2d")
        if (!ctx) return false
        ;(window.__qaFrames ??= []).push(ctx.getImageData(0, 0, c.width, c.height).data)
        return true
      })
    const changed = () =>
      page.evaluate(() => {
        const [a, b] = window.__qaFrames.slice(-2)
        let n = 0
        for (let i = 0; i < a.length; i += 16) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++
        return n / (a.length / 16)
      })
    const stick = page.locator("[data-game-joystick]").first()
    const right = page.getByRole("button", { name: /^Move right$/ }).first()
    const control = (await stick.count()) ? stick : right
    const b = (await control.count()) ? await control.boundingBox() : null
    if (b && (await snap())) {
      await sleep(1600)
      await snap()
      const idle = await changed()
      const p = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), id: 11, radiusX: 6, radiusY: 6, force: 1 }
      const held = { ...p, x: p.x + Math.round(b.width * 0.4) }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] })
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [held] })
      await sleep(1600)
      await snap()
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [held] })
      const moving = await changed()
      const ok = moving > 0.2 && moving > idle * 2
      result.checks.push({ check: "touch movement scrolls the level", pass: ok, detail: `changed ${Math.round(moving * 100)}% of the frame while holding right vs ${Math.round(idle * 100)}% idle` })
    } else {
      result.checks.push({ check: "touch movement scrolls the level", pass: false, detail: "no movement control or 2D canvas found" })
    }
  }
}

async function runWorld(page, cdp, profileName, touch, result) {
  await page.goto(`${BASE}/?app=world`, { waitUntil: "domcontentloaded" })
  const fl = page.frameLocator('iframe[title="RAFFI WORLD"]')
  const cta = fl.getByRole("button", { name: /Step outside|Continue/ }).first()
  try {
    await cta.waitFor({ timeout: 120000 })
  } catch {
    result.checks.push({ check: "world title loads", pass: false, detail: "no start button within 120s" })
    return
  }
  await sleep(1200)
  const vw = page.viewportSize().width
  const vh = page.viewportSize().height
  const ctaBox = await cta.boundingBox()
  // Inside the game frame's own viewport and not covered by HUD or overlays.
  const inFrame = await cta.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && !!hit && (hit === el || el.contains(hit))
  })
  const ok = !!ctaBox && inFrame && ctaBox.y >= 0 && ctaBox.y + ctaBox.height <= vh && ctaBox.x >= 0 && ctaBox.x + ctaBox.width <= vw
  result.checks.push({ check: "start control visible without scrolling", pass: ok, detail: ctaBox ? `${Math.round(ctaBox.x)},${Math.round(ctaBox.y)} ${Math.round(ctaBox.width)}x${Math.round(ctaBox.height)} inFrame=${inFrame}` : "not found" })
  await press(page, cdp, touch, ctaBox)
  await sleep(4000)
  await page.screenshot({ path: path.join(OUT, profileName, "world.png") })

  const frame = page.frames().find((f) => f.url().includes("/world/index.html"))
  const hud = await frame.evaluate(() => {
    const visible = (el) => {
      if (!el) return false
      const cs = getComputedStyle(el)
      if (cs.display === "none" || cs.visibility === "hidden" || el.closest(".hidden, [hidden]")) return false
      const r = el.getBoundingClientRect()
      return r.width > 2 && r.height > 2
    }
    const els = [...document.querySelectorAll("#touch button, #stick-zone, #game-question, #play-tools button, #side-activities button, #minimap")].filter(visible)
    return {
      vw: innerWidth,
      vh: innerHeight,
      items: els.map((el) => {
        const r = el.getBoundingClientRect()
        return { id: el.id || el.textContent.trim().slice(0, 16), rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }, interactive: el.tagName === "BUTTON" }
      }),
    }
  })
  const pairs = []
  for (let i = 0; i < hud.items.length; i++)
    for (let j = i + 1; j < hud.items.length; j++) {
      const a = hud.items[i]
      const b = hud.items[j]
      if (a.id === "stick-zone" || b.id === "stick-zone") continue // the stick zone is an intentionally large invisible area
      if (overlaps(a.rect, b.rect)) pairs.push(`${a.id} x ${b.id}`)
    }
  result.checks.push({ check: "HUD controls do not overlap", pass: pairs.length === 0, detail: pairs.slice(0, 8).join(" | ") })
  const out = hud.items.filter((it) => !rectOk(it.rect, hud.vw, hud.vh))
  result.checks.push({ check: "HUD inside the game view", pass: out.length === 0, detail: out.map((it) => it.id).join(" | ") })
  if (touch) {
    const small = hud.items.filter((it) => it.interactive && (it.rect.width < MIN_TARGET - 0.5 || it.rect.height < MIN_TARGET - 0.5))
    result.checks.push({ check: `touch targets >= ${MIN_TARGET}px`, pass: small.length === 0, detail: small.map((it) => `${it.id}(${Math.round(it.rect.width)}x${Math.round(it.rect.height)})`).join(" | ") })
    const hints = await frame.evaluate(() => [...document.querySelectorAll("#hud button, #hud [id$='label']")].filter((el) => el.getClientRects().length && /·\s?[A-Z]$/.test(el.textContent.trim())).map((el) => el.textContent.trim()))
    result.checks.push({ check: "no keyboard-only hints on touch", pass: hints.length === 0, detail: hints.join(" | ") })
  }

  // World labels must never draw above an open modal.
  const q = fl.locator("#game-question")
  if (await q.count()) {
    await press(page, cdp, touch, await q.boundingBox())
    await sleep(900)
    const leak = await frame.evaluate(() => {
      const menu = document.getElementById("cheat-menu")
      if (!menu || menu.classList.contains("hidden")) return "cheat menu did not open"
      const suspects = [...document.querySelectorAll("#side-activities button, #game-question, #touch button")].filter((el) => el.getClientRects().length)
      const leaking = suspects.filter((el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return hit && (hit === el || el.contains(hit)) && !menu.contains(el)
      })
      return leaking.map((el) => el.id || el.textContent.trim().slice(0, 20)).join(" | ")
    })
    result.checks.push({ check: "nothing draws over the cheat sheet modal", pass: leak === "", detail: leak })
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] })
  const results = []
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    if (ONLY_PROFILES && !ONLY_PROFILES.includes(profileName)) continue
    await fs.mkdir(path.join(OUT, profileName), { recursive: true })
    for (const target of TARGETS) {
      const context = await browser.newContext(profile)
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      const errors = []
      page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`))
      page.on("console", (m) => {
        if (m.type() !== "error") return
        const url = m.location()?.url ?? ""
        if (THIRD_PARTY.test(url) || THIRD_PARTY.test(m.text()) || /ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|net::ERR/.test(m.text())) return
        if (url && !url.startsWith(BASE)) return
        errors.push(`console: ${m.text().slice(0, 200)}`)
      })
      const touch = !!profile.hasTouch
      const result = { profile: profileName, target: target.id, checks: [] }
      try {
        if (target.world) await runWorld(page, cdp, profileName, touch, result)
        else await runShelfOrDig(page, cdp, profileName, target, touch, result)
      } catch (error) {
        result.checks.push({ check: "run completed", pass: false, detail: String(error).slice(0, 200) })
      }
      result.checks.push({ check: "no first-party errors", pass: errors.length === 0, detail: errors.slice(0, 3).join(" | ") })
      results.push(result)
      const failed = result.checks.filter((c) => !c.pass)
      console.log(`${failed.length ? "FAIL" : "PASS"}  ${profileName.padEnd(16)} ${target.id.padEnd(18)} ${failed.map((c) => `${c.check}: ${c.detail}`).join("  ||  ")}`)
      await context.close()
    }
  }
  await browser.close()
  const failures = results.flatMap((r) => r.checks.filter((c) => !c.pass).map((c) => ({ profile: r.profile, target: r.target, ...c })))
  await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, generatedAt: new Date().toISOString(), results, failures }, null, 2))
  console.log(`\n${results.length} runs, ${failures.length} failed checks. Report: ${path.join(OUT, "report.json")}`)
  if (failures.length && !REPORT_ONLY) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
