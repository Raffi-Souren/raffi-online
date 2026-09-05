import { test } from "node:test"
import assert from "node:assert/strict"
import { CIRCUIT_LENGTH, PICKUPS, RACE_LAPS, createRace, racePosition, stepRace, type KartInput } from "./kart-race"

const idle: KartInput = { steer: 0, throttle: false, brake: false, drift: false, bend: 0 }
const gas: KartInput = { ...idle, throttle: true }

function advance(race: ReturnType<typeof createRace>, input: KartInput, seconds: number, rate = 60) {
  for (let i = 0; i < seconds * rate; i++) stepRace(race, input, 1 / rate)
}

test("ready, countdown and paused states cannot advance race distance or time", () => {
  const race = createRace()
  advance(race, gas, 3)
  assert.equal(race.distance, 0)
  race.status = "countdown"
  advance(race, gas, 2)
  assert.equal(race.distance, 0)
  assert.equal(race.elapsed, 0)
  advance(race, gas, 1.1)
  assert.equal(race.status, "racing")
  race.status = "paused"
  const before = { distance: race.distance, time: race.elapsed, speed: race.speed }
  advance(race, gas, 20)
  assert.deepEqual({ distance: race.distance, time: race.elapsed, speed: race.speed }, before)
})

test("a full three-lap race is winnable and the finish cannot count extra laps", () => {
  const race = createRace()
  race.status = "racing"
  advance(race, gas, 130)
  assert.equal(race.status, "finished")
  assert.equal(race.distance, CIRCUIT_LENGTH * RACE_LAPS)
  assert.equal(race.lapTimes.length, 3)
  assert.equal(racePosition(race), 1)
  assert.ok(race.elapsed > 75 && race.elapsed < 105)
  assert.ok(race.lapTimes.every((time) => time > 20))
  assert.ok(Math.abs(race.lapTimes.reduce((total, time) => total + time, 0) - race.elapsed) < 0.01)
  const finish = race.elapsed
  advance(race, gas, 60)
  assert.equal(race.elapsed, finish)
  assert.equal(race.lapTimes.length, 3)
})

test("steering at rest does not move the kart and sustained off-road driving is slower", () => {
  const road = createRace()
  const offRoad = createRace()
  road.status = offRoad.status = "racing"
  advance(road, { ...idle, steer: 1 }, 10)
  assert.equal(road.lane, 0)
  advance(road, gas, 10)
  advance(offRoad, { ...gas, steer: 1 }, 10)
  assert.ok(Math.abs(offRoad.lane) <= 10.5)
  assert.ok(offRoad.distance < road.distance * 0.65)
  assert.ok(offRoad.speed <= 23)
})

test("braking stops the kart and coasting does not accelerate", () => {
  const race = createRace()
  race.status = "racing"
  advance(race, gas, 2)
  const speed = race.speed
  advance(race, idle, 0.4)
  assert.ok(race.speed < speed)
  advance(race, { ...idle, brake: true }, 2)
  assert.equal(race.speed, 0)
})

test("a charged drift boosts on release; tapping drift or drifting at rest does not", () => {
  const race = createRace()
  race.status = "racing"
  advance(race, { ...gas, steer: 1, drift: true }, 0.2)
  stepRace(race, gas, 1 / 60)
  assert.equal(race.boost, 0)
  race.speed = 40
  race.distance = 400
  race.lane = -2
  advance(race, { ...gas, steer: 1, drift: true }, 0.8)
  assert.ok(race.driftCharge >= 0.65)
  stepRace(race, gas, 1 / 60)
  assert.ok(race.boost > 1)
  assert.equal(race.driftCharge, 0)
  advance(race, gas, 0.3)
  assert.ok(race.speed > 46)
})

test("pickups require passing their lane, cannot be recollected, and respawn next lap", () => {
  const race = createRace()
  race.status = "racing"
  race.speed = 40
  race.distance = PICKUPS[0].distance - 0.3
  stepRace(race, gas, 1 / 60)
  assert.equal(race.pickups, 1)
  assert.equal(race.collected.has("0-1"), true)
  race.distance = PICKUPS[0].distance - 0.3
  stepRace(race, gas, 1 / 60)
  assert.equal(race.pickups, 1)
  race.distance = CIRCUIT_LENGTH + PICKUPS[0].distance - 0.3
  stepRace(race, gas, 1 / 60)
  assert.equal(race.pickups, 2)
  race.distance = CIRCUIT_LENGTH * 2 + PICKUPS[0].distance - 0.3
  race.lane = 7
  stepRace(race, gas, 1 / 60)
  assert.equal(race.pickups, 2)
})

test("handling is consistent at 30 and 120 frames per second", () => {
  const low = createRace()
  const high = createRace()
  low.status = high.status = "racing"
  advance(low, gas, 15, 30)
  advance(high, gas, 15, 120)
  assert.ok(Math.abs(low.distance - high.distance) < 3)
  assert.ok(Math.abs(low.speed - high.speed) < 1)
  assert.equal(low.pickups, high.pickups)
})
