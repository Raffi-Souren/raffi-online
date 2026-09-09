/** Authored, skinned player presentation over the existing collision/controller. */
import * as THREE from 'three'
import { clone } from '../vendor/utils/SkeletonUtils.js'
import { loadPopulationTemplate } from './population.js'

const ONE_SHOTS = new Set(['interact', 'enter', 'exit'])

export function loadCharacterTemplate(detail) {
  return loadPopulationTemplate('player', detail ? 'far' : 'near')
}

function createRig(template, low) {
  const model = clone(template.scene)
  model.name = 'Raffi · natural NYC streetwear'
  const ownedMaterials = new Set(), ownedSkeletons = new Set()
  let meshCount = 0, triangleCount = 0
  model.traverse(object => {
    if (!object.isMesh) return
    if (object.isSkinnedMesh) ownedSkeletons.add(object.skeleton)
    meshCount++
    triangleCount += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3
    object.castShadow = true
    object.receiveShadow = true
    // Animated hands/feet move beyond bind-pose geometry bounds. The one hero
    // stays visible through locomotion; static city and crowd retain culling.
    object.frustumCulled = false
    object.material = object.material.clone()
    object.material.userData.authoredCharacter = true
    object.material.envMapIntensity = 0.55
    if (low) { object.material.normalMap = null; object.material.metalnessMap = null }
    ownedMaterials.add(object.material)
  })
  const mixer = new THREE.AnimationMixer(model)
  const actions = new Map(template.animations.map(clip => [clip.name, mixer.clipAction(clip)]))
  for (const required of ['idle', 'walk', 'run', 'drive', 'enter', 'exit']) {
    if (!actions.has(required)) throw new Error(`Player character is missing its ${required} animation`)
  }
  for (const name of ONE_SHOTS) {
    const action = actions.get(name)
    if (action) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true }
  }
  return { model, ownedMaterials, ownedSkeletons, meshCount, triangleCount, mixer, actions, spine: model.getObjectByName('spine_03') || model.getObjectByName('spine_02') }
}

/** Await during the real loading screen; a failed asset load remains observable. */
export async function createPlayerCharacter(player, { tier = 'medium', surfaceRoot = null } = {}) {
  if (!player.group?.parent || !player.ped) throw new Error('Player simulation must be initialized before loading its character')
  let low = tier === 'low' || tier === 'performance'
  const template = await loadCharacterTemplate(low)
  let { model, ownedMaterials, ownedSkeletons, meshCount, triangleCount, mixer, actions, spine } = createRig(template, low)
  const visual = new THREE.Group()
  visual.name = 'player-character'
  visual.userData.authoredCharacter = true
  visual.add(model)
  let qualityVersion = 0, disposed = false
  player.ped.visible = false
  player.ped.userData.presentationReplaced = true
  player.group.parent.add(visual)
  visual.position.copy(player.group.position)
  visual.quaternion.copy(player.group.quaternion)
  let current = null, previousMode = 'foot', transition = null, interactionTime = 0
  let previousYaw = player.group.rotation.y
  const target = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const turn = new THREE.Euler(0, 0, 0, 'YXZ')
  // Ground the rendered shoes on raised pavement without changing the proven
  // collision controller. Spatial filtering keeps this occasional ray local.
  const surfaces = [], ray = new THREE.Raycaster(), groundNormal = new THREE.Vector3()
  const groundCache = { x: Infinity, z: Infinity, y: 0, interior: null, offset: 0 }
  function refreshGroundSurfaces() {
    surfaces.length = 0; groundCache.x = Infinity
    surfaceRoot?.updateMatrixWorld(true)
    surfaceRoot?.traverse(object => {
      if (!object.isMesh || object.material?.transparent) return
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
      surfaces.push({ object, bounds: object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld) })
    })
  }
  refreshGroundSurfaces()
  let groundOffset = 0
  const stats = { ready: true, lod: low ? 'low' : 'standard', meshes: meshCount, triangles: triangleCount, animation: 'idle', clips: [...actions.keys()], groundQueries: 0, groundCandidates: 0, groundOffset: 0 }

  function surfaceOffset(p, interior) {
    if (interior) { groundCache.interior = interior; groundCache.offset = 0; return 0 }
    if (groundCache.interior !== interior || Math.hypot(p.x - groundCache.x, p.z - groundCache.z) >= 0.2 || Math.abs((p.y || 0) - groundCache.y) >= 0.05) {
      Object.assign(groundCache, { x: p.x, z: p.z, y: p.y || 0, interior, offset: 0 })
      const candidates = surfaces.filter(({ bounds }) => p.x >= bounds.min.x && p.x <= bounds.max.x && p.z >= bounds.min.z && p.z <= bounds.max.z).map(({ object }) => object)
      ray.set(new THREE.Vector3(p.x, (p.y || 0) + 0.5, p.z), new THREE.Vector3(0, -1, 0))
      ray.near = 0; ray.far = 1.5
      stats.groundQueries++; stats.groundCandidates = candidates.length
      for (const hit of ray.intersectObjects(candidates, false)) {
        if (!hit.face) continue
        groundNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
        const rise = hit.point.y - (p.y || 0)
        if (groundNormal.y > 0.6 && rise >= -0.03 && rise <= 0.36001) { groundCache.offset = Math.max(0, rise); break }
      }
    }
    return groundCache.offset
  }

  function select(name, duration = 0.18) {
    if (current === name) return actions.get(name)
    const next = actions.get(name) || actions.get('idle')
    const old = actions.get(current)
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play()
    if (old) old.crossFadeTo(next, duration, false)
    current = name
    stats.animation = name
    return next
  }
  select('idle', 0)
  mixer.update(0)

  return {
    model: visual,
    stats,
    refreshGroundSurfaces,
    async setQuality(nextTier) {
      const version = ++qualityVersion, nextLow = nextTier === 'low' || nextTier === 'performance'
      if (disposed || nextLow === low) return stats
      const template = await loadCharacterTemplate(nextLow)
      if (disposed || version !== qualityVersion) return stats
      const next = createRig(template, nextLow)
      const previousAction = actions.get(current), action = next.actions.get(current) || next.actions.get('idle')
      const phase = previousAction ? previousAction.time / Math.max(.001, previousAction.getClip().duration) : 0
      action.reset().play(); action.time = phase * action.getClip().duration
      if (previousAction) action.setEffectiveTimeScale(previousAction.getEffectiveTimeScale())
      next.mixer.update(0)
      next.model.scale.copy(model.scale)
      visual.add(next.model); visual.remove(model)
      mixer.stopAllAction(); mixer.uncacheRoot(model)
      for (const material of ownedMaterials) material.dispose()
      for (const skeleton of ownedSkeletons) skeleton.dispose()
      ;({ model, ownedMaterials, ownedSkeletons, meshCount, triangleCount, mixer, actions, spine } = next)
      low = nextLow
      Object.assign(stats, { lod: low ? 'low' : 'standard', meshes: meshCount, triangles: triangleCount })
      return stats
    },
    playInteraction() {
      interactionTime = 0.55
      select('interact', 0.12)?.setEffectiveTimeScale(1.8)
    },
    update(dt, state) {
      if (!Number.isFinite(dt) || dt <= 0) return
      const p = state.player
      const vehicle = state.mode === 'vehicle' ? player.vehicle : null
      const car = vehicle && !vehicle.riderVisible
      // Fit the seated pose to the low coupe cabin. The original driving clip
      // was authored for a taller seat; its head otherwise pierced the roof.
      const seatedScale = car ? 0.89 : 1
      model.scale.lerp(new THREE.Vector3(seatedScale, seatedScale, seatedScale), 1 - Math.exp(-18 * dt))
      if (state.mode !== previousMode) {
        transition = { time: 0, duration: car ? 0.42 : 0.32, from: visual.position.clone(), entering: !!vehicle }
        select(vehicle ? 'enter' : 'exit', 0.08)?.setEffectiveTimeScale(2.8)
        previousMode = state.mode
      }
      if (car) {
        const width = vehicle.mesh.userData.width || 1.8
        const length = vehicle.mesh.userData.length || 4.1
        const x = -width * 0.21, z = -length * 0.05
        const position = vehicle.mesh.position || vehicle
        const yaw = vehicle.mesh.rotation?.y ?? vehicle.yaw
        target.set(position.x + x * Math.cos(yaw) + z * Math.sin(yaw), (position.y || 0) + 0.02,
          position.z - x * Math.sin(yaw) + z * Math.cos(yaw))
        turn.set(0, yaw, 0)
        rotation.setFromEuler(turn)
      } else if (vehicle) {
        target.copy(player.group.position)
        rotation.copy(player.group.quaternion)
      } else {
        const height = surfaceOffset(p, state.interior)
        groundOffset += (height - groundOffset) * (1 - Math.exp(-18 * dt))
        stats.groundOffset = groundOffset
        target.set(p.x, (p.y || 0) + groundOffset, p.z)
        turn.set(0, p.yaw, 0)
        rotation.setFromEuler(turn)
      }
      if (transition) {
        transition.time += dt
        const fraction = Math.min(1, transition.time / transition.duration)
        const blend = fraction * fraction * (3 - 2 * fraction)
        visual.position.lerpVectors(transition.from, target, blend)
        if (fraction === 1) transition = null
      } else visual.position.copy(target)
      visual.quaternion.slerp(rotation, 1 - Math.exp(-18 * dt))
      visual.visible = true
      interactionTime = Math.max(0, interactionTime - dt)
      if (!transition && interactionTime === 0) {
        const speed = Math.abs(p.speed || 0)
        const name = car ? 'drive' : vehicle ? 'idle' : speed < 0.18 ? 'idle' : speed > 4.2 ? 'sprint' : speed > 2.2 ? 'run' : 'walk'
        const action = select(name)
        const authoredSpeed = name === 'sprint' ? 5.7 : name === 'run' ? 3.2 : name === 'walk' ? 1.65 : 1
        if (['walk', 'run', 'sprint'].includes(name)) action.setEffectiveTimeScale(Math.max(0.55, Math.min(1.5, speed / authoredSpeed)))
      }
      mixer.update(dt)
      // Small upper-body anticipation makes stationary turns legible while
      // respecting the authored lower-body locomotion and collision heading.
      const yawDelta = Math.atan2(Math.sin(p.yaw - previousYaw), Math.cos(p.yaw - previousYaw))
      if (spine && !car) spine.rotation.z += Math.max(-0.07, Math.min(0.07, -yawDelta * 0.16))
      previousYaw = p.yaw
    },
    dispose() {
      disposed = true; qualityVersion++
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
      visual.removeFromParent()
      for (const material of ownedMaterials) material.dispose()
      for (const skeleton of ownedSkeletons) skeleton.dispose()
      player.ped.visible = true
      delete player.ped.userData.presentationReplaced
    },
  }
}
