import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  listRepaintShops,
  repaintTuning,
  createRepaintLatch,
  nearestRepaintShop,
  isInsideRepaintBay,
  shopAtPosition,
  releaseRepaintLatch,
  evaluateRepaintClear,
  clearComplianceState,
  clearLineAt,
  shouldClearRepaintWaypoint,
} from '../game/compliance-core.js'

const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
const shops = listRepaintShops(world)
const tuning = repaintTuning(world)
const heights = shops.find((shop) => shop.id === 'repaint-heights')

function actorAt(shop, overrides = {}) {
  return {
    mounted: true,
    speed: 0.4,
    tier: 3,
    heat: 1,
    x: shop.at.x,
    z: shop.at.z,
    shops,
    latch: createRepaintLatch(),
    tuning,
    ...overrides,
  }
}

test('repaintTuning requires authored world.repaint contract fields', () => {
  assert.throws(() => repaintTuning({}), /world\.repaint is required/)
  assert.throws(() => repaintTuning({ repaint: { bayRadius: 1 } }), /maxClearSpeed/)
  assert.throws(
    () => repaintTuning({ repaint: { ...world.repaint, bayRadius: -1 } }),
    /bayRadius/
  )
  const t = repaintTuning(world)
  assert.equal(t.bayRadius, world.repaint.bayRadius)
  assert.equal(t.maxClearSpeed, world.repaint.maxClearSpeed)
  assert.deepEqual(t.clearLines, world.repaint.clearLines)
})

test('authored bayRadius mutation changes the clear decision boundary', () => {
  const clone = structuredClone(world)
  clone.repaint.bayRadius = 2
  const tight = repaintTuning(clone)
  const shop = clone.repaintShops[0]
  const insideTight = evaluateRepaintClear({
    ...actorAt(shop, { tuning: tight, shops: clone.repaintShops }),
    x: shop.at.x + 1.5,
    z: shop.at.z,
  })
  assert.equal(insideTight.action, 'clear')

  const outsideTight = evaluateRepaintClear({
    ...actorAt(shop, { tuning: tight, shops: clone.repaintShops }),
    x: shop.at.x + 2.5,
    z: shop.at.z,
  })
  assert.equal(outsideTight.action, 'none')
  assert.equal(outsideTight.reason, 'outside-bay')

  // Original authored radius still accepts 2.5m as inside.
  const loose = evaluateRepaintClear({
    ...actorAt(shop),
    x: shop.at.x + 2.5,
    z: shop.at.z,
  })
  assert.equal(loose.action, 'clear')
})

test('authored maxClearSpeed mutation changes the speed boundary', () => {
  const clone = structuredClone(world)
  clone.repaint.maxClearSpeed = 1
  const slow = repaintTuning(clone)
  const reject = evaluateRepaintClear(actorAt(heights, { tuning: slow, speed: 1.5 }))
  assert.equal(reject.action, 'none')
  assert.equal(reject.reason, 'too-fast')
  const accept = evaluateRepaintClear(actorAt(heights, { tuning: slow, speed: 1 }))
  assert.equal(accept.action, 'clear')
})

test('mounted-only protection blocks on-foot bay entry', () => {
  const decision = evaluateRepaintClear(actorAt(heights, { mounted: false }))
  assert.equal(decision.action, 'none')
  assert.equal(decision.reason, 'not-mounted')
  assert.equal(decision.compliance.tier, 3)
})

test('speed boundary rejects fast drive-through and accepts parked crawl', () => {
  const tooFast = evaluateRepaintClear(actorAt(heights, {
    speed: tuning.maxClearSpeed + 0.01,
  }))
  assert.equal(tooFast.action, 'none')
  assert.equal(tooFast.reason, 'too-fast')

  const parked = evaluateRepaintClear(actorAt(heights, {
    speed: tuning.maxClearSpeed,
  }))
  assert.equal(parked.action, 'clear')
  assert.equal(parked.reason, 'cleared')
  assert.deepEqual(parked.compliance, { tier: 0, heat: 0 })
})

test('clear resets tier and heat to zero', () => {
  const decision = evaluateRepaintClear(actorAt(heights, { tier: 4, heat: 9 }))
  assert.equal(decision.action, 'clear')
  assert.deepEqual(decision.compliance, { tier: 0, heat: 0 })
  assert.deepEqual(clearComplianceState({ tier: 4, heat: 9, lastContact: 12 }), {
    tier: 0,
    heat: 0,
    lastContact: 12,
  })
})

test('first clear uses clearLines[0] then alternates in authored order', () => {
  const lines = tuning.clearLines
  assert.equal(clearLineAt(0, lines), lines[0])
  assert.equal(clearLineAt(1, lines), lines[1 % lines.length])
  assert.equal(clearLineAt(2, lines), lines[2 % lines.length])
})

test('one-shot latch ignores remaining stopped in the same bay', () => {
  const first = evaluateRepaintClear(actorAt(heights))
  assert.equal(first.action, 'clear')
  assert.equal(first.latch.shopId, heights.id)

  const stillThere = evaluateRepaintClear(actorAt(heights, {
    tier: 0,
    heat: 0,
    latch: first.latch,
  }))
  assert.equal(stillThere.action, 'none')
  assert.equal(stillThere.reason, 'latched')

  const heatWhileLatched = evaluateRepaintClear(actorAt(heights, {
    tier: 2,
    heat: 1,
    latch: first.latch,
  }))
  assert.equal(heatWhileLatched.action, 'none')
  assert.equal(heatWhileLatched.reason, 'latched')
})

test('leave and re-enter with new COMPLIANCE can trigger again', () => {
  const first = evaluateRepaintClear(actorAt(heights))
  assert.equal(first.action, 'clear')

  const outside = {
    x: heights.at.x + tuning.bayRadius + 2,
    z: heights.at.z,
  }
  const released = releaseRepaintLatch(first.latch, shops, outside.x, outside.z, tuning.bayRadius)
  assert.equal(released.shopId, null)

  const second = evaluateRepaintClear(actorAt(heights, {
    tier: 2,
    heat: 0,
    latch: released,
  }))
  assert.equal(second.action, 'clear')
  assert.equal(second.latch.shopId, heights.id)
})

test('data-driven shop selection picks the nearest authored bay', () => {
  const nearStrip = shops.find((shop) => shop.id === 'repaint-strip')
  const nearest = nearestRepaintShop(shops, nearStrip.at.x + 3, nearStrip.at.z - 2)
  assert.equal(nearest.id, nearStrip.id)

  assert.equal(
    shopAtPosition(shops, nearStrip.at.x, nearStrip.at.z, tuning.bayRadius)?.id,
    nearStrip.id
  )
  assert.equal(
    shopAtPosition(shops, nearStrip.at.x + tuning.bayRadius + 1, nearStrip.at.z, tuning.bayRadius),
    null
  )
  assert.equal(isInsideRepaintBay(nearStrip, nearStrip.at.x, nearStrip.at.z, tuning.bayRadius), true)
})

test('zero COMPLIANCE away from a shop clears a compliance-owned waypoint only', () => {
  assert.equal(shouldClearRepaintWaypoint({
    ownsWaypoint: true,
    missionActive: false,
    tier: 0,
    heat: 0,
  }), true)
  assert.equal(shouldClearRepaintWaypoint({
    ownsWaypoint: true,
    missionActive: true,
    tier: 0,
    heat: 0,
  }), false)
  assert.equal(shouldClearRepaintWaypoint({
    ownsWaypoint: false,
    missionActive: false,
    tier: 0,
    heat: 0,
  }), false)
  assert.equal(shouldClearRepaintWaypoint({
    ownsWaypoint: true,
    missionActive: false,
    tier: 2,
    heat: 0,
  }), false)
})
