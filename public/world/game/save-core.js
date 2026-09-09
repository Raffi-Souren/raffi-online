/** Versioned checkpoint records. This module has no browser or storage effects. */
import { validateSportsProgress } from './sports-core.js'
import { validatePrintProgress } from './print-core.js'
import { validateStoryState } from './story-core.js'
import { missionPrerequisitesMet } from './mission-core.js'

export const SAVE_VERSION = 1
export const SAVE_SLOTS = ['auto', 'slot-1', 'slot-2', 'slot-3']
export const SAVE_PREFIX = 'raffi-world:save:v1:'

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const fail = (error) => ({ ok: false, error, save: null })

export function campaignUnlocks(completed, missions) {
  const result = new Set(missions.filter((mission) => !mission.unlockedBy).map((mission) => mission.id))
  for (const mission of missions) {
    if (!completed.includes(mission.id)) continue
    result.add(mission.id)
    for (const id of mission.reward?.unlocks || []) result.add(id)
  }
  return [...result]
}

export function stationUnlocks(completed, stations, missions) {
  const rewards = new Set(missions.filter((mission) => completed.includes(mission.id))
    .flatMap((mission) => mission.reward?.radioUnlock || []))
  return stations.filter((station) => !station.unlockedBy || completed.includes(station.unlockedBy) || rewards.has(station.id))
    .map((station) => station.id)
}

/** Invalid saves remain untouched in storage; loading them never partially mutates a game. */
export function validateSaveRecord(source, catalog) {
  let value = source
  if (typeof source === 'string') {
    if (source.length > 32_768) return fail('This save is too large to read safely.')
    try { value = JSON.parse(source) } catch { return fail('This save is damaged and could not be read.') }
  }
  if (!object(value) || value.version !== SAVE_VERSION) return fail('This save uses an unsupported version.')
  if (typeof value.seed !== 'string' || !value.seed.length || value.seed.length > 128) return fail('This save has no valid city seed.')
  if (!finite(value.savedAt) || value.savedAt <= 0 || !finite(value.playSeconds) || value.playSeconds < 0) return fail('This save has an invalid clock.')
  const p = value.player
  if (!object(p) || !finite(p.x) || !finite(p.z) || !finite(p.yaw)) return fail('This save has an invalid player position.')
  const bounds = catalog.world.bounds
  if (p.x < bounds.minX + 6 || p.x > bounds.maxX - 6 || p.z < bounds.minZ + 6 || p.z > bounds.maxZ - 6 ||
      (catalog.world.harbor || []).some((b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ)) {
    return fail('This save points outside the playable city.')
  }
  const missions = catalog.missions.missions
  const known = new Set([...missions.map((mission) => mission.id), 'crate-quest'])
  if (!Array.isArray(value.completed) || value.completed.length > known.size || value.completed.some((id) => !known.has(id))) return fail('This save contains an unknown mission.')
  const completed = [...new Set(value.completed)]
  if (missions.some((mission) => completed.includes(mission.id) && !missionPrerequisitesMet(mission, completed, missions))) return fail('This save has inconsistent campaign progress.')
  const unlocked = campaignUnlocks(completed, missions)
  const activeMission = value.activeMission ?? null
  if (activeMission !== null) {
    const active = missions.find((mission) => mission.id === activeMission)
    if (!active || !unlocked.includes(active.id) || completed.includes(active.id) || !missionPrerequisitesMet(active, completed, missions)) return fail('This save cannot resume its mission checkpoint.')
  }
  const stations = catalog.radio.stations
  const radioUnlocked = stationUnlocks(completed, stations, missions)
  if (!object(value.radio) || typeof value.radio.on !== 'boolean' || !stations.some((station) => station.id === value.radio.station)) return fail('This save has an invalid radio station.')
  if (value.radio.unlocked !== undefined) {
    if (!Array.isArray(value.radio.unlocked) || value.radio.unlocked.length > stations.length || value.radio.unlocked.some((id) => !stations.some((station) => station.id === id))) return fail('This save has invalid radio unlocks.')
    for (const id of value.radio.unlocked) if (!radioUnlocked.includes(id)) radioUnlocked.push(id)
  }
  const radioStation = radioUnlocked.includes(value.radio.station) ? value.radio.station : radioUnlocked[0]
  const grade = value.grade ?? null
  if (grade !== null && (!Object.hasOwn(catalog.world.grades, grade) || grade.startsWith('$'))) return fail('This save has an invalid colour grade.')
  let vehicle = null
  if (value.vehicle != null) {
    if (!object(value.vehicle) || !Object.hasOwn(catalog.vehicles.archetypes, value.vehicle.archetype) || value.vehicle.archetype.startsWith('$')) return fail('This save has an unknown ride.')
    if (value.vehicle.sourceId != null && (typeof value.vehicle.sourceId !== 'string' || value.vehicle.sourceId.length < 1 || value.vehicle.sourceId.length > 96 || /[\x00-\x1f]/.test(value.vehicle.sourceId))) return fail('This save has an invalid ride reference.')
    vehicle = { archetype: value.vehicle.archetype }
    if (value.vehicle.sourceId != null) vehicle.sourceId = value.vehicle.sourceId
  }
  const sports = validateSportsProgress(value.sports)
  if (!sports.ok) return fail(sports.error)
  const printing = validatePrintProgress(value.printing)
  if (!printing.ok) return fail(printing.error)
  if (printing.state.invited && stations.some(station => station.id === 'KFLP') && !radioUnlocked.includes('KFLP')) radioUnlocked.push('KFLP')
  const story = validateStoryState(value.story, catalog.conversations)
  if (!story.ok) return fail(story.error)
  return {
    ok: true,
    error: null,
    save: {
      version: SAVE_VERSION, seed: value.seed, savedAt: value.savedAt,
      playSeconds: Math.min(value.playSeconds, 31_536_000),
      player: { x: p.x, z: p.z, yaw: ((p.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) },
      completed, unlocked, activeMission, story: story.state, sports: sports.state, printing: printing.state,
      radio: { on: value.radio.on, station: radioStation, unlocked: radioUnlocked },
      grade, vehicle: activeMission ? null : vehicle,
    },
  }
}

export function saveSummary(save, catalog) {
  const mission = catalog.missions.missions.find((item) => item.id === save.activeMission)
  const district = catalog.world.districts.find(({ bounds: b }) => save.player.x >= b.minX && save.player.x <= b.maxX && save.player.z >= b.minZ && save.player.z <= b.maxZ)
  return {
    savedAt: save.savedAt,
    completed: save.completed.filter((id) => id !== 'crate-quest').length,
    total: catalog.missions.missions.length,
    location: mission ? mission.name + ' · briefing checkpoint' : district?.name || 'NEW YORK',
    playSeconds: save.playSeconds,
    checkpoint: Boolean(mission),
    story: save.story?.branch ? { branch: save.story.branch, stage: save.story.stage, trust: save.story.trust, gigs: save.story.gigs, obligation: save.story.escrow ? '$' + save.story.escrow + ' deposit held' : save.story.favorsOwed ? 'Flyer-run favor owed' : null } : null,
  }
}
