/**
 * RAFFI WORLD — street life, pure rules: cash, four skills that grow with
 * use, sprint stamina, side-gig runs and the texts they trigger. Tuning and
 * content live in data/life.json. No browser, storage or scene effects here.
 */

export const LIFE_KEY = 'raffi-world:life:v1'
export const LIFE_VERSION = 1
export const SKILLS = ['legs', 'wheels', 'board', 'hustle']
export const MAX_CASH = 999_999
const MAX_XP = 99_999

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const whole = (value, max) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0)
const strings = (value, allowed, max) => (Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string' && allowed.has(id)))].slice(-max) : [])

export function emptyProfile() {
  return { version: LIFE_VERSION, cash: 0, earned: 0, xp: { legs: 0, wheels: 0, board: 0, hustle: 0 }, gigs: {}, texts: [], read: [], tips: [], coffees: 0, photos: 0 }
}

/**
 * A saved profile, keeping only what the current data can vouch for. Bad JSON,
 * a foreign shape or an unknown version reads as a fresh profile; unknown gig,
 * text and tape ids are dropped and every number is clamped.
 */
export function readProfile(source, catalog) {
  let value = source
  if (typeof source === 'string') {
    if (source.length > 16_384) return emptyProfile()
    try { value = JSON.parse(source) } catch { return emptyProfile() }
  }
  if (!object(value) || value.version !== LIFE_VERSION) return emptyProfile()
  const profile = emptyProfile()
  profile.cash = whole(value.cash, MAX_CASH)
  profile.earned = Math.max(profile.cash, whole(value.earned, 99_999_999))
  profile.coffees = whole(value.coffees, 99_999)
  profile.photos = whole(value.photos, 99_999)
  if (object(value.xp)) for (const skill of SKILLS) profile.xp[skill] = whole(value.xp[skill], MAX_XP)
  const gigIds = new Set((catalog.gigs || []).map((gig) => gig.id))
  if (object(value.gigs)) {
    for (const id of Object.keys(value.gigs)) {
      const record = value.gigs[id]
      if (!gigIds.has(id) || !object(record)) continue
      const runs = whole(record.runs, 99_999)
      const best = typeof record.best === 'number' && Number.isFinite(record.best) && record.best > 0 ? Math.round(record.best * 10) / 10 : null
      profile.gigs[id] = { runs, wins: Math.min(runs, whole(record.wins, 99_999)), best }
    }
  }
  const textIds = new Set((catalog.texts || []).map((text) => text.id))
  profile.texts = strings(value.texts, textIds, 80)
  profile.read = strings(value.read, new Set(profile.texts), 80)
  profile.tips = strings(value.tips, new Set(catalog.tapeIds || []), 200)
  return profile
}

// ------------------------------------------------------------- skills ---

/** Level 1–5 from experience, by the thresholds in life.json. */
export function skillLevel(xp, thresholds) {
  let level = 1
  for (let index = 1; index < thresholds.length; index++) if (xp >= thresholds[index]) level = index + 1
  return level
}

/** Where a skill stands inside its current level, for a progress bar. */
export function skillProgress(xp, thresholds) {
  const level = skillLevel(xp, thresholds)
  const floor = thresholds[level - 1]
  const next = thresholds[level] ?? null
  return { level, max: next === null, fraction: next === null ? 1 : Math.max(0, Math.min(1, (xp - floor) / (next - floor))), toNext: next === null ? 0 : Math.ceil(next - xp) }
}

/** Adds experience. Returns the new level when this crossed a threshold, else null. */
export function addXp(profile, skill, amount, thresholds) {
  if (!SKILLS.includes(skill) || !(amount > 0)) return null
  const before = skillLevel(profile.xp[skill], thresholds)
  profile.xp[skill] = Math.min(MAX_XP, profile.xp[skill] + amount)
  const after = skillLevel(profile.xp[skill], thresholds)
  return after > before ? after : null
}

export function levels(profile, thresholds) {
  return Object.fromEntries(SKILLS.map((skill) => [skill, skillLevel(profile.xp[skill], thresholds)]))
}

// --------------------------------------------------------------- cash ---

export function addCash(profile, amount) {
  const gain = whole(amount, MAX_CASH)
  profile.cash = Math.min(MAX_CASH, profile.cash + gain)
  profile.earned = Math.min(99_999_999, profile.earned + gain)
  return gain
}

/** Pays if the wallet covers it. Never goes negative. */
export function spend(profile, cost) {
  const price = whole(cost, MAX_CASH)
  if (profile.cash < price) return false
  profile.cash -= price
  return true
}

// ------------------------------------------------------------ stamina ---

export function createStamina() {
  return { value: 1, winded: false, idle: 0 }
}

/**
 * One fixed step of sprint stamina. Sprinting drains it over `seconds`; it
 * comes back after a short rest, faster standing still. Empty means winded:
 * no sprint until it has recovered to `windedUntil`. `wired` (a coffee) stops
 * the drain.
 */
export function stepStamina(stamina, { sprinting = false, moving = false, wired = false } = {}, dt, seconds, tuning) {
  if (!(dt > 0)) return stamina
  if (sprinting && !stamina.winded) {
    stamina.idle = 0
    if (!wired) stamina.value = Math.max(0, stamina.value - dt / seconds)
    if (stamina.value <= 0) stamina.winded = true
    return stamina
  }
  stamina.idle += dt
  if (stamina.idle >= tuning.regenDelay) {
    stamina.value = Math.min(1, stamina.value + (dt / tuning.regenSeconds) * (moving ? 1 : tuning.restBoost))
  }
  if (stamina.winded && stamina.value >= tuning.windedUntil) stamina.winded = false
  return stamina
}

export const canSprint = (stamina) => !stamina.winded && stamina.value > 0

// --------------------------------------------------------------- gigs ---

/** A gig is open once Hustle reaches its level. */
export function gigUnlocked(gig, hustleLevel) {
  return hustleLevel >= (gig.hustle || 1)
}

/**
 * Starts a run. A hunt hides its one target at the next spot in rotation, so
 * replaying the gig moves the set somewhere new.
 */
export function createGigRun(gig, attempt = 0) {
  const stops = gig.kind === 'hunt' ? [gig.spots[((attempt % gig.spots.length) + gig.spots.length) % gig.spots.length]] : gig.stops
  return { id: gig.id, kind: gig.kind, stops, step: 0, elapsed: 0, limit: gig.seconds, flips: 0, offRide: 0, status: 'running' }
}

/**
 * One fixed step of a run. `here` is where the player is and what they are
 * riding. Returns the run; `status` becomes 'done', 'timeout' or 'off-ride'.
 */
export function stepGigRun(run, gig, here, dt) {
  if (run.status !== 'running' || !(dt > 0)) return run
  run.elapsed += dt
  if (gig.ride) {
    run.offRide = here.ride === gig.ride ? 0 : run.offRide + dt
    if (run.offRide >= (gig.offRideSeconds || 5)) { run.status = 'off-ride'; return run }
  }
  const stop = run.stops[run.step]
  const onRide = !gig.ride || here.ride === gig.ride
  if (stop && onRide && Math.hypot(here.x - stop.x, here.z - stop.z) <= (stop.radius || gig.radius || 5)) run.step++
  if (run.step >= run.stops.length) run.status = 'done'
  else if (run.elapsed >= run.limit) run.status = 'timeout'
  return run
}

/** Signal bars (0–5) for a hunt: how close the hidden set is. */
export function gigSignal(distance, reach = 260) {
  if (!(distance >= 0)) return 0
  return Math.max(0, Math.min(5, Math.ceil((1 - distance / reach) * 5)))
}

/** What a finished run pays: base, seconds left, tricks, then the skill bonus. */
export function gigPay(gig, run, skillLevels, tuning) {
  if (run.status !== 'done') return 0
  const left = Math.max(0, run.limit - run.elapsed)
  const time = Math.min(gig.pay.timeCap || 0, left * (gig.pay.perSecond || 0))
  const tricks = Math.min(gig.pay.flipCap || 0, run.flips * (gig.pay.perFlip || 0))
  const level = skillLevels[gig.skill] || 1
  return Math.round((gig.pay.base + time + tricks) * (1 + (level - 1) * tuning.payPerLevel))
}

/** Records a finished run on the profile. Returns { pay, best: true when it beat the old time }. */
export function recordGig(profile, gig, run, pay) {
  const record = profile.gigs[gig.id] || { runs: 0, wins: 0, best: null }
  record.runs++
  let best = false
  if (run.status === 'done') {
    record.wins++
    const seconds = Math.round(run.elapsed * 10) / 10
    if (record.best === null || seconds < record.best) { best = record.best !== null; record.best = seconds }
    addCash(profile, pay)
  }
  profile.gigs[gig.id] = record
  return { pay: run.status === 'done' ? pay : 0, best }
}

// -------------------------------------------------------------- texts ---

/**
 * Texts an event sets off that have not been sent yet. `when` matches on the
 * event type, exact `id`/`skill`/`result`, and `count`/`level`/`atLeast` as
 * "reached at least this", so a milestone skipped past still arrives.
 */
export function textsFor(event, sent, texts) {
  const already = new Set(sent)
  return texts.filter((text) => {
    const when = text.when
    if (already.has(text.id) || !when || when.event !== event.type) return false
    for (const key of ['id', 'skill', 'result']) if (when[key] !== undefined && when[key] !== event[key]) return false
    for (const key of ['count', 'level', 'atLeast']) if (when[key] !== undefined && !((event[key === 'atLeast' ? 'value' : key] ?? -Infinity) >= when[key])) return false
    return true
  })
}

/** Marks texts received, oldest first, capped so the profile stays small. */
export function receiveTexts(profile, ids) {
  for (const id of ids) if (!profile.texts.includes(id)) profile.texts.push(id)
  profile.texts = profile.texts.slice(-80)
  profile.read = profile.read.filter((id) => profile.texts.includes(id))
  return profile.texts
}

export const unreadTexts = (profile) => profile.texts.filter((id) => !profile.read.includes(id))
