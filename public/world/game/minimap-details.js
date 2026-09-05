/** Small map landmarks use the authored world positions, never guessed street coordinates. */
export function mapPlaces(world) {
  const kinds = {
    "mobility-hub": ["garage", "GARAGE"],
    storefront: ["record", "RECORDS"],
    club: ["club", "CLUB"],
    "brownstone-hero": ["home", "HOME"],
    "stair-down": ["door", "MAINFRAME"],
  }
  const places = []
  for (const landmark of world?.landmarks || []) {
    const kind = kinds[landmark.type]
    if (kind && landmark.at) places.push({ ...landmark.at, kind: kind[0], label: landmark.name || kind[1] })
    if (landmark.transit?.at) {
      places.push({ ...landmark.transit.at, kind: "transit", label: landmark.transit.name || "SUBWAY" })
    }
  }
  for (const shop of world?.repaintShops || []) {
    if (shop.at) places.push({ ...shop.at, kind: "paint", label: world.repaint?.label || "REPAINT" })
  }
  return places.filter((place) => Number.isFinite(place.x) && Number.isFinite(place.z))
}

/** The north-up map uses +Z down; camera yaw describes its position behind the view. */
export function mapViewAngle(cameraYaw) {
  return Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw))
}

export function visibleMapPlaces(places, { x, z, scale, radius, waypoint }) {
  let target = null
  if (waypoint) {
    const dx = waypoint.x - x,
      dz = waypoint.z - z
    const distance = Math.hypot(dx, dz)
    const projected = Math.min(distance * scale, radius - 16)
    target = { x: distance ? (dx / distance) * projected : 0, y: distance ? (dz / distance) * projected : -projected }
  }
  const candidates = places
    .map((place) => ({
      ...place,
      mx: (place.x - x) * scale,
      my: (place.z - z) * scale,
    }))
    .filter((place) => {
      const distance = Math.hypot(place.mx, place.my)
      return (
        distance > 25 &&
        distance < radius - 13 &&
        (!target || Math.hypot(place.mx - target.x, place.my - target.y) > 25)
      )
    })
    .sort((a, b) => Math.hypot(a.mx, a.my) - Math.hypot(b.mx, b.my))
  const visible = []
  for (const place of candidates) {
    if (visible.every((other) => Math.hypot(place.mx - other.mx, place.my - other.my) > 24)) visible.push(place)
  }
  return visible
}

export function drawMapDetails(ctx, places, view) {
  const { cx, cy, radius, cameraYaw } = view
  const angle = mapViewAngle(cameraYaw)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, radius * 0.68, angle - 0.48, angle + 0.48)
  ctx.closePath()
  ctx.fillStyle = "rgba(174, 218, 231, 0.09)"
  ctx.fill()
  ctx.strokeStyle = "rgba(174, 218, 231, 0.2)"
  ctx.lineWidth = 1
  ctx.stroke()

  const visible = visibleMapPlaces(places, view)
  for (const place of visible) {
    const x = cx + place.mx,
      y = cy + place.my
    const color = place.kind === "transit" ? "#a2d6de" : place.kind === "paint" ? "#b9d5ac" : "#d7c8ad"
    ctx.fillStyle = "#15232e"
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.fillRect(x - 10, y - 10, 20, 20)
    ctx.strokeRect(x - 10, y - 10, 20, 20)
    ctx.beginPath()
    if (place.kind === "record") {
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.moveTo(x + 1.5, y)
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
    } else if (place.kind === "home") {
      ctx.moveTo(x - 6, y)
      ctx.lineTo(x, y - 6)
      ctx.lineTo(x + 6, y)
      ctx.moveTo(x - 4, y - 1)
      ctx.lineTo(x - 4, y + 5)
      ctx.lineTo(x + 4, y + 5)
      ctx.lineTo(x + 4, y - 1)
    } else if (place.kind === "paint") {
      ctx.rect(x - 6, y - 5, 10, 4)
      ctx.moveTo(x + 4, y - 3)
      ctx.lineTo(x + 6, y - 3)
      ctx.lineTo(x + 6, y + 1)
      ctx.lineTo(x, y + 1)
      ctx.lineTo(x, y + 6)
    } else if (place.kind === "club") {
      ctx.moveTo(x + 1, y + 4)
      ctx.lineTo(x + 1, y - 6)
      ctx.lineTo(x + 6, y - 4)
      ctx.moveTo(x + 1, y + 4)
      ctx.ellipse(x - 2, y + 4, 3, 2, -0.3, 0, Math.PI * 2)
    } else {
      ctx.font = "bold 15px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = color
      ctx.fillText(place.kind === "transit" ? "M" : place.kind === "garage" ? "G" : "↓", x, y + 1)
    }
    ctx.stroke()
  }
  ctx.restore()
  return visible
}
