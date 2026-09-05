export const DOCKYARD_WIDTH = 840
export const DOCKYARD_HEIGHT = 500
export const DOCKYARD_COSTS = { worker: 35, guard: 50, workshop: 80, sentry: 70 } as const
export type DockyardPhase = "briefing" | "playing" | "paused" | "won" | "lost"
export type DockyardPoint = { x: number; y: number }
export type DockyardUnit = DockyardPoint & {
  id: number
  team: "crew" | "rival"
  kind: "worker" | "guard" | "raider"
  hp: number
  maxHp: number
  target: DockyardPoint | null
  resourceId: number | null
  carried: number
  cooldown: number
}
export type DockyardBuilding = DockyardPoint & {
  id: number
  team: "crew" | "rival"
  kind: "hq" | "workshop" | "sentry"
  hp: number
  maxHp: number
  cooldown: number
}
export type DockyardResource = DockyardPoint & { id: number; amount: number }
export type DockyardEffect = DockyardPoint & {
  end?: DockyardPoint
  text?: string
  life: number
  team: "crew" | "rival"
}
export type DockyardState = {
  phase: DockyardPhase
  time: number
  scrap: number
  wave: number
  nextWave: number
  nextId: number
  units: DockyardUnit[]
  buildings: DockyardBuilding[]
  resources: DockyardResource[]
  effects: DockyardEffect[]
  message: string
}

const distance = (a: DockyardPoint, b: DockyardPoint) => Math.hypot(a.x - b.x, a.y - b.y)
const nearest = <T extends DockyardPoint>(from: DockyardPoint, items: T[]): T | undefined =>
  items.reduce<T | undefined>(
    (best, item) => (!best || distance(from, item) < distance(from, best) ? item : best),
    undefined,
  )

function makeUnit(state: DockyardState, kind: DockyardUnit["kind"], x: number, y: number): DockyardUnit {
  const hp = kind === "worker" ? 65 : kind === "guard" ? 110 : 70
  return {
    id: state.nextId++,
    team: kind === "raider" ? "rival" : "crew",
    kind,
    x,
    y,
    hp,
    maxHp: hp,
    target: null,
    resourceId: null,
    carried: 0,
    cooldown: 0,
  }
}

export function createDockyard(): DockyardState {
  const state: DockyardState = {
    phase: "briefing",
    time: 0,
    scrap: 110,
    wave: 0,
    nextWave: 45,
    nextId: 10,
    units: [],
    effects: [],
    message: "Select your workers, then send them to a salvage pile.",
    buildings: [
      { id: 1, kind: "hq", team: "crew", x: 125, y: 335, hp: 650, maxHp: 650, cooldown: 0 },
      { id: 2, kind: "hq", team: "rival", x: 712, y: 120, hp: 550, maxHp: 550, cooldown: 0 },
    ],
    resources: [
      { id: 3, x: 235, y: 300, amount: 300 },
      { id: 4, x: 178, y: 150, amount: 360 },
      { id: 5, x: 430, y: 360, amount: 450 },
      { id: 6, x: 520, y: 140, amount: 450 },
    ],
  }
  state.units.push(
    makeUnit(state, "worker", 95, 270),
    makeUnit(state, "worker", 125, 262),
    makeUnit(state, "worker", 155, 273),
    makeUnit(state, "guard", 198, 375),
  )
  return state
}

export function orderDockyard(state: DockyardState, ids: number[], point: DockyardPoint, resourceId?: number) {
  if (state.phase !== "playing") return
  const selected = state.units.filter((unit) => unit.team === "crew" && ids.includes(unit.id))
  selected.forEach((unit, index) => {
    unit.resourceId = unit.kind === "worker" && resourceId !== undefined ? resourceId : null
    unit.target = {
      x: Math.max(48, Math.min(DOCKYARD_WIDTH - 48, point.x + ((index % 3) - 1) * 18)),
      y: Math.max(55, Math.min(DOCKYARD_HEIGHT - 45, point.y + Math.floor(index / 3) * 18)),
    }
  })
  if (selected.length)
    state.message =
      resourceId !== undefined
        ? "Workers will bring salvage back to your HQ."
        : "Crew moving. Guards engage nearby rivals automatically."
}

/** The preview and the purchase share one placement rule; inspecting a site never spends salvage. */
export function dockyardBuildIssue(
  state: DockyardState,
  kind: "workshop" | "sentry",
  point: DockyardPoint,
): string | null {
  if (state.phase !== "playing") return "Resume the dock before building."
  const hq = state.buildings.find((building) => building.kind === "hq" && building.team === "crew")
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return "Choose a spot on the dock."
  if (!hq || distance(point, hq) > 260 || point.x < 55 || point.x > 785 || point.y < 65 || point.y > 435)
    return "Build on the dock within the dotted HQ supply radius."
  if (
    state.buildings.some((building) => distance(point, building) < 75) ||
    state.resources.some((resource) => resource.amount > 0 && distance(point, resource) < 48)
  )
    return "That spot is occupied. Leave room around buildings and salvage."
  if (state.scrap < DOCKYARD_COSTS[kind]) return "Gather more salvage before building."
  return null
}

export function buildDockyard(state: DockyardState, kind: "workshop" | "sentry", point: DockyardPoint): boolean {
  if (state.phase !== "playing") return false
  const issue = dockyardBuildIssue(state, kind, point)
  if (issue) {
    state.message = issue
    return false
  }
  const hp = kind === "sentry" ? 220 : 280
  state.scrap -= DOCKYARD_COSTS[kind]
  state.buildings.push({
    id: state.nextId++,
    team: "crew",
    kind,
    x: point.x,
    y: point.y,
    hp,
    maxHp: hp,
    cooldown: 0,
  })
  state.message =
    kind === "workshop"
      ? "Workshop online. Train guards to push toward the rival HQ."
      : "Sentry online. It protects nearby crew automatically."
  return true
}

export function trainDockyard(state: DockyardState, kind: "worker" | "guard"): boolean {
  if (state.phase !== "playing") return false
  if (state.units.filter((unit) => unit.team === "crew").length >= 24) {
    state.message = "Crew is full: 24 units. Protect the dock with sentries."
    return false
  }
  const building = state.buildings.find(
    (building) => building.team === "crew" && building.kind === (kind === "worker" ? "hq" : "workshop"),
  )
  if (!building) {
    state.message = "Build a workshop before training guards."
    return false
  }
  if (state.scrap < DOCKYARD_COSTS[kind]) {
    state.message = "Not enough salvage. Keep your workers gathering."
    return false
  }
  state.scrap -= DOCKYARD_COSTS[kind]
  state.units.push(makeUnit(state, kind, building.x + 38, Math.min(438, building.y + 35 + (state.nextId % 4) * 6)))
  state.message =
    kind === "worker"
      ? "Worker ready. Select workers and tap Gather."
      : "Guard ready. Select guards to defend or attack the rival HQ."
  return true
}

function move(unit: DockyardUnit, goal: DockyardPoint, dt: number, stoppingDistance = 0) {
  const remaining = distance(unit, goal)
  if (remaining <= stoppingDistance) return true
  const step = Math.min(
    remaining - stoppingDistance,
    dt * (unit.kind === "worker" ? 57 : unit.kind === "guard" ? 52 : 43),
  )
  unit.x += ((goal.x - unit.x) / remaining) * step
  unit.y += ((goal.y - unit.y) / remaining) * step
  return remaining - step <= stoppingDistance + 0.1
}

function strike(
  state: DockyardState,
  attacker: DockyardPoint & { team: "crew" | "rival"; cooldown: number },
  target: DockyardPoint & { hp: number },
  damage: number,
  cooldown: number,
) {
  if (attacker.cooldown > 0) return
  target.hp -= damage
  attacker.cooldown = cooldown
  state.effects.push({
    x: attacker.x,
    y: attacker.y,
    end: { x: target.x, y: target.y },
    life: 0.16,
    team: attacker.team,
  })
}

export function tickDockyard(state: DockyardState, delta: number) {
  if (state.phase !== "playing" || !Number.isFinite(delta) || delta <= 0) return
  const dt = Math.min(delta, 0.1)
  state.time += dt
  state.effects = state.effects.filter((effect) => {
    effect.life -= dt
    return effect.life > 0
  })
  if (state.time >= state.nextWave) {
    state.wave += 1
    state.nextWave += 35
    const count = Math.min(2 + Math.floor(state.wave / 2), 7)
    for (let i = 0; i < count; i++)
      state.units.push(makeUnit(state, "raider", 650 + (i % 3) * 27, 185 + Math.floor(i / 3) * 27))
    state.message = `Rival wave ${state.wave} approaching. Guards and sentries protect your HQ.`
  }
  const crewHq = state.buildings.find((building) => building.team === "crew" && building.kind === "hq")
  const rivalHq = state.buildings.find((building) => building.team === "rival" && building.kind === "hq")
  if (!crewHq || !rivalHq) return

  for (const unit of state.units) {
    if (unit.hp <= 0) continue
    unit.cooldown -= dt
    if (unit.kind === "worker") {
      let resource = state.resources.find((item) => item.id === unit.resourceId && item.amount > 0)
      if (!resource && unit.resourceId !== null) {
        resource = nearest(
          unit,
          state.resources.filter((item) => item.amount > 0),
        )
        unit.resourceId = resource?.id ?? null
      }
      if (unit.carried >= 15 || (!resource && unit.carried > 0)) {
        if (move(unit, crewHq, dt, 45)) {
          state.scrap += unit.carried
          state.effects.push({
            x: unit.x,
            y: unit.y,
            text: `+${Math.round(unit.carried)}`,
            life: 1.2,
            team: "crew",
          })
          unit.carried = 0
        }
      } else if (resource) {
        if (move(unit, resource, dt, 20)) {
          const collected = Math.min(resource.amount, dt * 7, 15 - unit.carried)
          unit.carried += collected
          resource.amount -= collected
        }
      } else if (unit.target && move(unit, unit.target, dt, 5)) unit.target = null
      continue
    }
    const enemyUnits = state.units.filter((other) => other.team !== unit.team && other.hp > 0)
    const nearby = nearest(
      unit,
      enemyUnits.filter((other) => distance(unit, other) < (unit.team === "crew" ? 125 : 170)),
    )
    const enemyBuildings = state.buildings.filter((building) => building.team !== unit.team && building.hp > 0)
    const nearbyBuilding = nearest(
      unit,
      enemyBuildings.filter((building) => distance(unit, building) < 140),
    )
    const target = nearby || nearbyBuilding || (unit.team === "rival" ? nearest(unit, enemyBuildings) : null)
    if (target) {
      const range = unit.kind === "guard" ? 87 : 38
      if (move(unit, target, dt, range))
        strike(state, unit, target, unit.kind === "guard" ? 16 : 10, unit.kind === "guard" ? 0.72 : 0.85)
    } else if (unit.target && move(unit, unit.target, dt, 6)) unit.target = null
  }

  for (const building of state.buildings) {
    if (building.hp <= 0 || building.kind === "workshop") continue
    building.cooldown -= dt
    const range = building.kind === "sentry" ? 170 : building.team === "crew" ? 145 : 105
    const target = nearest(
      building,
      state.units.filter((unit) => unit.team !== building.team && unit.hp > 0 && distance(building, unit) <= range),
    )
    if (target)
      strike(
        state,
        building,
        target,
        building.kind === "sentry" ? 21 : building.team === "crew" ? 13 : 10,
        building.kind === "sentry" ? 0.8 : 1.1,
      )
  }
  if (crewHq.hp <= 0) {
    state.phase = "lost"
    state.message = "Your HQ fell. Build sentries and keep a guard crew at home."
  } else if (rivalHq.hp <= 0) {
    state.phase = "won"
    state.message = "The rival HQ is down. The waterfront is yours."
  }
  state.units = state.units.filter((unit) => unit.hp > 0)
  state.buildings = state.buildings.filter((building) => building.hp > 0 || building.kind === "hq")
}
