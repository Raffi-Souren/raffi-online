/**
 * RAFFI WORLD — data-driven mission runtime.
 *
 * Interprets every authored objective kind in data/missions.json. Custom
 * handlers live here; the rest of the state machine is in mission-core.js.
 */

import * as THREE from 'three'
import { state, data, bus, clamp } from '../engine/state.js'
import { setWaypoint, setObjective, setCompliance, setRadio, toast } from './hud.js'
import { queueDialogue } from './dialogue.js'
import { makePropObject } from '../gen/props.js'
import { makePed, animatePed } from '../gen/peds.js'
import { enterInterior, exitInterior, interiorById } from './interiors.js'
import { teleportPlayer, player } from './player.js'
import { applyGrade } from '../engine/render.js'
import {
  createMissionRun,
  activateMissionRun,
  stepMissionRun,
  nextMissionPoint,
  missionSecondsRemaining,
  formatMissionClock,
  formatObjective,
  rhythmBeatInterval,
  missionPrerequisitesMet,
} from './mission-core.js'

const SUPPORTED_KINDS = new Set([
  'timer', 'goto', 'goto-vehicle', 'collect', 'rhythm',
  'avoid', 'escort', 'evade', 'custom',
])
const SUPPORTED_HANDLERS = new Set(['penaltyShootout', 'blackoutCity'])

let deps = null
let marker = null
let beacon = null
let offered = null
let run = null
let loaners = new Map()
const unlocked = new Set()
const completed = new Set()
const pickups = []
const hecklers = []
const sensorTiles = []
let passenger = null
let ball = null
let keeper = null
let blackoutOn = false
let pulseQueued = false
let kickQueued = false
let aimLane = 0

export function initMissions(options) {
  deps = options
  loaners = new Map()
  unlocked.clear()
  completed.clear()
  for (const mission of data.missions.missions) {
    if (!mission.unlockedBy) unlocked.add(mission.id)
  }

  marker = makePropObject(
    options.atlas,
    data.props,
    'mission-marker',
    options.materials,
    data.blocks.vertexLighting
  )
  if (marker) {
    marker.name = 'active-mission-marker'
    options.scene.add(marker)
  }

  beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 22, 8),
    new THREE.MeshBasicMaterial({
      color: '#FFE347',
      transparent: true,
      opacity: 0.42,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  )
  beacon.name = 'mission-beacon-xray'
  beacon.visible = false
  beacon.frustumCulled = false
  beacon.renderOrder = 30
  options.scene.add(beacon)

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.2, 6),
    new THREE.MeshBasicMaterial({
      color: '#FF3D8A',
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  )
  tip.position.y = 12.2
  tip.rotation.x = Math.PI
  beacon.add(tip)

  offered = nextSupportedMission()
  setMarker(offered?.marker || null)
}

function isSupported(mission) {
  return mission.objectives.every((objective) => {
    if (!SUPPORTED_KINDS.has(objective.kind)) return false
    if (objective.kind === 'custom') return SUPPORTED_HANDLERS.has(objective.handler)
    return true
  })
}

function availableMissions() {
  return data.missions.missions.filter((mission) =>
    unlocked.has(mission.id) &&
    !completed.has(mission.id) &&
    missionPrerequisitesMet(mission, completed, data.missions.missions) &&
    isSupported(mission)
  )
}

function nextSupportedMission() {
  const open = availableMissions()
  if (!open.length) return null
  const px = state.player.x
  const pz = state.player.z
  return [...open].sort((a, b) =>
    Math.hypot(a.marker.x - px, a.marker.z - pz) -
    Math.hypot(b.marker.x - px, b.marker.z - pz)
  )[0]
}

/** Called after the player chooses a ride or asks the subway for mission service. */
export function focusFirstMission() {
  offered = nextSupportedMission()
  if (!offered) return null
  setMarker(offered.marker)
  setWaypoint(offered.marker, offered.name)
  setObjective('GO TO · ' + offered.name)
  return offered
}

export function missionContext() {
  if (run) return null
  const open = availableMissions()
  const px = state.player.x
  const pz = state.player.z
  let best = null
  let bestD = Infinity
  for (const mission of open) {
    const dist = Math.hypot(mission.marker.x - px, mission.marker.z - pz)
    if (dist <= 8 && dist < bestD) {
      bestD = dist
      best = mission
    }
  }
  if (!best) return null
  return {
    x: best.marker.x,
    z: best.marker.z,
    radius: 8,
    label: 'START',
    prompt: 'START ' + best.name,
    kind: 'mission',
    target: best,
  }
}

export function missionWantsAction() {
  if (!run || run.status !== 'active') return false
  if (run.rhythm && !run.completedKinds.includes('rhythm')) return true
  if (run.customs.some((item) => item.handler === 'penaltyShootout') &&
      !run.completedKinds.includes('custom:penaltyShootout')) return true
  return false
}

export function missionActionLabel() {
  if (!run || run.status !== 'active') return null
  if (run.rhythm && !run.completedKinds.includes('rhythm')) return 'HIT'
  if (run.customs.some((item) => item.handler === 'penaltyShootout')) return 'SHOOT'
  return null
}

export function noteMissionPulse() {
  pulseQueued = true
}

export function noteMissionKick() {
  kickQueued = true
}

export function startMission(mission = offered) {
  if (!mission || run || !isSupported(mission)) return false
  offered = mission
  ensureLoaner(mission)
  run = createMissionRun(mission)
  state.mission.active = mission.id
  state.mission.objectiveIndex = 0
  state.mission.elapsed = 0
  state.mission.data = mission
  setObjective(mission.name + ' · BRIEFING')
  deps?.onStart?.(mission)

  queueDialogue(mission.startLine, {
    blocking: true,
    onComplete: () => {
      if (!run || run.mission.id !== mission.id) return
      activateMissionRun(run)
      if (mission.interior) enterInterior(mission.interior)
      if (mission.forceNight) forceNight(true)
      spawnCollectibles(run)
      spawnEscortPassenger(run)
      spawnShootoutActors(run)
      spawnSensorTiles(run)
      pointToNextStop()
    },
  })
  return true
}

export function startMissionById(id) {
  const mission = data.missions.missions.find((item) => item.id === id)
  if (!mission) return false
  unlocked.add(id)
  if (run) return false
  return startMission(mission)
}

/** Debug/audit helper: skip the typewriter and arm the live run. */
export function confirmMissionBriefing() {
  if (!run || run.status !== 'briefing') return false
  const mission = run.mission
  activateMissionRun(run)
  if (mission.interior) enterInterior(mission.interior)
  if (mission.forceNight) forceNight(true)
  spawnCollectibles(run)
  spawnEscortPassenger(run)
  spawnShootoutActors(run)
  spawnSensorTiles(run)
  pointToNextStop()
  return true
}

function ensureLoaner(mission) {
  const spec = mission.startVehicle || defaultLoaner(mission)
  if (!spec || loaners.has(mission.id)) return
  const vehicle = deps.spawnVehicle(
    deps.scene,
    deps.materials,
    deps.atlas,
    spec.archetype,
    spec.at.x,
    spec.at.z,
    spec.yaw || 0,
    'mission:' + mission.id
  )
  if (!vehicle) return
  vehicle.missionId = mission.id
  deps.vehicles.push(vehicle)
  loaners.set(mission.id, vehicle)
}

function defaultLoaner(mission) {
  const needsCar = mission.objectives.some((item) =>
    item.kind === 'goto-vehicle' || item.kind === 'escort'
  )
  if (!needsCar || mission.interior) return null
  return {
    archetype: 'compact',
    at: { x: mission.marker.x + 8, z: mission.marker.z + 4 },
    yaw: 0,
  }
}

export function updateMissions(dt) {
  if (!run || run.status !== 'active') {
    pulseQueued = false
    kickQueued = false
    return
  }

  if (run.rhythm && !run.completedKinds.includes('rhythm')) {
    updateRhythmBooth(dt)
  }

  const actor = {
    x: state.player.x,
    z: state.player.z,
    mode: state.mode,
    speed: player.vehicle?.speed || state.player.speed || 0,
    compliance: state.compliance.tier,
    bpm: state.radio.bpm || 120,
    pulse: pulseQueued,
    kick: kickQueued,
    aim: aimLane,
  }
  pulseQueued = false
  kickQueued = false

  const events = stepMissionRun(run, actor, dt)
  state.mission.elapsed = run.elapsed
  if (actor.x !== state.player.x || actor.z !== state.player.z) {
    teleportPlayer(actor.x, actor.z, state.player.yaw)
  }

  for (const event of events) handleEvent(event)

  if (run?.status === 'active') {
    updateObjectiveLine()
    updateCollectSpin(dt)
    updateHecklers(dt)
    updatePassenger()
    updateShootoutVisuals()
    updateSensorTiles()
  }
}

function handleEvent(event) {
  if (event.complianceDelta) {
    state.compliance.tier = clamp(state.compliance.tier + event.complianceDelta, 0, 5)
    setCompliance(state.compliance.tier)
  }
  switch (event.type) {
    case 'point':
      if (event.line) queueDialogue(event.line, { duration: 2.5 })
      pointToNextStop()
      break
    case 'collect':
      hidePickup(event.index)
      if (event.line) queueDialogue(event.line, { duration: 2.0 })
      pointToNextStop()
      break
    case 'collect-complete':
      pointToNextStop()
      break
    case 'rhythm-hit':
      flashBooth('#3DFF9E')
      break
    case 'rhythm-miss':
      flashBooth('#FF3D8A')
      if (event.line) queueDialogue(event.line, { duration: 1.4 })
      if (event.spawn) spawnHeckler(event.max || 5)
      break
    case 'sensor-trip':
      if (event.line) queueDialogue(event.line, { duration: 2.0 })
      break
    case 'sensors-shuffle':
      updateSensorTiles()
      break
    case 'escort-board':
      boardPassenger()
      pointToNextStop()
      toast('PASSENGER ABOARD')
      break
    case 'escort-speed':
      if (event.line) queueDialogue(event.line, { duration: 2.0 })
      break
    case 'evade-start':
      if (event.compliance != null) {
        state.compliance.tier = event.compliance
        setCompliance(event.compliance)
      }
      pointToNextStop()
      break
    case 'effect':
      if (event.handler === 'blackoutCity') applyBlackout(true)
      break
    case 'shootout-round':
      aimLane = 0
      break
    case 'shootout-score':
    case 'shootout-miss':
      if (event.line) queueDialogue(event.line, { duration: 1.4 })
      break
    case 'failed':
      failMission(event.line)
      break
    case 'complete':
      completeMission()
      break
    default:
      break
  }
}

function pointToNextStop() {
  if (!run) return
  const next = nextMissionPoint(run, state.player)
  if (!next) {
    if (run.evade && !run.completedKinds.includes('evade')) {
      setWaypoint(null)
      setObjective(formatObjective(run, data.missions.templates))
    }
    return
  }
  setMarker(next.point)
  const label = next.kind === 'collect'
    ? (run.mission.name + ' · RECORD ' + (run.collectedIndexes.length + 1))
    : next.kind === 'escort'
      ? (run.escortBoarded ? 'DROP OFF' : 'PICK UP')
      : (run.mission.name + ' · STOP ' + (run.completedPointIndexes.length + 1))
  setWaypoint(next.point, label)
  updateObjectiveLine()
}

function updateObjectiveLine() {
  if (!run) return
  setObjective(formatObjective(run, data.missions.templates))
}

function failMission(line) {
  const mission = run?.mission
  if (!mission) return
  teardownRun()
  setMarker(mission.marker)
  setWaypoint(mission.marker, mission.name)
  setObjective('RETRY · ' + mission.name)
  offered = mission
  queueDialogue(line || mission.objectives.find((item) => item.failLine)?.failLine, { blocking: true })
}

function completeMission() {
  const mission = run?.mission
  if (!mission) return
  completed.add(mission.id)
  for (const id of mission.reward?.unlocks || []) unlocked.add(id)
  unlockRadio(mission.reward?.radioUnlock || [])
  const endCard = !!mission.reward?.endCard
  teardownRun()
  setMarker(null)
  setWaypoint(null)
  setObjective(mission.name + ' COMPLETE')
  const unlockedNames = (mission.reward?.unlocks || []).join(' + ')
  if (unlockedNames) bus.emit('toast', unlockedNames + ' UNLOCKED')
  if (endCard) showEndCard()
  queueDialogue(mission.reward?.line, {
    blocking: true,
    onComplete: () => {
      offered = nextSupportedMission()
      if (offered) focusFirstMission()
      else setObjective('FREE ROAM · PORT VANTAGE IS YOURS')
    },
  })
}

function teardownRun() {
  const mission = run?.mission
  clearPickups()
  clearHecklers()
  clearSensors()
  clearShootoutActors()
  clearPassenger()
  if (blackoutOn) applyBlackout(false)
  if (mission?.forceNight) forceNight(false)
  if (state.interior) exitInterior()
  run = null
  state.mission.active = null
  state.mission.data = null
  pulseQueued = false
  kickQueued = false
}

function unlockRadio(ids) {
  if (!ids.length) return
  for (const station of data.radio.stations) {
    if (ids.includes(station.id)) station.unlocked = true
  }
  toast('STATIONS UNLOCKED · ' + ids.join(' + '))
  const first = data.radio.stations.find((station) => station.id === ids[0])
  if (first) setRadio(first)
}

function forceNight(on) {
  if (on) {
    state.grade.forced = 'night'
    state.grade.current = 'night'
    state.grade.target = 'night'
    state.grade.blend = 1
    applyGrade('night', 1)
  } else if (state.grade.forced === 'night') {
    state.grade.forced = null
  }
}

function applyBlackout(on) {
  blackoutOn = on
  const root = deps?.cityRoot || deps?.scene
  if (!root) return
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const name = obj.name || ''
    if (/emissive/i.test(name) && !/headlight|strobe|mission-marker|beacon/i.test(name)) {
      obj.visible = !on
    }
  })
  if (on) forceNight(true)
}

function spawnCollectibles(current) {
  clearPickups()
  const spec = current.collect
  if (!spec) return
  const visual = data.missions.pickups?.[spec.tag] || data.missions.pickups?.record
  for (let i = 0; i < spec.points.length; i++) {
    const point = spec.points[i]
    const mesh = makePropObject(
      deps.atlas,
      data.props,
      visual?.prop || 'record-crate',
      deps.materials,
      data.blocks.vertexLighting,
    )
    if (!mesh) continue
    mesh.name = 'pickup:' + spec.tag + ':' + i
    mesh.position.set(point.x, 0.2, point.z)
    mesh.userData.spin = visual?.spin || 1.6
    mesh.userData.bob = visual?.bob || 0.25
    mesh.userData.index = i
    deps.scene.add(mesh)
    pickups.push(mesh)
  }
}

function hidePickup(index) {
  const mesh = pickups.find((item) => item.userData.index === index)
  if (mesh) mesh.visible = false
}

function updateCollectSpin(dt) {
  const t = state.time
  for (const mesh of pickups) {
    if (!mesh.visible) continue
    mesh.rotation.y += (mesh.userData.spin || 1.6) * dt
    mesh.position.y = 0.35 + Math.sin(t * 2.2 + mesh.userData.index) * (mesh.userData.bob || 0.25)
  }
}

function clearPickups() {
  for (const mesh of pickups) {
    mesh.parent?.remove(mesh)
    mesh.traverse((obj) => obj.geometry?.dispose?.())
  }
  pickups.length = 0
}

function spawnHeckler(max) {
  if (hecklers.length >= max) return
  const mesh = makePed(
    data.npcs,
    'raver',
    'heckler-' + hecklers.length,
    deps.materials.actor,
    deps.atlas,
    data.blocks.vertexLighting,
  )
  const ang = Math.random() * Math.PI * 2
  mesh.position.set(state.player.x + Math.cos(ang) * 6, 0, state.player.z + Math.sin(ang) * 6)
  deps.scene.add(mesh)
  hecklers.push({ mesh, phase: Math.random() * 6 })
}

function updateHecklers(dt) {
  for (const heckler of hecklers) {
    const dx = state.player.x - heckler.mesh.position.x
    const dz = state.player.z - heckler.mesh.position.z
    const dist = Math.hypot(dx, dz) || 1
    if (dist > 2.2) {
      heckler.mesh.position.x += (dx / dist) * 1.6 * dt
      heckler.mesh.position.z += (dz / dist) * 1.6 * dt
      heckler.mesh.rotation.y = Math.atan2(dx, dz)
    }
    animatePed(heckler.mesh, data.npcs, dist > 2.2 ? 'walk' : 'idle', dt, 1.4, state.radio.beatPhase)
  }
}

function clearHecklers() {
  for (const heckler of hecklers) heckler.mesh.parent?.remove(heckler.mesh)
  hecklers.length = 0
}

function spawnEscortPassenger(current) {
  clearPassenger()
  if (!current.escort) return
  const mesh = makePed(
    data.npcs,
    'suit',
    'escort-passenger',
    deps.materials.actor,
    deps.atlas,
    data.blocks.vertexLighting,
  )
  mesh.position.set(current.escort.from.x, 0, current.escort.from.z)
  deps.scene.add(mesh)
  passenger = { mesh, boarded: false }
}

function boardPassenger() {
  if (!passenger) return
  passenger.boarded = true
}

function updatePassenger() {
  if (!passenger) return
  if (passenger.boarded && player.vehicle) {
    passenger.mesh.position.set(player.vehicle.x + 0.7, 0.2, player.vehicle.z)
    passenger.mesh.rotation.y = player.vehicle.yaw
    passenger.mesh.visible = true
  }
}

function clearPassenger() {
  if (passenger?.mesh) passenger.mesh.parent?.remove(passenger.mesh)
  passenger = null
}

function spawnShootoutActors(current) {
  clearShootoutActors()
  if (!current.customs.some((item) => item.handler === 'penaltyShootout')) return
  keeper = makePed(
    data.npcs,
    'tailgater',
    'keeper',
    deps.materials.actor,
    deps.atlas,
    data.blocks.vertexLighting,
  )
  keeper.position.set(0, 0, -28)
  deps.scene.add(keeper)
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#f4f0e0', toneMapped: false })
  )
  ball.position.set(0, 0.24, 16)
  deps.scene.add(ball)
}

function updateShootoutVisuals() {
  const shoot = run?.customState.shootout
  if (!shoot || !keeper) return
  const tell = shoot.tellTimer > 0 ? shoot.tell : (shoot.phase === 'resolve' ? shoot.keeperDive : 0)
  keeper.position.x = tell * 3.2
  keeper.position.z = -28
  if (ball) {
    if (shoot.phase === 'resolve') {
      ball.position.x = (aimLane || -shoot.keeperDive) * 3.4
      ball.position.z = -26
      ball.position.y = 0.8
    } else {
      ball.position.set(aimLane * 1.4, 0.24, 16)
    }
  }
}

function clearShootoutActors() {
  keeper?.parent?.remove(keeper)
  ball?.parent?.remove(ball)
  keeper = null
  ball = null
}

function spawnSensorTiles(current) {
  clearSensors()
  if (!current.avoid) return
  const origin = current.avoid.origin || { x: 0, z: 20 }
  current.avoid.origin = origin
}

function updateSensorTiles() {
  if (!run?.activeCells?.length) return
  if (!sensorTiles.length) {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    for (const cell of run.activeCells) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: '#1a3040',
          transparent: true,
          opacity: 0.55,
          toneMapped: false,
        })
      )
      mesh.position.set(cell.x, 0.06, cell.z)
      mesh.scale.set(cell.size * 0.92, 1, cell.size * 0.92)
      mesh.name = 'sensor:' + cell.id
      deps.scene.add(mesh)
      sensorTiles.push(mesh)
    }
  }
  for (let i = 0; i < sensorTiles.length; i++) {
    const cell = run.activeCells[i]
    const mesh = sensorTiles[i]
    if (!cell || !mesh) continue
    mesh.material.color.set(cell.active ? '#FF3D8A' : '#1a3040')
    mesh.material.opacity = cell.active ? 0.72 : 0.28
  }
}

function clearSensors() {
  for (const mesh of sensorTiles) {
    mesh.parent?.remove(mesh)
    mesh.material?.dispose?.()
  }
  sensorTiles.length = 0
}

function updateRhythmBooth(dt) {
  if (!run?.rhythm) return
  const interval = rhythmBeatInterval(run.rhythm, state.radio.bpm)
  const dueAt = (run.rhythmNextIndex + 1) * interval
  const until = dueAt - run.elapsed
  const window = (run.rhythm.windowMs || 110) / 1000
  const hot = Math.abs(until) <= window
  setBoothPulse(hot)
  if (dt) aimFromInput()
}

function setBoothPulse(hot) {
  const el = document.getElementById('objective')
  if (el) el.dataset.beat = hot ? '1' : '0'
}

function flashBooth(color) {
  const el = document.getElementById('objective')
  if (!el) return
  el.style.color = color
  setTimeout(() => { el.style.color = '' }, 120)
}

function aimFromInput() {
  // Stick / A-D live in input.move; missions.js reads the last noted lane.
}

export function noteAimLane(lane) {
  aimLane = lane < 0 ? -1 : lane > 0 ? 1 : 0
}

function showEndCard() {
  const card = document.getElementById('end-card')
  if (!card) return
  card.classList.remove('hidden')
  requestAnimationFrame(() => card.classList.add('show'))
  const dismiss = () => {
    card.classList.remove('show')
    setTimeout(() => card.classList.add('hidden'), 280)
    card.removeEventListener('click', dismiss)
  }
  card.addEventListener('click', dismiss)
}

function setMarker(point) {
  if (marker) {
    marker.visible = !!point
    if (point) marker.position.set(point.x, 0.04, point.z)
  }
  if (beacon) {
    beacon.visible = !!point
    if (point) beacon.position.set(point.x, 11, point.z)
  }
}

export function missionSnapshot() {
  return {
    offered: offered?.id || null,
    active: run?.mission.id || null,
    status: run?.status || null,
    elapsed: run?.elapsed || 0,
    completedPoints: run ? [...run.completedPointIndexes] : [],
    collected: run ? [...run.collectedIndexes] : [],
    completedKinds: run ? [...run.completedKinds] : [],
    rhythmHits: run?.rhythmHits || 0,
    rhythmMisses: run?.rhythmMisses || 0,
    escortBoarded: !!run?.escortBoarded,
    shootout: run?.customState.shootout
      ? { scored: run.customState.shootout.scored, dive: run.customState.shootout.keeperDive, phase: run.customState.shootout.phase }
      : null,
    interior: state.interior?.id || null,
    unlocked: [...unlocked],
    completed: [...completed],
    available: availableMissions().map((mission) => mission.id),
  }
}
