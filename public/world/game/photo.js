/**
 * RAFFI WORLD — the phone's camera. The street holds still while you orbit
 * within 12 m of yourself, pick a look and snap. A photo is the frame you
 * see, with the look and a small raffi.computer stamp, saved as a PNG.
 * Looks are colour filters over the finished frame, so they cost the
 * renderer nothing and never touch the city's own grade.
 */

import * as THREE from 'three'
import { state } from '../engine/state.js'
import { penetrationDepth } from '../engine/physics.js'

export const PHOTO_LOOKS = [
  { id: 'street', name: 'Street', filter: 'none', vignette: 0 },
  { id: 'disposable', name: 'Disposable flash', filter: 'contrast(1.18) saturate(1.25) brightness(1.07) sepia(0.14)', vignette: 0.55, date: true },
  { id: 'bliss', name: 'XP Bliss', filter: 'saturate(1.55) brightness(1.08) contrast(1.05) hue-rotate(-8deg)', vignette: 0 },
  { id: 'sodium', name: 'Sodium night', filter: 'sepia(0.55) saturate(1.6) hue-rotate(-18deg) contrast(1.12) brightness(0.92)', vignette: 0.4 },
  { id: 'zine', name: 'Mono zine', filter: 'grayscale(1) contrast(1.35)', vignette: 0.25 },
]
const MAX_DISTANCE = 12, MIN_DISTANCE = 1.8
const MIN_FOV = 24, MAX_FOV = 78

let deps = null
let root = null, note = null, lookButton = null, frame = null, dateEl = null
let camera = null
let open = false
let look = 0
const view = { yaw: 0, pitch: 0.2, distance: 6, fov: 50 }
let drag = null
const pinch = new Map()

export function initPhoto(options) {
  deps = options
  root = document.getElementById('photo')
  if (!root) return
  note = document.getElementById('photo-note')
  lookButton = document.getElementById('photo-look')
  frame = document.getElementById('photo-frame')
  dateEl = document.getElementById('photo-date')
  camera = new THREE.PerspectiveCamera(view.fov, 16 / 9, 0.15, 1400)
  camera.name = 'photo-camera'
  lookButton.addEventListener('click', () => { look = (look + 1) % PHOTO_LOOKS.length; applyLook() })
  document.getElementById('photo-wide').addEventListener('click', () => zoom(6))
  document.getElementById('photo-tight').addEventListener('click', () => zoom(-6))
  document.getElementById('photo-snap').addEventListener('click', () => { void snapPhoto() })
  document.getElementById('photo-done').addEventListener('click', () => deps.close())
  frame.addEventListener('pointerdown', (event) => {
    frame.setPointerCapture?.(event.pointerId)
    pinch.set(event.pointerId, { x: event.clientX, y: event.clientY })
    drag = pinch.size === 1 ? { x: event.clientX, y: event.clientY } : null
  })
  frame.addEventListener('pointermove', (event) => {
    if (!pinch.has(event.pointerId)) return
    const previous = pinch.get(event.pointerId)
    if (pinch.size === 2) {
      // Two fingers: pinch to move the camera in and out.
      const other = [...pinch.entries()].find(([id]) => id !== event.pointerId)[1]
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y)
      if (before > 0) dolly(view.distance * (before / Math.max(1, after)) - view.distance)
    } else if (drag) {
      orbit((event.clientX - drag.x) * -0.006, (event.clientY - drag.y) * 0.005)
      drag = { x: event.clientX, y: event.clientY }
    }
    pinch.set(event.pointerId, { x: event.clientX, y: event.clientY })
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) frame.addEventListener(type, (event) => { pinch.delete(event.pointerId); drag = null })
  frame.addEventListener('wheel', (event) => { event.preventDefault(); dolly(Math.sign(event.deltaY) * 0.8) }, { passive: false })
  root.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.2 : 0.08
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); deps.close() }
    else if (event.key === 'ArrowLeft') orbit(step, 0)
    else if (event.key === 'ArrowRight') orbit(-step, 0)
    else if (event.key === 'ArrowUp') orbit(0, step)
    else if (event.key === 'ArrowDown') orbit(0, -step)
    else if (event.key === '+' || event.key === '=') dolly(-0.8)
    else if (event.key === '-' || event.key === '_') dolly(0.8)
    else return
    event.preventDefault()
  })
  window.addEventListener('resize', () => { if (open) place() })
}

export const isPhotoOpen = () => open
/** The camera the frame should be drawn with while the viewfinder is up. */
export const photoCamera = () => (open ? camera : null)

export function showPhoto() {
  if (!root || open) return
  open = true
  const p = state.player
  const from = deps.gameCamera()
  // Start from where the game camera already is, so opening it does not jump.
  view.yaw = from ? Math.atan2(from.position.x - p.x, from.position.z - p.z) : p.yaw + Math.PI
  view.pitch = 0.22
  view.distance = 6
  view.fov = 50
  root.classList.remove('hidden')
  root.setAttribute('aria-hidden', 'false')
  document.body.classList.add('photo-mode')
  applyLook()
  document.getElementById('photo-snap').focus({ preventScroll: true })
}

export function hidePhoto() {
  if (!root || !open) return
  open = false
  drag = null
  pinch.clear()
  root.classList.add('hidden')
  root.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('photo-mode')
  deps.canvas().style.filter = ''
}

function applyLook() {
  const current = PHOTO_LOOKS[look]
  lookButton.textContent = 'Look: ' + current.name
  deps.canvas().style.filter = current.filter === 'none' ? '' : current.filter
  frame.style.setProperty('--vignette', String(current.vignette))
  dateEl.textContent = current.date ? dateStamp() : ''
  note.textContent = 'Drag to look around. Scroll or pinch to move in.'
  place()
}

function orbit(yaw, pitch) {
  view.yaw += yaw
  view.pitch = Math.max(-0.12, Math.min(1.25, view.pitch + pitch))
  place()
}
function dolly(delta) {
  view.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, view.distance + delta))
  place()
}
function zoom(delta) {
  view.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, view.fov + delta))
  place()
}

/** Puts the camera on its orbit, pulled in front of any wall between it and you. */
function place() {
  if (!open) return
  const p = state.player
  const focus = new THREE.Vector3(p.x, (p.y || 0) + 1.25, p.z)
  const dx = Math.sin(view.yaw) * Math.cos(view.pitch), dy = Math.sin(view.pitch), dz = Math.cos(view.yaw) * Math.cos(view.pitch)
  let distance = view.distance
  const collision = deps.collision()
  if (collision && !state.interior) {
    for (let d = 1; d <= view.distance; d += 0.4) {
      // Only walls at eye level block the shot; the camera can rise over low props.
      if (focus.y + dy * d < 3 && penetrationDepth(collision, focus.x + dx * d, focus.z + dz * d, 0.3) > 0) { distance = Math.max(MIN_DISTANCE * 0.6, d - 0.5); break }
    }
  }
  camera.position.set(focus.x + dx * distance, Math.max(0.5, focus.y + dy * distance), focus.z + dz * distance)
  camera.lookAt(focus)
  camera.fov = view.fov
  const canvas = deps.canvas()
  camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  deps.redraw()
}

function dateStamp(now = new Date()) {
  const part = (value) => String(value).padStart(2, '0')
  return `’${part(now.getFullYear() % 100)} ${part(now.getMonth() + 1)} ${part(now.getDate())}`
}

/** Draws the current frame with its look and stamp onto a 2D canvas. */
function compose() {
  const current = PHOTO_LOOKS[look]
  deps.render(camera)
  const source = deps.canvas()
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')
  // Older browsers without canvas filters still get the frame, just unfiltered.
  if (current.filter !== 'none' && 'filter' in ctx) ctx.filter = current.filter
  ctx.drawImage(source, 0, 0)
  ctx.filter = 'none'
  const w = out.width, h = out.height
  if (current.vignette > 0) {
    const shade = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.56)
    shade.addColorStop(0, 'rgba(0,0,0,0)')
    shade.addColorStop(1, `rgba(0,0,0,${current.vignette})`)
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, w, h)
  }
  const size = Math.max(12, Math.round(h * 0.024))
  ctx.textBaseline = 'alphabetic'
  ctx.font = `bold ${size}px Tahoma, Verdana, sans-serif`
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText('raffi.computer', w - size + 1, h - size + 1)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText('raffi.computer', w - size, h - size)
  if (current.date) {
    ctx.textAlign = 'left'
    ctx.font = `bold ${Math.round(size * 1.15)}px "Courier New", monospace`
    ctx.fillStyle = '#ff9a2e'
    ctx.fillText(dateStamp(), size, h - size)
  }
  return out
}

/** Takes the photo: composes it, offers the PNG, and reports what was saved. */
export async function snapPhoto({ download = true } = {}) {
  if (!open) return null
  const out = compose()
  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'))
  if (!blob) { note.textContent = 'The photo could not be saved. Try again.'; return null }
  const now = new Date()
  const part = (value) => String(value).padStart(2, '0')
  const name = `raffi-world-${now.getFullYear()}-${part(now.getMonth() + 1)}-${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}${part(now.getSeconds())}.png`
  if (download) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  frame.classList.remove('flash')
  void frame.offsetWidth
  frame.classList.add('flash')
  note.textContent = `Saved ${name}`
  const result = { name, width: out.width, height: out.height, bytes: blob.size, look: PHOTO_LOOKS[look].id }
  deps.taken?.(result)
  deps.redraw()
  return result
}

/** Read-only, for smokes. */
export const photoSnapshot = () => ({ open, look: PHOTO_LOOKS[look].id, ...view })
