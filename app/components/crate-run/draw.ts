import {
  CHECKPOINT_COLUMNS,
  ENEMY_SIZE,
  GOAL_COLUMN,
  LEVEL_COLUMNS,
  PLAYER_W,
  ROWS,
  SHOP_COLUMNS,
  TILE,
  VIEW_H,
  VIEW_W,
  type CrateRunState,
} from "@/lib/crate-run-engine"

export const PALETTE = {
  ink: "#121826",
  navy: "#1d2b4a",
  navyDeep: "#16213b",
  brick: "#a8452f",
  brickDark: "#7d3122",
  amber: "#ffc94a",
  cream: "#f3e8bf",
} as const

const { ink, navy, navyDeep, brick, brickDark, amber, cream } = PALETTE
const HORIZON = 8 * TILE

const noise = (n: number) => {
  const value = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function drawSky(ctx: CanvasRenderingContext2D, camera: number, time: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON)
  sky.addColorStop(0, navyDeep)
  sky.addColorStop(0.62, navy)
  sky.addColorStop(1, brickDark)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  for (let i = 0; i < 26; i++) {
    const x = (noise(i) * 520 - camera * 0.04) % 520
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.3 + i))
    ctx.globalAlpha = twinkle * 0.8
    rect(ctx, x < 0 ? x + 520 : x, noise(i + 40) * 58, 1, 1, cream)
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = amber
  ctx.beginPath()
  ctx.arc(206 - camera * 0.02, 26, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = navy
  ctx.beginPath()
  ctx.arc(201 - camera * 0.02, 23, 9, 0, Math.PI * 2)
  ctx.fill()
}

function drawSkyline(ctx: CanvasRenderingContext2D, camera: number) {
  const offset = camera * 0.2
  const slot = 30
  for (let i = Math.floor(offset / slot) - 1; i < Math.floor((offset + VIEW_W) / slot) + 2; i++) {
    const x = i * slot - offset
    const w = 18 + Math.floor(noise(i) * 14)
    const h = 34 + Math.floor(noise(i + 9) * 46)
    const top = HORIZON - h
    rect(ctx, x, top, w, h, navyDeep)
    for (let wy = top + 5; wy < HORIZON - 10; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        if (noise(wx * 3.1 + wy * 7.7 + i) > 0.68) {
          ctx.globalAlpha = 0.55
          rect(ctx, wx, wy, 2, 2, amber)
          ctx.globalAlpha = 1
        }
      }
    }
    if (noise(i + 21) > 0.62) {
      const tx = x + w / 2 - 4
      rect(ctx, tx, top - 10, 8, 7, navyDeep)
      rect(ctx, tx - 1, top - 11, 10, 2, navyDeep)
      rect(ctx, tx + 1, top - 3, 1, 3, navyDeep)
      rect(ctx, tx + 6, top - 3, 1, 3, navyDeep)
    }
  }
}

/** The signature: a J train rolling along the el every sixteen seconds. */
function drawElevated(ctx: CanvasRenderingContext2D, camera: number, time: number) {
  const offset = camera * 0.45
  const trackY = 92
  ctx.globalAlpha = 0.85
  rect(ctx, 0, trackY, VIEW_W, 3, ink)
  for (let i = Math.floor(offset / 40) - 1; i < Math.floor((offset + VIEW_W) / 40) + 2; i++) {
    const x = i * 40 - offset
    rect(ctx, x, trackY + 3, 3, HORIZON - trackY - 3, ink)
    ctx.strokeStyle = ink
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 3, trackY + 3)
    ctx.lineTo(x + 20, trackY + 14)
    ctx.lineTo(x + 37, trackY + 3)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  const cycle = time % 16
  if (cycle > 7) return
  const trainLength = 4 * 46
  const x = VIEW_W + 10 - (cycle / 7) * (VIEW_W + trainLength + 20)
  for (let car = 0; car < 4; car++) {
    const cx = x + car * 46
    rect(ctx, cx, trackY - 15, 44, 14, cream)
    rect(ctx, cx, trackY - 3, 44, 2, ink)
    for (let w = 0; w < 5; w++) rect(ctx, cx + 4 + w * 8, trackY - 12, 5, 5, noise(car * 5 + w) > 0.3 ? amber : navy)
    rect(ctx, cx + 2, trackY - 13, 1, 10, brickDark)
  }
  ctx.fillStyle = brickDark
  ctx.beginPath()
  ctx.arc(x + 8, trackY - 9.5, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = cream
  ctx.font = "bold 6px monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("J", x + 8, trackY - 9)
}

function drawBrownstones(ctx: CanvasRenderingContext2D, camera: number) {
  const offset = camera * 0.62
  const slot = 52
  ctx.globalAlpha = 0.9
  for (let i = Math.floor(offset / slot) - 1; i < Math.floor((offset + VIEW_W) / slot) + 2; i++) {
    const x = i * slot - offset
    const h = 50 + Math.floor(noise(i + 3) * 18)
    const top = HORIZON - h
    rect(ctx, x, top, slot - 2, h, brickDark)
    rect(ctx, x - 1, top, slot, 3, ink)
    for (let floor = 0; floor < 3; floor++) {
      for (let w = 0; w < 3; w++) {
        const lit = noise(i * 9 + floor * 3 + w) > 0.55
        ctx.globalAlpha = lit ? 0.8 : 0.35
        rect(ctx, x + 6 + w * 15, top + 8 + floor * 14, 7, 9, lit ? amber : navyDeep)
        ctx.globalAlpha = 0.9
      }
    }
  }
  ctx.globalAlpha = 1
}

function drawShop(ctx: CanvasRenderingContext2D, camera: number, time: number) {
  const x = SHOP_COLUMNS.start * TILE - camera
  const w = (SHOP_COLUMNS.end - SHOP_COLUMNS.start) * TILE
  if (x > VIEW_W || x + w < 0) return
  rect(ctx, x, 30, w, HORIZON - 30, brick)
  for (let y = 34; y < HORIZON; y += 6) {
    ctx.globalAlpha = 0.18
    rect(ctx, x, y, w, 1, cream)
  }
  ctx.globalAlpha = 1
  rect(ctx, x - 2, 28, w + 4, 4, ink)
  rect(ctx, x + 14, 40, w - 28, 18, ink)
  ctx.fillStyle = amber
  ctx.font = "bold 9px monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 5)
  ctx.fillText("RAF'S RECORDS", x + w / 2, 49.5)
  ctx.globalAlpha = 1

  for (let s = 0; s < w; s += 8) rect(ctx, x + s, 82, 8, 8, (s / 8) % 2 ? cream : amber)
  rect(ctx, x, 90, w, 2, ink)

  const windowX = x + 10
  rect(ctx, windowX, 96, 92, 32, cream)
  for (let r = 0; r < 4; r++) {
    const rx = windowX + 14 + r * 22
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(rx, 110, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = r % 2 ? brick : amber
    ctx.beginPath()
    ctx.arc(rx, 110, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  rect(ctx, windowX, 96, 92, 2, ink)
  const doorX = x + w - 50
  rect(ctx, doorX, 98, 22, 30, navy)
  rect(ctx, doorX + 17, 112, 2, 3, amber)
}

function drawStreetlight(ctx: CanvasRenderingContext2D, x: number, lit: boolean) {
  rect(ctx, x, 70, 2, HORIZON - 70, ink)
  rect(ctx, x - 1, 68, 8, 3, ink)
  if (lit) {
    ctx.globalAlpha = 0.18
    ctx.fillStyle = amber
    ctx.beginPath()
    ctx.moveTo(x + 2, 72)
    ctx.lineTo(x - 10, HORIZON)
    ctx.lineTo(x + 18, HORIZON)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
  rect(ctx, x + 3, 71, 4, 3, lit ? amber : navy)
}

function drawTile(ctx: CanvasRenderingContext2D, state: CrateRunState, col: number, row: number, x: number, y: number) {
  const tile = state.grid[row][col]
  switch (tile) {
    case "#": {
      if (row === 8) {
        rect(ctx, x, y, TILE, TILE, ink)
        ctx.globalAlpha = 0.72
        rect(ctx, x, y + 2, TILE, TILE - 2, cream)
        ctx.globalAlpha = 1
        rect(ctx, x, y, TILE, 2, cream)
        ctx.globalAlpha = 0.3
        rect(ctx, x + TILE - 1, y + 2, 1, TILE - 2, ink)
        ctx.globalAlpha = 1
      } else {
        rect(ctx, x, y, TILE, TILE, brick)
        ctx.globalAlpha = 0.35
        rect(ctx, x, y + 7, TILE, 1, cream)
        rect(ctx, x + (col % 2 ? 4 : 11), y, 1, 7, cream)
        rect(ctx, x + (col % 2 ? 11 : 4), y + 8, 1, 8, cream)
        ctx.globalAlpha = 1
      }
      return
    }
    case "B": {
      rect(ctx, x, y, TILE, TILE, brick)
      ctx.globalAlpha = 0.4
      rect(ctx, x, y + 5, TILE, 1, cream)
      rect(ctx, x, y + 10, TILE, 1, cream)
      rect(ctx, x + 7, y, 1, 5, cream)
      rect(ctx, x + 3, y + 6, 1, 4, cream)
      rect(ctx, x + 11, y + 6, 1, 4, cream)
      rect(ctx, x + 7, y + 11, 1, 5, cream)
      ctx.globalAlpha = 1
      rect(ctx, x, y + TILE - 1, TILE, 1, ink)
      return
    }
    case "?": {
      rect(ctx, x, y, TILE, TILE, ink)
      rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, amber)
      rect(ctx, x + 2, y + 2, 1, 1, ink)
      rect(ctx, x + 13, y + 2, 1, 1, ink)
      rect(ctx, x + 2, y + 13, 1, 1, ink)
      rect(ctx, x + 13, y + 13, 1, 1, ink)
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(state.time * 6 + col)
      ctx.fillStyle = brickDark
      ctx.font = "bold 12px monospace"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("?", x + 8, y + 9)
      ctx.globalAlpha = 1
      return
    }
    case "U": {
      rect(ctx, x, y, TILE, TILE, ink)
      rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, brickDark)
      return
    }
    case "T": {
      rect(ctx, x, y, TILE, TILE, brickDark)
      const top = row === 0 || state.grid[row - 1][col] !== "T"
      if (top) rect(ctx, x, y, TILE, 3, cream)
      ctx.globalAlpha = 0.25
      rect(ctx, x, y + TILE - 1, TILE, 1, ink)
      ctx.globalAlpha = 1
      return
    }
    case "S": {
      rect(ctx, x, y, TILE, TILE, ink)
      const pulse = 1 + 0.12 * Math.max(0, Math.sin(state.time * Math.PI * 2 * 2.1))
      const below = row < ROWS - 1 && state.grid[row + 1][col] === "S"
      ctx.strokeStyle = cream
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x + 8, y + 8, (below ? 3 : 5) * pulse, 0, Math.PI * 2)
      ctx.stroke()
      rect(ctx, x + 7, y + 7, 2, 2, amber)
      rect(ctx, x, y, TILE, 1, navy)
      return
    }
    case "=": {
      rect(ctx, x, y, TILE, 3, ink)
      rect(ctx, x, y + 9, TILE, 1, ink)
      rect(ctx, x + 1, y, 1, 10, ink)
      rect(ctx, x + 8, y, 1, 10, ink)
      return
    }
    default:
      return
  }
}

function drawCrate(ctx: CanvasRenderingContext2D, camera: number, time: number) {
  const x = GOAL_COLUMN * TILE - camera
  const y = HORIZON - 15
  for (let s = 0; s < 6; s++) rect(ctx, x + 2 + s * 3, y - 5 + (s % 2), 2, 6, s % 3 ? ink : brick)
  rect(ctx, x, y, 22, 15, brickDark)
  rect(ctx, x, y + 4, 22, 2, amber)
  rect(ctx, x, y + 10, 22, 2, amber)
  rect(ctx, x, y, 2, 15, ink)
  rect(ctx, x + 20, y, 2, 15, ink)
  const bob = Math.round(Math.sin(time * 4) * 2)
  ctx.fillStyle = amber
  ctx.beginPath()
  ctx.moveTo(x + 6, y - 18 + bob)
  ctx.lineTo(x + 16, y - 18 + bob)
  ctx.lineTo(x + 11, y - 11 + bob)
  ctx.closePath()
  ctx.fill()
  ctx.font = "bold 7px monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillText("DIG", x + 11, y - 21 + bob)
}

function drawRecord(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number) {
  const squeeze = Math.max(0.2, Math.abs(Math.cos(spin)))
  ctx.save()
  ctx.translate(Math.round(x + 5), Math.round(y + 5))
  ctx.scale(squeeze, 1)
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = amber
  ctx.beginPath()
  ctx.arc(0, 0, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCd(ctx: CanvasRenderingContext2D, x: number, y: number, squash: number, alive: boolean, facing: number) {
  const cx = Math.round(x + ENEMY_SIZE / 2)
  const cy = Math.round(y + ENEMY_SIZE / 2)
  if (!alive) {
    ctx.globalAlpha = Math.max(0, squash / 0.45)
    ctx.fillStyle = cream
    ctx.beginPath()
    ctx.ellipse(cx, y + ENEMY_SIZE - 2, 7, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    return
  }
  ctx.fillStyle = cream
  ctx.beginPath()
  ctx.arc(cx, cy, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = navy
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(x / 6)
  rect(ctx, -5, -0.5, 4, 1, brick)
  ctx.restore()
  rect(ctx, cx - 1, cy - 1, 2, 2, ink)
  const eye = facing > 0 ? 1 : -3
  rect(ctx, cx + eye, cy - 4, 2, 2, ink)
  rect(ctx, cx + eye - 1, cy - 5, 4, 1, ink)
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: CrateRunState, camera: number) {
  const player = state.player
  if (player.grace > 0 && Math.floor(player.grace * 12) % 2 === 0) return
  const x = Math.round(player.x - camera)
  const y = Math.round(player.y)
  const flip = player.facing < 0
  const px = (dx: number, w: number) => (flip ? x + PLAYER_W - dx - w : x + dx)
  const stride = Math.floor(player.walk / 7) % 2

  rect(ctx, px(2, 6), y, 6, 3, ink)
  rect(ctx, px(1, 8), y, 8, 1, ink)
  rect(ctx, px(2, 6), y + 3, 6, 4, cream)
  rect(ctx, px(6, 1), y + 4, 1, 1, ink)
  rect(ctx, px(1, 1), y + 2, 1, 4, amber)
  rect(ctx, px(8, 1), y + 2, 1, 4, amber)
  rect(ctx, px(1, 8), y + 7, 8, 4, amber)
  rect(ctx, px(stride ? 7 : 8, 2), y + 8, 2, 2, brick)
  rect(ctx, px(2, 6), y + 11, 6, 2, navy)
  if (!player.onGround) {
    rect(ctx, px(1, 3), y + 13, 3, 1, ink)
    rect(ctx, px(6, 3), y + 12, 3, 1, ink)
  } else {
    rect(ctx, px(stride ? 1 : 2, 3), y + 13, 3, 1, ink)
    rect(ctx, px(stride ? 6 : 5, 3), y + 13, 3, 1, ink)
  }
}

export function drawCrateRun(ctx: CanvasRenderingContext2D, state: CrateRunState) {
  const camera = Math.round(state.cameraX)
  const time = state.time
  drawSky(ctx, camera, time)
  drawSkyline(ctx, camera)
  drawElevated(ctx, camera, time)
  drawBrownstones(ctx, camera)
  drawShop(ctx, camera, time)

  CHECKPOINT_COLUMNS.forEach((col, index) => {
    if (index === 0) return
    const x = col * TILE - camera - 6
    if (x > -20 && x < VIEW_W + 20) drawStreetlight(ctx, x, state.checkpointsLit[index])
  })

  const firstCol = Math.max(0, Math.floor(camera / TILE))
  const lastCol = Math.min(LEVEL_COLUMNS - 1, Math.ceil((camera + VIEW_W) / TILE))
  for (let row = 0; row < ROWS; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      if (state.grid[row][col] === ".") continue
      const bump = state.bumps.find((b) => b.col === col && b.row === row)
      const lift = bump ? Math.sin((bump.t / 0.22) * Math.PI) * 4 : 0
      drawTile(ctx, state, col, row, col * TILE - camera, row * TILE - lift)
    }
  }

  drawCrate(ctx, camera, time)

  for (const pickup of state.pickups) {
    const x = pickup.x - camera
    if (x < -12 || x > VIEW_W + 12) continue
    if (pickup.popped !== undefined) {
      if (pickup.popped > 0.5) continue
      ctx.globalAlpha = 1 - pickup.popped / 0.5
      drawRecord(ctx, x, pickup.y - pickup.popped * 40, time * 14)
      ctx.globalAlpha = 1
    } else if (!pickup.taken) {
      drawRecord(ctx, x, pickup.y + Math.sin(time * 3 + pickup.x) * 1.5, time * 3 + pickup.x)
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive && enemy.squash <= 0) continue
    const x = enemy.x - camera
    if (x < -16 || x > VIEW_W + 16) continue
    drawCd(ctx, x, enemy.y, enemy.squash, enemy.alive, Math.sign(enemy.vx))
  }

  drawPlayer(ctx, state, camera)
}
