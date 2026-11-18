/**
 * RAFFI WORLD — side gigs on the street. Each gig in data/life.json has a
 * gold ring where it starts; walk in and press E, or open Gigs on the phone.
 * A delivery routes you stop to stop, a line keeps you on a board through
 * gates, and a hunt hides a pop-up set that only your phone's signal bars can
 * find. Finishing pays cash and Hustle; the giver texts you how it went.
 * One draw call for the rings, one for the beacon.
 */

import * as THREE from 'three'
import { state, data, bus } from '../engine/state.js'
import { cam } from '../engine/camera.js'
import { setObjective, setWaypoint, toast } from './hud.js'
import { createGigRun, gigPay, gigSignal, gigUnlocked, recordGig, stepGigRun } from './life-core.js'
import { earn, gainSkill, lifeEvent, lifeLevels, lifeProfile, markDirty } from './life.js'

const START_RADIUS = 3.6
const GOLD = 0xf2bd45
let deps = null
let rings = null, beacon = null
let run = null, gig = null
let objectiveAt = -1
const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
const scale = new THREE.Vector3()

const gigs = () => data.life?.gigs || []
const byId = (id) => gigs().find((entry) => entry.id === id) || null
const open = (entry) => gigUnlocked(entry, lifeLevels().hustle)
const clockText = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`
const rideOf = () => (state.mode !== 'vehicle' ? null : state.player.vehicle?.kind || 'car')

export function initGigs(options) {
  deps = options
  const group = new THREE.Group()
  group.name = 'gig-markers'
  rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.5, 0.09, 6, 28), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9, depthWrite: false, fog: true }), gigs().length)
  rings.name = 'gig-start-rings'
  rings.frustumCulled = false
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: true }))
  beacon.name = 'gig-beacon'
  beacon.visible = false
  group.add(rings, beacon)
  options.scene.add(group)
  place()
  publishMarkers()
  bus.on('kickflip', noteGigFlip)
}

function publishMarkers() {
  // The maps show where open gigs start, and nothing while one is running.
  state.gigMarkers = run ? [] : gigs().filter(open).map((entry) => entry.start)
}

function place() {
  const pulse = cam.reducedMotion ? 1 : 1 + Math.sin(state.time * 2.4) * 0.06
  gigs().forEach((entry, index) => {
    const shown = !run && !state.interior && open(entry)
    position.set(entry.start.x, 0.34, entry.start.z)
    scale.setScalar(shown ? pulse : 0)
    matrix.compose(position, rotation, scale)
    rings.setMatrixAt(index, matrix)
  })
  rings.instanceMatrix.needsUpdate = true
  const stop = run?.stops[run.step]
  if (stop && !state.interior) {
    const distance = Math.hypot(stop.x - state.player.x, stop.z - state.player.z)
    // A hunt's set only shows once you are nearly on top of it.
    beacon.visible = gig.kind !== 'hunt' || distance < 45
    beacon.position.set(stop.x, 3.5, stop.z)
    if (!cam.reducedMotion) beacon.rotation.y = state.time * 0.8
  } else beacon.visible = false
}

/** The context action when standing in a gig's ring on foot. */
export function gigContext() {
  if (run || state.mode !== 'foot' || state.interior || state.mission.active) return null
  let best = null, bestDistance = START_RADIUS
  for (const entry of gigs()) {
    if (!open(entry)) continue
    const distance = Math.hypot(entry.start.x - state.player.x, entry.start.z - state.player.z)
    if (distance <= bestDistance) { best = entry; bestDistance = distance }
  }
  return best && { x: best.start.x, z: best.start.z, radius: START_RADIUS, kind: 'gig', key: 'E', label: 'GIG', prompt: `START ${best.name} · ${best.giver.toUpperCase()}`, target: best.id }
}

/** Starts a gig. Returns null on success, or the reason it cannot start. */
export function startGig(id) {
  const entry = byId(id)
  if (!entry) return 'That gig is not on the board.'
  if (run) return 'Finish or drop the gig you’re on first.'
  if (state.mission.active) return 'Finish the job you’re on first.'
  if (state.interior) return 'Step outside to start a gig.'
  if (!open(entry)) return `${entry.giver} wants Hustle ${entry.hustle} first.`
  if (entry.ride && rideOf() !== entry.ride) {
    const failed = deps.deliverRide(entry.ride)
    if (failed) return failed
  }
  gig = entry
  run = createGigRun(entry, lifeProfile().gigs[entry.id]?.runs || 0)
  objectiveAt = -1
  aim()
  publishMarkers()
  toast(`${entry.name} · ${entry.giver}: ${entry.pitch}`, 6)
  bus.emit('sfx', 'ui-confirm')
  return null
}

function aim() {
  const stop = run.stops[run.step]
  // A hunt has no pin: the signal bars are the route.
  if (gig.kind === 'hunt' || !stop) setWaypoint(null)
  else setWaypoint(stop, stop.label || gig.name, 'gig')
}

function end(message, seconds = 5) {
  run = null
  gig = null
  setWaypoint(null)
  setObjective('')
  publishMarkers()
  if (message) toast(message, seconds)
}

/** Drops the running gig without a result (the phone, a mission or a loaded save). */
export function dropGig(message = 'Gig dropped. It’ll be there later.') {
  if (!run) return false
  end(message, 3)
  return true
}

function finish() {
  const profile = lifeProfile()
  const pay = gigPay(gig, run, lifeLevels(), data.life.skills)
  const result = recordGig(profile, gig, run, pay)
  const { id, name, giver } = gig
  const status = run.status
  const time = clockText(run.elapsed)
  if (status === 'done') {
    const hustle = data.life.skills.hustle
    end(`${name} DONE · +$${result.pay} · ${time}${result.best ? ' · new best' : ''}`)
    earn(0, { quiet: true })
    bus.emit('sfx', 'pickup')
    gainSkill('hustle', hustle.xpPerGig + (result.best ? hustle.xpPerBest : 0))
  } else if (status === 'off-ride') {
    end(`${name} · you left the board. ${giver} will have another.`)
    bus.emit('sfx', 'ui-deny')
  } else {
    end(`${name} · out of time. ${giver} will have another.`)
    bus.emit('sfx', 'ui-deny')
  }
  markDirty()
  lifeEvent({ type: 'gig', id, result: status, count: Object.values(profile.gigs).reduce((sum, record) => sum + record.wins, 0) })
}

/** One fixed step: advance the run, keep the objective and markers current. */
export function updateGigs(dt) {
  if (!rings) return
  if (run) {
    if (state.mission.active) dropGig('Gig dropped for the job. It’ll be there later.')
    else {
      const before = run.step
      stepGigRun(run, gig, { x: state.player.x, z: state.player.z, ride: rideOf() }, dt)
      if (run.status !== 'running') finish()
      else {
        if (run.step !== before) {
          const reached = run.stops[before]
          toast(`${reached.label || 'STOP'} ✓ · ${run.step}/${run.stops.length}`, 2.4)
          bus.emit('sfx', 'pickup')
          aim()
          objectiveAt = -1
        }
        if (state.time - objectiveAt >= 0.25) {
          objectiveAt = state.time
          const left = clockText(run.limit - run.elapsed)
          if (gig.kind === 'hunt') {
            const stop = run.stops[0]
            const bars = gigSignal(Math.hypot(stop.x - state.player.x, stop.z - state.player.z), gig.reach)
            setObjective(`${gig.name} · SIGNAL ${'▮'.repeat(bars)}${'▯'.repeat(5 - bars)} · ${left}`)
          } else {
            const offBoard = gig.ride && rideOf() !== gig.ride ? ' · GET BACK ON THE BOARD' : ''
            setObjective(`${gig.name} · ${run.step}/${run.stops.length} · ${left}${offBoard}`)
          }
        }
      }
    }
  }
  place()
  if (state.frame % 120 === 0) publishMarkers()
}

/** A kickflip during a line counts toward its trick bonus. */
function noteGigFlip() {
  if (run && gig.pay.perFlip) run.flips++
}

/** Gigs as the phone lists them. */
export function gigBoard() {
  const profile = lifeProfile()
  const hustle = lifeLevels().hustle
  return gigs().map((entry) => ({
    id: entry.id, name: entry.name, giver: entry.giver, pitch: entry.pitch, kind: entry.kind, start: entry.start,
    open: gigUnlocked(entry, hustle), hustle: entry.hustle || 1, from: entry.pay.base, seconds: entry.seconds,
    record: profile.gigs[entry.id] || null, active: run?.id === entry.id,
    near: Math.hypot(entry.start.x - state.player.x, entry.start.z - state.player.z) <= 14,
  }))
}

/** Read-only, for smokes. */
export function gigSnapshot() {
  return run ? { id: run.id, kind: run.kind, step: run.step, stops: run.stops.map(({ x, z, label }) => ({ x, z, label })), elapsed: run.elapsed, limit: run.limit, flips: run.flips, status: run.status } : null
}
