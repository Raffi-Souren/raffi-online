/**
 * RAFFI WORLD — street life at runtime: the wallet, skills that level with
 * use, sprint stamina, coffee carts and texts. The profile is saved under
 * LIFE_KEY in localStorage, apart from the save slots, so it follows the
 * player the way found tapes do. Rules are in life-core.js.
 */

import { state, data, bus } from '../engine/state.js'
import { toast } from './hud.js'
import {
  LIFE_KEY, SKILLS, addCash, addXp, canSprint, createStamina, emptyProfile, levels, readProfile, receiveTexts,
  skillLevel, skillProgress, spend, stepStamina, textsFor, unreadTexts,
} from './life-core.js'

let profile = emptyProfile()
let stamina = createStamina()
let wiredUntil = -Infinity
let carts = []
let els = {}
let dirty = false, savedAt = 0
let cashMilestone = 0
/** Texts wait their turn so a new one never talks over the toast that caused it. */
const TEXT_GAP = 6
let textQueue = []
let nextTextAt = 0
let welcomed = false
const carry = { legs: 0, wheels: 0, board: 0 }
/** Called with a new text so the phone can badge itself. */
let onText = () => {}

const config = () => data.life
const thresholds = () => config().skills.thresholds
const storage = () => { try { return globalThis.localStorage } catch { return null } }
const catalog = () => ({ gigs: config().gigs, texts: config().texts, tapeIds: (data.tapes?.tapes || []).map((tape) => tape.id) })

export function initLife({ collision, textArrived } = {}) {
  let stored = null
  try { stored = storage()?.getItem(LIFE_KEY) ?? null } catch {}
  profile = stored ? readProfile(stored, catalog()) : emptyProfile()
  stamina = createStamina()
  onText = textArrived || onText
  carts = (collision?.all || []).filter((collider) => collider.tag === 'food-cart').map((collider) => ({ x: collider.x, z: collider.z }))
  state.coffeeCarts = carts
  els = { wallet: document.getElementById('wallet'), stamina: document.getElementById('stamina'), fill: document.querySelector('#stamina i') }
  cashMilestone = profile.cash
  paint()
  welcomed = profile.texts.includes('welcome')
  textQueue = []
  onText(unreadTexts(profile).length)
  bus.on('kickflip', () => gainSkill('board', config().skills.board.xpPerFlip))
  bus.on('tape-found', ({ count, total }) => {
    lifeEvent({ type: 'tape', count })
    if (count >= total) lifeEvent({ type: 'tape-all' })
  })
}

function save() {
  dirty = false
  savedAt = state.time
  try { storage()?.setItem(LIFE_KEY, JSON.stringify(profile)) } catch {}
}

function touch(now = false) {
  dirty = true
  if (now) save()
  paint()
}

function paint() {
  if (els.wallet) els.wallet.textContent = '$' + profile.cash.toLocaleString('en-US')
  if (els.stamina) {
    const wired = state.time < wiredUntil
    const show = state.mode === 'foot' && (stamina.value < 0.995 || wired)
    els.stamina.classList.toggle('show', show)
    els.stamina.dataset.state = stamina.winded ? 'winded' : wired ? 'wired' : 'ok'
    if (els.fill) els.fill.style.transform = `scaleX(${stamina.value.toFixed(3)})`
  }
}

// ------------------------------------------------------------- skills ---

/** Adds skill experience; a new level gets a toast and maybe a text. */
export function gainSkill(skill, amount) {
  const level = addXp(profile, skill, amount, thresholds())
  dirty = true
  if (!level) return
  const info = config().skills[skill]
  const perk = skill === 'legs' ? `sprint lasts ${config().stamina.sprintSeconds[level - 1]} s` : info.perk.toLowerCase()
  toast(`${info.name.toUpperCase()} ${level} · ${perk}`, 4)
  bus.emit('sfx', 'ui-confirm')
  lifeEvent({ type: 'level', skill, level })
  touch(true)
}

function travel(skill, metres) {
  const per = config().skills[skill].metresPerXp
  carry[skill] += metres
  if (carry[skill] < per) return
  const whole = Math.floor(carry[skill] / per)
  carry[skill] -= whole * per
  gainSkill(skill, whole)
}

/** One fixed step: stamina, and experience for whatever the player is doing. */
export function updateLife(dt, ride) {
  const p = state.player
  const onFoot = state.mode === 'foot'
  const walk = data.movement?.walkSpeed ?? 2.8
  const sprinting = onFoot && p.speed > walk + 0.6
  const wired = state.time < wiredUntil
  // A job keeps its authored timings: sprinting on a mission never drains.
  stepStamina(stamina, { sprinting, moving: p.speed > 0.3, wired: wired || !!state.mission.active }, dt, config().stamina.sprintSeconds[skillLevel(profile.xp.legs, thresholds()) - 1], config().stamina)
  // Running out, or getting your breath back, shows at once.
  if (p.sprintLocked !== !canSprint(stamina)) { p.sprintLocked = !canSprint(stamina); paint() }
  p.stamina = stamina.value
  // A teleport or a subway ride is not exercise: ignore impossible steps.
  const metres = p.speed * dt
  if (metres > 0 && metres < 3) {
    if (sprinting) travel('legs', metres)
    else if (!onFoot && ride === 'skateboard') travel('board', metres)
    else if (!onFoot && ride === 'car') travel('wheels', metres)
  }
  // The first text arrives once the player has had the street to themselves for a bit.
  if (!welcomed && state.time > 45 && !state.mission.active) { welcomed = true; lifeEvent({ type: 'start' }) }
  if (textQueue.length && state.time >= nextTextAt) {
    const text = textQueue.shift()
    nextTextAt = state.time + TEXT_GAP
    toast(`TEXT · ${text.from}: ${text.body.length > 64 ? text.body.slice(0, 62) + '…' : text.body}`, 5)
    bus.emit('sfx', 'ui-confirm')
  }
  if (state.frame % 6 === 0) paint()
  if (dirty && Math.abs(state.time - savedAt) > 5) save()
}

/** A loaded save moves the clock: timers stamped before it no longer mean anything. */
export function resetLifeClock() {
  wiredUntil = -Infinity
  savedAt = state.time
  nextTextAt = state.time + TEXT_GAP
  stamina = createStamina()
  paint()
}

// --------------------------------------------------------------- cash ---

export function earn(amount, { quiet = false } = {}) {
  const gain = addCash(profile, amount)
  if (gain && !quiet) bus.emit('sfx', 'pickup')
  if (profile.cash >= 500 && cashMilestone < 500) lifeEvent({ type: 'cash', value: profile.cash })
  cashMilestone = Math.max(cashMilestone, profile.cash)
  touch(true)
  return gain
}

/** Pays `cost` if the wallet covers it; says how much is missing if not. */
export function pay(cost, what) {
  if (spend(profile, cost)) { touch(true); return true }
  toast(`${what} is $${cost}. You’re $${cost - profile.cash} short · Gigs on your phone pay.`, 4)
  bus.emit('sfx', 'ui-deny')
  return false
}

// ------------------------------------------------------------- coffee ---

/** The context action at a food cart, on foot. */
export function coffeeContext() {
  if (state.mode !== 'foot' || state.interior) return null
  const radius = config().coffee.radius
  let best = null, bestDistance = radius
  for (const cart of carts) {
    const distance = Math.hypot(cart.x - state.player.x, cart.z - state.player.z)
    if (distance <= bestDistance) { best = cart; bestDistance = distance }
  }
  return best && { x: best.x, z: best.z, radius, kind: 'coffee', key: 'E', label: 'COFFEE', prompt: `COFFEE · $${config().prices.coffee}`, target: best }
}

export function buyCoffee() {
  if (!pay(config().prices.coffee, 'Coffee')) return false
  stamina.value = 1
  stamina.winded = false
  wiredUntil = state.time + config().coffee.wiredSeconds
  profile.coffees++
  toast(`COFFEE · sprint is free for ${config().coffee.wiredSeconds} s`, 3.5)
  bus.emit('sfx', 'pickup')
  lifeEvent({ type: 'coffee', count: profile.coffees })
  touch(true)
  return true
}

// -------------------------------------------------------------- texts ---

/** Something happened that a contact might text about. */
export function lifeEvent(event) {
  const due = textsFor(event, profile.texts, config().texts)
  if (!due.length) return []
  receiveTexts(profile, due.map((text) => text.id))
  textQueue.push(...due)
  nextTextAt = Math.max(nextTextAt, state.time + TEXT_GAP)
  onText(unreadTexts(profile).length)
  touch(true)
  return due
}

/** Texts newest first, for the phone. */
export function textThread() {
  const byId = new Map(config().texts.map((text) => [text.id, text]))
  const unread = new Set(unreadTexts(profile))
  return [...profile.texts].reverse().map((id) => ({ ...byId.get(id), unread: unread.has(id) }))
}

export function markTextsRead() {
  if (!unreadTexts(profile).length) return
  profile.read = [...profile.texts]
  onText(0)
  touch(true)
}

// ------------------------------------------------------------ records ---

export const lifeProfile = () => profile
export const lifeLevels = () => levels(profile, thresholds())
export function markDirty() { touch(true) }

/** A photo was taken with the phone's camera. */
export function notePhoto() {
  profile.photos++
  lifeEvent({ type: 'photo', count: profile.photos })
  touch(true)
}

/** Remembers that a tape tip was bought, so the same tape is never sold twice. */
export function noteTapeTip(id) {
  if (!profile.tips.includes(id)) profile.tips.push(id)
  touch(true)
}

/** Read-only, for the phone, the desktop and smokes. */
export function lifeSnapshot() {
  const wired = Math.max(0, wiredUntil - state.time)
  return {
    key: LIFE_KEY,
    cash: profile.cash,
    earned: profile.earned,
    coffees: profile.coffees,
    photos: profile.photos,
    stamina: { value: stamina.value, winded: stamina.winded, wired },
    skills: Object.fromEntries(SKILLS.map((skill) => [skill, { xp: profile.xp[skill], ...skillProgress(profile.xp[skill], thresholds()) }])),
    gigs: structuredClone(profile.gigs),
    texts: profile.texts.length,
    unread: unreadTexts(profile).length,
    tips: [...profile.tips],
    carts: carts.length,
  }
}
