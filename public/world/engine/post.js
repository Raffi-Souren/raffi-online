/**
 * RAFFI WORLD — the final pass.
 *
 * Classic PS2 / GTA / Spider-Man city look is *sharp* at low resolution, not
 * smeared. Order:
 *   1. single-sample the internal buffer (no blur taps)
 *   2. optional *tiny* bloom only on hot emissives (night windows)
 *   3. colour grade (shadow / key / sat / contrast)
 *   4. light quantise + Bayer (period, not chalk)
 *   5. light vignette
 *
 * Softness / film-grain smear were tried and rejected — they muddied the city.
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
uniform vec2  uInternal;
uniform float uVignette;
uniform float uBloomStrength;
uniform float uBloomThreshold;

varying vec2 vUv;

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

// Tiny bloom: only adds glow to already-bright emissive pixels. Never blurs
// the whole frame (that was the muddy "softness" mistake).
vec3 sampleBloom(vec2 uv) {
  if (uBloomStrength < 0.001) return vec3(0.0);
  vec2 px = 1.0 / max(uInternal, vec2(1.0));
  vec2 o = px * 2.0;
  vec3 acc = texture2D(tDiffuse, uv).rgb * 0.4;
  acc += texture2D(tDiffuse, uv + vec2( o.x, 0.0)).rgb * 0.15;
  acc += texture2D(tDiffuse, uv + vec2(-o.x, 0.0)).rgb * 0.15;
  acc += texture2D(tDiffuse, uv + vec2(0.0,  o.y)).rgb * 0.15;
  acc += texture2D(tDiffuse, uv + vec2(0.0, -o.y)).rgb * 0.15;
  float br = max(acc.r, max(acc.g, acc.b));
  float m = smoothstep(uBloomThreshold, uBloomThreshold + 0.22, br);
  return acc * m * uBloomStrength;
}

void main() {
  // Sharp sample — bilinear RT upscale is enough period softness.
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c += sampleBloom(vUv);

  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float shadowMask = 1.0 - smoothstep(0.12, 0.55, luma);
  float keyMask = smoothstep(0.55, 0.90, luma);
  c = mix(c, uShadowTint, shadowMask * uShadowStrength);
  c = mix(c, uKeyTint, keyMask * uKeyStrength);
  c = mix(vec3(luma), c, uSaturation);
  c *= uExposure;
  c = pow(max(c, vec3(0.0)), vec3(uGamma));
  c = (c - 0.5) * uContrast + 0.5;

  vec2 d = vUv - 0.5;
  c *= 1.0 - uVignette * dot(d, d);
  c = clamp(c, 0.0, 1.0);

  // Light period quantise. Keep low — high values = chalky Minecraft.
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
    uShadowStrength: { value: 0.22 },
    uKeyStrength: { value: 0.12 },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.08 },
    uExposure: { value: 1 },
    uGamma: { value: 1 },
    uQuantize: { value: 0.18 },
    uDither: { value: 0.28 },
    uInternal: { value: new THREE.Vector2(960, 540) },
    uVignette: { value: 0.14 },
    uBloomStrength: { value: 0.12 },
    uBloomThreshold: { value: 0.62 },
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

    render(renderer, renderTarget) {
      uniforms.tDiffuse.value = renderTarget.texture
      const prev = renderer.getRenderTarget()
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
      renderer.setRenderTarget(prev)
    },

    setGrade(grade) {
      uniforms.uShadowTint.value.set(grade.shadowTint)
      uniforms.uKeyTint.value.set(grade.key)
      const post = grade.post || {}
      uniforms.uShadowStrength.value = post.shadowStrength ?? 0.2
      uniforms.uKeyStrength.value = post.keyStrength ?? 0.1
      uniforms.uSaturation.value = post.saturation ?? 1.14
      uniforms.uContrast.value = post.contrast ?? 1.08
      uniforms.uExposure.value = post.exposure ?? 1
      uniforms.uGamma.value = post.gamma ?? 1
      uniforms.uVignette.value = post.vignette ?? 0.12
      if (post.bloomStrength != null) uniforms.uBloomStrength.value = post.bloomStrength
      if (post.bloomThreshold != null) uniforms.uBloomThreshold.value = post.bloomThreshold
      if (post.quantize != null) uniforms.uQuantize.value = post.quantize
      if (post.dither != null) uniforms.uDither.value = post.dither
    },

    setPresentation(renderCfg = {}) {
      if (renderCfg.quantize != null) uniforms.uQuantize.value = renderCfg.quantize
      if (renderCfg.dither != null) uniforms.uDither.value = renderCfg.dither
      const bloom = renderCfg.bloom || {}
      if (bloom.strength != null) uniforms.uBloomStrength.value = bloom.strength
      if (bloom.threshold != null) uniforms.uBloomThreshold.value = bloom.threshold
    },

    setInternalSize(w, h) { uniforms.uInternal.value.set(w, h) },

    dispose() {
      quad.geometry.dispose()
      material.dispose()
    },
  }
}
