/** Stable, individually skinned neighborhood identities over unchanged simulation proxies. */
import * as THREE from 'three'
import { clone } from '../vendor/utils/SkeletonUtils.js'
import { loadPopulation, loadPopulationTemplate, appearanceForActor } from './population.js'
import { createCharacterAccessory } from './character-accessories.js'

const ALLOWED = new Set(['commuter', 'raver', 'tailgater', 'dockworker', 'jogger'])
const LOW = new Set(['low', 'performance'])
function visible(object) { for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false; return true }

/** A one-metre handoff bias prevents churn without reserving slots for distant peers. */
export function selectNearActors(candidates, assigned, position, capacity = 2, enter = 14, exit = 18) {
  const distance = object => Math.hypot(object.position.x - position.x, object.position.z - position.z)
  const priority = object => object.userData?.conversationCharacter && distance(object) < 5 ? 30 : 0
  return candidates.filter(object => visible(object) && distance(object) <= (assigned.includes(object) ? exit : enter))
    .sort((a, b) => distance(a) - priority(a) - (assigned.includes(a) ? 1 : 0) - distance(b) + priority(b) + (assigned.includes(b) ? 1 : 0)).slice(0, capacity)
}

function createRig(template, identity, lod) {
  const model = clone(template.scene), materials = new Set(), skeletons = new Set()
  model.name = `population:${identity.id}:${lod}`
  let triangles = 0, draws = 0, bones = 0
  model.traverse(object => {
    if (object.isBone) bones++
    if (!object.isMesh) return
    if (object.isSkinnedMesh) skeletons.add(object.skeleton)
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; draws++
    object.castShadow = lod === 'near'; object.receiveShadow = true; object.frustumCulled = false
    object.material = object.material.clone(); object.material.userData.authoredCharacter = true
    object.material.envMapIntensity = .5; materials.add(object.material)
  })
  const mixer = new THREE.AnimationMixer(model)
  const actions = new Map(template.animations.map(clip => [clip.name, mixer.clipAction(clip)]))
  return { model, mixer, actions, materials, skeletons, triangles, draws, bones, lod, current: null, elapsed: 0 }
}
function disposeRig(rig) {
  if (!rig) return
  rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.model); rig.model.removeFromParent()
  for (const material of rig.materials) material.dispose()
  for (const skeleton of rig.skeletons) skeleton.dispose()
}
function selectAction(rig, name, phase = null) {
  if (name === rig.current) return rig.actions.get(name)
  const action = rig.actions.get(name) || rig.actions.get('idle'), previous = rig.actions.get(rig.current)
  action.reset().setEffectiveWeight(1).play()
  if (phase !== null) action.time = phase * action.getClip().duration
  if (previous) previous.crossFadeTo(action, .2, false)
  rig.current = name
  return action
}

export async function createNearCharacters(scene, { tier = 'medium', surfaceRoot = null } = {}) {
  const root = new THREE.Group(); root.name = 'near-characters'; scene.add(root)
  const catalog = await loadPopulation(), entries = new Map(), farTemplates = new Map()
  const surfaces = [], ray = new THREE.Raycaster(), normal = new THREE.Vector3(), projection = new THREE.Matrix4(), frustum = new THREE.Frustum(), sphere = new THREE.Sphere()
  const stats = { ready: false, enabled: true, active: 0, near: 0, far: 0, slots: 0, triangles: 0, draws: 0, bones: 0, mixerUpdates: 0, groundQueries: 0, groundCandidates: 0, sources: [], error: null }
  let disposed = false, capacity = LOW.has(tier) ? 0 : ['high', 'cinematic'].includes(tier) ? 6 : 4, farDistance = LOW.has(tier) ? 70 : 120
  surfaceRoot?.updateMatrixWorld(true)
  surfaceRoot?.traverse(object => {
    if (!object.isMesh || object.material?.transparent) return
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
    surfaces.push({ object, bounds: object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld) })
  })
  // Small far templates cover the complete cast on first play. Foreground meshes
  // stream only when their stable identity approaches the camera.
  await Promise.all(catalog.identities.map(async identity => farTemplates.set(identity.id, await loadPopulationTemplate(identity.id, 'far'))))
  stats.ready = true

  function createEntry(source, seed) {
    const identity = appearanceForActor(source, seed, catalog), far = createRig(farTemplates.get(identity.id), identity, 'far')
    root.add(far.model)
    const entry = { source, identity, far, near: null, pending: null, rig: far, wantNear: false, accessory: null, carriedItem: null, last: source.position.clone(), speed: 0, floor: { x: Infinity, z: Infinity, y: 0, offset: 0 } }
    source.userData.presentationOriginalLayers = source.userData.presentationOriginalLayers ?? source.layers.mask
    source.userData.presentationReplaced = true; source.layers.set(31)
    source.userData.populationIdentity = identity.id
    entries.set(source, entry)
    return entry
  }
  function removeEntry(entry) {
    entries.delete(entry.source)
    delete entry.source.userData.presentationReplaced
    entry.source.layers.mask = entry.source.userData.actorBatched ? (1 << 31) >>> 0 : entry.source.userData.presentationOriginalLayers
    delete entry.source.userData.presentationOriginalLayers
    disposeRig(entry.near); disposeRig(entry.far)
    entry.accessory?.dispose()
  }
  function swap(entry, rig) {
    if (entry.rig === rig) return
    const old = entry.rig, action = old.actions.get(old.current)
    const phase = action ? action.time / action.getClip().duration % 1 : 0
    selectAction(rig, old.current || 'idle', phase)
    rig.model.position.copy(old.model.position); rig.model.quaternion.copy(old.model.quaternion)
    old.model.visible = false; entry.rig = rig
    rig.mixer.update(0)
  }
  function requestNear(entry) {
    if (entry.near) { swap(entry, entry.near); return }
    if (entry.pending) return
    entry.pending = loadPopulationTemplate(entry.identity.id, 'near').then(template => {
      if (disposed || !entries.has(entry.source) || !entry.wantNear) return
      entry.near = createRig(template, entry.identity, 'near'); entry.near.model.visible = false; root.add(entry.near.model)
      swap(entry, entry.near)
    }).catch(error => { stats.error = `${entry.identity.id}: ${error.message}` }).finally(() => { entry.pending = null })
  }
  function floorOffset(entry) {
    const p = entry.source.position, cache = entry.floor
    if (Math.hypot(p.x - cache.x, p.z - cache.z) < .3 && Math.abs(p.y - cache.y) < .05) return cache.offset
    Object.assign(cache, { x: p.x, y: p.y, z: p.z, offset: 0 })
    const candidates = surfaces.filter(({ bounds }) => p.x >= bounds.min.x && p.x <= bounds.max.x && p.z >= bounds.min.z && p.z <= bounds.max.z).map(({ object }) => object)
    ray.set(new THREE.Vector3(p.x, p.y + .5, p.z), new THREE.Vector3(0, -1, 0)); ray.near = 0; ray.far = 1.5
    stats.groundQueries++; stats.groundCandidates = candidates.length
    for (const hit of ray.intersectObjects(candidates, false)) {
      if (!hit.face) continue
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
      const rise = hit.point.y - p.y
      if (normal.y > .6 && rise >= -.03 && rise <= .36001) { cache.offset = Math.max(0, rise); break }
    }
    return cache.offset
  }
  return {
    stats,
    async setQuality(nextTier) {
      capacity = LOW.has(nextTier) ? 0 : ['high', 'cinematic'].includes(nextTier) ? 6 : 4
      farDistance = LOW.has(nextTier) ? 70 : ['high', 'cinematic'].includes(nextTier) ? 160 : 120
    },
    update(dt, state, camera = null) {
      dt = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0
      stats.active = stats.near = stats.far = stats.triangles = stats.draws = stats.bones = stats.mixerUpdates = 0; stats.sources = []
      root.visible = !state.interior && !disposed
      if (disposed) return stats
      const sources = []
      scene.traverse(source => {
        if (source.userData.rig === 'biped' && source.parent?.name !== 'player' && (ALLOWED.has(source.userData.arch) || source.userData.npcId)) sources.push(source)
      })
      for (const entry of entries.values()) if (!sources.includes(entry.source)) removeEntry(entry)
      for (const source of sources) if (!entries.has(source)) createEntry(source, state.seed)
      stats.slots = entries.size
      if (camera) { camera.updateMatrixWorld(); projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection) }
      const onScreen = source => {
        if (!root.visible || !visible(source) || Math.hypot(source.position.x - state.player.x, source.position.z - state.player.z) > farDistance) return false
        sphere.center.copy(source.position); sphere.center.y += .9; sphere.radius = 1.15
        return !camera || frustum.intersectsSphere(sphere)
      }
      const candidates = sources.filter(onScreen), assigned = [...entries.values()].filter(entry => entry.wantNear).map(entry => entry.source)
      const selected = selectNearActors(candidates, assigned, state.player, capacity, 18, 21)
      for (const entry of entries.values()) {
        const source = entry.source; source.layers.set(31)
        entry.wantNear = selected.includes(source)
        if (entry.wantNear) requestNear(entry)
        else if (entry.rig !== entry.far) swap(entry, entry.far)
        const rig = entry.rig, shown = candidates.includes(source)
        rig.model.visible = shown
        if (entry.carriedItem !== (source.userData.carriedItem || null)) {
          entry.accessory?.dispose(); entry.carriedItem = source.userData.carriedItem || null
          entry.accessory = createCharacterAccessory(entry.carriedItem)
          if (entry.accessory) root.add(entry.accessory)
        }
        if (entry.accessory) entry.accessory.visible = shown
        const moved = Math.hypot(source.position.x - entry.last.x, source.position.z - entry.last.z)
        entry.last.copy(source.position)
        if (!shown) continue
        const velocity = source.userData.animationSpeed ?? (dt > 0 ? moved / dt : entry.speed)
        entry.speed += (Math.min(velocity, 8) - entry.speed) * (1 - Math.exp(-14 * dt))
        const style = source.userData.locomotionStyle
        const animation = source.userData.animationState === 'sit' ? 'sit' : source.userData.animationState === 'talk' ? 'talk' : entry.speed < .16 ? 'idle' : entry.speed > 3.9 ? 'sprint' : entry.speed > 2.1 ? 'run' : style === 'purposeful' ? 'purposeful' : 'walk'
        const action = selectAction(rig, animation, rig.current === null ? (source.userData.phase || 0) / (Math.PI * 2) % 1 : null)
        action.setEffectiveTimeScale(['idle', 'talk', 'sit'].includes(animation) ? 1 : Math.max(.5, Math.min(1.6, entry.speed / (['walk', 'purposeful'].includes(animation) ? 1.5 : animation === 'run' ? 3.2 : 5.7))))
        rig.model.position.copy(source.position); rig.model.position.y += floorOffset(entry); rig.model.quaternion.copy(source.quaternion)
        if(rig.flinchBone && rig.flinchRest)rig.flinchBone.quaternion.copy(rig.flinchRest)
        rig.elapsed += dt
        if (rig.lod === 'near' || rig.elapsed >= 1 / 12) { rig.mixer.update(rig.elapsed); rig.elapsed = 0; stats.mixerUpdates++ }
        const reaction=source.userData.streetReaction
        if(reaction && state.time-reaction.start<.7){
          rig.flinchBone ||= rig.model.getObjectByName('spine_03')
          if(rig.flinchBone){rig.flinchRest=rig.flinchBone.quaternion.clone();rig.flinchBone.rotation.x-=Math.sin(Math.max(0,state.time-reaction.start)/.7*Math.PI)*.18}
        }else rig.flinchRest=null
        if (entry.accessory) {
          rig.model.updateMatrixWorld(true)
          const hand = rig.model.getObjectByName('hand_l')
          if (hand) hand.getWorldPosition(entry.accessory.position)
          entry.accessory.quaternion.copy(source.quaternion)
          entry.accessory.traverse(object => { if (object.isMesh) object.castShadow = rig.lod === 'near' })
          stats.triangles += entry.accessory.userData.triangles; stats.draws++
        }
        stats.active++; stats[rig.lod]++; stats.triangles += rig.triangles; stats.draws += rig.draws; stats.bones += rig.bones
        stats.sources.push({ name: source.name, id: source.uuid, npcId: source.userData.npcId, identity: entry.identity.id, lod: rig.lod, animation, x: source.position.x, z: source.position.z, groundOffset: entry.floor.offset, renderedY: rig.model.position.y })
      }
      return stats
    },
    dispose() { disposed = true; for (const entry of entries.values()) removeEntry(entry); root.removeFromParent() },
  }
}
