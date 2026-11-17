/**
 * RAFFI WORLD — physically lit, linear HDR renderer.
 * Shared atlas materials retain the city's batching; geometry supplies local
 * occlusion, while a real sun, filtered environment and surface channels supply
 * directional light and reflections. Tone mapping belongs to the output pass.
 */
import * as THREE from 'three'
import { createPostPass } from './post.js'
import { CSM } from '../vendor/csm/CSM.js'
import { applyUrbanSurfaceShader } from './urban-assets.js'
import { createFoliageMaterial, addFoliageMotion, updateFoliageCell, foliageTime, foliageWind } from '../gen/foliage.js'
import { addPropWobble } from './prop-wobble.js'
import { data, state, device, query, lerp, clamp, makeRng } from './state.js'
import { TIERS, classifyGpu, startPlan, applyLearnedCeiling, createGovernor, stepGovernor } from './quality-core.js'

export const gfx = {
  renderer: null, scene: null, rt: null, post: null,
  materials: {}, atlas: null, internal: { w: 1, h: 1 }, canvas: null,
  lighting: null, quality: null, environment: null, materialSets: null, backend: 'webgl2',
}

const gradeColorA = new THREE.Color()
const gradeColorB = new THREE.Color()
const sunDirection = new THREE.Vector3(-0.45, 0.78, -0.44).normalize()
const cameraPosition = new THREE.Vector3()
const trackedMeshes = new WeakSet()
let lastShadowTime = -Infinity
let environmentGrade = null
let pmrem = null
let waterTime = null
let sky = null
let csm = null
let csmProjection = ''
/**
 * Each new set of cascades gets its own shader program key. three keeps one
 * uniforms object per material and reuses a cached program for a known key,
 * so cascades rebuilt with the old key would draw with the uniforms the old
 * cascades' dispose() deleted, and crash.
 */
let csmGeneration = 0
const originalCacheKeys = new Map()
const originalMaterialHooks = new Map()
const lowLightUniforms = { uLowSun: { value: sunDirection }, uLowKey: { value: new THREE.Color(1, 1, 1) }, uLowFill: { value: new THREE.Color(0.65, 0.72, 0.85) } }
const wetness = { value: 0 }
let localLightSources = []
let localLightPool = []
let headlight = null
let lightSelection = createLightSelector()
let localLightMix = 0.45
let currentRenderCamera = null
let shadowSubmission = null
let qualityPreset = 'auto'
let lastFrameTime = 0
/** Auto mode's plan for this device and the governor that adjusts it while playing. */
let gpu = { renderer: '', class: 'unknown' }
let plan = startPlan('unknown')
let governor = null
/** Render resolution as a fraction of the tier's target (auto mode only). */
let dynamicScale = 1
const CEILING_KEY = 'raffi-world-graphics-ceiling'
const QUALITY_PRESETS = ['auto', 'ultra', 'high', 'balanced', 'performance']

function qualitySettings(preset, renderer) {
  const tier = preset === 'auto' ? (governor?.tier || plan.tier) : preset
  const low = tier === 'performance'
  const balanced = tier === 'balanced'
  const ultra = tier === 'ultra'
  const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')
  const samples = low || balanced || device.mobile ? 0 : Math.min(4, renderer.capabilities.maxSamples)
  return {
    preset, tier, renderTier: low ? 'low' : balanced ? 'medium' : ultra ? 'ultra' : 'high', hdr,
    // Ultra draws up to 1440p-class pixel counts at the display's own density.
    maxPixels: low ? 524288 : device.mobile ? 720000 : ultra ? 3686400 : 2073600,
    drawDistance: low ? 180 : balanced ? 260 : ultra ? 620 : 500,
    pixelRatio: low || balanced ? 1 : ultra ? 2 : 1.5,
    samples,
    // Tiers without MSAA get FXAA in the present pass instead.
    antialias: samples === 0,
    // One tightly bounded contact map on Medium; High uses three 1024 maps, Ultra three 2048.
    shadowSize: low ? 0 : 2048,
    cascadeShadowSize: low || balanced ? 0 : ultra ? 2048 : 1024,
    shadowExtent: balanced ? 42 : 84,
    // Penumbra width in shadow-map texels.
    shadowRadius: balanced ? 2 : ultra ? 3 : 2.5,
    bloom: hdr && !low, bloomLevels: balanced ? 4 : 5,
    ao: hdr && !low && !balanced, aoScale: ultra ? 1 : 0.5, csm: !low && !balanced,
    localLights: low ? 0 : balanced ? 4 : 6,
    scale: preset === 'auto' ? dynamicScale : 1,
  }
}

export function getQuality() {
  return { ...gfx.quality, backend: gfx.backend, gpu: gpu.class, gpuRenderer: gpu.renderer,
    ceiling: qualityPreset === 'auto' ? governor?.ceiling ?? plan.ceiling : null,
    activeShadowMaps: csm ? csm.lights.map(light => light.shadow.mapSize.x) : gfx.lighting?.sun.castShadow ? [gfx.lighting.sun.shadow.mapSize.x] : [],
  }
}

export function setQuality(preset, { automatic = false } = {}) {
  preset = ({ low: 'performance', medium: 'balanced' })[preset] || preset
  if (!QUALITY_PRESETS.includes(preset) || !gfx.renderer) return getQuality()
  if (!automatic) {
    dynamicScale = 1
    governor = preset === 'auto' ? createGovernor(plan) : null
  }
  qualityPreset = preset
  const previous = gfx.quality
  gfx.quality = qualitySettings(preset, gfx.renderer)
  const q = gfx.quality
  gfx.renderer.setPixelRatio(Math.min(device.dpr, q.pixelRatio))
  gfx.renderer.shadowMap.enabled = q.shadowSize > 0
  const { sun } = gfx.lighting
  sun.castShadow = q.shadowSize > 0 && !state.interior
  if (q.shadowSize !== previous.shadowSize) {
    sun.shadow.map?.dispose()
    sun.shadow.map = null
    sun.shadow.mapSize.set(q.shadowSize || 1, q.shadowSize || 1)
  }
  Object.assign(sun.shadow.camera, { left: -q.shadowExtent, right: q.shadowExtent, top: q.shadowExtent, bottom: -q.shadowExtent })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.radius = q.shadowRadius
  if (gfx.rt.samples !== q.samples) {
    gfx.rt.samples = q.samples
    gfx.rt.dispose()
  }
  gfx.post.setBloomEnabled(q.bloom)
  gfx.post.setBloomLevels(q.bloomLevels)
  gfx.post.setAOEnabled(q.ao)
  gfx.post.setAOScale(q.aoScale)
  // High and Ultra differ only in cascade map size and softness: resize the
  // maps in place rather than rebuilding the cascades and recompiling.
  if (csm && q.cascadeShadowSize > 0) {
    const resized = csm.shadowMapSize !== q.cascadeShadowSize
    csm.shadowMapSize = q.cascadeShadowSize
    csm.lights.forEach((light, index) => {
      if (resized) { light.shadow.map?.dispose(); light.shadow.map = null; light.shadow.mapSize.set(q.cascadeShadowSize, q.cascadeShadowSize) }
      light.shadow.radius = q.shadowRadius / (1 + index * 0.5)
    })
  }
  applyMaterialTier()
  lastShadowTime = -Infinity
  resize()
  if (!automatic) { try { localStorage.setItem('raffi-world-graphics', preset) } catch {} }
  return getQuality()
}

export function cycleQuality() {
  return setQuality(QUALITY_PRESETS[(QUALITY_PRESETS.indexOf(qualityPreset) + 1) % QUALITY_PRESETS.length])
}

/** Size the scene for the actual display, with an explicit fill-rate ceiling.
 * Portrait receives the same pixel density as landscape, never a stretched
 * fixed-aspect buffer. Low-fi is a deliberate compatibility option. */
function internalSizeFor(w, h) {
  const q = gfx.quality
  const scale = Math.min(device.dpr, q.pixelRatio)
  const budgetScale = Math.min(scale, Math.sqrt(q.maxPixels / Math.max(1, w * h))) * (q.scale ?? 1)
  return { w: Math.max(1, Math.round(w * budgetScale)), h: Math.max(1, Math.round(h * budgetScale)) }
}

function createSky() {
  const material = new THREE.ShaderMaterial({
    name: 'world:atmosphere', side: THREE.BackSide, depthWrite: false, fog: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color('#5a6fb0') },
      uHorizon: { value: new THREE.Color('#f7b873') },
      uGround: { value: new THREE.Color('#c48a9e') },
      uSun: { value: new THREE.Color('#fff1d0') },
      uSunDirection: { value: sunDirection },
      uSunStrength: { value: 3 }, uCloud: { value: 0.16 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uGround, uSun, uSunDirection;
      uniform float uSunStrength, uCloud;
      varying vec3 vDirection;
      void main() {
        vec3 d = normalize(vDirection);
        float height = max(d.y, 0.0);
        vec3 c = mix(uHorizon, uTop, smoothstep(0.01, 0.30, height));
        c = mix(uGround, c, smoothstep(-0.16, 0.08, d.y));
        float alignment = max(dot(d, uSunDirection), 0.0);
        c += uSun * (pow(alignment, 64.0) * 0.10 + pow(alignment, 1700.0)) * uSunStrength;
        // Broad wisps, not a full-screen noise pass. They sit in the sky only.
        vec2 p = d.xz / max(0.2, d.y + 0.23);
        float wisps = sin(p.x * 2.9 + sin(p.y * 2.0)) * sin(p.y * 3.1 + p.x * 0.9);
        float cloud = smoothstep(0.20, 0.85, wisps) * smoothstep(0.02, 0.22, d.y);
        c = mix(c, uHorizon * 0.65 + vec3(0.30), cloud * uCloud);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), material)
  mesh.name = 'world:sky'
  mesh.frustumCulled = false
  mesh.renderOrder = -100
  return mesh
}

export function initRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
  })
  try {
    const saved = localStorage.getItem('raffi-world-graphics')
    if (QUALITY_PRESETS.includes(saved)) qualityPreset = saved
  } catch {}
  const params = new URLSearchParams(location.search)
  const requested = params.get('tier') || params.get('quality')
  const requestedQuality = ({ low: 'performance', medium: 'balanced' })[requested] || requested
  if (QUALITY_PRESETS.includes(requestedQuality)) qualityPreset = requestedQuality
  if (query.lowfi) qualityPreset = 'performance'
  gpu = detectGpu(renderer)
  let learned = null
  try { const saved = JSON.parse(localStorage.getItem(CEILING_KEY) || 'null'); if (saved?.renderer === gpu.renderer) learned = saved.ceiling } catch {}
  plan = applyLearnedCeiling(startPlan(gpu.class), learned)
  dynamicScale = 1
  governor = qualityPreset === 'auto' ? createGovernor(plan) : null
  gfx.quality = qualitySettings(qualityPreset, renderer)
  const { hdr } = gfx.quality
  renderer.setPixelRatio(Math.min(device.dpr, gfx.quality.pixelRatio))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = 1
  renderer.autoClear = true
  renderer.shadowMap.enabled = gfx.quality.shadowSize > 0
  // r183 retired PCFSoft; PCF with a radius now samples a rotated disc, which is softer.
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.info.autoReset = false

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xc48a9e, 180, 620)
  const hemi = new THREE.HemisphereLight(0xc8d9f2, 0x6c5b50, 1.25)
  hemi.name = 'world:sky-fill'
  const sun = new THREE.DirectionalLight(0xfff1d0, 3.2)
  sun.name = 'world:sun'
  sun.castShadow = renderer.shadowMap.enabled
  sun.shadow.mapSize.set(gfx.quality.shadowSize || 1, gfx.quality.shadowSize || 1)
  const extent = gfx.quality.shadowExtent
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 650 })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = -0.00006
  sun.shadow.radius = gfx.quality.shadowRadius
  sun.shadow.normalBias = 0.018
  sun.shadow.autoUpdate = false
  scene.add(hemi, sun, sun.target)
  sky = createSky()
  scene.add(sky)

  gfx.renderer = renderer
  gfx.scene = scene
  gfx.canvas = canvas
  gfx.lighting = { sun, hemi }
  const internal = internalSizeFor(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight)
  gfx.rt = new THREE.WebGLRenderTarget(internal.w, internal.h, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    generateMipmaps: false, depthBuffer: true,
    colorSpace: THREE.LinearSRGBColorSpace, samples: gfx.quality.samples,
  })
  gfx.rt.depthTexture = new THREE.DepthTexture(internal.w, internal.h, THREE.UnsignedIntType)
  gfx.internal = internal
  gfx.post = createPostPass({ hdr, bloom: gfx.quality.bloom })
  gfx.post.setBloomLevels(gfx.quality.bloomLevels)
  gfx.post.setAOScale(gfx.quality.aoScale)
  gfx.post.setInternalSize(internal.w, internal.h)
  syncPresent(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, internal)
  gfx.post.setPresentation(data.world.render || {})
  gfx.post.setAOEnabled(gfx.quality.ao)
  if (hdr) {
    pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()
  }
  environmentGrade = null
  lastShadowTime = -Infinity
  localLightPool = Array.from({ length: 6 }, (_, index) => {
    const light = new THREE.PointLight(0xffd6a6, 0, 28, 2)
    light.name = `world:local-light:${index}`
    scene.add(light)
    return light
  })
  headlight = new THREE.SpotLight(0xfff0cf, 0, 58, 0.5, 0.65, 2)
  headlight.name = 'world:headlights'
  scene.add(headlight, headlight.target)
  return gfx
}

function createVertexLitMaterial(base, role, surfaces = null) {
  const material = new THREE.MeshBasicMaterial({ ...base, name: `world:vertex-lit-${role}` })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lowLightUniforms)
    shader.vertexShader = 'uniform vec3 uLowSun, uLowKey, uLowFill;\nvarying vec3 vVertexLight;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 lowNormal = normal;
      #ifdef USE_INSTANCING
        lowNormal = mat3(instanceMatrix) * lowNormal;
      #endif
      lowNormal = normalize(mat3(modelMatrix) * lowNormal);
      float lowKey = max(dot(lowNormal, uLowSun), 0.0);
      vVertexLight = uLowFill * (0.68 + max(lowNormal.y, 0.0) * 0.16) + uLowKey * lowKey * 0.58;
    `)
    shader.fragmentShader = 'varying vec3 vVertexLight;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vVertexLight;')
    if (surfaces) {
      shader.vertexShader = 'varying vec3 vSurfaceWorld;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSurfaceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = 'varying vec3 vSurfaceWorld;\n' + shader.fragmentShader
      applyUrbanSurfaceShader(shader, surfaces)
    }
  }
  material.customProgramCacheKey = () => 'world-vertex-fallback-v1:' + !!surfaces
  return material
}

function applyMaterialTier() {
  if (!gfx.materialSets) return
  const next = gfx.quality.tier === 'performance' ? gfx.materialSets.low : gfx.materialSets.physical
  for (const key of ['opaque', 'actor', 'water', 'foliage']) gfx.materials[key] = next[key]
  gfx.scene.traverse((object) => {
    const role = object.material?.userData?.worldRole
    if (role && next[role]) object.material = next[role]
  })
}

function createWaterMaterial() {
  const material = new THREE.MeshStandardMaterial({
    name: 'world:harbour-water', color: 0x2e8fa8, roughness: 0.24,
    metalness: 0.16, envMapIntensity: 1.5, fog: true,
  })
  waterTime = { value: 0 }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = waterTime
    shader.vertexShader = 'varying vec3 vWaterWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `)
    shader.fragmentShader = 'uniform float uWaterTime;\nvarying vec3 vWaterWorld;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec2 p = vWaterWorld.xz;
      float t = uWaterTime;
      // Analytic world-space wave normals stay stable as the camera moves.
      float nx = cos(p.x * 0.47 + p.y * 0.29 + t * 0.80) * 0.13
               + cos(p.x * 1.26 - p.y * 0.64 + t * 1.17) * 0.055;
      float nz = sin(p.y * 0.55 - p.x * 0.21 + t * 0.63) * 0.12
               + sin(p.y * 1.37 + p.x * 0.71 - t * 1.09) * 0.045;
      normal = normalize(mat3(viewMatrix) * vec3(nx, 1.0, nz));
    `)
  }
  material.customProgramCacheKey = () => 'world-water-waves-v1'
  return material
}

/** Shared physical materials retain original geometry, vertex AO and atlas. */
export function initMaterials(atlasTexture, channels = {}) {
  gfx.atlas = atlasTexture
  localLightSources = channels.lightSources || atlasTexture.userData.lightSources || []
  lightSelection = createLightSelector()
  const surfaces = atlasTexture.userData.surfaceMaps || atlasTexture.userData.materialTextures || {}
  const roughnessMap = surfaces.roughnessMap || channels.roughnessTexture || null
  const bumpMap = surfaces.bumpMap || channels.bumpTexture || null
  const metalnessMap = surfaces.metalnessMap || channels.metalnessTexture || null
  const emissiveMap = surfaces.emissiveMap || channels.emissiveTexture || null
  for (const texture of [atlasTexture, roughnessMap, bumpMap, metalnessMap, emissiveMap]) {
    // Streets and facades seen at a grazing angle stay sharp into the distance.
    if (texture) texture.anisotropy = Math.min(device.mobile ? 4 : 16, gfx.renderer.capabilities.getMaxAnisotropy())
  }
  const base = { map: atlasTexture, vertexColors: true, fog: true }
  const physical = {
    ...base, roughness: 1, roughnessMap, bumpMap, bumpScale: 0.055,
    metalness: metalnessMap ? 1 : 0, metalnessMap, envMapIntensity: 0.9, shadowSide: THREE.BackSide,
  }
  gfx.materials = {
    opaque: new THREE.MeshStandardMaterial({ ...physical, name: 'world:physical-city' }),
    // Unlit emissive geometry can exceed 1.0 in linear HDR and feed bloom.
    emissive: new THREE.MeshBasicMaterial({ ...base, name: 'world:emission', color: new THREE.Color(2.7, 2.7, 2.7), fog: true, toneMapped: false }),
    // Atlas alpha also contains grounding decals; unlit blending preserves
    // their coverage while opaque facades and actors receive physical light.
    alpha: new THREE.MeshBasicMaterial({ ...base, name: 'world:decals', transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }),
    actor: new THREE.MeshStandardMaterial({
      ...physical, name: 'world:physical-actor', roughness: 0.76, bumpScale: 0.015,
      emissiveMap, emissive: emissiveMap ? 0xffffff : 0, emissiveIntensity: 2.7,
      transparent: true, depthWrite: true, alphaTest: 0.01,
    }),
    water: createWaterMaterial(),
    foliage: createFoliageMaterial(),
    ghost: new THREE.MeshBasicMaterial({
      color: 0x6be3ff, transparent: true, opacity: data.npcs.replay.ghostOpacity,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }),
    debug: new THREE.MeshBasicMaterial({ color: 0x2ec4b6, wireframe: true, transparent: true, opacity: 0.6, fog: false, depthTest: false }),
  }
  const city = gfx.materials.opaque
  city.onBeforeCompile = (shader) => {
    shader.uniforms.uWetness = wetness
    shader.vertexShader = 'varying vec3 vSurfaceWorld;\nvarying float vSurfaceUp;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vSurfaceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vSurfaceUp = max(0.0, (mat3(modelMatrix) * normal).y);
    `)
    shader.fragmentShader = 'uniform float uWetness;\nvarying vec3 vSurfaceWorld;\nvarying float vSurfaceUp;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      float surfaceWet = uWetness * vSurfaceUp * (1.0 - smoothstep(0.45, 1.6, vSurfaceWorld.y));
      roughnessFactor = mix(roughnessFactor, 0.14, surfaceWet);
      diffuseColor.rgb *= 1.0 - surfaceWet * 0.18;
    `)
    applyUrbanSurfaceShader(shader, channels.urbanSurfaces)
  }
  city.customProgramCacheKey = () => 'world-wet-ground-v1:' + !!channels.urbanSurfaces
  gfx.materials.actor.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance *= vColor.rgb;
      #endif
    `)
  }
  gfx.materials.actor.customProgramCacheKey = () => 'world-actor-lamps-v1'
  const low = {
    opaque: createVertexLitMaterial(base, 'city', channels.urbanSurfaces),
    actor: createVertexLitMaterial({ ...base, transparent: true, depthWrite: true, alphaTest: 0.01 }, 'actor'),
    water: new THREE.MeshBasicMaterial({ color: gfx.materials.water.color, fog: true, name: 'world:low-water' }),
    foliage: createVertexLitMaterial({ map: gfx.materials.foliage.map, alphaTest: 0.42, transparent: false, depthWrite: true, side: THREE.DoubleSide, fog: true }, 'foliage'),
  }
  addFoliageMotion(low.foliage)
  // Bumped street poles sway in the merged city geometry (game/feel.js).
  for (const material of [gfx.materials.opaque, low.opaque, gfx.materials.emissive]) addPropWobble(material)
  gfx.materialSets = { physical: { opaque: gfx.materials.opaque, actor: gfx.materials.actor, water: gfx.materials.water, foliage: gfx.materials.foliage }, low }
  for (const set of Object.values(gfx.materialSets)) for (const [role, material] of Object.entries(set)) material.userData.worldRole = role
  for (const material of Object.values(gfx.materialSets.physical)) {
    originalMaterialHooks.set(material, material.onBeforeCompile)
    material.userData.preCSMHook = material.onBeforeCompile
  }
  applyMaterialTier()
  return gfx.materials
}

function blendGrade(from, to, amount) {
  if (amount >= 1 || from === to) return to
  const blended = { ...to, post: {} }
  for (const key of ['skyTop', 'skyBottom', 'fogColor', 'ambient', 'shadowTint', 'key', 'waterColor']) {
    blended[key] = gradeColorA.set(from[key]).lerp(gradeColorB.set(to[key]), amount).getStyle()
  }
  blended.keyDir = {
    x: lerp(from.keyDir.x, to.keyDir.x, amount),
    y: lerp(from.keyDir.y, to.keyDir.y, amount),
    z: lerp(from.keyDir.z, to.keyDir.z, amount),
  }
  for (const key of Object.keys(to.post || {})) blended.post[key] = lerp(from.post?.[key] ?? to.post[key], to.post[key], amount)
  return blended
}

/** Small generated environment, prefiltered once per completed grade change.
 * Colour textures enter as sRGB; PMREM's output remains linear HDR. Besides
 * the sky it carries the sun's glow and a ring of city skyline, lit windows
 * after dark, so car paint, glass and wet streets reflect a city. */
function updateEnvironment(grade, id) {
  if (!pmrem || environmentGrade === id) return
  const W = 512, H = 256, horizon = H / 2
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, gradeColorA.set(grade.skyTop).lerp(gradeColorB.set('#dce5ee'), 0.36).getStyle())
  gradient.addColorStop(0.44, grade.skyBottom)
  gradient.addColorStop(0.53, grade.fogColor)
  gradient.addColorStop(1, '#252b32')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
  const night = id === 'night' || id === 'mainframe' ? 1 : id === 'dusk' ? 0.45 : 0
  // The sun's glow, where the equirectangular map puts its direction.
  if (sunDirection.y > -0.05 && night < 1) {
    const u = Math.atan2(sunDirection.z, sunDirection.x) / (Math.PI * 2) + 0.5
    const v = Math.asin(clamp(sunDirection.y, -1, 1)) / Math.PI + 0.5
    const glow = ctx.createRadialGradient(u * W, (1 - v) * H, 0, u * W, (1 - v) * H, 48)
    glow.addColorStop(0, gradeColorA.set(grade.key).getStyle())
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
  }
  // Skyline: low blocks all round, a few towers. Seeded, so it never changes.
  const rng = makeRng('environment-skyline')
  const silhouette = gradeColorA.set(grade.fogColor).lerp(gradeColorB.set('#141922'), 0.55 + night * 0.35).getStyle()
  const windows = []
  ctx.fillStyle = silhouette
  for (let x = 0; x < W;) {
    const width = rng.int(5, 16)
    const height = rng.chance(0.12) ? rng.int(18, 30) : rng.int(4, 13)
    ctx.fillRect(x, horizon - height, width + 1, height + 2)
    if (night > 0) for (let wy = horizon - height + 2; wy < horizon - 1; wy += 3) for (let wx = x + 1; wx < x + width - 1; wx += 3) if (rng.chance(0.35 * night)) windows.push([wx, wy])
    x += width
  }
  ctx.fillStyle = `rgba(255, 196, 120, ${0.55 + night * 0.4})`
  for (const [wx, wy] of windows) ctx.fillRect(wx, wy, 1, 1)
  if (night > 0) {
    // Streetlight haze hangs over the city just above the rooftops.
    const haze = ctx.createLinearGradient(0, horizon - 26, 0, horizon + 6)
    haze.addColorStop(0, 'rgba(255,170,110,0)')
    haze.addColorStop(0.7, `rgba(255,170,110,${0.16 * night})`)
    haze.addColorStop(1, 'rgba(255,170,110,0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = haze
    ctx.fillRect(0, horizon - 26, W, 32)
    ctx.globalCompositeOperation = 'source-over'
  }
  const source = new THREE.CanvasTexture(canvas)
  source.colorSpace = THREE.SRGBColorSpace
  source.mapping = THREE.EquirectangularReflectionMapping
  const environment = pmrem.fromEquirectangular(source)
  source.dispose()
  gfx.scene.environment = environment.texture
  gfx.environment?.dispose()
  gfx.environment = environment
  environmentGrade = id
}

const LIGHT_LEVELS = {
  dusk: { sun: 3.4, sky: 1.25, env: 1.0, disk: 3.0 },
  haze: { sun: 3.8, sky: 1.05, env: 0.85, disk: 3.4 },
  // Night leans on lamps, windows and neon: the sky fill is low enough for
  // their pools of light to read, high enough to find your way between them.
  night: { sun: 0.7, sky: 0.82, env: 0.66, disk: 0.5 },
  mainframe: { sun: 0.65, sky: 1.7, env: 0.55, disk: 0 },
}

function lightLevels(id) {
  return { ...(LIGHT_LEVELS[id] || LIGHT_LEVELS.dusk), ...data.world.grades[id]?.lighting }
}

export function applyGrade(id, blend = 1, fromId = null) {
  const grades = data.world.grades
  const g = grades[id] || grades.dusk
  const from = fromId ? grades[fromId] || g : g
  const t = clamp(blend, 0, 1)
  const fog = gfx.scene.fog
  fog.color.set(from.fogColor).lerp(gradeColorA.set(g.fogColor), t)
  fog.near = lerp(from.fogNear, g.fogNear, t)
  fog.far = lerp(from.fogFar, g.fogFar, t)
  if (state.interior?.fog === false) { fog.near = 1000; fog.far = 4000 }
  const blended = blendGrade(from, g, t)
  const level = lightLevels(id)
  const previous = fromId ? lightLevels(fromId) : level
  const { sun, hemi } = gfx.lighting
  sun.color.set(blended.key)
  sun.intensity = lerp(previous.sun, level.sun, t)
  hemi.color.set(blended.skyTop).lerp(gradeColorA.set('#c8d9ed'), 0.68)
  hemi.groundColor.set(blended.ambient).lerp(gradeColorA.set('#6d625b'), 0.6)
  hemi.intensity = lerp(previous.sky, level.sky, t)
  gfx.scene.environmentIntensity = lerp(previous.env, level.env, t)
  sunDirection.set(-blended.keyDir.x, -blended.keyDir.y, -blended.keyDir.z).normalize()
  const u = sky.material.uniforms
  u.uTop.value.set(blended.skyTop)
  u.uHorizon.value.set(blended.skyBottom)
  u.uGround.value.set(blended.fogColor)
  u.uSun.value.set(blended.key)
  u.uSunStrength.value = lerp(previous.disk, level.disk, t)
  u.uCloud.value = id === 'night' || id === 'mainframe' ? 0.08 : 0.22
  gfx.scene.background = fog.color
  gfx.post.setGrade(blended)
  gfx.materials.water?.color.set(blended.waterColor)
  if (gfx.materialSets) {
    gfx.materialSets.physical.water.color.set(blended.waterColor)
    gfx.materialSets.low.water.color.set(blended.waterColor)
  }
  lowLightUniforms.uLowKey.value.copy(sun.color)
  lowLightUniforms.uLowFill.value.copy(hemi.color)
  const nightAmount = (grade) => grade === 'night' || grade === 'mainframe' ? 1 : grade === 'dusk' ? 0.5 : 0
  localLightMix = lerp(nightAmount(fromId || id), nightAmount(id), t)
  // Daytime glass bulbs remain visible, but no longer read as white light balls.
  // Emission and pooled lights follow the same sun/night transition.
  gfx.materials.emissive?.color.setScalar(lerp(0.32, 2.7, localLightMix))
  if (gfx.materialSets?.physical.actor) gfx.materialSets.physical.actor.emissiveIntensity = lerp(0.12, 2.7, localLightMix)
  const districtWetness = data.blocks.districts[state.district]?.wetness ?? (state.district === 'strip' ? 0.94 : 0.52)
  wetness.value = state.interior ? 0 : (blended.post?.wetness ?? localLightMix * districtWetness)
  // Avoid allocating/regenerating PMREM on every frame of a transition.
  if (!gfx.environment || t >= 1) updateEnvironment(blended, id)
  lastShadowTime = -Infinity
}

export function resize() {
  const w = gfx.canvas.clientWidth || window.innerWidth
  const h = gfx.canvas.clientHeight || window.innerHeight
  gfx.renderer.setSize(w, h, false)
  const internal = internalSizeFor(w, h)
  if (internal.w !== gfx.internal.w || internal.h !== gfx.internal.h) {
    gfx.internal = internal
    gfx.rt.setSize(internal.w, internal.h)
    gfx.post.setInternalSize(internal.w, internal.h)
  }
  syncPresent(w, h, internal)
  return internal
}

/** FXAA on tiers without MSAA; a little sharpening when the scene is drawn smaller than the screen. */
function syncPresent(w, h, internal) {
  const upscale = Math.sqrt((w * Math.min(device.dpr, 2) * h * Math.min(device.dpr, 2)) / Math.max(1, internal.w * internal.h))
  const recover = upscale > 1.05 ? clamp((upscale - 1) * 0.3, 0, 0.22) : 0
  gfx.post.setPresent({ antialias: gfx.quality.antialias, sharpen: (gfx.quality.antialias ? 0.08 : 0) + recover })
}

function updateLighting(camera) {
  const { sun } = gfx.lighting
  camera.getWorldPosition(cameraPosition)
  sky.position.copy(cameraPosition)
  sky.scale.setScalar(camera.isPerspectiveCamera ? Math.min(1200, camera.far * 0.94) : 1200)
  sky.visible = !state.interior
  if (waterTime) waterTime.value = state.time
  foliageTime.value = state.time
  foliageWind.value = gfx.quality.tier === 'performance' ? 0 : 1
  gfx.scene.traverse((object) => {
    if (object.userData.foliage) updateFoliageCell(object, cameraPosition, gfx.quality.tier)
    if (object.isLOD && object.userData.residential) {
      const low = gfx.quality.tier === 'performance'
      object.autoUpdate = !low
      if (low) object.levels.forEach((level, index) => { level.object.visible = index === object.levels.length - 1 })
    }
    if (!object.isMesh || trackedMeshes.has(object)) return
    const beforeRender = object.onBeforeRender
    object.onBeforeRender = function (renderer, scene, view, ...args) {
      if (!shadowSubmission && view === currentRenderCamera && renderer.getRenderTarget() === gfx.rt) {
        shadowSubmission = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }
      }
      beforeRender?.call(this, renderer, scene, view, ...args)
    }
    if (object.material?.userData?.worldRole === 'opaque' || object.material?.userData?.worldRole === 'actor') {
      object.castShadow = true
      object.receiveShadow = true
    } else if (object.material === gfx.materials.water) object.receiveShadow = true
    trackedMeshes.add(object)
  })
  updateLocalLights()
  const usingCSM = updateCascades(camera)
  const extent = gfx.quality.shadowExtent
  const texel = 2 * extent / Math.max(1, gfx.quality.shadowSize)
  // Stable world anchoring avoids crawling shadows during slow movement.
  const x = Math.round(state.player.x / texel) * texel
  const z = Math.round(state.player.z / texel) * texel
  sun.target.position.set(x, state.player.y + 8, z)
  sun.position.copy(sun.target.position).addScaledVector(sunDirection, 280)
  const enable = gfx.quality.shadowSize > 0 && !state.interior && !usingCSM
  sun.visible = !usingCSM
  if (sun.castShadow !== enable) { sun.castShadow = enable; lastShadowTime = -Infinity }
  if (enable && state.time - lastShadowTime >= (device.mobile ? 1 / 20 : 1 / 30)) {
    sun.shadow.needsUpdate = true
    gfx.renderer.shadowMap.needsUpdate = true
    lastShadowTime = state.time
  }
}

/** Cached nearest fixtures, with immediate recovery after saves or teleports. */
export function createLightSelector() {
  let lastTime = -Infinity, x = Infinity, z = Infinity, selected = []
  return (time, position, sources) => {
    if (time < lastTime || time - lastTime > 0.22 || Math.hypot(position.x - x, position.z - z) > 8) {
      selected = sources
        .map(source => ({ source, distance: (source.x - position.x) ** 2 + (source.z - position.z) ** 2 }))
        .filter(item => item.distance < 65 * 65)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6).map(item => item.source)
      lastTime = time; x = position.x; z = position.z
    }
    return selected
  }
}

function updateLocalLights() {
  const active = gfx.quality.localLights
  const selectedLights = lightSelection(state.time, state.player, localLightSources)
  for (let i = 0; i < localLightPool.length; i++) {
    const light = localLightPool[i]
    light.visible = i < active
    const source = selectedLights[i]
    // Keep the shader's light count stable while changing their positions.
    light.intensity = source && i < active && !state.interior ? (source.power || 140) * localLightMix : 0
    if (!source) continue
    light.position.set(source.x, source.y, source.z)
    light.color.set(source.color)
    light.distance = source.distance || 28
  }
  const vehicle = data.vehicles.archetypes[state.player.vehicle]
  const mounted = state.mode === 'vehicle' && vehicle && !vehicle.riderVisible
  headlight.visible = active > 0
  headlight.intensity = active && mounted && !state.interior ? 210 * localLightMix : 0
  if (mounted) {
    const yaw = state.player.yaw
    const length = vehicle.silhouette?.length || 4.6
    const y = state.player.y + 0.85
    headlight.position.set(state.player.x + Math.sin(yaw) * length * 0.5, y, state.player.z + Math.cos(yaw) * length * 0.5)
    headlight.target.position.set(state.player.x + Math.sin(yaw) * 30, state.player.y - 0.3, state.player.z + Math.cos(yaw) * 30)
  }
}

function removeCascades() {
  if (!csm) return
  csm.remove()
  for (const light of csm.lights) light.shadow.dispose()
  csm.dispose()
  for (const [material, hook] of originalMaterialHooks) { material.onBeforeCompile = hook; material.needsUpdate = true }
  for (const [material, key] of originalCacheKeys) { material.customProgramCacheKey = key; material.needsUpdate = true }
  originalCacheKeys.clear()
  csm = null
  csmProjection = ''
  lastShadowTime = -Infinity
}

function updateCascades(camera) {
  const enabled = gfx.quality.csm && camera.isPerspectiveCamera && !state.interior
  if (!enabled) { removeCascades(); return false }
  if (!csm) {
    // Release the previous single-map allocation when switching to cascades.
    gfx.lighting.sun.shadow.map?.dispose()
    gfx.lighting.sun.shadow.map = null
    csm = new CSM({
      camera, parent: gfx.scene, cascades: 3, maxFar: 230,
      shadowMapSize: gfx.quality.cascadeShadowSize, lightDirection: sunDirection.clone().negate(),
      lightIntensity: gfx.lighting.sun.intensity, lightMargin: 250,
      lightNear: 1, lightFar: 700, shadowBias: -0.000035,
    })
    csm.fade = true
    csmGeneration++
    csm.updateFrustums()
    csm.lights.forEach((light, index) => {
      light.shadow.normalBias = 0.018 + index * 0.012
      // Far cascades cover more ground per texel, so they need less radius for the same softness.
      light.shadow.radius = gfx.quality.shadowRadius / (1 + index * 0.5)
      light.shadow.autoUpdate = false
    })
    lastShadowTime = -Infinity
  }
  const register = (material) => {
    if (csm.shaders.has(material)) return
    if (!originalMaterialHooks.has(material)) {
      originalMaterialHooks.set(material, material.onBeforeCompile)
      material.addEventListener('dispose', () => {
        originalMaterialHooks.delete(material)
        originalCacheKeys.delete(material)
        csm?.shaders.delete(material)
      })
    }
    const hook = originalMaterialHooks.get(material)
    material.userData.preCSMHook = hook
    if (!originalCacheKeys.has(material)) originalCacheKeys.set(material, material.customProgramCacheKey)
    const baseKey = originalCacheKeys.get(material)
    const generation = csmGeneration
    material.customProgramCacheKey = () => baseKey.call(material) + ':csm' + generation
    csm.setupMaterial(material)
    const csmHook = material.onBeforeCompile
    material.onBeforeCompile = (shader, renderer) => { hook?.(shader, renderer); csmHook(shader, renderer) }
    material.needsUpdate = true
  }
  for (const material of Object.values(gfx.materialSets.physical)) register(material)
  gfx.scene.traverse((object) => {
    if (object.material?.isMeshStandardMaterial) register(object.material)
  })
  csm.camera = camera
  const projection = [camera.fov, camera.aspect, camera.near, camera.far].join(':')
  if (projection !== csmProjection) { csmProjection = projection; csm.updateFrustums() }
  csm.lightDirection.copy(sunDirection).negate()
  camera.updateMatrixWorld(true)
  csm.update()
  const refresh = state.time - lastShadowTime >= 1 / 30
  for (const light of csm.lights) {
    light.color.copy(gfx.lighting.sun.color)
    light.intensity = gfx.lighting.sun.intensity
    if (refresh) light.shadow.needsUpdate = true
  }
  if (refresh) { gfx.renderer.shadowMap.needsUpdate = true; lastShadowTime = state.time }
  return true
}

/** What the browser says the GPU is. Some browsers hide it; that reads as unknown. */
function detectGpu(renderer) {
  let name = ''
  try {
    const gl = renderer.getContext()
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '')
  } catch {}
  return { renderer: name.slice(0, 160), class: classifyGpu(name, { mobile: device.mobile }) }
}

/**
 * Auto mode: the governor lowers the render resolution before a tier, and
 * climbs back when frames have room. A tier this device could not hold is
 * remembered for its next visit, so it is not tried again every session.
 */
function updateAutomaticQuality() {
  const now = performance.now()
  const elapsed = now - lastFrameTime
  lastFrameTime = now
  if (qualityPreset !== 'auto' || !governor || !state.ready || state.paused || document.hidden || elapsed <= 0 || elapsed > 2000) return
  governFrame(elapsed, now / 1000)
}

function governFrame(frameMs, seconds) {
  const ceiling = governor.ceiling
  const next = stepGovernor(governor, frameMs, seconds)
  if (governor.ceiling !== ceiling) {
    try { localStorage.setItem(CEILING_KEY, JSON.stringify({ renderer: gpu.renderer, ceiling: governor.ceiling })) } catch {}
  }
  if (!next) return null
  dynamicScale = next.scale
  if (next.tier && next.tier !== gfx.quality.tier) setQuality('auto', { automatic: true })
  else { gfx.quality = qualitySettings('auto', gfx.renderer); resize() }
  return next
}

/**
 * Smokes only (debug API): feeds auto mode frames as if they had happened,
 * so the resolution and tier changes can be checked on a real page without
 * waiting minutes of real slow frames. Returns the changes it made.
 */
export function feedQualityGovernor(frameMs, frames) {
  if (qualityPreset !== 'auto' || !governor) return []
  let clock = Math.max(performance.now() / 1000, governor.lastChange + 1)
  const changes = []
  for (let i = 0; i < frames; i++) {
    clock += frameMs / 1000
    const change = governFrame(frameMs, clock)
    if (change) changes.push(change)
  }
  return changes
}

export function renderFrame(camera) {
  const renderer = gfx.renderer
  updateAutomaticQuality()
  if (camera.isPerspectiveCamera) {
    const far = state.interior ? 600 : gfx.quality.drawDistance
    if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix() }
  }
  updateLighting(camera)
  renderer.info.reset()
  currentRenderCamera = camera
  shadowSubmission = null
  renderer.setRenderTarget(gfx.rt)
  renderer.clear()
  const fog = gfx.scene.fog
  const nearBefore = fog.near, farBefore = fog.far
  const fogOffset = camera.isOrthographicCamera ? camera.userData.fogOffset || 0 : 0
  fog.near = camera.isPerspectiveCamera && !state.interior ? Math.min(fog.near, camera.far * 0.5) : fog.near + fogOffset
  fog.far = camera.isPerspectiveCamera && !state.interior ? Math.min(fog.far, camera.far * 0.92) : fog.far + fogOffset
  renderer.render(gfx.scene, camera)
  const sceneCalls = renderer.info.render.calls
  const sceneTriangles = renderer.info.render.triangles
  fog.near = nearBefore
  fog.far = farBefore
  gfx.post.render(renderer, gfx.rt, camera)
  state.stats.drawCalls = renderer.info.render.calls
  state.stats.triangles = renderer.info.render.triangles
  state.stats.visibleDrawCalls = sceneCalls - (shadowSubmission?.calls || 0)
  state.stats.visibleTriangles = sceneTriangles - (shadowSubmission?.triangles || 0)
  state.stats.shadowDrawCalls = shadowSubmission?.calls || 0
  state.stats.shadowTriangles = shadowSubmission?.triangles || 0
  state.stats.postDrawCalls = renderer.info.render.calls - sceneCalls
  state.stats.renderWidth = gfx.internal.w
  state.stats.renderHeight = gfx.internal.h
  state.stats.quality = gfx.quality.tier
}
