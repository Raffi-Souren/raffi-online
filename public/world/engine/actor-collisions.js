/** Runtime actors live directly under the scene; static chunks stay in the spatial hash. */
export function actorCollisionBodies(objects, x, z, ignored = null, reach = 12, y = 0) {
  const bodies = []
  for (const object of objects || []) {
    if (object === ignored || !object.visible) continue
    const info = object.userData || {}
    const pedestrian = info.rig === 'biped' || info.rig === 'quadruped'
    const vehicle = Number.isFinite(info.width) && Number.isFinite(info.length)
    if (!pedestrian && !vehicle) continue
    const position = object.position
    const sx = object.scale?.x ?? 1
    const sz = object.scale?.z ?? 1
    const extent = vehicle ? Math.max(info.width * sx, info.length * sz) / 2 : 0.6 * Math.max(sx, sz)
    if (Math.hypot(position.x - x, position.z - z) > reach + extent) continue
    // Airborne actors never become invisible barriers on the level below.
    if (Math.abs(position.y - y) > 2.2) continue
    if (pedestrian) {
      bodies.push({
        type: 'circle',
        x: position.x,
        z: position.z,
        r: (info.rig === 'quadruped' ? 0.55 : 0.4) * Math.max(sx, sz),
        tag: 'pedestrian',
      })
    } else {
      bodies.push({
        type: 'box',
        x: position.x,
        z: position.z,
        hx: (info.width * sx) / 2,
        hz: (info.length * sz) / 2,
        ry: -(object.rotation?.y || 0),
        tag: 'vehicle',
      })
    }
  }
  return bodies
}
