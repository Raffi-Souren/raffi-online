// EmulatorJS owns this document. Replacing the iframe releases its runtime,
// audio, handlers and ROM URLs without touching the surrounding React app.
const cores = { nes: 'nes', snes: 'snes', gb: 'gb', gbc: 'gb', genesis: 'segaMD' }
let loaded = false
let romUrl = null
const report = (status) => parent.postMessage({ type: 'raffi-emulator:status', status }, location.origin)
const action = (text, input_value, left, top) => ({ type: 'button', text, id: text.toLowerCase(), location: 'right', left, top, bold: true, input_value })

function gamepad(core, layout) {
  const controls = [
    { type: layout === 'dpad' ? 'dpad' : 'zone', id: 'move', location: 'left', left: '50%', top: '50%', joystickInput: false, inputValues: [4, 5, 6, 7], color: '#9ac6ff' },
    { type: 'button', text: 'Start', id: 'start', location: 'center', left: 60, fontSize: 15, block: true, input_value: 3 },
    { type: 'button', text: core === 'segaMD' ? 'Mode' : 'Select', id: 'select', location: 'center', left: -5, fontSize: 15, block: true, input_value: 2 },
  ]
  if (core === 'snes') controls.push(action('X', 9, 40, 0), action('Y', 1, 0, 40), action('A', 8, 80, 40), action('B', 0, 40, 80),
    { ...action('L', 10, 3, -90), location: 'left', block: true }, { ...action('R', 11, 80, -90), block: true })
  else if (core === 'segaMD') controls.push(action('A', 1, -40, 70), action('B', 0, 20, 70), action('C', 8, 80, 70), action('X', 10, -40, 0), action('Y', 9, 20, 0), action('Z', 11, 80, 0))
  else controls.push(action('B', 0, 10, 70), action('A', 8, 80, 40))
  return controls
}

window.addEventListener('message', (event) => {
  if (event.source !== parent || event.origin !== location.origin || loaded) return
  const message = event.data
  if (message?.type !== 'raffi-emulator:load' || !Object.hasOwn(cores, message.core) || !(message.file instanceof Blob)) return
  loaded = true
  romUrl = URL.createObjectURL(message.file)
  window.EJS_player = '#game'
  window.EJS_core = cores[message.core]
  window.EJS_gameUrl = romUrl
  window.EJS_gameName = typeof message.file.name === 'string' ? message.file.name : 'My game'
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/'
  window.EJS_startOnLoaded = false
  window.EJS_color = '#2563eb'
  window.EJS_defaultOptions = { 'virtual-gamepad': navigator.maxTouchPoints > 0 ? 'enabled' : 'disabled' }
  window.EJS_VirtualGamepadSettings = gamepad(window.EJS_core, message.layout)
  window.EJS_ready = () => report('ready')
  window.EJS_onGameStart = () => report('playing')
  const loader = document.createElement('script')
  loader.src = window.EJS_pathtodata + 'loader.js'
  loader.onerror = () => report('error')
  document.head.append(loader)
})
window.addEventListener('error', () => { if (loaded) report('error') }, true)
window.addEventListener('unhandledrejection', () => { if (loaded) report('error') })
window.addEventListener('pagehide', () => { if (romUrl) URL.revokeObjectURL(romUrl) })
