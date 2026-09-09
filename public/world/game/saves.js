/** Local autosave and three manual slots. Loading never trusts stored JSON. */
import { state, data, bus, districtAt, gradeForHour, currentHour } from '../engine/state.js'
import { sportsProgressSnapshot, restoreSportsProgress } from './sports.js'
import { printProgressSnapshot, restorePrintProgress } from './print-studio.js'
import { storySnapshot, restoreStory, focusStory } from './story.js'
import { resetInput } from '../engine/input.js'
import { cam, updateCamera } from '../engine/camera.js'
import { applyGrade } from '../engine/render.js'
import { resolveCircle } from '../engine/physics.js'
import { player, teleportPlayer, spawnVehicle, enterVehicle } from './player.js'
import { missionSnapshot, restoreMissionProgress, focusFirstMission } from './missions.js'
import { dismissDialogue } from './dialogue.js'
import { setComplianceTier } from './compliance.js'
import { onComplianceCleared } from './pursuit.js'
import { stopCompare, beginRecordingRun } from './replay.js'
import { setRadio, toast } from './hud.js'
import { SAVE_VERSION, SAVE_SLOTS, SAVE_PREFIX, validateSaveRecord, saveSummary } from './save-core.js'

let deps = null
let autoElapsed = 0
let loadedRide = null
let offCheckpoint = null
let lastError = null

function storage() {
  try { return globalThis.localStorage } catch { return null }
}

export function initSaves(options = {}) {
  deps = options
  autoElapsed = 0
  offCheckpoint?.()
  const saveCheckpoint = () => saveGame('auto', { quiet: true })
  const offMission = bus.on('mission-checkpoint', saveCheckpoint)
  const offStory = bus.on('story-checkpoint', saveCheckpoint)
  const offSports = bus.on('sports-checkpoint', saveCheckpoint)
  const offPrint = bus.on('print-checkpoint', saveCheckpoint)
  offCheckpoint = () => { offMission(); offStory(); offSports(); offPrint() }
  return saveSlots()
}

export function captureSave() {
  const mission = missionSnapshot()
  const active = data.missions.missions.find((item) => item.id === mission.active)
  // Active missions reload their authored briefing; free-roam rooms reopen at
  // their exterior door. Never save room-local coordinates as city coordinates.
  const pose = active ? { ...active.marker, yaw: 0 }
    : state.interior?.exit ? { ...state.interior.exit, yaw: 0 }
      : state.player
  const currentStation = data.radio.stations[state.radio.stationIndex] || data.radio.stations[0]
  return validateSaveRecord({
    version: SAVE_VERSION, seed: state.seed, savedAt: Date.now(), playSeconds: state.time,
    player: { x: pose.x, z: pose.z, yaw: pose.yaw || 0 },
    completed: mission.completed,
    story: storySnapshot(),
    sports: sportsProgressSnapshot(),
    printing: printProgressSnapshot(),
    activeMission: mission.active,
    radio: { on: state.radio.on, station: currentStation.id, unlocked: data.radio.stations.filter((station) => station.unlocked).map((station) => station.id) },
    grade: state.grade.forced,
    vehicle: !active && !state.interior && player.vehicle ? { archetype: player.vehicle.archetypeId, sourceId: player.vehicle.id || null } : null,
  }, data)
}

export function saveGame(slot = 'slot-1', { quiet = false } = {}) {
  if (!SAVE_SLOTS.includes(slot)) return { ok: false, error: 'Choose a valid save slot.' }
  if (!state.ready || !deps) return { ok: false, error: 'The city is still loading.' }
  const record = captureSave()
  if (!record.ok) return record
  try {
    const target = storage()
    if (!target) throw new Error('unavailable')
    target.setItem(SAVE_PREFIX + slot, JSON.stringify(record.save))
    lastError = null
    autoElapsed = 0
    bus.emit('saves-changed')
    if (!quiet) toast(slot === 'auto' ? 'CHECKPOINT SAVED' : 'GAME SAVED · ' + slot.slice(-1))
    return { ok: true, slot, summary: saveSummary(record.save, data) }
  } catch {
    lastError = 'Browser storage is unavailable or full. Your current game is still running.'
    if (!quiet) toast(lastError, 5)
    return { ok: false, error: lastError }
  }
}

export function saveSlots() {
  return SAVE_SLOTS.map((slot) => {
    try {
      const raw = storage()?.getItem(SAVE_PREFIX + slot)
      if (!raw) return { slot, empty: true, valid: false }
      const result = validateSaveRecord(raw, data)
      if (!result.ok) return { slot, empty: false, valid: false, error: result.error }
      if (result.save.seed !== state.seed) return { slot, empty: false, valid: false, error: 'This save belongs to another city seed.' }
      return { slot, empty: false, valid: true, ...saveSummary(result.save, data) }
    } catch {
      return { slot, empty: true, valid: false, error: 'Browser storage is unavailable.' }
    }
  })
}

function safePose(pose, radius = 0.45) {
  const collision = deps.collision || deps.world?.collision
  if (!collision) return pose
  const resolved = resolveCircle(collision, pose.x, pose.z, radius, 14)
  if (!Number.isFinite(resolved.x) || !Number.isFinite(resolved.z) || Math.hypot(resolved.x - pose.x, resolved.z - pose.z) > 12) return data.world.spawn
  return { ...pose, x: resolved.x, z: resolved.z }
}

export function loadGame(slot = 'auto') {
  if (!SAVE_SLOTS.includes(slot) || !deps || !state.ready) return { ok: false, error: 'This save cannot be loaded yet.' }
  let parsed
  try {
    const raw = storage()?.getItem(SAVE_PREFIX + slot)
    if (!raw) return { ok: false, error: 'This slot is empty.' }
    parsed = validateSaveRecord(raw, data)
  } catch { return { ok: false, error: 'Browser storage is unavailable.' } }
  if (!parsed.ok) return parsed
  const save = parsed.save
  if (save.seed !== state.seed) return { ok: false, error: 'This save belongs to another city seed.' }

  resetInput()
  dismissDialogue()
  stopCompare()
  player.trick = null
  if (player.vehicle) teleportPlayer(state.player.x, state.player.z, state.player.yaw)
  if (loadedRide) {
    loadedRide.mesh.removeFromParent()
    loadedRide.mesh.geometry.dispose()
    const index = deps.vehicles?.indexOf(loadedRide) ?? -1
    if (index >= 0) deps.vehicles.splice(index, 1)
    loadedRide = null
  }
  restoreMissionProgress(save, { restart: false })
  restoreStory(save.story)
  restoreSportsProgress(save.sports)
  restorePrintProgress(save.printing)
  const pose = safePose(save.player, save.vehicle ? 2 : 0.45)
  teleportPlayer(pose.x, pose.z, pose.yaw)
  state.time = save.playSeconds
  state.district = districtAt(pose.x, pose.z)?.id || data.world.spawn.district
  state.radio.on = save.radio.on
  state.radio.stationIndex = data.radio.stations.findIndex((station) => station.id === save.radio.station)
  for (const station of data.radio.stations) station.unlocked = save.radio.unlocked.includes(station.id)
  const station = data.radio.stations[state.radio.stationIndex]
  state.radio.bpm = station.bpm
  state.radio.beat = 0
  state.radio.beatPhase = 0
  setRadio(state.radio.on ? station : null)
  state.grade.forced = save.grade
  const grade = save.grade || (state.radio.on && station.grade) || gradeForHour(currentHour())
  state.grade.current = grade
  state.grade.target = grade
  state.grade.blend = 1
  applyGrade(grade, 1)
  setComplianceTier(0, 0)
  onComplianceCleared()
  state.compliance.lastContact = -999
  if (save.vehicle && deps.scene && deps.materials && deps.atlas && deps.vehicles) {
    // Reuse a saved authored/claimed ride, or its same-position counterpart in
    // a fresh city. Spawning a second car on top of it would trap the player.
    let restoredRide = deps.vehicles.find((ride) => !ride.occupied && ride.archetypeId === save.vehicle.archetype && save.vehicle.sourceId && ride.id === save.vehicle.sourceId)
      || deps.vehicles.find((ride) => !ride.occupied && ride.archetypeId === save.vehicle.archetype && Math.hypot(ride.x - pose.x, ride.z - pose.z) < 1.5)
    if (!restoredRide) {
      loadedRide = spawnVehicle(deps.scene, deps.materials, deps.atlas, save.vehicle.archetype, pose.x, pose.z, pose.yaw, state.seed + ':saved-ride')
      restoredRide = loadedRide
      if (loadedRide) { if (save.vehicle.sourceId) loadedRide.id = save.vehicle.sourceId; deps.vehicles.push(loadedRide) }
    }
    if (restoredRide) {
      Object.assign(restoredRide, { x: pose.x, z: pose.z, y: 0, yaw: pose.yaw, speed: 0, lateral: 0, angularVel: 0 })
      restoredRide.mesh.position.set(pose.x, 0, pose.z); restoredRide.mesh.rotation.y = pose.yaw
      enterVehicle(restoredRide)
    }
  }
  if (save.activeMission) restoreMissionProgress(save, { restart: true })
  else if (save.story.branch) focusStory()
  else focusFirstMission()
  beginRecordingRun()
  cam.target.set(pose.x, 0, pose.z)
  updateCamera(0, state.player, { x: 0, z: 0 }, innerWidth / innerHeight, deps.collision || deps.world?.collision)
  autoElapsed = 0
  lastError = null
  deps.onLoad?.(save)
  bus.emit('save-loaded', { slot, checkpoint: Boolean(save.activeMission) })
  toast(save.activeMission ? 'MISSION CHECKPOINT LOADED · ACCEPT THE BRIEFING' : 'WELCOME BACK TO NEW YORK', 4)
  return { ok: true, slot, checkpoint: Boolean(save.activeMission), summary: saveSummary(save, data) }
}

export function updateSaves(dt) {
  if (!deps || state.paused || !state.ready || !Number.isFinite(dt) || dt <= 0) return
  autoElapsed += dt
  if (autoElapsed >= 60) {
    autoElapsed = 0
    saveGame('auto', { quiet: true })
  }
}

export function saveStatus() { return { slots: saveSlots(), lastError } }
