import * as THREE from 'three'
import { state, data } from '../engine/state.js'
import { player, enterVehicle, teleportPlayer } from './player.js'
import { resetInput, input } from '../engine/input.js'
import { paintVehicle } from '../gen/vehicles.js'
import { setCameraMode } from '../engine/camera.js'
import { setWaypoint, toast } from './hud.js'
import { createSprint, stepSprint, createHandheld, stepHandheld } from './side-activities-core.js'

let garage,
  panel,
  vehicle,
  marker,
  sprint,
  finishSeen = false,
  best = null
let handheld = createHandheld(),
  direction = 0,
  screen,
  status,
  startButton
let garagePoint, cars, launchPoint, route
let skidMesh,
  skidCursor = 0,
  lastSkid = null
export function sideActivityOpen() {
  return !!garage?.open
}

export function initSideActivities(scene, vehicles) {
  cars = vehicles
  const skidGeometry = new THREE.BufferGeometry()
  skidGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(120 * 18), 3))
  skidMesh = new THREE.Mesh(
    skidGeometry,
    new THREE.MeshBasicMaterial({
      color: '#121826',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  )
  skidMesh.frustumCulled = false
  skidMesh.visible = false
  scene.add(skidMesh)
  const config = data.world.sideActivities
  garagePoint = config.garage
  launchPoint = config.sprint.start
  route = config.sprint.route
  marker = new THREE.Mesh(
    new THREE.TorusGeometry(7, 0.18, 5, 24),
    new THREE.MeshBasicMaterial({ color: '#a4fce3', transparent: true, opacity: 0.8, depthWrite: false })
  )
  marker.rotation.x = Math.PI / 2
  marker.visible = false
  scene.add(marker)
  panel = document.createElement('div')
  panel.id = 'side-activities'
  panel.innerHTML =
    '<button type="button" id="garage-open">Crib Garage · G</button><div id="sprint-status" role="status"></div><button type="button" id="sprint-cancel" hidden>End sprint</button>'
  document.body.append(panel)
  panel.querySelector('#garage-open').addEventListener('click', openGarage)
  panel.querySelector('#sprint-cancel').addEventListener('click', () => {
    sprint = null
    marker.visible = false
    setWaypoint(null)
    toast('Sprint ended. Free roam.')
    updateSideActivities(0)
  })
  garage = document.createElement('dialog')
  garage.id = 'crib-garage'
  garage.setAttribute('aria-labelledby', 'garage-title')
  garage.innerHTML = `<header><div><small>PORT VANTAGE / CUSTOMS</small><h2 id="garage-title">The Crib Garage</h2></div><button type="button" id="garage-close" aria-label="Return to World">×</button></header>
    <p id="garage-car"></p><fieldset><legend>Fresh paint · instant preview on your car</legend><div id="garage-paints"></div></fieldset>
    <button type="button" id="garage-tune">Fit street tires</button><p id="garage-note" role="status">Paint and tuning stay on this car for this visit.</p>
    <section><h3>Harbor Sprint</h3><p>Six checkpoints. 90 seconds. Your customized car moves to the start. Follow the mint rings; brake before corners.</p><button type="button" id="garage-race">Start street time trial</button></section>
    <details id="glovebox"><summary>Open the glovebox</summary><div class="pocket-console"><div class="pocket-label">RAF PORTABLE · 01</div><canvas width="480" height="272" aria-label="Night Shift hover racer"></canvas><p id="pocket-status" role="status">NIGHT SHIFT · an original WipEout-inspired hover run. Survive 60 seconds. Arrow keys or the buttons steer.</p><div class="pocket-controls"><button type="button" id="pocket-left" aria-label="Steer handheld left">◀</button><button type="button" id="pocket-start">Play Night Shift</button><button type="button" id="pocket-pause">Pause run</button><button type="button" id="pocket-right" aria-label="Steer handheld right">▶</button></div></div></details>`
  document.body.append(garage)
  screen = garage.querySelector('canvas')
  status = garage.querySelector('#pocket-status')
  startButton = garage.querySelector('#pocket-start')
  garage.querySelector('#garage-close').addEventListener('click', closeGarage)
  garage.addEventListener('cancel', (event) => {
    event.preventDefault()
    closeGarage()
  })
  garage.addEventListener('keydown', (event) => {
    event.stopPropagation()
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault()
      direction = event.code === 'ArrowLeft' ? -1 : 1
    }
  })
  garage.addEventListener('keyup', (event) => {
    event.stopPropagation()
    if (event.code.startsWith('Arrow')) direction = 0
  })
  garage.addEventListener('close', () => {
    direction = 0
    resetInput()
  })
  garage.querySelector('#glovebox').addEventListener('toggle', (event) => {
    if (!event.target.open) direction = 0
  })
  for (const [id, value] of [
    ['pocket-left', -1],
    ['pocket-right', 1],
  ]) {
    const button = garage.querySelector('#' + id)
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      button.setPointerCapture(event.pointerId)
      direction = value
    })
    for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(kind, () => {
        direction = 0
      })
  }
  startButton.addEventListener('click', () => {
    handheld = createHandheld()
    handheld.phase = 'playing'
    direction = 0
    startButton.textContent = 'Restart run'
    screen.focus()
  })
  garage.querySelector('#pocket-pause').addEventListener('click', () => {
    if (handheld.phase === 'playing') handheld.phase = 'paused'
    else if (handheld.phase === 'paused') handheld.phase = 'playing'
    direction = 0
    drawHandheld()
  })
  screen.tabIndex = 0
  for (const [name, body, roof] of config.paints) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = name
    button.style.borderBottom = `4px solid ${body}`
    button.addEventListener('click', () => {
      paintVehicle(vehicle.mesh, body, roof)
      garage.querySelector('#garage-note').textContent = name + ' applied.'
    })
    garage.querySelector('#garage-paints').append(button)
  }
  garage.querySelector('#garage-tune').addEventListener('click', () => {
    const base = data.vehicles.archetypes[vehicle.archetypeId].handling
    vehicle.handling = { ...base, grip: base.grip * 1.12, steerFalloff: Math.min(base.steerFalloff, 0.45) }
    garage.querySelector('#garage-note').textContent =
      'Street tires fitted. More grip and steering at speed; top speed unchanged.'
  })
  garage.querySelector('#garage-race').addEventListener('click', () => {
    vehicle.x = launchPoint.x
    vehicle.z = launchPoint.z
    vehicle.yaw = Math.PI / 2
    vehicle.speed = 0
    vehicle.lateral = 0
    vehicle.angularVel = 0
    teleportPlayer(vehicle.x, vehicle.z, vehicle.yaw)
    enterVehicle(vehicle)
    setCameraMode('chase')
    sprint = createSprint(route, config.sprint.seconds)
    finishSeen = false
    setWaypoint(route[0], 'HARBOR SPRINT · 1/6')
    closeGarage()
  })
  window.addEventListener('keydown', (event) => {
    if (
      event.code !== 'KeyG' ||
      event.repeat ||
      garage.open ||
      /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)
    )
      return
    if (canVisit()) {
      event.preventDefault()
      openGarage()
    }
  })
  window.addEventListener('blur', () => {
    direction = 0
  })
  drawHandheld()
}
function canVisit() {
  return (
    garagePoint &&
    !state.paused &&
    !state.interior &&
    !state.mission.active &&
    !sprint &&
    Math.hypot(state.player.x - garagePoint.x, state.player.z - garagePoint.z) < garagePoint.radius
  )
}
function openGarage() {
  if (!canVisit()) return
  vehicle =
    player.vehicle?.kind === 'car'
      ? player.vehicle
      : cars
          .filter((car) => car.kind === 'car' && !car.occupied)
          .sort(
            (a, b) =>
              Math.hypot(a.x - state.player.x, a.z - state.player.z) -
              Math.hypot(b.x - state.player.x, b.z - state.player.z)
          )[0]
  if (!vehicle || Math.hypot(vehicle.x - garagePoint.x, vehicle.z - garagePoint.z) > 30) {
    toast('Bring a car to the garage.')
    return
  }
  resetInput()
  garage.querySelector('#garage-car').textContent =
    vehicle.label + ' · paint, handling and something in the glovebox.'
  garage.showModal()
  garage.querySelector('#garage-close').focus()
}
function closeGarage() {
  if (handheld.phase === 'playing') handheld.phase = 'paused'
  garage.close()
  direction = 0
  resetInput()
  document.querySelector('#view')?.focus()
}
export function updateSideActivities(dt) {
  if (!panel) return
  const car = player.vehicle
  if (car?.kind === 'car' && input.handbrake && Math.abs(car.speed) > 4 && dt > 0) {
    const current = { x: car.x, z: car.z, yaw: car.yaw }
    if (lastSkid && Math.hypot(current.x - lastSkid.x, current.z - lastSkid.z) < 3) {
      const positions = skidMesh.geometry.getAttribute('position')
      for (const side of [-1, 1]) {
        const point = (pose, offset) => [
          pose.x + Math.cos(pose.yaw) * offset,
          0.045,
          pose.z - Math.sin(pose.yaw) * offset,
        ]
        const a = point(lastSkid, side * 0.72 - 0.08),
          b = point(lastSkid, side * 0.72 + 0.08),
          c = point(current, side * 0.72 + 0.08),
          d = point(current, side * 0.72 - 0.08)
        for (const [i, p] of [a, b, c, a, c, d].entries()) positions.setXYZ(skidCursor * 6 + i, ...p)
        skidCursor = (skidCursor + 1) % 120
      }
      positions.needsUpdate = true
      skidMesh.visible = true
    }
    lastSkid = current
  } else lastSkid = null
  panel.querySelector('#garage-open').hidden = !canVisit()
  if (garage.open) {
    if (garage.querySelector('#glovebox').open) {
      stepHandheld(handheld, direction, dt)
      drawHandheld()
    }
    return
  }
  const label = panel.querySelector('#sprint-status'),
    cancel = panel.querySelector('#sprint-cancel')
  cancel.hidden = !sprint
  if (!sprint) {
    label.textContent = ''
    return
  }
  const previous = sprint.checkpoint
  stepSprint(sprint, state.player, dt, state.mode === 'vehicle' && player.vehicle?.kind === 'car')
  const target = route[sprint.checkpoint]
  if (sprint.status === 'racing' && target) {
    marker.visible = true
    marker.position.set(target.x, 1.1, target.z)
    label.textContent = `HARBOR SPRINT · ${sprint.checkpoint}/6 · ${(sprint.limit - sprint.elapsed).toFixed(1)}s`
    if (previous !== sprint.checkpoint) {
      setWaypoint(target, `HARBOR SPRINT · ${sprint.checkpoint + 1}/6`)
      toast('Checkpoint!')
    }
  } else if (!finishSeen) {
    finishSeen = true
    marker.visible = false
    setWaypoint(null)
    if (sprint.status === 'won') best = best === null ? sprint.elapsed : Math.min(best, sprint.elapsed)
    label.textContent =
      sprint.status === 'won'
        ? `FINISH · ${sprint.elapsed.toFixed(1)}s · session best ${best.toFixed(1)}s`
        : 'SPRINT ENDED · return to the garage to retry'
  }
}
function drawHandheld() {
  const ctx = screen.getContext('2d'),
    t = handheld.time
  ctx.fillStyle = '#080d20'
  ctx.fillRect(0, 0, 480, 272)
  const sky = ctx.createLinearGradient(0, 0, 0, 150)
  sky.addColorStop(0, '#0d1531')
  sky.addColorStop(1, '#713866')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 480, 125)
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = '#1a2139'
    ctx.fillRect(i * 27, 70 - ((i * 17) % 50), 21, 65 + ((i * 17) % 50))
    ctx.fillStyle = '#ae78a9'
    ctx.fillRect(i * 27 + 5, 80 - ((i * 17) % 50), 3, 9)
  }
  ctx.fillStyle = '#1b2b46'
  ctx.beginPath()
  ctx.moveTo(195, 110)
  ctx.lineTo(285, 110)
  ctx.lineTo(470, 272)
  ctx.lineTo(10, 272)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#55efd5'
  ctx.lineWidth = 2
  for (const x of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(240 + x * 45, 110)
    ctx.lineTo(240 + x * 230, 272)
    ctx.stroke()
  }
  for (let i = 0; i < 12; i++) {
    const z = ((i / 12 + t * 0.5) % 1) ** 2,
      y = 110 + z * 162,
      w = 45 + 185 * z
    ctx.strokeStyle = '#38607a'
    ctx.beginPath()
    ctx.moveTo(240 - w, y)
    ctx.lineTo(240 + w, y)
    ctx.stroke()
  }
  for (const item of handheld.obstacles) {
    const z = 1 - item.z,
      y = 110 + z * z * 146,
      w = 8 + z * 23,
      x = 240 + item.x * (45 + z * z * 175)
    ctx.fillStyle = '#fb887d'
    ctx.fillRect(x - w, y - w, w * 2, w)
    ctx.fillStyle = '#ffd3a8'
    ctx.fillRect(x - w, y - w, w * 2, 3)
  }
  const x = 240 + handheld.x * 170
  ctx.fillStyle = handheld.cooldown > 0 ? '#fff0b7' : '#a5fff0'
  ctx.beginPath()
  ctx.moveTo(x, 218)
  ctx.lineTo(x + 18, 252)
  ctx.lineTo(x, 244)
  ctx.lineTo(x - 18, 252)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7cb3ff'
  ctx.fillRect(x - 5, 246, 10, 12 + Math.sin(t * 30) * 4)
  ctx.fillStyle = '#e4ffed'
  ctx.font = '13px monospace'
  ctx.fillText(`SHIELD ${handheld.shield}    ${Math.floor(t)} / 60    ${handheld.score} PTS`, 14, 22)
  garage.querySelector('#pocket-pause').textContent = handheld.phase === 'paused' ? 'Resume run' : 'Pause run'
  garage.querySelector('#pocket-pause').disabled = !['playing', 'paused'].includes(handheld.phase)
  if (handheld.phase === 'paused') status.textContent = 'Paused. Your run will wait.'
  if (handheld.phase === 'playing')
    status.textContent = 'Dodge the coral barriers. Arrow keys or ◀ / ▶ steer.'
  else if (handheld.phase === 'won' || handheld.phase === 'lost') {
    status.textContent = `${handheld.phase === 'won' ? 'RUN COMPLETE' : 'SIGNAL OUT'} · ${handheld.score} points`
    startButton.textContent = 'Play again'
  }
}
