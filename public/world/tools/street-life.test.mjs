import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  LIFE_VERSION, MAX_CASH, SKILLS, addCash, addXp, canSprint, createGigRun, createStamina, emptyProfile, gigPay, gigSignal,
  gigUnlocked, levels, readProfile, receiveTexts, recordGig, skillLevel, skillProgress, spend, stepGigRun, stepStamina,
  textsFor, unreadTexts,
} from '../game/life-core.js'

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const life = read('../data/life.json')
const world = read('../data/world.json')
const vehicles = read('../data/vehicles.json')
const tapes = read('../data/tapes.json')
const thresholds = life.skills.thresholds
const catalog = { gigs: life.gigs, texts: life.texts, tapeIds: tapes.tapes.map((tape) => tape.id) }
const gig = (id) => life.gigs.find((entry) => entry.id === id)

// ---------------------------------------------------------------- profile

test('a damaged or foreign profile reads as a fresh one', () => {
  const fresh = emptyProfile()
  for (const source of ['{oops', '[]', 'null', '7', JSON.stringify({ version: 99, cash: 500 }), 'x'.repeat(20_000)]) {
    assert.deepEqual(readProfile(source, catalog), fresh, source.slice(0, 20))
  }
})

test('a saved profile keeps only what the data can vouch for', () => {
  const profile = readProfile(JSON.stringify({
    version: LIFE_VERSION, cash: 1e12, earned: -4, coffees: 3.9, photos: '2',
    xp: { legs: 250, wheels: -5, board: Infinity, hustle: 'lots', bogus: 9 },
    gigs: { 'crate-run': { runs: 3, wins: 9, best: 61.234 }, 'not-a-gig': { runs: 1, wins: 1, best: 5 }, 'flyer-drop': { runs: 2, wins: 0, best: -3 } },
    texts: ['welcome', 'nope', 'welcome', 'first-gig'], read: ['first-gig', 'first-tape'], tips: ['bc-1', 'bc-999'],
  }), catalog)
  assert.equal(profile.cash, MAX_CASH)
  assert.equal(profile.earned, MAX_CASH, 'earned can never be less than what is in the wallet')
  assert.equal(profile.coffees, 3)
  assert.equal(profile.photos, 0)
  assert.deepEqual(profile.xp, { legs: 250, wheels: 0, board: 0, hustle: 0 })
  assert.deepEqual(profile.gigs, { 'crate-run': { runs: 3, wins: 3, best: 61.2 }, 'flyer-drop': { runs: 2, wins: 0, best: null } })
  assert.deepEqual(profile.texts, ['welcome', 'first-gig'])
  assert.deepEqual(profile.read, ['first-gig'], 'only received texts can be read')
  assert.deepEqual(profile.tips, ['bc-1'])
})

test('a profile survives a save and load unchanged', () => {
  const profile = emptyProfile()
  addCash(profile, 120)
  addXp(profile, 'legs', 140, thresholds)
  recordGig(profile, gig('crate-run'), { status: 'done', elapsed: 88.26, limit: 170, flips: 0 }, 70)
  receiveTexts(profile, ['welcome', 'first-gig'])
  assert.deepEqual(readProfile(JSON.stringify(profile), catalog), profile)
})

// ----------------------------------------------------------------- skills

test('skills level up at the thresholds and stop at five', () => {
  assert.deepEqual(thresholds.map((xp) => skillLevel(xp, thresholds)), [1, 2, 3, 4, 5])
  assert.equal(skillLevel(thresholds[1] - 1, thresholds), 1)
  assert.equal(skillLevel(1e9, thresholds), 5)
  assert.deepEqual(skillProgress(thresholds[1] + (thresholds[2] - thresholds[1]) / 2, thresholds), { level: 2, max: false, fraction: 0.5, toNext: (thresholds[2] - thresholds[1]) / 2 })
  assert.deepEqual(skillProgress(1e9, thresholds), { level: 5, max: true, fraction: 1, toNext: 0 })
})

test('experience reports a new level once, and ignores nonsense', () => {
  const profile = emptyProfile()
  assert.equal(addXp(profile, 'legs', thresholds[1] - 1, thresholds), null)
  assert.equal(addXp(profile, 'legs', 1, thresholds), 2)
  assert.equal(addXp(profile, 'legs', 1, thresholds), null)
  assert.equal(addXp(profile, 'charm', 500, thresholds), null)
  assert.equal(addXp(profile, 'legs', -50, thresholds), null)
  assert.equal(addXp(profile, 'legs', NaN, thresholds), null)
  assert.equal(profile.xp.legs, thresholds[1] + 1)
  assert.deepEqual(levels(profile, thresholds), { legs: 2, wheels: 1, board: 1, hustle: 1 })
})

// ------------------------------------------------------------------- cash

test('the wallet never goes negative and never overflows', () => {
  const profile = emptyProfile()
  assert.equal(spend(profile, 4), false)
  assert.equal(profile.cash, 0)
  assert.equal(addCash(profile, 10.9), 10)
  assert.equal(addCash(profile, -50), 0)
  assert.equal(spend(profile, 4), true)
  assert.equal(profile.cash, 6)
  assert.equal(spend(profile, 7), false)
  assert.equal(profile.cash, 6)
  addCash(profile, 1e12)
  assert.equal(profile.cash, MAX_CASH)
  assert.equal(profile.earned, 10 + MAX_CASH, 'earned keeps counting past the wallet cap')
})

// ---------------------------------------------------------------- stamina

function sprintUntilWinded(hz, seconds) {
  const stamina = createStamina()
  let time = 0
  while (!stamina.winded && time < 120) { stepStamina(stamina, { sprinting: true, moving: true }, 1 / hz, seconds, life.stamina); time += 1 / hz }
  return time
}

test('a sprint lasts what the Legs level says, at any frame rate', () => {
  for (const seconds of life.stamina.sprintSeconds) {
    for (const hz of [30, 60, 144]) assert.ok(Math.abs(sprintUntilWinded(hz, seconds) - seconds) <= 1 / hz + 1e-6, `${seconds}s at ${hz}Hz`)
  }
})

test('winded means no sprint until it has properly come back', () => {
  const stamina = createStamina()
  while (!stamina.winded) stepStamina(stamina, { sprinting: true, moving: true }, 1 / 60, 12, life.stamina)
  assert.equal(canSprint(stamina), false)
  // Holding sprint while winded does not drain or reset the rest.
  for (let i = 0; i < 60; i++) stepStamina(stamina, { sprinting: true, moving: true }, 1 / 60, 12, life.stamina)
  assert.ok(stamina.value > 0, 'resting while winded should already be recovering')
  let rest = 1
  while (stamina.winded && rest < 60) { stepStamina(stamina, { moving: true }, 1 / 60, 12, life.stamina); rest += 1 / 60 }
  assert.equal(canSprint(stamina), true)
  assert.ok(stamina.value >= life.stamina.windedUntil)
  assert.ok(rest < life.stamina.regenDelay + life.stamina.regenSeconds, 'recovery took longer than a full refill')
})

test('standing still recovers faster than walking, and coffee stops the drain', () => {
  const walking = { value: 0.2, winded: false, idle: 5 }, standing = { value: 0.2, winded: false, idle: 5 }
  for (let i = 0; i < 120; i++) {
    stepStamina(walking, { moving: true }, 1 / 60, 12, life.stamina)
    stepStamina(standing, { moving: false }, 1 / 60, 12, life.stamina)
  }
  assert.ok(standing.value > walking.value)
  const wired = createStamina()
  for (let i = 0; i < 60 * 40; i++) stepStamina(wired, { sprinting: true, moving: true, wired: true }, 1 / 60, 12, life.stamina)
  assert.equal(wired.value, 1)
  assert.equal(wired.winded, false)
  const frozen = createStamina()
  assert.equal(stepStamina(frozen, { sprinting: true }, 0, 12, life.stamina).value, 1)
  assert.equal(stepStamina(frozen, { sprinting: true }, NaN, 12, life.stamina).value, 1)
})

// ------------------------------------------------------------------- gigs

const at = (point, ride = null) => ({ x: point.x, z: point.z, ride })

test('a delivery counts its stops in order and pays when the last one lands', () => {
  const crate = gig('crate-run')
  const run = createGigRun(crate)
  stepGigRun(run, crate, at(crate.stops[1]), 1)
  assert.equal(run.step, 0, 'the second stop counted before the first')
  for (const stop of crate.stops) stepGigRun(run, crate, at(stop, 'car'), 20)
  assert.equal(run.status, 'done')
  assert.equal(run.elapsed, 61)
  const pay = gigPay(crate, run, { wheels: 1 }, life.skills)
  assert.equal(pay, crate.pay.base + crate.pay.timeCap, 'a fast run earns the full time bonus and no more')
  assert.equal(gigPay(crate, run, { wheels: 3 }, life.skills), Math.round(pay * (1 + 2 * life.skills.payPerLevel)))
  // A finished run ignores further steps.
  stepGigRun(run, crate, at(crate.stops[0]), 500)
  assert.equal(run.elapsed, 61)
})

test('running out of time ends the gig with no pay', () => {
  const crate = gig('crate-run')
  const run = createGigRun(crate)
  stepGigRun(run, crate, at(crate.stops[0]), crate.seconds - 1)
  assert.equal(run.status, 'running')
  stepGigRun(run, crate, at({ x: 0, z: 0 }), 1)
  assert.equal(run.status, 'timeout')
  assert.equal(gigPay(crate, run, { wheels: 5 }, life.skills), 0)
  const profile = emptyProfile()
  assert.deepEqual(recordGig(profile, crate, run, 0), { pay: 0, best: false })
  assert.deepEqual(profile.gigs['crate-run'], { runs: 1, wins: 0, best: null })
  assert.equal(profile.cash, 0)
})

test('a skate line only counts gates on the board, and ends if you stay off it', () => {
  const line = gig('skate-line')
  const run = createGigRun(line)
  stepGigRun(run, line, at(line.stops[0], null), 1)
  assert.equal(run.step, 0, 'a gate counted on foot')
  stepGigRun(run, line, at(line.stops[0], 'car'), 1)
  assert.equal(run.step, 0, 'a gate counted in a car')
  stepGigRun(run, line, at(line.stops[0], 'skateboard'), 1)
  assert.equal(run.step, 1)
  assert.equal(run.offRide, 0, 'getting back on the board resets the count')
  for (let i = 0; i < line.offRideSeconds - 1; i++) stepGigRun(run, line, at({ x: 0, z: 0 }, null), 1)
  assert.equal(run.status, 'running')
  stepGigRun(run, line, at({ x: 0, z: 0 }, null), 1)
  assert.equal(run.status, 'off-ride')
  // Tricks pay, up to the cap.
  const done = { ...createGigRun(line), status: 'done', elapsed: line.seconds, flips: 3 }
  assert.equal(gigPay(line, done, { board: 1 }, life.skills), line.pay.base + 3 * line.pay.perFlip)
  done.flips = 999
  assert.equal(gigPay(line, done, { board: 1 }, life.skills), line.pay.base + line.pay.flipCap)
})

test('a hunt hides its set at the next spot each time, and the bars rise as you close in', () => {
  const hunt = gig('find-the-dj')
  const seen = hunt.spots.map((_, attempt) => createGigRun(hunt, attempt).stops[0])
  assert.deepEqual(seen, hunt.spots)
  assert.deepEqual(createGigRun(hunt, hunt.spots.length).stops[0], hunt.spots[0])
  assert.equal(createGigRun(hunt, 0).stops.length, 1)
  const bars = [400, 300, 250, 190, 130, 70, 10, 0].map((distance) => gigSignal(distance, hunt.reach))
  assert.deepEqual(bars, [...bars].sort((a, b) => a - b), 'bars must never drop as the distance shrinks')
  assert.equal(bars[0], 0)
  assert.equal(bars.at(-1), 5)
  assert.equal(gigSignal(NaN), 0)
})

test('a best time only improves, and a win is paid once', () => {
  const crate = gig('crate-run')
  const profile = emptyProfile()
  const finished = (elapsed) => ({ ...createGigRun(crate), status: 'done', elapsed })
  assert.deepEqual(recordGig(profile, crate, finished(90), 60), { pay: 60, best: false }, 'a first finish is a time, not a new best')
  assert.deepEqual(recordGig(profile, crate, finished(120), 50), { pay: 50, best: false })
  assert.deepEqual(recordGig(profile, crate, finished(75.04), 70), { pay: 70, best: true })
  assert.deepEqual(profile.gigs['crate-run'], { runs: 3, wins: 3, best: 75 })
  assert.equal(profile.cash, 180)
})

test('bigger gigs wait for Hustle', () => {
  assert.equal(gigUnlocked(gig('crate-run'), 1), true)
  assert.equal(gigUnlocked(gig('crosstown-run'), 1), false)
  assert.equal(gigUnlocked(gig('crosstown-run'), 2), true)
})

// ------------------------------------------------------------------ texts

test('texts arrive once, and a skipped milestone still arrives', () => {
  const ids = (event, sent = []) => textsFor(event, sent, life.texts).map((text) => text.id)
  assert.deepEqual(ids({ type: 'tape', count: 1 }), ['first-tape'])
  assert.deepEqual(ids({ type: 'tape', count: 6 }), ['first-tape', 'five-tapes'])
  assert.deepEqual(ids({ type: 'tape', count: 6 }, ['first-tape']), ['five-tapes'])
  assert.deepEqual(ids({ type: 'tape', count: 6 }, ['first-tape', 'five-tapes']), [])
  assert.deepEqual(ids({ type: 'gig', id: 'crate-run', result: 'done', count: 1 }), ['first-gig', 'crate-run-done'])
  assert.deepEqual(ids({ type: 'gig', id: 'crate-run', result: 'timeout', count: 0 }), ['crate-run-late'])
  assert.deepEqual(ids({ type: 'gig', id: 'skate-line', result: 'off-ride', count: 0 }), ['skate-line-off'])
  assert.deepEqual(ids({ type: 'level', skill: 'hustle', level: 2 }), ['crosstown-open'])
  assert.deepEqual(ids({ type: 'level', skill: 'legs', level: 2 }), [])
  assert.deepEqual(ids({ type: 'cash', value: 499 }), [])
  assert.deepEqual(ids({ type: 'cash', value: 500 }), ['flush'])
  assert.deepEqual(ids({ type: 'nothing' }), [])
})

test('unread texts are the ones not opened yet', () => {
  const profile = emptyProfile()
  receiveTexts(profile, ['welcome', 'first-gig', 'welcome'])
  assert.deepEqual(profile.texts, ['welcome', 'first-gig'])
  assert.deepEqual(unreadTexts(profile), ['welcome', 'first-gig'])
  profile.read = ['welcome']
  assert.deepEqual(unreadTexts(profile), ['first-gig'])
})

// ------------------------------------------------------------------- data

test('life.json is internally consistent', () => {
  assert.equal(thresholds.length, 5)
  assert.deepEqual(thresholds, [...thresholds].sort((a, b) => a - b))
  assert.equal(thresholds[0], 0)
  assert.equal(life.stamina.sprintSeconds.length, 5)
  assert.deepEqual(life.stamina.sprintSeconds, [...life.stamina.sprintSeconds].sort((a, b) => a - b), 'more Legs must never mean less sprint')
  for (const skill of SKILLS) assert.ok(life.skills[skill]?.name && life.skills[skill].perk, skill)
  assert.ok(vehicles.archetypes[life.valet.vehicle], 'the valet delivers a ride that exists')
  for (const price of Object.values(life.prices)) assert.ok(Number.isInteger(price) && price > 0)
  const gigIds = life.gigs.map((entry) => entry.id)
  assert.equal(new Set(gigIds).size, gigIds.length)
  assert.ok(life.gigs.some((entry) => (entry.hustle || 1) === 1), 'a fresh player needs a gig they can take')
  const textIds = life.texts.map((text) => text.id)
  assert.equal(new Set(textIds).size, textIds.length)
  for (const text of life.texts) {
    assert.ok(text.from && text.body && text.when?.event, text.id)
    assert.ok(text.body.length <= 180, text.id + ' is too long for a phone')
    if (text.when.event === 'gig' && text.when.id) assert.ok(gigIds.includes(text.when.id), text.id + ' names an unknown gig')
    if (text.when.skill) assert.ok(SKILLS.includes(text.when.skill), text.id + ' names an unknown skill')
  }
  // Every gig tells you how it went, win or lose.
  for (const entry of life.gigs) assert.ok(life.texts.some((text) => text.when.event === 'gig' && text.when.id === entry.id && text.when.result === 'done'), entry.id + ' has no text for finishing it')
})

test('every gig is inside the city, has a giver, and can be finished in its time', () => {
  const b = world.bounds
  const inside = (point) => point.x > b.minX + 6 && point.x < b.maxX - 6 && point.z > b.minZ + 6 && point.z < b.maxZ - 6
  // Streets are a grid, so a route is as long as its right-angle legs.
  const blocks = (a, c) => Math.abs(a.x - c.x) + Math.abs(a.z - c.z)
  // Metres per second a route may demand: a sprint with rests on foot, a board, or a car in traffic.
  const pace = { legs: 4.6, board: 7, wheels: 12, hustle: 4.6 }
  for (const entry of life.gigs) {
    assert.ok(['delivery', 'line', 'hunt'].includes(entry.kind), entry.id)
    assert.ok(entry.name && entry.giver && entry.pitch, entry.id)
    assert.ok(SKILLS.includes(entry.skill), entry.id + ' skill')
    assert.ok(entry.pay.base > 0 && entry.seconds > 0, entry.id)
    assert.ok(inside(entry.start), entry.id + ' start')
    const targets = entry.kind === 'hunt' ? entry.spots : entry.stops
    assert.ok(targets?.length >= 1, entry.id + ' has nowhere to go')
    for (const point of targets) assert.ok(inside(point) && point.label, entry.id + ' point')
    if (entry.ride) assert.equal(vehicles.archetypes[entry.ride]?.kind, entry.ride, entry.id + ' needs a ride that exists')
    const routes = entry.kind === 'hunt' ? entry.spots.map((spot) => [entry.start, spot]) : [[entry.start, ...entry.stops]]
    for (const route of routes) {
      let metres = 0
      for (let index = 1; index < route.length; index++) metres += blocks(route[index - 1], route[index])
      assert.ok(metres / entry.seconds <= pace[entry.skill], `${entry.id} needs ${(metres / entry.seconds).toFixed(1)} m/s over ${Math.round(metres)} m`)
    }
    // No stop is reachable from the ring without moving.
    assert.ok(targets.every((point) => Math.hypot(point.x - entry.start.x, point.z - entry.start.z) > (point.radius || entry.radius) + 4), entry.id + ' starts inside one of its own stops')
  }
})
