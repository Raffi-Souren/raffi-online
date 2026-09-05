import { SIGNAL_EXIT, SIGNAL_MAP, signalRay, type SignalState } from "./signal-lost"

function surface(w: number, h: number) {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  return { canvas, ctx: canvas.getContext("2d")! }
}

export function createSignalArt() {
  const brick = surface(128, 128),
    steel = surface(128, 128)
  brick.ctx.fillStyle = "#4f443a"
  brick.ctx.fillRect(0, 0, 128, 128)
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 5; col++) {
      brick.ctx.fillStyle = ["#927259", "#87634e", "#9c795d", "#79634f"][(row + col + 5) % 4]
      brick.ctx.fillRect(col * 32 + (row % 2 ? 16 : 0), row * 16, 30, 14)
      brick.ctx.fillStyle = "rgba(221,181,135,0.15)"
      brick.ctx.fillRect(col * 32 + (row % 2 ? 16 : 0), row * 16, 30, 2)
    }
  brick.ctx.fillStyle = "#313d3e"
  brick.ctx.fillRect(0, 94, 128, 34)
  brick.ctx.fillStyle = "#b09560"
  brick.ctx.fillRect(0, 92, 128, 3)
  brick.ctx.fillStyle = "#302b28"
  brick.ctx.fillRect(0, 5, 128, 5)
  brick.ctx.fillStyle = "#edc882"
  brick.ctx.fillRect(44, 20, 40, 8)
  brick.ctx.fillStyle = "#544c3b"
  brick.ctx.fillRect(42, 17, 44, 3)
  steel.ctx.fillStyle = "#384852"
  steel.ctx.fillRect(0, 0, 128, 128)
  steel.ctx.fillStyle = "#778584"
  steel.ctx.fillRect(0, 0, 5, 128)
  steel.ctx.fillRect(122, 0, 6, 128)
  for (let y = 14; y < 82; y += 8) {
    steel.ctx.fillStyle = "#1c2c35"
    steel.ctx.fillRect(16, y, 94, 3)
  }
  steel.ctx.fillStyle = "#d0b471"
  steel.ctx.fillRect(12, 94, 104, 15)
  steel.ctx.fillStyle = "#202b32"
  steel.ctx.font = "bold 10px Tahoma"
  steel.ctx.fillText("GROUND FLOOR", 18, 105)
  steel.ctx.fillStyle = "#8ec9bb"
  steel.ctx.fillRect(96, 116, 10, 4)
  const drone = (charging: boolean, hit: boolean) => {
    const { canvas, ctx } = surface(80, 112)
    ctx.fillStyle = "rgba(0,0,0,.35)"
    ctx.beginPath()
    ctx.ellipse(40, 102, 29, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#475b63"
    ctx.fillRect(15, 20, 50, 72)
    ctx.fillStyle = hit ? "#e6dcc3" : "#a79778"
    ctx.fillRect(12, 18, 51, 4)
    ctx.fillRect(12, 18, 4, 74)
    ctx.fillStyle = "#22353e"
    ctx.fillRect(20, 25, 38, 61)
    for (const [y, r] of [
      [43, 12],
      [70, 10],
    ]) {
      ctx.fillStyle = "#101d27"
      ctx.beginPath()
      ctx.arc(40, y, r + 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = charging ? "#f5b16e" : "#9bafb0"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(40, y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = charging ? "#ffd187" : "#455c63"
      ctx.beginPath()
      ctx.arc(40, y, r * 0.43, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = "#87918b"
    ctx.fillRect(38, 2, 3, 15)
    ctx.fillStyle = charging ? "#ffd187" : "#91c7b7"
    ctx.fillRect(35, 0, 9, 7)
    ctx.fillStyle = "#2c3b41"
    ctx.fillRect(19, 89, 9, 10)
    ctx.fillRect(52, 89, 9, 10)
    return canvas
  }
  const pack = surface(64, 64)
  pack.ctx.fillStyle = "#526b65"
  pack.ctx.fillRect(12, 16, 40, 38)
  pack.ctx.strokeStyle = "#b9e0bd"
  pack.ctx.lineWidth = 3
  pack.ctx.strokeRect(12, 16, 40, 38)
  pack.ctx.fillStyle = "#c5e1b5"
  pack.ctx.fillRect(28, 23, 8, 24)
  pack.ctx.fillRect(20, 31, 24, 8)
  const bolt = surface(32, 32),
    glow = bolt.ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  glow.addColorStop(0, "#ffefc3")
  glow.addColorStop(0.3, "#f7aa69")
  glow.addColorStop(1, "rgba(245,129,68,0)")
  bolt.ctx.fillStyle = glow
  bolt.ctx.fillRect(0, 0, 32, 32)
  const exit = surface(96, 112)
  exit.ctx.fillStyle = "#354e4b"
  exit.ctx.fillRect(10, 8, 76, 104)
  exit.ctx.strokeStyle = "#9ed9b5"
  exit.ctx.lineWidth = 4
  exit.ctx.strokeRect(10, 8, 76, 104)
  exit.ctx.fillStyle = "#bfdec4"
  exit.ctx.font = "bold 19px Tahoma"
  exit.ctx.textAlign = "center"
  exit.ctx.fillText("EXIT", 48, 37)
  exit.ctx.font = "38px Tahoma"
  exit.ctx.fillText("↑", 48, 78)
  return {
    walls: [brick.canvas, steel.canvas],
    drone: [drone(false, false), drone(true, false), drone(false, true)],
    pack: pack.canvas,
    bolt: bolt.canvas,
    exit: exit.canvas,
  }
}

export type SignalArt = ReturnType<typeof createSignalArt>

export function renderSignal(ctx: CanvasRenderingContext2D, s: SignalState, art: SignalArt) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height
  const bob = s.moving && s.phase === "playing" ? Math.sin(s.time * 11) * 2.5 : 0
  const horizon = h * 0.46 + bob,
    projection = w / (2 * Math.tan(1.13 / 2))
  ctx.imageSmoothingEnabled = false
  const ceiling = ctx.createLinearGradient(0, 0, 0, horizon)
  ceiling.addColorStop(0, "#172633")
  ceiling.addColorStop(1, "#0c141a")
  ctx.fillStyle = ceiling
  ctx.fillRect(0, 0, w, horizon)
  const floor = ctx.createLinearGradient(0, horizon, 0, h)
  floor.addColorStop(0, "#171f24")
  floor.addColorStop(1, "#6c6252")
  ctx.fillStyle = floor
  ctx.fillRect(0, horizon, w, h - horizon)
  const cos = Math.cos(s.angle),
    sin = Math.sin(s.angle)
  const projectGround = (x: number, y: number) => {
    const dx = x - s.x,
      dy = y - s.y,
      depth = dx * cos + dy * sin
    return depth > 0.08
      ? { x: w / 2 + ((-dx * sin + dy * cos) * projection) / depth, y: horizon + (projection * 1.1) / depth }
      : null
  }
  ctx.strokeStyle = "rgba(31,37,37,.35)"
  ctx.lineWidth = 1
  for (let y = 0; y <= 17; y++)
    for (let x = 0; x <= 17; x++) {
      const a = projectGround(x, y)
      if (!a) continue
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const b = projectGround(x + dx, y + dy)
        if (b) {
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }
  const step = 2,
    depth = new Float32Array(Math.ceil(w / step))
  for (let x = 0; x < w; x += step) {
    const rayAngle = s.angle + Math.atan((x - w / 2) / projection),
      ray = signalRay(s.x, s.y, rayAngle)
    const distance = ray.distance * Math.cos(rayAngle - s.angle)
    depth[Math.floor(x / step)] = distance
    const height = Math.min(h * 12, (projection * 2.4) / distance),
      top = horizon - height * 0.54
    ctx.drawImage(art.walls[ray.material === 2 ? 1 : 0], Math.floor(ray.u * 127), 0, 1, 128, x, top, step, height)
    ctx.fillStyle = `rgba(9,18,26,${Math.min(0.87, distance * 0.046 + ray.side * 0.14)})`
    ctx.fillRect(x, top, step, height)
  }
  const sprites: { x: number; y: number; height: number; art: HTMLCanvasElement; lift?: number }[] = [
    ...s.enemies
      .filter((e) => e.hp > 0)
      .map((e) => ({ x: e.x, y: e.y, height: 1.35, art: art.drone[e.hit > 0 ? 2 : e.charge > 0 ? 1 : 0] })),
    ...s.pickups.filter((p) => p.active).map((p) => ({ x: p.x, y: p.y, height: 0.55, art: art.pack })),
    ...s.bolts.map((b) => ({ x: b.x, y: b.y, height: 0.32, art: art.bolt, lift: 0.75 })),
    ...(s.wave === 3 && s.enemies.every((e) => e.hp <= 0) ? [{ ...SIGNAL_EXIT, height: 2, art: art.exit }] : []),
  ].sort((a, b) => Math.hypot(b.x - s.x, b.y - s.y) - Math.hypot(a.x - s.x, a.y - s.y))
  for (const sprite of sprites) {
    const dx = sprite.x - s.x,
      dy = sprite.y - s.y,
      z = dx * cos + dy * sin
    if (z < 0.1) continue
    const height = (projection * sprite.height) / z,
      width = (height * sprite.art.width) / sprite.art.height
    const left = w / 2 + ((-dx * sin + dy * cos) * projection) / z - width / 2
    const top = horizon + (projection * (1.1 - (sprite.lift || 0))) / z - height
    for (let x = Math.max(0, Math.floor(left / step) * step); x < Math.min(w, left + width); x += step) {
      if (z >= depth[Math.floor(x / step)]) continue
      const sx = Math.max(0, Math.min(sprite.art.width - 1, ((x - left) / width) * sprite.art.width))
      ctx.drawImage(
        sprite.art,
        sx,
        0,
        Math.max(0.1, (step / width) * sprite.art.width),
        sprite.art.height,
        x,
        top,
        step,
        height,
      )
    }
  }
  const gunScale = Math.min(w / 760, h / 500),
    recoil = s.shot > 0 ? 12 : 0
  ctx.save()
  ctx.translate(w / 2 + 54 * gunScale, h + recoil + bob)
  ctx.scale(gunScale, gunScale)
  ctx.fillStyle = "#3d4140"
  ctx.beginPath()
  ctx.moveTo(-75, 0)
  ctx.lineTo(-55, -105)
  ctx.lineTo(30, -118)
  ctx.lineTo(103, 0)
  ctx.fill()
  ctx.fillStyle = "#a57e58"
  ctx.fillRect(-15, -64, 53, 88)
  ctx.fillStyle = "#75898b"
  ctx.beginPath()
  ctx.moveTo(-62, -63)
  ctx.lineTo(-49, -147)
  ctx.lineTo(-14, -166)
  ctx.lineTo(30, -123)
  ctx.lineTo(31, -61)
  ctx.fill()
  ctx.fillStyle = "#263b46"
  ctx.fillRect(-44, -139, 44, 60)
  ctx.fillStyle = s.overheated ? "#e8a079" : "#a9d8d0"
  for (let i = 0; i < 4; i++) ctx.fillRect(-39, -123 + i * 11, 33, 5)
  ctx.fillStyle = "#152a37"
  ctx.fillRect(-39, -172, 23, 37)
  ctx.strokeStyle = "#bdc4b0"
  ctx.lineWidth = 3
  ctx.strokeRect(-39, -172, 23, 21)
  if (s.shot > 0) {
    ctx.fillStyle = "#d4fff1"
    ctx.beginPath()
    ctx.moveTo(-26, -217)
    ctx.lineTo(-5, -178)
    ctx.lineTo(-26, -158)
    ctx.lineTo(-51, -180)
    ctx.fill()
  }
  ctx.restore()
  ctx.strokeStyle = s.hit > 0 ? "#edc777" : "rgba(233,240,223,.85)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(w / 2 - 10, horizon)
  ctx.lineTo(w / 2 - 4, horizon)
  ctx.moveTo(w / 2 + 4, horizon)
  ctx.lineTo(w / 2 + 10, horizon)
  ctx.moveTo(w / 2, horizon - 10)
  ctx.lineTo(w / 2, horizon - 4)
  ctx.moveTo(w / 2, horizon + 4)
  ctx.lineTo(w / 2, horizon + 10)
  ctx.stroke()
  if (s.hit > 0) ctx.strokeRect(w / 2 - 14, horizon - 14, 28, 28)
  if (s.hurt > 0) {
    ctx.fillStyle = `rgba(191,77,49,${s.hurt * 0.8})`
    ctx.fillRect(0, 0, w, h)
  }
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, w * 0.65)
  vignette.addColorStop(0, "transparent")
  vignette.addColorStop(1, "rgba(4,12,20,.6)")
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
  const unit = w < 500 ? 3 : 4,
    mapW = SIGNAL_MAP[0].length * unit,
    ox = w - mapW - 18,
    oy = 76
  ctx.fillStyle = "rgba(12,23,31,.8)"
  ctx.fillRect(ox - 5, oy - 5, mapW + 10, mapW + 10)
  for (let y = 0; y < SIGNAL_MAP.length; y++)
    for (let x = 0; x < SIGNAL_MAP[y].length; x++) {
      ctx.fillStyle = SIGNAL_MAP[y][x] === "0" ? "#697573" : "#263740"
      ctx.fillRect(ox + x * unit, oy + y * unit, unit - 0.5, unit - 0.5)
    }
  for (const e of s.enemies)
    if (e.hp > 0) {
      ctx.fillStyle = "#db9674"
      ctx.fillRect(ox + e.x * unit - 1.5, oy + e.y * unit - 1.5, 3, 3)
    }
  ctx.fillStyle = "#b6debd"
  ctx.fillRect(ox + SIGNAL_EXIT.x * unit - 2, oy + SIGNAL_EXIT.y * unit - 2, 4, 4)
  ctx.fillStyle = "#ead59b"
  ctx.beginPath()
  ctx.arc(ox + s.x * unit, oy + s.y * unit, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#ead59b"
  ctx.beginPath()
  ctx.moveTo(ox + s.x * unit, oy + s.y * unit)
  ctx.lineTo(ox + s.x * unit + cos * 7, oy + s.y * unit + sin * 7)
  ctx.stroke()
}
