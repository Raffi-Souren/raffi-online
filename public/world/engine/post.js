/** Linear HDR scene → restrained highlight bloom → AgX → sRGB presentation. */
import * as THREE from 'three'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform sampler2D tAO;
uniform sampler2D tLUT;
uniform float uBloomStrength;
uniform float uSaturation;
uniform float uContrast;
uniform float uExposure;
uniform float uVignette;
varying vec2 vUv;
vec3 gradeLUT(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float slice = c.b * 15.0;
  float low = floor(slice);
  vec2 uvA = vec2((low * 16.0 + c.r * 15.0 + 0.5) / 256.0, (c.g * 15.0 + 0.5) / 16.0);
  vec2 uvB = uvA + vec2(min(low + 1.0, 15.0) - low, 0.0) / vec2(16.0, 1.0);
  return mix(texture2D(tLUT, uvA).rgb, texture2D(tLUT, uvB).rgb, fract(slice));
}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c *= texture2D(tAO, vUv).r;
  c += texture2D(tBloom, vUv).rgb * uBloomStrength;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(luma), c, uSaturation), vec3(0.0)) * uExposure;
  // Tone mapping happens exactly once, after all linear light operations.
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  gl_FragColor.rgb = gradeLUT(gl_FragColor.rgb);
  gl_FragColor.rgb = max((gl_FragColor.rgb - 0.18) * uContrast + 0.18, vec3(0.0));
  vec2 d = vUv - 0.5;
  gl_FragColor.rgb *= 1.0 - uVignette * dot(d, d);
  #include <colorspace_fragment>
}
`

const AO_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDepth;
uniform mat4 uInvProjection;
uniform mat4 uProjection;
uniform vec2 uTexel;
varying vec2 vUv;
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
  float occlusion = 0.0;
  for (int i = 0; i < 12; i++) {
    float f = float(i) + 0.5;
    float angle = f * 2.39996323;
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

const BLOOM_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform vec2 uDirection;
uniform float uThreshold;
uniform bool uExtract;
varying vec2 vUv;
vec3 bright(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  if (!uExtract) return c;
  float b = max(c.r, max(c.g, c.b));
  float knee = max(0.08, uThreshold * 0.4);
  float soft = clamp(b - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  return c * max(b - uThreshold, soft) / max(b, 0.0001);
}
void main() {
  vec2 d = uTexel * uDirection;
  vec3 c = bright(vUv) * 0.227027;
  c += bright(vUv + d * 1.384615) * 0.316216;
  c += bright(vUv - d * 1.384615) * 0.316216;
  c += bright(vUv + d * 3.230769) * 0.070270;
  c += bright(vUv - d * 3.230769) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}
`

export function createPostPass({ hdr = true, bloom = true } = {}) {
  const uniforms = {
    tDiffuse: { value: null },
    tBloom: { value: null },
    tAO: { value: null }, tLUT: { value: null },
    uBloomStrength: { value: 0.16 },
    uSaturation: { value: 1.02 },
    uContrast: { value: 1.015 },
    uExposure: { value: 1.05 },
    uVignette: { value: 0.13 },
  }
  const material = new THREE.ShaderMaterial({
    name: 'world:linear-hdr-output', uniforms, vertexShader: VERT, fragmentShader: FRAG,
    depthTest: false, depthWrite: false, toneMapped: true,
  })
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)

  const bloomUniforms = {
    tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) },
    uDirection: { value: new THREE.Vector2(1, 0) }, uThreshold: { value: hdr ? 1.05 : 0.82 },
    uExtract: { value: true },
  }
  const bloomMaterial = new THREE.ShaderMaterial({
    name: 'world:highlight-bloom', uniforms: bloomUniforms, vertexShader: VERT, fragmentShader: BLOOM_FRAG,
    depthTest: false, depthWrite: false, toneMapped: false,
  })
  const settings = {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace, generateMipmaps: false,
  }
  const bloomA = new THREE.WebGLRenderTarget(1, 1, settings)
  const bloomB = new THREE.WebGLRenderTarget(1, 1, settings)
  const aoTarget = new THREE.WebGLRenderTarget(1, 1, { ...settings, type: THREE.UnsignedByteType })
  const aoMaterial = new THREE.ShaderMaterial({
    name: 'world:depth-ambient-occlusion', vertexShader: VERT, fragmentShader: AO_FRAG,
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tDepth: { value: null }, uInvProjection: { value: new THREE.Matrix4() }, uProjection: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() } },
  })
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  white.needsUpdate = true
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
  // A valid black texture keeps the sampler complete when bloom is disabled.
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  black.needsUpdate = true
  let bloomEnabled = bloom
  let aoEnabled = false

  return {
    scene, camera, material, uniforms,
    render(renderer, renderTarget, worldCamera) {
      const prev = renderer.getRenderTarget()
      uniforms.tDiffuse.value = renderTarget.texture
      uniforms.tBloom.value = black
      uniforms.tAO.value = white
      if (aoEnabled && worldCamera?.isPerspectiveCamera && renderTarget.depthTexture) {
        quad.material = aoMaterial
        aoMaterial.uniforms.tDepth.value = renderTarget.depthTexture
        aoMaterial.uniforms.uInvProjection.value.copy(worldCamera.projectionMatrixInverse)
        aoMaterial.uniforms.uProjection.value.copy(worldCamera.projectionMatrix)
        aoMaterial.uniforms.uTexel.value.set(1 / renderTarget.width, 1 / renderTarget.height)
        renderer.setRenderTarget(aoTarget)
        renderer.render(scene, camera)
        uniforms.tAO.value = aoTarget.texture
      }
      if (bloomEnabled && uniforms.uBloomStrength.value > 0.001) {
        quad.material = bloomMaterial
        bloomUniforms.tDiffuse.value = renderTarget.texture
        bloomUniforms.uTexel.value.set(1 / renderTarget.width, 1 / renderTarget.height)
        bloomUniforms.uDirection.value.set(2, 0)
        bloomUniforms.uExtract.value = true
        renderer.setRenderTarget(bloomA)
        renderer.render(scene, camera)
        bloomUniforms.tDiffuse.value = bloomA.texture
        bloomUniforms.uTexel.value.set(1 / bloomA.width, 1 / bloomA.height)
        bloomUniforms.uDirection.value.set(0, 1)
        bloomUniforms.uExtract.value = false
        renderer.setRenderTarget(bloomB)
        renderer.render(scene, camera)
        uniforms.tBloom.value = bloomB.texture
      }
      quad.material = material
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
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
      bloomUniforms.uThreshold.value = hdr ? 1.05 : 0.82
    },
    setPresentation(renderCfg = {}) {
      if (renderCfg.bloom?.strength != null) uniforms.uBloomStrength.value = renderCfg.bloom.strength
    },
    setBloomEnabled(enabled) { bloomEnabled = enabled },
    setAOEnabled(enabled) { aoEnabled = enabled },
    setInternalSize(w, h) {
      // Quarter-resolution bloom never lowers the clarity of the scene image.
      bloomA.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4)))
      bloomB.setSize(bloomA.width, bloomA.height)
      aoTarget.setSize(Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2)))
    },
    dispose() {
      quad.geometry.dispose()
      material.dispose()
      bloomMaterial.dispose()
      bloomA.dispose()
      bloomB.dispose()
      black.dispose()
      white.dispose()
      lut.dispose()
      aoTarget.dispose()
      aoMaterial.dispose()
    },
  }
}
