/**
 * RAFFI WORLD — input. Mobile is the primary target; desktop is the port.
 *
 * Left thumb: a virtual analog stick that appears wherever the thumb lands and
 * then stays put. Right thumb: a context button whose label changes with the
 * situation, plus a secondary. In a vehicle the right side becomes accelerate
 * and brake and the stick becomes steering only.
 *
 * Desktop: WASD move, Space handbrake / micro-ride exit, E context, R radio, Tab pause,
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
  KeyR: 'radio',
  Tab: 'pause', Escape: 'pause',
  KeyQ: 'rotate-left',
  KeyX: 'rotate-right',
  // Cycle camera mode (classic / birds / chase / free). Touch uses #btn-cam.
  KeyC: 'cam',
  KeyV: 'cam',
}

const keys = new Set()

/** True once and then cleared — use for menu presses, not held movement. */
export function consume(name) {
  if (input.pressed.has(name)) {
    input.pressed.delete(name)
    return true
  }
  return false
}

export function isHeld(name) { return input.held.has(name) }

function press(name) {
  if (!input.held.has(name)) input.pressed.add(name)
  input.held.add(name)
  input.anyInputYet = true
  bus.emit('input', name)
}

function release(name) {
  input.held.delete(name)
}

// ------------------------------------------------------------ keyboard ---

function onKeyDown(e) {
  // Tab opens pause during play, then returns to its native focus-navigation
  // job inside the modal. Escape remains the keyboard close action.
  if (e.code === 'Tab' && state.paused) return
  const name = keyMap[e.code]
  if (!name) return
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault()
  if (e.repeat) return
  keys.add(name)
  press(name)
}

function onKeyUp(e) {
  const name = keyMap[e.code]
  if (!name) return
  keys.delete(name)
  release(name)
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
const activePinch = new Map()
let pinchStartDist = 0
let pinchStartValue = 1

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
  if (stick.id !== null) return
  const t = e.changedTouches ? e.changedTouches[0] : e
  stick.id = t.identifier ?? 'mouse'
  const rect = els.zone.getBoundingClientRect()
  stick.originX = t.clientX - rect.left
  stick.originY = t.clientY - rect.top
  stick.x = 0
  stick.y = 0
  setStickVisual(true, stick.originX, stick.originY, 0, 0)
  input.anyInputYet = true
}

function onStickMove(e) {
  if (stick.id === null) return
  const list = e.changedTouches ? Array.from(e.changedTouches) : [e]
  const t = list.find((p) => (p.identifier ?? 'mouse') === stick.id)
  if (!t) return
  const rect = els.zone.getBoundingClientRect()
  let dx = t.clientX - rect.left - stick.originX
  let dy = t.clientY - rect.top - stick.originY
  const len = Math.hypot(dx, dy)
  if (len > stick.radius) {
    dx = (dx / len) * stick.radius
    dy = (dy / len) * stick.radius
  }
  stick.x = dx / stick.radius
  stick.y = dy / stick.radius
  setStickVisual(true, stick.originX, stick.originY, dx, dy)
}

function onStickUp(e) {
  if (stick.id === null) return
  const list = e.changedTouches ? Array.from(e.changedTouches) : [e]
  if (!list.some((p) => (p.identifier ?? 'mouse') === stick.id)) return
  stick.id = null
  stick.x = 0
  stick.y = 0
  setStickVisual(false)
}

function bindButton(el, name) {
  if (!el) return
  const down = (e) => { e.preventDefault(); press(name) }
  const up = (e) => { e.preventDefault(); release(name) }
  el.addEventListener('touchstart', down, { passive: false })
  el.addEventListener('touchend', up, { passive: false })
  el.addEventListener('touchcancel', up, { passive: false })
  el.addEventListener('mousedown', down)
  window.addEventListener('mouseup', up)
}

// --------------------------------------------------------------- pinch ---

function onPinchStart(e) {
  for (const t of e.changedTouches) activePinch.set(t.identifier, t)
  if (activePinch.size === 2) {
    const [a, b] = Array.from(activePinch.values())
    pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    pinchStartValue = input.pinch
  }
}

function onPinchMove(e) {
  if (activePinch.size < 2) return
  for (const t of e.changedTouches) if (activePinch.has(t.identifier)) activePinch.set(t.identifier, t)
  const [a, b] = Array.from(activePinch.values())
  const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  if (pinchStartDist > 8) {
    input.pinch = pinchStartValue * (pinchStartDist / dist)
    bus.emit('pinch', input.pinch)
  }
}

function onPinchEnd(e) {
  for (const t of e.changedTouches) activePinch.delete(t.identifier)
}

// ---------------------------------------------------------------- init ---

export function initInput(elements) {
  els = elements

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', () => {
    keys.clear()
    input.held.clear()
    stick.id = null
    stick.x = 0
    stick.y = 0
    setStickVisual(false)
  })

  if (els.zone) {
    els.zone.addEventListener('touchstart', (e) => { e.preventDefault(); onStickDown(e) }, { passive: false })
    els.zone.addEventListener('touchmove', (e) => { e.preventDefault(); onStickMove(e) }, { passive: false })
    els.zone.addEventListener('touchend', onStickUp)
    els.zone.addEventListener('touchcancel', onStickUp)
    // Mouse fallback so the stick can be exercised in a desktop browser.
    els.zone.addEventListener('mousedown', onStickDown)
    window.addEventListener('mousemove', onStickMove)
    window.addEventListener('mouseup', onStickUp)
  }

  // Touch primary is context on foot and held throttle while mounted. Keeping
  // it distinct from keyboard E prevents the first GAS press from exiting.
  bindButton(els.action, 'primary')
  bindButton(els.second, 'second')
  bindButton(els.radio, 'radio')
  bindButton(els.cam, 'cam')
  bindButton(els.exit, 'exit')
  bindButton(els.pauseButton, 'pause')

  window.addEventListener('touchstart', onPinchStart, { passive: true })
  window.addEventListener('touchmove', onPinchMove, { passive: true })
  window.addEventListener('touchend', onPinchEnd, { passive: true })
  window.addEventListener('touchcancel', onPinchEnd, { passive: true })

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

  if (keys.has('left')) mx -= 1
  if (keys.has('right')) mx += 1
  if (keys.has('up')) my += 1
  if (keys.has('down')) my -= 1

  if (stick.id !== null) {
    mx += stick.x
    my += -stick.y
  }

  const len = Math.hypot(mx, my)
  if (len > 1) { mx /= len; my /= len }
  input.move.x = mx
  input.move.y = my
  input.moveAmount = Math.min(len, 1)

  input.run = keys.has('run') || (mode !== 'vehicle' && input.held.has('second'))
  // Space = handbrake. CAM is reserved for camera-mode cycling, not drift.
  input.handbrake = keys.has('space') || keys.has('handbrake')

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
