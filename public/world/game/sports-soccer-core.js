/** Compact 2v2 pickup: possession, open-space support and continuous ball physics. */
const STEP = 1 / 120
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const toward = (a, b) => { const d = distance(a, b); return d > .001 ? { x: (b.x - a.x) / d, z: (b.z - a.z) / d } : { x: 0, z: 0 } }
export const SOCCER_FIELD = { halfWidth: 8, halfLength: 12, goalHalfWidth: 2.4, goalHeight: 2.2 }

export function createSoccerMatch({ mode = 'match', duration = 90, target = 3 } = {}) {
  const s = { mode, phase: 'kickoff', remaining: duration, target, reset: .8, clock: 0, accumulator: 0, pendingPass: false, pendingShot: false, score: [0, 0], completedPasses: 0, shots: 0, tackles: 0, bestChain: 0, chain: 0, lastPasser: null, receiver: null, receiverLock: 0, events: [], status: 'Your ball. Find a passing lane.', actors: [
    { id: 'player', team: 0, x: -2.6, z: 5.4, yaw: Math.PI, cooldown: 0, heldFor: 0, speed: 0 },
    { id: 'nico', team: 0, x: 3.4, z: 2.5, yaw: Math.PI, cooldown: 0, heldFor: 0, speed: 0 },
    { id: 'imani', team: 1, x: -2.4, z: -3, yaw: 0, cooldown: 0, heldFor: 0, speed: 0 },
    { id: 'mateo', team: 1, x: 2.8, z: -7, yaw: 0, cooldown: 0, heldFor: 0, speed: 0 },
  ], ball: { x: -2.6, y: .18, z: 4.7, vx: 0, vy: 0, vz: 0, owner: 0, lastTeam: 0, freeTime: 0 } }
  return s
}

function kick(s, actorIndex, target, { shot = false } = {}) {
  const actor = s.actors[actorIndex], b = s.ball
  if (b.owner !== actorIndex || actor.cooldown > 0) return false
  const dir = toward(actor, target), length = distance(actor, target), speed = shot ? 17 : clamp(length * 2.3, 9, 15)
  b.owner = null; b.x = actor.x + dir.x * .65; b.z = actor.z + dir.z * .65; b.y = .19
  b.vx = dir.x * speed; b.vz = dir.z * speed; b.vy = shot ? 2.1 : .35; b.lastTeam = actor.team; b.freeTime = 0
  actor.cooldown = shot ? .65 : .5; actor.heldFor = 0
  s.lastPasser = shot ? null : actorIndex
  s.receiver = shot ? null : s.actors.findIndex((p, i) => i !== actorIndex && p.team === actor.team)
  s.receiverLock = shot ? 0 : .65
  s.events.push(shot ? 'shot' : 'pass')
  if (actorIndex === 0 && shot) s.shots++
  s.status = shot ? 'Shot away — follow it in.' : actor.team === 0 ? 'Pass into space. Keep moving for the return.' : 'They are moving it. Close the lane.'
  return true
}

export function passSoccer(s, actorIndex = 0) {
  const actor = s.actors[actorIndex]
  if (!actor) return false
  const mate = s.actors.find((p, i) => p.team === actor.team && i !== actorIndex)
  return kick(s, actorIndex, { x: mate.x, z: mate.z })
}

export function shootSoccer(s, actorIndex = 0, aim = 0) {
  const actor = s.actors[actorIndex]
  if (!actor) return false
  // Beginner assistance aims inside the posts. Position still controls the angle,
  // defenders intercept the physical ball, and long shots lose height/speed.
  return kick(s, actorIndex, { x: clamp(aim, -1, 1) * 1.9, z: actor.team === 0 ? -13 : 13 }, { shot: true })
}

function claim(s, index) {
  const b = s.ball, actor = s.actors[index]
  if (s.lastPasser !== null && s.lastPasser !== index && s.actors[s.lastPasser].team === actor.team) {
    if (actor.team === 0) { s.completedPasses++; s.chain++; s.bestChain = Math.max(s.bestChain, s.chain); s.events.push('received') }
  } else if (b.lastTeam !== actor.team) s.chain = 0
  b.owner = index; b.vx = b.vz = b.vy = 0; b.lastTeam = actor.team; actor.heldFor = 0
  s.lastPasser = null; s.receiver = null; s.receiverLock = 0
  s.status = index === 0 ? 'Your ball · PASS to Nico or SHOOT toward goal.' : actor.team === 0 ? 'Nico has it. Move beyond the defender.' : 'Win space, then challenge with Space / PRESS.'
}

function resetAfterGoal(s, scoringTeam) {
  s.score[scoringTeam]++; s.events.push('goal'); s.status = scoringTeam === 0 ? 'Nice finish. Their kickoff.' : 'Reset. Your kickoff.'
  s.chain = 0; s.lastPasser = null; s.receiver = null
  if (s.mode === 'match' && s.score[scoringTeam] >= s.target) { s.phase = 'done'; return }
  s.phase = 'kickoff'; s.reset = 1.8
  for (const [i, p] of s.actors.entries()) { Object.assign(p, { x: [-2.6, 3.4, -2.4, 2.8][i], z: [4.2, 1.8, -4.2, -7][i], cooldown: 0, heldFor: 0, speed: 0 }) }
  s.ball.owner = scoringTeam === 0 ? 2 : 0
  s.ball.vx = s.ball.vz = s.ball.vy = 0
  s.ball.x = s.actors[s.ball.owner].x; s.ball.z = s.actors[s.ball.owner].z; s.ball.y = .18
}

function moveActor(p, target, speed, dt) {
  const dir = toward(p, target), d = distance(p, target), step = Math.min(d, speed * dt)
  p.x = clamp(p.x + dir.x * step, -7.6, 7.6); p.z = clamp(p.z + dir.z * step, -11.5, 11.5)
  p.speed = dt > 0 ? step / dt : 0
  if (step > .0001) p.yaw = Math.atan2(dir.x, dir.z)
}

function ai(s, index, dt) {
  const p = s.actors[index], b = s.ball, direction = p.team === 0 ? -1 : 1
  const mateIndex = s.actors.findIndex((o, i) => i !== index && o.team === p.team), mate = s.actors[mateIndex]
  const foes = s.actors.filter(o => o.team !== p.team)
  if (b.owner === index) {
    p.heldFor += dt
    const distanceToGoal = Math.abs(direction * 12 - p.z), pressure = Math.min(...foes.map(o => distance(o, p)))
    if (p.heldFor > .45 && distanceToGoal < 8 && pressure > 1) { shootSoccer(s, index, Math.sin(s.clock * 1.7) * .7); return }
    if (p.heldFor > .7 && distance(mate, p) > 3.2 && (pressure < 2.5 || p.team === 0 && mate.z < p.z + 2)) { passSoccer(s, index); return }
    const away = foes.reduce((sum, foe) => { const d = Math.max(1, distance(p, foe)); return sum + (p.x - foe.x) / (d * d) }, 0)
    moveActor(p, { x: clamp(p.x + away * 2, -5.8, 5.8), z: direction * 10 }, 3.5, dt)
  } else if (b.owner !== null && s.actors[b.owner].team === p.team) {
    const owner = s.actors[b.owner]
    const side = owner.x < 0 ? 1 : -1
    // An actual passing lane ahead of the carrier, not a second ball chaser.
    moveActor(p, { x: side * 4.5, z: clamp(owner.z + direction * 4.4, -9, 9) }, 3.9, dt)
  } else if (b.owner === null) {
    const closest = s.actors.filter(o => o.team === p.team).sort((a, c) => distance(a, b) - distance(c, b))[0]
    if (closest === p || s.receiver === index) moveActor(p, b, 4.3, dt)
    else moveActor(p, { x: -b.x * .5, z: clamp(b.z - direction * 3, -9.8, 9.8) }, 3.4, dt)
  } else {
    const owner = s.actors[b.owner], pressing = distance(p, owner) < distance(mate, owner)
    if (pressing) moveActor(p, owner, 3.65, dt)
    else moveActor(p, { x: clamp(owner.x * .4, -3, 3), z: clamp(owner.z - direction * 3.6, -10.1, 10.1) }, 3.7, dt)
    if (distance(p, owner) < .92 && p.cooldown <= 0 && owner.cooldown <= 0) {
      p.cooldown = .7; owner.cooldown = .65
      if (Math.sin(s.clock * 3 + index) > -.3) { claim(s, index); s.events.push('tackle') }
    }
  }
}

function frame(s, dt, input) {
  s.clock += dt; s.receiverLock = Math.max(0, s.receiverLock - dt)
  for (const p of s.actors) p.cooldown = Math.max(0, p.cooldown - dt)
  if (s.phase === 'kickoff') { s.reset -= dt; if (s.reset <= 0) s.phase = 'play'; return }
  if (s.mode === 'match') { s.remaining = Math.max(0, s.remaining - dt); if (s.remaining === 0) { s.phase = 'done'; s.status = s.score[0] === s.score[1] ? 'All square. Good run.' : 'Full time. Good game.'; return } }
  const p = s.actors[0], move = input.move || { x: 0, z: 0 }, length = Math.max(1, Math.hypot(move.x || 0, move.z || 0))
  if (s.mode === 'watch') ai(s, 0, dt)
  else {
    moveActor(p, { x: p.x + (move.x || 0) / length, z: p.z + (move.z || 0) / length }, input.guardHeld ? 5.4 : 4.5, dt)
    if (s.pendingPass) {
      if (s.ball.owner === 0) passSoccer(s)
      else if (s.ball.owner !== null && s.actors[s.ball.owner].team !== 0 && distance(p, s.actors[s.ball.owner]) < 1.6 && p.cooldown <= 0) { const opponent = s.actors[s.ball.owner]; opponent.cooldown = .7; claim(s, 0); p.cooldown = .2; s.tackles++; s.events.push('tackle') }
      else if (s.ball.owner === 1) { passSoccer(s, 1); s.status = 'Called for it — meet the pass.' }
    }
    if (s.pendingShot) shootSoccer(s, 0, input.pointerAim?.x ?? move.x ?? 0)
  }
  s.pendingPass = s.pendingShot = false
  for (let i = 1; i < 4; i++) ai(s, i, dt)
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = s.actors[i], b = s.actors[j], d = distance(a, b)
    if (d < .8 && d > .001) { const k = (.8 - d) / d * .5, x = (a.x - b.x) * k, z = (a.z - b.z) * k; a.x = clamp(a.x + x, -7.6, 7.6); a.z = clamp(a.z + z, -11.5, 11.5); b.x = clamp(b.x - x, -7.6, 7.6); b.z = clamp(b.z - z, -11.5, 11.5) }
  }
  const b = s.ball
  if (b.owner !== null) {
    const owner = s.actors[b.owner], facing = owner.speed > .1 ? owner.yaw : owner.team === 0 ? Math.PI : 0
    b.x = owner.x + Math.sin(facing) * .5; b.z = owner.z + Math.cos(facing) * .5; b.y = .18 + Math.abs(Math.sin(s.clock * owner.speed * 2.8)) * .035
    return
  }
  b.freeTime += dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; b.vy -= 9.8 * dt
  if (b.y < .18) { b.y = .18; b.vy = Math.abs(b.vy) > .5 ? -b.vy * .32 : 0 }
  const friction = Math.exp(-(b.y < .2 ? .62 : .06) * dt); b.vx *= friction; b.vz *= friction
  if (Math.abs(b.z) >= 12) {
    if (Math.abs(b.x) < SOCCER_FIELD.goalHalfWidth && b.y < SOCCER_FIELD.goalHeight) { resetAfterGoal(s, b.z < 0 ? 0 : 1); return }
    b.z = Math.sign(b.z) * 11.98; b.vz *= -.55; s.events.push('board')
  }
  if (Math.abs(b.x) >= 8) { b.x = Math.sign(b.x) * 7.98; b.vx *= -.55; s.events.push('board') }
  if (b.y < 1.05 && b.freeTime > .1) {
    const candidates = s.actors.map((actor, index) => ({ actor, index, d: distance(actor, b) })).filter(({ actor, index, d }) => d < .8 && actor.cooldown <= 0 && !(index === s.lastPasser && s.receiverLock > 0)).sort((a, c) => a.d - c.d)
    if (candidates.length) claim(s, candidates[0].index)
  }
}

export function stepSoccer(s, dt, input = {}) {
  if (!Number.isFinite(dt) || dt <= 0 || s.phase === 'done') return
  s.events = []
  s.pendingPass ||= !!input.primaryPressed; s.pendingShot ||= !!input.secondaryPressed
  s.accumulator += Math.min(.1, dt)
  while (s.accumulator + 1e-10 >= STEP && s.phase !== 'done') { frame(s, STEP, input); s.accumulator -= STEP }
}
