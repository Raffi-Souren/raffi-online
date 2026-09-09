/** Small pooled street fleet. Claimed cars become ordinary parked/player rides permanently. */
import { state, data, device } from '../engine/state.js'
import { resolveCircle } from '../engine/physics.js'
import { spawnVehicle, player } from './player.js'
import { animateVehicle } from '../gen/vehicles.js'
import { createTrafficFleet, stepTraffic, claimTrafficCar, trafficSummary, trafficEnvelope, trafficSegmentClear, trafficBodiesOverlap } from './traffic-core.js'

let deps = null, fleet = null, recycle = 0
let envelope = { width: 1.9, length: 4.6 }
const rides = new Map()
function clearPose(pose, car) {
  const radius = car.width / 2 + 0.08
  const length = Math.max(0, car.length / 2 - radius)
  for (const shift of [-length, 0, length]) {
    const x = pose.x + Math.sin(pose.yaw) * shift, z = pose.z + Math.cos(pose.yaw) * shift
    const resolved = resolveCircle(deps.collision, x, z, radius, 2)
    if (resolved.hit) return false
  }
  return true
}
function allowedSegment(segment) {
  return trafficSegmentClear(segment, data.traffic, envelope, clearPose)
}
export function initTraffic(options) {
  deps = options
  const cfg = data.traffic
  if (!cfg || !deps.graph || !deps.collision) return
  envelope = trafficEnvelope(data.vehicles.archetypes, cfg.archetypes)
  fleet = createTrafficFleet(deps.graph, cfg, state.seed + ':traffic', device.mobile ? cfg.count.mobile : cfg.count.desktop, allowedSegment)
  for (const [index, car] of fleet.cars.entries()) {
    const archetype = cfg.archetypes[index % cfg.archetypes.length]
    const ride = spawnVehicle(deps.scene, deps.materials, deps.atlas, archetype, car.x, car.z, car.yaw, state.seed + ':' + car.id)
    if (!ride) { car.active = false; continue }
    ride.id = car.id; ride.traffic = true
    car.width = ride.mesh.userData.width || car.width; car.length = ride.mesh.userData.length || car.length
    // Traffic must never spawn over the user, another ride, or a solid street fixture.
    if (!clearPose(car, car) || deps.vehicles.some((other) => trafficBodiesOverlap(car, other)) || Math.hypot(state.player.x - car.x, state.player.z - car.z) < 5) {
      ride.mesh.removeFromParent(); ride.mesh.geometry?.dispose(); car.active = false; continue
    }
    rides.set(car.id, ride); deps.vehicles.push(ride)
  }
}
function obstacles() {
  const list = []
  for (const ride of deps.vehicles) {
    if (ride.traffic && !ride.occupied) continue
    if (!ride.mesh.visible) continue
    list.push({ id: ride.id || 'parked:' + ride.mesh.id, x: ride.x, z: ride.z, yaw: ride.yaw, width: ride.mesh.userData.width || 1.8, length: ride.mesh.userData.length || 4.5 })
  }
  for (const object of deps.scene.children) {
    if (!object.visible || !['biped', 'quadruped'].includes(object.userData?.rig)) continue
    list.push({ id: 'walker:' + object.id, x: object.position.x, z: object.position.z, radius: object.userData.rig === 'quadruped' ? 0.6 : 0.45, type: 'pedestrian' })
  }
  if (!player.vehicle) list.push({ id: 'player', x: state.player.x, z: state.player.z, radius: 0.5, type: 'pedestrian' })
  return list
}
export function updateTraffic(dt) {
  if (!fleet || state.paused || state.interior || !Number.isFinite(dt) || dt <= 0) return
  for (const car of fleet.cars) {
    const ride = rides.get(car.id)
    if (ride?.occupied && !car.claimed) { claimTrafficCar(fleet, car.id); ride.traffic = false }
  }
  stepTraffic(fleet, data.traffic, dt, obstacles(), (pose, car) => !clearPose(pose, car))
  for (const car of fleet.cars) {
    const ride = rides.get(car.id)
    if (!ride || car.claimed) continue
    const oldYaw = ride.yaw
    ride.x = car.x; ride.z = car.z; ride.yaw = car.yaw; ride.speed = car.speed; ride.traffic = car.active
    ride.mesh.position.set(car.x, 0, car.z); ride.mesh.rotation.y = car.yaw
    const yawDelta = Math.atan2(Math.sin(car.yaw - oldYaw), Math.cos(car.yaw - oldYaw))
    animateVehicle(ride.mesh, dt, car.speed, Math.max(-1, Math.min(1, yawDelta * 10)), car.speed < 0.5)
    if (car.active && car.waiting > data.traffic.stuckSeconds && Math.hypot(car.x - state.player.x, car.z - state.player.z) > data.traffic.despawnDistance) recycleCar(car)
  }
}
function recycleCar(car) {
  const fresh = createTrafficFleet(deps.graph, { ...data.traffic, opening: null }, state.seed + ':traffic-recycle:' + recycle++, 1, allowedSegment).cars[0]
  if (!fresh || !clearPose(fresh, car) || Math.hypot(fresh.x - state.player.x, fresh.z - state.player.z) < data.traffic.despawnDistance || deps.vehicles.some((ride) => Math.hypot(ride.x - fresh.x, ride.z - fresh.z) < 12)) return
  for (const [node, id] of fleet.reservations) if (id === car.id) fleet.reservations.delete(node)
  const id = car.id, width = car.width, length = car.length, junctions = car.junctions
  Object.assign(car, fresh, { id, width, length, junctions })
}
export function trafficSnapshot() {
  if (!fleet) return { active: 0, moving: 0, cars: [] }
  return { ...trafficSummary(fleet), networkEdges: fleet.network.edges.size, cars: fleet.cars.filter((car) => rides.has(car.id)).map((car) => ({ id: car.id, x: car.x, z: car.z, yaw: car.yaw, speed: car.speed, width: car.width, length: car.length, active: car.active, claimed: car.claimed, waiting: car.waiting, reason: car.reason, progress: car.progress, junctionEntry: car.path?.entry, local: Boolean(car.path?.edge.local), junctions: car.junctions, from: car.path?.from, to: car.path?.to, next: car.path?.next })) }
}
