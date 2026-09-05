import { FIELD, PICKUPS, paddleWidth, type BrickRun } from "./brickbreaker-engine"

const backgrounds = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>()
function metalField(ctx: CanvasRenderingContext2D) {
  let plate = backgrounds.get(ctx)
  if (plate) return plate
  plate = document.createElement("canvas")
  plate.width = FIELD.width * 2
  plate.height = FIELD.height * 2
  const c = plate.getContext("2d")!
  c.scale(2, 2)
  const base = c.createLinearGradient(0, 0, 360, 450)
  base.addColorStop(0, "#bfc5cb")
  base.addColorStop(0.45, "#e4e7ea")
  base.addColorStop(1, "#939fae")
  c.fillStyle = base
  c.fillRect(0, 0, 360, 450)
  for (let row = 0; row < 6; row++)
    for (let col = -1; col < 4; col++) {
      const x = col * 112 + (row % 2) * 43,
        y = row * 82 - 9
      c.fillStyle = row % 2 ? "#dde1e425" : "#72819510"
      c.fillRect(x + 3, y + 3, 105, 75)
      c.strokeStyle = "#ffffff77"
      c.lineWidth = 1
      c.strokeRect(x + 3.5, y + 3.5, 105, 75)
      c.strokeStyle = "#71809455"
      c.strokeRect(x + 2.5, y + 2.5, 105, 75)
      c.fillStyle = "#76818c88"
      c.fillRect(x + 9, y + 10, 2, 2)
      c.fillRect(x + 98, y + 66, 2, 2)
      if ((row + col) % 3 === 0) {
        c.fillStyle = "#75829325"
        for (let i = 0; i < 5; i++) c.fillRect(x + 75 + i * 4, y + 18, 2, 17)
      }
    }
  const shade = c.createLinearGradient(0, 0, 360, 0)
  shade.addColorStop(0, "#1c29363b")
  shade.addColorStop(0.07, "#1c293600")
  shade.addColorStop(0.92, "#1c293600")
  shade.addColorStop(1, "#1c29364d")
  c.fillStyle = shade
  c.fillRect(0, 0, 360, 450)
  c.font = "bold 10px monospace"
  c.fillStyle = "#5a697b44"
  c.textAlign = "center"
  c.fillText("RAF / ARCADE SYSTEMS", 180, 334)
  c.strokeStyle = "#69768755"
  c.setLineDash([3, 5])
  c.beginPath()
  c.moveTo(12, 405)
  c.lineTo(348, 405)
  c.stroke()
  c.setLineDash([])
  backgrounds.set(ctx, plate)
  return plate
}
export function drawBrickbreaker(ctx: CanvasRenderingContext2D, g: BrickRun, reducedMotion = false) {
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.setTransform(width / FIELD.width, 0, 0, height / FIELD.height, 0, 0)
  ctx.drawImage(metalField(ctx), 0, 0, FIELD.width, FIELD.height)
  for (const b of g.bricks) {
    if (b.hp <= 0) continue
    ctx.fillStyle = "#1b29384d"
    ctx.fillRect(b.x + 1, b.y + 3, b.w, b.h)
    const gradient = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
    gradient.addColorStop(0, b.steel ? "#f6f7ef" : "#fa7163")
    gradient.addColorStop(0.25, b.steel ? "#c5c9c3" : b.maxHp === 3 ? "#a23131" : "#d93e32")
    gradient.addColorStop(1, b.steel ? "#808f91" : "#741e24")
    ctx.fillStyle = b.flash > 0 ? "#fff3d7" : gradient
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.strokeStyle = b.steel ? "#6c7980" : "#80232b"
    ctx.lineWidth = 1
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1)
    ctx.fillStyle = "#ffffff77"
    ctx.fillRect(b.x + 2, b.y + 1, b.w - 4, 2)
    if (b.steel) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#546169"
        ctx.fillRect(b.x + 9 + i * 7, b.y + 6, 3, 9)
        ctx.fillStyle = "#ffffffaa"
        ctx.fillRect(b.x + 12 + i * 7, b.y + 6, 1, 9)
      }
    } else {
      if (b.maxHp > 1)
        for (let i = 0; i < b.hp; i++) {
          ctx.fillStyle = "#ffd9aa"
          ctx.fillRect(b.x + 4 + i * 5, b.y + b.h - 5, 3, 2)
        }
      if (b.hp < b.maxHp) {
        ctx.beginPath()
        ctx.moveTo(b.x + b.w * 0.48, b.y)
        ctx.lineTo(b.x + b.w * 0.37, b.y + 6)
        ctx.lineTo(b.x + b.w * 0.58, b.y + 10)
        ctx.lineTo(b.x + b.w * 0.45, b.y + 15)
        ctx.lineTo(b.x + b.w * 0.54, b.y + b.h)
        ctx.strokeStyle = "#501a26"
        ctx.lineWidth = 2
        ctx.stroke()
        if (b.maxHp - b.hp > 1) {
          ctx.beginPath()
          ctx.moveTo(b.x + 3, b.y + 6)
          ctx.lineTo(b.x + 13, b.y + 8)
          ctx.lineTo(b.x + 17, b.y + 15)
          ctx.stroke()
        }
      }
    }
  }
  for (const drop of g.drops) {
    const info = PICKUPS[drop.kind]
    ctx.fillStyle = "#1d293b55"
    ctx.fillRect(drop.x - 10, drop.y - 5, 23, 16)
    ctx.fillStyle = "#29323e"
    ctx.fillRect(drop.x - 11, drop.y - 8, 22, 16)
    ctx.fillStyle = info.color
    ctx.fillRect(drop.x - 9, drop.y - 6, 18, 12)
    ctx.fillStyle = "#101924"
    ctx.textAlign = "center"
    ctx.font = "bold 11px monospace"
    ctx.fillText(info.glyph, drop.x, drop.y + 4)
  }
  const pw = paddleWidth(g),
    px = g.paddle - pw / 2,
    py = FIELD.paddleY
  ctx.fillStyle = "#23304455"
  ctx.beginPath()
  ctx.ellipse(g.paddle, py + 16, pw / 2 + 2, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px, py + 10)
  ctx.lineTo(px + 4, py)
  ctx.lineTo(px + 15, py - 2)
  ctx.lineTo(px + pw - 15, py - 2)
  ctx.lineTo(px + pw - 4, py)
  ctx.lineTo(px + pw, py + 10)
  ctx.lineTo(px + pw - 7, py + 14)
  ctx.lineTo(px + 7, py + 14)
  ctx.closePath()
  const blue = ctx.createLinearGradient(0, py - 2, 0, py + 14)
  blue.addColorStop(0, "#becfff")
  blue.addColorStop(0.25, "#5878de")
  blue.addColorStop(0.5, "#203fa5")
  blue.addColorStop(0.7, "#101d4e")
  blue.addColorStop(1, "#607cb6")
  ctx.fillStyle = blue
  ctx.fill()
  ctx.strokeStyle = "#152e6b"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = g.powers.catch > 0 ? "#f3c677" : "#b4d3f2"
  ctx.fillRect(px + 13, py - 2, pw - 26, 2)
  ctx.fillStyle = "#081727"
  ctx.fillRect(g.paddle - 13, py + 6, 26, 7)
  ctx.fillStyle = "#82e7ed"
  ctx.fillRect(g.paddle - 10, py + 8, 20, 3)
  for (const x of [px + 5, px + pw - 8]) {
    ctx.fillStyle = "#a8b1c7"
    ctx.fillRect(x, py + 2, 3, 6)
  }
  if (g.powers.laser > 0)
    for (const x of [px + 5, px + pw - 8]) {
      ctx.fillStyle = "#fc6964"
      ctx.fillRect(x, py - 7, 3, 8)
    }
  for (const shot of g.shots) {
    if (shot.rocket) {
      ctx.fillStyle = "#a7212d"
      ctx.beginPath()
      ctx.moveTo(shot.x, shot.y - 10)
      ctx.lineTo(shot.x + 4, shot.y - 2)
      ctx.lineTo(shot.x - 4, shot.y - 2)
      ctx.fill()
      ctx.fillStyle = "#f5e4c2"
      ctx.fillRect(shot.x - 3, shot.y - 2, 6, 11)
      ctx.fillStyle = "#dd854a"
      ctx.fillRect(shot.x - 2, shot.y + 9, 4, 5)
    } else {
      ctx.fillStyle = "#ad203a"
      ctx.fillRect(shot.x - 1.5, shot.y - 8, 3, 12)
      ctx.fillStyle = "#ffb79c"
      ctx.fillRect(shot.x - 0.5, shot.y - 8, 1, 12)
    }
  }
  for (const b of g.balls) {
    if (b.held) {
      ctx.save()
      ctx.strokeStyle = "#2b4677aa"
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x + Math.sin(g.aim) * 65, b.y - Math.cos(g.aim) * 65)
      ctx.stroke()
      ctx.restore()
    } else if (!reducedMotion) {
      for (let i = 0; i < b.trail.length; i += 2) {
        ctx.fillStyle = `rgba(48,65,87,${i * 0.025})`
        ctx.beginPath()
        ctx.arc(b.trail[i].x, b.trail[i].y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const shine = ctx.createRadialGradient(b.x - 1.5, b.y - 1.5, 0.3, b.x, b.y, FIELD.radius)
    shine.addColorStop(0, "#fff")
    shine.addColorStop(0.3, "#a6b3c2")
    shine.addColorStop(0.7, "#374351")
    shine.addColorStop(1, "#111924")
    ctx.fillStyle = shine
    ctx.beginPath()
    ctx.arc(b.x, b.y, FIELD.radius, 0, Math.PI * 2)
    ctx.fill()
  }
  if (!reducedMotion)
    for (const p of g.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 4)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
    }
  ctx.globalAlpha = 1
  if (g.phase === "serve" || g.balls.some((b) => b.held)) {
    ctx.textAlign = "center"
    ctx.font = "bold 12px monospace"
    ctx.fillStyle = "#24344c"
    ctx.fillText("LINE IT UP. LAUNCH WHEN READY.", 180, 372)
  }
  ctx.restore()
}
