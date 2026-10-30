import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }

const { TAPES_KEY, collectTape, readFound, tapeInReach, writeFound } = await import('../game/tapes-core.js')
const { newYorkHour, clockText } = await import('../engine/state.js')
const { hostPlaysStation } = await import('../engine/audio-core.js')

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const tapes = read('../data/tapes.json')
const radio = read('../data/radio.json')
const world = read('../data/world.json')
const ids = tapes.tapes.map((tape) => tape.id)

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), values }
}

test('every BADCOMPANY mix has exactly one tape, with the same id and title', () => {
  const source = fs.readFileSync(new URL('../../../data/audio-library.ts', import.meta.url), 'utf8')
  const block = source.slice(source.indexOf('export const BADCOMPANY_MIXES'))
  const list = block.slice(block.indexOf('= ['), block.indexOf('\n]'))
  const mixes = [...list.matchAll(/id:\s*"([^"]+)",\s*title:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g)]
    .map(([, id, double, single]) => ({ id, title: double !== undefined ? JSON.parse(`"${double}"`) : single.replace(/\\(.)/g, '$1') }))
  assert.equal(mixes.length, 14)
  assert.deepEqual(tapes.tapes.map(({ id, title }) => ({ id, title })), mixes)
  assert.equal(new Set(ids).size, ids.length)
})

test('tapes sit inside the city, in known districts, apart from each other', () => {
  const b = world.bounds
  const districts = new Set(world.districts.map((district) => district.id))
  for (const tape of tapes.tapes) {
    assert.ok(tape.at.x > b.minX && tape.at.x < b.maxX && tape.at.z > b.minZ && tape.at.z < b.maxZ, tape.id)
    assert.ok(districts.has(tape.district), tape.id + ' district')
    assert.ok(tape.street, tape.id + ' street')
  }
  for (const a of tapes.tapes) for (const b of tapes.tapes) {
    if (a !== b) assert.ok(Math.hypot(a.at.x - b.at.x, a.at.z - b.at.z) > tapes.pickupRadius * 4, `${a.id} and ${b.id} overlap`)
  }
})

test('picking up a tape is idempotent and never counts twice', () => {
  const found = new Set()
  assert.deepEqual(collectTape(found, 'bc-3', ids), { added: true, count: 1 })
  assert.deepEqual(collectTape(found, 'bc-3', ids), { added: false, count: 1 })
  assert.deepEqual(collectTape(found, 'bc-99', ids), { added: false, count: 1 })
  assert.deepEqual(collectTape(found, 'bc-4', ids), { added: true, count: 2 })
  const storage = memoryStorage()
  writeFound(storage, found)
  writeFound(storage, found)
  assert.deepEqual(JSON.parse(storage.values.get(TAPES_KEY)), ['bc-3', 'bc-4'])
  assert.deepEqual([...readFound(storage, ids)], ['bc-3', 'bc-4'])
})

test('the found list ignores foreign ids and broken storage', () => {
  assert.deepEqual([...readFound(memoryStorage({ [TAPES_KEY]: '["bc-1","nope",7,"bc-1"]' }), ids)], ['bc-1'])
  assert.equal(readFound(memoryStorage({ [TAPES_KEY]: '{oops' }), ids).size, 0)
  assert.equal(readFound(memoryStorage({ [TAPES_KEY]: '{"bc-1":true}' }), ids).size, 0)
  assert.equal(readFound(null, ids).size, 0)
  const throwing = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readFound(throwing, ids).size, 0)
  assert.doesNotThrow(() => writeFound(throwing, new Set(['bc-1'])))
})

test('reach picks the nearest unfound tape within the radius', () => {
  const list = [{ id: 'a', at: { x: 0, z: 0 } }, { id: 'b', at: { x: 1, z: 0 } }]
  assert.equal(tapeInReach(list, new Set(), 0.9, 0, 1.4).id, 'b')
  assert.equal(tapeInReach(list, new Set(['b']), 0.9, 0, 1.4).id, 'a')
  assert.equal(tapeInReach(list, new Set(['a', 'b']), 0.9, 0, 1.4), null)
  assert.equal(tapeInReach(list, new Set(), 5, 5, 1.4), null)
})

test('BADCO FM is locked on a fresh save and opened by the first tape', () => {
  const badco = radio.stations.filter((station) => station.hostMixes)
  assert.equal(badco.length, 1)
  assert.equal(badco[0].id, 'BDCO')
  assert.equal(badco[0].unlocked, false)
  assert.equal(badco[0].unlockedBy, 'tape:first')
})

test('the desktop plays BADCO FM only when there is a desktop and no story music', () => {
  const badco = radio.stations.find((station) => station.hostMixes)
  const synth = radio.stations.find((station) => !station.hostMixes)
  assert.equal(hostPlaysStation(badco, { hosted: true }), true)
  // Offline or opened on its own page: the station's synth is the fallback.
  assert.equal(hostPlaysStation(badco, { hosted: false }), false)
  assert.equal(hostPlaysStation(badco, { hosted: true, storyPlayingMusic: true }), false)
  assert.equal(hostPlaysStation(synth, { hosted: true }), false)
  assert.equal(hostPlaysStation(null, { hosted: true }), false)
  for (const key of ['bpm', 'scale', 'synth', 'idLine']) assert.ok(badco[key], 'BADCO FM fallback needs ' + key)
})

test('the World clock is New York time, across daylight saving', () => {
  assert.equal(newYorkHour(new Date('2026-01-15T12:00:00Z')), 7)
  assert.equal(newYorkHour(new Date('2026-07-15T12:00:00Z')), 8)
  assert.equal(newYorkHour(new Date('2026-07-15T03:30:00Z')), 23)
  assert.equal(newYorkHour(new Date('2026-11-01T05:30:00Z')), 1)
  assert.equal(newYorkHour(new Date('2026-11-01T06:30:00Z')), 1)
})

test('New York clock minutes do not inherit a visitor’s fractional time-zone offset', () => {
  const previousZone = process.env.TZ
  try {
    process.env.TZ = 'Asia/Kathmandu'
    const now = new Date('2026-07-15T12:17:00Z')
    assert.equal(now.getMinutes(), 2, 'probe must use the visitor’s 45-minute offset')
    assert.equal(clockText(now), '08:17')
  } finally {
    if (previousZone === undefined) delete process.env.TZ
    else process.env.TZ = previousZone
  }
})

test('every Lab storefront points at a real Lab room inside the city', () => {
  const lab = fs.readFileSync(new URL('../../../data/lab/index.ts', import.meta.url), 'utf8')
  const slugs = new Set()
  for (const file of fs.readdirSync(new URL('../../../data/lab/', import.meta.url))) {
    const match = /slug:\s*"([^"]+)"/.exec(fs.readFileSync(new URL('../../../data/lab/' + file, import.meta.url), 'utf8'))
    if (match && lab.includes('./' + file.replace(/\.ts$/, ''))) slugs.add(match[1])
  }
  assert.ok(world.labFronts.length >= 4)
  for (const front of world.labFronts) {
    assert.ok(slugs.has(front.slug), front.slug + ' is not a Lab room')
    assert.ok(front.x > world.bounds.minX && front.x < world.bounds.maxX && front.z > world.bounds.minZ && front.z < world.bounds.maxZ)
    for (const tape of tapes.tapes) assert.ok(Math.hypot(front.x - tape.at.x, front.z - tape.at.z) > 3, `${front.slug} sign covers ${tape.id}`)
  }
})
