/**
 * RAFFI WORLD — ?debug=1.
 *
 * Built on day one, deliberately. This build is authored by something that
 * cannot perceive motion or play the game, so every screenshot has to carry as
 * much state as possible: coordinates, heading, district, draw calls,
 * triangles, and the collision volumes that are otherwise invisible.
 *
 * Controls (desktop): F fly, G wireframe, C collision, V cycle grade,
 * arrow keys / WASD to fly, [ ] to change altitude.
 */

import * as THREE from 'three'
import { state, data, districtAt, query } from './state.js'
import { gfx, applyGrade } from './render.js'
import { cam } from './camera.js'
import { syncPlayerVisual } from '../game/player.js'

let els = {}
let overlay = null
let wireframeOn = false
let gradeIndex = 0
const GRADES = ['dusk', 'haze', 'night']

export const debugState = {
  fly: false,
  flyX: 0,
  flyY: 60,
  flyZ: 0,
  collide: false,
}

export function initDebug(elements, collisionWorld) {
  els = elements
  if (!state.debug.on) return

  els.root?.classList.remove('hidden')
  debugState.flyX = state.player.x
  debugState.flyZ = state.player.z

  buildCollisionOverlay(collisionWorld)

  els.buttons?.addEventListener('click', (e) => {
    const btn = e.target.closest('button')
    if (!btn) return
    toggle(btn.dataset.dbg)
    syncButtons()
  })

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') toggle('fly')
    else if (e.code === 'KeyG') toggle('wire')
    else if (e.code === 'KeyC') toggle('collide')
    else if (e.code === 'KeyV') toggle('grade')
    else return
    syncButtons()
  })

  syncButtons()
}

function toggle(what) {
  switch (what) {
    case 'fly':
      debugState.fly = !debugState.fly
      if (debugState.fly) {
        debugState.flyX = state.player.x
        debugState.flyZ = state.player.z
      }
      break
    case 'wire':
      wireframeOn = !wireframeOn
      for (const m of Object.values(gfx.materials)) {
        if (m && 'wireframe' in m && m !== gfx.materials.debug) m.wireframe = wireframeOn
      }
      break
    case 'collide':
      debugState.collide = !debugState.collide
      if (overlay) overlay.visible = debugState.collide
      break
    case 'grade':
      gradeIndex = (gradeIndex + 1) % GRADES.length
      state.grade.forced = GRADES[gradeIndex]
      state.grade.current = GRADES[gradeIndex]
      state.grade.target = GRADES[gradeIndex]
      state.grade.blend = 1
      applyGrade(GRADES[gradeIndex], 1)
      break
    default:
      break
  }
}

function syncButtons() {
  if (!els.buttons) return
  const map = { fly: debugState.fly, wire: wireframeOn, collide: debugState.collide, grade: !!state.grade.forced }
  for (const btn of els.buttons.querySelectorAll('button')) {
    btn.classList.toggle('on', !!map[btn.dataset.dbg])
  }
}

/** One merged wireframe mesh for every collider in the world. */
function buildCollisionOverlay(collisionWorld) {
  if (!collisionWorld) return
  const group = new THREE.Group()
  group.name = 'debug:collision'
  group.visible = false

  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8)

  const boxes = []
  const circles = []
  for (const c of collisionWorld.all) {
    if (c.type === 'circle') circles.push(c)
    else if (c.type === 'box') boxes.push(c)
  }

  if (boxes.length) {
    const mesh = new THREE.InstancedMesh(boxGeo, gfx.materials.debug, boxes.length)
    const m = new THREE.Matrix4()
    boxes.forEach((c, i) => {
      const h = c.height || 3
      m.compose(
        new THREE.Vector3(c.x, h / 2, c.z),
        new THREE.Quaternion(),
        new THREE.Vector3(c.hx * 2, h, c.hz * 2)
      )
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
  }

  if (circles.length) {
    const mesh = new THREE.InstancedMesh(cylGeo, gfx.materials.debug, circles.length)
    const m = new THREE.Matrix4()
    circles.forEach((c, i) => {
      m.compose(
        new THREE.Vector3(c.x, 1.5, c.z),
        new THREE.Quaternion(),
        new THREE.Vector3(c.r, 3, c.r)
      )
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
  }

  gfx.scene.add(group)
  overlay = group
}

/** Free flyover. Only reachable with ?debug=1. */
export function updateDebugCamera(dt, input) {
  if (!debugState.fly) return false
  const speed = (input.run ? 160 : 60) * dt
  const yaw = cam.currentYaw
  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)
  debugState.flyX += (fx * input.move.y - fz * input.move.x) * speed
  debugState.flyZ += (fz * input.move.y + fx * input.move.x) * speed
  if (input.held.has('action')) debugState.flyY += 40 * dt
  if (input.held.has('second')) debugState.flyY -= 40 * dt
  return true
}

let fpsAccum = 0
let fpsFrames = 0

export function updateDebugReadout(dt) {
  if (!state.debug.on || !els.readout) return
  fpsAccum += dt
  fpsFrames++
  if (fpsAccum >= 0.5) {
    state.stats.fps = Math.round(fpsFrames / fpsAccum)
    fpsAccum = 0
    fpsFrames = 0
  }
  if (state.frame % 6 !== 0) return

  const p = state.player
  const d = districtAt(p.x, p.z)
  const heading = ((p.yaw * 180) / Math.PI + 360) % 360
  const budget = data.world.render.budget
  const over = (v, max) => (v > max ? ' !!' : '')

  els.readout.textContent =
    `RAFFI WORLD  seed=${state.seed}\n` +
    `pos    ${p.x.toFixed(1)}, ${p.z.toFixed(1)}  y=${p.y.toFixed(2)}\n` +
    `head   ${heading.toFixed(0)}°   cam ${((cam.currentYaw * 180) / Math.PI % 360).toFixed(0)}°\n` +
    `dist   ${d ? d.id : '(between)'}   mode=${state.mode}\n` +
    `speed  ${p.speed.toFixed(2)} m/s (${(p.speed * 3.6).toFixed(0)} km/h)\n` +
    `grade  ${state.grade.current}${state.grade.forced ? ' [forced]' : ''}\n` +
    `radio  ${state.radio.on ? data.radio.stations[state.radio.stationIndex].id : 'off'} ${state.radio.bpm}bpm beat=${state.radio.beat}\n` +
    `compl  tier ${state.compliance.tier}\n` +
    `draws  ${state.stats.drawCalls}/${budget.drawCalls}${over(state.stats.drawCalls, budget.drawCalls)}\n` +
    `tris   ${state.stats.triangles}/${budget.triangles}${over(state.stats.triangles, budget.triangles)}\n` +
    `fps    ${state.stats.fps}   internal ${gfx.internal.w}x${gfx.internal.h}\n` +
    `fly    ${debugState.fly ? `on  y=${debugState.flyY.toFixed(0)}` : 'off'}`
}

/** The audit harness drives the camera through this. */
export function teleport(x, z, y = null) {
  state.player.x = x
  state.player.z = z
  syncPlayerVisual()
  cam.target.set(x, 0, z)
  if (y !== null) {
    debugState.fly = true
    debugState.flyX = x
    debugState.flyY = y
    debugState.flyZ = z
  }
}

/** Exposed on window for Playwright. See tools/audit.mjs. */
export function exposeAuditApi(api) {
  if (!query.debug) return
  window.RAFFI_WORLD = Object.assign(window.RAFFI_WORLD || {}, api, {
    teleport,
    setGrade(id) {
      state.grade.forced = id
      state.grade.current = id
      state.grade.target = id
      state.grade.blend = 1
      applyGrade(id, 1)
    },
    getState: () => JSON.parse(JSON.stringify({
      paused: state.paused,
      player: state.player,
      district: state.district,
      stats: state.stats,
      grade: state.grade.current,
      gradeForced: state.grade.forced,
      gradeTarget: state.grade.target,
      compliance: state.compliance,
    })),
  })
}
