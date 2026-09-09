/** Last Crate is a separate neighborhood story, never an eighth-mission shortcut. */
import * as THREE from 'three'
import { state, data, bus } from '../engine/state.js'
import { resetInput } from '../engine/input.js'
import { unlockAudio, requestMusicFocus } from '../engine/audio.js'
import { makePed, animatePed } from '../gen/peds.js'
import { makePropObject } from '../gen/props.js'
import { setWaypoint, setObjective, toast } from './hud.js'
import { createStoryState, validateStoryState, transitionStory, storyTargets, storySettled, stepStoryChallenge } from './story-core.js'

let deps, story, panel, reply, choices, form, entry, relation, challengeBox, progress, beatLabel, ring
let opened = false, termsOpen = false, lastClock = 0, lastBeat = -1, currentTarget = null
let visuals = [], owner = null, previousFocus = null
const config = () => data.conversations
const node = (tag, className, text) => {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text) el.textContent = text
  return el
}
const distance = (point) => Math.hypot(point.x - state.player.x, point.z - state.player.z)

export function initStory(options = {}) {
  deps = options
  story = createStoryState(config())
  if (!document.querySelector('link[data-last-crate]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./story.css', import.meta.url).href; css.dataset.lastCrate = ''; document.head.append(css)
  }
  buildPanel()
  if (deps.scene && deps.materials && deps.atlas) {
    owner = makePed(data.npcs, 'raver', state.seed + ':last-crate-owner', deps.materials.actor || deps.materials.opaque, deps.atlas, data.blocks.vertexLighting)
    owner.position.set(config().owner.at.x, 0.2, config().owner.at.z)
    owner.rotation.y = Math.PI / 2
    owner.name = 'ped:last-crate-record-owner'
    owner.userData.npcId = 'story:last-crate-owner'
    owner.userData.appearanceSeed = state.seed + ':story:last-crate-owner'
    owner.userData.conversationCharacter = true
    deps.scene.add(owner)
  }
  document.addEventListener('visibilitychange', resetStoryClock)
  window.addEventListener('message', (event) => {
    const value = event.data
    if (event.source === window.parent && event.origin === location.origin && value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && value.type === 'raffi-world:activity' && typeof value.active === 'boolean') resetStoryClock()
  })
  refreshTargets()
}

function resetStoryClock() { lastClock = performance.now() }

function button(label, action, className = '') {
  const item = node('button', className, label); item.type = 'button'; item.addEventListener('click', action); return item
}
function buildPanel() {
  panel?.remove()
  panel = node('section', 'last-crate hidden'); panel.id = 'last-crate'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'last-crate-title')
  const card = node('div', 'last-crate-card')
  const top = node('div', 'last-crate-top')
  top.append(node('span', 'last-crate-kicker', 'THE RECORD SHOP · A NEIGHBORHOOD STORY'), button('Close ×', closeStory, 'last-crate-close'))
  const title = node('h2', '', config().title); title.id = 'last-crate-title'
  relation = node('p', 'last-crate-relation')
  reply = node('p', 'last-crate-reply'); reply.setAttribute('aria-live', 'polite'); reply.setAttribute('aria-atomic', 'true')
  choices = node('div', 'last-crate-choices')
  form = node('form', 'last-crate-form')
  const label = node('label', '', 'Say what you mean'); label.htmlFor = 'last-crate-input'
  entry = node('input'); entry.id = 'last-crate-input'; entry.type = 'text'; entry.maxLength = 600; entry.autocomplete = 'off'; entry.placeholder = 'Ask a question, make a promise, or decline…'
  const send = node('button', '', 'Say it'); send.type = 'submit'
  form.append(label, entry, send)
  form.addEventListener('submit', (event) => { event.preventDefault(); apply({ kind: 'typed', text: entry.value }); entry.value = ''; entry.focus() })
  const note = node('p', 'last-crate-note', 'Questions ask for information. A clear promise accepts a route. The owner remembers your choice.')
  challengeBox = node('div', 'last-crate-challenge hidden')
  card.append(top, title, relation, reply, challengeBox, choices, form, note)
  panel.append(card); document.body.append(panel)
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const focusable = [...panel.querySelectorAll('button:not([disabled]),input')].filter((item) => item.getClientRects().length)
      const index = focusable.indexOf(document.activeElement)
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus() }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus() }
    }
    if (event.code === 'Space' && story.challenge?.started && story.challenge.kind !== 'listening' && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
      event.preventDefault(); event.stopPropagation(); if (!event.repeat) advanceChallenge(true)
    }
  })
}

function showReply(text) { reply.textContent = text || config().activeReply }
function checkpoint() { bus.emit('story-checkpoint', { id: config().id, branch: story.branch, stage: story.stage }) }
function apply(event) {
  const result = transitionStory(story, event, config())
  story = result.state; termsOpen = Boolean(result.terms)
  showReply(result.reply)
  refreshTargets(); renderChoices()
  if (result.challenge) renderChallenge()
  if (result.changed) checkpoint()
  return result
}

function renderChoices() {
  const debt = story.escrow ? `$${story.escrow} deposit held` : story.favorsOwed ? '1 flyer-run favor owed' : 'No deposit or favor owed'
  relation.textContent = `Trust ${story.trust} · Gigs ${story.gigs} · Wallet $${story.wallet} · ${debt}`
  choices.replaceChildren()
  form.classList.toggle('hidden', Boolean(story.challenge))
  if (story.challenge) return
  if (termsOpen && !story.branch) {
    choices.append(button('Leave $25 refundable deposit', () => apply({ kind: 'accept', branch: 'negotiate', terms: 'deposit' })), button('Promise the flyer-run favor', () => apply({ kind: 'accept', branch: 'negotiate', terms: 'favor' })), button('Ask about all routes', () => apply({ kind: 'ask' })))
  } else if (!story.branch) {
    for (const [id, branch] of Object.entries(config().branches)) {
      const option = button(branch.label, () => apply({ kind: 'accept', branch: id }))
      const description = node('small', '', branch.description); option.append(description); choices.append(option)
    }
  } else {
    choices.append(button('Follow my route', () => { focusStory(); closeStory() }), button('Ask about the arrangement', () => apply({ kind: currentTarget?.id === 'owner' ? 'visit-owner' : 'ask' })))
  }
  choices.append(button(story.branch ? 'Back to the street' : 'No thanks · walk away', () => { if (!story.branch) apply({ kind: 'refuse' }); closeStory() }, 'last-crate-quiet'))
}

function renderChallenge() {
  const run = story.challenge
  challengeBox.replaceChildren(); challengeBox.classList.toggle('hidden', !run)
  if (!run) return
  progress = node('progress'); progress.max = run.kind === 'listening' ? run.seconds : run.beats; progress.value = 0; progress.setAttribute('aria-label', 'Session progress')
  beatLabel = node('p', 'last-crate-beat-label', run.kind === 'listening' ? 'Choose the first side' : `${run.beats} beats · ${run.bpm} BPM · Space or HIT`)
  ring = node('div', 'last-crate-ring'); ring.setAttribute('aria-hidden', 'true'); ring.append(node('span', '', '●'))
  challengeBox.append(beatLabel, ring, progress)
  if (run.kind === 'listening') {
    const records = node('div', 'last-crate-records')
    for (const record of config().listeningRecords) {
      const sleeve = button(record.title, () => startChallenge(record.id), 'last-crate-sleeve')
      sleeve.style.setProperty('--sleeve', record.color); sleeve.append(node('small', '', record.artist)); records.append(sleeve)
    }
    challengeBox.append(records)
  } else {
    const start = button('Start the set', () => { startChallenge(); start.remove(); hit.classList.remove('hidden'); hit.focus() })
    start.dataset.storyStart = ''
    const hit = button('HIT', () => advanceChallenge(true), 'last-crate-hit hidden'); hit.dataset.storyHit = ''
    // Space is handled by the panel once; native keyboard activation must not add a second pulse.
    hit.addEventListener('keyup', (event) => { if (event.code === 'Space') event.preventDefault() })
    challengeBox.append(start, hit)
  }
}

function startChallenge(record) {
  const result = transitionStory(story, { kind: 'start-challenge', record }, config())
  story = result.state
  if (!story.challenge?.started) return
  const track = config().listeningRecords.find((item) => item.id === record)
  state.storyPlayingMusic = true
  state.storyMusic = { station: track?.station || 'KFLP', bpm: story.challenge.bpm || data.radio.stations.find((station) => station.id === track?.station)?.bpm || 96 }
  lastClock = performance.now(); lastBeat = -1
  requestMusicFocus(); void unlockAudio()
  if (track) { showReply(`${track.title} — ${track.artist}. An original synthesized side for this room.`); challengeBox.querySelectorAll('.last-crate-sleeve').forEach((item) => { item.disabled = true }) }
  resetInput()
}
function stopMusic() { state.storyPlayingMusic = false; state.storyMusic = null }
function advanceChallenge(pulse = false) {
  if (!story?.challenge?.started) return
  const now = performance.now(); const elapsed = Math.max(0, (now - lastClock) / 1000); lastClock = now
  if (document.hidden) return
  const before = story.challenge
  const result = stepStoryChallenge(story, elapsed, pulse, config()); story = result.state
  if (pulse) bus.emit('sfx', story.challenge && story.challenge.hits > before.hits ? 'pickup' : 'ui-blip')
  if (result.failed || result.complete) {
    stopMusic(); showReply(result.reply); renderChallenge(); renderChoices(); refreshTargets(); checkpoint()
    return
  }
  const run = story.challenge
  if (!run) return
  progress.value = run.kind === 'listening' ? run.elapsed : run.next
  const interval = 60 / (run.bpm || state.storyMusic?.bpm || 96)
  const phase = run.elapsed / interval % 1
  ring.style.setProperty('--beat-scale', String(0.45 + phase * 0.55))
  ring.classList.toggle('on-beat', phase > 0.78 || phase < 0.15)
  const beat = Math.floor(run.elapsed / interval)
  if (beat !== lastBeat) { lastBeat = beat; if (run.kind !== 'listening') bus.emit('sfx', 'beat-flash') }
  beatLabel.textContent = run.kind === 'listening' ? `${Math.max(0, Math.ceil(run.seconds - run.elapsed))} seconds left on this side` : `${run.hits} hits · ${run.misses}/${run.missCap} misses · Beat ${Math.min(run.next + 1, run.beats)}/${run.beats}`
}

export function isStoryOpen() { return opened }
export function isStoryPerforming() { return Boolean(opened && story?.challenge?.started) }
export function storySnapshot() { return structuredClone(story || createStoryState(config())) }
export function restoreStory(saved) {
  const result = validateStoryState(saved, config())
  if (!result.ok) return result
  if (opened) closeStory({ saveCheckpoint: false })
  story = result.state; refreshTargets()
  return { ok: true }
}
export function openStory(target = { id: 'owner' }) {
  if (!deps || opened || state.mode === 'vehicle' || state.interior || state.mission.active) return false
  currentTarget = target
  const available = target.id === 'owner' ? distance(config().owner.at) <= config().owner.radius : storyTargets(story, config()).some((item) => item.id === target.id && distance(item.at) <= item.radius)
  if (!available) return false
  previousFocus = document.activeElement; opened = true; termsOpen = false
  resetInput(); deps.onOpen?.(); panel.classList.remove('hidden')
  apply({ kind: target.id === 'owner' ? 'visit-owner' : target.kind === 'pickup' ? 'pickup' : 'interact', id: target.id })
  if (!story.challenge) entry.focus({ preventScroll: true })
  else challengeBox.querySelector('button')?.focus({ preventScroll: true })
  return true
}
export function closeStory({ saveCheckpoint = true } = {}) {
  if (!opened) return
  if (story.challenge) { story = transitionStory(story, { kind: 'cancel-challenge' }, config()).state; if (saveCheckpoint) checkpoint() }
  opened = false; stopMusic(); panel.classList.add('hidden'); challengeBox.classList.add('hidden'); resetInput(); deps?.onClose?.()
  if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true })
}
export function storyContext() {
  if (!story || opened || state.interior || state.mission.active || state.mode === 'vehicle') return null
  const targets = [...storyTargets(story, config()), { ...config().owner, id: 'owner', title: 'Talk to the record shop owner', action: 'Talk to the record shop owner' }]
  const target = targets.filter((item) => distance(item.at) <= item.radius).sort((a, b) => distance(a.at) - distance(b.at))[0]
  if (!target) return null
  return { x: target.at.x, z: target.at.z, radius: target.radius, label: target.kind === 'pickup' ? 'COLLECT' : 'TALK', prompt: target.action || target.title, kind: 'story', target, key: 'E' }
}
export function focusStory() {
  if (!story || state.mission.active) return false
  if (storySettled(story)) { setWaypoint(null); setObjective('LAST CRATE COMPLETE · EXPLORE BROOKLYN'); return false }
  const targets = storyTargets(story, config())
  const target = targets.sort((a, b) => distance(a.at) - distance(b.at))[0]
  if (target) { setWaypoint(target.at, target.title); setObjective('LAST CRATE · ' + target.title) }
  else { setWaypoint(config().owner.at, 'THE RECORD SHOP · LAST CRATE'); setObjective(story.branch ? 'LAST CRATE · Check in with the record shop owner' : 'LAST CRATE · Talk to the record shop owner') }
  return true
}
function refreshTargets() {
  for (const visual of visuals) { visual.removeFromParent(); visual.traverse((item) => { item.geometry?.dispose(); if (item.userData.storyMaterial) item.material?.dispose() }) }
  visuals = []
  if (!deps?.scene || !story) return
  for (const target of [...storyTargets(story, config()), { ...config().owner, id: 'owner' }]) {
    const group = new THREE.Group(); group.position.set(target.at.x, 0.13, target.at.z); group.name = 'last-crate:' + target.id
    const marker = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.38, 32), new THREE.MeshBasicMaterial({ color: target.id === 'owner' ? 0xffd080 : 0x72e8bb, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false }))
    marker.rotation.x = -Math.PI / 2; marker.userData.storyMaterial = true; group.add(marker)
    if (target.kind === 'pickup') {
      const prop = makePropObject(deps.atlas, data.props, 'record-crate', deps.materials, data.blocks.vertexLighting)
      if (prop) { prop.position.y = 0.12; group.add(prop) }
    }
    deps.scene.add(group); visuals.push(group)
  }
  if (story.branch && !state.mission.active) focusStory()
}
export function updateStory(dt) {
  if (!story) return
  if (!state.paused && owner) animatePed(owner, data.npcs, 'idle', dt, 0)
  if (opened && story.challenge?.started) advanceChallenge()
  if (!state.paused && !state.mission.active && !opened && !state.interior && state.mode !== 'vehicle') {
    const pickup = storyTargets(story, config()).find((item) => item.kind === 'pickup' && distance(item.at) <= item.radius)
    if (pickup) { const result = apply({ kind: 'pickup', id: pickup.id }); toast(result.reply); bus.emit('sfx', 'pickup') }
  }
}
