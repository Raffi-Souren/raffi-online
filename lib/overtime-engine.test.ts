import test from "node:test"
import assert from "node:assert/strict"
import {
  BALL_RADIUS,
  CAR_RADIUS,
  createMatch,
  EXTRA_SECONDS,
  matchPoints,
  matchPose,
  PHYSICS_STEP,
  NO_DRIVE,
  pauseMatch,
  PITCH,
  resumeMatch,
  rivalInput,
  stepMatch,
  type DriveInput,
  type SoccerMatch,
} from "./overtime-engine"

function playing() {
  const match = createMatch()
  match.phase = "playing"
  return match
}
function advance(match: SoccerMatch, seconds: number, input: DriveInput = NO_DRIVE) {
  for (let i = 0; i < Math.ceil(seconds * 120); i++) stepMatch(match, input, 1 / 120)
}
const throttle = { ...NO_DRIVE, throttle: 1 }

test("kickoff freezes drivers and clock, then starts; pause preserves the current phase", () => {
  const match = createMatch()
  match.phase = "kickoff"
  advance(match, 1, throttle)
  assert.equal(match.player.x, -15)
  assert.equal(match.seconds, 90)
  pauseMatch(match)
  const paused = structuredClone(match)
  advance(match, 10, throttle)
  assert.deepEqual(match, paused)
  resumeMatch(match)
  advance(match, 2.1)
  assert.equal(match.phase, "playing")
  assert.ok(match.seconds < 90)
})

test("steering and reverse change real positions; boost burns fuel and travels faster", () => {
  const normal = playing(),
    boost = playing(),
    reverse = playing(),
    turn = playing()
  advance(normal, 0.6, throttle)
  advance(boost, 0.6, { ...throttle, boost: true })
  advance(reverse, 0.6, { ...NO_DRIVE, throttle: -1 })
  advance(turn, 0.6, { ...throttle, steer: 1 })
  assert.ok(boost.player.x > normal.player.x + 2)
  assert.ok(boost.player.boost < normal.player.boost)
  assert.ok(reverse.player.x < -15)
  assert.ok(turn.player.z > 0.5)
})

test("jump needs a fresh press and lands without repeating while held", () => {
  const match = playing()
  advance(match, 0.15, { ...NO_DRIVE, jump: true })
  assert.ok(match.player.height > 0.8)
  advance(match, 1.3, { ...NO_DRIVE, jump: true })
  assert.equal(match.player.height, 0)
  advance(match, 0.1, NO_DRIVE)
  advance(match, 0.15, { ...NO_DRIVE, jump: true })
  assert.ok(match.player.height > 0.8)
})

test("car contact transfers momentum to the ball and separates overlapping bodies", () => {
  const match = playing()
  match.player.x = -2.1
  match.player.vx = 15
  match.rival.x = 20
  match.rival.z = 10
  stepMatch(match, throttle, 1 / 120)
  assert.ok(match.ball.vx > 15)
  assert.equal(match.hits, 1)
  assert.ok(Math.hypot(match.ball.x - match.player.x, match.ball.z - match.player.z) >= BALL_RADIUS + CAR_RADIUS - 0.15)
})

test("cars collide symmetrically without overlapping or producing invalid numbers", () => {
  const match = playing()
  match.ball.z = 14
  match.player.x = -1
  match.rival.x = 1
  match.rival.z = 0
  match.player.vx = 12
  match.rival.vx = -12
  stepMatch(match, NO_DRIVE, 1 / 120)
  assert.ok(match.rival.x - match.player.x >= CAR_RADIUS * 2 - 0.001)
  assert.ok(match.player.vx < 12)
  assert.ok(match.rival.vx > -12)
})

test("goal requires the whole ball across the line, within posts and below the crossbar", () => {
  for (const [z, height, expected] of [
    [0, BALL_RADIUS, 1],
    [PITCH.goalHalfWidth, BALL_RADIUS, 0],
    [0, PITCH.goalHeight, 0],
  ]) {
    const match = playing()
    match.ball.x = PITCH.halfLength + BALL_RADIUS - 0.2
    match.ball.z = z
    match.ball.height = height
    match.ball.vx = 10
    advance(match, 0.1)
    assert.equal(match.blue, expected)
    if (!expected) assert.ok(match.ball.vx < 0)
  }
})

test("goals count once, freeze the clock and reset both cars and the ball for kickoff", () => {
  const match = playing()
  match.ball.x = 27
  match.ball.vx = 20
  advance(match, 0.1)
  assert.equal(match.blue, 1)
  assert.equal(match.phase, "goal")
  const clock = match.seconds
  advance(match, 2.2)
  assert.equal(match.seconds, clock)
  assert.equal(match.blue, 1)
  advance(match, 0.2)
  assert.equal(match.phase, "kickoff")
  assert.equal(match.player.x, -15)
  assert.equal(match.ball.x, 0)
})

test("pads refill either driver once, then wait for their cooldown", () => {
  const match = playing(),
    pad = match.pads[0]
  match.player.x = pad.x
  match.player.z = pad.z
  match.player.boost = 5
  stepMatch(match, NO_DRIVE, 1 / 120)
  assert.ok(match.player.boost > 39 && match.player.boost < 41)
  assert.ok(pad.cooldown > 4.9)
  advance(match, 0.2)
  assert.ok(match.player.boost < 44)
})

test("timer finishes a decided match, tied games get bounded golden goal, then a draw", () => {
  const winner = playing()
  winner.blue = 2
  winner.orange = 1
  winner.seconds = 0.01
  advance(winner, 0.1)
  assert.equal(winner.phase, "finished")
  assert.equal(matchPoints(winner), 450)
  const tied = playing()
  tied.seconds = 0.01
  advance(tied, 0.1)
  assert.equal(tied.extraTime, true)
  assert.equal(tied.seconds, EXTRA_SECONDS)
  assert.equal(tied.phase, "kickoff")
  tied.phase = "playing"
  tied.seconds = 0.01
  advance(tied, 0.1)
  assert.equal(tied.phase, "finished")
  assert.equal(matchPoints(tied), 0)
  const sudden = playing()
  sudden.extraTime = true
  sudden.ball.x = 27
  sudden.ball.vx = 20
  advance(sudden, 0.1)
  assert.equal(sudden.phase, "finished")
  assert.equal(sudden.blue, 1)
})

test("a fresh run clears scores, overtime, fuel use and all transient motion", () => {
  const match = playing()
  advance(match, 2, { ...throttle, boost: true })
  match.blue = 4
  match.extraTime = true
  const fresh = createMatch()
  assert.equal(fresh.blue, 0)
  assert.equal(fresh.extraTime, false)
  assert.equal(fresh.player.boost, 80)
  assert.equal(fresh.phase, "ready")
  assert.equal(fresh.ball.vx, 0)
})

test("rival beats an idle driver while a steering player can win under identical physics", () => {
  const idle = playing(),
    skilled = playing()
  function attackingInput(match: SoccerMatch) {
    const car = match.player,
      ball = match.ball
    // Mirror the same public steering policy to play toward the opposite goal.
    return rivalInput({
      ...match,
      rival: { ...car, x: -car.x, z: -car.z, vx: -car.vx, vz: -car.vz, angle: car.angle + Math.PI },
      ball: { ...ball, x: -ball.x, z: -ball.z, vx: -ball.vx, vz: -ball.vz },
    })
  }
  for (let i = 0; i < 240 * 120; i++) {
    stepMatch(idle, NO_DRIVE, 1 / 120)
    stepMatch(skilled, attackingInput(skilled), 1 / 120)
    if (idle.phase === "finished" && skilled.phase === "finished") break
  }
  assert.equal(idle.phase, "finished")
  assert.ok(idle.orange > idle.blue, "idle player should not win through repeated AI own goals")
  assert.equal(skilled.phase, "finished")
  assert.ok(skilled.blue > skilled.orange, "driving and positioning must make a win achievable")
})

test("large or invalid deltas cannot tunnel a fast ball through solid boards or poison state", () => {
  const match = playing()
  match.ball.z = 14
  match.ball.vz = 35
  const snapshot = structuredClone(match)
  stepMatch(match, NO_DRIVE, Number.NaN)
  assert.deepEqual(match, snapshot)
  stepMatch(match, NO_DRIVE, 8)
  assert.ok(Math.abs(match.ball.z) <= PITCH.halfWidth - BALL_RADIUS)
  assert.ok(match.ball.vz < 0)
  assert.ok(Number.isFinite(match.player.x))
  assert.ok(match.seconds >= 89.89)
})

test("fixed physics produces the same contacts and motion at 20, 30, 60, 144 Hz and uneven frame pacing", () => {
  const segments: [number, DriveInput][] = [
    [0.5, { ...throttle, boost: true }],
    [0.3, { ...throttle, steer: 1 }],
    [0.5, throttle],
    [0.2, { ...NO_DRIVE, throttle: -1 }],
    [0.4, { ...throttle, steer: -1 }],
    [8, throttle],
  ]
  const simulate = (frames: number[]) => {
    const match = playing()
    let frame = 0
    for (const [duration, input] of segments) {
      let remaining = duration
      while (remaining > 1e-9) {
        const dt = Math.min(remaining, frames[frame++ % frames.length])
        stepMatch(match, input, dt)
        remaining -= dt
      }
    }
    return match
  }
  const reference = simulate([1 / 120])
  for (const pacing of [[1 / 20], [1 / 30], [1 / 60], [1 / 144], [0.007, 0.026, 0.011, 0.02]]) {
    const match = simulate(pacing)
    assert.deepEqual(match.player, reference.player)
    assert.deepEqual(match.rival, reference.rival)
    assert.deepEqual(match.ball, reference.ball)
    assert.equal(match.hits, reference.hits)
    assert.equal(match.phase, reference.phase)
    assert.equal(match.seconds, reference.seconds)
  }
})

test("boost release coasts down instead of instantly losing nine units of speed; steering ramps", () => {
  const match = playing()
  Object.assign(match.player, { x: -18, z: 8, vx: 27, accelerator: 1 })
  stepMatch(match, throttle, 1 / 60)
  assert.ok(match.player.vx > 25, `boost release snapped to ${match.player.vx}`)
  advance(match, 0.5, throttle)
  assert.ok(match.player.vx < 20 && match.player.vx >= 18)
  stepMatch(match, { ...throttle, steer: 1 }, 1 / 120)
  assert.ok(match.player.steering > 0 && match.player.steering < 0.2)
  advance(match, 0.25, { ...throttle, steer: 1 })
  assert.ok(match.player.steering > 0.9)
  stepMatch(match, throttle, 1 / 120)
  assert.ok(match.player.steering > 0.8)
})

test("render interpolation fills partial steps and wraps heading without altering collision state", () => {
  const match = playing()
  stepMatch(match, throttle, PHYSICS_STEP * 1.5)
  const before = structuredClone(match)
  const pose = matchPose(match)
  assert.ok(pose.player.x > -15 && pose.player.x < match.player.x)
  assert.ok(Math.abs(pose.player.x - (-15 + match.player.x) / 2) < 1e-10)
  assert.deepEqual(match, before)
  match.previousPose!.player.angle = Math.PI - 0.01
  match.player.angle = -Math.PI + 0.01
  assert.ok(Math.abs(Math.abs(matchPose(match).player.angle) - Math.PI) < 1e-9)
  const pausedPose = matchPose(match)
  pauseMatch(match)
  advance(match, 2, throttle)
  assert.deepEqual(matchPose(match), pausedPose)
})
