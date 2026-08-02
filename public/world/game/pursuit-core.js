/**
 * Pure COMPLIANCE pursuit rules. Runtime pooling / meshes live in pursuit.js.
 * Every tier count, speed, radius, and hold time is compiled from data.
 */

/**
 * Compile the active pursuer roster for a compliance tier from npcs.json.
 * @returns {Array<{
 *   key: string,
 *   tier: number,
 *   label: string,
 *   kind: 'drone'|'foot'|'vehicle',
 *   behaviour: string,
 *   speed: number,
 *   interceptRadius: number,
 *   canCatch: boolean,
 *   hoverY?: number,
 *   archetype?: string,
 *   vehicle?: string,
 *   lines: string[],
 * }>}
 */
export function compilePursuitRoster(npcData, tier) {
  const t = Math.max(0, Math.floor(Number(tier) || 0))
  if (t <= 0) return []
  const pursuers = npcData?.pursuers || {}
  const roster = []

  for (const [key, def] of Object.entries(pursuers)) {
    if (!def || def.tier !== t) continue
    if (def.kind === 'mixed') {
      const carCount = Math.max(0, Math.floor(Number(def.count) || 0))
      for (let i = 0; i < carCount; i++) {
        roster.push(slotFromDef(key + ':car:' + i, def, {
          kind: 'vehicle',
          behaviour: def.behaviour || 'block-intersections',
          vehicle: def.vehicle,
        }))
      }
      const drones = Math.max(0, Math.floor(Number(def.drones) || 0))
      for (let i = 0; i < drones; i++) {
        const droneDef = pursuers['notification-drone'] || {
          kind: 'drone',
          speed: def.speed || 4,
          hoverY: 5.5,
          interceptRadius: 0,
          behaviour: 'follow-only',
          lines: def.lines || [],
          label: def.label,
          tier: def.tier,
        }
        roster.push(slotFromDef(key + ':drone:' + i, droneDef, {
          kind: 'drone',
          behaviour: 'follow-only',
          canCatch: false,
        }))
      }
      continue
    }

    const count = Math.max(1, Math.floor(Number(def.count) || 1))
    for (let i = 0; i < count; i++) {
      roster.push(slotFromDef(key + ':' + i, def, {}))
    }
  }

  return roster
}

function slotFromDef(key, def, overrides) {
  const kind = overrides.kind || def.kind
  const interceptRadius = Number(def.interceptRadius)
  const canCatch = overrides.canCatch !== undefined
    ? overrides.canCatch
    : (kind !== 'drone' && Number.isFinite(interceptRadius) && interceptRadius > 0)
  return {
    key,
    tier: def.tier,
    label: def.label || key,
    kind,
    behaviour: overrides.behaviour || def.behaviour || 'chase-foot',
    speed: Number(def.speed) || 0,
    interceptRadius: Number.isFinite(interceptRadius) ? interceptRadius : 0,
    canCatch: !!canCatch,
    hoverY: Number(def.hoverY) || 5.5,
    archetype: def.archetype || null,
    vehicle: overrides.vehicle || def.vehicle || null,
    lines: Array.isArray(def.lines) ? def.lines.slice() : [],
  }
}

export function complianceTuning(npcData) {
  const c = npcData?.compliance
  if (!c || typeof c !== 'object') {
    throw new Error('npcs.compliance tuning is required')
  }
  if (!Number.isFinite(c.caughtHoldSeconds) || c.caughtHoldSeconds <= 0) {
    throw new Error('npcs.compliance.caughtHoldSeconds must be > 0')
  }
  if (!Number.isFinite(c.decaySecondsPerTier) || c.decaySecondsPerTier <= 0) {
    throw new Error('npcs.compliance.decaySecondsPerTier must be > 0')
  }
  if (!Number.isFinite(c.decayRequiresNoContact) || c.decayRequiresNoContact < 0) {
    throw new Error('npcs.compliance.decayRequiresNoContact must be >= 0')
  }
  const spawn = c.spawnDistance || {}
  if (!Number.isFinite(spawn.min) || !Number.isFinite(spawn.max) || spawn.min <= 0 || spawn.max < spawn.min) {
    throw new Error('npcs.compliance.spawnDistance.{min,max} required with max >= min > 0')
  }
  return {
    caughtHoldSeconds: c.caughtHoldSeconds,
    decaySecondsPerTier: c.decaySecondsPerTier,
    decayRequiresNoContact: c.decayRequiresNoContact,
    repaintClearsAll: c.repaintClearsAll !== false,
    spawnDistance: { min: spawn.min, max: spawn.max },
    catchLines: ['caught-1', 'caught-2'],
  }
}

export function createContactTracker() {
  return { hold: 0, inContact: false, caught: false }
}

/**
 * Sustained-contact catch. Tier-1 / interceptRadius 0 never catch.
 * Breaking contact zeros the hold timer.
 */
export function stepContactTracker(tracker, {
  canCatch,
  distance,
  interceptRadius,
  dt,
  holdSeconds,
}) {
  if (!canCatch || !(interceptRadius > 0)) {
    return { hold: 0, inContact: false, caught: false }
  }
  const inRange = Number.isFinite(distance) && distance <= interceptRadius
  if (!inRange) {
    return { hold: 0, inContact: false, caught: false }
  }
  const hold = (tracker?.hold || 0) + Math.max(0, dt)
  return {
    hold,
    inContact: true,
    caught: hold >= holdSeconds,
  }
}

/**
 * No-contact tier decay. Requires continuous no-contact for decayRequiresNoContact
 * before decaySecondsPerTier starts burning tiers.
 */
export function stepNoContactDecay(state, {
  inContactWithAny,
  dt,
  decayRequiresNoContact,
  decaySecondsPerTier,
  tier,
}) {
  let noContact = state?.noContactSeconds || 0
  let decay = state?.decaySeconds || 0
  let nextTier = Math.max(0, Math.floor(Number(tier) || 0))

  if (inContactWithAny || nextTier <= 0) {
    return { noContactSeconds: 0, decaySeconds: 0, tier: nextTier, decayed: false }
  }

  noContact += Math.max(0, dt)
  if (noContact < decayRequiresNoContact) {
    return { noContactSeconds: noContact, decaySeconds: 0, tier: nextTier, decayed: false }
  }

  decay += Math.max(0, dt)
  let decayed = false
  while (decay >= decaySecondsPerTier && nextTier > 0) {
    decay -= decaySecondsPerTier
    nextTier -= 1
    decayed = true
  }
  return { noContactSeconds: noContact, decaySeconds: decay, tier: nextTier, decayed }
}

/** Evenly spaced approach angles for multi-unit box attempts. */
export function approachAngles(count, baseYaw = 0) {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return []
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(baseYaw + (i * Math.PI * 2) / n)
  }
  return out
}

/**
 * Pick a spawn point around the player within [min,max] distance on a
 * direction ring. Pure — caller must validate road / collision.
 */
export function spawnPointOnRing(playerX, playerZ, angle, distance) {
  return {
    x: playerX + Math.sin(angle) * distance,
    z: playerZ + Math.cos(angle) * distance,
    yaw: angle + Math.PI, // face toward player
  }
}

export function distance2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz)
}

/** Roster summary for snapshots / tests. */
export function rosterSummary(roster) {
  const kinds = { drone: 0, foot: 0, vehicle: 0 }
  for (const slot of roster) {
    if (kinds[slot.kind] !== undefined) kinds[slot.kind] += 1
  }
  return {
    total: roster.length,
    kinds,
    canCatch: roster.filter((s) => s.canCatch).length,
    behaviours: roster.map((s) => s.behaviour),
  }
}
