/**
 * RAFFI WORLD — polite physics for walking into people. Pure rules, no DOM.
 *
 * A bump is a player-to-pedestrian contact closing faster than 0.6 m/s. It
 * shoves and startles; it never hurts, knocks anyone to the ground, or adds
 * Heat (WORLD-BIBLE §2). Only deliberate actions raise Heat.
 */

export const BUMP_MIN_SPEED = 0.6
export const BUMP_COOLDOWN = 1.2
/** Share of the shove the pedestrian pushes back into the player. */
export const PLAYER_SHARE = 0.3

export const BUMP_TIERS = [
  // Walking pace: a shoulder brush. They turn to look and step aside.
  { tier: 1, name: 'brush', min: 0.6, max: 2.0, playerSlow: 0.15, stagger: 0, shove: [0.35, 0.45], duration: 0.35, look: 0.6, startle: 0, sfx: 'bump-brush', shake: 0 },
  // Jogging: a stumble with arms out and a word about it.
  { tier: 2, name: 'stumble', min: 2.0, max: 4.5, playerSlow: 0.35, stagger: 0.1, shove: [0.5, 0.9], duration: 0.35, look: 0.6, startle: 0, sfx: 'bump-thud', shake: 0.04 },
  // Sprinting: the knee-buckle stumble, a quick recover, and a short wary retreat.
  { tier: 3, name: 'buckle', min: 4.5, max: 8, playerSlow: 0.55, stagger: 0.2, shove: [0.8, 1.2], duration: 0.9, look: 0, startle: 1.5, sfx: 'bump-thud', shake: 0.12 },
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/** The reaction tier for a closing speed, or null below a bump. */
export function bumpTier(impact) {
  if (!(impact >= BUMP_MIN_SPEED)) return null
  return BUMP_TIERS.find((tier) => impact < tier.max) || BUMP_TIERS[BUMP_TIERS.length - 1]
}

/** One reaction per person per cooldown, so a held stick doesn't jitter them. */
export function canBump(lastAt, now, cooldown = BUMP_COOLDOWN) {
  return !Number.isFinite(lastAt) || now - lastAt >= cooldown
}

/**
 * Plans a bump reaction.
 * @param impact  closing speed along the contact normal, m/s
 * @param normal  unit {x, z} pointing from the pedestrian toward the player
 * @param now     seconds
 */
export function planBump(impact, normal, now) {
  const tier = bumpTier(impact)
  if (!tier) return null
  const along = clamp((impact - tier.min) / (tier.max - tier.min), 0, 1)
  const distance = tier.shove[0] + (tier.shove[1] - tier.shove[0]) * along
  return {
    tier: tier.tier,
    name: tier.name,
    start: now,
    duration: tier.duration,
    distance,
    // The pedestrian is pushed away from the player...
    dirX: -normal.x,
    dirZ: -normal.z,
    lookUntil: now + tier.look,
    startleUntil: tier.startle ? now + tier.startle : now,
    // ...and pushes back a bounded share, as velocity so momentum carries.
    playerKick: Math.min(1.5, impact * PLAYER_SHARE),
    playerSlow: tier.playerSlow,
    stagger: tier.stagger,
    sfx: tier.sfx,
    shake: tier.shake,
  }
}

/** Fraction of the shove completed at `now` (ease-out, 0..1). */
export function shoveFraction(plan, now) {
  const u = clamp((now - plan.start) / plan.duration, 0, 1)
  return 1 - (1 - u) ** 3
}
