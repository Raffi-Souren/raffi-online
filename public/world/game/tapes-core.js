/**
 * RAFFI WORLD — tape collectibles, pure rules. The found list lives in
 * localStorage under TAPES_KEY on the site's origin, so the Lab's Tape Shelf
 * reads the same list. Finding is idempotent and never locks a mix anywhere.
 */

export const TAPES_KEY = 'raffi:tapes-found'

/** The found tape ids, keeping only ids that exist (bad or foreign data is ignored). */
export function readFound(storage, validIds) {
  const valid = new Set(validIds)
  try {
    const parsed = JSON.parse(storage?.getItem(TAPES_KEY) || '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && valid.has(id)) : [])
  } catch {
    return new Set()
  }
}

export function writeFound(storage, found) {
  try { storage?.setItem(TAPES_KEY, JSON.stringify([...found])) } catch {}
}

/** Marks a tape found once. Returns whether this call added it, and the new count. */
export function collectTape(found, id, validIds) {
  if (!validIds.includes(id) || found.has(id)) return { added: false, count: found.size }
  found.add(id)
  return { added: true, count: found.size }
}

/** The nearest tape not yet found within `radius` of a point, or null. */
export function tapeInReach(tapes, found, x, z, radius) {
  let best = null, bestDistance = radius
  for (const tape of tapes) {
    if (found.has(tape.id)) continue
    const distance = Math.hypot(tape.at.x - x, tape.at.z - z)
    if (distance <= bestDistance) { best = tape; bestDistance = distance }
  }
  return best
}
