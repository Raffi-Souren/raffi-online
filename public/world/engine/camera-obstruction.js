/** Sweep the camera boom against the same static volumes as locomotion.
 * A small lens radius keeps the near plane outside walls as the view rotates.
 * The result is a segment fraction, independent of Three or frame rate.
 */
export function cameraBoomFraction(origin, end, colliders, padding = 0.32) {
  let nearest = 1
  for (const c of colliders) {
    if (c.type === 'ramp') continue
    const height = c.height ?? (c.type === 'circle' ? 3 : 4)
    const bottom = c.y ?? 0
    if (Math.min(origin.y, end.y) > bottom + height + padding) continue
    const ry = c.ry || 0
    const cos = Math.cos(ry), sin = Math.sin(ry)
    const ox = (origin.x - c.x) * cos + (origin.z - c.z) * sin
    const oz = -(origin.x - c.x) * sin + (origin.z - c.z) * cos
    const dx = (end.x - origin.x) * cos + (end.z - origin.z) * sin
    const dz = -(end.x - origin.x) * sin + (end.z - origin.z) * cos
    const dy = end.y - origin.y
    let lo = 0, hi = nearest
    if (c.type === 'circle') {
      const r = c.r + padding
      const a = dx * dx + dz * dz
      const b = 2 * (ox * dx + oz * dz)
      const d = b * b - 4 * a * (ox * ox + oz * oz - r * r)
      if (a < 1e-9 || d < 0) continue
      lo = Math.max(0, (-b - Math.sqrt(d)) / (2 * a))
      hi = Math.min(hi, (-b + Math.sqrt(d)) / (2 * a))
    } else {
      for (const [p, delta, min, max] of [
        [ox, dx, -c.hx - padding, c.hx + padding],
        [oz, dz, -c.hz - padding, c.hz + padding],
      ]) {
        if (Math.abs(delta) < 1e-9) {
          if (p < min || p > max) { hi = -1; break }
        } else {
          const a = (min - p) / delta, b = (max - p) / delta
          lo = Math.max(lo, Math.min(a, b))
          hi = Math.min(hi, Math.max(a, b))
        }
      }
    }
    if (Math.abs(dy) < 1e-9) {
      if (origin.y < bottom - padding || origin.y > bottom + height + padding) continue
    } else {
      const a = (bottom - padding - origin.y) / dy
      const b = (bottom + height + padding - origin.y) / dy
      lo = Math.max(lo, Math.min(a, b))
      hi = Math.min(hi, Math.max(a, b))
    }
    if (hi >= lo && lo <= nearest && hi >= 0) nearest = Math.max(0, lo)
  }
  return nearest
}
