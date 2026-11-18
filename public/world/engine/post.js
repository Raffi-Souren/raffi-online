/**
 * Linear HDR scene → ambient occlusion → wide highlight bloom → AgX → grade →
 * sRGB with dither → (FXAA + sharpen) → screen.
 *
 * Tone mapping and the sRGB encode happen in this file's own shader, so the
 * result is the same whether the output goes straight to the screen or to the
 * anti-aliasing pass first. Every pass is a single full-screen triangle pair.
 */
import * as THREE from 'three'
import { FXAAShader } from '../vendor/shaders/FXAAShader.js'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Interleaved gradient noise (Jimenez 2014): cheap, well spread, no texture.
const IGN = /* glsl */ `
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform sampler2D tAO;
uniform sampler2D tDepth;
uniform sampler2D tLUT;
uniform mat4 uInvProjection;
uniform vec2 uAOTexel;
uniform float uAOFilter;
uniform float uBloomStrength;
uniform float uSaturation;
uniform float uContrast;
uniform float uExposure;
uniform float uVignette;
uniform float uDither;
varying vec2 vUv;
${IGN}
// AgX, exactly as three.js r183 ships it (tonemapping_pars_fragment), exposure 1.
const mat3 WORLD_REC2020_TO_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
const mat3 WORLD_SRGB_TO_REC2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
vec3 worldAgxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 worldAgX(vec3 color) {
  const mat3 inset = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color = WORLD_SRGB_TO_REC2020 * color;
  color = inset * color;
  color = log2(max(color, 1e-10));
  color = clamp((color - minEv) / (maxEv - minEv), 0.0, 1.0);
  color = worldAgxContrast(color);
  color = outset * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = WORLD_REC2020_TO_SRGB * color;
  return clamp(color, 0.0, 1.0);
}
vec3 encodeSRGB(vec3 c) {
  return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}
vec3 gradeLUT(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float slice = c.b * 15.0;
  float low = floor(slice);
  vec2 uvA = vec2((low * 16.0 + c.r * 15.0 + 0.5) / 256.0, (c.g * 15.0 + 0.5) / 16.0);
  vec2 uvB = uvA + vec2(min(low + 1.0, 15.0) - low, 0.0) / vec2(16.0, 1.0);
  return mix(texture2D(tLUT, uvA).rgb, texture2D(tLUT, uvB).rgb, fract(slice));
}
float viewDepth(vec2 uv) {
  vec4 p = uInvProjection * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0);
  return -p.z / p.w;
}
// The occlusion is computed at a lower resolution with a rotated pattern; a
// small depth-aware filter here smooths that pattern without bleeding the
// darkening across the edges of things.
float ambientOcclusion() {
  if (uAOFilter < 0.5) return texture2D(tAO, vUv).r;
  float centre = viewDepth(vUv);
  float total = texture2D(tAO, vUv).r * 2.0;
  float weight = 2.0;
  for (int i = 0; i < 4; i++) {
    vec2 offset = vec2(i < 2 ? -1.0 : 1.0, mod(float(i), 2.0) < 1.0 ? -1.0 : 1.0) * uAOTexel;
    float depth = viewDepth(vUv + offset);
    float w = max(0.0, 1.0 - abs(depth - centre) / max(0.05, centre * 0.04));
    total += texture2D(tAO, vUv + offset).r * w;
    weight += w;
  }
  return total / weight;
}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c *= ambientOcclusion();
  c += texture2D(tBloom, vUv).rgb * uBloomStrength;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(luma), c, uSaturation), vec3(0.0)) * uExposure;
  // Tone mapping happens exactly once, after all linear light operations.
  c = worldAgX(c);
  c = gradeLUT(c);
  c = max((c - 0.18) * uContrast + 0.18, vec3(0.0));
  vec2 d = vUv - 0.5;
  c *= 1.0 - uVignette * dot(d, d);
  c = encodeSRGB(clamp(c, 0.0, 1.0));
  // Triangular dither of one 8-bit step: skies and fog stop banding.
  float n = ign(gl_FragCoord.xy) + ign(gl_FragCoord.xy + vec2(47.0, 17.0)) - 1.0;
  c += n * uDither / 255.0;
  gl_FragColor = vec4(c, 1.0);
}
`

const AO_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDepth;
uniform mat4 uInvProjection;
uniform mat4 uProjection;
uniform vec2 uTexel;
varying vec2 vUv;
${IGN}
vec3 viewPosition(vec2 uv) {
  float depth = texture2D(tDepth, uv).x;
  vec4 p = uInvProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
void main() {
  if (texture2D(tDepth, vUv).x > 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = viewPosition(vUv);
  vec3 left = p - viewPosition(vUv - vec2(uTexel.x, 0.0));
  vec3 right = viewPosition(vUv + vec2(uTexel.x, 0.0)) - p;
  vec3 down = p - viewPosition(vUv - vec2(0.0, uTexel.y));
  vec3 up = viewPosition(vUv + vec2(0.0, uTexel.y)) - p;
  vec3 n = normalize(cross(abs(left.z) < abs(right.z) ? left : right, abs(down.z) < abs(up.z) ? down : up));
  float radius = 1.6;
  vec2 radiusUV = abs(vec2(uProjection[0][0], uProjection[1][1])) * radius * 0.5 / max(1.0, -p.z);
  // Each pixel turns the spiral by its own amount, so the fixed rings of a
  // shared pattern become fine noise the output filter can smooth.
  float spin = ign(gl_FragCoord.xy) * 6.28318530718;
  float occlusion = 0.0;
  for (int i = 0; i < 12; i++) {
    float f = float(i) + 0.5;
    float angle = f * 2.39996323 + spin;
    vec2 uv = vUv + vec2(cos(angle), sin(angle)) * radiusUV * sqrt(f / 12.0);
    vec3 delta = viewPosition(clamp(uv, uTexel, 1.0 - uTexel)) - p;
    float distanceToSample = length(delta);
    float horizon = max(dot(n, delta) / max(0.001, distanceToSample) - 0.08, 0.0);
    float range = 1.0 - smoothstep(radius * 0.15, radius, distanceToSample);
    occlusion += horizon * range;
  }
  float ao = clamp(1.0 - occlusion * 0.17, 0.66, 1.0);
  gl_FragColor = vec4(vec3(ao), 1.0);
}
`

// Dual-filter bloom (Marius Bjørge, "Bandwidth-efficient rendering", 2015):
// halve the image a few times, then add each level back while doubling up.
// The glow reaches far from a bright neon tube without a wide blur kernel.
const BLOOM_DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uThreshold;
uniform bool uPrefilter;
varying vec2 vUv;
vec3 tap(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  if (!uPrefilter) return c;
  float b = max(c.r, max(c.g, c.b));
  float knee = max(0.08, uThreshold * 0.4);
  float soft = clamp(b - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  c *= max(b - uThreshold, soft) / max(b, 0.0001);
  // Karis average: one blazing pixel cannot flicker the whole glow.
  return c / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)));
}
void main() {
  vec2 h = uTexel * 0.5;
  vec3 c = tap(vUv) * 4.0;
  c += tap(vUv - h);
  c += tap(vUv + h);
  c += tap(vUv + vec2(h.x, -h.y));
  c += tap(vUv - vec2(h.x, -h.y));
  c *= 0.125;
  if (uPrefilter) c /= max(1e-4, 1.0 - dot(c, vec3(0.2126, 0.7152, 0.0722)));
  gl_FragColor = vec4(c, 1.0);
}
`

const BLOOM_UP = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 c = texture2D(tDiffuse, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(0.0, h.y * 2.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(h.x, h.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(c * (uWeight / 12.0), 1.0);
}
`

// FXAA from three.js, then a contrast-adaptive sharpen on the flat areas it
// leaves alone. The sharpen is clamped to the neighbourhood, so no halos.
const PRESENT_FRAG = FXAAShader.fragmentShader
  .replace('uniform vec2 resolution;', 'uniform vec2 resolution;\nuniform float uFXAA;\nuniform float uSharpen;')
  .replace(/void main\(\) \{[\s\S]*\}\s*$/, /* glsl */ `
void main() {
  vec2 ts = resolution.xy;
  LuminanceData l = SampleLuminanceNeighborhood(tDiffuse, ts, vUv);
  if (uFXAA < 0.5 || ShouldSkipPixel(l)) {
    vec4 m = Sample(tDiffuse, vUv);
    if (uSharpen > 0.0) {
      vec3 n = Sample(tDiffuse, vUv + vec2(0.0, ts.y)).rgb;
      vec3 e = Sample(tDiffuse, vUv + vec2(ts.x, 0.0)).rgb;
      vec3 s = Sample(tDiffuse, vUv - vec2(0.0, ts.y)).rgb;
      vec3 w = Sample(tDiffuse, vUv - vec2(ts.x, 0.0)).rgb;
      vec3 lo = min(m.rgb, min(min(n, e), min(s, w)));
      vec3 hi = max(m.rgb, max(max(n, e), max(s, w)));
      // Less sharpening where the neighbourhood already has strong contrast.
      float amount = uSharpen * (1.0 - smoothstep(0.08, 0.5, l.contrast));
      m.rgb = clamp(m.rgb + (m.rgb - (n + e + s + w) * 0.25) * amount, lo, hi);
    }
    gl_FragColor = m;
    return;
  }
  gl_FragColor = ApplyFXAA(tDiffuse, ts, vUv);
}
`)

export function createPostPass({ hdr = true, bloom = true } = {}) {
  const uniforms = {
    tDiffuse: { value: null }, tBloom: { value: null }, tAO: { value: null }, tDepth: { value: null }, tLUT: { value: null },
    uInvProjection: { value: new THREE.Matrix4() }, uAOTexel: { value: new THREE.Vector2(1, 1) }, uAOFilter: { value: 0 },
    uBloomStrength: { value: 0.16 },
    uSaturation: { value: 1.02 },
    uContrast: { value: 1.015 },
    uExposure: { value: 1.05 },
    uVignette: { value: 0.13 },
    uDither: { value: 1 },
  }
  const material = new THREE.ShaderMaterial({
    name: 'world:linear-hdr-output', uniforms, vertexShader: VERT, fragmentShader: FRAG,
    depthTest: false, depthWrite: false, toneMapped: false,
  })
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)

  const settings = {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace, generateMipmaps: false,
  }

  // ------------------------------------------------------------- bloom
  const downUniforms = { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uThreshold: { value: hdr ? 1.05 : 0.82 }, uPrefilter: { value: true } }
  const upUniforms = { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uWeight: { value: 1 } }
  const bloomDown = new THREE.ShaderMaterial({ name: 'world:bloom-down', uniforms: downUniforms, vertexShader: VERT, fragmentShader: BLOOM_DOWN, depthTest: false, depthWrite: false, toneMapped: false })
  const bloomUp = new THREE.ShaderMaterial({ name: 'world:bloom-up', uniforms: upUniforms, vertexShader: VERT, fragmentShader: BLOOM_UP, depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })
  const MAX_LEVELS = 5
  const levels = Array.from({ length: MAX_LEVELS }, () => new THREE.WebGLRenderTarget(1, 1, settings))
  let bloomLevels = MAX_LEVELS

  // --------------------------------------------------------- occlusion
  const aoTarget = new THREE.WebGLRenderTarget(1, 1, { ...settings, type: THREE.UnsignedByteType })
  const aoMaterial = new THREE.ShaderMaterial({
    name: 'world:depth-ambient-occlusion', vertexShader: VERT, fragmentShader: AO_FRAG,
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tDepth: { value: null }, uInvProjection: { value: new THREE.Matrix4() }, uProjection: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() } },
  })
  let aoScale = 0.5

  // ------------------------------------------------------- present pass
  // The graded image, already sRGB-encoded, waits here for anti-aliasing.
  const ldr = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, type: THREE.UnsignedByteType, colorSpace: THREE.NoColorSpace, generateMipmaps: false })
  const presentUniforms = { tDiffuse: { value: ldr.texture }, resolution: { value: new THREE.Vector2(1, 1) }, uFXAA: { value: 1 }, uSharpen: { value: 0 } }
  const presentMaterial = new THREE.ShaderMaterial({
    name: 'world:fxaa-sharpen', uniforms: presentUniforms, vertexShader: VERT, fragmentShader: PRESENT_FRAG,
    depthTest: false, depthWrite: false, toneMapped: false,
  })
  let fxaa = true
  let sharpen = 0

  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  white.needsUpdate = true
  // A valid black texture keeps the sampler complete when bloom is disabled.
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  black.needsUpdate = true
  const lutData = new Uint8Array(16 * 16 * 16 * 4)
  const lut = new THREE.DataTexture(lutData, 256, 16, THREE.RGBAFormat)
  lut.minFilter = lut.magFilter = THREE.LinearFilter
  lut.colorSpace = THREE.NoColorSpace
  const lutKey = new THREE.Color()
  const lutShadow = new THREE.Color()
  function updateLUT(grade) {
    lutKey.set(grade.key || '#fff1d0')
    lutShadow.set(grade.shadowTint || '#3a4a72')
    const key = [lutKey.r, lutKey.g, lutKey.b]
    const shadow = [lutShadow.r, lutShadow.g, lutShadow.b]
    for (let g = 0; g < 16; g++) for (let b = 0; b < 16; b++) for (let r = 0; r < 16; r++) {
      const colour = [r / 15, g / 15, b / 15]
      const luma = colour[0] * 0.2126 + colour[1] * 0.7152 + colour[2] * 0.0722
      const offset = (g * 256 + b * 16 + r) * 4
      for (let c = 0; c < 3; c++) {
        const lift = shadow[c] * (1 - luma) * luma * 0.16
        const warmth = (key[c] - 0.55) * luma * (1 - luma) * 0.08
        lutData[offset + c] = Math.round(THREE.MathUtils.clamp(colour[c] + lift + warmth, 0, 1) * 255)
      }
      lutData[offset + 3] = 255
    }
    lut.needsUpdate = true
  }
  updateLUT({})
  uniforms.tLUT.value = lut
  let bloomEnabled = bloom
  let aoEnabled = false
  let passes = 0

  function draw(renderer, target, shader) {
    quad.material = shader
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    passes++
  }

  function renderBloom(renderer, source) {
    const count = Math.min(bloomLevels, levels.length)
    downUniforms.uPrefilter.value = true
    downUniforms.tDiffuse.value = source.texture
    downUniforms.uTexel.value.set(1 / source.width, 1 / source.height)
    draw(renderer, levels[0], bloomDown)
    downUniforms.uPrefilter.value = false
    for (let i = 1; i < count; i++) {
      downUniforms.tDiffuse.value = levels[i - 1].texture
      downUniforms.uTexel.value.set(1 / levels[i - 1].width, 1 / levels[i - 1].height)
      draw(renderer, levels[i], bloomDown)
    }
    // Each level adds the wider, softer ones beneath it, without clearing.
    // Wider levels count a little less, so a lamp keeps a bright core inside its halo.
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    upUniforms.uWeight.value = HALO_FALLOFF
    for (let i = count - 2; i >= 0; i--) {
      upUniforms.tDiffuse.value = levels[i + 1].texture
      upUniforms.uTexel.value.set(1 / levels[i + 1].width, 1 / levels[i + 1].height)
      draw(renderer, levels[i], bloomUp)
    }
    renderer.autoClear = autoClear
    // Normalise by the total weight the levels were added with.
    let total = 0
    for (let i = 0; i < count; i++) total += HALO_FALLOFF ** i
    return { texture: levels[0].texture, scale: 1 / total }
  }

  return {
    scene, camera, material, uniforms,
    /** Post passes drawn last frame, for the budget readout. */
    get passes() { return passes },
    render(renderer, renderTarget, worldCamera) {
      const prev = renderer.getRenderTarget()
      passes = 0
      uniforms.tDiffuse.value = renderTarget.texture
      uniforms.tBloom.value = black
      uniforms.tAO.value = white
      uniforms.uAOFilter.value = 0
      const strength = uniforms.uBloomStrength.value
      if (aoEnabled && worldCamera?.isPerspectiveCamera && renderTarget.depthTexture) {
        aoMaterial.uniforms.tDepth.value = renderTarget.depthTexture
        aoMaterial.uniforms.uInvProjection.value.copy(worldCamera.projectionMatrixInverse)
        aoMaterial.uniforms.uProjection.value.copy(worldCamera.projectionMatrix)
        aoMaterial.uniforms.uTexel.value.set(1 / renderTarget.width, 1 / renderTarget.height)
        draw(renderer, aoTarget, aoMaterial)
        uniforms.tAO.value = aoTarget.texture
        uniforms.tDepth.value = renderTarget.depthTexture
        uniforms.uInvProjection.value.copy(worldCamera.projectionMatrixInverse)
        uniforms.uAOTexel.value.set(1 / aoTarget.width, 1 / aoTarget.height)
        uniforms.uAOFilter.value = 1
      }
      let bloomScale = 0
      if (bloomEnabled && strength > 0.001) {
        const result = renderBloom(renderer, renderTarget)
        uniforms.tBloom.value = result.texture
        bloomScale = result.scale
      }
      uniforms.uBloomStrength.value = strength * bloomScale * BLOOM_GAIN
      const present = fxaa || sharpen > 0
      draw(renderer, present ? ldr : null, material)
      uniforms.uBloomStrength.value = strength
      if (present) {
        presentUniforms.uFXAA.value = fxaa ? 1 : 0
        presentUniforms.uSharpen.value = sharpen
        draw(renderer, null, presentMaterial)
      }
      renderer.setRenderTarget(prev)
    },
    setGrade(grade) {
      const post = grade.post || {}
      updateLUT(grade)
      // The old grades remain the content source. Physical light now supplies
      // the shadow/key colour, so a second paint-over tint would crush detail.
      uniforms.uSaturation.value = Math.min(1.12, post.saturation ?? 1.04)
      uniforms.uContrast.value = 1 + ((post.contrast ?? 1.08) - 1) * 0.25
      uniforms.uExposure.value = post.exposure ?? 1
      uniforms.uVignette.value = post.vignette ?? 0.12
      uniforms.uBloomStrength.value = post.bloomStrength ?? 0.14
      downUniforms.uThreshold.value = hdr ? 1.05 : 0.82
    },
    setPresentation(renderCfg = {}) {
      if (renderCfg.bloom?.strength != null) uniforms.uBloomStrength.value = renderCfg.bloom.strength
    },
    setBloomEnabled(enabled) { bloomEnabled = enabled },
    setBloomLevels(count) { bloomLevels = Math.max(1, Math.min(MAX_LEVELS, count | 0)) },
    setAOEnabled(enabled) { aoEnabled = enabled },
    setAOScale(scale) { aoScale = scale },
    /** FXAA on tiers without MSAA; sharpening when the scene is drawn smaller than the screen. */
    setPresent({ antialias, sharpen: amount }) { fxaa = !!antialias; sharpen = Math.max(0, Math.min(0.6, amount || 0)) },
    setInternalSize(w, h) {
      let lw = w, lh = h
      for (const level of levels) {
        lw = Math.max(1, Math.ceil(lw / 2)); lh = Math.max(1, Math.ceil(lh / 2))
        level.setSize(lw, lh)
      }
      aoTarget.setSize(Math.max(1, Math.ceil(w * aoScale)), Math.max(1, Math.ceil(h * aoScale)))
      ldr.setSize(w, h)
      presentUniforms.resolution.value.set(1 / w, 1 / h)
    },
    dispose() {
      quad.geometry.dispose()
      for (const item of [material, bloomDown, bloomUp, aoMaterial, presentMaterial, black, white, lut, aoTarget, ldr, ...levels]) item.dispose()
    },
  }
}

/**
 * The wide bloom spreads highlight energy over a much larger area than the
 * old single blur. The grades' strengths were tuned for that blur, so they are
 * scaled up to keep a lamp's glow as bright at its core while it now reaches
 * further across the street.
 */
const BLOOM_GAIN = 3.2
/** How much each wider bloom level counts relative to the one inside it. */
const HALO_FALLOFF = 0.78
