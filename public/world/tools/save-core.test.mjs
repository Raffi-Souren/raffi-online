import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { SAVE_SLOTS, SAVE_VERSION, validateSaveRecord, saveSummary } from '../game/save-core.js'

const catalog = Object.fromEntries(['world', 'missions', 'vehicles', 'radio', 'conversations'].map((name) =>
  [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))]))
const record = () => ({
  version: SAVE_VERSION, seed: 'port-vantage-v1', savedAt: 1_800_000_000_000, playSeconds: 124,
  player: { x: -450, z: -151, yaw: 0.3 }, completed: [], activeMission: null,
  radio: { on: true, station: 'WGRD' }, grade: 'dusk', vehicle: null,
})

test('a save round-trips three manual slots and the separate autosave without engine objects', () => {
  assert.deepEqual(SAVE_SLOTS, ['auto', 'slot-1', 'slot-2', 'slot-3'])
  const value = record()
  value.vehicle = { archetype: 'grand-tourer', mesh: { invalid: true } }
  const first = validateSaveRecord(value, catalog)
  assert.equal(first.ok, true)
  assert.deepEqual(first.save.vehicle, { archetype: 'grand-tourer' })
  assert.deepEqual(validateSaveRecord(JSON.stringify(first.save), catalog), first)
  assert.deepEqual(first.save.unlocked, ['deal-clock'])
  assert.equal(saveSummary(first.save, catalog).location, catalog.world.districts.find((district) => district.id === 'heights').name)
})

test('damaged, oversized and future save formats fail before a game can mutate', () => {
  for (const value of ['{', 'x'.repeat(32_769), null, [], { ...record(), version: 99 }]) {
    assert.equal(validateSaveRecord(value, catalog).ok, false)
  }
})

test('non-finite or out-of-world coordinates and harbor positions cannot restore a player', () => {
  for (const player of [
    { x: NaN, z: 0, yaw: 0 }, { x: 0, z: Infinity, yaw: 0 }, { x: 0, z: 0, yaw: Infinity },
    { x: 100_000, z: 0, yaw: 0 }, { x: -639, z: 0, yaw: 0 }, { x: 500, z: -350, yaw: 0 },
  ]) assert.equal(validateSaveRecord({ ...record(), player }, catalog).ok, false, JSON.stringify(player))
})

test('saved progress derives its unlocks instead of trusting a stale or edited unlock list', () => {
  const value = { ...record(), completed: ['deal-clock'], unlocked: ['blackout', 'escort'] }
  const parsed = validateSaveRecord(value, catalog)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.save.unlocked.sort(), ['crate-dig', 'deal-clock'])
  assert.equal(validateSaveRecord({ ...value, activeMission: 'escort' }, catalog).ok, false)
})

test('branch and finale dependencies remain intact across a save/load', () => {
  const firstFour = ['deal-clock', 'crate-dig', 'set-time', 'cold-boot']
  assert.equal(validateSaveRecord({ ...record(), completed: ['shootout'] }, catalog).ok, false)
  assert.equal(validateSaveRecord({ ...record(), completed: [...firstFour, 'yard-run'], activeMission: 'escort' }, catalog).ok, false)
  assert.equal(validateSaveRecord({ ...record(), completed: [...firstFour, 'shootout', 'escort'], activeMission: 'blackout' }, catalog).ok, false)
  const ready = validateSaveRecord({ ...record(), completed: [...firstFour, 'shootout', 'yard-run', 'escort'], activeMission: 'blackout' }, catalog)
  assert.equal(ready.ok, true)
  assert.match(saveSummary(ready.save, catalog).location, /BLACKOUT.*briefing checkpoint/)
})

test('mid-mission snapshots keep campaign progress and explicitly resume at a briefing without stale vehicles', () => {
  const value = { ...record(), completed: ['deal-clock', 'crate-dig'], activeMission: 'set-time', vehicle: { archetype: 'compact' } }
  const parsed = validateSaveRecord(value, catalog)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.save.activeMission, 'set-time')
  assert.equal(parsed.save.vehicle, null)
  assert.deepEqual(parsed.save.completed, value.completed)
  assert.equal(saveSummary(parsed.save, catalog).checkpoint, true)
})

test('loading an older save removes later radio unlocks even when the running catalogue was mutated', () => {
  const liveCatalog = structuredClone(catalog)
  for (const station of liveCatalog.radio.stations) station.unlocked = true
  const fresh = validateSaveRecord({ ...record(), radio: { on: true, station: 'MNFR' } }, liveCatalog)
  assert.equal(fresh.ok, true)
  assert.deepEqual(fresh.save.radio.unlocked, ['WGRD', 'TLKR', 'SUNS'])
  assert.equal(fresh.save.radio.station, 'WGRD')
  const afterCrates = validateSaveRecord({ ...record(), completed: ['deal-clock', 'crate-dig'], radio: { on: true, station: 'HABI' } }, liveCatalog)
  assert.equal(afterCrates.save.radio.station, 'HABI')
  assert.ok(afterCrates.save.radio.unlocked.includes('KFLP'))
  assert.equal(afterCrates.save.radio.unlocked.includes('MNFR'), false)
})

test('unknown mission, ride, grade and malformed clock data cannot enter the runtime', () => {
  for (const change of [
    { completed: ['__proto__'] }, { vehicle: { archetype: '__proto__' } }, { grade: '__proto__' },
    { playSeconds: -1 }, { savedAt: Infinity }, { seed: '' }, { radio: { on: 'true', station: 'WGRD' } },
  ]) assert.equal(validateSaveRecord({ ...record(), ...change }, catalog).ok, false, JSON.stringify(change))
})

test('optional crate quest persists independently without granting campaign or radio shortcuts', () => {
  const parsed = validateSaveRecord({ ...record(), completed: ['crate-quest'] }, catalog)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.save.unlocked, ['deal-clock'])
  assert.equal(saveSummary(parsed.save, catalog).completed, 0)
})

test('explicit MIXTAPE radio unlocks survive a save without unlocking campaign shortcuts', () => {
  const unlocked = catalog.radio.stations.map((station) => station.id)
  const parsed = validateSaveRecord({ ...record(), radio: { on: true, station: 'MNFR', unlocked } }, catalog)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.save.radio.station, 'MNFR')
  assert.deepEqual([...parsed.save.radio.unlocked].sort(), [...unlocked].sort())
  assert.deepEqual(parsed.save.unlocked, ['deal-clock'])
})


test('authored ride identity survives saves while malformed references are rejected', () => {
  const input = { ...record(), vehicle: { archetype: 'skateboard', sourceId: 'crib-board' } }
  const saved = validateSaveRecord(input, catalog)
  assert.equal(saved.ok, true); assert.equal(saved.save.vehicle.sourceId, 'crib-board')
  assert.deepEqual(validateSaveRecord(JSON.stringify(saved.save), catalog), saved)
  for (const sourceId of ['', 42, 'x'.repeat(97), '\u0000']) assert.equal(validateSaveRecord({ ...input, vehicle: { ...input.vehicle, sourceId } }, catalog).ok, false)
})


test('park results survive validated saves while corrupt medals and wins cannot restore', () => {
  const sports = Object.fromEntries(['tennis', 'soccer', 'boxing'].map(id => [id, { played: 0, wins: 0, best: 0, medal: false, lastWon: null }]))
  sports.tennis = { played: 3, wins: 1, best: 8, medal: true, lastWon: false }
  const saved = validateSaveRecord({ ...record(), sports }, catalog)
  assert.equal(saved.ok, true)
  assert.deepEqual(saved.save.sports, sports)
  assert.deepEqual(validateSaveRecord(JSON.stringify(saved.save), catalog), saved)
  assert.equal(validateSaveRecord({ ...record(), sports: { ...sports, tennis: { ...sports.tennis, medal: false } } }, catalog).ok, false)
  assert.equal(validateSaveRecord({ ...record(), sports: { ...sports, tennis: { ...sports.tennis, wins: 4 } } }, catalog).ok, false)
})
