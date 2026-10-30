/**
 * RAFFI WORLD — street poles sway when bumped.
 *
 * Poles are baked into merged street geometry, so there is no object to rotate.
 * Instead the city materials bend vertices near up to four recently hit poles:
 * the offset grows with height (a lean from the base) and fades out across a
 * short radius, so the column and lamp head sway while facades stay put. No
 * extra draw calls; the shape of the sway comes from game/feel.js.
 */

import * as THREE from 'three'

const MAX_WOBBLES = 4
// xy = pole base (world x, z), zw = lean direction
const centers = Array.from({ length: MAX_WOBBLES }, () => new THREE.Vector4())
// x = lean angle (radians), y = full-sway radius, z = fade-out radius, w = base height
const shapes = Array.from({ length: MAX_WOBBLES }, () => new THREE.Vector4())
const uniforms = { uWobbleCenter: { value: centers }, uWobbleShape: { value: shapes } }

const VERTEX = `
  #include <begin_vertex>
  {
    vec4 wobbleLocal = vec4(transformed, 1.0);
    mat3 wobbleBasis = mat3(modelMatrix);
    #ifdef USE_INSTANCING
      wobbleLocal = instanceMatrix * wobbleLocal;
      wobbleBasis = wobbleBasis * mat3(instanceMatrix);
    #endif
    vec3 wobbleWorld = (modelMatrix * wobbleLocal).xyz;
    vec3 wobbleOffset = vec3(0.0);
    for (int i = 0; i < ${MAX_WOBBLES}; i++) {
      vec4 shape = uWobbleShape[i];
      if (shape.x == 0.0) continue;
      vec4 center = uWobbleCenter[i];
      float reach = 1.0 - smoothstep(shape.y, shape.z, distance(wobbleWorld.xz, center.xy));
      wobbleOffset.xz += center.zw * (shape.x * max(0.0, wobbleWorld.y - shape.w) * reach);
    }
    if (dot(wobbleOffset, wobbleOffset) > 0.0) transformed += inverse(wobbleBasis) * wobbleOffset;
  }
`

/** Lets a city material bend around swaying poles; keeps its existing hooks. */
export function addPropWobble(material) {
  const original = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    original?.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `uniform vec4 uWobbleCenter[${MAX_WOBBLES}];\nuniform vec4 uWobbleShape[${MAX_WOBBLES}];\n` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', VERTEX)
  }
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => key() + ':pole-wobble-v1'
  material.needsUpdate = true
}

/** Pushes the strongest active sways (game/feel.js wobbles) into the shaders. */
export function updatePropWobble(wobbles) {
  const active = wobbles.length > MAX_WOBBLES
    ? [...wobbles].sort((a, b) => Math.abs(b.angle) - Math.abs(a.angle)).slice(0, MAX_WOBBLES)
    : wobbles
  for (let index = 0; index < MAX_WOBBLES; index++) {
    const wobble = active[index]
    if (!wobble) { shapes[index].x = 0; continue }
    centers[index].set(wobble.x, wobble.z, wobble.dirX, wobble.dirZ)
    shapes[index].set(wobble.angle || 1e-9, wobble.core, wobble.reach, wobble.baseY || 0)
  }
}
