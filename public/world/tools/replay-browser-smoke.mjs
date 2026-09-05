#!/usr/bin/env node
/** Two-run REWIND journey + budget + mobile layout. */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3025/world/index.html'
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-replay-smoke'
await fs.mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

async function ready(context) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(BASE + '?debug=1&auto=1&seed=FIXED', { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready, null, { timeout: 180_000 })
  await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
  page._errs = errors
  return page
}

async function waitRecording(page, minSec = 3) {
  // The engine caps dt at 50ms, so slow software rendering advances less
  // simulation time than wall time. Wait for actual 10Hz samples instead.
  const deadline = Date.now() + 120_000
  let span = 0
  while (Date.now() < deadline) {
    // Await evaluate explicitly: Playwright's polling predicate must not
    // receive a Promise that can be mistaken for a truthy completed result.
    span = await page.evaluate(async () => {
      const { snapshotNpcRun } = await import('./game/npc-sim.js')
      const samples = snapshotNpcRun().transforms
      return samples.length > 0 ? samples[samples.length - 1].t - samples[0].t : 0
    })
    if (span >= minSec) return
    await page.waitForTimeout(100)
  }
  assert.fail(`recorded only ${span.toFixed(2)} simulation seconds; expected ${minSec}`)
}

try {
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ready(desk)

  // REWIND starts unavailable / recording after START
  let phase = await page.evaluate(() => window.RAFFI_WORLD.getReplayPhase())
  assert.ok(['recording', 'idle', 'ready'].includes(phase), 'phase=' + phase)

  // Initially no frozen run until we end recording
  await page.evaluate(() => window.RAFFI_WORLD.beginRecordingRun())
  assert.equal(
    await page.evaluate(() => window.RAFFI_WORLD.hasValidRun()),
    false,
    'REWIND data should be empty just after beginRecordingRun',
  )

  // Run 1: record NPCs
  await waitRecording(page, 4)
  const ended = await page.evaluate(() => window.RAFFI_WORLD.endRecordingRun())
  assert.equal(ended, true, 'endRecordingRun should capture samples')
  assert.equal(await page.evaluate(() => window.RAFFI_WORLD.hasValidRun()), true)
  assert.equal(await page.evaluate(() => {
    const b = document.querySelector('[data-pause="rewind"]')
    return b && !b.disabled
  }), true, 'REWIND button enabled after valid run')

  // Start compare (keep game unpaused so the loop samples run B)
  const started = await page.evaluate(() => window.RAFFI_WORLD.startRewindCompare())
  assert.equal(started, true)
  assert.equal(await page.evaluate(() => window.RAFFI_WORLD.getReplayPhase()), 'comparing')

  // Ghost meshes exist
  const ghosts = await page.evaluate(async () => {
    const { gfx } = await import('./engine/render.js')
    let n = 0
    gfx.scene.traverse((o) => {
      if (o.name === 'replay-ghosts') n += o.children.length
    })
    return n
  })
  assert.ok(ghosts > 0, 'ghost meshes from run-one transforms')

  // Live metrics after some compare time (bufferSeconds is 90 — stop early)
  await waitRecording(page, 3.5)
  let metrics = await page.evaluate(() => {
    const mid = window.RAFFI_WORLD.replaySnapshot()?.metrics
    window.RAFFI_WORLD.stopCompare()
    return window.RAFFI_WORLD.getLastMetrics() || mid
  })
  assert.ok(metrics, 'final metrics present: ' + JSON.stringify(metrics))
  assert.ok(metrics.ready, 'metrics ready: ' + JSON.stringify(metrics))
  assert.ok(Number.isFinite(metrics.darPercent) && metrics.darPercent >= 0 && metrics.darPercent <= 100)
  assert.ok(Number.isFinite(metrics.tarPercent) && metrics.tarPercent >= 0 && metrics.tarPercent <= 100)

  await page.screenshot({ path: OUT + '/replay-complete-desktop.png' })
  console.log('[replay] DAR%', metrics.darPercent, 'TAR%', metrics.tarPercent)

  // Cameras still work
  for (const mode of ['classic', 'chase', 'free', 'birds']) {
    await page.evaluate((m) => window.RAFFI_WORLD.setCameraMode(m), mode)
    await page.waitForTimeout(80)
    const s = await page.evaluate(() => window.RAFFI_WORLD.stats())
    assert.ok(s.drawCalls < 120, mode + ' draws ' + s.drawCalls)
    assert.ok(s.triangles < 60_000, mode + ' tris ' + s.triangles)
  }

  // Second full cycle: re-record and compare (lifecycle reset)
  await page.evaluate(() => window.RAFFI_WORLD.beginRecordingRun())
  await waitRecording(page, 3)
  await page.evaluate(() => window.RAFFI_WORLD.endRecordingRun())
  await page.evaluate(() => window.RAFFI_WORLD.startRewindCompare())
  await waitRecording(page, 1.5)
  await page.evaluate(() => window.RAFFI_WORLD.stopCompare())
  const m2 = await page.evaluate(() => window.RAFFI_WORLD.getLastMetrics())
  assert.ok(m2?.ready)

  // Identical seeded runs may legitimately agree fully: random goal ties do
  // not guarantee a >2.5m path difference. Supply an explicit world-context
  // change instead. Both streams still come from real NPC decisions, movement,
  // collisions and replay buffers; no samples or metrics are manufactured.
  // Earlier cycles cover the live RAF integration. Fixed steps make this
  // policy/comparison fixture independent of browser speed and clock time.
  const divergence = await page.evaluate(async () => {
    const { state } = await import('./engine/state.js')
    const { updateReplay } = await import('./game/replay.js')
    const { snapshotNpcRun } = await import('./game/npc-sim.js')
    const api = window.RAFFI_WORLD
    const wasPaused = state.paused
    state.paused = true
    const run = (threat) => {
      for (let frame = 0; frame < 360; frame++) {
        updateReplay(1 / 60, { hour: 12, threatNear: () => threat })
      }
      const stream = snapshotNpcRun()
      return {
        decisions: stream.decisions.length,
        fleeDecisions: stream.decisions.filter((sample) => sample.verb === 'flee').length,
        transforms: stream.transforms.length,
        duration: stream.transforms.at(-1).t - stream.transforms[0].t,
      }
    }
    try {
      api.beginRecordingRun()
      const calm = run(false)
      const captured = api.endRecordingRun()
      const started = api.startRewindCompare()
      const threatened = run(true)
      api.stopCompare()
      return { captured, started, calm, threatened, metrics: api.getLastMetrics() }
    } finally {
      state.paused = wasPaused
    }
  })
  assert.equal(divergence.captured, true)
  assert.equal(divergence.started, true)
  assert.ok(divergence.calm.duration > 5.8 && divergence.threatened.duration > 5.8)
  assert.ok(divergence.threatened.fleeDecisions > divergence.calm.fleeDecisions, 'threat must change real NPC decisions')
  const mDiv = divergence.metrics
  assert.ok(mDiv?.ready, 'divergence metrics ready')
  assert.ok(
    mDiv.dar.compared > 0 && mDiv.dar.matched < mDiv.dar.compared,
    'threatened NPC decisions must disagree with the calm recording: ' + JSON.stringify(mDiv),
  )
  assert.ok(
    mDiv.tar.compared > 0 && mDiv.tar.matched < mDiv.tar.compared,
    'threatened NPC trajectories must diverge from the calm recording: ' + JSON.stringify(mDiv),
  )
  console.log('[replay] second cycle DAR%', m2.darPercent, 'TAR%', m2.tarPercent)
  console.log('[replay] divergence DAR%', mDiv.darPercent, 'TAR%', mDiv.tarPercent)

  // Budget during compare
  await page.evaluate(() => window.RAFFI_WORLD.startRewindCompare())
  await page.waitForTimeout(400)
  const budget = await page.evaluate(() => window.RAFFI_WORLD.stats())
  assert.ok(budget.drawCalls < 120, 'compare draws ' + budget.drawCalls)
  assert.ok(budget.triangles < 60_000, 'compare tris ' + budget.triangles)
  console.log('[replay] compare budget', budget)
  await page.evaluate(() => window.RAFFI_WORLD.stopCompare())

  assert.equal(page._errs.length, 0, 'console errors: ' + page._errs.join(' | '))

  // Mobile
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mpage = await ready(mob)
  await mpage.evaluate(() => {
    document.getElementById('touch')?.classList.remove('hidden')
    document.getElementById('rewind')?.classList.remove('hidden')
  })
  const layout = await mpage.evaluate(() => {
    const box = (id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    }
    const hit = (a, b) => a && b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)
    const rw = box('rewind')
    const action = box('btn-action')
    const second = box('btn-second')
    const radio = box('btn-radio')
    const map = box('minimap')
    return {
      hitAction: hit(rw, action),
      hitSecond: hit(rw, second),
      hitRadio: hit(rw, radio),
      hitMap: hit(rw, map),
    }
  })
  assert.equal(layout.hitAction, false)
  assert.equal(layout.hitSecond, false)
  assert.equal(layout.hitRadio, false)
  assert.equal(layout.hitMap, false)
  await mpage.screenshot({ path: OUT + '/replay-mobile-390.png' })

  await fs.writeFile(OUT + '/replay-metrics.json', JSON.stringify({
    dar: metrics.darPercent,
    tar: metrics.tarPercent,
    dar2: m2.darPercent,
    tar2: m2.tarPercent,
    divergence,
    budget,
  }, null, 2))
  console.log('[replay] PASS')
} finally {
  await browser.close()
}
