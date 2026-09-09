/** Small local CC0 surface palette; provenance lives beside the runtime assets. */
import * as THREE from 'three'
import { data } from './state.js'
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js'

const SURFACE_ROOT = new URL('../assets/materials/urban/', import.meta.url)

// Each photographic material needs independent repeat/mip borders. Keeping
// four tiles in a2D sheet let pavement bleed into asphalt at distant mip levels.
function surfaceArray(packed) {
  const size = packed.image.width / 2
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const pixels = new Uint8Array(size * size * 4 * 4)
  for (let layer = 0; layer < 4; layer++) {
    context.drawImage(packed.image, (layer % 2) * size, Math.floor(layer / 2) * size, size, size, 0, 0, size, size)
    const source = context.getImageData(0, 0, size, size).data
    for (let y = 0; y < size; y++) pixels.set(source.subarray((size-y-1)*size*4,(size-y)*size*4), (layer*size*size+y*size)*4)
  }
  const texture = new THREE.DataArrayTexture(pixels, size, size, 4)
  texture.colorSpace = packed.colorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true
  packed.dispose()
  return texture
}

/** Load the shared photographic sheets, then annotate existing atlas UV cells.
 * Geometry continues to use the same atlas and the same merged city meshes. */
export async function prepareUrbanSurfaces(atlas) {
  urbanSignSources.length = 0
  atlas.signSources = urbanSignSources
  const loader = new THREE.TextureLoader()
  const [config, albedo, normal, roughness] = await Promise.all([
    fetch(new URL('surfaces.json', SURFACE_ROOT)).then((response) => {
      if (!response.ok) throw new Error('Urban material palette unavailable')
      return response.json()
    }),
    loader.loadAsync(new URL('albedo.webp', SURFACE_ROOT).href),
    loader.loadAsync(new URL('normal.webp', SURFACE_ROOT).href),
    loader.loadAsync(new URL('roughness.webp', SURFACE_ROOT).href),
  ])
  albedo.colorSpace = THREE.SRGBColorSpace
  normal.colorSpace = roughness.colorSpace = THREE.NoColorSpace
  for (const texture of [albedo, normal, roughness]) {
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 8
  }
  const maskSize = atlas.canvas.width
  const maskData = new Uint8Array(maskSize * maskSize * 4)
  const atlasContext = atlas.canvas.getContext('2d')
  const cellSize = 256
  const white = atlas.uv('white')
  const tint = new THREE.Color()
  const entries = []
  for (const [name, definition] of Object.entries(data.blocks.facades)) {
    if (definition.pattern !== 'brick') continue
    tint.set(definition.base)
    const max = Math.max(tint.r, tint.g, tint.b, 0.001)
    const rgb = [tint.r, tint.g, tint.b].map((value) => Math.sqrt(value / max))
    entries.push({ names: ['wall/' + name, 'flat/' + name], slot: 0, tint: rgb })
  }
  entries.push({ names: ['road', 'roof-tar'], slot: 1, tint: [1, 1, 1] })
  entries.push({ names: ['sidewalk'], slot: 2, tint: [1, 1, 1] })
  entries.push({ names: ['cobble'], slot: 3, tint: [1, 1, 1] })
  for (const entry of entries) for (const name of entry.names) {
    const rect = atlas.uv(name)
    if (rect === white) continue
    for (let py = 0; py < cellSize; py++) for (let px = 0; px < cellSize; px++) {
      const p = ((maskSize - 1 - rect.py - py) * maskSize + rect.px + px) * 4
      maskData[p] = Math.round((entry.slot + 1) / 4 * 255)
      maskData[p + 1] = Math.round(entry.tint[0] * 255)
      maskData[p + 2] = Math.round(entry.tint[1] * 255)
      maskData[p + 3] = Math.round(entry.tint[2] * 255)
    }
    // Low tier gets the same authored surface identities in its existing atlas.
    const x = (entry.slot % 2) * 1024
    const y = Math.floor(entry.slot / 2) * 1024
    atlasContext.drawImage(albedo.image, x, y, 1024, 1024, rect.px, rect.py, cellSize, cellSize)
  }
  const mask = new THREE.DataTexture(maskData, maskSize, maskSize, THREE.RGBAFormat)
  mask.flipY = false
  mask.colorSpace = THREE.NoColorSpace
  mask.minFilter = mask.magFilter = THREE.NearestFilter
  mask.generateMipmaps = false
  // Alpha stores a material tint channel; do not premultiply it into the mask.
  mask.premultiplyAlpha = false
  mask.needsUpdate = true
  atlas.texture.needsUpdate = true
  atlas.urbanSurfaces = {
    albedo: surfaceArray(albedo), normal: surfaceArray(normal), roughness: surfaceArray(roughness), mask,
    scales: new THREE.Vector4(...config.materials.map((material) => material.metersPerRepeat)),
  }
  return atlas.urbanSurfaces
}

/** Compose the selected texture set into the existing physical city shader. */
export function applyUrbanSurfaceShader(shader, surfaces) {
  if (!surfaces) return
  Object.assign(shader.uniforms, {
    uSurfaceAlbedo: { value: surfaces.albedo }, uSurfaceNormal: { value: surfaces.normal },
    uSurfaceRoughness: { value: surfaces.roughness }, uSurfaceMask: { value: surfaces.mask },
    uSurfaceScales: { value: surfaces.scales },
  })
  shader.vertexShader = 'varying vec3 vUrbanNormal;\n' + shader.vertexShader
  shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
    #include <worldpos_vertex>
    vUrbanNormal = normalize(mat3(modelMatrix) * normal);
  `)
  shader.fragmentShader = /* glsl */ `
    uniform highp sampler2DArray uSurfaceAlbedo, uSurfaceNormal, uSurfaceRoughness;
    uniform sampler2D uSurfaceMask;
    uniform vec4 uSurfaceScales;
    varying vec3 vUrbanNormal;
    vec2 urbanUV;
    float urbanSlot;
    vec4 urbanMaterial;
    vec3 urbanTangent;
    vec3 urbanBitangent;
    vec4 urbanSample(highp sampler2DArray channel) {
      return texture(channel, vec3(urbanUV, urbanSlot));
    }
  ` + shader.fragmentShader
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', /* glsl */ `
    #include <map_fragment>
    urbanMaterial = texture2D(uSurfaceMask, vMapUv);
    urbanSlot = clamp(floor(urbanMaterial.r * 4.0 - 0.01), 0.0, 3.0);
    float urbanScale = urbanSlot < 0.5 ? uSurfaceScales.x : urbanSlot < 1.5 ? uSurfaceScales.y : urbanSlot < 2.5 ? uSurfaceScales.z : uSurfaceScales.w;
    vec3 axis = abs(vUrbanNormal);
    if (axis.y > max(axis.x, axis.z)) {
      urbanTangent = vec3(1.0, 0.0, 0.0);
      urbanBitangent = vec3(0.0, 0.0, -sign(vUrbanNormal.y));
    } else if (axis.x > axis.z) {
      urbanTangent = vec3(0.0, 0.0, -sign(vUrbanNormal.x));
      urbanBitangent = vec3(0.0, 1.0, 0.0);
    } else {
      urbanTangent = vec3(sign(vUrbanNormal.z), 0.0, 0.0);
      urbanBitangent = vec3(0.0, 1.0, 0.0);
    }
    urbanUV = vec2(dot(vSurfaceWorld, urbanTangent), dot(vSurfaceWorld, urbanBitangent)) / urbanScale;
    if (urbanMaterial.r > 0.1) diffuseColor.rgb = diffuse * urbanSample(uSurfaceAlbedo).rgb * urbanMaterial.gba;
  `)
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', /* glsl */ `
    #include <roughnessmap_fragment>
    if (urbanMaterial.r > 0.1) roughnessFactor = urbanSample(uSurfaceRoughness).g;
  `)
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
    #include <normal_fragment_maps>
    if (urbanMaterial.r > 0.1) {
      vec3 surfaceNormal = urbanSample(uSurfaceNormal).xyz * 2.0 - 1.0;
      surfaceNormal.xy *= 0.7;
      vec3 worldNormal = normalize(urbanTangent * surfaceNormal.x + urbanBitangent * surfaceNormal.y + normalize(vUrbanNormal) * surfaceNormal.z);
      normal = normalize(mat3(viewMatrix) * worldNormal);
    }
  `)
}

/** Place the authored street props selected in world data, with shared geometry
 * and textures, two bounded mesh LODs and a simple gameplay collision proxy. */
export async function addUrbanProps(scene, collision) {
  const added = addUrbanSigns(scene)
  const placements = (data.world.heroProps || []).filter((prop) => prop.asset === 'metal-trash-can')
  if (!placements.length) return added
  const loader = new GLTFLoader()
  const [near, far] = await Promise.all([0, 1].map((lod) => loader.loadAsync(new URL(`../assets/props/metal-trash-can-lod${lod}.glb`, import.meta.url).href)))
  for (const placement of placements) {
    const object = new THREE.LOD()
    object.name = `urban-prop:${placement.id}`
    // A metre-tall bin no longer needs thousands of rim/handle triangles once
    // it is a small street object. The original close mesh remains within 16m.
    for (const [source, distance] of [[near.scene, 0], [far.scene, 16]]) {
      const mesh = source.clone(true)
      mesh.traverse((child) => {
        if (!child.isMesh) return
        child.castShadow = child.receiveShadow = true
        child.userData.urbanProp = true
        for (const map of [child.material.map, child.material.normalMap, child.material.roughnessMap]) if (map) map.anisotropy = 4
      })
      object.addLevel(mesh, distance, 0.12)
    }
    object.position.set(placement.x, placement.y || 0, placement.z)
    object.rotation.y = placement.yaw || 0
    scene.add(object)
    collision?.add({ type: 'circle', x: placement.x, z: placement.z, r: 0.36, height: 1.04, tag: placement.id })
    added.push(object)
  }
  return added
}

/** Text is rasterized at the actual sign aspect, so letters have the same
 * proportions on a narrow awning as they do on the main record-store fascia. */
function addUrbanSigns(scene) {
  const sources = urbanSignSources
  const cache = new Map(), signs = []
  for (const source of sources) {
    const key = [source.text,source.w,source.h,source.color].join(':')
    let material = cache.get(key)
    if (!material) {
      const canvas = document.createElement('canvas')
      canvas.width = 1024; canvas.height = Math.max(40, Math.round(1024 * source.h / source.w))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = source.color; ctx.fillRect(0,0,canvas.width,canvas.height)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e8dbb8'
      ctx.font = `600 ${Math.round(canvas.height*0.72)}px Arial, sans-serif`
      ctx.fillText(source.text,canvas.width/2,canvas.height*0.54,canvas.width*0.9)
      const map = new THREE.CanvasTexture(canvas)
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8
      material = new THREE.MeshStandardMaterial({map,roughness:0.84,name:'Painted shop sign: '+source.text})
      cache.set(key,material)
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(source.w,source.h),material)
    mesh.name = 'shop-sign:'+source.text; mesh.position.set(source.x,source.y,source.z)
    mesh.rotation.y = source.yaw; mesh.receiveShadow = true
    scene.add(mesh); signs.push(mesh)
  }
  return signs
}

// Geometry records only small placements; all sign instances are added after
// the city has been assembled and before the first interactive frame.
export const urbanSignSources = []
