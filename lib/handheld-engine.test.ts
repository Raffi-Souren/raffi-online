import { test } from "node:test"
import assert from "node:assert/strict"
import {
  availableSnakeCells,
  chooseSnakeFood,
  createParachute,
  moveSnake,
  placeSnakeObstacles,
  queueSnakeTurn,
  releaseBrickBall,
  stepParachute,
  type SnakeDirection,
} from "./handheld-engine"

test("Snake food uses an available cell even when all other cells are occupied", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ]
  const obstacles = [{ x: 0, y: 20 }]
  assert.deepEqual(availableSnakeCells(snake, obstacles, 40), [{ x: 20, y: 20 }])
  assert.deepEqual(
    chooseSnakeFood(snake, obstacles, 40, 20, () => 0),
    { x: 20, y: 20 },
  )
  assert.deepEqual(
    chooseSnakeFood(snake, obstacles, 40, 20, () => 1),
    { x: 20, y: 20 },
  )
})

test("Snake filling the last cell finishes with no further food to spawn", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 0, y: 20 },
    { x: 20, y: 20 },
  ]
  const next = moveSnake(snake, "RIGHT", { x: 20, y: 0 }, [], 40)
  assert.equal(next.collision, false)
  assert.equal(next.grows, true)
  assert.equal(next.snake.length, 4)
  assert.equal(chooseSnakeFood(next.snake, [], 40), null)
})

test("Snake level obstacles preserve food and stop when safe cells are exhausted", () => {
  const snake = [{ x: 0, y: 0 }]
  const food = { x: 60, y: 60 }
  const obstacles = placeSnakeObstacles(100, snake, food, 80, 20, () => 0)
  assert.equal(obstacles.length, 6)
  assert.equal(new Set(obstacles.map((point) => `${point.x},${point.y}`)).size, obstacles.length)
  assert.ok(obstacles.every((point) => point.x >= 60 || point.y >= 60))
  assert.ok(obstacles.every((point) => point.x !== food.x || point.y !== food.y))
  assert.deepEqual(placeSnakeObstacles(100, [{ x: 20, y: 20 }], null, 60), [])
  assert.deepEqual(placeSnakeObstacles(100, availableSnakeCells([], [])), [])
})

test("rapid Snake turns are consumed on separate ticks without reversing into the neck", () => {
  let turns: SnakeDirection[] = []
  turns = queueSnakeTurn("RIGHT", turns, "UP")
  turns = queueSnakeTurn("RIGHT", turns, "LEFT")
  assert.deepEqual(turns, ["UP", "LEFT"])
  let snake = [
    { x: 100, y: 100 },
    { x: 80, y: 100 },
    { x: 60, y: 100 },
  ]
  const first = moveSnake(snake, turns.shift()!, { x: 300, y: 300 }, [])
  assert.equal(first.collision, false)
  assert.deepEqual(first.snake[0], { x: 100, y: 80 })
  snake = first.snake
  const second = moveSnake(snake, turns.shift()!, { x: 300, y: 300 }, [])
  assert.equal(second.collision, false)
  assert.deepEqual(second.snake[0], { x: 80, y: 80 })
})

test("Snake rejects reversal, repeated direction and input-buffer overflow", () => {
  assert.deepEqual(queueSnakeTurn("RIGHT", [], "LEFT"), [])
  assert.deepEqual(queueSnakeTurn("RIGHT", ["UP"], "DOWN"), ["UP"])
  assert.deepEqual(queueSnakeTurn("RIGHT", ["UP"], "UP"), ["UP"])
  assert.deepEqual(queueSnakeTurn("RIGHT", ["UP", "LEFT"], "DOWN"), ["UP", "LEFT"])
})

test("Snake can enter the departing tail cell only when it is not growing", () => {
  const snake = [
    { x: 20, y: 20 },
    { x: 20, y: 40 },
    { x: 0, y: 40 },
    { x: 0, y: 20 },
  ]
  const moved = moveSnake(snake, "LEFT", { x: 100, y: 100 }, [])
  assert.equal(moved.collision, false)
  assert.equal(moved.snake.length, 4)
  assert.equal(moveSnake(snake, "LEFT", { x: 0, y: 20 }, []).collision, true)
})

test("Snake growth, wall, body and obstacle collisions remain correct", () => {
  const snake = [
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ]
  assert.equal(moveSnake(snake, "RIGHT", { x: 40, y: 20 }, []).snake.length, 3)
  assert.equal(moveSnake([{ x: 0, y: 0 }], "UP", { x: 40, y: 40 }, []).collision, true)
  assert.equal(moveSnake(snake, "RIGHT", { x: 100, y: 100 }, [{ x: 40, y: 20 }]).collision, true)
  assert.equal(moveSnake([...snake, { x: 0, y: 40 }], "LEFT", { x: 100, y: 100 }, []).collision, true)
})

test("releasing a caught Brick ball restores speed and places it above the paddle", () => {
  const ball = { x: 100, y: 590, dx: 0, dy: 0, heldSpeed: 5 }
  releaseBrickBall(ball, 2, 575)
  assert.ok(ball.dy < 0)
  assert.ok(Math.abs(Math.hypot(ball.dx, ball.dy) - 5) < 0.001)
  assert.equal(ball.y, 575)
  assert.equal(ball.heldSpeed, undefined)
  const legacy = { x: 100, y: 590, dx: 0, dy: 0 }
  releaseBrickBall(legacy, 2, 575)
  assert.ok(legacy.dy < -1)
})

const config = { level: 1, heliSpeed: 2, missileSpeed: 3, spawnRate: 2000 }

test("one Parachute landing awards points once and resets the descent", () => {
  const game = createParachute()
  game.player.y = 440
  stepParachute(game, false, false, config, () => 1)
  assert.equal(game.landings, 1)
  assert.equal(game.score, 15)
  assert.deepEqual(game.player, { x: 200, y: 50 })
  stepParachute(game, false, false, config, () => 1)
  assert.equal(game.landings, 1)
  assert.equal(game.score, 15)
})

test("overlapping Parachute missiles cost one life and respawn grace prevents immediate hits", () => {
  const game = createParachute()
  game.missiles = [
    { x: 200, y: 50 },
    { x: 202, y: 50 },
    { x: 198, y: 50 },
  ]
  stepParachute(game, false, false, config, () => 1)
  assert.equal(game.lives, 2)
  assert.equal(game.missiles.length, 0)
  game.missiles = [{ x: 200, y: 50 }]
  stepParachute(game, false, false, config, () => 1)
  assert.equal(game.lives, 2)
})

test("Parachute helicopters enter from both edges instead of flying away", () => {
  for (const randomValue of [0, 1]) {
    const game = createParachute()
    game.spawnClock = 2000
    stepParachute(game, false, false, config, () => randomValue)
    assert.equal(game.helicopters.length, 1)
    assert.equal(game.helicopters[0].direction, randomValue === 0 ? 1 : -1)
  }
})

test("Parachute steering is bounded and a finished run stops simulating", () => {
  const game = createParachute()
  for (let i = 0; i < 200; i++) stepParachute(game, true, false, config, () => 1)
  assert.ok(game.player.x >= 14)
  game.lives = 0
  const before = JSON.stringify(game)
  stepParachute(game, false, true, config, () => 0)
  assert.equal(JSON.stringify(game), before)
})
