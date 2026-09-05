export const CIRCUIT_LENGTH = 1350
export const RACE_LAPS = 3
export const ROAD_HALF_WIDTH = 8
export const TOP_SPEED = 46

export type RaceStatus = "ready" | "countdown" | "racing" | "paused" | "finished"

export interface KartInput {
  steer: number
  throttle: boolean
  brake: boolean
  drift: boolean
  bend: number
}

export interface Rival {
  name: string
  color: number
  distance: number
  lane: number
  pace: number
}

export interface RaceState {
  status: RaceStatus
  countdown: number
  distance: number
  lane: number
  speed: number
  elapsed: number
  boost: number
  driftCharge: number
  wasDrifting: boolean
  lapTimes: number[]
  lapStarted: number
  pickups: number
  collected: Set<string>
  rivals: Rival[]
}

export const PICKUPS = Array.from({ length: 12 }, (_, index) => ({
  distance: 130 + Math.floor(index / 3) * 310,
  lane: ((index % 3) - 1) * 4.5,
}))

export function createRace(): RaceState {
  return {
    status: "ready",
    countdown: 3,
    distance: 0,
    lane: 0,
    speed: 0,
    elapsed: 0,
    boost: 0,
    driftCharge: 0,
    wasDrifting: false,
    lapTimes: [],
    lapStarted: 0,
    pickups: 0,
    collected: new Set(),
    rivals: [
      { name: "Disco", color: 0xffbc44, distance: 8, lane: -4.2, pace: 38 },
      { name: "Juno", color: 0xba86eb, distance: 15, lane: 3.8, pace: 39.5 },
      { name: "Bodega", color: 0xf36d57, distance: 22, lane: -3.8, pace: 41 },
      { name: "Metro", color: 0x49ba8f, distance: 29, lane: 3.8, pace: 42 },
      { name: "Frankie", color: 0xf18bb8, distance: 36, lane: 0, pace: 43 },
    ],
  }
}

export function racePosition(race: RaceState): number {
  return 1 + race.rivals.filter((rival) => rival.distance > race.distance).length
}

export function currentLap(race: RaceState): number {
  return Math.min(RACE_LAPS, Math.floor(race.distance / CIRCUIT_LENGTH) + 1)
}

export function formatRaceTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toFixed(2).padStart(5, "0")}`
}

/** Fixed, bounded steps keep the same handling at different display refresh rates. */
export function stepRace(race: RaceState, input: KartInput, delta: number): void {
  const dt = Math.max(0, Math.min(delta, 0.05))
  if (race.status === "countdown") {
    race.countdown -= dt
    if (race.countdown <= 0) race.status = "racing"
    return
  }
  if (race.status !== "racing" || dt === 0) return

  race.elapsed += dt
  race.boost = Math.max(0, race.boost - dt)
  const drifting = input.drift && Math.abs(input.steer) > 0.15 && race.speed > 19
  if (drifting) {
    race.driftCharge = Math.min(1.6, race.driftCharge + dt)
  } else if (race.wasDrifting) {
    if (race.driftCharge >= 0.65) race.boost = Math.max(race.boost, 0.8 + race.driftCharge * 0.8)
    race.driftCharge = 0
  }
  race.wasDrifting = drifting

  const offRoad = Math.abs(race.lane) > ROAD_HALF_WIDTH - 0.4
  const limit = offRoad ? 23 : race.boost > 0 ? 63 : TOP_SPEED
  const acceleration = input.brake ? -42 : input.throttle ? 24 : -12
  if (race.speed > limit) {
    race.speed = Math.max(limit, race.speed - dt * (input.brake ? 42 : offRoad ? 48 : 17))
  } else {
    race.speed = Math.max(0, Math.min(limit, race.speed + acceleration * dt))
  }

  const steering = Math.max(-1, Math.min(1, input.steer))
  const steeringGrip = Math.min(1, race.speed / 15)
  race.lane += steering * (drifting ? 6.4 : 5.2) * steeringGrip * dt
  race.lane -= input.bend * Math.pow(race.speed / TOP_SPEED, 2) * dt * 1.4
  if (Math.abs(race.lane) > 10.5) {
    race.lane = Math.sign(race.lane) * 10.5
    race.speed = Math.min(race.speed, 16)
  }

  const previousDistance = race.distance
  race.distance = Math.min(CIRCUIT_LENGTH * RACE_LAPS, race.distance + race.speed * dt)
  const lapIndex = Math.floor(previousDistance / CIRCUIT_LENGTH)
  for (let i = 0; i < PICKUPS.length; i++) {
    const pickup = PICKUPS[i]
    const absoluteDistance = lapIndex * CIRCUIT_LENGTH + pickup.distance
    const key = `${lapIndex}-${i}`
    if (
      previousDistance <= absoluteDistance &&
      race.distance >= absoluteDistance &&
      Math.abs(race.lane - pickup.lane) < 2 &&
      !race.collected.has(key)
    ) {
      race.collected.add(key)
      race.pickups++
      race.boost = Math.max(race.boost, 1.65)
    }
  }

  for (let i = 0; i < race.rivals.length; i++) {
    const rival = race.rivals[i]
    rival.distance += Math.min(rival.pace, race.elapsed * 20) * dt
    rival.lane = Math.sin(rival.distance / 65 + i * 1.8) * 4.8
    if (Math.abs(rival.distance - race.distance) < 2.6 && Math.abs(rival.lane - race.lane) < 1.8) {
      race.speed = Math.max(0, race.speed - 14 * dt)
      race.lane += (race.lane > rival.lane ? 1 : -1) * dt * 2
    }
  }

  if (Math.floor(race.distance / CIRCUIT_LENGTH) > lapIndex) {
    race.lapTimes.push(race.elapsed - race.lapStarted)
    race.lapStarted = race.elapsed
  }
  if (race.distance >= CIRCUIT_LENGTH * RACE_LAPS) race.status = "finished"
}
