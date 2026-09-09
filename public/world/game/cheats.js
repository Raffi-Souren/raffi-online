/** The yellow question box's game rewards. Same actions for buttons and codes. */
import { data, state } from '../engine/state.js'

let root, actions, result, codeField

export function initCheats(callbacks) {
  actions = callbacks
  root = document.getElementById('cheat-menu')
  result = document.getElementById('cheat-result')
  codeField = document.getElementById('cheat-code')
  const grid = document.getElementById('cheat-actions')
  for (const cheat of data.cheats.codes) {
    const button = document.createElement('button')
    button.type = 'button'
    const name = document.createElement('strong')
    name.textContent = cheat.label
    const key = document.createElement('kbd')
    key.textContent = cheat.code
    const description = document.createElement('span')
    description.textContent = cheat.description
    button.append(name, key, description)
    button.addEventListener('click', () => activateCheat(cheat.code))
    grid.append(button)
  }
  document.getElementById('cheat-form').addEventListener('submit', (event) => {
    event.preventDefault()
    activateCheat(codeField.value)
    codeField.value = ''
  })
  document.getElementById('cheat-close').addEventListener('click', () => actions.close())
  const stations = document.getElementById('cheat-stations')
  for (const [index, station] of data.radio.stations.entries()) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = station.name
    button.dataset.station = station.id
    button.addEventListener('click', () => {
      if (!station.unlocked) { result.textContent = 'Use MIXTAPE to unlock every station.'; return }
      actions.station(index)
      result.textContent = 'Tuned to ' + station.name + '.'
      syncStations()
    })
    stations.append(button)
  }
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const controls = Array.from(root.querySelectorAll('button:not(:disabled), input'))
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  })
}

function syncStations() {
  for (const button of root.querySelectorAll('[data-station]')) {
    const station = data.radio.stations.find((item) => item.id === button.dataset.station)
    button.setAttribute('aria-pressed', String(state.radio.on && station === data.radio.stations[state.radio.stationIndex]))
    button.title = station.unlocked ? 'Listen to ' + station.name : 'Unlock with MIXTAPE'
  }
}

export function activateCheat(code) {
  const cheat = data.cheats.codes.find((item) => item.code === String(code).trim().toUpperCase())
  if (!cheat) { if (result) result.textContent = 'Try one of the codes on this sheet.'; return false }
  const message = actions.apply(cheat)
  if (result) result.textContent = message || cheat.label + ' activated.'
  syncStations()
  return true
}

export function showCheats(code = null) {
  root.classList.remove('hidden')
  result.textContent = 'A few good records. A few shortcuts through the city.'
  if (code) activateCheat(code)
  syncStations()
  document.getElementById('cheat-close').focus()
}
export function hideCheats() { root?.classList.add('hidden') }
export function cheatsOpen() { return root && !root.classList.contains('hidden') }
