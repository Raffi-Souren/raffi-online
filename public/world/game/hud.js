/**
 * RAFFI WORLD — HUD.
 *
 * DOM on top of the canvas rather than drawn into the 512x288 buffer, so text
 * stays legible on a phone. Everything here respects the safe-area insets set
 * up in style.css.
 */

import { state, bus, data, device } from '../engine/state.js'

let els = {}
let toastTimer = 0
let dialogueOpen = false
const pendingToasts = []
let lastDistrict = null
let roadGraph = null
let mapContext = null
let waypoint = null
let routePoints = []
let routeOrigin = { x: Infinity, z: Infinity }

export function initHud(elements, graph = null) {
  els = elements
  roadGraph = graph
  mapContext = els.minimapCanvas?.getContext('2d') || null
  buildPips()
  els.root?.classList.remove('hidden')
  bus.on('district', (d) => showDistrict(d))
  bus.on('toast', (msg) => toast(msg))
  bus.on('dialogue-state', (open) => {
    dialogueOpen = !!open
    if (dialogueOpen && toastTimer > 0 && els.toast?.textContent) {
      pendingToasts.unshift({ msg: els.toast.textContent, seconds: toastTimer })
      toastTimer = 0
      els.toast.classList.remove('show')
    } else if (!dialogueOpen && pendingToasts.length) {
      const next = pendingToasts.shift()
      showToast(next.msg, next.seconds)
    }
  })

  const hub = data.world?.landmarks?.find((landmark) => landmark.type === 'mobility-hub')
  const firstMission = data.missions?.missions?.find((mission) => !mission.unlockedBy)
  if (hub?.marker) {
    setWaypoint(hub.marker, hub.name)
    setObjective('CHOOSE A RIDE OR TAKE THE SUBWAY')
  } else if (firstMission?.marker) {
    setWaypoint(firstMission.marker, firstMission.name)
    setObjective('GO TO · ' + firstMission.name)
  }
}

function buildPips() {
  if (!els.pips) return
  els.pips.innerHTML = ''
  for (let i = 0; i < 5; i++) els.pips.appendChild(document.createElement('i'))
}

export function showDistrict(district) {
  if (!district || district.id === lastDistrict) return
  lastDistrict = district.id
  if (els.district) {
    els.district.textContent = district.name
    els.district.style.color = districtAccent(district.id)
  }
  toast(district.name + ' — ' + (district.subtitle || ''))
}

function districtAccent(id) {
  const accents = {
    heights: '#ffc23a',
    downtown: '#8fb4ff',
    strip: '#ff3d8a',
    yards: '#c9be8e',
    bowl: '#3dff9e',
  }
  return accents[id] || '#ffc23a'
}

export function toast(msg, seconds = 2.6) {
  if (!els.toast) return
  if (dialogueOpen) {
    pendingToasts.push({ msg, seconds })
    return
  }
  showToast(msg, seconds)
}

function showToast(msg, seconds) {
  els.toast.textContent = msg
  els.toast.classList.add('show')
  toastTimer = seconds
}

export function subtitle(msg, seconds = 3.4) {
  if (msg) bus.emit('dialogue', { text: msg, duration: seconds })
}

export function setObjective(text) {
  if (els.objective) els.objective.textContent = text || ''
}

export function setInteractionPrompt(action) {
  const visible = action && action.kind !== 'none'
  els.interactionPrompt?.classList.toggle('show', !!visible)
  if (!visible) {
    // Clear stale EXIT/ENTER copy so tests and players do not read a hidden
    // previous prompt after dismounting mid-drive.
    if (els.interactionLabel) els.interactionLabel.textContent = ''
    if (els.interactionKey) els.interactionKey.textContent = ''
    return
  }
  if (els.interactionKey) els.interactionKey.textContent = device.touch ? 'TAP' : action.key || 'SPACE'
  if (els.interactionLabel) els.interactionLabel.textContent = action.prompt || action.label || 'INTERACT'
}

/**
 * Points the navigator at a world-space destination. Mission code can replace
 * this marker as objectives advance without knowing anything about the HUD.
 */
export function setWaypoint(point, label = 'WAYPOINT') {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    waypoint = null
    state.navigation.waypoint = null
    routePoints = []
    if (els.minimapLabel) els.minimapLabel.textContent = 'FREE ROAM'
    if (els.minimapDistance) els.minimapDistance.textContent = '-- M'
    return
  }

  waypoint = { x: point.x, z: point.z, label: String(label || 'WAYPOINT') }
  state.navigation.waypoint = { ...waypoint }
  routePoints = []
  routeOrigin = { x: Infinity, z: Infinity }
  if (els.minimapLabel) els.minimapLabel.textContent = waypoint.label
  drawMinimap()
}

export function getWaypoint() {
  return waypoint ? { ...waypoint } : null
}

export function setCompliance(tier) {
  if (!els.compliance) return
  els.compliance.dataset.tier = String(tier)
  const pips = els.pips?.children
  if (!pips) return
  for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < tier)
}

export function setRadio(station) {
  if (!els.radio) return
  if (!station) {
    els.radio.classList.add('hidden')
    return
  }
  els.radio.classList.remove('hidden')
  els.radioId.textContent = station.id
  els.radioName.textContent = station.name
  els.radioBpm.textContent = String(station.bpm)
}

export function updateHud(dt) {
  if (toastTimer > 0) {
    toastTimer -= dt
    if (toastTimer <= 0) els.toast?.classList.remove('show')
  }
  if (els.clock && state.frame % 30 === 0) {
    const d = new Date()
    els.clock.textContent =
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  }

  if (state.frame % 3 === 0) drawMinimap()
}

function drawMinimap() {
  const canvas = els.minimapCanvas
  const ctx = mapContext
  if (!canvas || !ctx) return

  const w = canvas.width
  const h = canvas.height
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) * 0.455
  const worldRadius = state.mode === 'vehicle' ? state.player.mountMapRadius || 190 : 115
  const pixelsPerMetre = radius / worldRadius
  const px = state.player.x
  const pz = state.player.z
  const district = data.world?.districts?.find((item) => item.id === state.district)
  const accent = districtAccent(district?.id)

  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = '#101a24'
  ctx.fillRect(0, 0, w, h)
  const wash = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius)
  wash.addColorStop(0, accent + '2e')
  wash.addColorStop(1, '#07101800')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)

  if (roadGraph?.segments) {
    // Two passes keep junctions clean: bright pavement/kerb beneath dark road.
    drawRoadPass(ctx, roadGraph.segments, px, pz, cx, cy, pixelsPerMetre, worldRadius, true)
    drawRoadPass(ctx, roadGraph.segments, px, pz, cx, cy, pixelsPerMetre, worldRadius, false)
  }

  if (waypoint) {
    if (!routePoints.length || Math.hypot(px - routeOrigin.x, pz - routeOrigin.z) > 18) {
      rebuildRoute(px, pz)
    }
    drawRoute(ctx, cx, cy, pixelsPerMetre, px, pz)
  }
  if (waypoint) drawWaypoint(ctx, cx, cy, radius, pixelsPerMetre, px, pz)
  drawPlayerArrow(ctx, cx, cy, state.player.yaw)

  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.lineWidth = 2
  ctx.stroke()

  if (waypoint) {
    const distance = routeDistance(px, pz)
    const rounded = distance >= 1000
      ? (distance / 1000).toFixed(1) + ' KM'
      : Math.max(0, Math.round(distance)) + ' M'
    if (els.minimapDistance) els.minimapDistance.textContent = rounded
    if (els.minimap) {
      els.minimap.setAttribute(
        'aria-label',
        `Local map. ${waypoint.label} waypoint, ${Math.round(distance)} metres away.`
      )
    }
  }
}

function drawRoadPass(ctx, segments, px, pz, cx, cy, scale, worldRadius, pavement) {
  for (const segment of segments) {
    const margin = segment.halfWidth + (roadGraph.sidewalkWidth || 0) + 6
    const minX = Math.min(segment.ax, segment.bx) - margin
    const maxX = Math.max(segment.ax, segment.bx) + margin
    const minZ = Math.min(segment.az, segment.bz) - margin
    const maxZ = Math.max(segment.az, segment.bz) + margin
    if (maxX < px - worldRadius || minX > px + worldRadius ||
        maxZ < pz - worldRadius || minZ > pz + worldRadius) continue

    ctx.beginPath()
    ctx.moveTo(cx + (segment.ax - px) * scale, cy + (segment.az - pz) * scale)
    ctx.lineTo(cx + (segment.bx - px) * scale, cy + (segment.bz - pz) * scale)
    ctx.lineCap = 'square'
    ctx.lineJoin = 'miter'
    if (pavement) {
      ctx.strokeStyle = '#d7c8ad'
      ctx.lineWidth = Math.max(4, (segment.halfWidth * 2 + (roadGraph.sidewalkWidth || 0) * 2) * scale)
    } else {
      ctx.strokeStyle = '#394d5c'
      ctx.lineWidth = Math.max(2, segment.halfWidth * 2 * scale)
    }
    ctx.stroke()
  }
}

function drawWaypoint(ctx, cx, cy, radius, scale, px, pz) {
  const dx = waypoint.x - px
  const dz = waypoint.z - pz
  const distance = Math.hypot(dx, dz)
  const ux = distance > 0.001 ? dx / distance : 0
  const uy = distance > 0.001 ? dz / distance : -1
  const markerDistance = Math.min(distance * scale, radius - 16)
  const mx = cx + ux * markerDistance
  const my = cy + uy * markerDistance

  ctx.save()
  ctx.beginPath()
  ctx.arc(mx, my, 10, 0, Math.PI * 2)
  ctx.fillStyle = '#ff3d8a'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#fff6d6'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(mx, my, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = '#ffc23a'
  ctx.fill()
  ctx.restore()
}

function rebuildRoute(px, pz) {
  routeOrigin = { x: px, z: pz }
  if (!waypoint) {
    routePoints = []
    return
  }

  if (!roadGraph?.nodes?.size || Math.hypot(waypoint.x - px, waypoint.z - pz) < 45) {
    routePoints = [{ x: px, z: pz }, { x: waypoint.x, z: waypoint.z }]
    return
  }

  const start = nearestNode(px, pz)
  const goal = nearestNode(waypoint.x, waypoint.z)
  if (!start || !goal) {
    routePoints = [{ x: px, z: pz }, { x: waypoint.x, z: waypoint.z }]
    return
  }

  const distances = new Map([[start.id, 0]])
  const previous = new Map()
  const open = new Set(roadGraph.nodes.keys())

  while (open.size) {
    let currentId = null
    let currentDistance = Infinity
    for (const id of open) {
      const d = distances.get(id) ?? Infinity
      if (d < currentDistance) { currentDistance = d; currentId = id }
    }
    if (currentId === null || currentId === goal.id) break
    open.delete(currentId)
    const node = roadGraph.nodes.get(currentId)
    for (const edge of node.edges) {
      const nextId = edge.a === currentId ? edge.b : edge.a
      if (!open.has(nextId)) continue
      const candidate = currentDistance + edge.length
      if (candidate < (distances.get(nextId) ?? Infinity)) {
        distances.set(nextId, candidate)
        previous.set(nextId, currentId)
      }
    }
  }

  if (start.id !== goal.id && !previous.has(goal.id)) {
    routePoints = [{ x: px, z: pz }, { x: waypoint.x, z: waypoint.z }]
    return
  }

  const ids = [goal.id]
  while (ids[0] !== start.id) ids.unshift(previous.get(ids[0]))
  routePoints = [
    { x: px, z: pz },
    ...ids.map((id) => {
      const node = roadGraph.nodes.get(id)
      return { x: node.x, z: node.z }
    }),
    { x: waypoint.x, z: waypoint.z },
  ]
}

function nearestNode(x, z) {
  let best = null
  let bestDistance = Infinity
  for (const node of roadGraph.nodes.values()) {
    const d = (node.x - x) ** 2 + (node.z - z) ** 2
    if (d < bestDistance) { bestDistance = d; best = node }
  }
  return best
}

function drawRoute(ctx, cx, cy, scale, px, pz) {
  if (routePoints.length < 2) return
  const points = [{ x: px, z: pz }, ...routePoints.slice(1)]
  for (const [color, width] of [['rgba(12, 15, 24, 0.9)', 8], ['#ffc23a', 4]]) {
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      const x = cx + (points[i].x - px) * scale
      const y = cy + (points[i].z - pz) * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
}

function routeDistance(px, pz) {
  if (!waypoint) return 0
  if (routePoints.length < 2) return Math.hypot(waypoint.x - px, waypoint.z - pz)
  const points = [{ x: px, z: pz }, ...routePoints.slice(1)]
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  }
  return total
}

function drawPlayerArrow(ctx, cx, cy, yaw) {
  const vx = Math.sin(yaw)
  const vy = Math.cos(yaw)
  const sx = -vy
  const sy = vx
  const tipX = cx + vx * 12
  const tipY = cy + vy * 12
  const baseX = cx - vx * 7
  const baseY = cy - vy * 7

  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(baseX + sx * 7, baseY + sy * 7)
  ctx.lineTo(baseX - sx * 7, baseY - sy * 7)
  ctx.closePath()
  ctx.fillStyle = '#39e6ff'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#fff'
  ctx.stroke()
}

/** Formats a mission objective line from missions.json templates. */
export function objectiveText(kind, vars = {}) {
  const tpl = data.missions.templates[kind]
  if (!tpl) return ''
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}
