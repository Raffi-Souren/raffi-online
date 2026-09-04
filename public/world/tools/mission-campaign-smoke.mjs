#!/usr/bin/env node

/** Browser smoke: boot + every authored mission kind via the debug API. */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const missions = JSON.parse(await fs.readFile(new URL('../data/missions.json', import.meta.url), 'utf8'))

const executableCandidates = [
  process.env.RAFFI_AUDIT_CHROME,
  chromium.executablePath(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
let executablePath
for (const candidate of executableCandidates) {
  try { await fs.access(candidate); executablePath = candidate; break } catch {}
}

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []

async function readyPage() {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  page.on('pageerror', (error) => errors.push('page: ' + error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()) })
  await page.goto(BASE + '?debug=1&auto=1&seed=FIXED', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0, null, { timeout: 120_000 })
  await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
  return page
}

async function pressKey(page, key, holdMs = 70) {
  await page.keyboard.down(key)
  await page.waitForTimeout(holdMs)
  await page.keyboard.up(key)
  await page.waitForTimeout(40)
}

async function finishDialogue(page) {
  await page.evaluate(async () => {
    const { advanceDialogue, isDialogueActive } = await import('/world/game/dialogue.js')
    for (let i = 0; i < 8 && isDialogueActive(); i++) {
      advanceDialogue()
      advanceDialogue()
    }
  })
  await page.waitForTimeout(80)
}

async function startOfferedAndAccept(page, id) {
  const spec = missions.missions.find((mission) => mission.id === id)
  const before = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(before.offered, id, 'normal campaign offered ' + before.offered + ' instead of ' + id)
  assert.ok(before.available.includes(id), id + ' was offered but unavailable: ' + JSON.stringify(before))

  await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), spec.marker)
  await page.waitForTimeout(100)
  await pressKey(page, 'e')
  await page.waitForFunction(
    (missionId) => {
      const snap = window.RAFFI_WORLD.missionSnapshot()
      return snap.active === missionId && snap.status === 'briefing'
    },
    id,
    { timeout: 5_000 },
  )
  // Environmental captions can already be active when the briefing is queued.
  // Drain the queue through the real dialogue callbacks so mission activation
  // remains deterministic while still starting via the visible marker action.
  await finishDialogue(page)
  await page.waitForFunction(
    (missionId) => {
      const snap = window.RAFFI_WORLD.missionSnapshot()
      return snap.active === missionId && snap.status === 'active'
    },
    id,
    { timeout: 5_000 },
  )
  const snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.status, 'active', id + ' stayed in briefing: ' + JSON.stringify(snap))
  return snap
}

async function driveTo(page, point) {
  await page.evaluate(async ({ x, z }) => {
    const { state } = await import('/world/engine/state.js')
    const { player } = await import('/world/game/player.js')
    const { updateMissions } = await import('/world/game/missions.js')
    state.paused = false
    state.mode = 'vehicle'
    state.player.x = x
    state.player.z = z
    if (!player.vehicle || !player.vehicle.handling) {
      player.vehicle = {
        x, z, yaw: 0, speed: 6, kind: 'car',
        handling: { accel: 0, brake: 0, topSpeed: 20, turn: 0 },
        mesh: { position: { set() {} } },
      }
    } else {
      player.vehicle.x = x
      player.vehicle.z = z
      player.vehicle.speed = 6
    }
    updateMissions(0.2)
    // Do not leave a stub vehicle for the live drive loop to animate.
    if (player.vehicle && !player.vehicle.archetypeId) {
      player.vehicle = null
      state.mode = 'foot'
      state.player.vehicle = null
    }
  }, point)
}

try {
  const page = await readyPage()
  const boot = await page.evaluate(() => ({
    interiors: window.RAFFI_WORLD.interiorSnapshot(),
    mission: window.RAFFI_WORLD.missionSnapshot(),
  }))
  assert.deepEqual(boot.interiors.rooms.sort(), ['club-floor', 'mainframe', 'pitch'])
  assert.equal(boot.mission.offered, 'deal-clock')
  assert.deepEqual(boot.mission.available, ['deal-clock'])

  // DEAL CLOCK — enter through the normal marker/action/briefing path.
  await startOfferedAndAccept(page, 'deal-clock')
  const dealClock = missions.missions.find((item) => item.id === 'deal-clock')
  for (const point of dealClock.objectives.find((item) => item.kind === 'goto-vehicle').points) {
    await driveTo(page, point)
  }
  await finishDialogue(page)
  let snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('deal-clock'), 'deal-clock: ' + JSON.stringify(snap))
  assert.equal(snap.offered, 'crate-dig', 'deal-clock did not advance the normal campaign')

  // CRATE DIG
  await startOfferedAndAccept(page, 'crate-dig')
  const crate = missions.missions.find((item) => item.id === 'crate-dig')
  const records = crate.objectives.find((item) => item.kind === 'collect').points
  for (let i = 0; i < records.length; i++) {
    const after = await page.evaluate(async ({ x, z }) => {
      window.RAFFI_WORLD.dismissDialogue()
      window.RAFFI_WORLD.teleport(x, z)
      const { updateMissions } = await import('/world/game/missions.js')
      updateMissions(0.2)
      return window.RAFFI_WORLD.missionSnapshot()
    }, records[i])
    assert.ok(
      after.collected.includes(i),
      'crate-dig missed record ' + i + ' at ' + JSON.stringify(records[i]) + ' snap=' + JSON.stringify(after),
    )
  }
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.collected.length, 6, 'crate-dig collect: ' + JSON.stringify(snap))
  await page.evaluate(async ({ x, z }) => {
    window.RAFFI_WORLD.teleport(x, z)
    const { updateMissions } = await import('/world/game/missions.js')
    updateMissions(0.2)
  }, crate.objectives.find((item) => item.kind === 'goto').points[0])
  await finishDialogue(page)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('crate-dig'), 'crate-dig: ' + JSON.stringify(snap))
  assert.equal(snap.offered, 'set-time', 'crate-dig did not advance the normal campaign')

  // SET TIME
  await startOfferedAndAccept(page, 'set-time')
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.interior, 'club-floor')
  await page.evaluate(async () => {
    const { state, data } = await import('/world/engine/state.js')
    const { updateMissions } = await import('/world/game/missions.js')
    state.paused = true
    const spec = data.missions.missions.find((item) => item.id === 'set-time').objectives[0]
    const interval = 60 / 124
    for (let i = 0; i < spec.bars * 4; i++) {
      updateMissions(interval - 0.02)
      window.RAFFI_WORLD.noteMissionPulse()
      updateMissions(0.02)
    }
    state.paused = false
  })
  await finishDialogue(page)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('set-time'), 'set-time: ' + JSON.stringify(snap))
  assert.equal(snap.interior, null)
  assert.equal(snap.offered, 'cold-boot', 'set-time did not advance the normal campaign')

  // COLD BOOT
  await startOfferedAndAccept(page, 'cold-boot')
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.interior, 'mainframe')
  await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), { x: 0, z: -48 })
  await page.waitForTimeout(280)
  await finishDialogue(page)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('cold-boot'), 'cold-boot: ' + JSON.stringify(snap))

  // The nearest normal branch is YARD RUN. Its unlock token must not bypass
  // ESCORT's authored SHOOTOUT prerequisite.
  assert.equal(snap.offered, 'yard-run', 'COLD BOOT did not choose the nearest open branch')
  assert.deepEqual(snap.available.sort(), ['shootout', 'yard-run'])
  await startOfferedAndAccept(page, 'yard-run')
  const yard = missions.missions.find((item) => item.id === 'yard-run')
  for (const point of yard.objectives.find((item) => item.kind === 'goto-vehicle').points) {
    await driveTo(page, point)
  }
  await finishDialogue(page)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('yard-run'), 'yard-run: ' + JSON.stringify(snap))
  assert.ok(snap.unlocked.includes('escort'), 'yard-run should still issue its authored unlock token')
  assert.deepEqual(snap.available, ['shootout'], 'yard-run bypassed the SHOOTOUT prerequisite')
  assert.equal(snap.offered, 'shootout')

  // SHOOTOUT
  await startOfferedAndAccept(page, 'shootout')
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.interior, 'pitch')
  await page.evaluate(async () => {
    const { state } = await import('/world/engine/state.js')
    const missions = await import('/world/game/missions.js')
    state.paused = true
    missions.updateMissions(0.02)
    for (let i = 0; i < 8; i++) {
      const live = missions.missionSnapshot()
      if (live.completed.includes('shootout') || live.active !== 'shootout') break
      const dive = live.shootout?.dive || 1
      window.RAFFI_WORLD.noteAimLane(-dive)
      window.RAFFI_WORLD.noteMissionKick()
      missions.updateMissions(0.05)
      missions.updateMissions(0.85)
    }
    state.paused = false
  })
  await finishDialogue(page)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('shootout'), 'shootout: ' + JSON.stringify(snap))
  assert.deepEqual(snap.available, ['escort'])
  assert.equal(snap.offered, 'escort')

  // ESCORT
  await startOfferedAndAccept(page, 'escort')
  const escort = missions.missions.find((item) => item.id === 'escort').objectives[0]
  await driveTo(page, escort.from)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.escortBoarded, true, 'escort did not board: ' + JSON.stringify(snap))
  await driveTo(page, escort.to)
  await finishDialogue(page)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('escort'), 'escort: ' + JSON.stringify(snap))
  assert.deepEqual(snap.available, ['blackout'], 'finale unlocked before every pre-finale mission')
  assert.equal(snap.offered, 'blackout')

  // BLACKOUT — enter at zero compliance to reproduce the stale actor snapshot.
  // Activation must raise the chase to five and leave EVADE incomplete.
  await page.evaluate(() => window.RAFFI_WORLD.setComplianceTier(0))
  await startOfferedAndAccept(page, 'blackout')
  await page.waitForTimeout(160)
  let blackoutStart = await page.evaluate(() => ({
    mission: window.RAFFI_WORLD.missionSnapshot(),
    tier: window.RAFFI_WORLD.getState().compliance.tier,
  }))
  assert.equal(blackoutStart.tier, 5, 'BLACKOUT did not apply its authored escalation')
  assert.equal(blackoutStart.mission.completedKinds.includes('evade'), false)

  const route = missions.missions.find((item) => item.id === 'blackout')
    .objectives.find((item) => item.kind === 'goto-vehicle').points
  for (const point of route) await driveTo(page, point)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.active, 'blackout', 'BLACKOUT completed from stale pre-escalation compliance')
  assert.equal(snap.completedKinds.includes('evade'), false)

  await page.evaluate(() => window.RAFFI_WORLD.setComplianceTier(0))
  await page.waitForTimeout(280)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('blackout'), 'blackout: ' + JSON.stringify(snap))
  assert.equal(
    await page.evaluate(() => document.getElementById('end-card')?.classList.contains('show')),
    true,
    'blackout end card missing',
  )
  await finishDialogue(page)
  snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(snap.offered, null)
  assert.deepEqual(snap.available, [])

  const realErrors = errors.filter((item) => !item.includes('favicon'))
  assert.equal(realErrors.length, 0, 'browser errors: ' + realErrors.join(' | '))
  console.info('mission campaign smoke passed')
} finally {
  await browser.close()
}
