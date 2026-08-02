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
import { initRenderer, initMaterials, applyGrade, resize, renderFrame, gfx } from './render.js'
import { initCamera, updateCamera, rotateView, setPinch, cam } from './camera.js'
import { initInput, updateInput, endInputFrame, input, consume, setActionLabel, setSecondLabel, setCamLabel } from './input.js'
import { CollisionWorld, resolveCircle, clampToBounds } from './physics.js'
import { buildAtlas } from '../gen/atlas.js'
import { buildWorld } from '../gen/world.js'
import { findOpenSpots } from '../gen/blocks.js'
import { nearestRoad } from '../gen/roads.js'
import { makeRng } from './state.js'
import {
  initPlayer, updatePlayer, spawnVehicle, contextAction,
  enterVehicle, exitVehicle, teleportPlayer, player,
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
  focusFirstMission, missionSnapshot,
} from '../game/missions.js'
import {
  initCompliance, updateCompliance, setComplianceTier, complianceSnapshot,
} from '../game/compliance.js'
import { initDebug, updateDebugCamera, updateDebugReadout, debugState, exposeAuditApi } from './debug.js'

const els = {}
const world = {
  collision: null,
  graph: null,
  vehicles: [],
  districts: null,
  mobilityHub: null,
  transitBusy: false,
  managerBriefed: false,
}

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

  const perDistrict = device.mobile ? 4 : 7
  for (const district of data.world.districts) {
    const lots = world.districts.get(district.id)?.lots || []
    const spots = findOpenSpots(district, lots, world.graph, data.world, perDistrict * 3, 'cars', 6)
    let placed = 0
    for (const spot of spots) {
      if (placed >= perDistrict) break
      const { segment, distance } = nearestRoad(world.graph, spot.x, spot.z)
      if (!segment || distance > 26) continue
      // Park against the kerb, nose along the street.
      const offset = segment.halfWidth - data.vehicles.parked.curbOffset
      const side = segment.horizontal
        ? Math.sign(spot.z - segment.az) || 1
        : Math.sign(spot.x - segment.ax) || 1
      const x = segment.horizontal ? spot.x : segment.ax + side * offset
      const z = segment.horizontal ? segment.az + side * offset : spot.z
      const yaw = segment.horizontal ? Math.PI / 2 : 0

      const v = spawnVehicle(scene, materials, atlas, rng.weighted(weights), x, z, yaw, rng.int(0, 999999))
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
  const totalBeats = transport.time * beatsPerSecond
  transport.beat = Math.floor(totalBeats) % 4
  transport.bar = Math.floor(totalBeats / 4)
  transport.phase = totalBeats % 1
  state.radio.beat = transport.beat
  state.radio.beatPhase = transport.phase
}

function cycleStation(dir = 1) {
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
  els.pause?.classList.toggle('hidden', !state.paused)
  els.pause?.setAttribute('aria-hidden', String(!state.paused))
  if (state.paused) {
    els.pause?.querySelector('[data-pause="resume"]')?.focus({ preventScroll: true })
  } else if (document.activeElement instanceof HTMLElement && els.pause?.contains(document.activeElement)) {
    document.activeElement.blur()
  }
}

function initPauseMenu() {
  syncPauseGradeLabel()
  els.pause?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('button[data-pause]')
    if (!button || button.disabled) return
    if (button.dataset.pause === 'resume') setPaused(false)
    else if (button.dataset.pause === 'grade') cyclePauseGrade()
  })
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

  if (!state.mission.active) focusFirstMission()
  const destination = getWaypoint()
  if (!destination) {
    toast('NO ACTIVE DESTINATION', 2.4)
    world.transitBusy = false
    return
  }

  queueDialogue('subway-depart', { duration: 1.4 })
  await delay(420)
  if (els.travelDestination) els.travelDestination.textContent = 'MISSION EXPRESS · ' + destination.label
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
  // preserve the active stop; resetting here points the GPS back to START.
  if (!state.mission.active) focusFirstMission()
  const lines = []
  if (vehicle.mountLine) lines.push(vehicle.mountLine)
  if (!world.managerBriefed && !state.mission.active) {
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
  initRenderer(els.canvas)

  setBoot(0.4, 'painting atlas…')
  const atlas = buildAtlas(data.blocks, data.dialogue, state.seed + ':atlas')
  const materials = initMaterials(atlas.texture)

  setBoot(0.5, 'compiling Port Vantage…')
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

  setBoot(0.78, 'building collision…')
  const collision = new CollisionWorld()
  collision.addAll(built.collision)
  world.collision = collision

  setBoot(0.85, 'parking cars…')
  const aspect = els.canvas.clientWidth / Math.max(els.canvas.clientHeight, 1)
  initCamera(aspect)
  initPlayer(gfx.scene, materials, atlas)
  spawnParkedCars(gfx.scene, materials, atlas)
  spawnMobilityHub(gfx.scene, materials, atlas)

  setBoot(0.94, 'wiring input…')
  initInput({
    zone: els.zone, base: els.base, knob: els.knob,
    action: els.action, second: els.second, radio: els.btnRadio, cam: els.cam,
    exit: els.exit,
    pauseButton: els.pauseButton,
    touchRoot: els.touchRoot,
  })
  initPauseMenu()
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
  initMissions({
    scene: gfx.scene,
    materials,
    atlas,
    vehicles: world.vehicles,
    spawnVehicle,
    onStart: startMissionPresentation,
  })
  initCompliance()
  initDebug({ root: els.debugRoot, readout: els.debugReadout, buttons: els.debugButtons }, collision)

  applyGrade(state.grade.current, 1)
  setCompliance(0)
  resize()
  window.addEventListener('resize', () => resize())
  bus.on('pinch', (v) => setPinch(v))

  exposeAuditApi({
    ready: true,
    stats: () => state.stats,
    triangleTotal: built.triangles,
    setWaypoint,
    getWaypoint,
    focusFirstMission,
    startMission,
    missionSnapshot,
    dismissDialogue,
    setComplianceTier,
    complianceSnapshot,
  })

  setBoot(1, 'ready')
  state.ready = true

  console.info(
    `[raffi-world] compiled — ${built.triangles.toLocaleString()} tris generated, ` +
    `${built.collision.length} colliders, ${world.vehicles.length} cars, seed "${state.seed}"`
  )

  if (query.auto) {
    startGame()
  } else {
    els.bootStart?.classList.remove('hidden')
    els.bootStart?.addEventListener('click', startGame, { once: true })
  }
}

function startGame() {
  els.boot?.classList.add('hidden')
  els.hud?.setAttribute('aria-hidden', 'false')
  bus.emit('start')
  const d = districtAt(state.player.x, state.player.z)
  if (d) bus.emit('district', d)
  if (!query.auto) toast('WASD / stick to move  ·  E to interact', 4)
  if (query.to) {
    queueDialogue(['greeter-hello', 'greeter-brief', 'greeter-quest'], {
      substitutions: { name: query.to },
      duration: 4.5,
    })
  } else {
    queueDialogue('garage-choice', { duration: 5.5 })
  }
  requestAnimationFrame(loop)
}

// ------------------------------------------------------------------ loop ---

let last = performance.now()
let hourCheck = 0

function loop(now) {
  requestAnimationFrame(loop)

  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  state.dt = dt
  state.time += dt
  state.frame++

  const aspect = els.canvas.clientWidth / Math.max(els.canvas.clientHeight, 1)

  updateInput(state.mode)

  if (consume('pause')) {
    setPaused(!state.paused)
  }

  if (!state.paused) {
    updateTransport(dt)

    if (consume('radio')) cycleStation(1)
    if (consume('cam') && state.mode !== 'vehicle') rotateView(1)
    if (consume('rotate-left')) rotateView(1)
    if (consume('rotate-right')) rotateView(-1)

    // Context priority: dialogue → mission/transit → nearby ride. Touch GAS
    // is a distinct input from keyboard E, so it can never eject the rider.
    const ctx = contextAction(world.vehicles, [missionContext(), transitAction()])
    const controls = player.vehicle?.controls
    const dialogueBlocking = isDialogueBlocking()
    setActionLabel(dialogueBlocking ? 'NEXT' : state.mode === 'vehicle' ? controls?.action || 'GAS' : ctx.label)
    setSecondLabel(state.mode === 'vehicle' ? controls?.second || 'BRAKE' : 'RUN')
    setCamLabel(state.mode === 'vehicle' ? controls?.cam || 'DRIFT' : 'CAM')
    els.exit?.classList.toggle('hidden', state.mode !== 'vehicle')
    els.touchRoot?.classList.toggle('mounted', state.mode === 'vehicle')
    els.touchRoot?.classList.toggle('dialogue', dialogueBlocking)
    // Touch has a dedicated EXIT button while mounted. Desktop needs the
    // keyboard affordance kept on screen so entering a ride is never a trap.
    setInteractionPrompt(dialogueBlocking || (device.touch && state.mode === 'vehicle') ? null : ctx)
    els.action?.classList.toggle('hint', !dialogueBlocking && state.mode !== 'vehicle' && ctx.kind !== 'none')

    const keyboardAction = consume('action')
    const touchPrimary = consume('primary')
    const spacePressed = consume('space')
    const spaceAction = state.mode !== 'vehicle' && spacePressed
    const spaceMicroExit = state.mode === 'vehicle' &&
      (player.vehicle?.kind === 'skateboard' || player.vehicle?.kind === 'scooter') &&
      spacePressed
    const exitPressed = consume('exit')
    // Nonblocking calls auto-dismiss and never steal throttle, exit, or world
    // interactions. Only an authored blocking conversation owns NEXT.
    const dialogueHandled = dialogueBlocking &&
      (keyboardAction || touchPrimary || spaceAction) && advanceDialogue()

    // All context inputs are edge-triggered, so a time lock is unnecessary.
    // Keeping transitions immediately responsive also means a control that is
    // already visible can never swallow the player's first press.
    if (!dialogueHandled && !isDialogueBlocking()) {
      if ((keyboardAction || exitPressed || spaceMicroExit) && state.mode === 'vehicle') {
        exitVehicle(world.collision)
      } else if ((keyboardAction || touchPrimary || spaceAction) && state.mode !== 'vehicle') {
        if (ctx.kind === 'enter' && enterVehicle(ctx.target)) onRideMounted(ctx.target)
        else if (ctx.kind === 'transit') void beginFastTravel(ctx.target)
        else if (ctx.kind === 'mission') startMission(ctx.target)
      }
    }

    const flying = state.debug.on && updateDebugCamera(dt, input)
    if (!flying && !world.transitBusy && !isDialogueBlocking()) {
      updatePlayer(dt, input, world.collision, state.radio.beatPhase)
    }

    if (!world.transitBusy && !isDialogueBlocking()) updateMissions(dt)
    if (!world.transitBusy && !isDialogueBlocking()) updateCompliance(dt)

    const focus = flying
      ? { x: debugState.flyX, y: debugState.flyY, z: debugState.flyZ }
      : { x: state.player.x, y: state.player.y, z: state.player.z }
    const vel = flying ? { x: 0, z: 0 } : { x: state.player.vx, z: state.player.vz }
    updateCamera(dt, focus, vel, aspect)

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

    updateGrade(dt)
  }

  renderFrame(cam.camera)
  updateHud(dt)
  updateDialogue(dt)
  updateDebugReadout(dt)
  endInputFrame()
}

// ------------------------------------------------------------------ init ---

boot().catch((err) => {
  console.error('[raffi-world] boot failed', err)
  if (els.bootStatus) {
    els.bootStatus.textContent = 'boot failed: ' + err.message
    els.bootStatus.style.color = '#ff6b6b'
  }
})
