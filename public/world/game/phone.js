/**
 * RAFFI WORLD — Raf's flip phone (P, or the PHONE button on touch).
 *
 * A small XP-styled phone that pauses the street like the other overlays:
 * Radio tunes any unlocked station, Tapes lists your finds, Contacts routes
 * you to whoever has work, Lab opens a Lab room on the desktop, Map opens the
 * neighborhood map. Every action is an ordinary button, so it works by
 * keyboard, touch and screen reader.
 */

import { state, data, newYorkHour, query } from '../engine/state.js'
import { setObjective, setWaypoint } from './hud.js'
import { openMissions } from './missions.js'
import { tapesSnapshot } from './tapes.js'

const APPS = [
  { id: 'radio', label: 'Radio' },
  { id: 'tapes', label: 'Tapes' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'lab', label: 'Lab' },
  { id: 'map', label: 'Map' },
]

let root = null, panel = null, clock = null, tabs = []
let current = 'radio'
let deps = null
let returnFocus = null

export function initPhone(options) {
  deps = options
  root = document.getElementById('phone')
  panel = document.getElementById('phone-panel')
  clock = document.getElementById('phone-clock')
  const nav = document.getElementById('phone-tabs')
  if (!root || !panel || !nav) return
  tabs = APPS.map((app) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = app.label
    button.dataset.phoneApp = app.id
    button.setAttribute('aria-pressed', 'false')
    button.addEventListener('click', () => show(app.id))
    nav.append(button)
    return button
  })
  document.getElementById('phone-close')?.addEventListener('click', () => deps.close())
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); deps.close(); return }
    if (event.key !== 'Tab') return
    const buttons = Array.from(root.querySelectorAll('button:not(:disabled)'))
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  })
}

export function isPhoneOpen() {
  return !!root && !root.classList.contains('hidden')
}

export function showPhone() {
  if (!root) return
  returnFocus = document.activeElement
  root.classList.remove('hidden')
  root.setAttribute('aria-hidden', 'false')
  show(current)
  root.querySelector(`[data-phone-app="${current}"]`)?.focus({ preventScroll: true })
}

export function hidePhone() {
  if (!root || !isPhoneOpen()) return
  root.classList.add('hidden')
  root.setAttribute('aria-hidden', 'true')
  if (returnFocus?.isConnected) returnFocus.focus?.({ preventScroll: true })
}

function show(id) {
  current = id
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.phoneApp === id))
  if (clock) {
    const now = new Date()
    const hour = query.clock === 'local' ? now.getHours() : newYorkHour(now)
    clock.textContent = String(hour).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  }
  panel.replaceChildren()
  panel.dataset.phoneApp = id
  ;({ radio, tapes, contacts, lab, map })[id]()
}

function heading(text, note) {
  const title = document.createElement('h3')
  title.textContent = text
  panel.append(title)
  if (note) {
    const line = document.createElement('p')
    line.textContent = note
    panel.append(line)
  }
}

function row(label, detail, onClick, options = {}) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'phone-row'
  if (options.pressed !== undefined) button.setAttribute('aria-pressed', String(options.pressed))
  button.disabled = !!options.disabled
  const strong = document.createElement('strong')
  strong.textContent = label
  button.append(strong)
  if (detail) {
    const small = document.createElement('span')
    small.textContent = detail
    button.append(small)
  }
  button.addEventListener('click', onClick)
  panel.append(button)
  return button
}

function radio() {
  heading('Radio', state.radio.on ? 'Tuned in. Pick a frequency.' : 'Off. Pick a frequency.')
  data.radio.stations.forEach((station, index) => {
    const tuned = state.radio.on && state.radio.stationIndex === index
    if (!station.unlocked) {
      row(`${station.id} · ${station.name}`, station.hostMixes ? 'Find a tape out on the street to tune in' : 'Locked for now', () => {}, { disabled: true })
      return
    }
    row(`${station.id} · ${station.name}`, tuned ? 'On air' : station.tagline, () => { deps.tune(index); show('radio') }, { pressed: tuned })
  })
  if (state.radio.on) row('Radio off', null, () => { deps.radioOff(); show('radio') })
}

function tapes() {
  const snapshot = tapesSnapshot()
  heading('Tapes', `${snapshot.found.length}/${snapshot.total} found. They’re on sidewalks and stoops all over.`)
  const found = new Set(snapshot.found)
  for (const [index, tape] of (data.tapes?.tapes || []).entries()) {
    const district = data.world.districts.find((entry) => entry.id === tape.district)?.name || tape.district
    const number = String(index + 1).padStart(2, '0')
    row(found.has(tape.id) ? `${number} · ${tape.title}` : `${number} · ???`, found.has(tape.id) ? `${tape.street}, ${district}` : `Somewhere in ${district}`, () => {}, { disabled: true })
  }
}

function contacts() {
  const open = openMissions()
  heading('Contacts', open.length ? 'Who has work for you. Pick one to get a route.' : 'Nobody’s calling right now. Check back after the next job.')
  for (const mission of open) {
    const district = data.world.districts.find((entry) => entry.id === mission.district)?.name || mission.district
    row(mission.name, district, () => {
      if (state.mission.active) { panel.querySelector('p').textContent = 'Finish the job you’re on first.'; return }
      setWaypoint(mission.marker, mission.name)
      setObjective('GO TO · ' + mission.name)
      deps.close()
    })
  }
}

function lab() {
  heading('Lab', 'Each room has a sign out on the street too. Opens in the desktop’s Lab window.')
  for (const room of data.world.labFronts || []) row(room.name, `${room.note} · sign on ${room.street}`, () => deps.openLab(room.slug))
}

function map() {
  heading('Map', 'The whole neighborhood. Tap a street to drop a pin.')
  row('Open the map', null, () => deps.openMap())
}
