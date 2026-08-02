/**
 * RAFFI WORLD — the final pass.
 *
 * Three operations, in this order, and nothing else:
 *   1. colour grade (shadow tint / key tint / saturation / contrast)
 *   2. 16-bit 5:6:5 quantisation with 4x4 ordered Bayer dithering
 *   3. nearest-neighbour blit of the 512x288 buffer to the display canvas
 *
 * Deliberately absent: bloom, AO, DOF, motion blur. Those are modern-console
 * tells and this is a PS2 build. See WORLD-BIBLE §5.
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
uniform float uQuantize;   // 0 = off, 1 = full 5:6:5
uniform float uDither;     // 0 = off, 1 = full Bayer
uniform vec2  uInternal;   // internal buffer size in pixels
uniform float uVignette;

varying vec2 vUv;

// 4x4 ordered Bayer, normalised to 0..1 with the classic /16 spacing.
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  // Index into the standard matrix without an array lookup (WebGL1 safe).
  float v = 0.0;
  if (i ==  0) v =  0.0;  else if (i ==  1) v =  8.0;  else if (i ==  2) v =  2.0;  else if (i ==  3) v = 10.0;
  else if (i ==  4) v = 12.0; else if (i ==  5) v =  4.0;  else if (i ==  6) v = 14.0; else if (i ==  7) v =  6.0;
  else if (i ==  8) v =  3.0;  else if (i ==  9) v = 11.0; else if (i == 10) v =  1.0;  else if (i == 11) v =  9.0;
  else if (i == 12) v = 15.0; else if (i == 13) v =  7.0;  else if (i == 14) v = 13.0; else if (i == 15) v =  5.0;
  return v / 16.0;
}

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;

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

  // Subtle corner falloff. Not a bloom — it is a CRT edge, and it is cheap.
  vec2 d = vUv - 0.5;
  c *= 1.0 - uVignette * dot(d, d);

  c = clamp(c, 0.0, 1.0);

  // --- 16-bit quantise + Bayer dither --------------------------------
  vec3 levels = mix(vec3(255.0), vec3(31.0, 63.0, 31.0), uQuantize);
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
    uQuantize: { value: 1 },
    uDither: { value: 1 },
    uInternal: { value: new THREE.Vector2(512, 288) },
    uVignette: { value: 0.28 },
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
      uniforms.uVignette.value = post.vignette ?? 0.12
    },

    setInternalSize(w, h) { uniforms.uInternal.value.set(w, h) },

    dispose() {
      quad.geometry.dispose()
      material.dispose()
    },
  }
}
