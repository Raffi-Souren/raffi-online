/** Full city navigator. All roads, districts and destinations use world data. */
import { state, data } from '../engine/state.js'
import { mapPlaces } from './minimap-details.js'
import { getWaypoint, setWaypoint, setObjective } from './hud.js'

let graph, root, canvas, context, notice, places = [], onClose
const COLORS = { heights: '#a98360', downtown: '#7397aa', strip: '#bb718c', yards: '#ac8860', bowl: '#769c85' }

export function initWorldMap(roadGraph, close) {
  graph = roadGraph
  onClose = close
  root = document.getElementById('world-map')
  canvas = document.getElementById('world-map-canvas')
  context = canvas.getContext('2d')
  notice = document.getElementById('world-map-notice')
  places = mapPlaces(data.world)
  const list = document.getElementById('world-map-places')
  for (const place of places) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = place.label
    button.addEventListener('click', () => markDestination(place, place.label))
    list.append(button)
  }
  document.getElementById('world-map-back').addEventListener('click', onClose)
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect()
    const view = projection()
    const x = ((event.clientX - rect.left) * canvas.width / rect.width - view.ox) / view.scale
    const z = ((event.clientY - rect.top) * canvas.height / rect.height - view.oy) / view.scale
    let closest = null, distance = Infinity
    for (const edge of graph.segments) {
      const dx = edge.bx - edge.ax, dz = edge.bz - edge.az
      const t = Math.max(0, Math.min(1, ((x - edge.ax) * dx + (z - edge.az) * dz) / (dx * dx + dz * dz)))
      const point = { x: edge.ax + dx * t, z: edge.az + dz * t }
      const d = Math.hypot(point.x - x, point.z - z)
      if (d < distance) { distance = d; closest = point }
    }
    if (closest) markDestination(closest, 'YOUR MAP PIN')
  })
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const buttons = Array.from(root.querySelectorAll('button:not(:disabled)'))
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  })
  window.addEventListener('resize', () => { if (isWorldMapOpen()) draw() })
}

function markDestination(place, label) {
  if (state.mission.active) {
    notice.textContent = 'Your active mission keeps its route. Finish it to choose a new destination.'
    return
  }
  setWaypoint(place, label, 'map')
  setObjective('GO TO · ' + label)
  notice.textContent = 'Route set: ' + label + '. Back to the block when you’re ready.'
  draw()
}

function projection() {
  const b = data.world.bounds
  const pad = 34
  const scale = Math.min((canvas.width - pad * 2) / (b.maxX - b.minX), (canvas.height - pad * 2) / (b.maxZ - b.minZ))
  return { scale, ox: (canvas.width - (b.maxX + b.minX) * scale) / 2, oy: (canvas.height - (b.maxZ + b.minZ) * scale) / 2 }
}

function draw() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(320, Math.round(rect.width * Math.min(devicePixelRatio || 1, 2)))
  canvas.height = Math.max(240, Math.round(rect.height * Math.min(devicePixelRatio || 1, 2)))
  const { scale, ox, oy } = projection()
  const x = (v) => ox + v * scale, y = (v) => oy + v * scale
  const ctx = context
  ctx.fillStyle = '#102939'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const b = data.world.bounds
  ctx.fillStyle = '#263c43'
  ctx.fillRect(x(b.minX), y(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale)
  for (const district of data.world.districts) {
    const d = district.bounds
    ctx.fillStyle = COLORS[district.id] + '40'
    ctx.fillRect(x(d.minX), y(d.minZ), (d.maxX - d.minX) * scale, (d.maxZ - d.minZ) * scale)
  }
  ctx.fillStyle = '#102939'
  for (const h of data.world.harbor) ctx.fillRect(x(h.minX), y(h.minZ), (h.maxX - h.minX) * scale, (h.maxZ - h.minZ) * scale)
  ctx.strokeStyle = '#89928d'
  ctx.lineCap = 'round'
  for (const edge of graph.segments) {
    ctx.lineWidth = Math.max(2, edge.halfWidth * scale * 1.1)
    ctx.beginPath(); ctx.moveTo(x(edge.ax), y(edge.az)); ctx.lineTo(x(edge.bx), y(edge.bz)); ctx.stroke()
  }
  ctx.font = `600 ${Math.max(11, canvas.width / 65)}px sans-serif`
  ctx.textAlign = 'center'
  for (const d of data.world.districts) {
    ctx.fillStyle = '#e7e1ce'
    ctx.fillText(d.name, x((d.bounds.minX + d.bounds.maxX) / 2), y(d.bounds.minZ + 24))
  }
  for (const place of places) {
    ctx.fillStyle = place.kind === 'paint' ? '#a6dbab' : '#efc978'
    ctx.beginPath(); ctx.arc(x(place.x), y(place.z), Math.max(3, canvas.width / 180), 0, Math.PI * 2); ctx.fill()
  }
  const target = getWaypoint()
  if (target) {
    ctx.strokeStyle = '#ffce6b'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x(target.x), y(target.z), 11, 0, Math.PI * 2); ctx.stroke()
  }
  const p = state.interior?.exit ? { ...state.interior.exit, yaw: state.player.yaw } : state.player
  ctx.save(); ctx.translate(x(p.x), y(p.z)); ctx.rotate(-p.yaw)
  ctx.fillStyle = '#c2f5f4'; ctx.strokeStyle = '#102939'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(-7, -7); ctx.lineTo(0, -3); ctx.lineTo(7, -7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
  ctx.fillStyle = '#a9c2c8'; ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillText('N ↑', 14, 24)
  canvas.setAttribute('aria-label', `Brooklyn city map. You are in ${state.district}. ${target ? 'Destination: ' + target.label : 'No destination set'}. Select a named place below to set a route.`)
}

export function showWorldMap() {
  root.classList.remove('hidden')
  notice.textContent = state.mission.active ? 'Active mission route. Named places remain available after the mission.' : 'Choose a place or tap a road to set your route.'
  draw()
  document.getElementById('world-map-back').focus()
}
export function hideWorldMap() { root?.classList.add('hidden') }
export function isWorldMapOpen() { return root && !root.classList.contains('hidden') }
