import { BRICK_LEVELS } from "./brickbreaker-levels"
export { BRICK_LEVELS } from "./brickbreaker-levels"

export const FIELD = { width: 360, height: 450, paddleY: 418, paddleHeight: 11, radius: 4.5 }
export type BrickPhase = "ready" | "serve" | "playing" | "cleared" | "over" | "won"
export type PickupKind = "wide" | "slow" | "multi" | "catch" | "laser" | "rocket" | "life"
export const PICKUPS: Record<PickupKind, { label: string; glyph: string; color: string; help: string }> = {
  wide: { label: "Long paddle", glyph: "L", color: "#3cbda8", help: "A wider paddle for 18 seconds." },
  slow: { label: "Slow ball", glyph: "S", color: "#e1b64e", help: "More reaction time for 14 seconds." },
  multi: { label: "Multiball", glyph: "M", color: "#a690dc", help: "Three balls; lose a life only when all are gone." },
  catch: { label: "Sticky paddle", glyph: "C", color: "#4fa8c3", help: "Catch and relaunch for 18 seconds." },
  laser: { label: "Laser", glyph: "Z", color: "#ed7564", help: "Hold Fire / Space for twin lasers, 14 seconds." },
  rocket: { label: "Rockets +3", glyph: "R", color: "#e8a460", help: "Tap Fire / Space; blasts break nearby bricks." },
  life: { label: "Extra life", glyph: "+", color: "#86b876", help: "One extra paddle, up to nine lives." },
}
export interface BrickTile {
  id: number
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
  steel: boolean
  drop?: PickupKind
  flash: number
}
export interface BrickBall {
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  held: boolean
  offset: number
  trail: { x: number; y: number }[]
}
export interface BrickRun {
  phase: BrickPhase
  paused: boolean
  level: number
  practice: boolean
  lives: number
  score: number
  time: number
  paddle: number
  paddleV: number
  aim: number
  balls: BrickBall[]
  bricks: BrickTile[]
  drops: { x: number; y: number; kind: PickupKind }[]
  shots: { x: number; y: number; rocket: boolean }[]
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[]
  powers: Record<"wide" | "slow" | "catch" | "laser", number>
  rockets: number
  cooldown: number
  combo: number
  bestCombo: number
  message: string
  messageTime: number
  accumulator: number
  fireHeld: boolean
  pendingFire: boolean
  event: number
  sound: "brick" | "paddle" | "pickup" | "loss" | "clear" | "fire"
}
export interface BrickInput {
  move?: number
  target?: number
  aim?: number
  fire?: boolean
}
const STEP = 1 / 120
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
const normal = (n: number | undefined) => (Number.isFinite(n) ? n! : 0)
export const paddleWidth = (g: BrickRun) => (g.powers.wide > 0 ? 100 : 70)
const baseSpeed = (level: number) => Math.min(300, 205 + level * 3)
const sound = (g: BrickRun, type: BrickRun["sound"]) => {
  g.sound = type
  g.event++
}
function notice(g: BrickRun, text: string) {
  g.message = text
  g.messageTime = 2.6
}

export function makeBrickBoard(level: number): BrickTile[] {
  const rows = BRICK_LEVELS[level - 1][1].split("|")
  const bricks: BrickTile[] = []
  const gifts: PickupKind[] = ["wide", "multi", "rocket", "catch", "life", "laser", "slow"]
  let count = 0
  rows.forEach((row, r) =>
    Array.from(row).forEach((cell, c) => {
      if (cell === ".") return
      const steel = cell === "#"
      const hp = steel ? 1 : Number(cell)
      const drop =
        !steel && count++ % 7 === 2 ? gifts[(Math.floor((count - 1) / 7) + level - 1) % gifts.length] : undefined
      bricks.push({ id: r * 9 + c, x: 10 + c * 38, y: 42 + r * 23, w: 36, h: 21, hp, maxHp: hp, steel, drop, flash: 0 })
    }),
  )
  return bricks
}
function heldBall(g: BrickRun): BrickBall {
  return {
    x: g.paddle,
    y: FIELD.paddleY - FIELD.radius - 0.5,
    vx: 0,
    vy: 0,
    speed: baseSpeed(g.level),
    held: true,
    offset: 0,
    trail: [],
  }
}
function resetServe(g: BrickRun) {
  g.powers = { wide: 0, slow: 0, catch: 0, laser: 0 }
  g.paddle = FIELD.width / 2
  g.paddleV = 0
  g.aim = -0.28
  g.balls = [heldBall(g)]
  g.drops = []
  g.shots = []
  g.combo = 0
  g.cooldown = 0
  g.phase = "serve"
  g.pendingFire = false
  g.fireHeld = false
}
export function createBrickbreaker(level = 1, practice = false): BrickRun {
  level = clamp(Number.isInteger(level) ? level : 1, 1, BRICK_LEVELS.length)
  const g: BrickRun = {
    phase: "ready",
    paused: false,
    level,
    practice,
    lives: 3,
    score: 0,
    time: 0,
    paddle: 180,
    paddleV: 0,
    aim: -0.28,
    balls: [],
    bricks: makeBrickBoard(level),
    drops: [],
    shots: [],
    particles: [],
    powers: { wide: 0, slow: 0, catch: 0, laser: 0 },
    rockets: 0,
    cooldown: 0,
    combo: 0,
    bestCombo: 0,
    message: "",
    messageTime: 0,
    accumulator: 0,
    fireHeld: false,
    pendingFire: false,
    event: 0,
    sound: "brick",
  }
  g.balls = [heldBall(g)]
  return g
}
export function startBrickbreaker(g: BrickRun) {
  if (g.phase === "ready") resetServe(g)
}
export function nextBrickLevel(g: BrickRun) {
  if (g.phase !== "cleared") return
  g.level++
  g.bricks = makeBrickBoard(g.level)
  g.particles = []
  resetServe(g)
  notice(g, `Level ${g.level} · ${BRICK_LEVELS[g.level - 1][0]}`)
}
export function pauseBrickbreaker(g: BrickRun, paused: boolean) {
  g.paused = paused
  g.pendingFire = false
  g.fireHeld = false
  g.accumulator = 0
}
function release(g: BrickRun) {
  for (const ball of g.balls)
    if (ball.held) {
      ball.held = false
      const angle = clamp(g.aim, -1, 1)
      ball.vx = Math.sin(angle) * ball.speed
      ball.vy = -Math.cos(angle) * ball.speed
    }
  g.phase = "playing"
}
function burst(g: BrickRun, x: number, y: number, color: string, count = 7) {
  for (let i = 0; i < count && g.particles.length < 100; i++) {
    const angle = i * 2.399 + x
    g.particles.push({ x, y, vx: Math.cos(angle) * 65, vy: Math.sin(angle) * 65 - 20, life: 0.45, color })
  }
}
function damage(g: BrickRun, brick: BrickTile, amount = 1) {
  if (brick.hp <= 0 || brick.steel) return
  brick.hp = Math.max(0, brick.hp - amount)
  brick.flash = 0.09
  sound(g, "brick")
  if (brick.hp === 0) {
    g.combo++
    g.bestCombo = Math.max(g.bestCombo, g.combo)
    g.score += (50 + brick.maxHp * 10) * Math.min(3, 1 + Math.floor(g.combo / 5))
    burst(g, brick.x + brick.w / 2, brick.y + brick.h / 2, "#c9473a")
    if (brick.drop) g.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, kind: brick.drop })
  }
}
export function collectBrickPickup(g: BrickRun, kind: PickupKind) {
  notice(g, PICKUPS[kind].label)
  sound(g, "pickup")
  if (kind === "wide" || kind === "catch") g.powers[kind] = 18
  else if (kind === "laser" || kind === "slow") g.powers[kind] = 14
  else if (kind === "life") g.lives = Math.min(9, g.lives + 1)
  else if (kind === "rocket") g.rockets = Math.min(9, g.rockets + 3)
  else {
    const b = g.balls.find((ball) => !ball.held) || g.balls[0]
    if (b)
      for (const angle of [-0.65, 0.65]) {
        if (g.balls.length >= 3) break
        g.balls.push({
          ...b,
          held: false,
          offset: 0,
          vx: Math.sin(angle) * b.speed,
          vy: -Math.cos(angle) * b.speed,
          trail: [],
        })
      }
  }
}

/** Earliest contact against a radius-expanded rectangle, including side normals. */
function sweep(x: number, y: number, dx: number, dy: number, left: number, top: number, right: number, bottom: number) {
  const tx1 = dx ? (left - x) / dx : -Infinity,
    tx2 = dx ? (right - x) / dx : Infinity
  const ty1 = dy ? (top - y) / dy : -Infinity,
    ty2 = dy ? (bottom - y) / dy : Infinity
  if ((!dx && (x < left || x > right)) || (!dy && (y < top || y > bottom))) return null
  const nearX = Math.min(tx1, tx2),
    nearY = Math.min(ty1, ty2)
  const near = Math.max(nearX, nearY),
    far = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2))
  if (near > far || near < -0.000001 || near > 1) return null
  return { t: Math.max(0, near), nx: nearX > nearY ? (dx > 0 ? -1 : 1) : 0, ny: nearX > nearY ? 0 : dy > 0 ? -1 : 1 }
}
function advanceBall(g: BrickRun, b: BrickBall, dt: number) {
  if (b.held) {
    b.x = g.paddle + b.offset
    b.y = FIELD.paddleY - FIELD.radius - 0.5
    return
  }
  let remaining = dt
  for (let i = 0; i < 6 && remaining > 0.000001; i++) {
    const factor = g.powers.slow > 0 ? 0.72 : 1
    const dx = b.vx * remaining * factor,
      dy = b.vy * remaining * factor,
      r = FIELD.radius
    let hit: { t: number; nx: number; ny: number; brick?: BrickTile; paddle?: boolean } | null = null
    const walls = [
      ...(dx < 0 ? [{ t: (r - b.x) / dx, nx: 1, ny: 0 }] : []),
      ...(dx > 0 ? [{ t: (FIELD.width - r - b.x) / dx, nx: -1, ny: 0 }] : []),
      ...(dy < 0 ? [{ t: (r - b.y) / dy, nx: 0, ny: 1 }] : []),
    ]
    for (const wall of walls) if (wall.t >= 0 && wall.t <= 1 && (!hit || wall.t < hit.t)) hit = wall
    if (dy > 0 && b.y <= FIELD.paddleY - r) {
      const t = (FIELD.paddleY - r - b.y) / dy
      if (t >= 0 && t <= 1 && Math.abs(b.x + dx * t - g.paddle) <= paddleWidth(g) / 2 + r && (!hit || t < hit.t))
        hit = { t, nx: 0, ny: -1, paddle: true }
    }
    for (const brick of g.bricks)
      if (brick.hp > 0) {
        const contact = sweep(b.x, b.y, dx, dy, brick.x - r, brick.y - r, brick.x + brick.w + r, brick.y + brick.h + r)
        if (contact && (!hit || contact.t < hit.t)) hit = { ...contact, brick }
      }
    if (!hit) {
      b.x += dx
      b.y += dy
      break
    }
    b.x += dx * hit.t + hit.nx * 0.02
    b.y += dy * hit.t + hit.ny * 0.02
    remaining *= 1 - hit.t
    if (hit.paddle) {
      const offset = clamp((b.x - g.paddle) / (paddleWidth(g) / 2), -1, 1)
      let angle = offset * 1.05 + clamp(g.paddleV / 600, -0.12, 0.12)
      if (Math.abs(angle) < 0.12) angle = (b.vx < 0 ? -1 : 1) * 0.12
      b.speed = Math.min(390, b.speed + 1.3)
      b.vx = Math.sin(angle) * b.speed
      b.vy = -Math.cos(angle) * b.speed
      g.combo = 0
      sound(g, "paddle")
      if (g.powers.catch > 0) {
        b.held = true
        b.offset = clamp(b.x - g.paddle, -paddleWidth(g) / 2 + r, paddleWidth(g) / 2 - r)
        b.trail = []
        break
      }
    } else {
      if (hit.nx) b.vx *= -1
      if (hit.ny) b.vy *= -1
      if (hit.brick) damage(g, hit.brick)
    }
  }
  b.trail.push({ x: b.x, y: b.y })
  if (b.trail.length > 7) b.trail.shift()
}
function tick(g: BrickRun, input: BrickInput) {
  const dt = STEP
  const half = paddleWidth(g) / 2
  const old = g.paddle
  const move = clamp(normal(input.move), -1, 1)
  if (move) g.paddle += move * 420 * dt
  else if (input.target !== undefined && Number.isFinite(input.target))
    g.paddle += clamp(input.target - g.paddle, -900 * dt, 900 * dt)
  g.paddle = clamp(g.paddle, half, FIELD.width - half)
  g.paddleV = (g.paddle - old) / dt
  g.aim = clamp(g.aim + clamp(normal(input.aim), -1, 1) * dt * 1.2, -1, 1)
  if (g.pendingFire) {
    g.pendingFire = false
    if (g.balls.some((b) => b.held)) release(g)
    else if (g.rockets && g.cooldown <= 0) {
      g.rockets--
      g.shots.push({ x: g.paddle, y: FIELD.paddleY - 8, rocket: true })
      g.cooldown = 0.3
      sound(g, "fire")
    }
  }
  if (g.phase === "playing" && input.fire && g.powers.laser > 0 && g.cooldown <= 0) {
    for (const x of [g.paddle - half + 6, g.paddle + half - 6]) g.shots.push({ x, y: FIELD.paddleY - 8, rocket: false })
    g.cooldown = 0.18
    sound(g, "fire")
  }
  if (g.phase === "serve") {
    g.balls.forEach((b) => advanceBall(g, b, dt))
    return
  }
  g.time += dt
  g.cooldown = Math.max(0, g.cooldown - dt)
  g.messageTime = Math.max(0, g.messageTime - dt)
  for (const key of ["wide", "slow", "catch", "laser"] as const) g.powers[key] = Math.max(0, g.powers[key] - dt)
  for (const brick of g.bricks) brick.flash = Math.max(0, brick.flash - dt)
  for (const ball of g.balls) advanceBall(g, ball, dt)
  g.balls = g.balls.filter((b) => b.y < FIELD.height + FIELD.radius)
  for (const shot of g.shots) {
    const oldY = shot.y
    shot.y -= (shot.rocket ? 360 : 550) * dt
    const brick = g.bricks
      .filter((b) => b.hp > 0 && shot.x >= b.x - 2 && shot.x <= b.x + b.w + 2 && oldY >= b.y && shot.y <= b.y + b.h)
      .sort((a, b) => b.y - a.y)[0]
    if (brick) {
      if (shot.rocket) {
        burst(g, shot.x, brick.y + brick.h, "#ffbc5c", 18)
        for (const neighbor of g.bricks)
          if (Math.hypot(neighbor.x - brick.x, neighbor.y - brick.y) < 66) damage(g, neighbor, 3)
      } else damage(g, brick)
      shot.y = -100
    }
  }
  g.shots = g.shots.filter((s) => s.y > -10)
  g.drops = g.drops.filter((drop) => {
    drop.y += 78 * dt
    if (
      drop.y >= FIELD.paddleY - 7 &&
      drop.y <= FIELD.paddleY + 14 &&
      Math.abs(drop.x - g.paddle) < paddleWidth(g) / 2 + 8
    ) {
      collectBrickPickup(g, drop.kind)
      return false
    }
    return drop.y < FIELD.height + 10
  })
  for (const p of g.particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 160 * dt
    p.life -= dt
  }
  g.particles = g.particles.filter((p) => p.life > 0)
  if (!g.bricks.some((b) => !b.steel && b.hp > 0)) {
    g.score += 250 + g.level * 25
    g.phase = g.level === BRICK_LEVELS.length ? "won" : "cleared"
    g.pendingFire = false
    sound(g, "clear")
  } else if (!g.balls.length) {
    g.lives--
    g.rockets = 0
    sound(g, "loss")
    if (g.lives <= 0) {
      g.phase = "over"
      g.pendingFire = false
    } else {
      resetServe(g)
      notice(g, "Ball lost · line up your next shot")
    }
  }
}
export function stepBrickbreaker(g: BrickRun, input: BrickInput, dt: number) {
  if (g.paused || !["serve", "playing"].includes(g.phase) || !Number.isFinite(dt) || dt <= 0) return
  if (input.fire && !g.fireHeld) g.pendingFire = true
  g.fireHeld = !!input.fire
  g.accumulator += Math.min(dt, 0.1)
  while (g.accumulator + 1e-9 >= STEP) {
    g.accumulator -= STEP
    tick(g, input)
    if (!["serve", "playing"].includes(g.phase)) {
      g.accumulator = 0
      break
    }
  }
}
