/**
 * Crate Run — the single secret platformer level behind the desktop "?" block.
 *
 * Pure and deterministic so it can be stepped from a canvas loop or a test.
 * Units are pixels and seconds; the level is a 16px tile grid ten rows tall.
 */

export const TILE = 16
export const ROWS = 10
export const VIEW_W = 256
export const VIEW_H = ROWS * TILE
export const LEVEL_COLUMNS = 116
export const LEVEL_W = LEVEL_COLUMNS * TILE

export const PLAYER_W = 10
export const PLAYER_H = 14
export const ENEMY_SIZE = 12

const GRAVITY = 980
const MAX_FALL = 420
const RUN_SPEED = 105
const GROUND_ACCEL = 900
const AIR_ACCEL = 620
const FRICTION = 1100
const JUMP_VELOCITY = 322
const JUMP_CUT_VELOCITY = 120
const STOMP_BOUNCE = 230
const ENEMY_SPEED = 28
const COYOTE_TIME = 0.09
const JUMP_BUFFER = 0.12
const RESPAWN_GRACE = 1.2

/**
 * `#` sidewalk, `B` brick, `?` record block, `U` emptied block, `T` stoop step,
 * `S` speaker stack, `=` fire escape (one-way from below).
 */
export type TileChar = "." | "#" | "B" | "?" | "U" | "T" | "S" | "="

const SOLID = new Set<TileChar>(["#", "B", "?", "U", "T", "S"])

export interface Pickup {
  x: number
  y: number
  taken: boolean
  /** Records popped from a block float up and vanish instead of waiting. */
  popped?: number
}

export interface Enemy {
  x: number
  y: number
  vx: number
  vy: number
  alive: boolean
  active: boolean
  squash: number
}

export interface Bump {
  col: number
  row: number
  t: number
}

export interface CrateRunInput {
  left: boolean
  right: boolean
  jump: boolean
}

export interface CrateRunState {
  phase: "ready" | "playing" | "cleared"
  grid: TileChar[][]
  player: {
    x: number
    y: number
    vx: number
    vy: number
    onGround: boolean
    facing: 1 | -1
    coyote: number
    jumpBuffer: number
    jumpHeld: boolean
    grace: number
    walk: number
  }
  enemies: Enemy[]
  pickups: Pickup[]
  bumps: Bump[]
  records: number
  totalRecords: number
  stomps: number
  knocks: number
  checkpoint: number
  checkpointsLit: boolean[]
  cameraX: number
  elapsed: number
  time: number
}

export const CHECKPOINT_COLUMNS = [2, 44, 84] as const
export const GOAL_COLUMN = 108
export const SHOP_COLUMNS = { start: 103, end: 114 } as const
const PITS: Array<[number, number]> = [
  [27, 29],
  [51, 53],
  [79, 81],
]
const ENEMY_COLUMNS = [16, 24, 40, 47, 59, 66, 72, 90, 93]

function emptyGrid(): TileChar[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: LEVEL_COLUMNS }, () => "." as TileChar))
}

function column(grid: TileChar[][], col: number, fromRow: number, toRow: number, tile: TileChar) {
  for (let row = fromRow; row <= toRow; row++) grid[row][col] = tile
}

function row(grid: TileChar[][], r: number, fromCol: number, toCol: number, tile: TileChar) {
  for (let col = fromCol; col <= toCol; col++) grid[r][col] = tile
}

/** Builds the level fresh each run so emptied blocks reset on replay. */
export function buildCrateRunLevel() {
  const grid = emptyGrid()
  row(grid, 8, 0, LEVEL_COLUMNS - 1, "#")
  row(grid, 9, 0, LEVEL_COLUMNS - 1, "#")
  for (const [from, to] of PITS) {
    column(grid, from, 8, 9, ".")
    for (let col = from; col <= to; col++) column(grid, col, 8, 9, ".")
  }

  const pickups: Pickup[] = []
  const record = (col: number, r: number) => pickups.push({ x: col * TILE + 3, y: r * TILE + 3, taken: false })

  // Opening block: one alone, then a brick run with a high bonus above it.
  grid[5][7] = "?"
  grid[5][10] = "B"
  grid[5][11] = "?"
  grid[5][12] = "B"
  grid[5][13] = "?"
  grid[5][14] = "B"
  grid[2][12] = "?"

  // A brownstone stoop to climb and leap from.
  column(grid, 18, 7, 7, "T")
  column(grid, 19, 6, 7, "T")
  column(grid, 20, 5, 7, "T")
  column(grid, 21, 5, 7, "T")

  record(28, 6)
  record(29, 5)

  // Fire escapes over the first block, records on the top landing.
  row(grid, 5, 32, 37, "=")
  row(grid, 3, 35, 39, "=")
  record(36, 2)
  record(37, 2)
  record(38, 2)

  // Brick shelf with two record blocks under the checkpoint streetlight.
  row(grid, 5, 42, 48, "B")
  grid[5][44] = "?"
  grid[5][46] = "?"
  record(43, 3)
  record(45, 3)
  record(47, 3)

  record(52, 5)

  // Speaker stacks stand in for pipes.
  column(grid, 57, 6, 7, "S")
  column(grid, 63, 5, 7, "S")
  column(grid, 69, 6, 7, "S")
  record(63, 3)
  record(75, 6)

  // A low fire escape bridges the widest pit.
  row(grid, 6, 79, 81, "=")
  record(80, 4)

  grid[5][86] = "?"
  grid[5][87] = "B"
  grid[5][88] = "?"
  record(89, 3)
  record(90, 2)
  record(91, 3)

  // The final stoop up to Raf's Records.
  column(grid, 97, 7, 7, "T")
  column(grid, 98, 6, 7, "T")
  column(grid, 99, 5, 7, "T")
  column(grid, 100, 4, 7, "T")
  column(grid, 101, 4, 7, "T")

  const enemies: Enemy[] = ENEMY_COLUMNS.map((col) => ({
    x: col * TILE + 2,
    y: 8 * TILE - ENEMY_SIZE,
    vx: -ENEMY_SPEED,
    vy: 0,
    alive: true,
    active: false,
    squash: 0,
  }))

  const blockRecords = grid.flat().filter((tile) => tile === "?").length
  return { grid, pickups, enemies, totalRecords: pickups.length + blockRecords }
}

export function createCrateRun(): CrateRunState {
  const { grid, pickups, enemies, totalRecords } = buildCrateRunLevel()
  return {
    phase: "ready",
    grid,
    player: {
      x: CHECKPOINT_COLUMNS[0] * TILE,
      y: 8 * TILE - PLAYER_H,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: 1,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      grace: 0,
      walk: 0,
    },
    enemies,
    pickups,
    bumps: [],
    records: 0,
    totalRecords,
    stomps: 0,
    knocks: 0,
    checkpoint: 0,
    checkpointsLit: CHECKPOINT_COLUMNS.map((_, index) => index === 0),
    cameraX: 0,
    elapsed: 0,
    time: 0,
  }
}

export function startCrateRun(state: CrateRunState) {
  if (state.phase === "ready") state.phase = "playing"
}

export function tileAt(state: CrateRunState, col: number, r: number): TileChar {
  if (col < 0 || col >= LEVEL_COLUMNS) return "#"
  if (r < 0 || r >= ROWS) return "."
  return state.grid[r][col]
}

const isSolid = (tile: TileChar) => SOLID.has(tile)

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

function respawn(state: CrateRunState) {
  const player = state.player
  player.x = CHECKPOINT_COLUMNS[state.checkpoint] * TILE
  player.y = 8 * TILE - PLAYER_H
  player.vx = 0
  player.vy = 0
  player.onGround = true
  player.grace = RESPAWN_GRACE
  state.knocks += 1
}

function bumpBlock(state: CrateRunState, col: number, r: number) {
  const tile = tileAt(state, col, r)
  if (tile !== "?" && tile !== "B") return
  state.bumps.push({ col, row: r, t: 0 })
  if (tile === "?") {
    state.grid[r][col] = "U"
    state.records += 1
    state.pickups.push({ x: col * TILE + 3, y: (r - 1) * TILE + 3, taken: true, popped: 0 })
  }
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    const onTop = Math.abs(enemy.y + ENEMY_SIZE - r * TILE) < 2
    if (onTop && overlaps(enemy.x, enemy.y, ENEMY_SIZE, ENEMY_SIZE, col * TILE, enemy.y, TILE, ENEMY_SIZE)) {
      enemy.alive = false
      enemy.squash = 0.45
      state.stomps += 1
    }
  }
}

function movePlayer(state: CrateRunState, dt: number) {
  const player = state.player

  player.x += player.vx * dt
  if (player.x < 0) {
    player.x = 0
    player.vx = 0
  }
  const top = Math.floor(player.y / TILE)
  const bottom = Math.floor((player.y + PLAYER_H - 0.01) / TILE)
  if (player.vx > 0) {
    const col = Math.floor((player.x + PLAYER_W) / TILE)
    for (let r = top; r <= bottom; r++) {
      if (isSolid(tileAt(state, col, r))) {
        player.x = col * TILE - PLAYER_W
        player.vx = 0
        break
      }
    }
  } else if (player.vx < 0) {
    const col = Math.floor(player.x / TILE)
    for (let r = top; r <= bottom; r++) {
      if (isSolid(tileAt(state, col, r))) {
        player.x = (col + 1) * TILE
        player.vx = 0
        break
      }
    }
  }

  const previousBottom = player.y + PLAYER_H
  player.y += player.vy * dt
  const left = Math.floor(player.x / TILE)
  const right = Math.floor((player.x + PLAYER_W - 0.01) / TILE)
  player.onGround = false

  if (player.vy > 0) {
    const r = Math.floor((player.y + PLAYER_H) / TILE)
    for (let col = left; col <= right; col++) {
      const tile = tileAt(state, col, r)
      const oneWayLanding = tile === "=" && previousBottom <= r * TILE + 0.5
      if (isSolid(tile) || oneWayLanding) {
        player.y = r * TILE - PLAYER_H
        player.vy = 0
        player.onGround = true
        break
      }
    }
  } else if (player.vy < 0) {
    const r = Math.floor(player.y / TILE)
    // Bump the block nearest the player's centre, like the classics.
    const centre = Math.floor((player.x + PLAYER_W / 2) / TILE)
    const hits = [centre, left, right].filter((col) => isSolid(tileAt(state, col, r)))
    if (hits.length) {
      player.y = (r + 1) * TILE
      player.vy = 0
      bumpBlock(state, hits[0], r)
    }
  }
}

function moveEnemy(state: CrateRunState, enemy: Enemy, dt: number) {
  enemy.vy = Math.min(MAX_FALL, enemy.vy + GRAVITY * dt)
  enemy.x += enemy.vx * dt
  const midRow = Math.floor((enemy.y + ENEMY_SIZE / 2) / TILE)
  const frontCol = Math.floor((enemy.vx > 0 ? enemy.x + ENEMY_SIZE : enemy.x) / TILE)
  if (isSolid(tileAt(state, frontCol, midRow))) {
    enemy.x = enemy.vx > 0 ? frontCol * TILE - ENEMY_SIZE : (frontCol + 1) * TILE
    enemy.vx *= -1
  }

  enemy.y += enemy.vy * dt
  const footRow = Math.floor((enemy.y + ENEMY_SIZE) / TILE)
  const leftCol = Math.floor(enemy.x / TILE)
  const rightCol = Math.floor((enemy.x + ENEMY_SIZE - 0.01) / TILE)
  let grounded = false
  for (let col = leftCol; col <= rightCol; col++) {
    const tile = tileAt(state, col, footRow)
    if (isSolid(tile) || tile === "=") {
      enemy.y = footRow * TILE - ENEMY_SIZE
      enemy.vy = 0
      grounded = true
      break
    }
  }

  // Patrol their stretch of sidewalk rather than walking into the pits.
  if (grounded) {
    const aheadCol = Math.floor((enemy.vx > 0 ? enemy.x + ENEMY_SIZE + 1 : enemy.x - 1) / TILE)
    const below = tileAt(state, aheadCol, footRow)
    if (!isSolid(below) && below !== "=") enemy.vx *= -1
  }
}

export function stepCrateRun(state: CrateRunState, input: CrateRunInput, dt: number) {
  state.time += dt
  for (const bump of state.bumps) bump.t += dt
  state.bumps = state.bumps.filter((bump) => bump.t < 0.22)
  for (const pickup of state.pickups) if (pickup.popped !== undefined) pickup.popped += dt
  for (const enemy of state.enemies) if (!enemy.alive && enemy.squash > 0) enemy.squash -= dt
  if (state.phase !== "playing") return

  state.elapsed += dt
  const player = state.player
  player.grace = Math.max(0, player.grace - dt)

  const direction = Number(input.right) - Number(input.left)
  if (direction !== 0) {
    const accel = player.onGround ? GROUND_ACCEL : AIR_ACCEL
    player.vx = Math.max(-RUN_SPEED, Math.min(RUN_SPEED, player.vx + direction * accel * dt))
    player.facing = direction > 0 ? 1 : -1
  } else if (player.onGround) {
    const slow = FRICTION * dt
    player.vx = Math.abs(player.vx) <= slow ? 0 : player.vx - Math.sign(player.vx) * slow
  }

  if (input.jump && !player.jumpHeld) player.jumpBuffer = JUMP_BUFFER
  else player.jumpBuffer = Math.max(0, player.jumpBuffer - dt)
  player.coyote = player.onGround ? COYOTE_TIME : Math.max(0, player.coyote - dt)
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -JUMP_VELOCITY
    player.jumpBuffer = 0
    player.coyote = 0
    player.onGround = false
  }
  // Releasing early gives a short hop.
  if (!input.jump && player.vy < -JUMP_CUT_VELOCITY) player.vy = -JUMP_CUT_VELOCITY
  player.jumpHeld = input.jump

  player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt)
  movePlayer(state, dt)
  player.walk = player.onGround && Math.abs(player.vx) > 8 ? player.walk + dt * Math.abs(player.vx) : 0

  if (player.y > VIEW_H + 24) {
    respawn(state)
    return
  }

  for (const pickup of state.pickups) {
    if (!pickup.taken && overlaps(player.x, player.y, PLAYER_W, PLAYER_H, pickup.x, pickup.y, 10, 10)) {
      pickup.taken = true
      state.records += 1
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    if (!enemy.active && enemy.x < state.cameraX + VIEW_W + 24) enemy.active = true
    if (!enemy.active) continue
    moveEnemy(state, enemy, dt)
    if (!overlaps(player.x, player.y, PLAYER_W, PLAYER_H, enemy.x, enemy.y, ENEMY_SIZE, ENEMY_SIZE)) continue
    const falling = player.vy > 0 && player.y + PLAYER_H - enemy.y < 8
    if (falling) {
      enemy.alive = false
      enemy.squash = 0.45
      player.vy = input.jump ? -JUMP_VELOCITY * 0.95 : -STOMP_BOUNCE
      state.stomps += 1
    } else if (player.grace <= 0) {
      respawn(state)
      return
    }
  }

  CHECKPOINT_COLUMNS.forEach((col, index) => {
    if (index > state.checkpoint && player.x >= col * TILE) {
      state.checkpoint = index
      state.checkpointsLit[index] = true
    }
  })

  const target = player.x + PLAYER_W / 2 - VIEW_W * 0.42
  state.cameraX = Math.max(0, Math.min(LEVEL_W - VIEW_W, target))

  if (player.onGround && player.x + PLAYER_W >= GOAL_COLUMN * TILE + 2) {
    state.phase = "cleared"
    player.vx = 0
  }
}

/** Crate depth grows with what you found on the way: 5 sleeves plus one per 2 records. */
export function crateSizeFor(records: number) {
  return Math.min(12, 5 + Math.floor(records / 2))
}
