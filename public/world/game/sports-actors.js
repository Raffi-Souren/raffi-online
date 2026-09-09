/** Independently animated people shared by park activities. Cached assets stay immutable. */
import * as THREE from 'three'
import { clone } from '../vendor/utils/SkeletonUtils.js'
import * as population from '../engine/population.js'
import { loadCharacterTemplate } from '../engine/player-character.js'

const PARK_IDENTITIES = { 'park:jules': 'june', 'park:nico': 'noah', 'park:imani': 'inez', 'park:mateo': 'malik', 'park:rosa': 'rosa' }

export async function createSportsActor({ id, appearanceId } = {}) {
  const identity = appearanceId || PARK_IDENTITIES[id] || 'ari'
  const template = id === 'player'
    ? await loadCharacterTemplate(false)
    : population.loadPopulationTemplate
      ? await population.loadPopulationTemplate(identity, 'near')
      : await loadCharacterTemplate('crowd')
  const model = clone(template.scene), group = new THREE.Group(), materials = new Set(), skeletons = new Set()
  group.name = id || identity
  group.userData.appearanceId = identity
  group.add(model)
  model.traverse(object => {
    if (!object.isMesh) return
    if (object.skeleton) skeletons.add(object.skeleton)
    object.castShadow = true
    object.receiveShadow = true
    object.frustumCulled = false
    const own = material => { const copy = material.clone(); copy.envMapIntensity = .55; materials.add(copy); return copy }
    object.material = Array.isArray(object.material) ? object.material.map(own) : own(object.material)
  })
  const mixer = new THREE.AnimationMixer(model)
  const actions = new Map(template.animations.map(clip => [clip.name, mixer.clipAction(clip)]))
  const phase = [...String(id || identity)].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17) / 4294967296
  let current = null, disposed = false
  function select(requested) {
    const name = actions.has(requested) ? requested : requested === 'jab' && actions.has('interact') ? 'interact' : 'idle'
    if (current === name) return
    const next = actions.get(name)
    if (!next) return
    next.reset().play()
    next.time = phase * next.getClip().duration
    if (current) actions.get(current)?.crossFadeTo(next, .16, false)
    current = name
  }
  select('idle'); mixer.update(0)
  return {
    group,
    update(dt, { x = 0, y = 0, z = 0, yaw = 0, speed = 0, state = 'idle' } = {}) {
      if (disposed) return
      group.position.set(x, y, z)
      const delta = Math.atan2(Math.sin(yaw - group.rotation.y), Math.cos(yaw - group.rotation.y))
      group.rotation.y += delta * (1 - Math.exp(-15 * Math.max(0, dt)))
      select(state === 'idle' && speed > .15 ? (speed > 2.8 ? 'run' : 'walk') : state)
      const action = actions.get(current)
      if (action) action.setEffectiveTimeScale(current === 'walk' ? THREE.MathUtils.clamp(speed / 1.5, .6, 1.7) : current === 'run' ? THREE.MathUtils.clamp(speed / 3.8, .7, 1.5) : 1)
      mixer.update(Math.max(0, dt))
    },
    dispose() {
      if (disposed) return
      disposed = true
      mixer.stopAllAction(); mixer.uncacheRoot(model)
      for (const skeleton of skeletons) skeleton.dispose()
      for (const material of materials) material.dispose()
      group.removeFromParent(); group.clear()
    },
  }
}
