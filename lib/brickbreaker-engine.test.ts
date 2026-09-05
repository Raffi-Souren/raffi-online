import { test } from "node:test"
import assert from "node:assert/strict"
import {
  BRICK_LEVELS,
  FIELD,
  collectBrickPickup,
  createBrickbreaker,
  makeBrickBoard,
  nextBrickLevel,
  pauseBrickbreaker,
  startBrickbreaker,
  stepBrickbreaker,
  type BrickRun,
} from "./brickbreaker-engine"

const running = (level = 1) => {
  const g = createBrickbreaker(level)
  startBrickbreaker(g)
  stepBrickbreaker(g, { fire: true }, 1 / 60)
  return g
}
const advance = (g: BrickRun, seconds: number, hz = 60) => {
  for (let i = 0; i < Math.round(seconds * hz); i++) stepBrickbreaker(g, {}, 1 / hz)
}

test("34 original boards are deterministic, distinct, bounded and have reachable breakable cells", () => {
  assert.equal(BRICK_LEVELS.length, 34)
  assert.equal(new Set(BRICK_LEVELS.map(([, map]) => map)).size, 34)
  for (let level = 1; level <= 34; level++) {
    const board = makeBrickBoard(level)
    assert.deepEqual(board, makeBrickBoard(level))
    assert.ok(board.some((b) => !b.steel))
    assert.ok(board.every((b) => b.x >= 0 && b.x + b.w <= FIELD.width && b.y + b.h < 300 && b.hp > 0))
    assert.ok(board.some((b) => b.drop))
    // Flood the board from below, allowing passage through destructible bricks.
    // No brick may be sealed in a pocket of indestructible steel.
    const steel = new Set(board.filter((b) => b.steel).map((b) => b.id))
    const seen = new Set<number>(),
      queue = Array.from({ length: 9 }, (_, c) => 8 * 9 + c)
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id) || steel.has(id)) continue
      seen.add(id)
      const r = Math.floor(id / 9),
        c = id % 9
      if (r > 0) queue.push(id - 9)
      if (r < 8) queue.push(id + 9)
      if (c > 0) queue.push(id - 1)
      if (c < 8) queue.push(id + 1)
    }
    assert.ok(
      board.filter((b) => !b.steel).every((b) => seen.has(b.id)),
      `sealed brick on level ${level}`,
    )
  }
})
test("fixed simulation stays identical at 30, 60 and 144 Hz", () => {
  const runs = [30, 60, 144].map((hz) => {
    const g = running()
    for (let i = 0; i < hz * 3; i++) stepBrickbreaker(g, { target: 240 }, 1 / hz)
    return g
  })
  for (const g of runs.slice(1)) {
    assert.equal(g.score, runs[0].score)
    assert.equal(g.lives, runs[0].lives)
    assert.ok(Math.abs(g.balls[0].x - runs[0].balls[0].x) < 1e-6)
    assert.ok(Math.abs(g.balls[0].y - runs[0].balls[0].y) < 1e-6)
  }
})
test("serve waits explicitly, launch angle is honored, and keyboard speed is bounded", () => {
  const g = createBrickbreaker()
  startBrickbreaker(g)
  stepBrickbreaker(g, { move: 1, aim: 1 }, 0.1)
  assert.equal(g.phase, "serve")
  assert.equal(g.balls[0].held, true)
  assert.equal(g.paddle, 222)
  g.aim = 0.75
  stepBrickbreaker(g, { fire: true }, 1 / 60)
  assert.equal(g.phase, "playing")
  assert.ok(g.balls[0].vx > 0)
  assert.ok(g.balls[0].vy < 0)
})
test("swept contacts break the correct side without tunneling through armor", () => {
  const g = running(4),
    b = g.bricks.find((b) => b.hp === 2)!
  g.bricks = [b, { ...b, id: 1000, x: 300, y: 200 }]
  const ball = g.balls[0]
  Object.assign(ball, { x: b.x - FIELD.radius - 1, y: b.y + b.h / 2, vx: 2000, vy: 0, speed: 2000 })
  stepBrickbreaker(g, {}, 1 / 120)
  assert.equal(b.hp, 1)
  assert.ok(ball.vx < 0)
  assert.equal(g.score, 0)
})
test("paddle edge controls rebound angle and a below-paddle ball cannot be rescued", () => {
  const g = running(),
    b = g.balls[0]
  Object.assign(b, { x: g.paddle + 27, y: FIELD.paddleY - FIELD.radius - 1, vx: 0, vy: 210 })
  stepBrickbreaker(g, {}, 1 / 60)
  assert.ok(b.vx > 100 && b.vy < 0)
  Object.assign(b, { x: g.paddle, y: FIELD.paddleY + 20, vx: 0, vy: 300 })
  advance(g, 0.2)
  assert.equal(g.lives, 2)
  assert.equal(g.phase, "serve")
})
test("multiball costs exactly one life only after every ball is lost", () => {
  const g = running()
  collectBrickPickup(g, "multi")
  collectBrickPickup(g, "multi")
  assert.equal(g.balls.length, 3)
  g.balls[0].y = FIELD.height + 10
  stepBrickbreaker(g, {}, 1 / 60)
  assert.equal(g.lives, 3)
  assert.equal(g.balls.length, 2)
  for (const ball of g.balls) ball.y = FIELD.height + 10
  stepBrickbreaker(g, {}, 1 / 60)
  assert.equal(g.lives, 2)
  assert.equal(g.balls.length, 1)
  assert.equal(g.phase, "serve")
})
test("slow refresh never compounds speed; pause freezes timers, projectiles and scores", () => {
  const g = running(),
    speed = g.balls[0].speed
  collectBrickPickup(g, "slow")
  collectBrickPickup(g, "slow")
  collectBrickPickup(g, "laser")
  assert.equal(g.balls[0].speed, speed)
  pauseBrickbreaker(g, true)
  const saved = structuredClone(g)
  stepBrickbreaker(g, { fire: true, move: 1 }, 10)
  assert.deepEqual(g, saved)
  pauseBrickbreaker(g, false)
  stepBrickbreaker(g, {}, 0.1)
  assert.ok(g.powers.slow < 14 && g.powers.slow > 13.8)
})
test("catch power holds the ball until explicit release, even after its timer expires", () => {
  const g = running()
  collectBrickPickup(g, "catch")
  const ball = g.balls[0]
  Object.assign(ball, { x: g.paddle, y: FIELD.paddleY - FIELD.radius - 1, vx: 0, vy: 210 })
  stepBrickbreaker(g, {}, 1 / 60)
  assert.equal(ball.held, true)
  g.powers.catch = 0
  advance(g, 0.5)
  assert.equal(ball.held, true)
  stepBrickbreaker(g, { fire: true }, 1 / 60)
  assert.equal(ball.held, false)
})
test("laser respects steel, rockets consume ammo and splash only destructible bricks", () => {
  const g = running(6)
  g.balls[0].held = true
  g.bricks = [
    { id: 1, x: 170, y: 100, w: 36, h: 21, hp: 1, maxHp: 1, steel: true, flash: 0 },
    { id: 2, x: 132, y: 100, w: 36, h: 21, hp: 3, maxHp: 3, steel: false, flash: 0 },
    { id: 3, x: 50, y: 50, w: 36, h: 21, hp: 1, maxHp: 1, steel: false, flash: 0 },
  ]
  g.shots = [{ x: 180, y: 125, rocket: false }]
  advance(g, 0.1)
  assert.equal(g.bricks[0].hp, 1)
  assert.equal(g.bricks[1].hp, 3)
  g.shots = [{ x: 180, y: 125, rocket: true }]
  advance(g, 0.1)
  assert.equal(g.bricks[0].hp, 1)
  assert.equal(g.bricks[1].hp, 0)
  collectBrickPickup(g, "rocket")
  stepBrickbreaker(g, { fire: true }, 1 / 60) // release held ball first
  stepBrickbreaker(g, {}, 1 / 60)
  stepBrickbreaker(g, { fire: true }, 1 / 60)
  assert.equal(g.rockets, 2)
  advance(g, 0.5)
  assert.equal(g.rockets, 2)
})
test("capsules collect once; lives cap; clearing waits for all breakable bricks and transitions once", () => {
  const g = running()
  g.drops = [{ x: g.paddle, y: FIELD.paddleY - 8, kind: "life" }]
  advance(g, 0.05)
  assert.equal(g.lives, 4)
  advance(g, 0.05)
  assert.equal(g.lives, 4)
  for (let i = 0; i < 10; i++) collectBrickPickup(g, "life")
  assert.equal(g.lives, 9)
  g.bricks.forEach((b) => {
    if (!b.steel) b.hp = 0
  })
  stepBrickbreaker(g, {}, 1 / 60)
  assert.equal(g.phase, "cleared")
  const score = g.score
  advance(g, 1)
  assert.equal(g.score, score)
  nextBrickLevel(g)
  assert.equal(g.level, 2)
  assert.equal(g.score, score)
  assert.equal(g.lives, 9)
  assert.equal(g.phase, "serve")
  const last = running(34)
  last.bricks.forEach((b) => {
    if (!b.steel) b.hp = 0
  })
  stepBrickbreaker(last, {}, 1 / 60)
  assert.equal(last.phase, "won")
})
test("fresh runs clear transient state and ignore invalid time and pointer input", () => {
  const g = running()
  collectBrickPickup(g, "wide")
  collectBrickPickup(g, "rocket")
  const fresh = createBrickbreaker()
  assert.equal(fresh.powers.wide, 0)
  assert.equal(fresh.rockets, 0)
  assert.equal(fresh.score, 0)
  const before = structuredClone(g)
  stepBrickbreaker(g, {}, NaN)
  assert.deepEqual(g, before)
  stepBrickbreaker(g, { target: Infinity, move: NaN, aim: Infinity }, 1 / 60)
  assert.ok(Number.isFinite(g.paddle))
  assert.ok(Number.isFinite(g.aim))
})

test("a predictive paddle can clear the entire campaign through normal input without changing game state", () => {
  const g = createBrickbreaker()
  startBrickbreaker(g)
  const reflect = (x: number) => {
    const w = FIELD.width - 2 * FIELD.radius
    const u = (((x - FIELD.radius) % (w * 2)) + w * 2) % (w * 2)
    return FIELD.radius + (u > w ? 2 * w - u : u)
  }
  let steps = 0
  while (!["won", "over"].includes(g.phase) && steps < 120 * 60 * 80) {
    if (g.phase === "cleared") nextBrickLevel(g)
    const b = g.balls.find((b) => !b.held && b.vy > 0) || g.balls[0]
    let target = b.x
    if (b.vy > 0) target = reflect(b.x + b.vx * Math.max(0, (FIELD.paddleY - FIELD.radius - b.y) / b.vy))
    target += Math.sin(steps * 0.0017) * 19
    const fire = g.balls.some((b) => b.held) || g.powers.laser > 0 || (g.rockets > 0 && steps % 50 === 0)
    stepBrickbreaker(g, { target, fire }, 1 / 120)
    assert.ok(g.balls.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y)))
    steps++
  }
  assert.equal(g.phase, "won")
  assert.equal(g.level, 34)
  assert.ok(g.score > 50000)
})
