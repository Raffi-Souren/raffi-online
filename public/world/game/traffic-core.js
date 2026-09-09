/** Connected lane paths, safe headways and exclusive intersection reservations. No rendering or storage. */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const nodeId = (point) => `${point.x}|${point.z}`
const edgeId = (a, b) => [a, b].sort().join('>')
function random(fleet) { fleet.seed = (Math.imul(fleet.seed, 1664525) + 1013904223) >>> 0; return fleet.seed / 4294967296 }
function hash(text) { let n = 2166136261; for (const char of String(text)) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return n >>> 0 }

/** The whole configured fleet must fit a shared route, including shape jitter. */
export function trafficEnvelope(archetypes, ids) {
  const envelope = { width: 0, length: 0 }
  for (const id of ids || []) {
    const arch = archetypes?.[id]
    for (const axis of ['width', 'length']) {
      const value = arch?.silhouette?.[axis]
      const jitter = Math.abs(arch?.jitter?.[axis] || 0)
      if (Number.isFinite(value) && value > 0 && Number.isFinite(jitter)) envelope[axis] = Math.max(envelope[axis], value * (1 + jitter))
    }
  }
  return { width: envelope.width || 1.9, length: envelope.length || 4.6 }
}

/** Test the actual two lane centre lines; never invent a shifted safe route. */
export function trafficSegmentClear(segment, cfg, body, clearPose) {
  if (!(segment.length > 0)) return false
  const offset = Math.min(cfg.laneOffset, segment.halfWidth - 1.25)
  if (offset + body.width / 2 + .08 > segment.halfWidth) return false
  const dx = (segment.bx - segment.ax) / segment.length, dz = (segment.bz - segment.az) / segment.length
  // The earlier 8m samples could step over an entire pole between car probes.
  const count = Math.ceil(segment.length / Math.max(1, Math.min(2, body.width)))
  for (let i = 1; i < count; i++) for (const sign of [-1, 1]) {
    const pose = { x: segment.ax + dx * segment.length * i / count - dz * offset * sign, z: segment.az + dz * segment.length * i / count + dx * offset * sign, yaw: Math.atan2(dx, dz) }
    if (!clearPose(pose, body)) return false
  }
  return true
}

/** Oriented footprints plus clearance, including long parked trucks and turns. */
export function trafficBodiesOverlap(a, b, clearance = .55) {
  const dimensions = object => ({ width: object.width || object.mesh?.userData?.width || 1.8, length: object.length || object.mesh?.userData?.length || 4.5 })
  const aa = dimensions(a), bb = dimensions(b), ay = a.yaw || 0, by = b.yaw || 0
  for (const yaw of [ay, by]) for (const [x, z] of [[Math.sin(yaw), Math.cos(yaw)], [Math.cos(yaw), -Math.sin(yaw)]]) {
    const extent = (size, angle) => Math.abs(x * Math.sin(angle) + z * Math.cos(angle)) * size.length / 2 + Math.abs(x * Math.cos(angle) - z * Math.sin(angle)) * size.width / 2
    if (Math.abs((a.x - b.x) * x + (a.z - b.z) * z) >= extent(aa, ay) + extent(bb, by) + clearance) return false
  }
  return true
}

export function trafficNetwork(graph, allowed = () => true) {
  const nodes = new Map(), edges = new Map()
  for (const segment of graph.segments || []) {
    if (segment.length < 18 || !Number.isFinite(segment.halfWidth) || segment.halfWidth < 2.8 || !allowed(segment)) continue
    const edge = { ...segment, id: edgeId(segment.a, segment.b) }
    edges.set(edge.id, edge)
    for (const [id, x, z] of [[edge.a, edge.ax, edge.az], [edge.b, edge.bx, edge.bz]]) {
      if (!nodes.has(id)) nodes.set(id, { id, x, z, edges: [] })
      nodes.get(id).edges.push(edge)
    }
  }
  return { nodes, edges }
}
function between(network, a, b) { return network.edges.get(edgeId(a, b)) }
function other(edge, id) { return edge.a === id ? edge.b : edge.a }
function outgoing(fleet, from, at) {
  const choices = fleet.network.nodes.get(at)?.edges.filter((edge) => other(edge, at) !== from && fleet.network.nodes.get(other(edge, at)).edges.length > 1) || []
  if (!choices.length) return null
  return other(choices[Math.floor(random(fleet) * choices.length)], at)
}
function lane(edge, cfg) { return Math.min(cfg.laneOffset, edge.halfWidth - 1.25) }
function junctionTrim(network, id, cfg) { return Math.max(...network.nodes.get(id).edges.map((edge) => edge.halfWidth)) + cfg.junctionMargin }
const append = (list, p) => { const prev = list.at(-1); if (!prev || distance(prev, p) > 0.0001) list.push({ ...p, distance: (prev?.distance || 0) + (prev ? distance(prev, p) : 0) }) }

export function trafficPath(network, from, to, next, cfg) {
  const a = network.nodes.get(from), b = network.nodes.get(to), edge = between(network, from, to)
  if (!a || !b || !edge) return null
  const dx = (b.x - a.x) / edge.length, dz = (b.z - a.z) / edge.length
  const off = lane(edge, cfg), trimA = Math.min(edge.length / 3, junctionTrim(network, from, cfg)), trimB = Math.min(edge.length / 3, junctionTrim(network, to, cfg))
  const start = { x: a.x + dx * trimA - dz * off, z: a.z + dz * trimA + dx * off }
  const stop = { x: b.x - dx * trimB - dz * off, z: b.z - dz * trimB + dx * off }
  const points = []; append(points, start); append(points, stop)
  const entry = points.at(-1).distance
  if (next) {
    const c = network.nodes.get(next), following = between(network, to, next)
    if (!c || !following || next === from) return null
    const ux = (c.x - b.x) / following.length, uz = (c.z - b.z) / following.length
    const nextOff = lane(following, cfg), trimC = Math.min(following.length / 3, junctionTrim(network, to, cfg))
    const end = { x: b.x + ux * trimC - uz * nextOff, z: b.z + uz * trimC + ux * nextOff }
    // Tangents meet in the intersection; straight paths interpolate any lane-width change.
    const turning = Math.abs(dx * uz - dz * ux) > 0.1
    const control = { x: b.x - dz * off - uz * nextOff, z: b.z + dx * off + ux * nextOff }
    for (let i = 1; i <= 18; i++) {
      const t = i / 18, u = 1 - t
      append(points, turning ? { x: u * u * stop.x + 2 * u * t * control.x + t * t * end.x, z: u * u * stop.z + 2 * u * t * control.z + t * t * end.z } : { x: stop.x + (end.x - stop.x) * t, z: stop.z + (end.z - stop.z) * t })
    }
  }
  return { from, to, next, edge, points, entry, length: points.at(-1).distance }
}
export function trafficPose(path, at) {
  const d = clamp(at, 0, path.length)
  const i = Math.max(1, path.points.findIndex((point) => point.distance >= d))
  const a = path.points[i - 1], b = path.points[i], length = b.distance - a.distance
  const t = length ? (d - a.distance) / length : 0
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) }
}
export function createTrafficFleet(graph, cfg, seed = 'city', count = cfg.count.desktop, allowed) {
  const fleet = { network: trafficNetwork(graph, allowed), cars: [], reservations: new Map(), time: 0, seed: hash(seed), traversals: 0 }
  const choices = [...fleet.network.edges.values()].filter((edge) => fleet.network.nodes.get(edge.a).edges.length > 1 || fleet.network.nodes.get(edge.b).edges.length > 1)
  if (!choices.length) return fleet
  for (let i = 0; i < count; i++) {
    const opening = i === 0 && cfg.opening ? between(fleet.network, nodeId(cfg.opening.from), nodeId(cfg.opening.to)) : null
    let made = false
    for (let tries = 0; tries < 100 && !made; tries++) {
      const edge = opening && tries === 0 ? opening : choices[Math.floor(random(fleet) * choices.length)]
      let from = random(fleet) < 0.5 ? edge.a : edge.b
      if (opening && tries === 0) from = nodeId(cfg.opening.from)
      let to = other(edge, from)
      if (fleet.network.nodes.get(to).edges.length < 2) { const old = from; from = to; to = old }
      const next = outgoing(fleet, from, to)
      if (!next) continue
      const path = trafficPath(fleet.network, from, to, next, cfg)
      const progress = path.entry * (opening && tries === 0 ? cfg.opening.fraction : 0.05 + random(fleet) * 0.72)
      const pose = trafficPose(path, progress)
      if (fleet.cars.some((car) => distance(pose, car) < 12)) continue
      fleet.cars.push({ id: `traffic-${i}`, ...pose, path, progress, speed: 0, width: 1.8, length: 4.4, active: true, claimed: false, waiting: 0, arrival: null, junctions: 0, reason: null })
      made = true
    }
  }
  return fleet
}
export function trafficSignal(fleet, node, cfg) {
  if (fleet.network.nodes.get(node).edges.length < 3) return 'all'
  const span = cfg.greenSeconds + cfg.allRedSeconds
  const phase = (fleet.time + hash(node) % 11) % (span * 2)
  if (phase % span >= cfg.greenSeconds) return 'red'
  return phase < span ? 'horizontal' : 'vertical'
}
function obstructionGap(car, obstacle) {
  const dx = obstacle.x - car.x, dz = obstacle.z - car.z
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw)
  const forward = dx * fx + dz * fz
  if (forward < -0.1) return Infinity
  const angle = (obstacle.yaw || 0) - car.yaw
  const width = obstacle.width ? obstacle.width / 2 : obstacle.radius || 0.45
  const length = obstacle.length ? obstacle.length / 2 : obstacle.radius || 0.45
  const side = Math.abs(dx * fz - dz * fx)
  if (side > car.width / 2 + Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * length + 0.35) return Infinity
  return forward - car.length / 2 - Math.abs(Math.cos(angle)) * length - Math.abs(Math.sin(angle)) * width
}
function downstreamClear(fleet, car, obstacles, cfg) {
  const end = trafficPose(car.path, car.path.length)
  const probe = { ...car, ...end }
  return [...fleet.cars.filter((other) => other.active && other.id !== car.id), ...obstacles].every((other) => obstructionGap(probe, other) > car.length + cfg.gap)
}
export function claimTrafficCar(fleet, id) {
  const car = fleet.cars.find((item) => item.id === id)
  if (!car || car.claimed) return false
  car.claimed = true; car.active = false; car.speed = 0
  for (const [node, owner] of fleet.reservations) if (owner === id) fleet.reservations.delete(node)
  return true
}

/** Never enter a junction until its exit is free; one reservation spans the whole turn. */
export function stepTraffic(fleet, cfg, dt, obstacles = [], blocked = () => false) {
  if (!Number.isFinite(dt) || dt <= 0) return
  for (let remaining = Math.min(dt, 0.25); remaining > 0.000001;) {
    const h = Math.min(0.05, remaining); remaining -= h; fleet.time += h
    const live = fleet.cars.filter((car) => car.active)
    for (const [node, id] of fleet.reservations) {
      const owner = live.find((car) => car.id === id && car.path.to === node)
      if (!owner || (owner.waiting > 4 && owner.progress < owner.path.entry - 0.5)) { fleet.reservations.delete(node); if (owner) owner.arrival = fleet.time }
    }
    const requests = live.filter((car) => car.path.next && car.path.entry - car.progress < Math.max(16, car.speed * 3))
    for (const car of requests) if (car.arrival === null) car.arrival = fleet.time
    requests.sort((a, b) => a.arrival - b.arrival || a.id.localeCompare(b.id))
    for (const car of requests) {
      if (fleet.reservations.has(car.path.to)) continue
      const signal = trafficSignal(fleet, car.path.to, cfg)
      if (signal !== 'all' && signal !== (car.path.edge.horizontal ? 'horizontal' : 'vertical')) continue
      if (downstreamClear(fleet, car, obstacles, cfg)) fleet.reservations.set(car.path.to, car.id)
    }
    // Compute from the same pre-step poses so array order cannot make cars pass through each other.
    const moves = []
    for (const car of live) {
      let desired = car.path.edge.local ? cfg.localSpeed : cfg.speed
      let gap = Infinity, reason = null
      if (car.progress > car.path.entry - 8) desired = Math.min(desired, cfg.turnSpeed)
      if (!car.path.next || fleet.reservations.get(car.path.to) !== car.id) { gap = Math.max(0, car.path.entry - car.progress); reason = 'intersection' }
      for (const obstacle of [...live, ...obstacles]) {
        if (obstacle.id === car.id) continue
        const d = obstructionGap(car, obstacle) - cfg.gap
        if (d < gap) { gap = Math.max(0, d); reason = obstacle.type === 'pedestrian' ? 'pedestrian' : 'traffic' }
      }
      if (Number.isFinite(gap)) desired = Math.min(desired, Math.sqrt(Math.max(0, 2 * cfg.braking * gap)))
      let speed = Math.max(0, car.speed + clamp(desired - car.speed, -cfg.braking * h, cfg.acceleration * h))
      let delta = Math.min(speed * h, gap)
      const candidate = trafficPose(car.path, car.progress + delta)
      if (blocked(candidate, car)) { delta = 0; speed = 0; reason = 'obstacle' }
      moves.push({ car, delta, speed, reason })
    }
    for (const { car, delta, speed, reason } of moves) {
      car.speed = delta === 0 ? 0 : speed; car.reason = reason; car.progress += delta
      car.waiting = car.speed < 0.1 ? car.waiting + h : 0
      Object.assign(car, trafficPose(car.path, car.progress))
      if (car.progress < car.path.length - 0.001) continue
      if (fleet.reservations.get(car.path.to) === car.id) fleet.reservations.delete(car.path.to)
      car.junctions++; fleet.traversals++; car.arrival = null
      if (!car.path.next) { car.active = false; car.speed = 0; continue }
      const from = car.path.to, to = car.path.next, next = outgoing(fleet, from, to)
      car.path = trafficPath(fleet.network, from, to, next, cfg); car.progress = 0
      if (!car.path) { car.active = false; car.speed = 0 }
      else Object.assign(car, trafficPose(car.path, 0))
    }
  }
}
export function trafficSummary(fleet) {
  return { active: fleet.cars.filter((car) => car.active).length, claimed: fleet.cars.filter((car) => car.claimed).length, waiting: fleet.cars.filter((car) => car.active && car.speed < 0.1).length, moving: fleet.cars.filter((car) => car.active && car.speed > 0.5).length, junctions: fleet.traversals, reservations: fleet.reservations.size, time: fleet.time }
}
