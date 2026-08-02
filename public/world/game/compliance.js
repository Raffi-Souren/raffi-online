/**
 * RAFFI WORLD — Reply All Repaint runtime + compliance tier orchestration.
 *
 * Compiles shop locations from data/world.json, clears COMPLIANCE when a
 * mounted vehicle parks in a bay, and routes free-roam players with heat to
 * the nearest shop without overwriting an active mission waypoint.
 */

import { state, data, bus } from '../engine/state.js'
import { setCompliance, setWaypoint, getWaypoint, toast } from './hud.js'
import { queueDialogue } from './dialogue.js'
import { player } from './player.js'
import { repaint } from '../gen/vehicles.js'
import {
  listRepaintShops,
  repaintTuning,
  createRepaintLatch,
  nearestRepaintShop,
  evaluateRepaintClear,
  clearComplianceState,
  clearLineAt,
  shouldClearRepaintWaypoint,
} from './compliance-core.js'

let latch = createRepaintLatch()
/** True while the navigator waypoint was last set by compliance guidance. */
let ownsWaypoint = false
let clearCount = 0
/** Optional pursuit hooks — set by initCompliance({ onClear, onTierChange }). */
let hooks = { onClear: null, onTierChange: null, onUpdate: null }

export function initCompliance(options = {}) {
  latch = createRepaintLatch()
  ownsWaypoint = false
  clearCount = 0
  hooks = {
    onClear: options.onClear || null,
    onTierChange: options.onTierChange || null,
    onUpdate: options.onUpdate || null,
  }
  // Validate contract at boot so missing tuning fails loudly.
  repaintTuning(data.world)
}

export function complianceSnapshot() {
  return {
    tier: state.compliance.tier,
    heat: state.compliance.heat,
    latchShopId: latch.shopId,
    ownsWaypoint,
    clearCount,
    shops: listRepaintShops(data.world).map((shop) => shop.id),
  }
}

/** Debug / audit helper — does not fake pursuers. */
export function setComplianceTier(tier, heat = state.compliance.heat) {
  const prev = state.compliance.tier
  const next = Math.max(0, Math.min(5, Math.floor(Number(tier) || 0)))
  state.compliance.tier = next
  state.compliance.heat = Math.max(0, Number(heat) || 0)
  setCompliance(state.compliance.tier)
  updateRepaintGuidance()
  if (prev !== next) hooks.onTierChange?.(next, prev)
  return complianceSnapshot()
}

export function updateCompliance(dt = 0) {
  if (!data.world) return

  const shops = listRepaintShops(data.world)
  const tuning = repaintTuning(data.world)
  const mounted = state.mode === 'vehicle' && !!player.vehicle
  const speed = mounted
    ? (player.vehicle.speed ?? state.player.speed ?? 0)
    : (state.player.speed ?? 0)

  const decision = evaluateRepaintClear({
    mounted,
    speed,
    tier: state.compliance.tier,
    heat: state.compliance.heat,
    x: state.player.x,
    z: state.player.z,
    shops,
    latch,
    tuning,
  })
  latch = decision.latch

  if (decision.action === 'clear' && decision.shop) {
    applyRepaintClear(decision.shop, tuning)
  }

  updateRepaintGuidance()
  hooks.onUpdate?.(dt)
}

function applyRepaintClear(shop, tuning) {
  // Tier / heat reset — unit + browser mutation tests assert this by name.
  Object.assign(state.compliance, clearComplianceState(state.compliance))
  setCompliance(0)

  // Generated-geometry repaint path — must run for colour-buffer assertions.
  if (player.vehicle?.mesh) {
    const seed = `${state.seed}:repaint:${shop.id}:${clearCount}`
    repaint(player.vehicle.mesh, data.vehicles, seed)
  }

  // First clear uses clearLines[0]; then alternate in authored order.
  const line = clearLineAt(clearCount, tuning.clearLines)
  clearCount += 1
  queueDialogue(line, { duration: 3.2 })
  toast(tuning.toast, 3.2)
  if (tuning.sfx) bus.emit('sfx', tuning.sfx)

  if (ownsWaypoint && !state.mission.active) {
    ownsWaypoint = false
    setWaypoint(null)
  }

  // Pursuit cancel is mandatory when repaint clears heat.
  hooks.onClear?.(shop)
}

/**
 * When free of an active mission and carrying heat, point the minimap at the
 * nearest authored shop. Never replaces an active mission waypoint.
 * If heat drops to zero away from a shop, drop a compliance-owned waypoint.
 */
function updateRepaintGuidance() {
  if (state.mission.active) {
    ownsWaypoint = false
    return
  }

  if (shouldClearRepaintWaypoint({
    ownsWaypoint,
    missionActive: !!state.mission.active,
    tier: state.compliance.tier,
    heat: state.compliance.heat,
  })) {
    ownsWaypoint = false
    setWaypoint(null)
    return
  }

  if (state.compliance.tier <= 0 && state.compliance.heat <= 0) {
    return
  }

  const shops = listRepaintShops(data.world)
  const tuning = repaintTuning(data.world)
  const nearest = nearestRepaintShop(shops, state.player.x, state.player.z)
  if (!nearest?.at) return

  const current = getWaypoint()
  const sameTarget = current &&
    Math.hypot(current.x - nearest.at.x, current.z - nearest.at.z) < 0.05 &&
    current.label === tuning.label

  if (!sameTarget) {
    setWaypoint(nearest.at, tuning.label)
  }
  ownsWaypoint = true
}

/** Test hook: expose whether compliance currently owns the waypoint. */
export function complianceOwnsWaypoint() {
  return ownsWaypoint
}
