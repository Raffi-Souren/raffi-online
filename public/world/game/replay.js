/**
 * RAFFI WORLD — REWIND lifecycle: two real runs, cyan ghosts, live DAR/TAR.
 */

import * as THREE from 'three'
import { state, data, bus } from '../engine/state.js'
import {
  computeLiveMetrics,
  formatAgreement,
  agreementPercent,
} from './replay-core.js'
import {
  initNpcSim,
  disposeNpcSim,
  updateNpcSim,
  setNpcRecording,
  clearNpcBuffers,
  snapshotNpcRun,
  resetNpcToStart,
  npcSimTime,
  getNpcBuffers,
} from './npc-sim.js'
import { toast } from './hud.js'
import { teleportPlayer } from './player.js'

/** @typedef {'idle'|'recording'|'ready'|'comparing'} ReplayPhase */

let phase = /** @type {ReplayPhase} */ ('idle')
/** @type {import('./replay-core.js').RunStream|null} */
let runA = null
/** @type {import('./replay-core.js').RunStream|null} */
let runBLive = null
let ghostRoot = null
let ghostMeshes = new Map()
let sceneRef = null
let materialsRef = null
let compareStartSimT = 0
let spawnSnap = null
let els = {}
let lastMetrics = null

export function initReplay({ scene, materials, collision, atlas, seed, elements }) {
  disposeReplay()
  sceneRef = scene
  materialsRef = materials
  els = elements || {}
  spawnSnap = {
    x: data.world.spawn.x,
    z: data.world.spawn.z,
    yaw: data.world.spawn.yaw || 0,
  }
  ghostRoot = new THREE.Group()
  ghostRoot.name = 'replay-ghosts'
  ghostRoot.visible = false
  scene.add(ghostRoot)

  initNpcSim({ scene, materials, atlas, collision, seed })
  phase = 'idle'
  updateRewindButton()
  hideOverlay()
}

export function disposeReplay() {
  clearGhosts()
  if (ghostRoot?.parent) ghostRoot.parent.remove(ghostRoot)
  ghostRoot = null
  disposeNpcSim()
  runA = null
  runBLive = null
  phase = 'idle'
  lastMetrics = null
  hideOverlay()
}

/** Call when the player presses START — begin recording run A. */
export function beginRecordingRun() {
  resetNpcToStart()
  clearNpcBuffers()
  setNpcRecording(true)
  runA = null
  runBLive = null
  phase = 'recording'
  clearGhosts()
  hideOverlay()
  updateRewindButton()
  toast('RECORDING CITY DECISIONS', 2.2)
}

/**
 * Freeze run A from current buffers. REWIND becomes available when samples exist.
 */
export function endRecordingRun() {
  setNpcRecording(false)
  const snap = snapshotNpcRun()
  const ok = (snap.decisions?.length || 0) > 0 && (snap.transforms?.length || 0) > 0
  if (ok) {
    runA = snap
    phase = 'ready'
    toast('RUN CAPTURED · REWIND AVAILABLE', 2.8)
  } else {
    runA = null
    phase = 'idle'
    toast('NOT ENOUGH REPLAY DATA YET', 2.4)
  }
  updateRewindButton()
  return ok
}

export function hasValidRun() {
  return !!(
    runA &&
    runA.decisions?.length > 0 &&
    runA.transforms?.length > 0
  )
}

export function getReplayPhase() {
  return phase
}

export function getLastMetrics() {
  return lastMetrics
}

/**
 * Start compare run: restore spawn, show ghosts of run A, record run B.
 */
export function startRewindCompare() {
  if (!hasValidRun()) {
    toast('NO RECORDED RUN', 2)
    return false
  }
  // Ensure run A is frozen from latest buffer if still recording.
  if (phase === 'recording') endRecordingRun()
  if (!hasValidRun()) return false

  clearGhosts()
  buildGhostsFromRun(runA)
  ghostRoot.visible = true

  // Restore authored start snapshot for fair second run (player + NPCs).
  if (spawnSnap) teleportPlayer(spawnSnap.x, spawnSnap.z, spawnSnap.yaw)
  resetNpcToStart()

  clearNpcBuffers()
  setNpcRecording(true)
  compareStartSimT = npcSimTime()
  phase = 'comparing'
  showOverlay()
  updateOverlay('--%', '--%', 0)
  updateRewindButton()
  toast('REWIND · GHOSTS ARE RUN ONE', 2.6)
  bus.emit('replay', { type: 'compare-start' })
  return true
}

export function stopCompare() {
  if (phase !== 'comparing') return
  setNpcRecording(false)
  runBLive = snapshotNpcRun()
  // Align both streams to t=0 so DAR/TAR windows compare the same relative run.
  lastMetrics = computeLiveMetrics(
    normalizeStreamTime(runA),
    normalizeStreamTime(runBLive),
    data.npcs.replay,
  )
  phase = 'ready'
  if (ghostRoot) ghostRoot.visible = false
  // Keep runA for another rewind; clear B recording buffers for next compare.
  clearNpcBuffers()
  const dar = lastMetrics.darPercent
  const tar = lastMetrics.tarPercent
  updateOverlay(
    formatAgreement(dar),
    formatAgreement(tar),
    1,
  )
  toast(
    'AGREEMENT · D ' + formatAgreement(dar) + ' · P ' + formatAgreement(tar),
    3.4,
  )
  updateRewindButton()
  bus.emit('replay', { type: 'compare-end', metrics: lastMetrics })
  // Hide overlay after a beat — still readable on complete.
  setTimeout(() => {
    if (phase !== 'comparing') hideOverlay()
  }, 4200)
}

/**
 * Per-frame: drive NPC sim + ghosts + live metrics.
 */
export function updateReplay(dt, ctx = {}) {
  if (phase === 'idle') return

  // Ambient NPCs always tick once the city is live; buffers only fill while recording.
  if (phase === 'recording' || phase === 'comparing' || phase === 'ready') {
    updateNpcSim(dt, ctx)
  }

  if (phase === 'comparing') {
    const cfg = data.npcs.replay
    const elapsed = npcSimTime() - compareStartSimT
    const progress = Math.min(1, elapsed / cfg.bufferSeconds)
    // Ghosts scrub to matching time in run A (relative 0..buffer).
    const ghostT = (runA.transforms[0]?.t || 0) + elapsed
    updateGhostPoses(ghostT)

    runBLive = snapshotNpcRun()
    // Shift run B times so they align from 0 for comparison windows.
    lastMetrics = computeLiveMetrics(
      normalizeStreamTime(runA),
      normalizeStreamTime(runBLive),
      cfg,
    )
    updateOverlay(
      formatAgreement(lastMetrics.darPercent),
      formatAgreement(lastMetrics.tarPercent),
      progress,
    )

    if (elapsed >= cfg.bufferSeconds) {
      stopCompare()
    }
  }

  // Auto-arm run A after enough wall buffer while recording.
  if (phase === 'recording') {
    const snap = snapshotNpcRun()
    const minT = data.npcs.replay.bufferSeconds * 0.25
    const span = streamDuration(snap)
    if (span >= minT && !runA) {
      // Soft-ready: keep recording but allow REWIND to freeze snapshot on demand.
      updateRewindButton(true)
    }
  }
}

export function replaySnapshot() {
  return {
    phase,
    hasRun: hasValidRun(),
    metrics: lastMetrics,
    runACounts: runA
      ? { decisions: runA.decisions.length, transforms: runA.transforms.length }
      : null,
  }
}

// ---------------------------------------------------------------- ghosts ---

function buildGhostsFromRun(run) {
  clearGhosts()
  if (!run?.transforms?.length || !ghostRoot) return
  const cfg = data.npcs.replay
  const byActor = new Map()
  for (const s of run.transforms) {
    let arr = byActor.get(s.actorId)
    if (!arr) { arr = []; byActor.set(s.actorId, arr) }
    arr.push(s)
  }
  let n = 0
  for (const [actorId, samples] of byActor) {
    if (n >= cfg.maxGhostActors) break
    samples.sort((a, b) => a.t - b.t)
    const mesh = makeGhostMesh()
    mesh.userData.actorId = actorId
    mesh.userData.samples = samples
    ghostRoot.add(mesh)
    ghostMeshes.set(actorId, mesh)
    n++
  }
}

function makeGhostMesh() {
  // Minimal generated capsule — same budget style as peds, additive material.
  const g = new THREE.Group()
  const mat = materialsRef.ghost
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.7, 0.22),
    mat,
  )
  body.position.y = 1.0
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat)
  head.position.y = 1.48
  g.add(body, head)
  g.frustumCulled = true
  return g
}

function updateGhostPoses(t) {
  for (const [, mesh] of ghostMeshes) {
    const samples = mesh.userData.samples
    if (!samples?.length) continue
    const s = sampleAt(samples, t)
    if (!s) {
      mesh.visible = false
      continue
    }
    mesh.visible = true
    mesh.position.set(s.x, 0, s.z)
    mesh.rotation.y = s.yaw
  }
}

function sampleAt(samples, t) {
  if (t <= samples[0].t) return samples[0]
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1]
  // Binary search
  let lo = 0
  let hi = samples.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const u = (t - a.t) / Math.max(1e-6, b.t - a.t)
  return {
    x: a.x + (b.x - a.x) * u,
    z: a.z + (b.z - a.z) * u,
    yaw: a.yaw + (b.yaw - a.yaw) * u,
  }
}

function clearGhosts() {
  for (const [, m] of ghostMeshes) {
    if (m.parent) m.parent.remove(m)
    m.traverse((c) => {
      c.geometry?.dispose?.()
    })
  }
  ghostMeshes.clear()
}

// ------------------------------------------------------------------- UI ---

function updateRewindButton(softReady = false) {
  const btn = els.rewindBtn || document.querySelector('[data-pause="rewind"]')
  if (!btn) return
  const ready = hasValidRun() || softReady
  if (ready) {
    btn.disabled = false
    btn.textContent = 'REWIND — COMPARE RUNS'
  } else {
    btn.disabled = true
    btn.textContent = phase === 'recording'
      ? 'REWIND — RECORDING…'
      : 'REWIND — NEED A RUN'
  }
}

function showOverlay() {
  const el = els.rewind || document.getElementById('rewind')
  el?.classList.remove('hidden')
  const secs = document.getElementById('rw-secs')
  if (secs) secs.textContent = String(data.npcs.replay.bufferSeconds)
}

function hideOverlay() {
  const el = els.rewind || document.getElementById('rewind')
  el?.classList.add('hidden')
}

function updateOverlay(darText, tarText, progress) {
  const dar = document.getElementById('rw-dar')
  const tar = document.getElementById('rw-tar')
  const bar = document.getElementById('rw-progress')
  if (dar) dar.textContent = darText
  if (tar) tar.textContent = tarText
  if (bar) bar.style.width = Math.round(Math.min(1, Math.max(0, progress)) * 100) + '%'
}

function normalizeStreamTime(stream) {
  if (!stream) return { decisions: [], transforms: [] }
  let t0 = Infinity
  for (const s of stream.decisions || []) if (s.t < t0) t0 = s.t
  for (const s of stream.transforms || []) if (s.t < t0) t0 = s.t
  if (!Number.isFinite(t0)) return { decisions: [], transforms: [] }
  return {
    decisions: (stream.decisions || []).map((s) => ({ ...s, t: s.t - t0 })),
    transforms: (stream.transforms || []).map((s) => ({ ...s, t: s.t - t0 })),
  }
}

function streamDuration(stream) {
  const ts = [
    ...(stream.decisions || []).map((s) => s.t),
    ...(stream.transforms || []).map((s) => s.t),
  ]
  if (!ts.length) return 0
  return Math.max(...ts) - Math.min(...ts)
}

// re-export format for tests
export { formatAgreement, agreementPercent, computeLiveMetrics }
