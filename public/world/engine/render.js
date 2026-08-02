/**
 * RAFFI WORLD — renderer, render target, materials, grade + fog.
 *
 * All lighting is baked into vertex colours at generation time, so the scene
 * contains **no** THREE lights at all. Every surface is a MeshBasicMaterial
 * with `vertexColors: true` sampling one shared atlas. That is what keeps the
 * draw call and triangle budgets in WORLD-BIBLE §9 reachable on a phone.
 *
 * Presentation aims at soft early-2000s city games (Spider-Man PS2 vibe):
 * bilinear internal buffer, mild bloom in post, atmospheric fog — not
 * nearest-neighbour Minecraft crunch.
 */

import * as THREE from 'three'
import { createPostPass } from './post.js'
import { data, state, device, query, lerp, clamp } from './state.js'

export const gfx = {
  renderer: null,
  scene: null,
  rt: null,
  post: null,
  materials: {},
  atlas: null,
  internal: { w: 512, h: 288 },
  canvas: null,
}

/** Keeps the internal buffer at a constant pixel *area* while matching the
 *  display aspect, so portrait phones get a correct image instead of a
 *  stretched 16:9 one. */
function internalSizeFor(aspect) {
  const r = data.world.render
  const base = device.mobile || query.lowfi
    ? r.mobileInternalWidth * r.mobileInternalHeight
    : r.internalWidth * r.internalHeight
  const h = Math.round(Math.sqrt(base / Math.max(aspect, 0.0001)))
  const w = Math.round(h * aspect)
  return { w: clamp(w, 160, 1024), h: clamp(h, 120, 1024) }
}

function makeSkyTexture(grade) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, grade.skyTop)
  g.addColorStop(0.62, grade.skyBottom)
  g.addColorStop(1, grade.fogColor)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

export function initRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setPixelRatio(data.world.render.maxPixelRatio || 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.autoClear = true
  renderer.shadowMap.enabled = false
  renderer.info.autoReset = false

  const scene = new THREE.Scene()
  // Dense atmospheric haze — the Spidey PS2 city tell. Linear fog keeps far
  // towers melting into the sky card instead of hard Minecraft cutoffs.
  scene.fog = new THREE.Fog(0x000000, 80, 420)

  const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1)
  const internal = internalSizeFor(aspect)
  // Linear filter = soft PS2 upscale. Nearest made the whole game read as
  // a voxel/Minecraft screenshot even though the geometry is low-poly city.
  const rt = new THREE.WebGLRenderTarget(internal.w, internal.h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: true,
    colorSpace: THREE.SRGBColorSpace,
  })

  const post = createPostPass()
  post.setInternalSize(internal.w, internal.h)
  post.setPresentation(data.world?.render || {})

  gfx.renderer = renderer
  gfx.scene = scene
  gfx.rt = rt
  gfx.post = post
  gfx.internal = internal
  gfx.canvas = canvas

  return gfx
}

/**
 * Shared materials. Dynamic actors use one transparent atlas material so a
 * merged car or pedestrian can include glass and its blob shadow in one draw.
 */
export function initMaterials(atlasTexture) {
  gfx.atlas = atlasTexture

  const base = {
    map: atlasTexture,
    vertexColors: true,
    toneMapped: false,
  }

  gfx.materials = {
    /** Buildings, roads, props, terrain. The bulk of every frame. */
    opaque: new THREE.MeshBasicMaterial({ ...base, fog: true }),

    /** Neon, lamps, screens, headlights. Unfogged so it punches at distance —
     *  the single most important trick for the night grade. */
    emissive: new THREE.MeshBasicMaterial({ ...base, fog: false }),

    /** Glass, chainlink, blob shadows, decals. */
    alpha: new THREE.MeshBasicMaterial({
      ...base,
      fog: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    }),

    /** One-pass cars and pedestrians, including atlas alpha for glass/shadows. */
    actor: new THREE.MeshBasicMaterial({
      ...base,
      fog: true,
      transparent: true,
      depthWrite: true,
      alphaTest: 0.01,
    }),

    /** Harbour surface. Flat colour, tinted per grade. */
    water: new THREE.MeshBasicMaterial({ color: 0x123, fog: true }),

    /** Replay ghosts. Additive so overlapping trails read as density. */
    ghost: new THREE.MeshBasicMaterial({
      color: 0x6be3ff,
      transparent: true,
      opacity: data.npcs.replay.ghostOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),

    /** ?debug=1 collision volumes. */
    debug: new THREE.MeshBasicMaterial({
      color: 0x2ec4b6,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
      fog: false,
      depthTest: false,
    }),
  }

  return gfx.materials
}

// ------------------------------------------------------------- grade ---

let skyTexture = null
const fogA = new THREE.Color()
const fogB = new THREE.Color()

/**
 * Applies a grade, optionally blended from the previous one. `blend` of 1 means
 * fully arrived. Fog colour, fog distances, sky gradient and the post-pass
 * tints all move together.
 */
export function applyGrade(id, blend = 1, fromId = null) {
  const grades = data.world.grades
  const g = grades[id] || grades.dusk
  const from = fromId ? grades[fromId] || g : g
  const t = clamp(blend, 0, 1)

  fogA.set(from.fogColor)
  fogB.set(g.fogColor)
  const fog = gfx.scene.fog
  fog.color.copy(fogA).lerp(fogB, t)
  fog.near = lerp(from.fogNear, g.fogNear, t)
  fog.far = lerp(from.fogFar, g.fogFar, t)

  // Interiors that disable fog (THE MAINFRAME) push it far past the far plane
  // rather than removing it, so the material set never has to change.
  if (state.interior && state.interior.fog === false) {
    fog.near = 1000
    fog.far = 4000
  }

  if (skyTexture) skyTexture.dispose()
  skyTexture = makeSkyTexture(t > 0.5 ? g : from)
  gfx.scene.background = skyTexture

  gfx.post.setGrade(g)
  gfx.materials.water?.color.set(g.waterColor)
}

// ------------------------------------------------------------ resize ---

export function resize() {
  const canvas = gfx.canvas
  const w = canvas.clientWidth || window.innerWidth
  const h = canvas.clientHeight || window.innerHeight
  gfx.renderer.setSize(w, h, false)

  const internal = internalSizeFor(w / Math.max(h, 1))
  if (internal.w !== gfx.internal.w || internal.h !== gfx.internal.h) {
    gfx.internal = internal
    gfx.rt.setSize(internal.w, internal.h)
    gfx.post.setInternalSize(internal.w, internal.h)
  }
  return internal
}

// ------------------------------------------------------------ render ---

export function renderFrame(camera) {
  const r = gfx.renderer
  r.info.reset()
  r.setRenderTarget(gfx.rt)
  r.clear()
  r.render(gfx.scene, camera)
  // Grain seed + any time-based presentation wobble.
  gfx.post.setTime?.(state.time || 0)
  gfx.post.render(r, gfx.rt)

  state.stats.drawCalls = r.info.render.calls
  state.stats.triangles = r.info.render.triangles
}
