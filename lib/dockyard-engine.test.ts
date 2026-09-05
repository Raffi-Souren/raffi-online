import test from "node:test"
import assert from "node:assert/strict"
import {
  buildDockyard,
  createDockyard,
  DOCKYARD_COSTS,
  orderDockyard,
  tickDockyard,
  trainDockyard,
} from "./dockyard-engine"

function run(state: ReturnType<typeof createDockyard>, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 20); i++) tickDockyard(state, 0.05)
}

test("workers collect finite salvage and deliver it to the HQ", () => {
  const state = createDockyard()
  state.phase = "playing"
  const resource = state.resources[0]
  const workers = state.units.filter((unit) => unit.kind === "worker")
  orderDockyard(
    state,
    workers.map((unit) => unit.id),
    resource,
    resource.id,
  )
  run(state, 16)
  assert.ok(state.scrap > 110, "workers must deposit salvage, not just show a gathering animation")
  assert.ok(resource.amount < 300)
  assert.ok(
    Math.abs(
      state.scrap - 110 + workers.reduce((sum, unit) => sum + unit.carried, 0) - (300 - resource.amount),
    ) < 0.001,
    "salvage is conserved between the pile, workers and treasury",
  )
})

test("building validates funds, supply radius and occupied positions before spending", () => {
  const state = createDockyard()
  state.phase = "playing"
  assert.equal(buildDockyard(state, "workshop", { x: 700, y: 360 }), false)
  assert.equal(buildDockyard(state, "workshop", { x: 125, y: 335 }), false)
  assert.equal(state.scrap, 110)
  assert.equal(buildDockyard(state, "workshop", { x: 315, y: 345 }), true)
  assert.equal(state.scrap, 110 - DOCKYARD_COSTS.workshop)
  assert.equal(buildDockyard(state, "sentry", { x: 260, y: 400 }), false)
})

test("guards require a workshop and training spends the exact cost", () => {
  const state = createDockyard()
  state.phase = "playing"
  assert.equal(trainDockyard(state, "guard"), false)
  state.scrap = 200
  assert.equal(buildDockyard(state, "workshop", { x: 315, y: 345 }), true)
  assert.equal(trainDockyard(state, "guard"), true)
  assert.equal(state.scrap, 200 - DOCKYARD_COSTS.workshop - DOCKYARD_COSTS.guard)
  assert.equal(state.units.filter((unit) => unit.kind === "guard").length, 2)
})

test("pause freezes economy, combat and wave timing", () => {
  const state = createDockyard()
  state.phase = "paused"
  const before = JSON.stringify(state)
  run(state, 100)
  assert.equal(JSON.stringify(state), before)
  assert.equal(trainDockyard(state, "worker"), false)
  assert.equal(buildDockyard(state, "workshop", { x: 315, y: 345 }), false)
})

test("rival waves spawn and attack the dock without player input", () => {
  const state = createDockyard()
  state.phase = "playing"
  run(state, 46)
  assert.equal(state.wave, 1)
  assert.equal(state.units.filter((unit) => unit.team === "rival").length, 2)
  run(state, 200)
  assert.ok(state.wave >= 4)
  assert.ok(
    state.units.some((unit) => unit.team === "crew" && unit.hp < unit.maxHp) ||
      state.units.filter((unit) => unit.team === "crew").length < 4 ||
      String(state.phase) === "lost",
  )
})

test("a funded guard assault can win through the real movement and combat loop", () => {
  const state = createDockyard()
  state.phase = "playing"
  state.scrap = 1000
  buildDockyard(state, "workshop", { x: 315, y: 345 })
  for (let i = 0; i < 7; i++) trainDockyard(state, "guard")
  const rivalHq = state.buildings.find((building) => building.team === "rival")!
  orderDockyard(
    state,
    state.units.filter((unit) => unit.kind === "guard").map((unit) => unit.id),
    rivalHq,
  )
  run(state, 100)
  assert.equal(state.phase, "won")
  assert.ok(rivalHq.hp <= 0)
  const time = state.time
  run(state, 10)
  assert.equal(state.time, time)
})

test("destroying the crew HQ produces a terminal defeat and restart is pristine", () => {
  const state = createDockyard()
  state.phase = "playing"
  const hq = state.buildings.find((building) => building.team === "crew")!
  hq.hp = 0
  tickDockyard(state, 0.05)
  assert.equal(state.phase, "lost")
  const fresh = createDockyard()
  assert.equal(fresh.phase, "briefing")
  assert.equal(fresh.scrap, 110)
  assert.equal(fresh.units.length, 4)
  assert.equal(fresh.time, 0)
})

test("the opening economy can fund a winning assault without bonus resources", () => {
  const state = createDockyard()
  state.phase = "playing"
  const resource = state.resources[0]
  orderDockyard(
    state,
    state.units.filter((unit) => unit.kind === "worker").map((unit) => unit.id),
    resource,
    resource.id,
  )
  buildDockyard(state, "workshop", { x: 315, y: 345 })
  const rivalHq = state.buildings.find((building) => building.team === "rival")!
  for (let second = 0; second < 150 && String(state.phase) === "playing"; second++) {
    if (state.scrap >= DOCKYARD_COSTS.guard && state.units.filter((unit) => unit.kind === "guard").length < 7)
      trainDockyard(state, "guard")
    if (state.units.filter((unit) => unit.kind === "guard").length >= 5)
      orderDockyard(
        state,
        state.units.filter((unit) => unit.kind === "guard").map((unit) => unit.id),
        rivalHq,
      )
    run(state, 1)
  }
  assert.equal(state.phase, "won")
})
