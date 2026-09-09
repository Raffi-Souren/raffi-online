#!/usr/bin/env node

/** Browser smoke: boot + every authored mission kind via the debug API. */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-mission-campaign'
const MOBILE = process.env.RAFFI_CAMPAIGN_MOBILE === '1'
const missions = JSON.parse(await fs.readFile(new URL('../data/missions.json', import.meta.url), 'utf8'))
await fs.mkdir(OUT, { recursive: true })

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
  args: ['--no-sandbox', '--disable-dev-shm-usage', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])],
})
const errors = []
const report = { platform: MOBILE ? 'phone' : 'desktop', missions: [], checks: [], errors }
let page

async function readyPage() {
  const page = await (await browser.newContext(MOBILE
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
    : { viewport: { width: 1280, height: 720 } })).newPage()
  page.on('pageerror', (error) => errors.push('page: ' + error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()) })
  const url = new URL(BASE)
  url.searchParams.set('debug', '1')
  url.searchParams.set('auto', '1')
  url.searchParams.set('seed', 'FIXED')
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0, null, { timeout: 120_000 })
  await page.evaluate(async () => {
    window.RAFFI_WORLD.dismissDialogue()
    window.__CAMPAIGN_STATE__ = (await import('/world/engine/state.js')).state
    window.__CAMPAIGN_DIALOGUE__ = await import('/world/game/dialogue.js')
  })
  return page
}

async function frames(page, count = 2) {
  const target = await page.evaluate((n) => window.__CAMPAIGN_STATE__.frame + n, count)
  await page.waitForFunction((n) => window.__CAMPAIGN_STATE__.frame >= n, target, { timeout: 15_000 })
}

async function pressKey(page, key) {
  if (MOBILE && key === 'e') {
    const mounted = await page.evaluate(() => Boolean(window.RAFFI_WORLD.getState().player.vehicle))
    await page.locator(mounted ? '#btn-exit' : '#btn-action').tap()
  } else await page.keyboard.press(key)
  await frames(page)
}

async function finishDialogue(page) {
  await page.evaluate(async () => {
    const { advanceDialogue, isDialogueActive } = await import('/world/game/dialogue.js')
    for (let i = 0; i < 8 && isDialogueActive(); i++) {
      advanceDialogue()
      advanceDialogue()
    }
  })
  await frames(page)
}

/** The mission-passed call is a real player interaction, never a debug dismiss. */
async function finishRewardDialogue(page) {
  for (let i = 0; i < 180; i++) {
    const current = await page.evaluate(() => ({
      active: window.__CAMPAIGN_DIALOGUE__.isDialogueActive(),
      blocking: window.__CAMPAIGN_DIALOGUE__.isDialogueBlocking(),
      time: window.__CAMPAIGN_STATE__.time,
    }))
    if (!current.active) return
    if (current.blocking) {
      if (MOBILE) await page.locator('#btn-action').tap()
      else await page.keyboard.press('e')
      await frames(page)
    } else {
      await page.waitForFunction((time) => window.__CAMPAIGN_STATE__.time >= time, current.time + 0.3, { timeout: 15_000 })
    }
  }
  assert.fail('The mission-complete dialogue never released control through normal E/touch input')
}

async function startOfferedAndAccept(page, id) {
  const spec = missions.missions.find((mission) => mission.id === id)
  if (await page.evaluate(() => Boolean(window.RAFFI_WORLD.getState().player.vehicle))) await pressKey(page, 'e')
  const before = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.equal(before.offered, id, 'normal campaign offered ' + before.offered + ' instead of ' + id)
  assert.ok(before.available.includes(id), id + ' was offered but unavailable: ' + JSON.stringify(before))

  await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), spec.marker)
  await frames(page)
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
  // Every driving mission must offer and mount its real generated loaner. The
  // route checks below move that vehicle; they never fabricate a physics stub.
  if (spec.startVehicle) {
    await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x - 2.2, z), spec.startVehicle.at)
    await frames(page)
    await pressKey(page, 'e')
    assert.equal((await page.evaluate(() => window.RAFFI_WORLD.getState())).player.vehicle, spec.startVehicle.archetype, id + ' loaner could not be mounted')
  }
  report.missions.push({ id, ...snap, stats: await page.evaluate(() => window.RAFFI_WORLD.stats()) })
  await page.screenshot({ path: `${OUT}/${id}-active.png` })
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
    if (!player.vehicle?.archetypeId) throw new Error('A generated loaner must be mounted before a route check')
    player.vehicle.x = x
    player.vehicle.z = z
    player.vehicle.speed = 6
    player.vehicle.mesh.position.set(x, 0, z)
    updateMissions(0.2)
  }, point)
}

try {
  page = await readyPage()
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
  await page.screenshot({ path: `${OUT}/deal-clock-complete-call.png` })
  await finishRewardDialogue(page)
  let snap = await page.evaluate(() => window.RAFFI_WORLD.missionSnapshot())
  assert.ok(snap.completed.includes('deal-clock'), 'deal-clock: ' + JSON.stringify(snap))
  assert.equal(snap.offered, 'crate-dig', 'deal-clock did not advance the normal campaign')
  const beforeResumeDrive = await page.evaluate(() => ({ ...window.__CAMPAIGN_STATE__.player, time: window.__CAMPAIGN_STATE__.time }))
  await page.keyboard.down('w')
  try {
    await page.waitForFunction((time) => window.__CAMPAIGN_STATE__.time >= time, beforeResumeDrive.time + 0.5, { timeout: 15_000 })
  } finally { await page.keyboard.up('w') }
  const afterResumeDrive = await page.evaluate(() => window.__CAMPAIGN_STATE__.player)
  assert.ok(Math.hypot(afterResumeDrive.x - beforeResumeDrive.x, afterResumeDrive.z - beforeResumeDrive.z) > 0.1, 'DEAL CLOCK complete left driving frozen after the reward call')
  report.checks.push('DEAL CLOCK fourth stop completes; reward call accepts normal E/touch; CRATE DIG unlocks and the mounted car drives again')

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
      const live = window.RAFFI_WORLD.missionSnapshot()
      if (live.status !== 'active') break
      const nextIndex = live.rhythmHits + live.rhythmMisses
      const until = (nextIndex + 1) * interval - live.elapsed
      updateMissions(Math.max(0, until - 0.02))
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
  report.completed = snap.completed
  await page.screenshot({ path: `${OUT}/campaign-complete.png` })

  const realErrors = errors.filter((item) => !item.includes('favicon'))
  assert.equal(realErrors.length, 0, 'browser errors: ' + realErrors.join(' | '))
  console.info('mission campaign smoke passed')
} catch (error) {
  report.failure = error.stack || error.message
  report.lastMission = await page?.evaluate(() => window.RAFFI_WORLD?.missionSnapshot()).catch(() => null)
  await page?.screenshot({ path: `${OUT}/failure.png`, timeout: 5_000 }).catch(() => {})
  throw error
} finally {
  await fs.writeFile(`${OUT}/campaign-report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
