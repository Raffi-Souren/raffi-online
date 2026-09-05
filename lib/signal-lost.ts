export const SIGNAL_MAP = [
  "11111111111111111",
  "10000000000000001",
  "10000010001000001",
  "10110010001001101",
  "10110000000001101",
  "10000010001000001",
  "11101111111011101",
  "10000000000000001",
  "10002000200020001",
  "10002000200020001",
  "10000000000000001",
  "11101111111011101",
  "10000000000000001",
  "10000010001000001",
  "10000010001000001",
  "10000000000000001",
  "11111111111111111",
]

export type SignalPhase = "ready" | "playing" | "paused" | "won" | "lost"
export interface SignalEnemy {
  elite?: boolean
  id: number
  x: number
  y: number
  hp: number
  charge: number
  cooldown: number
  hit: number
}
export interface SignalBolt {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}
export interface SignalPickup {
  x: number
  y: number
  active: boolean
}
export interface SignalState {
  phase: SignalPhase
  x: number
  y: number
  angle: number
  health: number
  heat: number
  overheated: boolean
  cooldown: number
  shot: number
  hurt: number
  hit: number
  wave: number
  waveDelay: number
  kills: number
  time: number
  moving: boolean
  enemies: SignalEnemy[]
  bolts: SignalBolt[]
  pickups: SignalPickup[]
  secrets: { x: number; y: number; found: boolean; name: string }[]
  message: string
  messageTime: number
}
export interface SignalInput {
  forward: number
  strafe: number
  turn: number
  sprint: boolean
  fire: boolean
}
export const SIGNAL_EXIT = { x: 14.5, y: 1.5 }
export const SIGNAL_LEVELS = ["Service tunnels", "Relay hall", "Power station", "Dead frequency", "Master transmitter"]
export const SIGNAL_WAVES = SIGNAL_LEVELS.length

export function signalWall(x: number, y: number) {
  return Number(SIGNAL_MAP[Math.floor(y)]?.[Math.floor(x)] ?? "1")
}

export function signalRay(x: number, y: number, angle: number, maxDistance = 28) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle)
  let mx = Math.floor(x),
    my = Math.floor(y)
  const deltaX = Math.abs(1 / (dx || 1e-10)),
    deltaY = Math.abs(1 / (dy || 1e-10))
  const stepX = dx < 0 ? -1 : 1,
    stepY = dy < 0 ? -1 : 1
  let sideX = (dx < 0 ? x - mx : mx + 1 - x) * deltaX
  let sideY = (dy < 0 ? y - my : my + 1 - y) * deltaY
  let side = 0,
    distance = 0
  for (let i = 0; i < 100; i++) {
    if (sideX < sideY) {
      distance = sideX
      sideX += deltaX
      mx += stepX
      side = 0
    } else {
      distance = sideY
      sideY += deltaY
      my += stepY
      side = 1
    }
    if (distance > maxDistance || signalWall(mx, my)) break
  }
  const hit = side === 0 ? y + distance * dy : x + distance * dx
  return { distance: Math.max(0.01, distance), u: hit - Math.floor(hit), side, material: signalWall(mx, my), mx, my }
}

export function createSignalState(): SignalState {
  return {
    phase: "ready",
    x: 3.5,
    y: 14.5,
    angle: -Math.PI / 2,
    health: 100,
    heat: 0,
    overheated: false,
    cooldown: 0,
    shot: 0,
    hurt: 0,
    hit: 0,
    wave: 0,
    waveDelay: 0,
    kills: 0,
    time: 0,
    moving: false,
    enemies: [],
    bolts: [],
    pickups: [
      { x: 7.5, y: 10.5, active: true },
      { x: 15.5, y: 4.5, active: true },
    ],
    secrets: [
      { x: 1.5, y: 13.5, found: false, name: "Pirate radio tape" },
      { x: 15.5, y: 9.5, found: false, name: "Lost broadcast" },
      { x: 1.5, y: 1.5, found: false, name: "Station master reel" },
    ],
    message: "Restore the signal. Get back upstairs.",
    messageTime: 4,
  }
}

function message(s: SignalState, text: string, duration = 2.5) {
  s.message = text
  s.messageTime = duration
}

export function startSignalWave(s: SignalState) {
  if (s.wave >= SIGNAL_WAVES) return
  s.wave++
  const spawns = [
    [3.5, 8.5],
    [13.5, 8.5],
    [7.5, 3.5],
    [15.5, 4.5],
    [3.5, 2.5],
    [11.5, 13.5],
    [1.5, 5.5],
  ]
  s.enemies = spawns.slice(0, s.wave + 2).map(([x, y], id) => ({
    id: s.wave * 10 + id,
    x,
    y,
    hp: s.wave >= 4 && id % 3 === 0 ? 5 : s.wave >= 3 ? 3 : 2,
    elite: s.wave >= 4 && id % 3 === 0,
    charge: 0,
    cooldown: 1.5 + id * 0.3,
    hit: 0,
  }))
  s.waveDelay = 0
  message(s, `${s.wave}/${SIGNAL_WAVES} · ${SIGNAL_LEVELS[s.wave - 1]} · ${s.enemies.length} signals`, 3)
}

export function startSignal(s: SignalState) {
  s.phase = "playing"
  startSignalWave(s)
}

function canStand(x: number, y: number, radius = 0.22) {
  return (
    !signalWall(x - radius, y - radius) &&
    !signalWall(x + radius, y - radius) &&
    !signalWall(x - radius, y + radius) &&
    !signalWall(x + radius, y + radius)
  )
}

function move(body: { x: number; y: number }, dx: number, dy: number) {
  if (canStand(body.x + dx, body.y)) body.x += dx
  if (canStand(body.x, body.y + dy)) body.y += dy
}

function angleDifference(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b))
}

export function fireSignal(s: SignalState) {
  if (s.phase !== "playing" || s.cooldown > 0 || s.overheated) return false
  s.cooldown = 0.24
  s.shot = 0.1
  s.heat = Math.min(100, s.heat + 22)
  if (s.heat >= 100) {
    s.overheated = true
    message(s, "Coil overheated. Keep moving while it cools.")
  }
  let target: SignalEnemy | null = null
  let nearest = 16
  for (const enemy of s.enemies) {
    if (enemy.hp <= 0) continue
    const dx = enemy.x - s.x,
      dy = enemy.y - s.y
    const distance = Math.hypot(dx, dy)
    const aim = Math.atan2(dy, dx)
    if (
      distance < nearest &&
      Math.abs(angleDifference(aim, s.angle)) < Math.atan2(0.42, distance) &&
      signalRay(s.x, s.y, aim).distance > distance - 0.25
    ) {
      target = enemy
      nearest = distance
    }
  }
  if (target) {
    target.hp--
    target.hit = 0.2
    target.charge = 0
    s.hit = 0.18
    if (target.hp <= 0) {
      s.kills++
      if (s.kills % 3 === 0) s.pickups.push({ x: target.x, y: target.y, active: true })
    }
  }
  return true
}

// One distance field lets every drone find the player through the corridors.
function navigation(s: SignalState) {
  const width = SIGNAL_MAP[0].length
  const distances = new Int16Array(width * SIGNAL_MAP.length).fill(-1)
  const queue = [Math.floor(s.y) * width + Math.floor(s.x)]
  distances[queue[0]] = 0
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i],
      x = cell % width,
      y = Math.floor(cell / width)
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      const next = ny * width + nx
      if (!signalWall(nx, ny) && distances[next] === -1) {
        distances[next] = distances[cell] + 1
        queue.push(next)
      }
    }
  }
  return distances
}

export function stepSignal(s: SignalState, input: SignalInput, seconds: number) {
  if (s.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return
  const dt = Math.min(seconds, 0.05)
  s.time += dt
  for (const key of ["cooldown", "shot", "hurt", "hit", "messageTime"] as const) s[key] = Math.max(0, s[key] - dt)
  s.heat = Math.max(0, s.heat - dt * (s.overheated ? 43 : 28))
  if (s.overheated && s.heat <= 15) s.overheated = false
  s.angle += input.turn * dt * 2.15
  const magnitude = Math.max(1, Math.hypot(input.forward, input.strafe))
  const speed = ((input.sprint ? 3.3 : 2.45) * dt) / magnitude
  move(
    s,
    (Math.cos(s.angle) * input.forward - Math.sin(s.angle) * input.strafe) * speed,
    (Math.sin(s.angle) * input.forward + Math.cos(s.angle) * input.strafe) * speed,
  )
  s.moving = Math.abs(input.forward) + Math.abs(input.strafe) > 0.1
  if (input.fire) fireSignal(s)

  const nav = navigation(s),
    width = SIGNAL_MAP[0].length
  for (const enemy of s.enemies) {
    enemy.hit = Math.max(0, enemy.hit - dt)
    if (enemy.hp <= 0) continue
    enemy.cooldown -= dt
    const dx = s.x - enemy.x,
      dy = s.y - enemy.y,
      distance = Math.hypot(dx, dy)
    const direction = Math.atan2(dy, dx)
    const visible = signalRay(enemy.x, enemy.y, direction).distance > distance - 0.15
    if (visible && distance < 7 && enemy.cooldown <= 0) {
      enemy.charge += dt
      if (enemy.charge >= (enemy.elite ? 1.1 : 0.9)) {
        for (const spread of enemy.elite ? [-0.16, 0, 0.16] : [0]) {
          const speed = 4 + Math.max(0, s.wave - 3) * 0.35
          s.bolts.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(direction + spread) * speed,
            vy: Math.sin(direction + spread) * speed,
            life: 4,
          })
        }
        enemy.charge = 0
        enemy.cooldown = 2.4 - s.wave * 0.2
      }
    } else {
      enemy.charge = 0
      if (distance > 2.6 || !visible) {
        let tx = s.x,
          ty = s.y
        if (!visible) {
          const ex = Math.floor(enemy.x),
            ey = Math.floor(enemy.y)
          let best = Infinity
          for (const [nx, ny] of [
            [ex - 1, ey],
            [ex + 1, ey],
            [ex, ey - 1],
            [ex, ey + 1],
          ]) {
            const value = nav[ny * width + nx]
            if (!signalWall(nx, ny) && value >= 0 && value < best) {
              best = value
              tx = nx + 0.5
              ty = ny + 0.5
            }
          }
        }
        const a = Math.atan2(ty - enemy.y, tx - enemy.x)
        const speed = 0.9 + Math.max(0, s.wave - 2) * 0.12
        move(enemy, Math.cos(a) * dt * speed, Math.sin(a) * dt * speed)
      }
    }
  }
  for (const bolt of s.bolts) {
    bolt.x += bolt.vx * dt
    bolt.y += bolt.vy * dt
    bolt.life -= dt
    if (signalWall(bolt.x, bolt.y)) bolt.life = 0
    if (bolt.life > 0 && Math.hypot(bolt.x - s.x, bolt.y - s.y) < 0.32) {
      s.health = Math.max(0, s.health - 14)
      s.hurt = 0.3
      bolt.life = 0
      if (s.health <= 0) {
        s.phase = "lost"
        message(s, "Signal dropped.")
      }
    }
  }
  s.bolts = s.bolts.filter((b) => b.life > 0)
  if (s.phase !== "playing") return
  for (const pickup of s.pickups) {
    if (pickup.active && Math.hypot(pickup.x - s.x, pickup.y - s.y) < 0.65 && (s.health < 100 || s.heat > 20)) {
      pickup.active = false
      s.health = Math.min(100, s.health + 30)
      s.heat = 0
      s.overheated = false
      message(s, "Service pack · +30 integrity · coil cooled")
    }
  }
  for (const secret of s.secrets) {
    if (!secret.found && Math.hypot(secret.x - s.x, secret.y - s.y) < 0.65) {
      secret.found = true
      s.health = Math.min(100, s.health + 40)
      s.heat = 0
      s.overheated = false
      message(s, `${secret.name} recovered · +40 integrity`, 4)
    }
  }
  if (s.enemies.every((e) => e.hp <= 0)) {
    if (s.wave < SIGNAL_WAVES) {
      if (!s.waveDelay) {
        s.waveDelay = 3
        message(s, "Sector clear. Next signal in 3…")
        s.health = Math.min(100, s.health + 15)
      }
      s.waveDelay -= dt
      if (s.waveDelay <= 0) startSignalWave(s)
    } else {
      if (s.messageTime <= 0) message(s, "Signal restored. Reach the green exit upstairs.", 10)
      if (Math.hypot(s.x - SIGNAL_EXIT.x, s.y - SIGNAL_EXIT.y) < 0.8 && s.phase === "playing") s.phase = "won"
    }
  }
}
