export type BrawlStatus = "ready" | "playing" | "paused" | "won" | "lost"
export interface BrawlInput {
  x: number
  y: number
  attack: boolean
  jump: boolean
  dodge: boolean
}
export interface Fighter {
  x: number
  y: number
  health: number
  facing: number
  hurt: number
}
export interface Brawler extends Fighter {
  id: number
  boss: boolean
  windup: number
  cooldown: number
  attacking: number
}
export interface BrawlState {
  status: BrawlStatus
  player: Fighter
  jumpHeight: number
  jumpVelocity: number
  dodge: number
  dodgeCooldown: number
  attack: number
  attackCooldown: number
  combo: number
  comboClock: number
  score: number
  elapsed: number
  wave: number
  transition: number
  enemies: Brawler[]
  hits: { x: number; y: number; time: number; text: string }[]
  healthDrops: { x: number; y: number }[]
  camera: number
}

export const BRAWL_WAVES = ["Subway steps", "Record row", "Rooftop soundcheck"]
export const ARENA_END = 2650

function spawnWave(wave: number): Brawler[] {
  const base = [420, 1200, 2110][wave]
  return Array.from({ length: wave === 2 ? 3 : 3 + wave }, (_, i) => ({
    id: wave * 10 + i,
    x: base + i * 85,
    y: 330 + (i % 3) * 36,
    health: wave === 2 && i === 0 ? 210 : 52 + wave * 7,
    facing: -1,
    hurt: 0,
    boss: wave === 2 && i === 0,
    windup: 0,
    cooldown: 0.7 + i * 0.3,
    attacking: 0,
  }))
}

export function createBrawl(): BrawlState {
  return {
    status: "ready",
    player: { x: 160, y: 375, health: 100, facing: 1, hurt: 0 },
    jumpHeight: 0,
    jumpVelocity: 0,
    dodge: 0,
    dodgeCooldown: 0,
    attack: 0,
    attackCooldown: 0,
    combo: 0,
    comboClock: 0,
    score: 0,
    elapsed: 0,
    wave: 0,
    transition: 0,
    enemies: spawnWave(0),
    hits: [],
    healthDrops: [],
    camera: 0,
  }
}

export function stepBrawl(game: BrawlState, input: BrawlInput, delta: number) {
  if (game.status !== "playing") return
  const dt = Math.max(0, Math.min(delta, 0.05))
  const player = game.player
  game.elapsed += dt
  player.hurt = Math.max(0, player.hurt - dt)
  game.attack = Math.max(0, game.attack - dt)
  game.attackCooldown = Math.max(0, game.attackCooldown - dt)
  game.dodge = Math.max(0, game.dodge - dt)
  game.dodgeCooldown = Math.max(0, game.dodgeCooldown - dt)
  game.comboClock = Math.max(0, game.comboClock - dt)
  if (game.comboClock === 0) game.combo = 0
  game.hits.forEach((hit) => {
    hit.time -= dt
  })
  game.hits = game.hits.filter((hit) => hit.time > 0)

  if (input.x !== 0) player.facing = Math.sign(input.x)
  if (input.jump && game.jumpHeight === 0 && game.dodge === 0) game.jumpVelocity = 420
  if (game.jumpVelocity !== 0 || game.jumpHeight > 0) {
    game.jumpHeight = Math.max(0, game.jumpHeight + game.jumpVelocity * dt)
    game.jumpVelocity -= 1150 * dt
    if (game.jumpHeight === 0) game.jumpVelocity = 0
  }
  if (input.dodge && game.dodgeCooldown === 0 && game.jumpHeight === 0) {
    game.dodge = 0.32
    game.dodgeCooldown = 1.15
  }
  const movement = game.dodge > 0 ? 390 : game.attack > 0 ? 80 : 180
  const moveX = game.dodge > 0 ? player.facing : Math.max(-1, Math.min(1, input.x))
  player.x = Math.max(35, Math.min(ARENA_END, player.x + moveX * movement * dt))
  player.y = Math.max(308, Math.min(435, player.y + Math.max(-1, Math.min(1, input.y)) * 125 * dt))
  const waveGate = [920, 1800, ARENA_END][game.wave]
  if (game.enemies.length > 0) player.x = Math.min(waveGate, player.x)
  game.camera += (Math.max(0, Math.min(ARENA_END - 880, player.x - 320)) - game.camera) * Math.min(1, dt * 7)

  if (input.attack && game.attackCooldown === 0 && game.dodge === 0) {
    game.attack = 0.18
    game.attackCooldown = 0.3
    const jumping = game.jumpHeight > 18
    let landed = false
    for (const enemy of game.enemies) {
      const dx = enemy.x - player.x
      if (Math.abs(dx) < (jumping ? 102 : 84) && dx * player.facing > -12 && Math.abs(enemy.y - player.y) < 38) {
        landed = true
        const damage = jumping ? 27 : game.combo % 3 === 2 ? 32 : 20
        enemy.health -= damage
        enemy.hurt = 0.2
        enemy.x += player.facing * (enemy.boss ? 8 : 20)
        if (!enemy.boss) enemy.windup = 0
        enemy.cooldown = Math.max(enemy.cooldown, 0.42)
        game.hits.push({
          x: enemy.x,
          y: enemy.y - 62,
          time: 0.6,
          text: jumping ? "Kick!" : game.combo % 3 === 2 ? "Pow!" : `${damage}`,
        })
        game.score += 10
      }
    }
    if (landed) {
      game.combo++
      game.comboClock = 1.6
    }
  }

  for (const enemy of game.enemies) {
    if (enemy.health <= 0) continue
    enemy.hurt = Math.max(0, enemy.hurt - dt)
    enemy.cooldown = Math.max(0, enemy.cooldown - dt)
    enemy.attacking = Math.max(0, enemy.attacking - dt)
    enemy.facing = player.x >= enemy.x ? 1 : -1
    if (enemy.windup > 0) {
      enemy.windup = Math.max(0, enemy.windup - dt)
      if (enemy.windup === 0) {
        enemy.attacking = 0.2
        enemy.cooldown = enemy.boss ? 1.5 : 1.1
        const range = enemy.boss ? 135 : 62
        if (
          Math.abs(player.x - enemy.x) < range &&
          Math.abs(player.y - enemy.y) < (enemy.boss ? 70 : 34) &&
          game.jumpHeight < 25 &&
          game.dodge === 0 &&
          player.hurt === 0
        ) {
          player.health = Math.max(0, player.health - (enemy.boss ? 19 : 9))
          player.hurt = 0.7
          player.x = Math.max(35, Math.min(ARENA_END, player.x + enemy.facing * 25))
          game.combo = 0
        }
      }
    } else if (enemy.hurt === 0) {
      const dx = player.x - enemy.x
      const dy = player.y - enemy.y
      if (Math.abs(dx) < (enemy.boss ? 108 : 51) && Math.abs(dy) < 26 && enemy.cooldown === 0) {
        enemy.windup = enemy.boss ? 0.95 : 0.65
      } else if (Math.abs(dx) > (enemy.boss ? 85 : 44)) {
        enemy.x += Math.sign(dx) * (enemy.boss ? 61 : 78 + game.wave * 5) * dt
      }
      if (Math.abs(dy) > 10) enemy.y += Math.sign(dy) * 54 * dt
    }
  }
  for (const defeated of game.enemies.filter((enemy) => enemy.health <= 0)) {
    game.score += defeated.boss ? 1000 : 150
    if (defeated.id % 2 === 0) game.healthDrops.push({ x: defeated.x, y: defeated.y })
  }
  game.enemies = game.enemies.filter((enemy) => enemy.health > 0)
  game.healthDrops = game.healthDrops.filter((drop) => {
    if (Math.abs(drop.x - player.x) < 40 && Math.abs(drop.y - player.y) < 35) {
      player.health = Math.min(100, player.health + 18)
      game.hits.push({ x: player.x, y: player.y - 95, time: 0.9, text: "+18" })
      return false
    }
    return true
  })

  if (player.health <= 0) {
    game.status = "lost"
    return
  }
  if (game.enemies.length === 0) {
    if (game.wave === 2) {
      if (player.x >= ARENA_END - 90) game.status = "won"
    } else {
      game.transition += dt
      if (game.transition > 1.2 && player.x > [730, 1630][game.wave]) {
        game.wave++
        game.transition = 0
        game.enemies = spawnWave(game.wave)
        player.health = Math.min(100, player.health + 18)
      }
    }
  }
}
