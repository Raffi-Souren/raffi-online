/**
 * RAFFI WORLD — data-driven mission runtime.
 *
 * The first vertical slice interprets timer + goto/goto-vehicle objectives,
 * enough to make DEAL CLOCK fully playable. Unsupported objective kinds are
 * never offered, so authored future missions cannot masquerade as finished.
 */

import * as THREE from 'three'
import { state, data, bus, clamp } from '../engine/state.js'
import { setWaypoint, setObjective, setCompliance } from './hud.js'
import { queueDialogue } from './dialogue.js'
import { makePropObject } from '../gen/props.js'
import {
  createMissionRun,
  activateMissionRun,
  stepMissionRun,
  nextMissionPoint,
  missionSecondsRemaining,
  formatMissionClock,
} from './mission-core.js'

const SUPPORTED_KINDS = new Set(['timer', 'goto', 'goto-vehicle'])

let deps = null
let marker = null
/** See-through beacon so goals between buildings stay visible under iso/chase. */
let beacon = null
let offered = null
let run = null
let loaners = new Map()
const unlocked = new Set()
const completed = new Set()

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

  // X-ray column: depthTest off so "drive to marker 1/4" is never lost behind
  // a brownstone. Generated geometry only — no sprites.
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
  return mission.objectives.every((objective) => SUPPORTED_KINDS.has(objective.kind))
}

function nextSupportedMission() {
  return data.missions.missions.find((mission) =>
    unlocked.has(mission.id) && !completed.has(mission.id) && isSupported(mission)
  ) || null
}

/** Called after the player chooses a ride or asks the subway for mission service. */
export function focusFirstMission() {
  if (!offered) offered = nextSupportedMission()
  if (!offered) return null
  setMarker(offered.marker)
  setWaypoint(offered.marker, offered.name)
  setObjective('GO TO · ' + offered.name)
  return offered
}

export function missionContext() {
  if (!offered || run) return null
  return {
    x: offered.marker.x,
    z: offered.marker.z,
    radius: 8,
    label: 'START',
    prompt: 'START ' + offered.name,
    kind: 'mission',
    target: offered,
  }
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
      pointToNextStop()
    },
  })
  return true
}

function ensureLoaner(mission) {
  const spec = mission.startVehicle
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

export function updateMissions(dt) {
  if (!run || run.status !== 'active') return
  const actor = {
    x: state.player.x,
    z: state.player.z,
    mode: state.mode,
  }
  const events = stepMissionRun(run, actor, dt)
  state.mission.elapsed = run.elapsed

  for (const event of events) {
    if (event.type === 'point') {
      if (event.complianceDelta) {
        state.compliance.tier = clamp(state.compliance.tier + event.complianceDelta, 0, 5)
        setCompliance(state.compliance.tier)
      }
      if (event.line) queueDialogue(event.line, { duration: 2.5 })
      pointToNextStop()
    } else if (event.type === 'failed') {
      failMission(event.line)
    } else if (event.type === 'complete') {
      completeMission()
    }
  }

  if (run?.status === 'active') updateObjectiveLine()
}

function pointToNextStop() {
  if (!run) return
  const next = nextMissionPoint(run, state.player)
  if (!next) return
  setMarker(next.point)
  setWaypoint(next.point, run.mission.name + ' · STOP ' + (run.completedPointIndexes.length + 1))
  updateObjectiveLine()
}

function updateObjectiveLine() {
  if (!run) return
  const total = run.route?.points?.length || 0
  const done = run.completedPointIndexes.length
  const clock = formatMissionClock(missionSecondsRemaining(run))
  const verb = run.route?.kind === 'goto-vehicle' ? 'DRIVE TO THE MARKER' : 'GO TO THE MARKER'
  setObjective(`${verb} (${done}/${total}) · ${clock}`)
}

function failMission(line) {
  const mission = run?.mission
  if (!mission) return
  run = null
  state.mission.active = null
  state.mission.data = null
  setMarker(mission.marker)
  setWaypoint(mission.marker, mission.name)
  setObjective('RETRY · ' + mission.name)
  queueDialogue(line || mission.objectives.find((item) => item.failLine)?.failLine, { blocking: true })
}

function completeMission() {
  const mission = run?.mission
  if (!mission) return
  completed.add(mission.id)
  for (const id of mission.reward?.unlocks || []) unlocked.add(id)
  run = null
  state.mission.active = null
  state.mission.data = null
  setMarker(null)
  setWaypoint(null)
  setObjective(mission.name + ' COMPLETE')
  bus.emit('toast', (mission.reward?.unlocks || []).join(' + ') + ' UNLOCKED')
  queueDialogue(mission.reward?.line, {
    blocking: true,
    onComplete: () => {
      offered = nextSupportedMission()
      if (offered) focusFirstMission()
      else setObjective('FREE ROAM · NEXT ASSIGNMENT PENDING')
    },
  })
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
    unlocked: [...unlocked],
    completed: [...completed],
  }
}
