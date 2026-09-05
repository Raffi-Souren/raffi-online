import assert from 'node:assert/strict'
import test from 'node:test'
import { CRATE_QUEST_MESSAGE, crateQuestContext, isCrateQuestReturn } from '../game/crate-quest-core.js'

const playerState = () => ({ mode: 'foot', interior: null, mission: { active: null } })
const point = { x: -60, z: 112 }

test('crate discovery uses the authored shop arrival and does not replace active missions', () => {
  assert.deepEqual(crateQuestContext(playerState(), point, false, false), {
    ...point, radius: 5, label: 'DIG', prompt: 'DIG THE BACK-ROOM CRATES', kind: 'crate-quest',
  })
  for (const state of [
    { ...playerState(), mode: 'vehicle' },
    { ...playerState(), interior: { id: 'club' } },
    { ...playerState(), mission: { active: 'crate-dig' } },
  ]) assert.equal(crateQuestContext(state, point, false, false), null)
  assert.equal(crateQuestContext(playerState(), point, true, false), null)
  assert.equal(crateQuestContext(playerState(), point, false, true), null)
  assert.equal(crateQuestContext(playerState(), null, false, false), null)
})

test('only the same-origin parent may return from the currently open quest', () => {
  const parent = {}
  const origin = 'https://raffi.computer'
  const event = { source: parent, origin, data: { type: CRATE_QUEST_MESSAGE, action: 'complete' } }
  assert.equal(isCrateQuestReturn(event, parent, origin, true), true)
  assert.equal(isCrateQuestReturn({ ...event, data: { ...event.data, action: 'exit' } }, parent, origin, true), true)
  assert.equal(isCrateQuestReturn(event, parent, origin, false), false)
  assert.equal(isCrateQuestReturn({ ...event, source: {} }, parent, origin, true), false)
  assert.equal(isCrateQuestReturn({ ...event, origin: 'https://elsewhere.example' }, parent, origin, true), false)
  for (const data of [null, [], {}, { ...event.data, action: 'open' }, { ...event.data, score: 999 }, { ...event.data, type: 'other' }]) {
    assert.equal(isCrateQuestReturn({ ...event, data }, parent, origin, true), false)
  }
})
