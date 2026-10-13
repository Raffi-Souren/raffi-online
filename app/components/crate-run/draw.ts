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
import { DIG_COLORS as C } from "@/lib/crate-run-palette"

/** UI chrome colors for the HUD, buttons and the crate dig, all sourced from the role palette. */
export const PALETTE = {
  ink: C.hudBg,
  navy: C.uiNavy,
  navyDeep: C.skyline,
  brick: C.uiBrick,
  brickDark: C.uiBrickDark,
  amber: C.recordLabel,
  cream: C.hudText,
  player: C.player,
} as const

const HORIZON = 8 * TILE

const noise = (n: number) => {
  const value = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawSky(ctx: CanvasRenderingContext2D, camera: number, time: number, viewW: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON)
  sky.addColorStop(0, C.skyTop)
  sky.addColorStop(1, C.skyHorizon)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, viewW, VIEW_H)

  for (let i = 0; i < 26; i++) {
    const x = (noise(i) * 520 - camera * 0.04) % 520
    const twinkle = 0.3 + 0.5 * Math.abs(Math.sin(time * 1.3 + i))
    ctx.globalAlpha = twinkle
    rect(ctx, x < 0 ? x + 520 : x, noise(i + 40) * 58, 1, 1, C.hudText)
  }
  ctx.globalAlpha = 1

  // The moon is decor, so it stays a dim stone tone and never reads as a pickup.
  const moonX = viewW - 50 - camera * 0.02
  disc(ctx, moonX, 26, 10, C.stoop)
  disc(ctx, moonX - 5, 23, 9, C.skyTop)
}

function drawSkyline(ctx: CanvasRenderingContext2D, camera: number, viewW: number) {
  const offset = camera * 0.2
  const slot = 30
  for (let i = Math.floor(offset / slot) - 1; i < Math.floor((offset + viewW) / slot) + 2; i++) {
    const x = i * slot - offset
    const w = 18 + Math.floor(noise(i) * 14)
    const h = 34 + Math.floor(noise(i + 9) * 46)
    const top = HORIZON - h
    rect(ctx, x, top, w, h, C.skyline)
    ctx.globalAlpha = 0.45
    for (let wy = top + 5; wy < HORIZON - 10; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        if (noise(wx * 3.1 + wy * 7.7 + i) > 0.7) rect(ctx, wx, wy, 2, 2, C.windowLit)
      }
    }
    ctx.globalAlpha = 1
    if (noise(i + 21) > 0.62) {
      const tx = x + w / 2 - 4
      rect(ctx, tx, top - 10, 8, 7, C.skyline)
      rect(ctx, tx - 1, top - 11, 10, 2, C.skyline)
      rect(ctx, tx + 1, top - 3, 1, 3, C.skyline)
      rect(ctx, tx + 6, top - 3, 1, 3, C.skyline)
    }
  }
}

/** The signature: a J train rolling along the el every sixteen seconds. */
function drawElevated(ctx: CanvasRenderingContext2D, camera: number, time: number, viewW: number) {
  const offset = camera * 0.45
  const trackY = 92
  rect(ctx, 0, trackY, viewW, 3, C.elTrack)
  ctx.strokeStyle = C.elTrack
  ctx.lineWidth = 1
  for (let i = Math.floor(offset / 40) - 1; i < Math.floor((offset + viewW) / 40) + 2; i++) {
    const x = i * 40 - offset
    rect(ctx, x, trackY + 3, 3, HORIZON - trackY - 3, C.elTrack)
    ctx.beginPath()
    ctx.moveTo(x + 3, trackY + 3)
    ctx.lineTo(x + 20, trackY + 14)
    ctx.lineTo(x + 37, trackY + 3)
    ctx.stroke()
  }

  const cycle = time % 16
  if (cycle > 7) return
  const trainLength = 4 * 46
  const x = viewW + 10 - (cycle / 7) * (viewW + trainLength + 20)
  for (let car = 0; car < 4; car++) {
    const cx = x + car * 46
    rect(ctx, cx, trackY - 15, 44, 14, C.trainBody)
    rect(ctx, cx, trackY - 3, 44, 2, C.elTrack)
    for (let w = 0; w < 5; w++) rect(ctx, cx + 4 + w * 8, trackY - 12, 5, 5, noise(car * 5 + w) > 0.3 ? C.windowLit : C.windowDark)
    rect(ctx, cx + 2, trackY - 13, 1, 10, C.brownstoneTrim)
  }
  disc(ctx, x + 8, trackY - 9.5, 4, C.brownstoneTrim)
  ctx.fillStyle = C.hudText
  ctx.font = "bold 6px monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("J", x + 8, trackY - 9)
}

function drawBrownstones(ctx: CanvasRenderingContext2D, camera: number, viewW: number) {
  const offset = camera * 0.62
  const slot = 52
  for (let i = Math.floor(offset / slot) - 1; i < Math.floor((offset + viewW) / slot) + 2; i++) {
    const x = i * slot - offset
    const h = 50 + Math.floor(noise(i + 3) * 18)
    const top = HORIZON - h
    rect(ctx, x, top, slot - 2, h, C.brownstone)
    rect(ctx, x - 1, top, slot, 3, C.brownstoneTrim)
    for (let floor = 0; floor < 3; floor++) {
      for (let w = 0; w < 3; w++) {
        const lit = noise(i * 9 + floor * 3 + w) > 0.55
        rect(ctx, x + 6 + w * 15, top + 8 + floor * 14, 7, 9, lit ? C.windowLit : C.windowDark)
      }
    }
  }
}

function drawShop(ctx: CanvasRenderingContext2D, camera: number, time: number, viewW: number) {
  const x = SHOP_COLUMNS.start * TILE - camera
  const w = (SHOP_COLUMNS.end - SHOP_COLUMNS.start) * TILE
  if (x > viewW || x + w < 0) return
  rect(ctx, x, 30, w, HORIZON - 30, C.uiBrickDark)
  ctx.globalAlpha = 0.18
  for (let y = 34; y < HORIZON; y += 6) rect(ctx, x, y, w, 1, C.mortar)
  ctx.globalAlpha = 1
  rect(ctx, x - 2, 28, w + 4, 4, C.outline)
  rect(ctx, x + 14, 40, w - 28, 18, C.hudBg)
  ctx.fillStyle = C.recordLabel
  ctx.font = "bold 9px monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.globalAlpha = 0.8 + 0.2 * Math.sin(time * 5)
  ctx.fillText("RAF'S RECORDS", x + w / 2, 49.5)
  ctx.globalAlpha = 1

  for (let s = 0; s < w; s += 8) rect(ctx, x + s, 82, 8, 8, (s / 8) % 2 ? C.mortar : C.recordLabel)
  rect(ctx, x, 90, w, 2, C.outline)

  const windowX = x + 10
  rect(ctx, windowX, 96, 92, 32, C.mortar)
  for (let r = 0; r < 4; r++) {
    const rx = windowX + 14 + r * 22
    disc(ctx, rx, 110, 8, C.recordDisc)
    disc(ctx, rx, 110, 3, r % 2 ? C.brickBlock : C.recordLabel)
  }
  rect(ctx, windowX, 96, 92, 2, C.outline)
  const doorX = x + w - 50
  rect(ctx, doorX, 98, 22, 30, C.windowDark)
  rect(ctx, doorX + 17, 112, 2, 3, C.recordLabel)
}

function drawStreetlight(ctx: CanvasRenderingContext2D, x: number, lit: boolean) {
  rect(ctx, x, 70, 2, HORIZON - 70, C.trainBody)
  rect(ctx, x - 1, 68, 8, 3, C.trainBody)
  if (lit) {
    ctx.globalAlpha = 0.22
    ctx.fillStyle = C.stoopTread
    ctx.beginPath()
    ctx.moveTo(x + 2, 72)
    ctx.lineTo(x - 10, HORIZON)
    ctx.lineTo(x + 18, HORIZON)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
  rect(ctx, x + 3, 71, 4, 3, lit ? C.stoopTread : C.windowDark)
}

const isPitCell = (state: CrateRunState, col: number, row: number) =>
  col >= 0 && col < LEVEL_COLUMNS && row >= 8 && state.grid[ROWS - 1][col] === "." && state.grid[row][col] === "."

/** Pits read as holes: a near-black void, so the sky gradient never fills one. */
function drawPits(ctx: CanvasRenderingContext2D, state: CrateRunState, camera: number, firstCol: number, lastCol: number) {
  for (let col = firstCol; col <= lastCol; col++) {
    for (let row = 8; row < ROWS; row++) {
      if (isPitCell(state, col, row)) rect(ctx, col * TILE - camera, row * TILE, TILE, TILE, C.pitVoid)
    }
  }
}

/** A broken sidewalk lip and a short hazard stripe on each edge of a pit. */
function drawPitEdges(ctx: CanvasRenderingContext2D, state: CrateRunState, camera: number, firstCol: number, lastCol: number) {
  for (let col = firstCol; col <= lastCol; col++) {
    if (state.grid[8][col] !== "#") continue
    const x = col * TILE - camera
    const y = HORIZON
    for (const side of [-1, 1] as const) {
      if (!isPitCell(state, col + side, 8)) continue
      const edge = side < 0 ? x : x + TILE - 1
      const inward = side < 0 ? 1 : -1
      rect(ctx, edge, y, 1, TILE, C.outline)
      rect(ctx, edge, y + 1, 1, 2, C.pitVoid)
      rect(ctx, edge + inward, y + 5, 1, 2, C.pitVoid)
      for (let s = 0; s < 4; s++) rect(ctx, edge + inward * 2, y + 4 + s * 3, 1, 2, s % 2 ? C.outline : C.enemyRim)
      rect(ctx, edge + inward * 3, y + 4, 1, 11, C.outline)
    }
  }
}

function drawTile(ctx: CanvasRenderingContext2D, state: CrateRunState, col: number, row: number, x: number, y: number) {
  const tile = state.grid[row][col]
  switch (tile) {
    case "#": {
      if (row === 8) {
        rect(ctx, x, y, TILE, TILE, C.sidewalkFace)
        rect(ctx, x, y, TILE, 1, C.outline)
        rect(ctx, x, y + 1, TILE, 3, C.sidewalk)
        rect(ctx, x, y + 4, TILE, 1, C.outline)
        if (col % 2 === 0) rect(ctx, x + TILE - 1, y + 5, 1, TILE - 5, C.outline)
      } else {
        rect(ctx, x, y, TILE, TILE, C.uiBrickDark)
        ctx.globalAlpha = 0.35
        rect(ctx, x, y + 7, TILE, 1, C.brownstoneTrim)
        rect(ctx, x + (col % 2 ? 4 : 11), y, 1, 7, C.brownstoneTrim)
        rect(ctx, x + (col % 2 ? 11 : 4), y + 8, 1, 8, C.brownstoneTrim)
        ctx.globalAlpha = 1
      }
      return
    }
    case "B": {
      rect(ctx, x, y, TILE, TILE, C.outline)
      rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, C.brickBlock)
      rect(ctx, x + 1, y + 1, TILE - 2, 1, C.mortar)
      rect(ctx, x + 1, y + 5, TILE - 2, 1, C.mortar)
      rect(ctx, x + 1, y + 10, TILE - 2, 1, C.mortar)
      rect(ctx, x + 7, y + 1, 1, 4, C.mortar)
      rect(ctx, x + 4, y + 6, 1, 4, C.mortar)
      rect(ctx, x + 11, y + 6, 1, 4, C.mortar)
      rect(ctx, x + 7, y + 11, 1, 4, C.mortar)
      return
    }
    case "?": {
      rect(ctx, x, y, TILE, TILE, C.outline)
      rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, C.questionBlock)
      rect(ctx, x + 1, y + 1, TILE - 2, 1, C.stoopTread)
      for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]]) rect(ctx, x + rx, y + ry, 1, 1, C.questionGlyph)
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(state.time * 6 + col)
      ctx.fillStyle = C.questionGlyph
      ctx.font = "bold 12px monospace"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("?", x + 8, y + 9)
      ctx.globalAlpha = 1
      return
    }
    case "U": {
      rect(ctx, x, y, TILE, TILE, C.outline)
      rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, C.usedBlock)
      rect(ctx, x + 1, y + 1, TILE - 2, 1, C.stoop)
      for (const [rx, ry] of [[2, 3], [13, 3], [2, 13], [13, 13]]) rect(ctx, x + rx, y + ry, 1, 1, C.outline)
      return
    }
    case "T": {
      const top = row === 0 || state.grid[row - 1][col] !== "T"
      rect(ctx, x, y, TILE, TILE, C.stoop)
      if (col === 0 || state.grid[row][col - 1] !== "T") rect(ctx, x, y, 1, TILE, C.outline)
      if (col === LEVEL_COLUMNS - 1 || state.grid[row][col + 1] !== "T") rect(ctx, x + TILE - 1, y, 1, TILE, C.outline)
      if (top) {
        rect(ctx, x, y, TILE, 1, C.outline)
        rect(ctx, x, y + 1, TILE, 2, C.stoopTread)
        rect(ctx, x, y + 3, TILE, 1, C.outline)
      }
      ctx.globalAlpha = 0.25
      rect(ctx, x, y + TILE - 1, TILE, 1, C.outline)
      ctx.globalAlpha = 1
      return
    }
    case "S": {
      const above = row > 0 && state.grid[row - 1][col] === "S"
      const below = row < ROWS - 1 && state.grid[row + 1][col] === "S"
      rect(ctx, x, y, TILE, TILE, C.speakerRim)
      rect(ctx, x + 1, y + (above ? 0 : 1), TILE - 2, TILE - (above ? 0 : 1) - (below ? 0 : 1), C.speakerBody)
      if (above) rect(ctx, x + 1, y, TILE - 2, 1, C.speakerRim)
      const pulse = 1 + 0.12 * Math.max(0, Math.sin(state.time * Math.PI * 2 * 2.1))
      ctx.strokeStyle = C.speakerRim
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x + 8, y + 8, (below ? 3 : 5) * pulse, 0, Math.PI * 2)
      ctx.stroke()
      rect(ctx, x + 7, y + 7, 2, 2, C.speakerRim)
      return
    }
    case "=": {
      rect(ctx, x, y, TILE, 1, C.fireEscapeRail)
      rect(ctx, x, y + 1, TILE, 2, C.fireEscape)
      rect(ctx, x, y + 3, TILE, 1, C.outline)
      for (let s = 1; s < TILE; s += 3) rect(ctx, x + s, y + 4, 1, 4, C.fireEscape)
      rect(ctx, x, y + 8, TILE, 1, C.fireEscape)
      rect(ctx, x, y + 9, TILE, 1, C.outline)
      return
    }
    default:
      return
  }
}

function drawCrate(ctx: CanvasRenderingContext2D, camera: number, time: number) {
  const x = GOAL_COLUMN * TILE - camera
  const y = HORIZON - 15
  for (let s = 0; s < 6; s++) rect(ctx, x + 2 + s * 3, y - 5 + (s % 2), 2, 6, s % 3 ? C.recordDisc : C.brickBlock)
  rect(ctx, x - 1, y - 1, 24, 16, C.outline)
  rect(ctx, x, y, 22, 15, C.uiBrickDark)
  rect(ctx, x, y + 4, 22, 2, C.recordLabel)
  rect(ctx, x, y + 10, 22, 2, C.recordLabel)
  rect(ctx, x, y, 2, 15, C.outline)
  rect(ctx, x + 20, y, 2, 15, C.outline)
  const bob = Math.round(Math.sin(time * 4) * 2)
  ctx.fillStyle = C.recordLabel
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

/** Records are the brightest, warmest objects, and never thinner than a readable sliver. */
function drawRecord(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number, time: number) {
  const squeeze = Math.max(0.45, Math.abs(Math.cos(spin)))
  const cx = Math.round(x + 5)
  const cy = Math.round(y + 5)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(squeeze, 1)
  disc(ctx, 0, 0, 6, C.outline)
  disc(ctx, 0, 0, 5, C.recordRim)
  disc(ctx, 0, 0, 4, C.recordDisc)
  disc(ctx, 0, 0, 2.2, C.recordLabel)
  ctx.restore()
  rect(ctx, cx, cy, 1, 1, C.recordDisc)
  if (time % 1 < 0.14) {
    rect(ctx, cx + 4, cy - 7, 1, 3, C.hudText)
    rect(ctx, cx + 3, cy - 6, 3, 1, C.hudText)
  }
}

/** The scratched CD: cool silver, pink-red rim, angry brow. Never amber or cream. */
function drawCd(ctx: CanvasRenderingContext2D, x: number, y: number, squash: number, alive: boolean, facing: number) {
  const cx = Math.round(x + ENEMY_SIZE / 2)
  const cy = Math.round(y + ENEMY_SIZE / 2)
  if (!alive) {
    ctx.globalAlpha = Math.max(0, squash / 0.45)
    ctx.fillStyle = C.enemyRim
    ctx.beginPath()
    ctx.ellipse(cx, y + ENEMY_SIZE - 2, 7, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.enemyBody
    ctx.beginPath()
    ctx.ellipse(cx, y + ENEMY_SIZE - 2, 5, 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    return
  }
  disc(ctx, cx, cy, 7, C.outline)
  disc(ctx, cx, cy, 6, C.enemyRim)
  disc(ctx, cx, cy, 5, C.enemyBody)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(x / 6)
  rect(ctx, -4, -0.5, 3, 1, C.trainBody)
  ctx.restore()
  rect(ctx, cx - 1, cy - 1, 2, 2, C.outline)
  const eye = facing > 0 ? 1 : -3
  rect(ctx, cx + eye, cy - 3, 2, 2, C.outline)
  // Angry brow slants down toward the direction of travel.
  const browIn = facing > 0 ? cx + eye + 2 : cx + eye - 1
  const browOut = facing > 0 ? cx + eye - 1 : cx + eye + 2
  rect(ctx, browOut, cy - 6, 1, 1, C.outline)
  rect(ctx, cx + eye, cy - 5, 2, 1, C.outline)
  rect(ctx, browIn, cy - 4, 1, 1, C.outline)
}

/** Teal jacket nothing else uses, a dark outline, and a light rim on the head and shoulders. */
function drawPlayer(ctx: CanvasRenderingContext2D, state: CrateRunState, camera: number) {
  const player = state.player
  if (player.grace > 0 && Math.floor(player.grace * 12) % 2 === 0) return
  const x = Math.round(player.x - camera)
  const y = Math.round(player.y)
  const flip = player.facing < 0
  const px = (dx: number, w: number) => (flip ? x + PLAYER_W - dx - w : x + dx)
  const stride = Math.floor(player.walk / 7) % 2
  const feet: Array<[number, number, number]> = player.onGround
    ? [[stride ? 1 : 2, 3, 13], [stride ? 6 : 5, 3, 13]]
    : [[1, 3, 13], [6, 3, 12]]

  const silhouette: Array<[number, number, number, number]> = [
    [1, 8, 0, 1],
    [2, 6, 0, 7],
    [1, 8, 7, 4],
    [2, 6, 11, 2],
    ...feet.map(([dx, w, dy]) => [dx, w, dy, 1] as [number, number, number, number]),
  ]
  for (const [dx, w, dy, h] of silhouette) rect(ctx, px(dx - 1, w + 2), y + dy - 1, w + 2, h + 2, C.outline)

  rect(ctx, px(2, 6), y, 6, 3, C.windowDark)
  rect(ctx, px(1, 8), y + 2, 8, 1, C.windowDark)
  rect(ctx, px(2, 6), y, 6, 1, C.hudText)
  rect(ctx, px(2, 6), y + 3, 6, 4, C.playerSkin)
  rect(ctx, px(6, 1), y + 4, 1, 1, C.outline)
  rect(ctx, px(1, 8), y + 7, 8, 4, C.player)
  rect(ctx, px(1, 8), y + 7, 8, 1, C.hudText)
  rect(ctx, px(stride ? 7 : 8, 1), y + 9, 1, 2, C.playerSkin)
  rect(ctx, px(2, 6), y + 11, 6, 2, C.windowDark)
  for (const [dx, w, dy] of feet) rect(ctx, px(dx, w), y + dy, w, 1, C.outline)
}

export function drawCrateRun(ctx: CanvasRenderingContext2D, state: CrateRunState, viewW: number = VIEW_W) {
  const camera = Math.round(state.cameraX)
  const time = state.time
  drawSky(ctx, camera, time, viewW)
  drawSkyline(ctx, camera, viewW)
  drawElevated(ctx, camera, time, viewW)
  drawBrownstones(ctx, camera, viewW)
  drawShop(ctx, camera, time, viewW)

  CHECKPOINT_COLUMNS.forEach((col, index) => {
    if (index === 0) return
    const x = col * TILE - camera - 6
    if (x > -20 && x < viewW + 20) drawStreetlight(ctx, x, state.checkpointsLit[index])
  })

  const firstCol = Math.max(0, Math.floor(camera / TILE) - 1)
  const lastCol = Math.min(LEVEL_COLUMNS - 1, Math.ceil((camera + viewW) / TILE))
  drawPits(ctx, state, camera, firstCol, lastCol)
  for (let row = 0; row < ROWS; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      if (state.grid[row][col] === ".") continue
      const bump = state.bumps.find((b) => b.col === col && b.row === row)
      const lift = bump ? Math.sin((bump.t / 0.22) * Math.PI) * 4 : 0
      drawTile(ctx, state, col, row, col * TILE - camera, row * TILE - lift)
    }
  }
  drawPitEdges(ctx, state, camera, firstCol, lastCol)

  drawCrate(ctx, camera, time)

  for (const pickup of state.pickups) {
    const x = pickup.x - camera
    if (x < -12 || x > viewW + 12) continue
    if (pickup.popped !== undefined) {
      if (pickup.popped > 0.5) continue
      ctx.globalAlpha = 1 - pickup.popped / 0.5
      drawRecord(ctx, x, pickup.y - pickup.popped * 40, time * 14, time)
      ctx.globalAlpha = 1
    } else if (!pickup.taken) {
      drawRecord(ctx, x, pickup.y + Math.sin(time * 3 + pickup.x) * 1.5, time * 3 + pickup.x, time + pickup.x * 0.37)
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive && enemy.squash <= 0) continue
    const x = enemy.x - camera
    if (x < -16 || x > viewW + 16) continue
    drawCd(ctx, x, enemy.y, enemy.squash, enemy.alive, Math.sign(enemy.vx))
  }

  drawPlayer(ctx, state, camera)
}
