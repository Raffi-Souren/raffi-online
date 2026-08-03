/**
 * Ambient NPC pool — policy + locomotion for honest replay streams.
 * Pooled, bounded, data-driven from npcs.json. Archetypes only.
 */

import * as THREE from 'three'
import { state, data, makeRng } from '../engine/state.js'
import { resolveCircle, clampToBounds } from '../engine/physics.js'
import { makePed, animatePed } from '../gen/peds.js'
import { decidePolicy, verbDuration, reconsiderIn } from './npc-policy-core.js'
import {
  RingBuffer,
  transformCapacity,
  decisionCapacity,
  shouldSampleTransform,
  snapshotRun,
} from './replay-core.js'

const NPC_RADIUS = 0.4
const POOL = 16 // budget-friendly; still enough for DAR/TAR signal

/** @type {object[]} */
let actors = []
/** Authored start poses for fair two-run compare (WORLD-BIBLE §8). */
let startSnapshot = []
let sceneRef = null
let materialsRef = null
let atlasRef = null
let collisionRef = null
let goals = []
let simTime = 0
let lastSampleT = null
let decisionBuf = null
let transformBuf = null
let recording = false
let worldSeed = 'port-vantage'

export function initNpcSim({ scene, materials, atlas, collision, seed }) {
  disposeNpcSim()
  sceneRef = scene
  materialsRef = materials
  atlasRef = atlas
  collisionRef = collision
  worldSeed = seed || state.seed || 'port-vantage'
  simTime = 0
  lastSampleT = null

  const cfg = data.npcs.replay
  decisionBuf = new RingBuffer(decisionCapacity(cfg) * POOL)
  transformBuf = new RingBuffer(transformCapacity(cfg) * POOL)

  goals = buildGoalCatalog()
  const archetypes = Object.keys(data.npcs.archetypes).filter(
    (id) => data.npcs.archetypes[id].weight > 0 && id !== 'pursuer',
  )
  const rng = makeRng('npc-pool:' + worldSeed)
  const spawn = data.world.spawn
  const n = Math.min(POOL, data.npcs.population?.poolSize || POOL)

  for (let i = 0; i < n; i++) {
    const archId = rng.pick(archetypes)
    const arch = data.npcs.archetypes[archId]
    const ang = rng.range(0, Math.PI * 2)
    const rad = rng.range(8, 36)
    const x = spawn.x + Math.cos(ang) * rad
    const z = spawn.z + Math.sin(ang) * rad
    const yaw = rng.range(0, Math.PI * 2)
    const phase = rng.range(0, Math.PI * 2)
    const ped = makePed(
      data.npcs,
      archId,
      'ambient-' + i,
      materials.actor,
      atlas,
      data.blocks.vertexLighting,
    )
    ped.position.set(x, 0, z)
    scene.add(ped)
    actors.push({
      id: 'npc-' + i,
      archId,
      arch,
      mesh: ped,
      x, z,
      yaw,
      vx: 0,
      vz: 0,
      verb: 'idle',
      target: null,
      goalX: x,
      goalZ: z,
      verbEndsAt: 0,
      nextReconsiderAt: 0,
      decisionIndex: 0,
      phase,
    })
    startSnapshot.push({ id: 'npc-' + i, x, z, yaw, phase, goalX: x, goalZ: z })
  }
}

export function disposeNpcSim() {
  for (const a of actors) {
    if (a.mesh?.parent) a.mesh.parent.remove(a.mesh)
    a.mesh?.geometry?.dispose?.()
  }
  actors = []
  startSnapshot = []
  decisionBuf = null
  transformBuf = null
  lastSampleT = null
  simTime = 0
  recording = false
}

/**
 * Restore actors to the authored pool spawn so run B shares run A's start
 * (player + NPC). Seeded policy then yields high DAR; path ties diverge TAR.
 */
export function resetNpcToStart() {
  const byId = new Map(startSnapshot.map((s) => [s.id, s]))
  for (const a of actors) {
    const s = byId.get(a.id)
    if (!s) continue
    a.x = s.x
    a.z = s.z
    a.yaw = s.yaw
    a.phase = s.phase
    a.goalX = s.goalX
    a.goalZ = s.goalZ
    a.vx = 0
    a.vz = 0
    a.verb = 'idle'
    a.target = null
    a.decisionIndex = 0
    a.verbEndsAt = simTime
    a.nextReconsiderAt = simTime
    if (a.mesh) {
      a.mesh.position.set(a.x, 0, a.z)
      a.mesh.rotation.y = a.yaw
    }
  }
  lastSampleT = null
}

export function setNpcRecording(on) {
  recording = !!on
}

export function clearNpcBuffers() {
  decisionBuf?.clear()
  transformBuf?.clear()
  lastSampleT = null
}

export function getNpcBuffers() {
  return { decisionBuf, transformBuf }
}

export function snapshotNpcRun() {
  if (!decisionBuf || !transformBuf) {
    return { decisions: [], transforms: [] }
  }
  return snapshotRun(decisionBuf, transformBuf)
}

export function npcSimTime() {
  return simTime
}

export function npcActorCount() {
  return actors.length
}

/**
 * @param {number} dt
 * @param {{ threatNear?: (x,z,r)=>boolean, hour?: number }} [ctx]
 */
export function updateNpcSim(dt, ctx = {}) {
  if (!actors.length || !collisionRef) return
  simTime += dt
  const tools = data.npcs.tools
  const sampleHz = data.npcs.replay.sampleHz
  const hour = ctx.hour ?? 12

  // Resolve in array order — insertion order is the collision non-determinism
  // surface when two sims diverge slightly (WORLD-BIBLE path divergence).
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i]
    const threat = ctx.threatNear
      ? ctx.threatNear(a.x, a.z, a.arch.policy?.fleeRadius || 7)
      : false

    if (simTime >= a.nextReconsiderAt || simTime >= a.verbEndsAt) {
      const localGoals = goals.map((g) => ({
        ...g,
        dist: Math.hypot(g.x - a.x, g.z - a.z),
      }))
      // Inject wander pseudo-goal near actor.
      localGoals.push({
        id: 'wander:' + a.id,
        kind: 'wander',
        x: a.x + Math.cos(a.phase) * 12,
        z: a.z + Math.sin(a.phase) * 12,
        dist: 12,
        enterable: false,
      })
      const peers = actors
        .filter((o) => o.id !== a.id)
        .map((o) => ({ id: o.id, d: Math.hypot(o.x - a.x, o.z - a.z) }))
        .sort((p, q) => p.d - q.d)
      const decision = decidePolicy(
        a.arch,
        {
          goals: localGoals,
          threat,
          hour,
          actorId: a.id,
          decisionIndex: a.decisionIndex++,
          worldSeed,
          nearestPeerId: peers[0] && peers[0].d < 3 ? peers[0].id : null,
        },
        {
          seeded: true,
          // Honest tie-break: not seeded — path variance across runs.
          tieBreak: Math.random,
        },
      )
      a.verb = decision.verb
      a.target = decision.target
      if (decision.goal) {
        a.goalX = decision.goal.x
        a.goalZ = decision.goal.z
      } else if (decision.verb === 'flee') {
        const ang = a.phase + Math.PI
        a.goalX = a.x + Math.cos(ang) * 18
        a.goalZ = a.z + Math.sin(ang) * 18
      } else {
        a.goalX = a.x
        a.goalZ = a.z
      }
      // Seed timing so decision *when* stays aligned across runs (DAR window).
      // Path variance still comes from unseeded goal ties + collision order.
      const timeRng = makeSeededTimeRng(worldSeed, a.id, a.decisionIndex)
      const dur = verbDuration(tools, a.verb, timeRng)
      a.verbEndsAt = simTime + dur
      a.nextReconsiderAt = simTime + reconsiderIn(a.arch.policy, timeRng)

      if (recording && decisionBuf) {
        decisionBuf.push({
          t: simTime,
          actorId: a.id,
          verb: a.verb,
          target: a.target || undefined,
        })
      }
    }

    // Locomotion
    const speed = a.verb === 'flee'
      ? (a.arch.speed?.run || 3.2)
      : a.verb === 'walk' || a.verb === 'enter' || a.verb === 'buy'
        ? (a.arch.speed?.walk || 1.4)
        : 0

    if (speed > 0.05) {
      const dx = a.goalX - a.x
      const dz = a.goalZ - a.z
      const dist = Math.hypot(dx, dz)
      if (dist > 0.4) {
        a.yaw = Math.atan2(dx, dz)
        const step = Math.min(speed * dt, dist)
        let nx = a.x + Math.sin(a.yaw) * step
        let nz = a.z + Math.cos(a.yaw) * step
        const res = resolveCircle(collisionRef, nx, nz, NPC_RADIUS, 3)
        const bounded = clampToBounds(res.x, res.z, data.world.bounds, 8)
        // Soft separation from other NPCs (order-dependent → run divergence).
        let sx = bounded.x
        let sz = bounded.z
        for (let j = 0; j < actors.length; j++) {
          if (j === i) continue
          const o = actors[j]
          const ddx = sx - o.x
          const ddz = sz - o.z
          const d = Math.hypot(ddx, ddz)
          if (d > 0.01 && d < 1.15) {
            const push = (1.15 - d) * 0.35
            sx += (ddx / d) * push
            sz += (ddz / d) * push
          }
        }
        a.x = sx
        a.z = sz
      }
    }

    a.phase += dt * (speed > 0.5 ? 2.2 : 0.4)
    a.mesh.position.set(a.x, 0, a.z)
    a.mesh.rotation.y = a.yaw
    const st = speed < 0.2 ? 'idle' : speed > 2.5 ? 'run' : 'walk'
    animatePed(a.mesh, data.npcs, st, dt, speed, a.phase)
  }

  if (recording && transformBuf && shouldSampleTransform(lastSampleT, simTime, sampleHz)) {
    lastSampleT = simTime
    for (const a of actors) {
      transformBuf.push({
        t: simTime,
        actorId: a.id,
        x: a.x,
        z: a.z,
        yaw: a.yaw,
      })
    }
  }
}

function makeSeededTimeRng(seed, actorId, decisionIndex) {
  let a = 0
  const s = String(seed) + '|' + actorId + '|' + decisionIndex + '|t'
  for (let i = 0; i < s.length; i++) a = (Math.imul(a ^ s.charCodeAt(i), 16777619) >>> 0)
  a = (a || 1) >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildGoalCatalog() {
  const list = []
  let i = 0
  const add = (kind, x, z, enterable = false) => {
    list.push({ id: kind + ':' + (i++), kind, x, z, enterable })
  }
  // Spawn-adjacent anchors from world landmarks / districts.
  const spawn = data.world.spawn
  add('wander', spawn.x + 20, spawn.z, false)
  add('crosswalk', spawn.x + 15, spawn.z - 10, false)
  add('plaza', 60, -250, false)
  add('lobby-door', 62, -206, true)
  add('transit-stop', -470, -145, false)
  add('vendor', -60, 112, false)
  add('record-store', 148, 152, true)
  add('club-door', 140, 136, true)
  add('queue', 145, 130, false)
  for (const d of data.world.districts || []) {
    const b = d.bounds
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    add('wander', cx, cz, false)
  }
  return list
}
