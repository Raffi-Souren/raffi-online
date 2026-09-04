export type SnakeDirection = "UP" | "DOWN" | "LEFT" | "RIGHT"
export interface GridPoint {
  x: number
  y: number
}

const OPPOSITE: Record<SnakeDirection, SnakeDirection> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" }

export function availableSnakeCells(snake: GridPoint[], obstacles: GridPoint[], size = 400, cell = 20): GridPoint[] {
  if (!Number.isFinite(size) || !Number.isFinite(cell) || size <= 0 || cell <= 0) return []
  const occupied = new Set([...snake, ...obstacles].map((point) => `${point.x},${point.y}`))
  const available: GridPoint[] = []
  const cells = Math.floor(size / cell)
  for (let row = 0; row < cells; row++) {
    for (let column = 0; column < cells; column++) {
      const point = { x: column * cell, y: row * cell }
      if (!occupied.has(`${point.x},${point.y}`)) available.push(point)
    }
  }
  return available
}

export function chooseSnakeFood(
  snake: GridPoint[],
  obstacles: GridPoint[],
  size = 400,
  cell = 20,
  random: () => number = Math.random,
): GridPoint | null {
  const available = availableSnakeCells(snake, obstacles, size, cell)
  if (available.length === 0) return null
  return available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))]
}

export function placeSnakeObstacles(
  count: number,
  snake: GridPoint[],
  food: GridPoint | null = null,
  size = 400,
  cell = 20,
  random: () => number = Math.random,
): GridPoint[] {
  const candidates = availableSnakeCells(snake, food ? [food] : [], size, cell).filter(
    (point) =>
      !snake.some((segment) => Math.abs(segment.x - point.x) < cell * 3 && Math.abs(segment.y - point.y) < cell * 3),
  )
  const obstacles: GridPoint[] = []
  const limit = Math.min(Math.max(0, Math.floor(count)), candidates.length)
  for (let i = 0; i < limit; i++) {
    const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))
    obstacles.push(candidates.splice(index, 1)[0])
  }
  return obstacles
}

export function queueSnakeTurn(
  current: SnakeDirection,
  queued: SnakeDirection[],
  next: SnakeDirection,
): SnakeDirection[] {
  const previous = queued[queued.length - 1] ?? current
  if (queued.length >= 2 || next === previous || next === OPPOSITE[previous]) return queued
  return [...queued, next]
}

export function moveSnake(
  snake: GridPoint[],
  direction: SnakeDirection,
  food: GridPoint,
  obstacles: GridPoint[],
  size = 400,
  cell = 20,
) {
  const head = { ...snake[0] }
  if (direction === "UP") head.y -= cell
  if (direction === "DOWN") head.y += cell
  if (direction === "LEFT") head.x -= cell
  if (direction === "RIGHT") head.x += cell
  const grows = head.x === food.x && head.y === food.y
  const occupied = grows ? snake : snake.slice(0, -1)
  const collision =
    head.x < 0 ||
    head.y < 0 ||
    head.x >= size ||
    head.y >= size ||
    occupied.some((point) => point.x === head.x && point.y === head.y) ||
    obstacles.some((point) => point.x === head.x && point.y === head.y)
  return { collision, grows, snake: collision ? snake : [head, ...(grows ? snake : snake.slice(0, -1))] }
}

export function releaseBrickBall(
  ball: { x: number; y: number; dx: number; dy: number; heldSpeed?: number },
  fallbackSpeed: number,
  launchY: number,
) {
  const speed = Math.max(1, ball.heldSpeed ?? fallbackSpeed * Math.SQRT2)
  ball.dx = speed * 0.25
  ball.dy = -Math.sqrt(speed * speed - ball.dx * ball.dx)
  ball.y = Math.min(ball.y, launchY)
  delete ball.heldSpeed
}

export interface ParachuteState {
  player: GridPoint
  helicopters: { x: number; y: number; direction: number }[]
  missiles: GridPoint[]
  lives: number
  score: number
  landings: number
  spawnClock: number
  invulnerable: number
}
export interface ParachuteConfig {
  level: number
  heliSpeed: number
  missileSpeed: number
  spawnRate: number
}
export function createParachute(): ParachuteState {
  return {
    player: { x: 200, y: 50 },
    helicopters: [],
    missiles: [],
    lives: 3,
    score: 0,
    landings: 0,
    spawnClock: 0,
    invulnerable: 0,
  }
}

/** One 16ms step; React only renders the result, so Strict Mode cannot duplicate hits or rewards. */
export function stepParachute(
  state: ParachuteState,
  left: boolean,
  right: boolean,
  config: ParachuteConfig,
  random: () => number = Math.random,
) {
  if (state.lives <= 0) return
  state.invulnerable = Math.max(0, state.invulnerable - 16)
  state.spawnClock += 16
  if (state.spawnClock >= config.spawnRate) {
    state.spawnClock -= config.spawnRate
    const fromLeft = random() < 0.5
    state.helicopters.push({ x: fromLeft ? -32 : 432, y: random() * 120 + 40, direction: fromLeft ? 1 : -1 })
  }
  state.player = {
    x: Math.max(14, Math.min(386, state.player.x + (Number(right) - Number(left)) * 4)),
    y: state.player.y + 2.5,
  }
  state.helicopters = state.helicopters
    .map((helicopter) => ({ ...helicopter, x: helicopter.x + helicopter.direction * config.heliSpeed }))
    .filter((helicopter) => helicopter.x > -60 && helicopter.x < 460)
  for (const helicopter of state.helicopters) {
    if (random() < 0.025 + config.level * 0.005) state.missiles.push({ x: helicopter.x + 16, y: helicopter.y + 14 })
  }
  state.missiles = state.missiles
    .map((missile) => ({ ...missile, y: missile.y + config.missileSpeed }))
    .filter((missile) => missile.y < 500)
  const hit =
    state.invulnerable === 0 &&
    state.missiles.some(
      (missile) =>
        missile.x < state.player.x + 14 &&
        missile.x + 8 > state.player.x - 14 &&
        missile.y < state.player.y + 14 &&
        missile.y + 8 > state.player.y - 14,
    )
  if (hit) {
    state.lives--
    state.player = { x: 200, y: 50 }
    state.invulnerable = 1000
    state.missiles = []
  } else if (state.player.y >= 441) {
    state.score += 10 + config.level * 5
    state.landings++
    state.player = { x: 200, y: 50 }
  }
}
