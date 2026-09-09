/**
 * RAFFI WORLD — boot and main loop.
 *
 * Load data → paint atlas → compile the city → hand control to the player.
 * The engine is a compiler for /data; if you want a different city, edit JSON.
 */

import {
  state, data, query, device, bus, loadData, initState,
  districtAt, gradeForHour, currentHour, clamp,
} from './state.js'
import { initRenderer, initMaterials, applyGrade, resize, renderFrame, gfx, getQuality, cycleQuality, setQuality } from './render.js'
import {
  initCamera, updateCamera, rotateView, setPinch, cam,
  cycleCameraMode, getCameraMode, setCameraMode, orbitView, getDrivingView, setDrivingView, setReducedMotion,
} from './camera.js'
import { initInput, updateInput, endInputFrame, input, consume, resetInput, setActionLabel, setSecondLabel, setCamLabel } from './input.js'
import { CollisionWorld, resolveCircle, clampToBounds } from './physics.js'
import { buildAtlas } from '../gen/atlas.js'
import { buildWorld } from '../gen/world.js'
import { findOpenSpots } from '../gen/blocks.js'
import { nearestRoad } from '../gen/roads.js'
import { makeRng } from './state.js'
import {
  initPlayer, updatePlayer, settlePlayerContacts, spawnVehicle, contextAction, movementPrompt,
  enterVehicle, exitVehicle, teleportPlayer, player,
  tryKickflip, isBoardTrickActive,
} from '../game/player.js'
import {
  initHud, updateHud, setCompliance, setRadio, setWaypoint, getWaypoint,
  setInteractionPrompt, toast,
} from '../game/hud.js'
import {
  initDialogue, queueDialogue, updateDialogue, advanceDialogue,
  isDialogueBlocking, dismissDialogue,
} from '../game/dialogue.js'
import {
  initMissions, updateMissions, missionContext, startMission,
  focusFirstMission, missionSnapshot, startMissionById, confirmMissionBriefing,
  missionWantsAction, missionActionLabel, noteMissionPulse, noteMissionKick, noteAimLane,
  completeCrateQuest,
} from '../game/missions.js'
import { initSideActivities, updateSideActivities, sideActivityOpen } from '../game/side-activities.js'
import { initTraffic, updateTraffic, trafficSnapshot } from '../game/traffic.js'
import { CRATE_QUEST_MESSAGE, crateQuestContext, isCrateQuestReturn } from '../game/crate-quest-core.js'
import {
  initInteriors, enterInterior, exitInterior, interiorDoorContext, interiorSnapshot,
} from '../game/interiors.js'
import {
  initCompliance, updateCompliance, setComplianceTier, complianceSnapshot,
} from '../game/compliance.js'
import {
  initPursuit, updatePursuit, onComplianceCleared, onComplianceTierChange,
  pursuitSnapshot, pursuitBlocksControl,
} from '../game/pursuit.js'
import { initDebug, updateDebugCamera, updateDebugReadout, debugState, exposeAuditApi } from './debug.js'
import { updateOpaqueFogCull } from './cull-opaque.js'
import { unlockAudio, updateAudio, setAudioActive, audioBeat, audioSnapshot, toggleMute, playSfx, setHostMusicPlaying, requestMusicFocus, resetAudioTransport, getVolume, setVolume } from './audio.js'
import { initWorldMap, showWorldMap, hideWorldMap, isWorldMapOpen } from '../game/world-map.js'
import { initCheats, showCheats, hideCheats, cheatsOpen } from '../game/cheats.js'
import { createPlayerCharacter } from './player-character.js'
import { createNearCharacters } from './near-characters.js'
import { prepareHeroVehicle } from './hero-vehicle.js'
import { prepareUrbanSurfaces, addUrbanProps } from './urban-assets.js'
import { createActorBatcher } from './actor-batching.js'
import { createFixedClock, interpolatePlayer } from './fixed-step.js'
import { createRenderPoses } from './render-poses.js'
import { initSaves, saveGame, loadGame, saveSlots, updateSaves, saveStatus } from '../game/saves.js'
import { initStory, storyContext, openStory, closeStory, updateStory, isStoryOpen, isStoryPerforming, storySnapshot, focusStory } from '../game/story.js'
import { initSports, registerSport, sportsContext, openSports, isSportsOpen, updateSports, sportsSnapshot } from '../game/sports.js'
import { createTennis } from '../game/sports-tennis.js'
import { createSoccer } from '../game/sports-soccer.js'
import { createBoxing } from '../game/sports-boxing.js'
import { initPrintStudio, printStudioContext, openPrintStudio, isPrintStudioOpen, updatePrintStudio, printStudioSnapshot } from '../game/print-studio.js'
import { initSaveMenu, showSaveMenu, hideSaveMenu } from '../game/save-menu.js'
import {
  initReplay, disposeReplay, beginRecordingRun, endRecordingRun,
  startRewindCompare, stopCompare, updateReplay, hasValidRun,
  getReplayPhase, getLastMetrics, replaySnapshot,
} from '../game/replay.js'

let hostActive = true
let graphicsFailed = false
let actorBatcher = null
let playerCharacter = null
let nearCharacters = null
let presentationTier = null
let pausedFrameDirty = true
let gameStarted = false
let pendingCheat = null
let lastCheatRequest = 0
const simulation = createFixedClock()
const renderPoses = createRenderPoses()
let previousPlayer = null
window.addEventListener('message', (event) => {
  if (event.origin === location.origin && event.source === window.parent && event.data?.type === 'raffi-world:cheats') {
    const value = event.data
    if (Object.keys(value).length !== 4 || value.action !== 'open' || !Number.isSafeInteger(value.requestId) || value.requestId <= lastCheatRequest || (value.code !== null && (typeof value.code !== 'string' || value.code.length > 24))) return
    lastCheatRequest = value.requestId
    pendingCheat = { code: value.code }
    if (state.ready) {
      if (!gameStarted) startGame()
      else { openCheatMenu(pendingCheat.code); pendingCheat = null }
    }
    return
  }
  if (event.source !== window.parent || event.origin !== location.origin) return
  const value = event.data
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && value.type === 'raffi-world:host-audio' && typeof value.playing === 'boolean') { setHostMusicPlaying(value.playing); return }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 || value.type !== 'raffi-world:activity' || typeof value.active !== 'boolean') return
  hostActive = value.active
  setAudioActive(hostActive && !document.hidden && (!state.paused || state.storyPlayingMusic || state.sportsPlayingSound))
  if (!hostActive) resetInput()
})

const els = {}
const world = {
  collision: null,
  graph: null,
  vehicles: [],
  districts: null,
  mobilityHub: null,
  transitBusy: false,
  managerBriefed: false,
  crateQuestActive: false,
}

function recordShopQuest() {
  if (window.parent === window || world.transitBusy) return null
  const point = data.world.districts.find((district) => district.id === 'strip')?.spawnPoints.find((spawn) => spawn.id === 'record-store')
  return crateQuestContext(state, point, world.crateQuestActive, missionSnapshot().completed.includes('crate-quest'))
}

function openCrateQuest() {
  if (!recordShopQuest() || state.paused) return false
  world.crateQuestActive = true
  setAudioActive(false)
  state.paused = true
  resetInput()
  setInteractionPrompt(null)
  window.parent.postMessage({ type: CRATE_QUEST_MESSAGE, action: 'open' }, location.origin)
  return true
}

window.addEventListener('message', (event) => {
  if (!isCrateQuestReturn(event, window.parent, location.origin, world.crateQuestActive)) return
  world.crateQuestActive = false
  setAudioActive(hostActive && !document.hidden)
  resetInput()
  state.paused = false
  if (event.data.action === 'complete') completeCrateQuest()
})

function grab() {
  const $ = (id) => document.getElementById(id)
  Object.assign(els, {
    canvas: $('view'),
    boot: $('boot'),
    bootBar: $('boot-progress'),
    bootStatus: $('boot-status'),
    bootStart: $('boot-start'),
    hud: $('hud'),
    district: $('district-name'),
    objective: $('objective'),
    compliance: $('compliance'),
    pips: document.querySelector('.cl-pips'),
    clock: $('clock'),
    catchFade: $('catch-fade'),
    catchLabel: $('catch-label'),
    minimap: $('minimap'),
    minimapCanvas: $('minimap-canvas'),
    minimapDistance: $('minimap-distance'),
    minimapLabel: $('minimap-label'),
    radio: $('radio'),
    radioId: $('radio-id'),
    radioName: $('radio-name'),
    radioBpm: $('radio-bpm'),
    toast: $('toast'),
    interactionPrompt: $('interaction-prompt'),
    interactionKey: $('interaction-key'),
    interactionLabel: $('interaction-label'),
    subtitle: $('subtitle'),
    subtitleKicker: $('subtitle-kicker'),
    subtitleSpeaker: $('subtitle-speaker'),
    subtitleText: $('subtitle-text'),
    subtitleNext: $('subtitle-next'),
    touchRoot: $('touch'),
    pauseButton: $('btn-pause'),
    zone: $('stick-zone'),
    base: $('stick-base'),
    knob: $('stick-knob'),
    action: $('btn-action'),
    second: $('btn-second'),
    btnRadio: $('btn-radio'),
    cam: $('btn-cam'),
    exit: $('btn-exit'),
    travel: $('travel'),
    travelDestination: $('travel-destination'),
    debugRoot: $('debug'),
    debugReadout: $('debug-readout'),
    debugButtons: $('debug-buttons'),
    pause: $('pause'),
  })
}

function setBoot(fraction, label) {
  if (els.bootBar) els.bootBar.style.width = Math.round(fraction * 100) + '%'
  if (els.bootStatus && label) els.bootStatus.textContent = label
}

// --------------------------------------------------------------- traffic ---

/** Scatters parked, enterable cars along the kerb in every district. */
function spawnParkedCars(scene, materials, atlas) {
  const rng = makeRng('parked:' + state.seed)
  const weights = {}
  for (const [id, a] of Object.entries(data.vehicles.archetypes)) {
    if (a.spawnable === false || !a.weight) continue
    weights[id] = a.weight
  }

  // Each parked car is a full merged mesh + runtime animate — keep sparse.
  const perDistrict = device.mobile ? 3 : 5
  for (const district of data.world.districts) {
    const lots = world.districts.get(district.id)?.lots || []
    const spots = findOpenSpots(district, lots, world.graph, data.world, perDistrict * 3, 'cars', 6)
    let placed = 0
    for (const spot of spots) {
      if (placed >= perDistrict) break
      const { segment, distance } = nearestRoad(world.graph, spot.x, spot.z)
      if (!segment || segment.local || distance > 26) continue
      // Park against the kerb, nose along the street.
      const offset = segment.halfWidth - data.vehicles.parked.curbOffset
      const side = segment.horizontal
        ? Math.sign(spot.z - segment.az) || 1
        : Math.sign(spot.x - segment.ax) || 1
      const x = segment.horizontal ? spot.x : segment.ax + side * offset
      const z = segment.horizontal ? segment.az + side * offset : spot.z
      const yaw = segment.horizontal ? Math.PI / 2 : 0

      // Each neighbourhood has a small deliberate first pass; weighted extras
      // retain seeded variety. The track coupe is curated only in the yards.
      const weighted = rng.weighted(weights)
      const archetype = data.vehicles.parked.curated?.[district.id]?.[placed] || weighted
      const v = spawnVehicle(scene, materials, atlas, archetype, x, z, yaw, rng.int(0, 999999))
      if (v) {
        world.vehicles.push(v)
        placed++
      }
    }
  }
}

/** Spawns the authored crib rides; geometry/handling/placement all live in data. */
function spawnMobilityHub(scene, materials, atlas) {
  const hub = data.world.landmarks.find((landmark) => landmark.type === 'mobility-hub')
  world.mobilityHub = hub || null
  if (!hub) return
  for (const [index, ride] of (hub.rides || []).entries()) {
    const vehicle = spawnVehicle(
      scene,
      materials,
      atlas,
      ride.archetype,
      ride.at.x,
      ride.at.z,
      ride.yaw || 0,
      'hub:' + hub.id + ':' + ride.id + ':' + index
    )
    if (!vehicle) continue
    vehicle.id = ride.id
    vehicle.homeHub = hub.id
    world.vehicles.push(vehicle)
  }
}

// ------------------------------------------------------------ radio clock ---

/**
 * The transport. Audio arrives in Phase 5, but the clock exists now because
 * streetlights, crosswalk signals and walk cycles all subscribe to it.
 */
const transport = { time: 0, beat: 0, bar: 0, phase: 0 }

function updateTransport(dt) {
  const station = data.radio.stations[state.radio.stationIndex]
  const bpm = station?.bpm || 96
  state.radio.bpm = bpm
  transport.time += dt
  const beatsPerSecond = bpm / 60
  const totalBeats = audioBeat() ?? transport.time * beatsPerSecond
  transport.beat = Math.floor(totalBeats) % 4
  transport.bar = Math.floor(totalBeats / 4)
  transport.phase = totalBeats % 1
  state.radio.beat = transport.beat
  state.radio.beatPhase = transport.phase
}

function cycleStation(dir = 1) {
  requestMusicFocus()
  const stations = data.radio.stations.filter((s) => s.unlocked)
  if (!stations.length) return
  const current = data.radio.stations[state.radio.stationIndex]
  let i = stations.indexOf(current)
  i = (i + dir + stations.length) % stations.length
  const next = stations[i]
  state.radio.stationIndex = data.radio.stations.indexOf(next)
  state.radio.on = true
  setRadio(next)
  // A station may override the world grade while it plays.
  if (next.grade && !state.grade.forced) requestGrade(next.grade)
  toast(next.id + ' — ' + next.name)
}

// ----------------------------------------------------------------- grade ---

function requestGrade(id) {
  if (state.grade.target === id) return
  state.grade.current = state.grade.target
  state.grade.target = id
  state.grade.blend = 0
}

function updateGrade(dt) {
  if (state.grade.blend >= 1) return
  const seconds = data.world.timeOfDay.transitionSeconds || 3
  state.grade.blend = clamp(state.grade.blend + dt / seconds, 0, 1)
  applyGrade(state.grade.target, state.grade.blend, state.grade.current)
  if (state.grade.blend >= 1) state.grade.current = state.grade.target
}

const PAUSE_GRADES = [null, 'dusk', 'haze', 'night']

function syncPauseGradeLabel() {
  const button = els.pause?.querySelector('[data-pause="grade"]')
  if (button) button.textContent = 'COLOUR GRADE: ' + (state.grade.forced || 'auto').toUpperCase()
}

function automaticGrade() {
  const station = state.radio.on ? data.radio.stations[state.radio.stationIndex] : null
  return station?.grade || gradeForHour(currentHour())
}

function cyclePauseGrade() {
  const current = PAUSE_GRADES.indexOf(state.grade.forced)
  const next = PAUSE_GRADES[(current + 1) % PAUSE_GRADES.length]
  state.grade.forced = next
  requestGrade(next || automaticGrade())
  syncPauseGradeLabel()
}

function setPaused(paused) {
  state.paused = !!paused
  simulation.reset()
  previousPlayer = null
  renderPoses.reset()
  pausedFrameDirty = true
  resetInput()
  setAudioActive(!state.paused && hostActive && !document.hidden)
  els.pause?.classList.toggle('hidden', !state.paused)
  els.pause?.setAttribute('aria-hidden', String(!state.paused))
  if (!state.paused) hideWorldMap()
  if (!state.paused) hideCheats()
  if (!state.paused) hideSaveMenu()
  if (state.paused) {
    player.blockedTime = 0
    const sound = els.pause?.querySelector('[data-pause="sound"]')
    if (sound) sound.textContent = audioSnapshot().muted ? 'Sound: Off' : 'Sound: On'
    setInteractionPrompt(null)
    // Freeze run A when the player opens pause mid-record so REWIND can arm.
    if (getReplayPhase() === 'recording') endRecordingRun()
    els.pause?.querySelector('[data-pause="resume"]')?.focus({ preventScroll: true })
  } else {
    els.canvas?.focus({ preventScroll: true })
  }
}

function initPauseMenu() {
  syncPauseGradeLabel()
  const syncCameraPreferences = () => {
    const view = els.pause.querySelector('[data-pause="driving-view"]')
    view.textContent = 'Driving view: ' + (getDrivingView() === 'hood' ? 'Hood' : 'Chase')
    const motion = els.pause.querySelector('[data-pause="motion"]')
    motion.textContent = 'Camera motion: ' + (cam.reducedMotion ? 'Reduced' : 'Normal')
  }
  syncCameraPreferences()
  const volume = document.getElementById('sound-volume')
  const volumeValue = document.getElementById('sound-volume-value')
  const syncVolume = () => { volume.value = String(Math.round(getVolume() * 100)); volumeValue.value = volume.value + '%' }
  syncVolume()
  volume.addEventListener('input', () => { setVolume(Number(volume.value) / 100); syncVolume() })
  const syncQuality = () => {
    const q = getQuality()
    const label = q.preset.charAt(0).toUpperCase() + q.preset.slice(1)
    const button = els.pause?.querySelector('[data-pause="quality"]')
    if (button) button.textContent = 'Graphics: ' + label
    const note = document.getElementById('quality-description')
    if (note) note.textContent = q.preset === 'auto'
      ? 'Graphics adjust to keep the city responsive.'
      : q.preset === 'high' ? 'Full detail, soft shadows and richer reflections.'
        : q.preset === 'balanced' ? 'Detailed streets with a lighter graphics budget.'
          : 'A lighter scene for smoother play on smaller devices.'
  }
  syncQuality()
  document.getElementById('desktop-pause')?.addEventListener('click', () => setPaused(true))
  document.getElementById('game-question')?.addEventListener('click', () => openCheatMenu())
  document.getElementById('desktop-camera')?.addEventListener('click', () => {
    if (!state.paused) toast(cycleCameraMode().label, 2)
    els.canvas?.focus({ preventScroll: true })
  })
  els.pause?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const buttons = Array.from(els.pause.querySelectorAll('button:not(:disabled), input:not(:disabled)'))
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  })
  els.pause?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('button[data-pause]')
    if (!button || button.disabled) return
    if (button.dataset.pause === 'resume') setPaused(false)
    else if (button.dataset.pause === 'map') openWorldMap()
    else if (button.dataset.pause === 'cheats') openCheatMenu()
    else if (button.dataset.pause === 'saves') { els.pause.classList.add('hidden'); showSaveMenu() }
    else if (button.dataset.pause === 'grade') cyclePauseGrade()
    else if (button.dataset.pause === 'quality') { cycleQuality(); syncQuality() }
    else if (button.dataset.pause === 'driving-view') { setDrivingView(getDrivingView() === 'hood' ? 'chase' : 'hood'); setCameraMode('chase'); syncCameraPreferences() }
    else if (button.dataset.pause === 'motion') { setReducedMotion(!cam.reducedMotion); syncCameraPreferences() }
    else if (button.dataset.pause === 'sound') {
      const muted = toggleMute()
      button.textContent = muted ? 'Sound: Off' : 'Sound: On'
    }
    else if (button.dataset.pause === 'rewind') {
      if (!hasValidRun() && getReplayPhase() === 'recording') endRecordingRun()
      if (startRewindCompare()) setPaused(false)
    }
  })
}

function openWorldMap() {
  hideSaveMenu()
  hideCheats()
  setPaused(true)
  els.pause?.classList.add('hidden')
  showWorldMap()
}

function openCheatMenu(code = null) {
  hideSaveMenu()
  if (world.crateQuestActive) return
  hideWorldMap()
  setPaused(true)
  els.pause?.classList.add('hidden')
  showCheats(code)
}

const cheatRides = []
function applyCheat(cheat) {
  if (cheat.action === 'vehicle') {
    if (state.interior) return 'Step outside to have your ride delivered.'
    const road = nearestRoad(world.graph, state.player.x, state.player.z).segment
    if (!road) return 'Find a street for your delivery.'
    let position = null
    for (const offset of [8, -8, 16, -16, 24]) {
      const x = road.horizontal ? clamp(state.player.x + offset, Math.min(road.ax, road.bx) + 4, Math.max(road.ax, road.bx) - 4) : road.ax + 2.6
      const z = road.horizontal ? road.az + 2.6 : clamp(state.player.z + offset, Math.min(road.az, road.bz) + 4, Math.max(road.az, road.bz) - 4)
      const safe = resolveCircle(world.collision, x, z, 2.2, 5)
      if (Math.hypot(safe.x - x, safe.z - z) < 0.2 && world.vehicles.every((v) => Math.hypot(v.x - x, v.z - z) > 5)) { position = { x, z }; break }
    }
    if (!position) return 'The street is busy. Move to an open stretch and try again.'
    if (player.vehicle) exitVehicle(world.collision)
    while (cheatRides.length >= 3) {
      const old = cheatRides.shift()
      old.mesh.removeFromParent()
      old.mesh.geometry.dispose()
      const index = world.vehicles.indexOf(old)
      if (index >= 0) world.vehicles.splice(index, 1)
    }
    const vehicle = spawnVehicle(gfx.scene, gfx.materials, world.atlas, cheat.vehicle, position.x, position.z, road.horizontal ? Math.PI / 2 : 0, 'cheat:' + cheat.code)
    world.vehicles.push(vehicle)
    cheatRides.push(vehicle)
    enterVehicle(vehicle)
    cam.target.set(vehicle.x, 0, vehicle.z)
    setCameraMode('chase')
    playSfx('ui-confirm')
    return cheat.label + ' delivered. Back to the block to drive.'
  }
  if (cheat.action === 'clear') {
    setComplianceTier(0)
    onComplianceCleared()
    return 'Lost them. Take a different street.'
  }
  if (cheat.action === 'radio') {
    for (const station of data.radio.stations) station.unlocked = true
    state.radio.on = true
    state.radio.stationIndex = 0
    setRadio(data.radio.stations[0])
    return 'All six stations unlocked. Choose a frequency below.'
  }
  if (cheat.action === 'grade') {
    state.grade.forced = cheat.grade
    state.grade.current = cheat.grade
    state.grade.target = cheat.grade
    state.grade.blend = 1
    applyGrade(cheat.grade)
    syncPauseGradeLabel()
    return cheat.label + ' set.'
  }
  if (cheat.action === 'home') {
    if (state.mission.active) return 'Finish this mission before heading home.'
    if (state.interior) exitInterior()
    const pose = collisionSafeArrival(data.world.spawn)
    teleportPlayer(pose.x, pose.z, data.world.spawn.yaw)
    cam.target.set(pose.x, 0, pose.z)
    return 'Back at the crib. Your garage is around the corner.'
  }
}

// ------------------------------------------------------------ navigation ---

function transitAction() {
  const transit = world.mobilityHub?.transit
  if (!transit || world.transitBusy || state.mode === 'vehicle') return null
  return {
    x: transit.at.x,
    z: transit.at.z,
    radius: transit.useRadius || 4,
    label: 'SUBWAY',
    prompt: 'TAKE ' + transit.name,
    kind: 'transit',
    target: transit,
  }
}

function collisionSafeArrival(target, offset = { x: 0, z: 0 }) {
  const candidates = [
    { x: target.x + (offset.x || 0), z: target.z + (offset.z || 0) },
    { x: target.x, z: target.z },
    { x: target.x, z: target.z - 6 },
    { x: target.x + 6, z: target.z },
    { x: target.x - 6, z: target.z },
    { x: target.x, z: target.z + 6 },
    { x: target.x + 8, z: target.z + 8 },
    { x: target.x - 8, z: target.z - 8 },
  ]
  for (const candidate of candidates) {
    const bounded = clampToBounds(candidate.x, candidate.z, data.world.bounds, 6)
    const resolved = resolveCircle(world.collision, bounded.x, bounded.z, 0.55, 3)
    if (Math.hypot(resolved.x - bounded.x, resolved.z - bounded.z) < 0.12) return resolved
  }
  return resolveCircle(world.collision, target.x, target.z, 0.55, 4)
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function beginFastTravel(transit) {
  if (world.transitBusy) return
  world.transitBusy = true

  if (!state.mission.active && getWaypoint()?.source !== 'map') {
    if (storySnapshot().branch) focusStory()
    else focusFirstMission()
  }
  const destination = getWaypoint()
  if (!destination) {
    toast('NO ACTIVE DESTINATION', 2.4)
    world.transitBusy = false
    return
  }

  queueDialogue('subway-depart', { duration: 1.4 })
  await delay(420)
  if (els.travelDestination) els.travelDestination.textContent = 'NEXT STOP · ' + destination.label
  els.travel?.classList.remove('hidden')
  requestAnimationFrame(() => els.travel?.classList.add('show'))
  await delay(720)

  const arrival = collisionSafeArrival(destination, transit.arrivalOffset)
  teleportPlayer(arrival.x, arrival.z, state.player.yaw)
  cam.target.set(arrival.x, 0, arrival.z)
  await delay(360)
  els.travel?.classList.remove('show')
  await delay(260)
  els.travel?.classList.add('hidden')
  world.transitBusy = false
  queueDialogue('subway-arrive', { duration: 4.4 })
}

function onRideMounted(vehicle) {
  // Choosing a crib ride begins navigation. Mounting a mission loaner must
  // preserve the active stop and an explicit map choice, including park/print pins.
  const mapPinned = getWaypoint()?.source === 'map'
  if (!state.mission.active && !mapPinned) {
    if (storySnapshot().branch) focusStory()
    else focusFirstMission()
  }
  const lines = []
  if (vehicle.mountLine) lines.push(vehicle.mountLine)
  if (!world.managerBriefed && !state.mission.active && !storySnapshot().branch && !mapPinned) {
    world.managerBriefed = true
    lines.push('onboard-manager-call')
  }
  if (lines.length) queueDialogue(lines, { duration: 3.5 })
}

function startMissionPresentation(mission) {
  world.managerBriefed = true
  if (mission.grade) requestGrade(mission.grade)
  const stationIndex = data.radio.stations.findIndex((station) => station.id === mission.station)
  if (stationIndex >= 0) {
    state.radio.stationIndex = stationIndex
    state.radio.on = true
    setRadio(data.radio.stations[stationIndex])
  }
}

// ------------------------------------------------------------------ boot ---

async function boot() {
  grab()

  setBoot(0.02, 'reading /data…')
  await loadData((f, name) => setBoot(0.02 + f * 0.28, 'loaded ' + name))

  initState()
  setBoot(0.34, 'starting renderer…')
  await initRenderer(els.canvas)

  setBoot(0.4, 'painting atlas…')
  const atlas = buildAtlas(data.blocks, data.dialogue, state.seed + ':atlas')
  await Promise.all([prepareUrbanSurfaces(atlas), prepareHeroVehicle(atlas)])
  world.atlas = atlas
  const materials = initMaterials(atlas.texture, atlas)

  setBoot(0.5, 'building Brooklyn…')
  await new Promise((r) => setTimeout(r, 0)) // let the boot bar paint

  const built = buildWorld({
    data,
    atlas,
    materials,
    scene: gfx.scene,
    grade: state.grade.current,
  })
  world.graph = built.graph
  world.districts = built.districts
  world.cityRoot = built.root

  setBoot(0.78, 'building collision…')
  const collision = new CollisionWorld()
  collision.addAll(built.collision)
  world.collision = collision
  await addUrbanProps(world.cityRoot, collision)

  setBoot(0.85, 'parking cars…')
  const aspect = els.canvas.clientWidth / Math.max(els.canvas.clientHeight, 1)
  initCamera(aspect)
  setCameraMode('chase')
  initPlayer(gfx.scene, materials, atlas)
  playerCharacter = await createPlayerCharacter(player, { tier: getQuality().tier, surfaceRoot: world.cityRoot })
  spawnParkedCars(gfx.scene, materials, atlas)
  spawnMobilityHub(gfx.scene, materials, atlas)
  initSideActivities(gfx.scene, world.vehicles)
  initTraffic({ scene: gfx.scene, materials, atlas, graph: world.graph, collision, vehicles: world.vehicles })

  setBoot(0.94, 'wiring input…')
  initInput({
    canvas: els.canvas,
    zone: els.zone, base: els.base, knob: els.knob,
    action: els.action, second: els.second, radio: els.btnRadio, cam: els.cam,
    exit: els.exit,
    pauseButton: els.pauseButton,
    touchRoot: els.touchRoot,
  })
  initPauseMenu()
  initWorldMap(world.graph, () => { hideWorldMap(); setPaused(true) })
  initCheats({ close: () => setPaused(false), apply: applyCheat, station: (index) => {
    requestMusicFocus()
    state.radio.stationIndex = index
    state.radio.on = true
    setRadio(data.radio.stations[index])
    if (!state.grade.forced) requestGrade(data.radio.stations[index].grade)
  } })
  initHud({
    root: els.hud, district: els.district, objective: els.objective,
    compliance: els.compliance, pips: els.pips, clock: els.clock,
    interactionPrompt: els.interactionPrompt,
    interactionKey: els.interactionKey,
    interactionLabel: els.interactionLabel,
    minimap: els.minimap, minimapCanvas: els.minimapCanvas,
    minimapDistance: els.minimapDistance, minimapLabel: els.minimapLabel,
    radio: els.radio, radioId: els.radioId, radioName: els.radioName, radioBpm: els.radioBpm,
    toast: els.toast, subtitle: els.subtitle,
  }, world.graph)
  initDialogue({
    root: els.subtitle,
    kicker: els.subtitleKicker,
    speaker: els.subtitleSpeaker,
    text: els.subtitleText,
    next: els.subtitleNext,
  })
  initInteriors({
    scene: gfx.scene,
    materials,
    atlas,
    cityRoot: built.root,
    cityCollision: collision,
    world,
    exteriorRoot: gfx.scene,
    playerRoot: player.group,
  })
  initMissions({
    scene: gfx.scene,
    materials,
    atlas,
    vehicles: world.vehicles,
    spawnVehicle,
    cityRoot: built.root,
    onStart: startMissionPresentation,
  })
  initPursuit({
    scene: gfx.scene,
    materials,
    atlas,
    graph: world.graph,
    collision,
    catchEl: els.catchFade,
    catchLabel: els.catchLabel,
  })
  initCompliance({
    onClear: () => onComplianceCleared(),
    onTierChange: (next) => onComplianceTierChange(next),
  })
  initReplay({
    scene: gfx.scene,
    materials,
    atlas,
    collision,
    seed: state.seed,
    elements: {
      rewind: document.getElementById('rewind'),
      rewindBtn: document.querySelector('[data-pause="rewind"]'),
    },
  })
  initStory({ scene: gfx.scene, materials, atlas, onOpen: () => {
    setPaused(true)
    els.pause?.classList.add('hidden')
    playerCharacter?.playInteraction()
  }, onClose: () => setPaused(false) })
  registerSport('tennis', createTennis)
  registerSport('soccer', createSoccer)
  registerSport('boxing', createBoxing)
  initSports({ scene: world.cityRoot, materials, atlas, collision, onOpen: () => {
    setPaused(true)
    els.pause?.classList.add('hidden')
    playerCharacter?.playInteraction()
  }, onClose: () => setPaused(false) })
  initPrintStudio({ scene: world.cityRoot, actorScene: gfx.scene, materials, atlas, collision, saveStatus, onOpen: () => {
    setPaused(true)
    els.pause?.classList.add('hidden')
    playerCharacter?.playInteraction()
  }, onClose: () => setPaused(false) })
  playerCharacter?.refreshGroundSurfaces()
  initSaves({ scene: gfx.scene, materials, atlas, vehicles: world.vehicles, collision, world, onLoad: () => {
    world.transitBusy = false
    world.crateQuestActive = false
    resetAudioTransport()
    transport.time = 0
    transport.beat = 0
    transport.bar = 0
    syncPauseGradeLabel()
    setPaused(false)
  } })
  initSaveMenu({ close: () => { hideSaveMenu(); setPaused(true) }, start: startGame })
  presentationTier = getQuality().tier
  nearCharacters = await createNearCharacters(gfx.scene, { tier: presentationTier, surfaceRoot: world.cityRoot })
  actorBatcher = createActorBatcher(gfx.scene)
  initDebug({ root: els.debugRoot, readout: els.debugReadout, buttons: els.debugButtons }, collision)

  applyGrade(state.grade.current, 1)
  setCompliance(0)
  resize()
  updateCamera(0, state.player, { x: 0, z: 0 }, aspect, world.collision)
  actorBatcher?.update(cam.camera)
  renderFrame(cam.camera)
  els.boot?.classList.add('scene-ready')
  window.addEventListener('resize', () => { resize(); pausedFrameDirty = true })
  bus.on('pinch', (v) => setPinch(v))

  exposeAuditApi({
    ready: true,
    stats: () => state.stats,
    triangleTotal: built.triangles,
    setWaypoint,
    getWaypoint,
    focusFirstMission,
    startMission,
    startMissionById,
    confirmMissionBriefing,
    missionSnapshot,
    enterInterior,
    exitInterior,
    interiorSnapshot,
    noteMissionPulse,
    noteMissionKick,
    noteAimLane,
    dismissDialogue,
    setComplianceTier,
    complianceSnapshot,
    pursuitSnapshot,
    cycleCameraMode,
    getCameraMode,
    getDrivingView,
    setCameraMode,
    getQuality,
    setQuality,
    audioSnapshot,
    getVolume,
    trafficSnapshot,
    storySnapshot, focusStory, openStory, isStoryOpen, sportsSnapshot, printStudioSnapshot,
    characterStats: () => playerCharacter?.stats,
    nearCharacterStats: () => nearCharacters?.stats,
    saveGame, loadGame, saveSlots, saveStatus,
    actorBatchStats: () => actorBatcher?.stats,
    renderAuditView: (camera) => {
      updateOpaqueFogCull(camera, world.cityRoot)
      nearCharacters?.update(0, state, camera)
      actorBatcher?.update(camera)
      renderFrame(camera)
      return { ...state.stats }
    },
    beginRecordingRun,
    endRecordingRun,
    startRewindCompare,
    stopCompare,
    hasValidRun,
    getReplayPhase,
    getLastMetrics,
    replaySnapshot,
    debugPullPursuersToPlayer: async () => {
      const mod = await import('../game/pursuit.js')
      mod.debugPullPursuersToPlayer()
    },
  })

  setBoot(1, 'ready')
  state.ready = true
  bus.emit('saves-changed')

  if (query.debug) console.info(
    `[raffi-world] compiled — ${built.triangles.toLocaleString()} tris generated, ` +
    `${built.collision.length} colliders, ${world.vehicles.length} cars, seed "${state.seed}"`
  )

  if (query.auto || pendingCheat) {
    startGame()
  } else {
    els.bootStart?.classList.remove('hidden')
    els.bootStart?.addEventListener('click', startGame, { once: true })
  }
}

function startGame() {
  if (gameStarted) return
  gameStarted = true
  els.boot?.classList.add('hidden')
  els.hud?.setAttribute('aria-hidden', 'false')
  els.canvas?.focus({ preventScroll: true })
  setCameraMode('chase')
  void unlockAudio()
  bus.emit('start')
  beginRecordingRun()
  const d = districtAt(state.player.x, state.player.z)
  if (d) bus.emit('district', d)
  if (!query.auto) toast(device.touch ? 'Left thumb: move · Drag the view: look around' : 'WASD move · Drag to look · E interact', 4.5)
  if (query.to) {
    queueDialogue(['greeter-hello', 'greeter-brief', 'greeter-quest'], {
      substitutions: { name: query.to },
      duration: 4.5,
    })
  } else {
    queueDialogue('garage-choice', { duration: 5.5 })
  }
  last = performance.now()
  requestAnimationFrame(loop)
  if (pendingCheat) { openCheatMenu(pendingCheat.code); pendingCheat = null }
}

// ------------------------------------------------------------------ loop ---

let last = performance.now()
let hourCheck = 0
let frameElapsed = 0
let frameCount = 0

function loop(now) {
  requestAnimationFrame(loop)

  const realDt = Math.max(0, (now - last) / 1000)
  const dt = Math.min(realDt, 0.05)
  last = now
  if (!hostActive || graphicsFailed || document.hidden || world.crateQuestActive) { simulation.reset(); previousPlayer = null; renderPoses.reset(); return }
  state.stats.frameMs = realDt * 1000
  frameElapsed += realDt
  frameCount++
  if (frameElapsed >= 0.5) { state.stats.fps = Math.round(frameCount / frameElapsed); frameElapsed = 0; frameCount = 0 }
  state.dt = dt
  state.frame++
  let renderAlpha = 1
  let displayedPlayer = state.player

  const aspect = els.canvas.clientWidth / Math.max(els.canvas.clientHeight, 1)

  if (sideActivityOpen()) {
    simulation.reset()
    updateSideActivities(document.hidden ? 0 : dt)
    endInputFrame()
    return
  }

  updateInput(state.mode, player.vehicle?.kind || null)

  updateSports()
  updatePrintStudio(dt)
  if (isSportsOpen() || isPrintStudioOpen()) {
    simulation.reset()
    endInputFrame()
    return
  }
  updateStory(dt)
  if (consume('pause') && !world.crateQuestActive) {
    if (isStoryOpen()) closeStory()
    else setPaused(!state.paused)
  }
  if (consume('map') && !world.crateQuestActive && !isStoryOpen()) {
    if (isWorldMapOpen()) { hideWorldMap(); setPaused(true) }
    else openWorldMap()
  }
  if (consume('cheats') && !world.crateQuestActive && !isStoryOpen()) {
    if (cheatsOpen()) setPaused(false)
    else openCheatMenu()
  }

  if (!state.paused) {
    if (consume('radio')) cycleStation(1)
    // CAM / C / V: classic → CHASE 3D → FREE 3D → birds → classic.
    // First press leaves iso into real perspective (what players expect from C).
    // Q / X snap (iso) or orbit (chase/free).
    if (consume('cam')) {
      const mode = cycleCameraMode(1)
      const tip = mode.kind === 'persp'
        ? (mode.id === 'chase' ? ' · Q/X orbit · C again FREE' : ' · Q/X orbit · C again')
        : ' · C again for 3D'
      toast('CAMERA · ' + mode.label + tip, 2.2)
    }
    if (consume('rotate-left')) rotateView(1)
    if (consume('rotate-right')) rotateView(-1)
    if (input.look.x || input.look.y) orbitView(input.look.x, input.look.y)

    // Context priority: dialogue → mission/transit → nearby ride. Touch GAS
    // is a distinct input from keyboard E, so it can never eject the rider.
    const ctx = contextAction(world.vehicles, [recordShopQuest(), storyContext(), sportsContext(), printStudioContext(), missionContext(), transitAction(), interiorDoorContext()])
    const controls = player.vehicle?.controls
    const dialogueBlocking = isDialogueBlocking()
    const missionAction = missionActionLabel()
    setActionLabel(
      dialogueBlocking ? 'NEXT'
        : missionAction || (state.mode === 'vehicle' ? controls?.action || 'GAS' : ctx.label)
    )
    setSecondLabel(state.mode === 'vehicle' ? controls?.second || 'BRAKE' : 'RUN')
    setCamLabel(getCameraMode().label.split(' ')[0] || 'CAM')
    els.exit?.classList.toggle('hidden', state.mode !== 'vehicle')
    els.touchRoot?.classList.toggle('mounted', state.mode === 'vehicle')
    els.touchRoot?.classList.toggle('dialogue', dialogueBlocking)
    // Touch has a dedicated EXIT button while mounted. Desktop needs the
    // keyboard affordance kept on screen so entering a ride is never a trap.
    setInteractionPrompt(dialogueBlocking || world.transitBusy || (device.touch && state.mode === 'vehicle') ? null : movementPrompt(ctx))
    els.action?.classList.toggle('hint', !dialogueBlocking && state.mode !== 'vehicle' && ctx.kind !== 'none')

    const keyboardAction = consume('action')
    const touchPrimary = consume('primary')
    const spacePressed = consume('space')
    const secondPressed = consume('second')
    const spaceAction = state.mode !== 'vehicle' && spacePressed
    const spaceMicroExit = state.mode === 'vehicle' &&
      (player.vehicle?.kind === 'skateboard' || player.vehicle?.kind === 'scooter') &&
      spacePressed
    const exitPressed = consume('exit')
    // Nonblocking calls auto-dismiss and never steal throttle, exit, or world
    // interactions. Only an authored blocking conversation owns NEXT.
    const dialogueHandled = dialogueBlocking &&
      (keyboardAction || touchPrimary || spaceAction) && advanceDialogue()

    // Skateboard: F / secondary button = kickflip (need a little speed).
    if (!dialogueHandled && !isDialogueBlocking() && secondPressed) {
      tryKickflip()
    }

    // All context inputs are edge-triggered, so a time lock is unnecessary.
    // Keeping transitions immediately responsive also means a control that is
    // already visible can never swallow the player's first press.
    if (input.move) noteAimLane(input.move.x)

    if (!dialogueHandled && !isDialogueBlocking()) {
      if (missionWantsAction() && (keyboardAction || touchPrimary || spaceAction)) {
        noteMissionPulse()
        noteMissionKick()
      } else if ((keyboardAction || exitPressed || spaceMicroExit) && state.mode === 'vehicle') {
        if (!isBoardTrickActive()) exitVehicle(world.collision)
      } else if ((keyboardAction || touchPrimary || spaceAction) && state.mode !== 'vehicle') {
        if (ctx.kind === 'enter' && enterVehicle(ctx.target)) onRideMounted(ctx.target)
        else if (ctx.kind === 'transit') void beginFastTravel(ctx.target)
        else if (ctx.kind === 'story') openStory(ctx.target)
        else if (ctx.kind === 'sports') openSports()
        else if (ctx.kind === 'print-studio') openPrintStudio()
        else if (ctx.kind === 'mission') startMission(ctx.target)
        else if (ctx.kind === 'crate-quest') openCrateQuest()
        else if (ctx.kind === 'interior-enter') enterInterior(ctx.target)
        else if (ctx.kind === 'interior-exit') exitInterior()
      }
    }

    // The parent now owns input; do not advance actors or mission clocks on this frame.
    if (world.crateQuestActive || isStoryOpen() || isSportsOpen() || isPrintStudioOpen()) {
      endInputFrame()
      return
    }
    const flying = state.debug.on && updateDebugCamera(dt, input)
    const simulationFrame = simulation.advance(realDt, (dt) => {
      previousPlayer = { ...state.player }
      renderPoses.capture(gfx.scene)
      state.dt = dt
      state.time += dt
      updateTransport(dt)
      if (!world.transitBusy && !state.interior) updateTraffic(dt)
      if (!flying && !world.transitBusy && !isDialogueBlocking()) {
        updatePlayer(dt, input, world.collision, state.radio.beatPhase)
      }

      if (!world.transitBusy && !isDialogueBlocking()) { updateMissions(dt); updateSideActivities(dt) }
      if (!world.transitBusy) updateCompliance(dt)
      if (!world.transitBusy && !state.interior) updatePursuit(dt)

      // Ambient NPCs + replay buffers / ghosts (signature mechanic).
      updateReplay(dt, {
        hour: currentHour(),
        threatNear: (x, z, r) => {
          // Soft threat from nearby pursuers if any.
          const snap = pursuitSnapshot()
          if (!snap?.actors?.length) return false
          for (const a of snap.actors) {
            if (Math.hypot((a.x ?? 0) - x, (a.z ?? 0) - z) < r) return true
          }
          return false
        },
      })

      if (!world.transitBusy) settlePlayerContacts(world.collision)

      // Catch freeze owns locomotion for the invite beat.
      if (pursuitBlocksControl()) {
        if (player.vehicle) {
          player.vehicle.speed = 0
          player.vehicle.lateral = 0
        }
        state.player.vx = 0
        state.player.vz = 0
        state.player.speed = 0
      }

      // District entry.
      const d = districtAt(state.player.x, state.player.z)
      if (d && d.id !== state.district) {
        state.district = d.id
        bus.emit('district', d)
        if (!state.grade.forced && !state.radio.on) requestGrade(d.defaultGrade)
      }

      // System clock drives time of day when nothing else has forced a grade.
      hourCheck += dt
      if (hourCheck > 10) {
        hourCheck = 0
        if (!state.grade.forced && !state.radio.on) requestGrade(gradeForHour(currentHour()))
      }

      updateSaves(dt)
      return !state.paused && !world.crateQuestActive && !sideActivityOpen()
    })
    renderAlpha = simulationFrame.alpha
    state.stats.simulation = simulationFrame
    displayedPlayer = interpolatePlayer(previousPlayer, state.player, renderAlpha)
    const focus = flying
      ? { x: debugState.flyX, y: debugState.flyY, z: debugState.flyZ }
      : displayedPlayer
    const vel = flying ? { x: 0, z: 0 } : { x: state.player.vx, z: state.player.vz }
    updateCamera(dt, focus, vel, aspect, flying ? null : world.collision)
    updateGrade(dt)
  } else {
    simulation.reset()
    previousPlayer = null
    renderPoses.reset()
  }

  // Fog-depth cull opaque city chunks only (never emissive/alpha/actors).
  if (world.cityRoot && cam.camera) {
    cam.camera.updateMatrixWorld(true)
    updateOpaqueFogCull(cam.camera, world.cityRoot)
  }

  if (!state.paused || pausedFrameDirty) {
    const tier = getQuality().tier
    if (tier !== presentationTier) {
      presentationTier = tier
      void nearCharacters?.setQuality(tier).catch(() => toast('Nearby character detail could not load. Street activity continues.', 4))
      void playerCharacter?.setQuality(tier).catch(() => toast('Character detail could not load. Your current character remains available.', 4))
    }
    if (!state.paused) renderPoses.apply(renderAlpha)
    try {
      const presentationState = { ...state, player: displayedPlayer }
      playerCharacter?.update(state.paused ? 0 : dt, presentationState)
      nearCharacters?.update(state.paused ? 0 : dt, presentationState, cam.camera)
      actorBatcher?.update(cam.camera)
      renderFrame(cam.camera)
    } finally { renderPoses.restore() }
    pausedFrameDirty = false
  }
  setAudioActive(hostActive && !document.hidden && (!state.paused || state.storyPlayingMusic || state.sportsPlayingSound))
  updateAudio({ dialogue: els.subtitle?.classList.contains('show'), vehicle: player.vehicle })
  updateHud(dt)
  if (!state.paused) updateDialogue(dt)
  updateDebugReadout(dt)
  endInputFrame()
}

// ------------------------------------------------------------------ init ---

function showGraphicsError(message) {
  graphicsFailed = true
  resetInput()
  setAudioActive(false)
  const panel = document.getElementById('graphics-error')
  document.getElementById('graphics-error-message').textContent = message
  panel?.classList.remove('hidden')
  document.getElementById('graphics-retry')?.focus()
}

document.getElementById('graphics-retry')?.addEventListener('click', () => location.reload())
document.addEventListener('visibilitychange', () => setAudioActive(!document.hidden && hostActive && (!state.paused || state.storyPlayingMusic || state.sportsPlayingSound)))
window.addEventListener('pointerdown', () => { if (state.paused) pausedFrameDirty = true; if (state.ready && !state.paused) void unlockAudio() })
window.addEventListener('keydown', () => { if (state.ready && !state.paused) void unlockAudio() })
document.getElementById('graphics-light')?.addEventListener('click', () => {
  const url = new URL(location.href)
  url.searchParams.set('lowfi', '1')
  url.searchParams.set('quality', 'performance')
  location.assign(url.href)
})
document.getElementById('view')?.addEventListener('webglcontextlost', (event) => {
  event.preventDefault()
  showGraphicsError('The graphics connection was interrupted. Reload to return to Brooklyn, or try a lighter graphics setting.')
})

boot().catch((err) => {
  console.error('[raffi-world] boot failed', err)
  showGraphicsError('Raffi World could not open. Check your connection and reload. If your browser is struggling with 3D, try performance mode.')
})
