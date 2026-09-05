export const CRATE_QUEST_MESSAGE = 'raffi-world:crate-quest'

/** The embedded quest is available only during free roam at the record-store arrival. */
export function crateQuestContext(state, point, active, completed) {
  if (!point || active || completed || state.mode !== 'foot' || state.interior || state.mission.active) return null
  return {
    x: point.x, z: point.z, radius: 5,
    label: 'DIG', prompt: 'DIG THE BACK-ROOM CRATES', kind: 'crate-quest',
  }
}

/** Messages can only finish the current local quest, never supply score or world state. */
export function isCrateQuestReturn(event, parent, origin, active) {
  const value = event.data
  return !!active && event.source === parent && event.origin === origin &&
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 2 && value.type === CRATE_QUEST_MESSAGE &&
    (value.action === 'complete' || value.action === 'exit')
}
