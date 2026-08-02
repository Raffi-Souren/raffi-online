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

test('repaint shops are compiled from world data with no hardcoded coordinates', () => {
  assert.ok(shops.length >= 1)
  for (const shop of shops) {
    assert.equal(typeof shop.id, 'string')
    assert.equal(typeof shop.district, 'string')
    assert.ok(Number.isFinite(shop.at.x))
    assert.ok(Number.isFinite(shop.at.z))
  }
  assert.ok(Number.isFinite(tuning.bayRadius))
  assert.ok(Number.isFinite(tuning.maxClearSpeed))
  assert.ok(tuning.label.length > 0)
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

  // Even if heat is re-applied while still latched, remaining in-bay does not re-fire.
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
