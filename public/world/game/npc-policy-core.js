/**
 * Pure NPC policy over the six tools from npcs.json.
 * Decisions are weight-driven; equal-score goal ties use tieBreak for
 * honest pathfinding non-determinism across runs (WORLD-BIBLE §8).
 */

import { pickWeighted, pickBestScore, makeSeededRng } from './replay-core.js'

export const VERBS = ['walk', 'enter', 'talk', 'buy', 'flee', 'idle']

/**
 * @param {object} arch  archetype from npcs.json
 * @param {object} ctx   { goals: {id, kind, x, z}[], threat: boolean, hour: number, actorId: string, decisionIndex: number, worldSeed: string }
 * @param {{ seeded?: boolean, tieBreak?: () => number }} [opts]
 * @returns {{ verb: string, target: string|null, goal: object|null }}
 */
export function decidePolicy(arch, ctx, opts = {}) {
  const policy = arch.policy || {}
  const tools = arch.tools || VERBS
  const toolWeights = { ...(policy.toolWeights || {}) }

  // Flee overrides when threatened.
  if (ctx.threat && tools.includes('flee')) {
    return { verb: 'flee', target: null, goal: null }
  }

  // Zero out tools the archetype doesn't have.
  for (const v of Object.keys(toolWeights)) {
    if (!tools.includes(v)) delete toolWeights[v]
  }

  const seedStr = String(ctx.worldSeed || '') + ':' + String(ctx.actorId) + ':' + String(ctx.decisionIndex || 0)
  const rng = opts.seeded === false
    ? Math.random
    : makeSeededRng(hashStr(seedStr))

  // Active hours gate (e.g. ravers).
  if (policy.activeHours && !hourInRange(ctx.hour, policy.activeHours[0], policy.activeHours[1])) {
    if (tools.includes('idle')) return { verb: 'idle', target: null, goal: null }
  }

  let verb = pickWeighted(toolWeights, rng) || 'idle'
  if (!tools.includes(verb)) verb = tools[0] || 'idle'

  // Goal scoring for walk/enter/buy.
  let goal = null
  let target = null
  if (verb === 'walk' || verb === 'enter' || verb === 'buy') {
    const scores = scoreGoals(ctx.goals || [], policy.goalWeights || {}, verb)
    const tieBreak = opts.tieBreak || Math.random
    const goalId = pickBestScore(scores, tieBreak)
    if (goalId) {
      goal = (ctx.goals || []).find((g) => g.id === goalId) || null
      target = goalId
    }
    if (!goal && verb !== 'idle') {
      // No reachable goal — fall back to idle (still a real decision).
      verb = tools.includes('idle') ? 'idle' : verb
      target = null
    }
  }

  if (verb === 'talk') {
    target = ctx.nearestPeerId || null
  }

  return { verb, target, goal }
}

/**
 * Score goals for the chosen verb. Missing kinds score 0.
 * Equal top scores → pickBestScore + tieBreak produces cross-run path variance.
 */
export function scoreGoals(goals, goalWeights, verb) {
  const scores = {}
  for (const g of goals) {
    const w = goalWeights[g.kind] || goalWeights.wander || 0
    if (w <= 0) continue
    // Same-kind goals share one score so pickBestScore + unseeded tieBreak
    // produces honest pathfinding divergence across runs (WORLD-BIBLE §8).
    // Proximity is applied only as a secondary sort key when the caller
    // prefers nearer goals among unequal kinds — not enough to break ties.
    let s = w
    if (verb === 'buy' && g.kind !== 'vendor' && g.kind !== 'record-store') s *= 0.25
    if (verb === 'enter' && !g.enterable) s *= 0.2
    scores[g.id] = s
  }
  // Always offer wander so walk has somewhere to go.
  if (goalWeights.wander && !scores['wander']) {
    scores['wander'] = goalWeights.wander * 0.5
  }
  return scores
}

/**
 * Duration for a verb from tools table [min,max].
 */
export function verbDuration(toolsTable, verb, rng = Math.random) {
  const def = toolsTable?.[verb]
  if (!def?.duration) return 3
  const [a, b] = def.duration
  return a + (b - a) * rng()
}

/**
 * Reconsider interval from policy.reconsiderSeconds [min,max].
 */
export function reconsiderIn(policy, rng = Math.random) {
  const r = policy?.reconsiderSeconds || [4, 10]
  return r[0] + (r[1] - r[0]) * rng()
}

function hourInRange(hour, from, to) {
  const h = ((hour % 24) + 24) % 24
  if (from <= to) return h >= from && h < to
  return h >= from || h < to
}

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
