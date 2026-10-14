import { test } from "node:test"
import assert from "node:assert/strict"
import { DIG_BACKGROUNDS, DIG_COLORS as C, DIG_DECOR, DIG_SOLIDS, contrastRatio, hue } from "./crate-run-palette"

// Thresholds: WCAG 2.2 SC 1.4.11 asks 3:1 for graphics needed to understand content;
// pickups, the player and HUD text get 4.5:1 because they are small and moving.
const SOLID_MIN = 3
const ACTOR_MIN = 4.5

const fmt = (n: number) => n.toFixed(2)

test("every platform and block separates from every background plane", () => {
  for (const solid of DIG_SOLIDS)
    for (const bg of DIG_BACKGROUNDS) {
      const ratio = contrastRatio(C[solid], C[bg])
      assert.ok(ratio >= SOLID_MIN, `${solid} vs ${bg} is ${fmt(ratio)}:1, needs ${SOLID_MIN}:1`)
    }
})

test("records, the player and the HUD stand out more than scenery", () => {
  for (const bg of DIG_BACKGROUNDS) {
    for (const actor of ["recordRim", "recordLabel", "player"] as const) {
      const ratio = contrastRatio(C[actor], C[bg])
      assert.ok(ratio >= ACTOR_MIN, `${actor} vs ${bg} is ${fmt(ratio)}:1, needs ${ACTOR_MIN}:1`)
    }
    const enemy = contrastRatio(C.enemyRim, C[bg])
    assert.ok(enemy >= SOLID_MIN, `enemyRim vs ${bg} is ${fmt(enemy)}:1, needs ${SOLID_MIN}:1`)
  }
  assert.ok(contrastRatio(C.hudText, C.hudBg) >= ACTOR_MIN, "HUD text needs 4.5:1")
})

test("a pit reads as a hole, not as more sidewalk", () => {
  const ratio = contrastRatio(C.pitVoid, C.sidewalk)
  assert.ok(ratio >= 7, `pitVoid vs sidewalk is ${fmt(ratio)}:1, needs 7:1`)
})

test("reward and danger never share a color family", () => {
  const distance = Math.abs(hue(C.recordLabel) - hue(C.enemyRim))
  const wrapped = Math.min(distance, 360 - distance)
  assert.ok(wrapped >= 30, `record and enemy hues are only ${Math.round(wrapped)} degrees apart`)
  assert.notEqual(C.player, C.recordLabel, "the player must not wear the pickup color")
  assert.notEqual(C.player, C.windowLit, "the player must not match lit windows")
})

test("decoration recedes behind gameplay", () => {
  for (const decor of DIG_DECOR) {
    for (const solid of DIG_SOLIDS) assert.notEqual(C[decor], C[solid], `${decor} reuses gameplay color ${solid}`)
    assert.notEqual(C[decor], C.recordLabel, `${decor} reuses the pickup color`)
  }
  const windows = contrastRatio(C.windowLit, C.brownstone)
  assert.ok(windows <= 3.2, `lit windows pop at ${fmt(windows)}:1; keep them at or under 3.2:1 so they stay scenery`)
})
