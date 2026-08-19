import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  createMissionRun,
  activateMissionRun,
  stepMissionRun,
  nextMissionPoint,
  missionSecondsRemaining,
  formatMissionClock,
  formatObjective,
  rhythmTotalHits,
  buildSensorCells,
  shuffleSensorCells,
  createShootoutState,
  beginShootoutRound,
  resolveShootoutKick,
  allProgressComplete,
} from '../game/mission-core.js'

const missionData = JSON.parse(fs.readFileSync(new URL('../data/missions.json', import.meta.url), 'utf8'))
const dealClock = missionData.missions.find((mission) => mission.id === 'deal-clock')

function activeRun() {
  return activateMissionRun(createMissionRun(structuredClone(dealClock)))
}

test('DEAL CLOCK timer waits for the briefing to finish', () => {
  const run = createMissionRun(structuredClone(dealClock))
  assert.deepEqual(stepMissionRun(run, { mode: 'vehicle', x: -100, z: -250 }, 30), [])
  assert.equal(run.elapsed, 0)
  assert.equal(run.status, 'briefing')
})

test('DEAL CLOCK ignores lobby radius while on foot', () => {
  const run = activeRun()
  const events = stepMissionRun(run, { mode: 'foot', x: -100, z: -250 }, 1)
  assert.equal(events.some((event) => event.type === 'point'), false)
  assert.deepEqual(run.completedPointIndexes, [])
})

test('DEAL CLOCK uses the authored lobby radius boundary', () => {
  const point = dealClock.objectives.find((objective) => objective.kind === 'goto-vehicle').points[0]
  const radius = dealClock.objectives.find((objective) => objective.kind === 'goto-vehicle').radius

  const outside = activeRun()
  assert.equal(
    stepMissionRun(outside, { mode: 'vehicle', x: point.x + radius + 0.01, z: point.z }, 0)
      .some((event) => event.type === 'point'),
    false
  )

  const inside = activeRun()
  assert.equal(
    stepMissionRun(inside, { mode: 'vehicle', x: point.x + radius - 0.01, z: point.z }, 0)
      .some((event) => event.type === 'point'),
    true
  )
})

test('DEAL CLOCK counts each lobby only once', () => {
  const run = activeRun()
  const actor = { mode: 'vehicle', x: -100, z: -250 }
  assert.equal(stepMissionRun(run, actor, 1).filter((event) => event.type === 'point').length, 1)
  assert.equal(stepMissionRun(run, actor, 1).filter((event) => event.type === 'point').length, 0)
  assert.deepEqual(run.completedPointIndexes, [0])
})

test('DEAL CLOCK completes after four unique vehicle stops', () => {
  const run = activeRun()
  let compliance = 0
  let finalPoint = null
  for (const point of run.route.points) {
    const events = stepMissionRun(run, { mode: 'vehicle', x: point.x, z: point.z }, 1)
    compliance += events.reduce((sum, event) => sum + (event.complianceDelta || 0), 0)
    finalPoint = events.find((event) => event.type === 'point') || finalPoint
  }
  assert.equal(run.status, 'complete')
  assert.deepEqual(run.completedPointIndexes, [0, 1, 2, 3])
  assert.equal(compliance, 4)
  assert.equal(finalPoint.line, null)
})

test('DEAL CLOCK times out at its authored limit and remains retryable', () => {
  const first = activeRun()
  const events = stepMissionRun(first, { mode: 'vehicle', x: 999, z: 999 }, 165)
  assert.equal(first.status, 'failed')
  assert.deepEqual(events.find((event) => event.type === 'failed'), {
    type: 'failed',
    line: dealClock.objectives.find((objective) => objective.kind === 'timer').failLine,
  })

  const retry = activeRun()
  assert.equal(retry.status, 'active')
  assert.equal(retry.elapsed, 0)
  assert.deepEqual(retry.completedPointIndexes, [])
})

test('unordered routes choose the nearest incomplete stop', () => {
  const run = activeRun()
  assert.equal(nextMissionPoint(run, { x: -80, z: -250 }).index, 0)
  stepMissionRun(run, { mode: 'vehicle', x: -100, z: -250 }, 1)
  assert.notEqual(nextMissionPoint(run, { x: -80, z: -250 }).index, 0)
})

test('mission clock formatting is stable at minute boundaries', () => {
  const run = activeRun()
  stepMissionRun(run, { mode: 'vehicle', x: 999, z: 999 }, 68.2)
  assert.ok(Math.abs(missionSecondsRemaining(run) - 96.8) < 1e-9)
  assert.equal(formatMissionClock(missionSecondsRemaining(run)), '01:37')
  assert.equal(formatMissionClock(0), '00:00')
})

const crateDig = missionData.missions.find((mission) => mission.id === 'crate-dig')
const setTime = missionData.missions.find((mission) => mission.id === 'set-time')
const coldBoot = missionData.missions.find((mission) => mission.id === 'cold-boot')
const escort = missionData.missions.find((mission) => mission.id === 'escort')
const shootout = missionData.missions.find((mission) => mission.id === 'shootout')
const blackout = missionData.missions.find((mission) => mission.id === 'blackout')
const yardRun = missionData.missions.find((mission) => mission.id === 'yard-run')

function of(mission) {
  return activateMissionRun(createMissionRun(structuredClone(mission)))
}

test('CRATE DIG ignores the store until every record is collected', () => {
  const run = of(crateDig)
  const store = crateDig.objectives.find((item) => item.kind === 'goto').points[0]
  stepMissionRun(run, { mode: 'foot', x: store.x, z: store.z }, 1)
  assert.equal(run.status, 'active')
  assert.deepEqual(run.completedPointIndexes, [])
})

test('CRATE DIG collects each record once and then requires the store return', () => {
  const run = of(crateDig)
  const collect = crateDig.objectives.find((item) => item.kind === 'collect')
  const store = crateDig.objectives.find((item) => item.kind === 'goto').points[0]
  for (const point of collect.points) {
    const events = stepMissionRun(run, { mode: 'foot', x: point.x, z: point.z }, 0.2)
    assert.equal(events.some((event) => event.type === 'collect'), true)
  }
  assert.equal(run.collectedIndexes.length, 6)
  assert.equal(run.status, 'active')
  assert.equal(nextMissionPoint(run, store).kind, 'goto')
  const finish = stepMissionRun(run, { mode: 'foot', x: store.x, z: store.z }, 0.2)
  assert.equal(run.status, 'complete')
  assert.equal(finish.some((event) => event.type === 'complete'), true)
})

test('CRATE DIG target time is a clock, not a fail timer', () => {
  const run = of(crateDig)
  const events = stepMissionRun(run, { mode: 'foot', x: 0, z: 0 }, crateDig.targetSeconds)
  assert.equal(run.status, 'active')
  assert.equal(events.some((event) => event.type === 'failed'), false)
})

test('YARD RUN is a supported ordered vehicle route with a hard timer', () => {
  const run = of(yardRun)
  const route = yardRun.objectives.find((item) => item.kind === 'goto-vehicle')
  for (const point of route.points) {
    stepMissionRun(run, { mode: 'vehicle', x: point.x, z: point.z }, 1)
  }
  assert.equal(run.status, 'complete')
  assert.deepEqual(run.completedPointIndexes, [0, 1, 2, 3, 4, 5])

  const late = of(yardRun)
  const fail = stepMissionRun(late, { mode: 'vehicle', x: 0, z: 0 }, 120)
  assert.equal(late.status, 'failed')
  assert.equal(fail[0].type, 'failed')
})

test('SET TIME scores on-window pulses and fails after the authored miss cap', () => {
  const spec = setTime.objectives[0]
  const interval = 60 / 124
  const run = of(setTime)
  for (let i = 0; i < rhythmTotalHits(spec); i++) {
    stepMissionRun(run, { mode: 'foot', x: 0, z: 0, bpm: 124, pulse: false }, interval - 0.02)
    const events = stepMissionRun(run, { mode: 'foot', x: 0, z: 0, bpm: 124, pulse: true }, 0.02)
    assert.equal(events.some((event) => event.type === 'rhythm-hit'), true)
  }
  assert.equal(run.status, 'complete')
  assert.equal(run.rhythmHits, rhythmTotalHits(spec))

  const fail = of(setTime)
  for (let i = 0; i < spec.failAfterMisses; i++) {
    stepMissionRun(fail, { mode: 'foot', x: 0, z: 0, bpm: 124, pulse: false }, interval + 0.2)
  }
  assert.equal(fail.status, 'failed')
  assert.ok(fail.rhythmMisses >= spec.failAfterMisses)
})

test('COLD BOOT shuffles a data-driven sensor grid and respawns on a trip', () => {
  const spec = coldBoot.objectives.find((item) => item.kind === 'avoid')
  const cells = buildSensorCells(spec, { x: 0, z: 0 })
  assert.equal(cells.length, spec.sensorGrid.rows * spec.sensorGrid.cols)
  shuffleSensorCells(cells, spec, () => 0.1)
  const live = cells.filter((cell) => cell.active)
  assert.equal(live.length, Math.round(cells.length * spec.sensorGrid.activeFraction))

  const run = of(coldBoot)
  stepMissionRun(run, { mode: 'foot', x: 80, z: 80 }, 0.05)
  assert.ok(run.activeCells.length > 0)
  run.lastSafe = { x: 12, z: 12 }
  const hot = run.activeCells.find((cell) => cell.active)
  const actor = { mode: 'foot', x: hot.x, z: hot.z }
  const events = stepMissionRun(run, actor, 0.2)
  assert.equal(events.some((event) => event.type === 'sensor-trip'), true)
  assert.equal(actor.x, 12)
  assert.ok(run.elapsed >= spec.onTrip.penaltySeconds)
})

test('ESCORT boards in-vehicle, tickets speed, and fails at the compliance cap', () => {
  const run = of(escort)
  const spec = escort.objectives[0]
  stepMissionRun(run, { mode: 'foot', x: spec.from.x, z: spec.from.z, speed: 0, compliance: 0 }, 0.2)
  assert.equal(run.escortBoarded, false)
  stepMissionRun(run, { mode: 'vehicle', x: spec.from.x, z: spec.from.z, speed: 10, compliance: 0 }, 0.2)
  assert.equal(run.escortBoarded, true)

  const ticket = stepMissionRun(run, {
    mode: 'vehicle', x: spec.from.x, z: spec.from.z, speed: spec.speedLimit + 1, compliance: 0,
  }, 0.2)
  assert.equal(ticket.some((event) => event.type === 'escort-speed'), true)
  assert.equal(ticket[0].complianceDelta, 1)

  const doomed = of(escort)
  doomed.escortBoarded = true
  const fail = stepMissionRun(doomed, {
    mode: 'vehicle', x: spec.from.x, z: spec.from.z, speed: 10, compliance: 5,
  }, 0.2)
  assert.equal(doomed.status, 'failed')
  assert.equal(fail[0].line, 'm-escort-fail')

  const finish = of(escort)
  finish.escortBoarded = true
  stepMissionRun(finish, { mode: 'vehicle', x: spec.to.x, z: spec.to.z, speed: 10, compliance: 1 }, 0.2)
  assert.equal(finish.status, 'complete')
})

test('SHOOTOUT is best-of-five to three with an honest-tell keeper', () => {
  const spec = shootout.objectives[0]
  const state = beginShootoutRound(createShootoutState(spec), spec, () => 0.1)
  assert.equal(state.honest, true)
  assert.equal(state.tell, state.keeperDive)
  assert.equal(resolveShootoutKick(state, -state.keeperDive), true)
  assert.equal(state.scored, 1)

  const run = of(shootout)
  stepMissionRun(run, { mode: 'foot', x: 0, z: 26, kick: false }, 0.05)
  for (let i = 0; i < 3; i++) {
    const aim = -run.customState.shootout.keeperDive
    stepMissionRun(run, { mode: 'foot', x: 0, z: 26, kick: true, aim }, 0.05)
    stepMissionRun(run, { mode: 'foot', x: 0, z: 26, kick: false, aim }, 0.8)
  }
  assert.equal(run.status, 'complete')
})

test('BLACKOUT applies the city-dark effect then needs the route and an evade', () => {
  const run = of(blackout)
  const events = stepMissionRun(run, { mode: 'vehicle', x: 0, z: 0, compliance: 5 }, 0.2)
  assert.equal(events.some((event) => event.type === 'effect' && event.handler === 'blackoutCity'), true)
  assert.equal(events.some((event) => event.type === 'evade-start'), true)
  assert.equal(allProgressComplete(run), false)

  const route = blackout.objectives.find((item) => item.kind === 'goto-vehicle')
  for (const point of route.points) {
    stepMissionRun(run, { mode: 'vehicle', x: point.x, z: point.z, compliance: 5 }, 0.2)
  }
  assert.equal(run.status, 'active')
  stepMissionRun(run, { mode: 'vehicle', x: route.points.at(-1).x, z: route.points.at(-1).z, compliance: 0 }, 0.2)
  assert.equal(run.status, 'complete')
})

test('objective copy uses authored templates', () => {
  const run = of(crateDig)
  const line = formatObjective(run, missionData.templates)
  assert.match(line, /RECOVER RECORDS \(0\/6\)/)
})
