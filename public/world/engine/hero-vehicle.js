/** Authored original vehicle presentation over the existing arcade simulation. */
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js'

export async function prepareHeroVehicle(atlas) {
  const gltf = await new GLTFLoader().loadAsync(new URL('../assets/vehicles/grove-gt.glb', import.meta.url).href)
  const high = gltf.scene.getObjectByName('grove-gt-lod0')
  const low = gltf.scene.getObjectByName('grove-gt-lod1')
  if (!high || !low) throw new Error('Grove GT is missing its detail levels')
  atlas.heroVehicle = { high, low }
}

export function attachHeroVehicle(proxy, atlas) {
  if (proxy.userData.archetype !== 'grand-tourer' || !atlas.heroVehicle) return
  const lod = new THREE.LOD()
  const materials = new Map(), wheels = [], bodies = []
  for (const [source, distance] of [[atlas.heroVehicle.high, 0], [atlas.heroVehicle.low, 48]]) {
    const model = source.clone(true)
    for (const part of model.children) {
      if (part.name.startsWith('wheel-')) { part.rotation.order = 'YXZ'; wheels.push(part) }
      if (part.name === 'body') bodies.push(part)
    }
    model.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      if (!materials.has(object.material.name)) materials.set(object.material.name, object.material.clone())
      object.material = materials.get(object.material.name)
    })
    lod.addLevel(model, distance)
  }
  proxy.add(lod)
  proxy.geometry.setDrawRange(0, 0)
  proxy.userData.heroVehicle = { lod, wheels, bodies, materials, pitch: 0, roll: 0, lastSpeed: 0 }
  materials.get('grove-paint')?.color.set(proxy.userData.paint[0])
  // A save load disposes its old simulation proxy. Release only per-car
  // materials; authored geometry stays shared with all other cars.
  proxy.geometry.addEventListener('dispose', () => { for (const material of materials.values()) material.dispose() })
}

export function updateHeroVehicle(proxy, dt, speed, steer, braking) {
  const hero = proxy.userData.heroVehicle
  if (!hero) return false
  const acceleration = dt > 0 ? (speed - hero.lastSpeed) / dt : 0
  hero.lastSpeed = speed
  const blend = 1 - Math.exp(-8 * Math.max(0, dt))
  hero.pitch += (THREE.MathUtils.clamp(acceleration * .0018, -.018, .018) - hero.pitch) * blend
  hero.roll += (THREE.MathUtils.clamp(-steer * Math.abs(speed) * .0008, -.024, .024) - hero.roll) * blend
  for (const body of hero.bodies) { body.rotation.x = hero.pitch; body.rotation.z = hero.roll }
  for (const wheel of hero.wheels) {
    wheel.rotation.x = proxy.userData.wheelSpin
    wheel.rotation.y = wheel.name.includes('front') ? steer * .5 : 0
  }
  hero.materials.get('grove-paint')?.color.set(proxy.userData.paint[0])
  const tail = hero.materials.get('grove-taillight')
  if (tail) tail.emissiveIntensity = braking ? 3 : .65
  return true
}
