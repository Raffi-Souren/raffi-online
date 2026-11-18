/**
 * RAFFI WORLD — Raf's flip phone (P, or the PHONE button on touch).
 *
 * A small XP-styled phone that pauses the street like the other overlays:
 * Radio tunes any unlocked station, Tapes lists your finds, Contacts routes
 * you to whoever has work, Lab opens a Lab room on the desktop, Map opens the
 * neighborhood map. Gigs lists paid work, Texts is what people sent you, Me is
 * your wallet and skills, Camera is photo mode. Every action is an ordinary
 * button, so it works by keyboard, touch and screen reader.
 */

import { state, data, clockText } from '../engine/state.js'
import { setObjective, setWaypoint } from './hud.js'
import { openMissions } from './missions.js'
import { tapesSnapshot } from './tapes.js'
import { dropGig, gigBoard, startGig } from './gigs.js'
import { lifeSnapshot, markTextsRead, noteTapeTip, pay, textThread } from './life.js'

const APPS = [
  { id: 'radio', label: 'Radio' },
  { id: 'tapes', label: 'Tapes' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'lab', label: 'Lab' },
  { id: 'map', label: 'Map' },
  { id: 'gigs', label: 'Gigs' },
  { id: 'texts', label: 'Texts' },
  { id: 'me', label: 'Me' },
  { id: 'camera', label: 'Camera' },
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
    clock.textContent = clockText()
  }
  panel.replaceChildren()
  panel.dataset.phoneApp = id
  ;({ radio, tapes, contacts, lab, map, gigs, texts, me, camera })[id]()
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
  // A tip routes you to the nearest tape you have not found. Each tape is paid for once.
  const missing = (data.tapes?.tapes || []).filter((tape) => !found.has(tape.id))
    .sort((a, b) => Math.hypot(a.at.x - state.player.x, a.at.z - state.player.z) - Math.hypot(b.at.x - state.player.x, b.at.z - state.player.z))
  if (missing.length) {
    const nearest = missing[0]
    const paid = lifeSnapshot().tips.includes(nearest.id)
    const price = data.life.prices.tapeTip
    row(paid ? 'Route to your last tip' : `Buy a tip · $${price}`, paid ? `${nearest.street} · already paid for` : 'Lena marks the nearest tape you’re missing', () => {
      if (state.mission.active) { panel.querySelector('p').textContent = 'Finish the job you’re on first.'; return }
      if (!paid && !pay(price, 'A tip')) { panel.querySelector('p').textContent = `A tip is $${price}. Gigs pay.`; return }
      noteTapeTip(nearest.id)
      setWaypoint(nearest.at, 'TAPE TIP')
      setObjective('TAPE TIP · ' + nearest.street.toUpperCase())
      deps.close()
    })
  }
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

const money = (value) => '$' + Math.round(value).toLocaleString('en-US')
const minutes = (value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`

function gigs() {
  const board = gigBoard()
  const active = board.find((gig) => gig.active)
  heading('Gigs', active ? `You’re on ${active.name}. The timer is running.` : 'Paid work. Gold rings on the street mark where each one starts.')
  if (active) row('Drop this gig', 'No pay, no hard feelings', () => { dropGig(); show('gigs') })
  for (const gig of board) {
    if (gig.active) continue
    if (!gig.open) { row(gig.name, `${gig.giver} wants Hustle ${gig.hustle} first`, () => {}, { disabled: true }); continue }
    const best = gig.record?.best ? ` · best ${minutes(gig.record.best)}` : ''
    row(`${gig.name} · from ${money(gig.from)}`, `${gig.giver}: ${gig.pitch}${best}`, () => {
      if (active) { panel.querySelector('p').textContent = 'Finish or drop the gig you’re on first.'; return }
      if (gig.near) {
        const problem = startGig(gig.id)
        if (problem) { panel.querySelector('p').textContent = problem; return }
      } else {
        if (state.mission.active) { panel.querySelector('p').textContent = 'Finish the job you’re on first.'; return }
        setWaypoint(gig.start, gig.name)
        setObjective('GO TO · ' + gig.name)
      }
      deps.close()
    })
  }
}

function texts() {
  const thread = textThread()
  heading('Texts', thread.length ? 'Newest first.' : 'Nothing yet. People text when something happens.')
  for (const text of thread) {
    const bubble = document.createElement('div')
    bubble.className = 'phone-text'
    if (text.unread) bubble.dataset.unread = 'true'
    const from = document.createElement('strong')
    from.textContent = text.unread ? `${text.from} · new` : text.from
    const body = document.createElement('span')
    body.textContent = text.body
    bubble.append(from, body)
    panel.append(bubble)
  }
  markTextsRead()
}

function me() {
  const life = lifeSnapshot()
  heading('Me', `${money(life.cash)} in your pocket · ${money(life.earned)} earned all time`)
  for (const [id, skill] of Object.entries(life.skills)) {
    const info = data.life.skills[id]
    const meter = document.createElement('div')
    meter.className = 'phone-skill'
    meter.setAttribute('role', 'img')
    meter.setAttribute('aria-label', `${info.name} level ${skill.level} of 5`)
    const label = document.createElement('strong')
    label.textContent = `${info.name} ${skill.level}`
    const detail = document.createElement('span')
    detail.textContent = skill.max ? `${info.perk} · maxed` : `${info.grows} · ${skill.toNext} to level ${skill.level + 1}`
    const bar = document.createElement('i')
    bar.style.setProperty('--fill', String(skill.fraction))
    meter.append(label, detail, bar)
    panel.append(meter)
  }
  const prices = data.life.prices
  row(`Bring my ride · ${money(prices.valet)}`, 'The valet drops your last car on the nearest street', () => {
    const problem = deps.valet()
    if (problem) { panel.querySelector('p').textContent = problem; return }
    deps.close()
  })
  row('Coffee carts', `${money(prices.coffee)} a cup · refills your sprint · look for the carts on the strip`, () => {}, { disabled: true })
}

function camera() {
  heading('Camera', 'The street holds still while you frame it. Photos save as PNG.')
  row('Open the camera', 'Five looks, from Disposable flash to Mono zine', () => deps.openCamera())
}

/** Marks the phone buttons and the Texts tab when texts are waiting. */
export function setPhoneUnread(count) {
  for (const id of ['btn-phone', 'desktop-phone']) {
    const button = document.getElementById(id)
    if (button) button.toggleAttribute('data-unread', count > 0)
  }
  const tab = tabs.find((entry) => entry.dataset.phoneApp === 'texts')
  if (tab) tab.textContent = count > 0 ? `Texts (${count})` : 'Texts'
}
