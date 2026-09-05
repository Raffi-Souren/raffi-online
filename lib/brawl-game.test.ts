import { test } from "node:test"
import assert from "node:assert/strict"
import { ARENA_END, createBrawl, stepBrawl, type BrawlInput } from "./brawl-game"

const idle: BrawlInput = { x: 0, y: 0, attack: false, jump: false, dodge: false }
function advance(game: ReturnType<typeof createBrawl>, input: BrawlInput, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) stepBrawl(game, input, 1 / 60)
}

test("all five blocks and both bosses can be beaten using normal combat inputs", () => {
  const game = createBrawl()
  game.status = "playing"
  for (let i = 0; i < 60 * 180 && game.status === "playing"; i++) {
    const target = [...game.enemies].sort((a, b) => Math.abs(a.x - game.player.x) - Math.abs(b.x - game.player.x))[0]
    const dx = target ? target.x - game.player.x : 200
    const dy = target ? target.y - game.player.y : 0
    stepBrawl(
      game,
      {
        x: Math.abs(dx) > 58 || Math.sign(dx) !== game.player.facing ? Math.sign(dx) : 0,
        y: Math.abs(dy) > 5 ? Math.sign(dy) : 0,
        attack: Boolean(target),
        jump: Boolean(target),
        dodge: false,
      },
      1 / 60,
    )
  }
  assert.equal(game.status, "won")
  assert.equal(game.wave, 4)
  assert.equal(game.enemies.length, 0)
  assert.ok(game.player.health > 0)
  assert.ok(game.player.x >= ARENA_END - 90)
  assert.ok(game.score >= 2200)
})

test("enemy attacks telegraph before dealing damage", () => {
  const game = createBrawl()
  game.status = "playing"
  game.enemies = [game.enemies[0]]
  Object.assign(game.enemies[0], { x: game.player.x + 40, y: game.player.y, cooldown: 0 })
  stepBrawl(game, idle, 1 / 60)
  assert.ok(game.enemies[0].windup > 0.6)
  assert.equal(game.player.health, 100)
  advance(game, idle, 0.5)
  assert.equal(game.player.health, 100)
  advance(game, idle, 0.2)
  assert.equal(game.player.health, 91)
})

test("jumping or dodging avoids a telegraphed strike", () => {
  for (const action of ["jump", "dodge"] as const) {
    const game = createBrawl()
    game.status = "playing"
    game.enemies = [game.enemies[0]]
    Object.assign(game.enemies[0], { x: game.player.x + 40, y: game.player.y, cooldown: 0, windup: 0.1 })
    advance(game, { ...idle, [action]: true }, 0.2)
    assert.equal(game.player.health, 100, `${action} should avoid damage`)
  }
})

test("attacks respect facing, lane, range and cooldown", () => {
  const game = createBrawl()
  game.status = "playing"
  game.enemies = [game.enemies[0]]
  const enemy = game.enemies[0]
  Object.assign(enemy, { x: game.player.x - 50, y: game.player.y, cooldown: 10 })
  stepBrawl(game, { ...idle, attack: true }, 1 / 60)
  assert.equal(enemy.health, 52)
  game.attackCooldown = 0
  game.player.facing = -1
  stepBrawl(game, { ...idle, attack: true }, 1 / 60)
  assert.equal(enemy.health, 32)
  stepBrawl(game, { ...idle, attack: true }, 1 / 60)
  assert.equal(enemy.health, 32)
  game.attackCooldown = 0
  enemy.y = game.player.y - 60
  stepBrawl(game, { ...idle, attack: true }, 1 / 60)
  assert.equal(enemy.health, 32)
})

test("enemy gates prevent skipping blocks and pause freezes the whole encounter", () => {
  const game = createBrawl()
  game.status = "playing"
  game.player.x = 919
  advance(game, { ...idle, x: 1 }, 1)
  assert.ok(game.player.x <= 920)
  assert.equal(game.wave, 0)
  game.status = "paused"
  const before = JSON.stringify(game)
  advance(game, { ...idle, attack: true, x: 1 }, 20)
  assert.equal(JSON.stringify(game), before)
})

test("defeat is reachable, freezes the game, and a fresh run resets all state", () => {
  const game = createBrawl()
  game.status = "playing"
  advance(game, idle, 70)
  assert.equal(game.status, "lost")
  assert.equal(game.player.health, 0)
  const time = game.elapsed
  advance(game, { ...idle, attack: true }, 2)
  assert.equal(game.elapsed, time)
  const fresh = createBrawl()
  assert.equal(fresh.player.health, 100)
  assert.equal(fresh.score, 0)
  assert.equal(fresh.wave, 0)
})

test("record crates require an in-range punch and reward discovery only once", () => {
  const game = createBrawl()
  game.status = "playing"
  game.enemies = []
  const secret = game.secrets[0]
  Object.assign(game.player, { x: secret.x - 30, y: secret.y, health: 40 })
  stepBrawl(game, idle, 1 / 60)
  assert.equal(secret.found, false)
  stepBrawl(game, { ...idle, attack: true }, 1 / 60)
  assert.equal(secret.found, true)
  assert.equal(game.player.health, 65)
  assert.equal(game.score, 300)
  advance(game, { ...idle, attack: true }, 2)
  assert.equal(game.score, 300)
  assert.equal(
    createBrawl().secrets.some((item) => item.found),
    false,
  )
})
