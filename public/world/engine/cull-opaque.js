/**
 * RAFFI WORLD — fog-depth cull for OPAQUE city chunks only.
 *
 * Chunks whose entire bounding sphere sits beyond fog.far in camera-space
 * depth cannot contribute visible colour, so we skip the draw. Emissive,
 * alpha, actors, water, and no-fog interiors are never touched here.
 */

import { gfx } from './render.js'

/**
 * @param {import('three').Camera} camera
 * @param {import('three').Object3D} root  city root (or whole scene)
 */
export function updateOpaqueFogCull(camera, root) {
  if (!root || !camera) return
  const fog = gfx.scene?.fog
  if (!fog || fog.far == null) {
    root.traverse((obj) => {
      if (obj.userData?.opaqueChunk) obj.visible = true
    })
    return
  }

  // Cap the cull horizon so haze/night long fogFar cannot re-pull the whole
  // city into the free-camera budget. Geometry past this is fully fogged.
  const far = Math.min(fog.far, 520)
  // Camera forward in world (Three: -Z).
  const e = camera.matrixWorld.elements
  const fx = -e[8]
  const fy = -e[9]
  const fz = -e[10]
  const cx = camera.position.x
  const cy = camera.position.y
  const cz = camera.position.z

  root.traverse((obj) => {
    if (!obj.userData?.opaqueChunk || !obj.geometry) return
    const sphere = obj.geometry.boundingSphere
    if (!sphere) {
      obj.visible = true
      return
    }
    // World-space sphere centre (district groups are at identity).
    const sx = sphere.center.x
    const sy = sphere.center.y
    const sz = sphere.center.z
    const dx = sx - cx
    const dy = sy - cy
    const dz = sz - cz
    // Signed depth along look + radial distance (behind-camera chunks stay
    // frustum-culled by Three; this only drops fully fogged far mass).
    const depth = dx * fx + dy * fy + dz * fz
    const radial = Math.hypot(dx, dy, dz)
    const r = sphere.radius
    obj.visible = (depth - r < far - 8) && (radial - r < far + 12)
  })
}
