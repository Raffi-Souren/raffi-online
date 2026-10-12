import assert from 'node:assert/strict'
import test from 'node:test'

class Surface extends EventTarget {
  style = {}
  classList = { add() {}, remove() {}, toggle() {} }
  getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 } }
  setPointerCapture() {}
}
globalThis.window = new Surface()
globalThis.document = new Surface()
document.getElementById = () => null
globalThis.location = { search: '' }
globalThis.screen = { width: 390, height: 844 }
globalThis.matchMedia = () => ({ matches: true })
window.devicePixelRatio = 2
const { state } = await import('../engine/state.js')
const { input, initInput, updateInput, resetInput } = await import('../engine/input.js')
const elements = Object.fromEntries(['zone', 'base', 'knob', 'action', 'second', 'handbrake', 'touchRoot'].map(name => [name, new Surface()]))
initInput(elements)
function emit(target, type, properties = {}) {
  target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { button: 0, clientX: 60, clientY: 80, ...properties }))
}
function pointer(target, type, pointerId, clientX = 60, clientY = 80) { emit(target, type, { pointerId, clientX, clientY }) }
function keyboard(type, code) { emit(window, type, { code, key: code }) }
test.beforeEach(() => { resetInput(); state.ready = true; state.paused = false; document.hidden = false })

test('a movement thumb and action thumb remain independent through a third pointer cancellation', () => {
  pointer(elements.zone, 'pointerdown', 1)
  pointer(elements.zone, 'pointermove', 1, 112, 80)
  pointer(elements.action, 'pointerdown', 2)
  pointer(elements.zone, 'pointerdown', 3)
  pointer(elements.zone, 'pointercancel', 3)
  updateInput('vehicle')
  assert.equal(input.move.x, 1)
  assert.equal(input.throttle, 1)
  pointer(elements.action, 'pointerup', 2)
  updateInput('vehicle')
  assert.equal(input.move.x, 1)
  assert.equal(input.throttle, 0)
  pointer(elements.zone, 'lostpointercapture', 1)
  updateInput('vehicle')
  assert.equal(input.moveAmount, 0)
})

test('multiple fingers and a keyboard key can share a held action without releasing one another', () => {
  keyboard('keydown', 'KeyF')
  pointer(elements.second, 'pointerdown', 2)
  pointer(elements.second, 'pointerdown', 3)
  keyboard('keyup', 'KeyF')
  pointer(elements.second, 'pointercancel', 2)
  updateInput('foot')
  assert.equal(input.run, true)
  pointer(elements.second, 'pointerup', 3)
  updateInput('foot')
  assert.equal(input.run, false)
})

test('W and ArrowUp release independently', () => {
  keyboard('keydown', 'KeyW')
  keyboard('keydown', 'ArrowUp')
  keyboard('keyup', 'ArrowUp')
  updateInput('foot')
  assert.equal(input.move.y, 1)
  keyboard('keyup', 'KeyW')
  updateInput('foot')
  assert.equal(input.move.y, 0)
})

test('a resting thumb has a dead zone and diagonal movement stays normalized', () => {
  pointer(elements.zone, 'pointerdown', 1)
  pointer(elements.zone, 'pointermove', 1, 63, 82)
  updateInput('foot')
  assert.equal(input.moveAmount, 0)
  pointer(elements.zone, 'pointermove', 1, 160, -20)
  updateInput('foot')
  assert.ok(Math.abs(Math.hypot(input.move.x, input.move.y) - 1) < 1e-10)
})

test('blur, rotation and hiding clear controls and stale pointer moves cannot rearm them', () => {
  for (const [target, event] of [[window, 'blur'], [window, 'resize'], [document, 'visibilitychange']]) {
    pointer(elements.zone, 'pointerdown', 1)
    pointer(elements.zone, 'pointermove', 1, 112, 80)
    pointer(elements.action, 'pointerdown', 2)
    keyboard('keydown', 'KeyW')
    document.hidden = true
    emit(target, event)
    pointer(elements.zone, 'pointermove', 1, 130, 80)
    updateInput('vehicle')
    assert.equal(input.moveAmount, 0, event)
    assert.equal(input.throttle, 0, event)
    assert.equal(input.held.size, 0, event)
    document.hidden = false
  }
})

test('paused touch controls cannot queue movement or acceleration for resume', () => {
  state.paused = true
  pointer(elements.zone, 'pointerdown', 1)
  pointer(elements.zone, 'pointermove', 1, 112, 80)
  pointer(elements.action, 'pointerdown', 2)
  state.paused = false
  updateInput('vehicle')
  assert.equal(input.moveAmount, 0)
  assert.equal(input.throttle, 0)
})
