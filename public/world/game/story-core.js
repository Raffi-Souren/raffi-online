import { inspectIntentLanguage } from './intent-language.js'
/** Last Crate: local intent classification and a serializable, separate story. */
export const STORY_VERSION = 1

export function createStoryState(config) {
  return { version: STORY_VERSION, status: 'offer', branch: null, terms: null, stage: null,
    collected: [], trust: 0, gigs: 0, favorsOwed: 0, wallet: config?.wallet ?? 40, escrow: 0,
    rewarded: [], callbackSeen: false, listeningDone: false, futureGigDone: false, challenge: null }
}

const branches = ['return', 'cover', 'negotiate']
const stages = ['delivery', 'replacements', 'gig', 'handoff', 'sleeve', 'flyers', 'done']
const rewards = ['return-complete', 'cover-complete', 'handoff-complete', 'obligation-complete', 'listening-complete', 'future-gig-complete']

export function validateStoryState(value, config) {
  if (value == null) return { ok: true, state: createStoryState(config) }
  if (typeof value !== 'object' || Array.isArray(value) || value.version !== STORY_VERSION) return { ok: false, error: 'The saved conversation has an unsupported format.' }
  if (!['offer', 'declined', 'active', 'complete'].includes(value.status) || (value.branch !== null && !branches.includes(value.branch)) ||
      (value.terms !== null && !['deposit', 'favor'].includes(value.terms)) || (value.stage !== null && !stages.includes(value.stage))) return { ok: false, error: 'The saved story has an unknown choice.' }
  if (['callbackSeen', 'listeningDone', 'futureGigDone'].some((key) => typeof value[key] !== 'boolean')) return { ok: false, error: 'The saved story has invalid memory flags.' }
  if (!Array.isArray(value.collected) || value.collected.length > 3 || value.collected.some((id) => !['plaza-dub', 'lot-breaks', 'backdoor-soul'].includes(id)) ||
      !Array.isArray(value.rewarded) || value.rewarded.length > rewards.length || value.rewarded.some((id) => !rewards.includes(id))) return { ok: false, error: 'The saved story contains unknown progress.' }
  for (const key of ['trust', 'gigs', 'favorsOwed', 'wallet', 'escrow']) {
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1000) return { ok: false, error: 'The saved relationship or deposit is invalid.' }
  }
  if (['active', 'complete'].includes(value.status) && !value.branch) return { ok: false, error: 'The saved story is missing its accepted choice.' }
  if (value.branch === 'negotiate' && !value.terms) return { ok: false, error: 'The saved handoff is missing its agreed terms.' }
  const permitted = value.branch === 'return' ? ['return-complete', 'listening-complete'] : value.branch === 'cover' ? ['cover-complete', 'future-gig-complete'] : value.branch === 'negotiate' ? ['handoff-complete', 'obligation-complete'] : []
  const allowedStages = value.branch === 'return' ? ['delivery', 'done'] : value.branch === 'cover' ? ['replacements', 'gig', 'done'] : value.branch === 'negotiate' ? ['handoff', value.terms === 'deposit' ? 'sleeve' : 'flyers', 'done'] : [null]
  if (!allowedStages.includes(value.stage) || value.rewarded.some((id) => !permitted.includes(id)) ||
      (!value.branch && !['offer', 'declined'].includes(value.status)) ||
      (value.branch && !['active', 'complete'].includes(value.status)) ||
      (value.branch !== 'negotiate' && value.terms !== null) ||
      (value.status === 'complete') !== (value.stage === 'done') ||
      (value.callbackSeen && value.status !== 'complete' && !(value.branch === 'negotiate' && ['sleeve', 'flyers'].includes(value.stage))) ||
      (value.branch !== 'cover' && value.collected.length > 0) ||
      (value.stage === 'replacements' && new Set(value.collected).size === 3) ||
      (value.branch === 'cover' && ['gig', 'done'].includes(value.stage) && new Set(value.collected).size !== 3)) return { ok: false, error: 'The saved story has inconsistent progress.' }
  const earned = new Set(value.rewarded)
  const finished = value.branch === 'return' ? earned.has('return-complete') : value.branch === 'cover' ? earned.has('cover-complete') : earned.has('obligation-complete')
  if (finished !== (value.status === 'complete') || (earned.has('listening-complete') && !earned.has('return-complete')) ||
      (earned.has('future-gig-complete') && !earned.has('cover-complete')) ||
      (value.branch === 'negotiate' && (value.stage !== 'handoff') !== earned.has('handoff-complete'))) return { ok: false, error: 'The saved story reward history is inconsistent.' }
  const expectedTrust = (earned.has('return-complete') ? (config?.branches.return.trust ?? 2) : 0) + (earned.has('cover-complete') ? (config?.branches.cover.trust ?? 1) : 0) + (earned.has('obligation-complete') ? (config?.branches.negotiate.trust ?? 1) : 0) + (earned.has('listening-complete') ? 1 : 0) + (earned.has('future-gig-complete') ? 1 : 0)
  const expectedEscrow = value.terms === 'deposit' && !finished ? (config?.branches.negotiate.deposit ?? 25) : 0
  if (value.trust !== expectedTrust || value.gigs !== Number(earned.has('cover-complete')) + Number(earned.has('future-gig-complete')) ||
      value.favorsOwed !== Number(value.terms === 'favor' && !finished) || value.escrow !== expectedEscrow ||
      value.wallet !== (config?.wallet ?? 40) - expectedEscrow || Boolean(value.listeningDone) !== earned.has('listening-complete') || Boolean(value.futureGigDone) !== earned.has('future-gig-complete')) return { ok: false, error: 'The saved relationship does not match its completed actions.' }
  const state = Object.fromEntries(Object.keys(createStoryState(config)).map((key) => [key, value[key]]))
  Object.assign(state, { collected: [...new Set(value.collected)], rewarded: [...new Set(value.rewarded)],
    callbackSeen: value.callbackSeen === true, listeningDone: value.listeningDone === true, futureGigDone: value.futureGigDone === true, challenge: null })
  return { ok: true, state }
}

/** Questions and hedged/contradictory paraphrases never accept an obligation. */
export function classifyStoryIntent(raw) {
  const { text, guard } = inspectIntentLanguage(raw)
  if (guard) return { kind: guard === 'question' ? 'ask' : guard }
  if (/\b(walk away|leave it|pass on this)\b/.test(text)) return { kind: 'refuse' }
  const commit = /\b(i'll|i will|i can|let me|i want to|i choose|i accept|i agree|i promise|i owe|i'm in|sounds good|i'd like to|i would like to|i'm going to|i am going to|count me in|happy to|take the|choose the|accept the)\b/.test(text)
  if (!commit || /\b(maybe|might|not sure|perhaps|unless|if|provided|as long as|don't|do not|won't)\b/.test(text)) return { kind: 'clarify' }
  const matches = []
  if (/\b(return|personal|lena|her records|take (?:them|it|the records) home|bring (?:them|it) (?:back|home))\b/.test(text)) matches.push('return')
  if (/\b(cover|gig|dj|replacement|play (?:the|a|tonight)|handle (?:the|tonight's) set)\b/.test(text)) matches.push('cover')
  if (/\b(negotiate|handoff|hand-off|courier|deposit|favor|favour|flyer|sleeve)\b/.test(text)) matches.push('negotiate')
  if (matches.length !== 1) return { kind: 'clarify' }
  if (matches[0] === 'negotiate') {
    const deposit = /\b(deposit|twenty-five|twenty five)\b|\$25\b/.test(text)
    const favor = /\b(favor|favour|flyer)\b/.test(text)
    if (deposit && favor) return { kind: 'clarify' }
    return { kind: 'accept', branch: 'negotiate', terms: deposit ? 'deposit' : favor ? 'favor' : null }
  }
  return { kind: 'accept', branch: matches[0] }
}

function award(state, id, effect) {
  if (state.rewarded.includes(id)) return false
  state.rewarded.push(id)
  effect()
  return true
}

export function storySettled(state) {
  return state.status === 'complete' && state.callbackSeen && (state.branch === 'return' ? state.listeningDone : state.branch === 'cover' ? state.futureGigDone : true)
}

export function storyTargets(state, config) {
  if (!state.branch) return []
  const branch = config.branches[state.branch]
  if (state.stage === 'replacements') return branch.pickups.filter((item) => !state.collected.includes(item.id)).map((item) => ({ ...item, kind: 'pickup' }))
  if (['delivery', 'gig', 'handoff'].includes(state.stage)) return [{ ...branch.target, kind: 'action' }]
  if (state.stage === 'sleeve' || state.stage === 'flyers') return [{ ...branch[state.stage], kind: 'action' }]
  if (state.status === 'complete' && state.callbackSeen) {
    if (state.branch === 'return' && !state.listeningDone) return [{ ...branch.followup, kind: 'action' }]
    if (state.branch === 'cover' && !state.futureGigDone) return [{ ...branch.followup, kind: 'action' }]
  }
  return []
}

export function transitionStory(current, event, config) {
  const state = structuredClone(current)
  const result = { state, changed: false, reply: config.activeReply, challenge: false }
  if (event.kind === 'typed') event = classifyStoryIntent(event.text)
  if (event.kind === 'ask') { result.reply = storySettled(state) ? 'We are all settled. Your choice stays part of this neighborhood. To try a different route, start a new run or load a save from before the agreement.' : config.question; return result }
  if (event.kind === 'clarify') { result.reply = config.ambiguous; return result }
  if (event.kind === 'visit-owner') {
    if (state.status === 'complete' || state.stage === 'sleeve' || state.stage === 'flyers') {
      const branch = config.branches[state.branch]
      result.reply = state.branch === 'negotiate' ? (state.status === 'complete' ? branch.callbackSettled : branch[state.terms === 'deposit' ? 'callbackDeposit' : 'callbackFavor']) : (state.listeningDone || state.futureGigDone ? branch.callbackAfterFollowup : branch.callback)
      result.changed = !state.callbackSeen
      state.callbackSeen = true
    } else result.reply = state.branch ? config.activeReply : config.offer
    return result
  }
  if (event.kind === 'refuse') {
    if (state.branch) { result.reply = 'You can step away. Your accepted route stays marked; nothing else has been promised.'; return result }
    state.status = 'declined'; result.changed = true; result.reply = config.refuse; return result
  }
  if (event.kind === 'accept') {
    if (state.branch) { result.reply = state.status === 'complete'
      ? storySettled(state) ? 'You kept your word. That story is finished, and we remember how you handled it. A different route needs a new run or a save from before our agreement.' : 'The delivery is settled. Come back to the shop — there is a follow-up waiting for you.'
      : 'We already have an arrangement. Your next stop is still marked on the map.'; return result }
    if (!branches.includes(event.branch)) { result.reply = config.ambiguous; return result }
    const branch = config.branches[event.branch]
    if (event.branch === 'negotiate' && !['deposit', 'favor'].includes(event.terms)) { result.reply = branch.terms; result.terms = true; return result }
    if (event.terms === 'deposit' && state.wallet < branch.deposit) { result.reply = 'You do not have the deposit. The favor is available, but only if you choose it.'; result.terms = true; return result }
    state.status = 'active'; state.branch = event.branch; state.terms = event.branch === 'negotiate' ? event.terms : null
    state.stage = event.branch === 'return' ? 'delivery' : event.branch === 'cover' ? 'replacements' : 'handoff'
    if (state.terms === 'deposit') { state.wallet -= branch.deposit; state.escrow = branch.deposit }
    if (state.terms === 'favor') state.favorsOwed = 1
    result.changed = true
    result.reply = state.terms === 'deposit' ? branch.acceptedDeposit : state.terms === 'favor' ? branch.acceptedFavor : branch.accepted
    return result
  }
  if (event.kind === 'pickup' && state.stage === 'replacements') {
    const pickup = config.branches.cover.pickups.find((item) => item.id === event.id)
    if (!pickup || state.collected.includes(pickup.id)) return result
    state.collected.push(pickup.id); result.changed = true
    if (state.collected.length === config.branches.cover.pickups.length) state.stage = 'gig'
    result.reply = state.stage === 'gig' ? 'Three replacements secured. The decks are ready at the club.' : pickup.title + ' collected.'
    return result
  }
  if (event.kind === 'start-challenge' && state.challenge && !state.challenge.started) {
    if (state.challenge.kind === 'listening' && !config.listeningRecords.some((record) => record.id === event.record)) { result.reply = 'Choose a record to begin the side.'; return result }
    state.challenge.started = true; state.challenge.record = event.record || null; result.changed = true; return result
  }
  if (event.kind === 'cancel-challenge' && state.challenge) { state.challenge = null; result.changed = true; return result }
  if (event.kind !== 'interact') return result
  const target = storyTargets(state, config).find((item) => item.id === event.id)
  if (!target || target.kind === 'pickup') return result
  if (['gig', 'future-gig', 'listening'].includes(event.id)) {
    const spec = event.id === 'gig' ? config.branches.cover.challenge : event.id === 'future-gig' ? config.branches.cover.followup : config.branches.return.followup
    state.challenge = { kind: event.id, elapsed: 0, next: 0, hits: 0, misses: 0, record: null, ...spec }
    result.changed = true; result.challenge = true
    result.reply = event.id === 'listening' ? 'Pick a record. Stay for its first side — nobody is counting requests.' : 'Tap HIT or Space when the ring reaches the line. A few misses are fine. The set starts when you press Start.'
    return result
  }
  const branch = config.branches[state.branch]
  if (event.id === 'delivery') {
    award(state, 'return-complete', () => { state.trust += branch.trust })
    state.stage = 'done'; state.status = 'complete'; result.reply = branch.complete
  } else if (event.id === 'handoff') {
    award(state, 'handoff-complete', () => {})
    state.stage = state.terms === 'deposit' ? 'sleeve' : 'flyers'; result.reply = branch.complete
  } else if (event.id === 'sleeve' || event.id === 'flyers') {
    award(state, 'obligation-complete', () => { state.wallet += state.escrow; state.escrow = 0; state.favorsOwed = 0; state.trust += branch.trust })
    state.stage = 'done'; state.status = 'complete'
    result.reply = event.id === 'sleeve' ? 'Sleeve returned. Your $25 is back. The owner remembers that you kept the agreement.' : 'The flyers are up. Favor settled. The owner remembers that you followed through.'
  }
  result.changed = true
  return result
}

/** Timed skill play is independent of rendering and never awards twice. */
export function stepStoryChallenge(current, dt, pulse, config) {
  const state = structuredClone(current)
  const run = state.challenge
  if (!run || !run.started || !Number.isFinite(dt) || dt < 0) return { state, changed: false }
  run.elapsed += dt
  let complete = false
  if (run.kind === 'listening') complete = Boolean(run.record) && run.elapsed >= run.seconds
  else {
    const interval = 60 / run.bpm
    const window = run.windowMs / 1000
    if (pulse && run.next < run.beats) {
      if (Math.abs(run.elapsed - (run.next + 1) * interval) <= window) { run.hits++; run.next++ }
      else run.misses++
    }
    while (run.next < run.beats && run.elapsed > (run.next + 1) * interval + window) { run.next++; run.misses++ }
    if (run.misses >= run.missCap) { state.challenge = null; return { state, changed: true, failed: true, reply: 'The mix slipped. The records stay with you — try the decks again whenever you’re ready.' } }
    complete = run.next >= run.beats
  }
  if (!complete) return { state, changed: true }
  const kind = run.kind
  if (kind === 'gig') {
    award(state, 'cover-complete', () => { state.trust += config.branches.cover.trust; state.gigs++ })
    state.status = 'complete'; state.stage = 'done'
  } else if (kind === 'future-gig') award(state, 'future-gig-complete', () => { state.futureGigDone = true; state.gigs++; state.trust++ })
  else award(state, 'listening-complete', () => { state.listeningDone = true; state.trust++ })
  state.challenge = null
  return { state, changed: true, complete: true, reply: kind === 'gig' ? config.branches.cover.complete : kind === 'future-gig' ? 'Your name stays on the lineup. The shop remembers both sets.' : 'One side, three stories, a room that knows your name. Lena says to come by again.' }
}
