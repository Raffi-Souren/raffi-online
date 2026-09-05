import { ARENA_END, BRAWL_WAVES, type BrawlState, type Brawler } from "./brawl-game"

export function drawBrawl(ctx: CanvasRenderingContext2D, game: BrawlState, width: number, height: number) {
  const worldWidth = Math.max(480, (width / height) * 500)
  const worldHeight = (worldWidth * height) / width
  const offsetY = worldHeight - 500
  const camera = Math.max(0, Math.min(ARENA_END - worldWidth + 70, game.player.x - worldWidth * 0.33))
  ctx.setTransform(width / worldWidth, 0, 0, height / worldHeight, 0, 0)
  ctx.clearRect(0, 0, worldWidth, worldHeight)
  const sky = ctx.createLinearGradient(0, 0, 0, worldHeight)
  sky.addColorStop(0, "#8a87b0")
  sky.addColorStop(1, "#f3b49a")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, worldWidth, worldHeight)
  ctx.save()
  ctx.translate(0, offsetY)

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  const circle = (x: number, y: number, radius: number, color: string) => {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }
  const text = (label: string, x: number, y: number, size: number, color: string) => {
    ctx.font = `bold ${size}px 'Trebuchet MS', sans-serif`
    ctx.fillStyle = color
    ctx.fillText(label, x, y)
  }

  circle(worldWidth - 90 - camera * 0.03, 75, 39, "#f6d8b0")
  for (let i = -1; i < 18; i++) {
    const x = i * 120 - ((camera * 0.24) % 120)
    const towerHeight = 90 + (((i + 18) * 31) % 95)
    rect(x, 263 - towerHeight, 96, towerHeight, "#776f95")
    rect(x + 11, 252 - towerHeight, 62, 11, "#6b668a")
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        rect(x + 12 + col * 20, 276 - towerHeight + row * 26, 8, 12, "#af9fae")
      }
  }

  ctx.save()
  ctx.translate(-camera, 0)
  const shopNames = [
    "Fulton St",
    "BODEGA",
    "DEEP CUTS",
    "OPEN LATE",
    "VINYL & TAPES",
    "ROOFTOP RADIO",
    "GOOD NEIGHBORS",
    "THE SOUND SYSTEM",
  ]
  const shopColors = ["#547b86", "#b87d6c", "#78728f", "#8d6375"]
  for (let i = -1; i < 18; i++) {
    const x = i * 270
    if (x > camera + worldWidth + 270 || x < camera - 300) continue
    const color = shopColors[((i % 4) + 4) % 4]
    rect(x, 100, 264, 222, color)
    rect(x, 92, 264, 11, "#43485f")
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 5; col++) {
        rect(x + 18 + col * 47, 120 + row * 47, 28, 32, "#414c64")
        rect(x + 21 + col * 47, 123 + row * 47, 11, 26, "#f0ce9c")
        rect(x + 33 + col * 47, 123 + row * 47, 10, 26, "#c6ab9a")
      }
    rect(x + 12, 211, 240, 44, "#eee1be")
    text(shopNames[((i % 8) + 8) % 8], x + 23, 239, 20, "#465467")
    rect(x + 12, 255, 240, 67, "#3d445b")
    for (let j = 0; j < 8; j++) rect(x + 12 + j * 30, 255, 15, 14, "#e6a28d")
    rect(x + 163, 278, 59, 44, "#597383")
    rect(x + 17, 279, 131, 35, "#a3aea4")
    for (let record = 0; record < 3; record++) {
      circle(x + 39 + record * 43, 295, 13, "#3e455b")
      circle(x + 39 + record * 43, 295, 4, "#efbb80")
    }
    if (i % 2 === 0) {
      rect(x + 183, 75, 40, 20, "#514e66")
      rect(x + 178, 55, 50, 27, "#675a6b")
      ctx.fillStyle = "#484a60"
      ctx.beginPath()
      ctx.moveTo(x + 176, 55)
      ctx.lineTo(x + 203, 42)
      ctx.lineTo(x + 230, 55)
      ctx.fill()
    }
  }
  rect(camera, 321, worldWidth, 179, "#738295")
  rect(camera, 324, worldWidth, 5, "#e5cbb6")
  rect(camera, 450, worldWidth, 50, "#47566f")
  rect(camera, 447, worldWidth, 7, "#bdafae")
  ctx.strokeStyle = "#627287"
  ctx.lineWidth = 2
  for (let i = 0; i < 43; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 110, 329)
    ctx.lineTo(i * 110 - 40, 447)
    ctx.stroke()
  }
  for (const y of [365, 403]) {
    ctx.beginPath()
    ctx.moveTo(camera, y)
    ctx.lineTo(camera + worldWidth, y)
    ctx.stroke()
  }
  for (let i = 0; i < 25; i++) rect(i * 190, 480, 87, 4, "#a8a4ad")

  // Light strings make the recovered street read as a block party.
  ctx.strokeStyle = "#4d4b65"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(camera - 40, 69)
  ctx.quadraticCurveTo(camera + worldWidth / 2, 141, camera + worldWidth + 40, 69)
  ctx.stroke()
  for (let i = 0; i < 27; i++) {
    const x = i * 180
    const local = (x - camera) / worldWidth
    const y = 69 + Math.sin(local * Math.PI) * 36
    if (local < 0 || local > 1) continue
    circle(x, y, 4.5, ["#f6d39a", "#9bd9d3", "#f4b3b5"][i % 3])
  }
  rect(4300, 270, 90, 60, "#393a58")
  circle(4324, 292, 14, "#191f3a")
  circle(4367, 292, 14, "#191f3a")
  circle(4324, 292, 5, "#b1bdc5")
  circle(4367, 292, 5, "#b1bdc5")
  text("RADIO", 4310, 319, 13, "#f7d19b")

  for (const secret of game.secrets) {
    if (secret.found) continue
    rect(secret.x - 19, secret.y - 28, 38, 28, "#795747")
    rect(secret.x - 20, secret.y - 31, 40, 5, "#caac7f")
    circle(secret.x, secret.y - 14, 10, "#252a3d")
    circle(secret.x, secret.y - 14, 3, "#f2c974")
    if (Math.abs(game.player.x - secret.x) < 100) text("J", secret.x - 4, secret.y - 39, 14, "#fff1bc")
  }
  for (const drop of game.healthDrops) {
    const bob = Math.sin(game.elapsed * 4) * 3
    circle(drop.x, drop.y - 14 + bob, 14, "#f3d09a")
    rect(drop.x - 3, drop.y - 23 + bob, 6, 18, "#b95273")
    rect(drop.x - 9, drop.y - 17 + bob, 18, 6, "#b95273")
  }

  const drawFighter = (x: number, y: number, facing: number, enemy?: Brawler) => {
    const boss = enemy?.boss ?? false
    const jumping = enemy ? 0 : game.jumpHeight
    const attacking = enemy ? enemy.attacking > 0 : game.attack > 0
    const rolling = !enemy && game.dodge > 0
    const factor = boss ? 1.45 : 1
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = "#34405c45"
    ctx.beginPath()
    ctx.ellipse(0, 0, boss ? 35 : 24, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.translate(0, -jumping)
    ctx.scale(facing * factor, factor)
    if ((enemy?.hurt ?? game.player.hurt) > 0 && Math.floor(game.elapsed * 22) % 2 === 0) ctx.globalAlpha = 0.5
    if (rolling) {
      ctx.translate(0, -27)
      ctx.rotate(game.elapsed * 22)
      ctx.translate(0, 27)
    }
    const stride = Math.sin(game.elapsed * 12 + x * 0.02) * 7
    rect(-15, -31, 11, 27 + stride, "#303c57")
    rect(4, -31, 11, 27 - stride, "#303c57")
    rect(-20, -6 + stride, 18, 8, "#ede7d7")
    rect(2, -6 - stride, 21, 8, "#ede7d7")
    rect(-20, -68, 39, 40, enemy ? (boss ? "#995e8d" : "#777299") : "#eb9577")
    rect(-3, -65, 5, 35, enemy ? "#d5b2ba" : "#f8d5a0")
    rect(-26, -62, 10, 28, enemy ? "#555570" : "#cf745f")
    const armReach = attacking ? 42 : 11
    rect(17, -60, armReach, 12, enemy ? "#8786a3" : "#eb9577")
    circle(18 + armReach, -54, 9, enemy ? "#d5c5b8" : "#f3ceaa")
    if (enemy) {
      rect(-20, -99, 40, 34, boss ? "#514366" : "#dde0d8")
      circle(0, -82, 13, "#364159")
      circle(0, -82, 6, "#939eaf")
      rect(-15, -102, 30, 5, "#5d637a")
    } else {
      circle(0, -85, 17, "#efc39d")
      rect(-16, -104, 30, 13, "#384961")
      rect(-18, -91, 7, 15, "#53c6c7")
      rect(12, -91, 7, 15, "#53c6c7")
      rect(7, -85, 4, 4, "#343d58")
      rect(4, -74, 10, 3, "#ae6d64")
    }
    ctx.restore()
    if (enemy) {
      const maxHealth = enemy.maxHealth
      rect(x - 22, y - (boss ? 159 : 116), 44, 4, "#454360")
      rect(x - 22, y - (boss ? 159 : 116), 44 * Math.max(0, enemy.health / maxHealth), 4, "#e3b894")
      if (enemy.windup > 0) {
        text("!", x - 5, y - (boss ? 169 : 124), 24, "#fff3bd")
        ctx.strokeStyle = boss ? "#f69b8c" : "#efd0a0"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.ellipse(x, y, boss ? 135 : 65, boss ? 41 : 21, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  const sorted = [...game.enemies.map((enemy) => ({ ...enemy, enemy })), { ...game.player, enemy: undefined }].sort(
    (a, b) => a.y - b.y,
  )
  sorted.forEach((fighter) => drawFighter(fighter.x, fighter.y, fighter.facing, fighter.enemy))
  for (const hit of game.hits) {
    ctx.globalAlpha = Math.min(1, hit.time * 2)
    text(hit.text, hit.x - 15, hit.y - (0.7 - hit.time) * 45, 21, hit.text.startsWith("+") ? "#c6f2ba" : "#fff1bb")
  }
  ctx.globalAlpha = 1
  if (game.enemies.length === 0 && game.status === "playing") {
    text(
      game.wave === BRAWL_WAVES.length - 1 ? "Bring the music back!  →" : "Next block  →",
      Math.min(game.player.x + 70, ARENA_END - 130),
      275,
      21,
      "#fff4cb",
    )
  }
  ctx.restore()
  ctx.restore()
}
