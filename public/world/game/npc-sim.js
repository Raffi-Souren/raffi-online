/**
 * Ambient NPC pool — policy + locomotion for honest replay streams.
 * Pooled, bounded, data-driven from npcs.json. Archetypes only.
 */

import * as THREE from 'three'
import { state, data, makeRng } from '../engine/state.js'
import { resolveCircle, moveCircle, clampToBounds } from '../engine/physics.js'
import { makePed, animatePed } from '../gen/peds.js'
import { decidePolicy, verbDuration, reconsiderIn } from './npc-policy-core.js'
import { pedestrianDetour } from './npc-navigation.js'
import { createActivityState, planActivity } from './npc-activity-core.js'
import { actorCollisionBodies } from '../engine/actor-collisions.js'
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
let vehiclePoses = new WeakMap()

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
    const activity = data.npcs.neighborhoodActivities?.[i] || null
    const archId = activity?.archetype || rng.pick(i < 12 ? archetypes.filter((id) => data.npcs.archetypes[id].rig !== 'quadruped' && id !== 'bodega-cat') : archetypes)
    const arch = data.npcs.archetypes[archId]
    const ang = rng.range(0, Math.PI * 2)
    const rad = rng.range(8, 36)
    const start = activity?.points[0] || { x: spawn.x + Math.cos(ang) * rad, z: spawn.z + Math.sin(ang) * rad }
    const spawnPosition = resolveCircle(collision, start.x, start.z, NPC_RADIUS, 4)
    const x = spawnPosition.x
    const z = spawnPosition.z
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
    ped.userData.npcId = 'npc-' + i
    ped.userData.appearanceSeed = worldSeed + ':ambient:' + i
    ped.userData.activityRole = activity?.role || 'neighborhood-resident'
    ped.userData.locomotionStyle = activity?.locomotion || 'relaxed'
    ped.userData.carriedItem = activity?.carriedItem || null
    ped.position.set(x, 0, z)
    scene.add(ped)
    actors.push({
      id: 'npc-' + i,
      archId,
      arch,
      activity,
      activityState: activity ? createActivityState() : null,
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
      blockedFor: 0, detour: null, recoverUntil: 0, recoveries: 0, routeAgainAt: 0,
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
  vehiclePoses = new WeakMap()
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
    a.blockedFor = 0; a.detour = null; a.recoverUntil = 0; a.recoveries = 0; a.routeAgainAt = 0
    delete a.mesh.userData.streetReaction
    a.decisionIndex = 0
    if (a.activity) a.activityState = createActivityState()
    a.verbEndsAt = simTime
    a.nextReconsiderAt = simTime
    if (a.mesh) {
      a.mesh.position.set(a.x, 0, a.z)
      a.mesh.rotation.y = a.yaw
    }
  }
  lastSampleT = null
  vehiclePoses = new WeakMap()
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

/** Read-only behavior evidence for the neighborhood/replay QA view. */
export function npcActivitySnapshot() {
  return actors.map((a) => ({ id: a.id, x: a.x, z: a.z, verb: a.verb, target: a.target, goalX:a.goalX,goalZ:a.goalZ,blockedFor:a.blockedFor,recoveries:a.recoveries,detour:!!a.detour, activity: a.activity?.id || null, index: a.activityState?.index ?? null, crossing: a.activityState?.crossing || false, visible: a.mesh.visible, role: a.mesh.userData.activityRole, locomotionStyle: a.mesh.userData.locomotionStyle, carriedItem: a.mesh.userData.carriedItem, appearanceSeed: a.mesh.userData.appearanceSeed, animation: a.mesh.userData.animationState, speed: a.mesh.userData.animationSpeed || 0 }))
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
  const vehicleObjects = sceneRef.children.filter((object) => object.visible && Number.isFinite(object.userData?.width) && Number.isFinite(object.userData?.length))
  const vehicles = vehicleObjects.map((object) => {
    const previous = vehiclePoses.get(object), { x, y, z } = object.position, yaw = object.rotation.y
    const speed = previous && dt > 0 ? ((x - previous.x) * Math.sin(yaw) + (z - previous.z) * Math.cos(yaw)) / dt : 0
    vehiclePoses.set(object, { x, z })
    return { x, y, z, yaw, speed, width: object.userData.width, length: object.userData.length }
  })

  // Resolve in array order — insertion order is the collision non-determinism
  // surface when two sims diverge slightly (WORLD-BIBLE path divergence).
  let routeBudget = 1
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i]
    const streetReaction = a.mesh.userData.streetReaction
    const startled = streetReaction?.until > state.time
    const threat = startled || (ctx.threatNear
      ? ctx.threatNear(a.x, a.z, a.arch.policy?.fleeRadius || 7)
      : false)

    let activityPlan = a.activity && !threat ? planActivity(a.activity, a.activityState, a, dt, vehicles) : null
    if (activityPlan && a.activity.social && state.mode === 'foot' && !state.interior) {
      const dx = a.x - state.player.x, dz = a.z - state.player.z, distance = Math.hypot(dx, dz)
      if (distance < 1.3) activityPlan = { verb: 'walk', target: a.activity.id + ':make-room', x: a.x + (distance > 0.01 ? dx / distance : 1) * 0.9, z: a.z + (distance > 0.01 ? dz / distance : 0) * 0.9 }
    }
    if (startled) {
      a.verb='flee';const dx=a.x-streetReaction.x,dz=a.z-streetReaction.z,d=Math.hypot(dx,dz)||1;a.goalX=a.x+dx/d*5;a.goalZ=a.z+dz/d*5
    } else if (activityPlan) {
      if (a.verb !== activityPlan.verb || a.target !== activityPlan.target) {
        a.decisionIndex++
        if (recording && decisionBuf) decisionBuf.push({ t: simTime, actorId: a.id, verb: activityPlan.verb, target: activityPlan.target })
      }
      a.verb = activityPlan.verb; a.target = activityPlan.target
      a.goalX = activityPlan.x; a.goalZ = activityPlan.z
      if (Number.isFinite(activityPlan.yaw)) a.yaw += Math.atan2(Math.sin(activityPlan.yaw - a.yaw), Math.cos(activityPlan.yaw - a.yaw)) * Math.min(1, dt * 7)
    } else if (simTime >= a.nextReconsiderAt || simTime >= a.verbEndsAt) {
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

    const present = activityPlan?.present !== false
    if (!state.interior) a.mesh.visible = present

    // A collision never becomes an endless walk cycle against a facade.
    // Plan at most one bounded detour per tick, then take a short idle pause
    // and choose another errand if its endpoint is genuinely unreachable.
    if(a.detour && a.detour.target!==a.target)a.detour=null
    if(a.blockedFor>.45 && routeBudget>0 && simTime>=a.recoverUntil && simTime>=a.routeAgainAt){
      routeBudget--
      const blockers=actors.filter(other=>other!==a && other.mesh.visible && Math.hypot(other.x-a.x,other.z-a.z)<14).map(other=>({type:'circle',x:other.x,z:other.z,r:.75}))
      blockers.push(...actorCollisionBodies(vehicleObjects,a.x,a.z,a.mesh,14))
      a.routeAgainAt=simTime+1.5
      const clear=(from,to)=>{const p=moveCircle(collisionRef,from.x,from.z,to.x-from.x,to.z-from.z,NPC_RADIUS+.035,blockers);return Math.hypot(p.x-to.x,p.z-to.z)<.025}
      const route=pedestrianDetour(a,{x:a.goalX,z:a.goalZ},clear)
      a.recoveries++;a.blockedFor=0
      if(route?.length)a.detour={target:a.target,points:route}
      else{
        a.detour=null;a.recoverUntil=simTime+1.2;a.verb='idle';a.nextReconsiderAt=simTime+1.2;a.verbEndsAt=simTime+1.2
        if(a.activityState){a.activityState.index=(a.activityState.index+1)%a.activity.points.length;a.activityState.arrived=false;a.activityState.crossing=false}
        a.phase+=Math.PI/2
      }
    }
    // Locomotion
    const oldX = a.x, oldZ = a.z
    const speed = simTime<a.recoverUntil ? 0 : a.verb === 'flee'
      ? (a.arch.speed?.run || 3.2)
      : a.verb === 'walk' || a.verb === 'enter' || a.verb === 'buy'
        ? (a.activity?.walkSpeed || a.arch.speed?.walk || 1.4)
        : 0

    if (speed > 0.05) {
      while(a.detour?.points.length && Math.hypot(a.detour.points[0].x-a.x,a.detour.points[0].z-a.z)<.25)a.detour.points.shift()
      const waypoint=a.detour?.points[0] || {x:a.goalX,z:a.goalZ}
      const dx = waypoint.x - a.x
      const dz = waypoint.z - a.z
      const dist = Math.hypot(dx, dz)
      if (dist > (a.detour?.points.length ? .18 : .4)) {
        const wantedYaw = Math.atan2(dx, dz)
        a.yaw += Math.atan2(Math.sin(wantedYaw - a.yaw), Math.cos(wantedYaw - a.yaw)) * Math.min(1, dt * 9)
        const step = Math.min(speed * dt, dist)
        let nx = a.x + dx / dist * step
        let nz = a.z + dz / dist * step
        const res = resolveCircle(collisionRef, nx, nz, NPC_RADIUS, 3)
        const bounded = clampToBounds(res.x, res.z, data.world.bounds, 8)
        // Soft separation from other NPCs (order-dependent → run divergence).
        let sx = bounded.x
        let sz = bounded.z
        for (let j = 0; j < actors.length; j++) {
          if (j === i || !actors[j].mesh.visible) continue
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
        const playerBody = state.mode === 'foot' && !state.interior
          ? [{ type: 'circle', x: state.player.x, z: state.player.z, r: 0.45 }]
          : []
        // Peer separation must not push a pedestrian into walls or through the player.
        const vehicleBodies = actorCollisionBodies(vehicleObjects, sx, sz, a.mesh, 10)
        const separated = resolveCircle(collisionRef, sx, sz, NPC_RADIUS, 4, [...playerBody, ...vehicleBodies])
        a.x = separated.x
        a.z = separated.z
      }
    }

    // Stationary neighbors need personal space too; previously only walking
    // actors separated, leaving overlapping idle pairs at the garage.
    const personal = actors.filter((other) => other !== a && other.mesh.visible && Math.hypot(other.x - a.x, other.z - a.z) < 2).map((other) => ({ type: 'circle', x: other.x, z: other.z, r: 0.42 }))
    if (state.mode === 'foot' && !state.interior) personal.push({ type: 'circle', x: state.player.x, z: state.player.z, r: 0.45 })
    personal.push(...actorCollisionBodies(vehicleObjects, a.x, a.z, a.mesh, 10))
    if (present) { const settled = resolveCircle(collisionRef, a.x, a.z, NPC_RADIUS, 4, personal); a.x = settled.x; a.z = settled.z }

    a.phase += dt * (speed > 0.5 ? 2.2 : 0.4)
    a.mesh.position.set(a.x, 0, a.z)
    a.mesh.rotation.y = a.yaw
    const actualSpeed = Math.min(speed, dt > 0 ? Math.hypot(a.x - oldX, a.z - oldZ) / dt : 0)
    a.blockedFor = speed>.05 && actualSpeed<speed*.2 && Math.hypot(a.goalX-a.x,a.goalZ-a.z)>.5 ? a.blockedFor+dt : 0
    const talking = a.verb === 'talk' || (a.activity && ['buy', 'enter'].includes(a.verb) && actualSpeed < 0.2)
    const st = actualSpeed < 0.2 ? (talking ? 'talk' : 'idle') : actualSpeed > 2.5 ? 'run' : 'walk'
    if (a.verb === 'talk') { const peer = actors.find((actor) => actor.id === (a.activity?.peer || a.target)); if (peer) { const yaw = Math.atan2(peer.x - a.x, peer.z - a.z); a.yaw += Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw)) * Math.min(1,dt*5) } }
    a.mesh.rotation.y = a.yaw
    animatePed(a.mesh, data.npcs, st, dt, actualSpeed, a.phase)
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
  const transit = data.world.landmarks.find((landmark) => landmark.type === 'mobility-hub')?.transit?.at
  if (transit) add('transit-stop', transit.x, transit.z - 3.5, false)
  add('vendor', -60, 112, false)
  add('record-store', -69, 110, false)
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
