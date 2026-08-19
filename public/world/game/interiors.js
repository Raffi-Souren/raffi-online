/**
 * RAFFI WORLD — interior enter/exit. City root is hidden; collision swaps.
 */

import { state, data } from '../engine/state.js'
import { applyGrade } from '../engine/render.js'
import { teleportPlayer } from './player.js'
import { buildAllInteriors } from '../gen/interiors.js'

let deps = null
let rooms = new Map()
let cityCollision = null
let activeId = null
let returnPose = null

export function initInteriors(options) {
  deps = options
  cityCollision = options.cityCollision
  rooms = buildAllInteriors(
    data.world,
    options.atlas,
    options.materials,
    data.props,
    data.blocks.vertexLighting,
  )
  for (const room of rooms.values()) {
    options.scene.add(room.group)
    room.group.visible = false
  }
}

export function interiorById(id) {
  return rooms.get(id) || null
}

export function activeInterior() {
  return activeId ? rooms.get(activeId) || null : null
}

export function interiorDoorContext() {
  if (activeId) {
    const room = rooms.get(activeId)
    const spawn = room?.spec.spawn || { x: 0, z: 0 }
    return {
      x: spawn.x,
      z: (room?.spec.bounds.maxZ || 30) - 4,
      radius: 6,
      label: 'EXIT',
      prompt: 'EXIT ' + (room?.spec.name || 'INTERIOR'),
      kind: 'interior-exit',
      target: activeId,
    }
  }
  const px = state.player.x
  const pz = state.player.z
  let best = null
  let bestD = Infinity
  for (const spec of data.world.interiors || []) {
    const door = spec.exit
    if (!door) continue
    const dist = Math.hypot(door.x - px, door.z - pz)
    if (dist < 8 && dist < bestD) {
      bestD = dist
      best = {
        x: door.x,
        z: door.z,
        radius: 8,
        label: 'ENTER',
        prompt: 'ENTER ' + spec.name,
        kind: 'interior-enter',
        target: spec.id,
      }
    }
  }
  return best
}

export function enterInterior(id, options = {}) {
  const room = rooms.get(id)
  if (!room) return false
  if (activeId === id) return true

  if (!activeId) {
    returnPose = {
      x: state.player.x,
      z: state.player.z,
      yaw: state.player.yaw,
    }
  } else {
    const prev = rooms.get(activeId)
    if (prev) prev.group.visible = false
  }

  if (deps.cityRoot) deps.cityRoot.visible = false
  room.group.visible = true
  activeId = id
  state.interior = room.spec
  if (deps.world) deps.world.collision = room.collision

  const spawn = options.spawn || room.spec.spawn
  teleportPlayer(spawn.x, spawn.z, spawn.yaw || 0)

  if (room.spec.grade) {
    state.grade.current = room.spec.grade
    state.grade.target = room.spec.grade
    state.grade.blend = 1
    applyGrade(room.spec.grade, 1)
  }
  deps.onEnter?.(room)
  return true
}

export function exitInterior() {
  if (!activeId) return false
  const room = rooms.get(activeId)
  if (room) room.group.visible = false
  if (deps.cityRoot) deps.cityRoot.visible = true
  if (deps.world && cityCollision) deps.world.collision = cityCollision

  const exit = room?.spec.exit || returnPose
  const pose = returnPose || exit
  activeId = null
  state.interior = null
  if (pose) teleportPlayer(pose.x, pose.z, pose.yaw || 0)

  const grade = state.grade.forced || 'dusk'
  state.grade.current = grade
  state.grade.target = grade
  state.grade.blend = 1
  applyGrade(grade, 1)
  returnPose = null
  deps.onExit?.(room)
  return true
}

export function interiorSnapshot() {
  return {
    active: activeId,
    rooms: [...rooms.keys()],
  }
}
