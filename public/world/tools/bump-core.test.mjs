import assert from 'node:assert/strict'
import test from 'node:test'
import { BUMP_COOLDOWN, bumpTier, canBump, planBump, shoveFraction } from '../game/bump-core.js'

test('the reaction tier follows impact speed', () => {
  assert.equal(bumpTier(0.3), null)
  assert.equal(bumpTier(0.6).tier, 1)
  assert.equal(bumpTier(1.9).tier, 1)
  assert.equal(bumpTier(2.0).tier, 2)
  assert.equal(bumpTier(4.4).tier, 2)
  assert.equal(bumpTier(4.5).tier, 3)
  assert.equal(bumpTier(14).tier, 3)
})

test('one person reacts at most once per cooldown', () => {
  assert.equal(canBump(-Infinity, 3), true)
  assert.equal(canBump(3, 3 + BUMP_COOLDOWN - 0.01), false)
  assert.equal(canBump(3, 3 + BUMP_COOLDOWN), true)
})

test('a bump never carries Heat, injury or a knockdown', () => {
  for (const impact of [0.8, 3, 6, 20]) {
    const plan = planBump(impact, { x: 1, z: 0 }, 10)
    for (const key of Object.keys(plan)) assert.doesNotMatch(key, /heat|damage|hurt|knock|health/i)
  }
})

test('the shove is symmetric and bounded', () => {
  for (const impact of [0.7, 1.5, 2.5, 4, 5, 7.9, 30]) {
    const normal = { x: Math.SQRT1_2, z: -Math.SQRT1_2 }
    const plan = planBump(impact, normal, 0)
    // The pedestrian moves away from the player; the player is pushed back the other way.
    assert.ok(plan.dirX * normal.x + plan.dirZ * normal.z < -0.999)
    assert.ok(plan.distance >= 0.35 && plan.distance <= 1.2, `${impact}: shove ${plan.distance}`)
    assert.ok(plan.playerKick > 0 && plan.playerKick <= 1.5)
    assert.ok(plan.playerSlow > 0 && plan.playerSlow < 0.6)
  }
  const plan = planBump(3, { x: 1, z: 0 }, 2)
  assert.equal(shoveFraction(plan, 2), 0)
  assert.equal(shoveFraction(plan, 2 + plan.duration), 1)
  assert.ok(shoveFraction(plan, 2 + plan.duration / 2) > 0.5, 'the shove eases out')
})
