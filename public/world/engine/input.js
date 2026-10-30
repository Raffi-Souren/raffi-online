/**
 * RAFFI WORLD — input. Mobile is the primary target; desktop is the port.
 *
 * Left thumb: a virtual analog stick that appears wherever the thumb lands and
 * then stays put. Right thumb: a context button whose label changes with the
 * situation, plus a secondary. In a vehicle the right side becomes accelerate
 * and brake and the stick becomes steering only.
 *
 * Desktop: WASD move, Space handbrake / micro-ride exit, E context, R radio, P phone, Tab pause,
 * Q / X rotate the view 90°.
 *
 * There is no gyroscope binding. The camera is fixed, so gyro has nothing to
 * control.
 */

import { device, bus, state } from './state.js'

export const input = {
  /** Screen-relative movement, -1..1 each axis. y+ is "away from viewer". */
  move: { x: 0, y: 0 },
  /** Magnitude 0..1 of the stick, before axis clamping. */
  moveAmount: 0,
  run: false,
  handbrake: false,
  throttle: 0,
  brake: 0,
  /** Edge-triggered; read with consume(). */
  pressed: new Set(),
  held: new Set(),
  pinch: 1,
  anyInputYet: false,
  look: { x: 0, y: 0 },
}

const keyMap = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'space',
  KeyE: 'action', Enter: 'action',
  KeyF: 'second',
  KeyJ: 'punch',
  KeyR: 'radio',
  KeyM: 'map',
  KeyP: 'phone',
  Backquote: 'cheats',
  Tab: 'pause', Escape: 'pause',
  KeyQ: 'rotate-left',
  KeyX: 'rotate-right',
  // Cycle camera mode (classic / birds / chase / free). Touch uses #btn-cam.
  KeyC: 'cam',
  KeyV: 'cam',
}

const keys = new Map()
const actionOwners = new Map()
function keyHeld(name) {
  for (const held of keys.values()) if (held === name) return true
  return false
}
let lastForwardTap = -Infinity
let forwardRun = false

/** True once and then cleared — use for menu presses, not held movement. */
export function consume(name) {
  if (input.pressed.has(name)) {
    input.pressed.delete(name)
    return true
  }
  return false
}

export function isHeld(name) { return input.held.has(name) }

function press(name, owner) {
  if (!actionOwners.has(name)) actionOwners.set(name, new Set())
  actionOwners.get(name).add(owner)
  if (!input.held.has(name)) input.pressed.add(name)
  input.held.add(name)
  input.anyInputYet = true
  bus.emit('input', name)
}

function release(name, owner) {
  const owners = actionOwners.get(name)
  if (!owners) return
  owners.delete(owner)
  if (!owners.size) {
    actionOwners.delete(name)
    input.held.delete(name)
  }
}

// ------------------------------------------------------------ keyboard ---

function onKeyDown(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  if (e.key !== 'Escape' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
  // Tab opens pause during play, then returns to its native focus-navigation
  // job inside the modal. Escape remains the keyboard close action.
  if (e.code === 'Tab' && state.paused) return
  const name = e.key === '?' ? 'cheats' : keyMap[e.code]
  if (!name) return
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.key === '?') e.preventDefault()
  if (e.repeat) return
  if (name === 'up' && state.mode !== 'vehicle' && !state.paused) {
    const now = performance.now()
    forwardRun = now - lastForwardTap < 300
    lastForwardTap = now
  }
  keys.set(e.code, name)
  press(name, e.code)
}

function onKeyUp(e) {
  const name = keys.get(e.code)
  if (!name) return
  keys.delete(e.code)
  if (name === 'up' && !keyHeld('up')) forwardRun = false
  release(name, e.code)
}

// --------------------------------------------------------------- touch ---

const stick = {
  id: null,
  originX: 0,
  originY: 0,
  x: 0,
  y: 0,
  radius: 52,
}

let els = {}
let lookPointer = null
let lookX = 0
let lookY = 0

function bindLook(canvas) {
  if (!canvas) return
  canvas.addEventListener('contextmenu', (event) => event.preventDefault())
  canvas.addEventListener('pointerdown', (event) => {
    if (state.paused || !state.ready || lookPointer !== null) return
    if (event.pointerType === 'touch' && event.clientX < canvas.clientWidth * 0.45) return
    lookPointer = event.pointerId
    lookX = event.clientX
    lookY = event.clientY
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('looking')
  })
  canvas.addEventListener('pointermove', (event) => {
    if (lookPointer !== event.pointerId || state.paused) return
    input.look.x += event.clientX - lookX
    input.look.y += event.clientY - lookY
    lookX = event.clientX
    lookY = event.clientY
  })
  const end = (event) => {
    if (lookPointer !== event.pointerId) return
    lookPointer = null
    canvas.classList.remove('looking')
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('lostpointercapture', end)
  canvas.addEventListener('wheel', (event) => {
    if (state.paused) return
    event.preventDefault()
    input.pinch = Math.max(0.75, Math.min(1.6, input.pinch + event.deltaY * 0.001))
    bus.emit('pinch', input.pinch)
  }, { passive: false })
}

function setStickVisual(on, ox, oy, kx, ky) {
  if (!els.base) return
  els.base.classList.toggle('on', on)
  if (on) {
    els.base.style.left = ox + 'px'
    els.base.style.top = oy + 'px'
    els.knob.style.transform = `translate(${kx}px, ${ky}px)`
  }
}

function onStickDown(e) {
  if (stick.id !== null || state.paused || !state.ready || e.button !== 0) return
  e.preventDefault()
  stick.id = e.pointerId
  els.zone.setPointerCapture(e.pointerId)
  const rect = els.zone.getBoundingClientRect()
  stick.originX = e.clientX - rect.left
  stick.originY = e.clientY - rect.top
  stick.x = 0
  stick.y = 0
  setStickVisual(true, stick.originX, stick.originY, 0, 0)
  input.anyInputYet = true
}

function onStickMove(e) {
  if (stick.id !== e.pointerId) return
  e.preventDefault()
  const rect = els.zone.getBoundingClientRect()
  let dx = e.clientX - rect.left - stick.originX
  let dy = e.clientY - rect.top - stick.originY
  const len = Math.hypot(dx, dy)
  if (len > stick.radius) {
    dx = (dx / len) * stick.radius
    dy = (dy / len) * stick.radius
  }
  // A small dead zone keeps a resting thumb from creeping or steering a car.
  const amount = Math.max(0, (Math.min(len / stick.radius, 1) - 0.1) / 0.9)
  stick.x = len ? dx / Math.min(len, stick.radius) * amount : 0
  stick.y = len ? dy / Math.min(len, stick.radius) * amount : 0
  setStickVisual(true, stick.originX, stick.originY, dx, dy)
}

function onStickUp(e) {
  if (stick.id !== e.pointerId) return
  stick.id = null
  stick.x = 0
  stick.y = 0
  setStickVisual(false)
}

function bindButton(el, name) {
  if (!el) return
  const up = (event) => release(name, event.pointerId)
  el.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    if (state.paused || !state.ready || event.button !== 0) return
    el.setPointerCapture(event.pointerId)
    press(name, event.pointerId)
  })
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(event, up)
}

// ---------------------------------------------------------------- init ---

export function resetInput() {
  keys.clear()
  lastForwardTap = -Infinity
  forwardRun = false
  actionOwners.clear()
  input.held.clear()
  input.pressed.clear()
  input.move.x = 0
  input.move.y = 0
  input.moveAmount = 0
  input.throttle = 0
  input.brake = 0
  input.run = false
  input.handbrake = false
  stick.id = null
  stick.x = 0
  stick.y = 0
  lookPointer = null
  input.look.x = 0
  input.look.y = 0
  els.canvas?.classList.remove('looking')
  setStickVisual(false)
}

export function initInput(elements) {
  els = elements
  bindLook(els.canvas)

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', resetInput)
  window.addEventListener('resize', resetInput)
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput() })

  if (els.zone) {
    els.zone.addEventListener('pointerdown', onStickDown)
    els.zone.addEventListener('pointermove', onStickMove)
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) els.zone.addEventListener(event, onStickUp)
  }

  // Touch primary is context on foot and held throttle while mounted. Keeping
  // it distinct from keyboard E prevents the first GAS press from exiting.
  bindButton(els.action, 'primary')
  bindButton(els.second, 'second')
  bindButton(els.punch, 'punch')
  bindButton(els.handbrake, 'handbrake')
  bindButton(els.radio, 'radio')
  bindButton(els.cam, 'cam')
  bindButton(els.exit, 'exit')
  bindButton(els.pauseButton, 'pause')
  bindButton(els.phoneButton, 'phone')

  for (const [id, delta] of [['btn-zoom-in', -.12], ['btn-zoom-out', .12]]) {
    document.getElementById(id)?.addEventListener('click', () => { if(state.paused)return; input.pinch=Math.max(.75,Math.min(1.6,input.pinch+delta));bus.emit('pinch',input.pinch) })
  }

  if (device.touch && els.touchRoot) els.touchRoot.classList.remove('hidden')
}

/** Folds keyboard and touch into the shared input struct. Call once per frame. */
/**
 * @param mode         'foot' | 'vehicle'
 * @param vehicleKind  optional archetype kind (e.g. 'skateboard') when mounted
 */
export function updateInput(mode, vehicleKind = null) {
  let mx = 0
  let my = 0

  if (keyHeld('left')) mx -= 1
  if (keyHeld('right')) mx += 1
  if (keyHeld('up')) my += 1
  if (keyHeld('down')) my -= 1

  if (stick.id !== null) {
    mx += stick.x
    my += -stick.y
  }

  const len = Math.hypot(mx, my)
  if (len > 1) { mx /= len; my /= len }
  input.move.x = mx
  input.move.y = my
  input.moveAmount = Math.min(len, 1)

  input.run = keyHeld('run') || (mode !== 'vehicle' && forwardRun && keyHeld('up')) || (mode !== 'vehicle' && input.held.has('second'))
  // Space = handbrake. CAM is reserved for camera-mode cycling, not drift.
  input.handbrake = keyHeld('space') || input.held.has('handbrake')

  if (mode === 'vehicle') {
    const gasBtn = input.held.has('primary') ? 1 : 0
    // Skateboard: secondary is kickflip (edge in main), not continuous brake.
    // Stick/S still brakes so you can stop without tricking.
    const brakeBtn = vehicleKind === 'skateboard' ? 0 : (input.held.has('second') ? 1 : 0)
    let throttle = Math.max(gasBtn, my > 0.12 ? my : 0)
    let brake = Math.max(brakeBtn, my < -0.12 ? -my : 0)
    // Panic mash: brake/reverse wins over gas so walls are escapable.
    if (brake > 0.05 && throttle > 0.05) throttle = 0
    input.throttle = throttle
    input.brake = brake
  } else {
    input.throttle = 0
    input.brake = 0
  }
}

/** Clears one-shot presses. Call at the very end of the frame. */
export function endInputFrame() {
  input.pressed.clear()
  input.look.x = 0
  input.look.y = 0
}

/** Updates the on-screen label of the context button. */
export function setActionLabel(text) {
  if (els.action && els.action.textContent !== text) els.action.textContent = text
}

export function setSecondLabel(text) {
  if (els.second && els.second.textContent !== text) els.second.textContent = text
}

export function setCamLabel(text) {
  if (els.cam && els.cam.textContent !== text) els.cam.textContent = text
}
