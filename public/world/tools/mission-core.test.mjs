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
