/**
 * Render pooled simulation actors with shared geometry and independent GPU poses.
 * Existing meshes remain the simulation handles; instancing owns only rendering.
 */
import * as THREE from 'three'
import { hexToRgb } from './state.js'

const DATA_WIDTH = 8
const HIDDEN_LAYER = 31

function isVisible(object) {
  for (let current = object; current; current = current.parent) if (!current.visible) return false
  return true
}

function isCandidate(mesh) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.actorBatch || !mesh.geometry || Array.isArray(mesh.material)) return false
  if (mesh.userData.heroVehicle) return false
  if (!mesh.userData.rig && !mesh.userData.archetype) return false
  if (!mesh.userData.basePositions) return false
  // The unique player keeps its own pose, accessories and first-person hiding.
  for (let parent = mesh.parent; parent; parent = parent.parent) if (parent.name === 'player') return false
  return mesh.material?.isMeshStandardMaterial || mesh.material?.isMeshBasicMaterial
}

function markRange(array, range, pivot, id) {
  if (!range) return
  for (let i = range.start; i < range.end; i++) array.set([pivot.x, pivot.y, pivot.z, id], i * 4)
}

function bindRig(geometry, source) {
  const ud = source.userData
  const rig = new Float32Array(geometry.attributes.position.count * 4)
  if (ud.rig === 'biped') {
    ud.parts.legs.forEach((part, i) => markRange(rig, part, part.pivot, i + 1))
    ud.parts.arms.forEach((part, i) => markRange(rig, part, part.pivot, i + 3))
    markRange(rig, ud.parts.torso, ud.parts.torso.pivot, 5)
    for (const part of ud.parts.head.ranges) markRange(rig, part, ud.parts.head.pivot, 6)
  } else if (ud.rig === 'quadruped') {
    ud.parts.legs.forEach((part, i) => markRange(rig, part, part.pivot, i + 1))
    markRange(rig, ud.parts.tail, ud.parts.tail.pivot, 5)
    markRange(rig, ud.parts.head, ud.parts.head.pivot, 6)
  } else {
    for (const wheel of ud.wheels || []) markRange(rig, wheel, wheel.pivot, wheel.front ? 11 : 10)
  }
  geometry.setAttribute('actorRig', new THREE.Float32BufferAttribute(rig, 4))
}

function bindPalette(geometry, source) {
  const ud = source.userData
  const colors = geometry.attributes.color
  const regions = new Float32Array(colors.count * 2)
  for (let i = 0; i < colors.count; i++) regions.set([-1, 1], i * 2)
  const setRegion = (range, slot) => {
    if (!range) return
    if (Array.isArray(range)) { range.forEach(part => setRegion(part, slot)); return }
    for (let i = range.start; i < range.end; i++) regions.set([slot, range.shade?.[i - range.start] ?? regions[i * 2 + 1]], i * 2)
  }
  if (ud.rig) {
    const palette = (ud.instancePalette || []).map(hexToRgb)
    // Every part starts with an authored colour times a scalar contact factor.
    // Recover the semantic palette slot, retaining that scalar occlusion.
    for (let i = 0; i < colors.count; i++) {
      const color = [colors.getX(i), colors.getY(i), colors.getZ(i)]
      for (let slot = 0; slot < palette.length; slot++) {
        const p = palette[slot], rgb = [p.r, p.g, p.b]
        const denominator = rgb.reduce((sum, value) => sum + value * value, 0)
        const shade = color.reduce((sum, value, axis) => sum + value * rgb[axis], 0) / Math.max(denominator, 1e-9)
        if (shade < 0.7 || shade > 1.05) continue
        if (rgb.every((value, axis) => Math.abs(value * shade - color[axis]) < 1e-5)) {
          regions.set([slot, shade], i * 2)
          break
        }
      }
    }
    // Hair and a cap can have the same colour in one instance, while another
    // instance of the same archetype wears a high-visibility hardhat.
    if (ud.parts.cap) setRegion(ud.parts.cap, 4)
  } else {
    setRegion(ud.paintRanges?.hull, 0)
    setRegion(ud.paintRanges?.cabin, 1)
    for (const range of ud.lights?.tail || []) setRegion(range, 2)
    setRegion(ud.strobe, 3)
  }
  geometry.setAttribute('actorRegion', new THREE.Float32BufferAttribute(regions, 2))
}

const SHADER_DECLARATIONS = `
attribute vec4 actorRig;
attribute vec2 actorRegion;
attribute float actorDataRow;
uniform sampler2D actorData;
uniform float actorDataHeight;
vec4 readActor(float slot) {
  return texture2D(actorData, vec2((slot + 0.5) / 8.0, (actorDataRow + 0.5) / actorDataHeight));
}
vec3 rotateActorX(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}
vec3 poseActor(vec3 p, bool isDirection) {
  float part = actorRig.w;
  if (part < 0.5) return p;
  vec4 pose = readActor(6.0), body = readActor(7.0);
  vec3 local = isDirection ? p : p - actorRig.xyz;
  if (part > 9.5) {
    local = rotateActorX(local, pose.x);
    float steer = part > 10.5 ? pose.y : 0.0;
    float c = cos(steer), s = sin(steer);
    local = vec3(local.x * c + local.z * s, local.y, -local.x * s + local.z * c);
  } else {
    float angle = part < 1.5 ? pose.x : part < 2.5 ? pose.y : part < 3.5 ? pose.z : part < 4.5 ? pose.w : part < 5.5 ? (body.z > 0.5 ? body.x : 0.0) : body.y;
    local = rotateActorX(local, angle);
    if (!isDirection && part > 4.5 && part < 5.5 && body.z < 0.5) local.y += body.x;
  }
  return isDirection ? local : local + actorRig.xyz;
}
`

function patchMaterial(material, texture, capacity, depth = false) {
  const priorCompile = material.onBeforeCompile
  const priorKey = material.customProgramCacheKey?.bind(material)
  const cacheKey = priorKey ? priorKey() : ''
  material.onBeforeCompile = (shader, renderer) => {
    priorCompile?.call(material, shader, renderer)
    shader.uniforms.actorData = { value: texture }
    shader.uniforms.actorDataHeight = { value: capacity }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + SHADER_DECLARATIONS)
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = poseActor(objectNormal, true);')
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = poseActor(transformed, false);')
    shader.vertexShader = shader.vertexShader.replace('vec3 lowNormal = normal;', 'vec3 lowNormal = poseActor(normal, true);')
    if (!depth) {
      shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nif (actorRegion.x > -0.5) vColor.rgb = readActor(actorRegion.x).rgb * actorRegion.y;')
    }
  }
  material.customProgramCacheKey = () => `${cacheKey}:raffi-instanced-pose-v1:${depth ? 'depth' : 'colour'}`
  material.needsUpdate = true
}

function createBatch(source, capacity, key, lodIndex = 0) {
  const variant = source.userData.vehicleLods?.[lodIndex]
  const data = variant || source.userData
  const geometry = (variant?.geometry || source.geometry).clone()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.basePositions, 3))
  if (data.baseNormals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.baseNormals, 3))
  const rigSource = variant ? { userData: { ...source.userData, ...variant } } : source
  bindRig(geometry, rigSource)
  bindPalette(geometry, rigSource)
  const rows = new Float32Array(capacity)
  for (let i = 0; i < capacity; i++) rows[i] = i
  geometry.setAttribute('actorDataRow', new THREE.InstancedBufferAttribute(rows, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.boundingSphere.radius += 0.5
  const values = new Float32Array(DATA_WIDTH * capacity * 4)
  const texture = new THREE.DataTexture(values, DATA_WIDTH, capacity, THREE.RGBAFormat, THREE.FloatType)
  texture.minFilter = texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  const material = source.material.clone()
  // Three clones data fields, but custom renderer shader hooks must be retained.
  material.onBeforeCompile = source.material.userData.preCSMHook || source.material.onBeforeCompile
  material.customProgramCacheKey = source.material.customProgramCacheKey
  material.vertexColors = true
  material.userData = { ...material.userData, worldRole: null, actorBatchMaterial: true }
  patchMaterial(material, texture, capacity)
  const mesh = new THREE.InstancedMesh(geometry, material, capacity)
  mesh.name = `actors:${key}`
  mesh.count = 0
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = true
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.actorBatch = true
  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map, alphaTest: material.alphaTest })
  patchMaterial(depthMaterial, texture, capacity, true)
  mesh.customDepthMaterial = depthMaterial
  return { mesh, source, lodIndex, originalMaterial: source.material, sourceVersion: source.material.version, sourceCSM: source.material.defines?.USE_CSM, capacity, values, texture, key, sources: [] }
}

function writeInstance(batch, mesh, index) {
  const ud = mesh.userData
  const offset = index * DATA_WIDTH * 4
  const pose = ud.instancePose || [0, 0, 0, 0]
  let palette
  if (ud.rig) palette = (ud.instancePalette || []).map(hexToRgb)
  else {
    const tail = hexToRgb('#ff3a2e'), strobe = hexToRgb('#39e6ff')
    palette = [hexToRgb(ud.paint?.[0] || '#ffffff'), hexToRgb(ud.paint?.[1] || '#ffffff'),
      { r: tail.r * (pose[2] ?? 0.35), g: tail.g * (pose[2] ?? 0.35), b: tail.b * (pose[2] ?? 0.35) },
      { r: strobe.r * (pose[3] ?? 1), g: strobe.g * (pose[3] ?? 1), b: strobe.b * (pose[3] ?? 1) }]
  }
  for (let slot = 0; slot < 6; slot++) {
    const color = palette[slot] || { r: 1, g: 1, b: 1 }
    batch.values.set([color.r, color.g, color.b, 1], offset + slot * 4)
  }
  batch.values.set(pose, offset + 24)
  batch.values.set(ud.instanceBody || [0, 0, 0, 0], offset + 28)
  batch.mesh.setMatrixAt(index, mesh.matrixWorld)
}

/** Call update before rendering, after simulation and scene visibility changes. */
export function createActorBatcher(scene, { capacity = 128 } = {}) {
  const batches = new Map()
  const registered = new Map()
  const stats = { sources: 0, visible: 0, batches: 0, triangles: 0, nearVehicles: 0, farVehicles: 0 }
  const frustum = new THREE.Frustum()
  const projection = new THREE.Matrix4()
  const bounds = new THREE.Sphere()
  const cameraPosition = new THREE.Vector3()
  const actorPosition = new THREE.Vector3()
  const destroyBatch = (batch) => {
    scene.remove(batch.mesh)
    batch.texture.dispose()
    batch.mesh.geometry.dispose()
    batch.mesh.material.dispose()
    batch.mesh.customDepthMaterial.dispose()
    batch.mesh.dispose()
    batches.delete(batch.key)
  }
  const attached = (source) => {
    for (let parent=source.parent;parent;parent=parent.parent) if (parent===scene) return true
    return false
  }
  const unregister = (source, entry) => {
    source.layers.mask = entry.layers
    delete source.userData.actorBatched
    registered.delete(source)
    for (const batch of entry.batches) {
      const index=batch.sources.indexOf(source)
      if (index>=0) batch.sources.splice(index,1)
      if (!batch.sources.length) destroyBatch(batch)
      else if (batch.source===source) batch.source=batch.sources[0]
    }
  }
  const release = () => {
    for (const [source, state] of registered) {
      source.layers.mask = state.layers
      delete source.userData.actorBatched
    }
    for (const batch of batches.values()) destroyBatch(batch)
    registered.clear()
  }
  return {
    stats,
    update(camera = null) {
      // Mission restarts, save loads and deliveries retire simulation handles.
      // Remove their strong references and reclaim empty near/far batches.
      for (const [source,entry] of registered) if (!attached(source)) unregister(source,entry)
      // Quality changes replace the simulation material with a cheaper or
      // physical variant. Rebind once so instances inherit the right shaders.
      if ([...registered].some(([source, entry]) => source.material !== entry.batch.originalMaterial || source.material.version !== entry.batch.sourceVersion || source.material.defines?.USE_CSM !== entry.batch.sourceCSM)) release()
      const candidates = []
      scene.traverse(object => { if (isCandidate(object) && !registered.has(object)) candidates.push(object) })
      for (const source of candidates) {
        const ud = source.userData
        const lodBatches = []
        for (let lodIndex = 0; lodIndex < (ud.vehicleLods?.length || 1); lodIndex++) {
          const geometry = ud.vehicleLods?.[lodIndex].geometry || source.geometry
          const baseKey = `${ud.rig ? 'ped:' + ud.arch : 'vehicle:' + ud.archetype}:${lodIndex}:${geometry.attributes.position.count}:${source.material.uuid}`
          let suffix = 0, key = baseKey, batch = batches.get(key)
          while (batch && batch.sources.length >= capacity) { key = `${baseKey}:${++suffix}`; batch = batches.get(key) }
          if (!batch) { batch = createBatch(source, capacity, key, lodIndex); batches.set(key, batch); scene.add(batch.mesh) }
          batch.sources.push(source)
          lodBatches.push(batch)
        }
        registered.set(source, { batch: lodBatches[0], batches: lodBatches, layers: source.userData.presentationOriginalLayers ?? source.layers.mask })
        source.layers.set(HIDDEN_LAYER)
        ud.actorBatched = true
      }
      scene.updateMatrixWorld(true)
      if (camera) {
        camera.updateMatrixWorld()
        camera.getWorldPosition(cameraPosition)
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        frustum.setFromProjectionMatrix(projection)
      }
      stats.sources = registered.size
      stats.visible = 0
      stats.batches = 0
      stats.triangles = 0
      stats.nearVehicles = 0
      stats.farVehicles = 0
      for (const [source] of registered) {
        const ud = source.userData
        if (!ud.vehicleLods) continue
        const distance = camera ? cameraPosition.distanceTo(actorPosition.setFromMatrixPosition(source.matrixWorld)) : 0
        const threshold = ud.vehicleLodDistance || 36, hysteresis = ud.vehicleLodHysteresis || 5
        ud.vehicleLodIndex = ud.vehicleLodIndex === 1 ? (distance < threshold - hysteresis ? 0 : 1) : (distance > threshold + hysteresis ? 1 : 0)
      }
      for (const batch of batches.values()) {
        let count = 0
        const material = batch.mesh.material, original = batch.source.material
        for (const key of ['roughness', 'metalness', 'envMapIntensity', 'emissiveIntensity']) {
          if (original[key] !== undefined) material[key] = original[key]
        }
        if (original.emissive && material.emissive) material.emissive.copy(original.emissive)
        for (const source of batch.sources) {
          if (!source.parent || !isVisible(source) || source.userData.presentationReplaced) continue
          if (source.userData.vehicleLods && source.userData.vehicleLodIndex !== batch.lodIndex) continue
          if (camera && source.geometry.boundingSphere) {
            bounds.copy(source.geometry.boundingSphere).applyMatrix4(source.matrixWorld)
            bounds.radius += 3
            if (!frustum.intersectsSphere(bounds)) continue
          }
          writeInstance(batch, source, count++)
          if (source.userData.vehicleLods) stats[batch.lodIndex ? 'farVehicles' : 'nearVehicles']++
        }
        batch.mesh.count = count
        batch.mesh.visible = count > 0
        if (!count) continue
        batch.texture.needsUpdate = true
        batch.mesh.instanceMatrix.needsUpdate = true
        batch.mesh.computeBoundingSphere()
        stats.visible += count
        stats.batches++
        stats.triangles += count * batch.mesh.geometry.index.count / 3
      }
      return stats
    },
    dispose: release,
  }
}
