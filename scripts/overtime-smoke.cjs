const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const { chromium } = require("playwright")
const out = process.env.RAFFI_SMOKE_OUT || "/tmp/overtime-qa"
const base = process.env.RAFFI_APP_URL || "http://localhost:3006"
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function state(game) {
  return game.evaluate((el) => ({
    phase: el.dataset.phase,
    x: +el.dataset.playerX,
    z: +el.dataset.playerZ,
    angle: +el.dataset.playerAngle,
    height: +el.dataset.playerHeight,
    bx: +el.dataset.ballX,
    bz: +el.dataset.ballZ,
    hits: +el.dataset.hits,
    fuel: +el.querySelector("meter").value,
    score: el.querySelector("header>div").getAttribute("aria-label"),
  }))
}
async function setup(browser, name, width, height) {
  const c = await browser.newContext({ viewport: { width, height }, hasTouch: name !== "desktop" })
  const p = await c.newPage()
  const errors = []
  p.on("pageerror", (e) => errors.push(e.message))
  await p.route("**/api/scores*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scores: [], game: "overtime", metric: "points", order: "desc", schemaVersion: 3 }),
    }),
  )
  await p.goto(`${base}/?app=games`)
  await p.getByRole("button", { name: "Play Overtime", exact: true }).click()
  await p.getByRole("button", { name: "Kick off", exact: true }).waitFor()
  return { c, p, game: p.locator('[data-game="overtime"]'), errors }
}
async function run() {
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const report = []
  try {
    const { c, p, game, errors } = await setup(browser, "desktop", 1280, 900)
    let savedPosts = []
    await p.route("**/api/scores*", async (route) => {
      if (route.request().method() === "POST") {
        savedPosts.push(route.request().postDataJSON())
        await route.fulfill({
          status: savedPosts.length === 1 ? 503 : 200,
          contentType: "application/json",
          body: JSON.stringify(
            savedPosts.length === 1 ? { error: "Test service unavailable. Try again." } : { success: true },
          ),
        })
      } else
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ scores: [], game: "overtime", metric: "points", order: "desc", schemaVersion: 3 }),
        })
    })
    await p.screenshot({ path: out + "/desktop-ready.png" })
    await p.getByRole("button", { name: "Kick off", exact: true }).click()
    await game.locator(':scope[data-phase="playing"]').waitFor()
    const beginning = await state(game)
    await p.keyboard.down("w")
    await p.keyboard.down("Shift")
    await wait(650)
    await p.keyboard.up("Shift")
    await p.keyboard.down("d")
    await wait(400)
    await p.keyboard.up("d")
    await p.keyboard.up("w")
    let moved = await state(game)
    assert.ok(moved.x > beginning.x + 3)
    assert.ok(moved.z > beginning.z + 0.2)
    assert.ok(moved.fuel < beginning.fuel)
    await p.keyboard.down("Space")
    await wait(220)
    assert.ok((await state(game)).height > 0.3)
    await p.keyboard.up("Space")
    await p.keyboard.press("Escape")
    await p.getByRole("button", { name: "Resume match" }).waitFor()
    const paused = await state(game)
    await wait(350)
    const still = await state(game)
    assert.equal(still.x, paused.x)
    assert.equal(still.bx, paused.bx)
    assert.equal(still.score, paused.score)
    await p.getByRole("button", { name: "Restart", exact: true }).click()
    await game.locator(':scope[data-phase="playing"]').waitFor()
    // Drive a full match with real keyboard inputs. Read-only DOM telemetry supplies position/heading;
    // there are no engine writes, shortcuts, altered timers, or injected score events.
    const held = new Set()
    let previous = null
    let lastTime = Date.now()
    const deadline = Date.now() + 300000
    let maxHits = 0
    let goals = []
    let lastPhase = "playing"
    while (Date.now() < deadline) {
      const s = await state(game)
      if (s.phase === "finished") break
      let wanted = []
      if (s.phase === "playing") {
        const now = Date.now(),
          dt = Math.max(0.06, (now - lastTime) / 1000)
        const vx = previous ? (s.bx - previous.bx) / dt : 0,
          vz = previous ? (s.bz - previous.bz) / dt : 0
        const bx = Math.max(-23, Math.min(23, s.bx + vx * 0.16)),
          bz = Math.max(-14, Math.min(14, s.bz + vz * 0.16))
        const gx = 26 - bx,
          gz = -bz,
          dg = Math.hypot(gx, gz) || 1
        const behind = s.x > bx - 1.4 || Math.abs(s.z - bz) > 2.4 || Math.cos(s.angle) < 0.4
        let tx = bx - (gx / dg) * (behind ? 4.5 : 0.6),
          tz = bz - (gz / dg) * (behind ? 4.5 : 0.6)
        if (s.x > bx - 1.5 && Math.abs(s.z - bz) < 4.5) tz += s.z >= bz ? 5 : -5
        tx = Math.max(-24, Math.min(24, tx))
        tz = Math.max(-15, Math.min(15, tz))
        const diff = Math.atan2(
          Math.sin(Math.atan2(tz - s.z, tx - s.x) - s.angle),
          Math.cos(Math.atan2(tz - s.z, tx - s.x) - s.angle),
        )
        if (Math.abs(diff) > 0.06) wanted.push(diff > 0 ? "d" : "a")
        if (Math.abs(diff) < 1.1) wanted.push("w")
        if (Math.abs(diff) < 0.24 && Math.hypot(tx - s.x, tz - s.z) > 6 && s.fuel > 28) wanted.push("Shift")
        previous = s
        lastTime = now
        maxHits = Math.max(maxHits, s.hits)
      } else {
        previous = null
        if (s.phase === "goal" && lastPhase !== "goal") {
          goals.push(s.score)
          console.info("goal", s.score)
        }
      }
      for (const key of Array.from(held))
        if (!wanted.includes(key)) {
          await p.keyboard.up(key)
          held.delete(key)
        }
      for (const key of wanted)
        if (!held.has(key)) {
          await p.keyboard.down(key)
          held.add(key)
        }
      lastPhase = s.phase
      await wait(85)
    }
    for (const key of held) await p.keyboard.up(key)
    assert.equal(await game.getAttribute("data-phase"), "finished", "full match must end")
    const final = await state(game)
    assert.ok(maxHits > 0, "player must make actual ball contacts")
    assert.ok(goals.length > 0, "match must score real goals")
    console.info("full match", final.score, "hits", maxHits)
    await p.screenshot({ path: out + "/desktop-result.png" })
    const nickname = p.getByRole("textbox", { name: "Nickname for leaderboard" })
    await nickname.fill("Race Driver R")
    await nickname.press("Space")
    await nickname.press("r")
    assert.equal(await game.getAttribute("data-phase"), "finished")
    assert.equal(savedPosts.length, 0)
    await p.getByRole("button", { name: "Save result", exact: true }).click()
    await p.getByText("Test service unavailable. Try again.").waitFor()
    assert.equal(savedPosts.length, 1)
    await p.getByRole("button", { name: "Save result", exact: true }).click()
    await p.getByText(/Saved. Your best result/).waitFor()
    assert.equal(savedPosts.length, 2)
    assert.equal(savedPosts[1].gameName, "overtime")
    assert.equal(
      savedPosts[1].score,
      +final.score.match(/You (\d+)/)[1] * 100 +
        (+final.score.match(/You (\d+)/)[1] > +final.score.match(/rival (\d+)/)[1] ? 250 : 0),
    )
    await p.setViewportSize({ width: 390, height: 844 })
    await p.screenshot({ path: out + "/phone-result.png" })
    await p.setViewportSize({ width: 844, height: 390 })
    await p.getByRole("button", { name: "View leaderboard" }).scrollIntoViewIfNeeded()
    await p.getByRole("button", { name: "View leaderboard" }).click()
    await p.screenshot({ path: out + "/landscape-result.png" })
    await p.getByRole("button", { name: "Play again", exact: true }).click()
    await game.locator(':scope[data-phase="kickoff"]').waitFor()
    await p.waitForFunction(() => document.querySelector('[data-game="overtime"]').dataset.hits === "0")
    await p.keyboard.press("Escape")
    await p.getByRole("button", { name: "Resume match" }).waitFor()
    await p.getByRole("button", { name: "Game shelf", exact: true }).click()
    await p.getByRole("button", { name: "Play Overtime", exact: true }).waitFor()
    assert.equal(await p.locator("canvas").count(), 0, "unmount must remove canvas")
    assert.deepEqual(errors, [])
    report.push({
      viewport: "desktop",
      fullMatch: final.score,
      hits: maxHits,
      goals,
      savePayload: savedPosts[1],
      errors,
    })
    await c.close()
    for (const [name, w, h] of [
      ["phone", 390, 844],
      ["landscape", 844, 390],
    ]) {
      const { c, p, game, errors } = await setup(browser, name, w, h)
      await p.screenshot({ path: out + `/${name}-ready.png` })
      await p.getByRole("button", { name: "Kick off", exact: true }).click()
      await game.locator(':scope[data-phase="playing"]').waitFor()
      const initial = await state(game),
        cdp = await c.newCDPSession(p)
      const forward = await p.getByRole("button", { name: "Accelerate", exact: true }).boundingBox(),
        boost = await p.getByRole("button", { name: "Boost", exact: true }).boundingBox()
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: forward.x + forward.width / 2, y: forward.y + forward.height / 2, id: 1 },
          { x: boost.x + boost.width / 2, y: boost.y + boost.height / 2, id: 2 },
        ],
      })
      await wait(600)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await wait(100)
      const moved = await state(game)
      assert.ok(moved.x > initial.x + 3)
      assert.ok(moved.fuel < initial.fuel)
      assert.equal(await game.locator('button[aria-pressed="true"]').count(), 0)
      await p.screenshot({ path: out + `/${name}-playing.png` })
      for (const label of ["Steer left", "Steer right", "Brake or reverse", "Jump", "Boost", "Accelerate"]) {
        const box = await p.getByRole("button", { name: label, exact: true }).boundingBox()
        assert.ok(box.x >= 0 && box.x + box.width <= w && box.y + box.height <= h - 25, `${label} fits`)
      }
      await p.evaluate(() => window.dispatchEvent(new Event("blur")))
      await p.getByRole("button", { name: "Resume match" }).waitFor()
      await p.getByRole("button", { name: "Resume match" }).click()
      assert.equal(await game.getAttribute("data-phase"), "playing")
      await p.getByRole("button", { name: "Pause Overtime" }).click()
      await p.getByRole("button", { name: "Restart", exact: true }).click()
      await game.locator(':scope[data-phase="kickoff"]').waitFor()
      assert.deepEqual(errors, [])
      report.push({
        viewport: name,
        touchMovement: moved.x - initial.x,
        fuel: moved.fuel,
        controlsFit: true,
        pauseRestart: true,
        errors,
      })
      await c.close()
    }
    await fs.writeFile(out + "/report.json", JSON.stringify(report, null, 2))
    console.info(JSON.stringify(report, null, 2))
  } finally {
    await browser.close()
  }
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
