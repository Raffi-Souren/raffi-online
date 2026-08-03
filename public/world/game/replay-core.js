/**
 * RAFFI WORLD — pure replay math: ring buffers, alignment, DAR / TAR.
 *
 * DAR = Decision Agreement Rate among aligned decision samples.
 * TAR = Trajectory Agreement Rate among aligned transform samples
 *       (within pathAgreementRadius metres).
 *
 * Never invents default percentages. Empty/incomplete streams → null metrics.
 */

/** @typedef {{ t: number, actorId: string, verb: string, target?: string }} DecisionSample */
/** @typedef {{ t: number, actorId: string, x: number, z: number, yaw: number }} TransformSample */
/** @typedef {{ decisions: DecisionSample[], transforms: TransformSample[] }} RunStream */

/**
 * Bounded ring buffer. Overwrites oldest when full.
 * Capacity is max entries, not seconds (caller sizes by sampleHz * bufferSeconds).
 */
export class RingBuffer {
  constructor(capacity) {
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new Error('RingBuffer capacity must be >= 1')
    }
    this.capacity = Math.floor(capacity)
    this._buf = new Array(this.capacity)
    this._start = 0
    this._size = 0
  }

  get size() { return this._size }

  clear() {
    this._start = 0
    this._size = 0
  }

  push(item) {
    if (this._size < this.capacity) {
      const i = (this._start + this._size) % this.capacity
      this._buf[i] = item
      this._size++
    } else {
      this._buf[this._start] = item
      this._start = (this._start + 1) % this.capacity
    }
  }

  /** Oldest → newest. */
  toArray() {
    const out = []
    for (let i = 0; i < this._size; i++) {
      out.push(this._buf[(this._start + i) % this.capacity])
    }
    return out
  }
}

/**
 * Capacity for transform samples given config.
 * @param {{ bufferSeconds: number, sampleHz: number }} cfg
 */
export function transformCapacity(cfg) {
  return Math.max(1, Math.ceil(cfg.bufferSeconds * cfg.sampleHz))
}

/**
 * Capacity for decision samples (one per reconsider roughly — generous).
 * @param {{ bufferSeconds: number, sampleHz: number }} cfg
 */
export function decisionCapacity(cfg) {
  // At most one decision per sample tick per actor is rare; size by wall time
  // at sampleHz * 2 for headroom without unbounded growth.
  return Math.max(1, Math.ceil(cfg.bufferSeconds * cfg.sampleHz * 2))
}

/**
 * Align decision streams by (actorId, nearest t within window).
 * @param {DecisionSample[]} a
 * @param {DecisionSample[]} b
 * @param {number} windowSec
 * @returns {{ matched: number, compared: number, agreement: number|null }}
 */
export function computeDAR(a, b, windowSec) {
  if (!a?.length || !b?.length) {
    return { matched: 0, compared: 0, agreement: null }
  }
  const byActor = groupBy(b, (s) => s.actorId)
  let compared = 0
  let matched = 0

  for (const sa of a) {
    const list = byActor.get(sa.actorId)
    if (!list || !list.length) continue // missing peer: do not inflate
    const peer = nearestByTime(list, sa.t, windowSec)
    if (!peer) continue
    compared++
    if (sa.verb === peer.verb) matched++
  }

  if (compared === 0) return { matched: 0, compared: 0, agreement: null }
  return {
    matched,
    compared,
    agreement: matched / compared,
  }
}

/**
 * Align transforms by (actorId, nearest t within 1/sampleHz).
 * @param {TransformSample[]} a
 * @param {TransformSample[]} b
 * @param {number} radius metres
 * @param {number} [windowSec]
 * @returns {{ matched: number, compared: number, agreement: number|null }}
 */
export function computeTAR(a, b, radius, windowSec = 0.15) {
  if (!a?.length || !b?.length) {
    return { matched: 0, compared: 0, agreement: null }
  }
  if (!Number.isFinite(radius) || radius < 0) {
    throw new Error('pathAgreementRadius must be a non-negative number')
  }
  const byActor = groupBy(b, (s) => s.actorId)
  let compared = 0
  let matched = 0
  const r2 = radius * radius

  for (const sa of a) {
    const list = byActor.get(sa.actorId)
    if (!list || !list.length) continue
    const peer = nearestByTime(list, sa.t, windowSec)
    if (!peer) continue
    compared++
    const dx = sa.x - peer.x
    const dz = sa.z - peer.z
    if (dx * dx + dz * dz <= r2) matched++
  }

  if (compared === 0) return { matched: 0, compared: 0, agreement: null }
  return {
    matched,
    compared,
    agreement: matched / compared,
  }
}

/**
 * Percent 0–100 rounded for HUD, or null when unavailable.
 * @param {number|null|undefined} agreement 0..1
 */
export function agreementPercent(agreement) {
  if (agreement == null || !Number.isFinite(agreement)) return null
  const p = Math.round(Math.min(1, Math.max(0, agreement)) * 100)
  return p
}

/**
 * Format for HUD: "--%" when unavailable.
 * @param {number|null} percent
 */
export function formatAgreement(percent) {
  if (percent == null || !Number.isFinite(percent)) return '--%'
  return percent + '%'
}

/**
 * Live metrics from two run streams.
 * @param {RunStream} runA
 * @param {RunStream} runB
 * @param {{ decisionMatchWindow: number, pathAgreementRadius: number, sampleHz: number }} cfg
 */
export function computeLiveMetrics(runA, runB, cfg) {
  const windowSec = cfg.decisionMatchWindow ?? 1.5
  const radius = cfg.pathAgreementRadius ?? 2.5
  const sampleWindow = 1 / Math.max(1, cfg.sampleHz || 10)

  const dar = computeDAR(runA?.decisions || [], runB?.decisions || [], windowSec)
  const tar = computeTAR(runA?.transforms || [], runB?.transforms || [], radius, sampleWindow * 1.5)

  return {
    dar,
    tar,
    darPercent: agreementPercent(dar.agreement),
    tarPercent: agreementPercent(tar.agreement),
    ready: dar.agreement != null && tar.agreement != null,
  }
}

/**
 * Snapshot a run stream from buffers (deep copy samples).
 * @param {RingBuffer} decisionBuf
 * @param {RingBuffer} transformBuf
 * @returns {RunStream}
 */
export function snapshotRun(decisionBuf, transformBuf) {
  return {
    decisions: decisionBuf.toArray().map((s) => ({ ...s })),
    transforms: transformBuf.toArray().map((s) => ({ ...s })),
  }
}

/**
 * Sample transform if enough time has elapsed.
 * @returns {boolean} whether a sample was taken
 */
export function shouldSampleTransform(lastSampleT, now, sampleHz) {
  const dt = 1 / Math.max(1e-6, sampleHz)
  return lastSampleT == null || now - lastSampleT >= dt - 1e-9
}

/**
 * Weighted pick with deterministic RNG. Equal top weights: caller may break
 * ties via non-seeded path (documented frame-order / Math.random).
 * @param {Record<string, number>} weights
 * @param {() => number} rng 0..1
 * @returns {string|null}
 */
export function pickWeighted(weights, rng) {
  const entries = Object.entries(weights || {}).filter(([, w]) => w > 0)
  if (!entries.length) return null
  let sum = 0
  for (const [, w] of entries) sum += w
  let r = rng() * sum
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[entries.length - 1][0]
}

/**
 * Among keys with max score, pick one. If multiple, use tieBreak() for honest
 * non-determinism across runs (pathfinding tie-breaks).
 * @param {Record<string, number>} scores
 * @param {() => number} [tieBreak] 0..1, only consulted on ties
 */
export function pickBestScore(scores, tieBreak) {
  const entries = Object.entries(scores || {})
  if (!entries.length) return null
  let best = -Infinity
  for (const [, s] of entries) if (s > best) best = s
  const tops = entries.filter(([, s]) => s === best).map(([k]) => k)
  if (tops.length === 1) return tops[0]
  if (typeof tieBreak === 'function') {
    const i = Math.floor(tieBreak() * tops.length) % tops.length
    return tops[i]
  }
  // Deterministic fallback: lexicographic (tests only)
  tops.sort()
  return tops[0]
}

/** Mulberry32 — deterministic decisions when desired. */
export function makeSeededRng(seed) {
  let a = (seed >>> 0) || 1
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function groupBy(list, keyFn) {
  const m = new Map()
  for (const item of list) {
    const k = keyFn(item)
    let arr = m.get(k)
    if (!arr) { arr = []; m.set(k, arr) }
    arr.push(item)
  }
  for (const arr of m.values()) arr.sort((a, b) => a.t - b.t)
  return m
}

function nearestByTime(sortedList, t, windowSec) {
  let best = null
  let bestD = Infinity
  for (const s of sortedList) {
    const d = Math.abs(s.t - t)
    if (d < bestD) {
      bestD = d
      best = s
    }
    // list is sorted; once past t+window we can stop if we only search forward
    // but we need full scan for nearest — OK for unit tests / small buffers
  }
  if (best == null || bestD > windowSec) return null
  return best
}
