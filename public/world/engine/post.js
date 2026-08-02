/**
 * RAFFI WORLD — the final pass.
 *
 * Presentation is tuned toward classic early-2000s open-city games
 * (Spider-Man PS2 vibe): soft bilinear upscale, mild bloom on lights,
 * light colour depth, atmospheric vignette. Deliberately not Minecraft
 * nearest-neighbour crunch or modern PBR.
 *
 * Order:
 *   1. soft sample of the internal buffer (optional smear)
 *   2. cheap threshold bloom (windows / neon punch)
 *   3. colour grade (shadow / key / sat / contrast)
 *   4. light quantise + Bayer dither (not full 16-bit chalk)
 *   5. vignette + optional film grain
 */

import * as THREE from 'three'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision mediump float;

uniform sampler2D tDiffuse;
uniform vec3  uShadowTint;
uniform vec3  uKeyTint;
uniform float uShadowStrength;
uniform float uKeyStrength;
uniform float uSaturation;
uniform float uContrast;
uniform float uExposure;
uniform float uGamma;
uniform float uQuantize;   // 0 = full 8-bit, 1 = harsh 5:6:5
uniform float uDither;     // 0 = off, 1 = full Bayer
uniform vec2  uInternal;   // internal buffer size in pixels
uniform float uVignette;
uniform float uSoftness;   // 0 = sharp sample, 1 = PS2 smear
uniform float uBloomStrength;
uniform float uBloomThreshold;
uniform float uGrain;
uniform float uTime;

varying vec2 vUv;

// 4x4 ordered Bayer, normalised to 0..1 with the classic /16 spacing.
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float v = 0.0;
  if (i ==  0) v =  0.0;  else if (i ==  1) v =  8.0;  else if (i ==  2) v =  2.0;  else if (i ==  3) v = 10.0;
  else if (i ==  4) v = 12.0; else if (i ==  5) v =  4.0;  else if (i ==  6) v = 14.0; else if (i ==  7) v =  6.0;
  else if (i ==  8) v =  3.0;  else if (i ==  9) v = 11.0; else if (i == 10) v =  1.0;  else if (i == 11) v =  9.0;
  else if (i == 12) v = 15.0; else if (i == 13) v =  7.0;  else if (i == 14) v = 13.0; else if (i == 15) v =  5.0;
  return v / 16.0;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 sampleScene(vec2 uv) {
  // Center sample + optional cross smear. Linear RT filtering already softens
  // the upscale; this adds the classic PS2 "slightly out of focus" city haze.
  vec3 c = texture2D(tDiffuse, uv).rgb;
  if (uSoftness < 0.01) return c;
  vec2 px = (1.0 / max(uInternal, vec2(1.0))) * (0.65 + uSoftness * 1.1);
  vec3 s = c * 0.36;
  s += texture2D(tDiffuse, uv + vec2( px.x, 0.0)).rgb * 0.16;
  s += texture2D(tDiffuse, uv + vec2(-px.x, 0.0)).rgb * 0.16;
  s += texture2D(tDiffuse, uv + vec2(0.0,  px.y)).rgb * 0.16;
  s += texture2D(tDiffuse, uv + vec2(0.0, -px.y)).rgb * 0.16;
  return mix(c, s, clamp(uSoftness, 0.0, 1.0));
}

vec3 sampleBloom(vec2 uv) {
  if (uBloomStrength < 0.001) return vec3(0.0);
  vec2 px = 1.0 / max(uInternal, vec2(1.0));
  // Wide cheap taps — neon windows / street lamps glow into the fog.
  vec2 o1 = px * 2.4;
  vec2 o2 = px * 5.2;
  vec3 acc = vec3(0.0);
  acc += texture2D(tDiffuse, uv + vec2( o1.x, 0.0)).rgb;
  acc += texture2D(tDiffuse, uv + vec2(-o1.x, 0.0)).rgb;
  acc += texture2D(tDiffuse, uv + vec2(0.0,  o1.y)).rgb;
  acc += texture2D(tDiffuse, uv + vec2(0.0, -o1.y)).rgb;
  acc += texture2D(tDiffuse, uv + vec2( o2.x,  o2.y)).rgb * 0.7;
  acc += texture2D(tDiffuse, uv + vec2(-o2.x,  o2.y)).rgb * 0.7;
  acc += texture2D(tDiffuse, uv + vec2( o2.x, -o2.y)).rgb * 0.7;
  acc += texture2D(tDiffuse, uv + vec2(-o2.x, -o2.y)).rgb * 0.7;
  acc *= 1.0 / 6.8;
  float br = max(acc.r, max(acc.g, acc.b));
  float m = smoothstep(uBloomThreshold, uBloomThreshold + 0.28, br);
  return acc * m * uBloomStrength;
}

void main() {
  vec3 c = sampleScene(vUv);
  c += sampleBloom(vUv);

  // --- grade ---------------------------------------------------------
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float shadowMask = 1.0 - smoothstep(0.12, 0.55, luma);
  float keyMask = smoothstep(0.55, 0.90, luma);
  c = mix(c, uShadowTint, shadowMask * uShadowStrength);
  c = mix(c, uKeyTint, keyMask * uKeyStrength);
  c = mix(vec3(luma), c, uSaturation);
  c *= uExposure;
  c = pow(max(c, vec3(0.0)), vec3(uGamma));
  c = (c - 0.5) * uContrast + 0.5;

  // Soft corner falloff — CRT / TV edge, not a modern vignette hammer.
  vec2 d = vUv - 0.5;
  c *= 1.0 - uVignette * dot(d, d);

  // Fine film grain (Spider-Man PS2 had a soft, noisy composite look).
  if (uGrain > 0.001) {
    float g = hash12(vUv * uInternal + vec2(uTime * 37.0, uTime * 19.0));
    c += (g - 0.5) * uGrain;
  }

  c = clamp(c, 0.0, 1.0);

  // --- light quantise + Bayer (PS2 was limited, not Minecraft chalk) ---
  // Mix between full 8-bit and classic 5:6:5 so we keep period feel without
  // hard pixel blocks.
  vec3 levels = mix(vec3(255.0), vec3(31.0, 63.0, 31.0), clamp(uQuantize, 0.0, 1.0));
  float b = (bayer4(vUv * uInternal) - 0.5) * uDither;
  c = floor(c * levels + b + 0.5) / levels;

  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`

export function createPostPass() {
  const uniforms = {
    tDiffuse: { value: null },
    uShadowTint: { value: new THREE.Color('#3A2A55') },
    uKeyTint: { value: new THREE.Color('#FFE9C4') },
    uShadowStrength: { value: 0.3 },
    uKeyStrength: { value: 0.16 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.06 },
    uExposure: { value: 1 },
    uGamma: { value: 1 },
    uQuantize: { value: 0.35 },
    uDither: { value: 0.45 },
    uInternal: { value: new THREE.Vector2(720, 405) },
    uVignette: { value: 0.22 },
    uSoftness: { value: 0.7 },
    uBloomStrength: { value: 0.32 },
    uBloomThreshold: { value: 0.52 },
    uGrain: { value: 0.035 },
    uTime: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  })

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)

  return {
    scene,
    camera,
    material,
    uniforms,

    /** Point the pass at a render target and blit it to the default framebuffer. */
    render(renderer, renderTarget) {
      uniforms.tDiffuse.value = renderTarget.texture
      const prev = renderer.getRenderTarget()
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
      renderer.setRenderTarget(prev)
    },

    /** Applies a grade block from world.json. */
    setGrade(grade) {
      uniforms.uShadowTint.value.set(grade.shadowTint)
      uniforms.uKeyTint.value.set(grade.key)
      const post = grade.post || {}
      uniforms.uShadowStrength.value = post.shadowStrength ?? 0.2
      uniforms.uKeyStrength.value = post.keyStrength ?? 0.1
      uniforms.uSaturation.value = post.saturation ?? 1.16
      uniforms.uContrast.value = post.contrast ?? 1.08
      uniforms.uExposure.value = post.exposure ?? 1
      uniforms.uGamma.value = post.gamma ?? 1
      uniforms.uVignette.value = post.vignette ?? 0.18
      if (post.bloomStrength != null) uniforms.uBloomStrength.value = post.bloomStrength
      if (post.bloomThreshold != null) uniforms.uBloomThreshold.value = post.bloomThreshold
      if (post.softness != null) uniforms.uSoftness.value = post.softness
      if (post.grain != null) uniforms.uGrain.value = post.grain
      if (post.quantize != null) uniforms.uQuantize.value = post.quantize
      if (post.dither != null) uniforms.uDither.value = post.dither
    },

    /**
     * Global presentation defaults from world.render (soft PS2 city look).
     * Grade post blocks can still override per time-of-day.
     */
    setPresentation(renderCfg = {}) {
      if (renderCfg.quantize != null) uniforms.uQuantize.value = renderCfg.quantize
      if (renderCfg.dither != null) uniforms.uDither.value = renderCfg.dither
      if (renderCfg.softness != null) uniforms.uSoftness.value = renderCfg.softness
      if (renderCfg.grain != null) uniforms.uGrain.value = renderCfg.grain
      const bloom = renderCfg.bloom || {}
      if (bloom.strength != null) uniforms.uBloomStrength.value = bloom.strength
      if (bloom.threshold != null) uniforms.uBloomThreshold.value = bloom.threshold
    },

    setTime(t) { uniforms.uTime.value = t },

    setInternalSize(w, h) { uniforms.uInternal.value.set(w, h) },

    dispose() {
      quad.geometry.dispose()
      material.dispose()
    },
  }
}
