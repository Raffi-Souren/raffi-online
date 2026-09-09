import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createStoryState, classifyStoryIntent, transitionStory, storyTargets, storySettled, stepStoryChallenge, validateStoryState } from '../game/story-core.js'
import { validateSaveRecord } from '../game/save-core.js'

const catalog = Object.fromEntries(['conversations', 'world', 'missions', 'radio', 'vehicles'].map((name) => [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))]))
const config = catalog.conversations
const go = (state, event) => transitionStory(state, event, config).state
const accept = (branch, terms) => go(createStoryState(config), { kind: 'accept', branch, terms })
function perform(state, misses = []) {
  state = go(state, { kind: 'start-challenge' })
  const interval = 60 / state.challenge.bpm
  for (let beat = 0; state.challenge && beat < 30; beat++) {
    state = stepStoryChallenge(state, interval, !misses.includes(beat), config).state
  }
  if (state.challenge) state = stepStoryChallenge(state, 0.2, false, config).state
  return state
}
function coverReady() {
  let state = accept('cover')
  for (const pickup of config.branches.cover.pickups) state = go(state, { kind: 'pickup', id: pickup.id })
  return state
}
const valid = (state) => assert.equal(validateStoryState(state, config).ok, true, JSON.stringify(validateStoryState(state, config)))

test('questions, hedges, competing intentions and unknown text never accept an obligation', () => {
  for (const text of ['Can I return her records?', 'What does the deposit cost', 'I will cover the gig?', "Maybe I'll return her records", "I'll cover the gig or return Lena's personal records", "I'll pay the deposit and owe a favor", 'wibble', 'I love records', "I will return the records if you pay me", "I will cover the gig provided I get paid"]) {
    const before = createStoryState(config)
    const result = transitionStory(before, { kind: 'typed', text }, config)
    assert.equal(result.state.branch, null, text)
    assert.equal(result.changed, false, text)
    assert.deepEqual(before, createStoryState(config))
  }
})

test('local paraphrases identify three choices and explicit handoff terms', () => {
  for (const [text, branch, terms] of [
    ["I'll bring them home", 'return'], ['Let me return the personal records', 'return'], ["I'm going to cover the gig", 'cover'], ['I can DJ tonight', 'cover'], ["I'll pay $25 for the handoff", 'negotiate', 'deposit'], ["I agree to the courier favor", 'negotiate', 'favor'],
  ]) {
    const result = classifyStoryIntent(text)
    assert.equal(result.kind, 'accept', text); assert.equal(result.branch, branch, text)
    if (terms) assert.equal(result.terms, terms, text)
  }
})

test('refusal leaves the crate and allows a later voluntary acceptance', () => {
  const result = transitionStory(createStoryState(config), { kind: 'typed', text: 'No thanks' }, config)
  assert.equal(result.state.status, 'declined'); assert.equal(result.state.branch, null); valid(result.state)
  const accepted = go(result.state, { kind: 'accept', branch: 'return' }); assert.equal(accepted.status, 'active'); valid(accepted)
})

test('negotiating without terms asks for a decision and does not spend or promise', () => {
  const result = transitionStory(createStoryState(config), { kind: 'typed', text: "I'll negotiate a handoff" }, config)
  assert.equal(result.terms, true); assert.equal(result.changed, false); assert.equal(result.state.wallet, 40); assert.equal(result.state.favorsOwed, 0)
  const poor = { ...createStoryState(config), wallet: 10 }
  const denied = transitionStory(poor, { kind: 'accept', branch: 'negotiate', terms: 'deposit' }, config)
  assert.equal(denied.state.branch, null); assert.equal(denied.state.favorsOwed, 0)
})

test('personal delivery produces trust, an explicit later callback, and a playable listening side', () => {
  let state = accept('return'); valid(state)
  assert.deepEqual(storyTargets(state, config).map((item) => item.id), ['delivery'])
  state = go(state, { kind: 'interact', id: 'delivery' }); valid(state)
  assert.equal(state.trust, 2); assert.equal(state.status, 'complete'); assert.equal(storyTargets(state, config).length, 0)
  state = go(state, { kind: 'visit-owner' }); assert.equal(state.callbackSeen, true)
  assert.equal(storyTargets(state, config)[0].id, 'listening')
  state = go(state, { kind: 'interact', id: 'listening' })
  const noRecord = go(state, { kind: 'start-challenge' }); assert.equal(noRecord.challenge.started, undefined)
  state = go(state, { kind: 'start-challenge', record: config.listeningRecords[0].id })
  state = stepStoryChallenge(state, 17, false, config).state; assert.equal(state.listeningDone, false)
  state = stepStoryChallenge(state, 1, false, config).state; assert.equal(state.listeningDone, true); assert.equal(state.trust, 3); valid(state)
  assert.equal(storyTargets(state, config).length, 0)
  assert.equal(storySettled(state), true)
  assert.match(transitionStory(state, { kind: 'visit-owner' }, config).reply, /listening night felt right/)
  assert.deepEqual(go(state, { kind: 'interact', id: 'delivery' }), state)
})

test('cover branch requires three distinct pickups before the playable set and future gig', () => {
  let state = accept('cover')
  state = go(state, { kind: 'interact', id: 'gig' }); assert.equal(state.challenge, null)
  state = go(state, { kind: 'pickup', id: config.branches.cover.pickups[0].id })
  state = go(state, { kind: 'pickup', id: config.branches.cover.pickups[0].id }); assert.equal(state.collected.length, 1)
  state = coverReady(); valid(state)
  state = go(state, { kind: 'interact', id: 'gig' }); state = perform(state); valid(state)
  assert.equal(state.status, 'complete'); assert.equal(state.gigs, 1); assert.equal(state.trust, 1)
  state = go(state, { kind: 'visit-owner' }); assert.equal(storyTargets(state, config)[0].id, 'future-gig')
  state = go(state, { kind: 'interact', id: 'future-gig' }); state = perform(state); valid(state)
  assert.equal(state.gigs, 2); assert.equal(state.futureGigDone, true); assert.equal(state.trust, 2)
  assert.equal(storySettled(state), true); assert.match(transitionStory(state, { kind: 'visit-owner' }, config).reply, /Two sets/)
  assert.deepEqual(go(state, { kind: 'interact', id: 'future-gig' }), state)
})

test('missed DJ beats can finish within tolerance, while failed and interrupted sets safely retry', () => {
  const ready = go(coverReady(), { kind: 'interact', id: 'gig' })
  const imperfect = perform(ready, [15]); assert.equal(imperfect.status, 'complete'); assert.equal(imperfect.gigs, 1); valid(imperfect)
  let failed = go(ready, { kind: 'start-challenge' }); failed = stepStoryChallenge(failed, 5, false, config).state
  assert.equal(failed.challenge, null); assert.equal(failed.stage, 'gig'); assert.equal(failed.gigs, 0); valid(failed)
  const retried = perform(go(failed, { kind: 'interact', id: 'gig' })); assert.equal(retried.gigs, 1)
  const cancelled = go(ready, { kind: 'cancel-challenge' }); assert.equal(cancelled.challenge, null); assert.equal(cancelled.stage, 'gig')
})

for (const terms of ['deposit', 'favor']) test(`negotiated ${terms} persists through handoff and settles once`, () => {
  let state = accept('negotiate', terms); valid(state)
  assert.equal(state.wallet, terms === 'deposit' ? 15 : 40); assert.equal(state.favorsOwed, terms === 'favor' ? 1 : 0)
  state = go(state, { kind: 'interact', id: 'handoff' }); valid(state)
  assert.equal(state.status, 'active'); assert.equal(state.trust, 0)
  const callback = transitionStory(state, { kind: 'visit-owner' }, config); state = callback.state
  assert.match(callback.reply, terms === 'deposit' ? /\$25/ : /flyers/)
  const saved = validateStoryState(JSON.parse(JSON.stringify(state)), config); assert.equal(saved.ok, true); state = saved.state
  state = go(state, { kind: 'interact', id: terms === 'deposit' ? 'sleeve' : 'flyers' }); valid(state)
  assert.equal(state.status, 'complete'); assert.equal(state.wallet, 40); assert.equal(state.escrow, 0); assert.equal(state.favorsOwed, 0); assert.equal(state.trust, 1)
  const repeated = go(state, { kind: 'interact', id: terms === 'deposit' ? 'sleeve' : 'flyers' }); assert.deepEqual(repeated, state)
  assert.match(transitionStory(state, { kind: 'visit-owner' }, config).reply, /settled/)
})

test('accepted route is immutable; asking or walking away cannot silently replace it', () => {
  const state = accept('return')
  for (const event of [{ kind: 'accept', branch: 'cover' }, { kind: 'refuse' }, { kind: 'ask' }]) assert.deepEqual(go(state, event), state)
})

test('validated save strips engine objects and restarts an active challenge without erasing its route', () => {
  const state = go(go(coverReady(), { kind: 'interact', id: 'gig' }), { kind: 'start-challenge' })
  const save = validateStoryState({ ...state, injected: 'ignored' }, config)
  assert.equal(save.ok, true); assert.equal(save.state.challenge, null); assert.equal(save.state.stage, 'gig'); assert.equal(save.state.injected, undefined)
  assert.deepEqual(validateStoryState(null, config).state, createStoryState(config))
})

test('corrupt relationships, incompatible stages, unknown content and duplicate-reward edits are rejected', () => {
  const fresh = createStoryState(config)
  for (const change of [{ version: 99 }, { branch: '__proto__' }, { stage: 'flyers' }, { trust: NaN }, { wallet: -1 }, { trust: 80 }, { rewarded: ['return-complete'] }, { collected: ['oops'] }, { favorsOwed: 1 }, { listeningDone: true }, { callbackSeen: true }]) assert.equal(validateStoryState({ ...fresh, ...change }, config).ok, false, JSON.stringify(change))
  assert.equal(validateStoryState({ ...accept('cover'), stage: 'done', status: 'complete' }, config).ok, false)
  assert.equal(validateStoryState({ ...accept('negotiate', 'deposit'), terms: 'favor' }, config).ok, false)
})

test('story choices share versioned saves without completing or unlocking any campaign mission', () => {
  const input = { version: 1, seed: 'FIXED', savedAt: Date.now(), playSeconds: 1, player: { x: -69, z: 110, yaw: 0 }, completed: [], activeMission: null, radio: { on: true, station: 'WGRD' }, grade: null, vehicle: null, story: accept('negotiate', 'favor') }
  const result = validateSaveRecord(input, catalog)
  assert.equal(result.ok, true); assert.equal(result.save.story.favorsOwed, 1); assert.deepEqual(result.save.completed, []); assert.deepEqual(result.save.unlocked, ['deal-clock'])
  assert.deepEqual(validateSaveRecord(JSON.stringify(result.save), catalog), result)
  assert.equal(validateSaveRecord({ ...input, story: { ...input.story, wallet: 1000 } }, catalog).ok, false)
})
