export const PITCH = { halfLength: 26, halfWidth: 17, goalHalfWidth: 5.4, goalHeight: 4.5 }
export const MATCH_SECONDS = 90
export const EXTRA_SECONDS = 30
export const BALL_RADIUS = 1.15
export const CAR_RADIUS = 1.12
export const PHYSICS_STEP = 1 / 120
export type MatchPhase = "ready" | "kickoff" | "playing" | "goal" | "paused" | "finished"
export interface DriveInput {
  steer: number
  throttle: number
  boost: boolean
  jump: boolean
}
export const NO_DRIVE: DriveInput = { steer: 0, throttle: 0, boost: false, jump: false }
export interface Car {
  x: number
  z: number
  vx: number
  vz: number
  angle: number
  height: number
  vy: number
  boost: number
  boosting: boolean
  jumpHeld: boolean
  steering: number
  accelerator: number
}
export interface Ball {
  x: number
  z: number
  vx: number
  vz: number
  height: number
  vy: number
  spin: number
}
export interface BoostPad {
  x: number
  z: number
  cooldown: number
}
export interface SoccerPose {
  player: Pick<Car, "x" | "z" | "angle" | "height">
  rival: Pick<Car, "x" | "z" | "angle" | "height">
  ball: Pick<Ball, "x" | "z" | "height" | "spin">
}
export interface SoccerMatch {
  phase: MatchPhase
  resumePhase: MatchPhase
  seconds: number
  extraTime: boolean
  countdown: number
  blue: number
  orange: number
  lastGoal: "blue" | "orange" | null
  player: Car
  rival: Car
  ball: Ball
  pads: BoostPad[]
  elapsed: number
  rallyElapsed: number
  hits: number
  accumulator: number
  previousPose: SoccerPose | null
}
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
const turnAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
function createCar(x: number, angle: number): Car {
  return {
    x,
    z: 0,
    vx: 0,
    vz: 0,
    angle,
    height: 0,
    vy: 0,
    boost: 80,
    boosting: false,
    jumpHeld: false,
    steering: 0,
    accelerator: 0,
  }
}
function kickoff(match: SoccerMatch) {
  match.rallyElapsed = 0
  match.player = createCar(-15, 0)
  match.rival = { ...createCar(15, Math.PI), z: 3 }
  match.ball = { x: 0, z: 0, vx: 0, vz: 0, height: BALL_RADIUS, vy: 0, spin: 0 }
  match.pads.forEach((pad) => {
    pad.cooldown = 0
  })
}
export function createMatch(): SoccerMatch {
  return {
    phase: "ready",
    resumePhase: "playing",
    seconds: MATCH_SECONDS,
    extraTime: false,
    countdown: 3,
    blue: 0,
    orange: 0,
    lastGoal: null,
    elapsed: 0,
    rallyElapsed: 0,
    hits: 0,
    accumulator: 0,
    previousPose: null,
    player: createCar(-15, 0),
    rival: { ...createCar(15, Math.PI), z: 3 },
    ball: { x: 0, z: 0, vx: 0, vz: 0, height: BALL_RADIUS, vy: 0, spin: 0 },
    pads: [-1, 1].flatMap((side) => [-12, 0, 12].map((x) => ({ x, z: side * 11, cooldown: 0 }))),
  }
}
export function pauseMatch(match: SoccerMatch) {
  if (match.phase === "playing" || match.phase === "kickoff" || match.phase === "goal") {
    match.resumePhase = match.phase
    match.phase = "paused"
    match.player.boosting = false
    match.rival.boosting = false
  }
}
export function resumeMatch(match: SoccerMatch) {
  if (match.phase === "paused") match.phase = match.resumePhase
}
export function matchPoints(match: SoccerMatch) {
  return match.blue * 100 + (match.phase === "finished" && match.blue > match.orange ? 250 : 0)
}

// Both drivers use the same acceleration, grip, fuel and collision rules.
function drive(car: Car, input: DriveInput, dt: number) {
  const speed = Math.hypot(car.vx, car.vz)
  const forward = car.vx * Math.cos(car.angle) + car.vz * Math.sin(car.angle)
  const reverse = forward < -0.7 ? -1 : 1
  car.steering += (clamp(input.steer, -1, 1) - car.steering) * (1 - Math.exp(-12 * dt))
  car.accelerator += (clamp(input.throttle, -1, 1) - car.accelerator) * (1 - Math.exp(-14 * dt))
  car.angle = turnAngle(car.angle + car.steering * reverse * (0.85 + Math.min(speed / 8, 1) * 1.7) * dt)
  car.boosting = input.boost && input.throttle > 0 && car.boost > 0
  car.boost = clamp(car.boost + (car.boosting ? -30 : 10) * dt, 0, 100)
  const acceleration = car.accelerator * 27 + (car.boosting ? 35 : 0)
  const fx = Math.cos(car.angle),
    fz = Math.sin(car.angle)
  car.vx += fx * acceleration * dt
  car.vz += fz * acceleration * dt
  // Tire grip removes lateral slide while preserving a small, readable turning arc.
  const lateral = -car.vx * fz + car.vz * fx
  car.vx += lateral * fz * Math.min(1, 5.8 * dt)
  car.vz -= lateral * fx * Math.min(1, 5.8 * dt)
  const drag = Math.exp(-(input.throttle === 0 ? 2.0 : 1.2) * dt)
  car.vx *= drag
  car.vz *= drag
  const limit = car.boosting ? 27 : input.throttle < 0 ? 9 : 18
  const magnitude = Math.hypot(car.vx, car.vz)
  if (magnitude > limit) {
    // Releasing boost coasts down; changing the cap must not cut a third of the speed in one frame.
    const easedLimit = limit + Math.max(0, speed - limit) * Math.exp(-4 * dt)
    const capped = Math.min(magnitude, easedLimit)
    car.vx *= capped / magnitude
    car.vz *= capped / magnitude
  }
  if (input.jump && !car.jumpHeld && car.height < 0.02) car.vy = 8.5
  car.jumpHeld = input.jump
  car.vy -= 23 * dt
  car.height = Math.max(0, car.height + car.vy * dt)
  if (car.height === 0) car.vy = 0
  car.x += car.vx * dt
  car.z += car.vz * dt
  const xLimit = PITCH.halfLength - CAR_RADIUS
  const zLimit = PITCH.halfWidth - CAR_RADIUS
  if (Math.abs(car.x) > xLimit) {
    car.x = clamp(car.x, -xLimit, xLimit)
    car.vx *= -0.35
  }
  if (Math.abs(car.z) > zLimit) {
    car.z = clamp(car.z, -zLimit, zLimit)
    car.vz *= -0.35
  }
}

export function rivalInput(match: SoccerMatch): DriveInput {
  const car = match.rival,
    ball = match.ball
  const predictedX = clamp(ball.x + ball.vx * 0.22, -23, 23)
  const predictedZ = clamp(ball.z + ball.vz * 0.22, -14, 14)
  // Approach from the orange side so contact sends the ball toward the blue goal.
  const goalDX = -PITCH.halfLength - predictedX,
    goalDZ = -predictedZ
  const goalDistance = Math.hypot(goalDX, goalDZ) || 1
  const behind = car.x < predictedX + 1.4 || Math.abs(car.z - predictedZ) > 2.4 || Math.cos(car.angle) > -0.4
  let tx = predictedX - (goalDX / goalDistance) * (behind ? 4.5 : 0.6)
  let tz = predictedZ - (goalDZ / goalDistance) * (behind ? 4.5 : 0.6)
  // Drive around the ball when caught on its wrong side, rather than own-goaling.
  if (car.x < predictedX + 1.5 && Math.abs(car.z - predictedZ) < 4.5) tz += car.z >= predictedZ ? 5 : -5
  tx = clamp(tx, -24, 24)
  tz = clamp(tz, -15, 15)
  const distance = Math.hypot(tx - car.x, tz - car.z)
  const difference = turnAngle(Math.atan2(tz - car.z, tx - car.x) - car.angle)
  const aligned = Math.abs(difference) < 0.3
  return {
    steer: clamp(difference * 2.1, -1, 1),
    throttle: Math.abs(difference) > 1.1 ? 0 : distance < 2 && Math.abs(difference) > 0.6 ? 0.4 : 1,
    boost: aligned && distance > 6 && car.boost > 28 && match.rallyElapsed > 0.6,
    jump: ball.height > 2 && ball.height < 4 && Math.hypot(ball.x - car.x, ball.z - car.z) < 3.5,
  }
}
function bumpCars(a: Car, b: Car) {
  if (Math.abs(a.height - b.height) > 1.5) return
  const dx = b.x - a.x,
    dz = b.z - a.z
  const distance = Math.hypot(dx, dz)
  if (distance >= CAR_RADIUS * 2) return
  const nx = distance > 0.0001 ? dx / distance : 1,
    nz = distance > 0.0001 ? dz / distance : 0
  const overlap = (CAR_RADIUS * 2 - distance) / 2
  a.x -= nx * overlap
  a.z -= nz * overlap
  b.x += nx * overlap
  b.z += nz * overlap
  const approach = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz
  if (approach > 0) {
    const impulse = approach * 0.75
    a.vx -= nx * impulse
    a.vz -= nz * impulse
    b.vx += nx * impulse
    b.vz += nz * impulse
  }
}
function hitBall(car: Car, ball: Ball): boolean {
  if (ball.height > car.height + 2.1 || ball.height + BALL_RADIUS < car.height + 0.25) return false
  const dx = ball.x - car.x,
    dz = ball.z - car.z
  const distance = Math.hypot(dx, dz),
    contact = CAR_RADIUS + BALL_RADIUS
  if (distance >= contact) return false
  const nx = distance > 0.0001 ? dx / distance : Math.cos(car.angle)
  const nz = distance > 0.0001 ? dz / distance : Math.sin(car.angle)
  ball.x = car.x + nx * contact
  ball.z = car.z + nz * contact
  const approach = (car.vx - ball.vx) * nx + (car.vz - ball.vz) * nz
  if (approach <= 0) return false
  const impulse = approach * 1.45 + (car.boosting ? 2 : 0)
  ball.vx += nx * impulse
  ball.vz += nz * impulse
  car.vx -= nx * impulse * 0.14
  car.vz -= nz * impulse * 0.14
  ball.vy = Math.max(ball.vy, Math.min(9, approach * 0.23 + (car.height > 0.2 ? 4 : 0)))
  return true
}
function scoreGoal(match: SoccerMatch, team: "blue" | "orange") {
  match[team]++
  match.lastGoal = team
  match.phase = match.extraTime ? "finished" : "goal"
  match.countdown = 2.3
  match.player.boosting = false
  match.rival.boosting = false
}
function physics(match: SoccerMatch, input: DriveInput, dt: number) {
  drive(match.player, input, dt)
  drive(match.rival, rivalInput(match), dt)
  bumpCars(match.player, match.rival)
  if (hitBall(match.player, match.ball)) match.hits++
  hitBall(match.rival, match.ball)
  const ball = match.ball
  const resistance = Math.exp(-0.23 * dt)
  ball.vx *= resistance
  ball.vz *= resistance
  const speed = Math.hypot(ball.vx, ball.vz)
  if (speed > 39) {
    ball.vx *= 39 / speed
    ball.vz *= 39 / speed
  }
  ball.x += ball.vx * dt
  ball.z += ball.vz * dt
  ball.spin += (Math.hypot(ball.vx, ball.vz) * dt) / BALL_RADIUS
  ball.vy -= 17 * dt
  ball.height += ball.vy * dt
  if (ball.height < BALL_RADIUS) {
    ball.height = BALL_RADIUS
    ball.vy = Math.abs(ball.vy) > 1.8 ? Math.abs(ball.vy) * 0.6 : 0
  }
  if (ball.height > 13) {
    ball.height = 13
    ball.vy = -Math.abs(ball.vy) * 0.5
  }
  const zLimit = PITCH.halfWidth - BALL_RADIUS
  if (Math.abs(ball.z) > zLimit) {
    ball.z = clamp(ball.z, -zLimit, zLimit)
    ball.vz *= -0.82
  }
  const inGoalMouth =
    Math.abs(ball.z) + BALL_RADIUS < PITCH.goalHalfWidth && ball.height + BALL_RADIUS < PITCH.goalHeight
  if (inGoalMouth && Math.abs(ball.x) > PITCH.halfLength + BALL_RADIUS) {
    scoreGoal(match, ball.x > 0 ? "blue" : "orange")
    return
  }
  // A ball inside the goal mouth may cross the end line; the posts/crossbar stay solid.
  if (!inGoalMouth && Math.abs(ball.x) > PITCH.halfLength - BALL_RADIUS) {
    ball.x = clamp(ball.x, -PITCH.halfLength + BALL_RADIUS, PITCH.halfLength - BALL_RADIUS)
    ball.vx *= -0.82
  }
  for (const pad of match.pads) {
    pad.cooldown = Math.max(0, pad.cooldown - dt)
    for (const car of [match.player, match.rival]) {
      if (pad.cooldown === 0 && car.height < 1 && Math.hypot(car.x - pad.x, car.z - pad.z) < 2) {
        car.boost = Math.min(100, car.boost + 35)
        pad.cooldown = 5
      }
    }
  }
}

function snapshotPose(match: SoccerMatch): SoccerPose {
  const car = ({ x, z, angle, height }: Car) => ({ x, z, angle, height })
  const { x, z, height, spin } = match.ball
  return { player: car(match.player), rival: car(match.rival), ball: { x, z, height, spin } }
}

// Render between completed physics steps. No smoothed values feed back into collisions.
export function matchPose(match: SoccerMatch): SoccerPose {
  const current = snapshotPose(match),
    previous = match.previousPose
  if (!previous || !(match.phase === "playing" || (match.phase === "paused" && match.resumePhase === "playing")))
    return current
  const alpha = clamp(match.accumulator / PHYSICS_STEP, 0, 1)
  const lerp = (a: number, b: number) => a + (b - a) * alpha
  const car = (a: SoccerPose["player"], b: SoccerPose["player"]) => ({
    x: lerp(a.x, b.x),
    z: lerp(a.z, b.z),
    height: lerp(a.height, b.height),
    angle: a.angle + turnAngle(b.angle - a.angle) * alpha,
  })
  return {
    player: car(previous.player, current.player),
    rival: car(previous.rival, current.rival),
    ball: {
      x: lerp(previous.ball.x, current.ball.x),
      z: lerp(previous.ball.z, current.ball.z),
      height: lerp(previous.ball.height, current.ball.height),
      spin: lerp(previous.ball.spin, current.ball.spin),
    },
  }
}

function tickMatch(match: SoccerMatch, input: DriveInput) {
  if (match.phase === "kickoff" || match.phase === "goal") {
    match.countdown = Math.max(0, match.countdown - PHYSICS_STEP)
    if (match.countdown < 1e-8) {
      if (match.phase === "goal") {
        kickoff(match)
        match.phase = "kickoff"
        match.countdown = 1.5
      } else match.phase = "playing"
    }
    return
  }
  match.elapsed += PHYSICS_STEP
  match.rallyElapsed += PHYSICS_STEP
  match.seconds = Math.max(0, match.seconds - PHYSICS_STEP)
  physics(match, input, PHYSICS_STEP)
  if (match.seconds < 1e-8 && match.phase === "playing") {
    match.seconds = 0
    if (!match.extraTime && match.blue === match.orange) {
      match.extraTime = true
      match.seconds = EXTRA_SECONDS
      kickoff(match)
      match.phase = "kickoff"
      match.countdown = 2
    } else match.phase = "finished"
  }
}

export function stepMatch(match: SoccerMatch, input: DriveInput, delta: number) {
  if (
    !Number.isFinite(delta) ||
    delta <= 0 ||
    match.phase === "ready" ||
    match.phase === "paused" ||
    match.phase === "finished"
  )
    return
  match.accumulator += Math.min(delta, 0.1)
  while (match.accumulator + 1e-10 >= PHYSICS_STEP) {
    match.previousPose = snapshotPose(match)
    match.accumulator = Math.max(0, match.accumulator - PHYSICS_STEP)
    tickMatch(match, input)
    if ((match.phase as MatchPhase) === "finished") {
      match.accumulator = 0
      break
    }
  }
}
