/**
 * Pure COMPLIANCE / Reply All Repaint rules.
 * Runtime wiring (HUD, dialogue, vehicle mesh) lives in compliance.js.
 */

/** @returns {ReadonlyArray<{id:string,district:string,at:{x:number,z:number},yaw?:number}>} */
export function listRepaintShops(worldData) {
  const shops = worldData?.repaintShops
  return Array.isArray(shops) ? shops.slice() : []
}

/**
 * Authored bay / speed / copy. Required fields must come from world.repaint —
 * no silent defaults that hide missing data.
 * @throws {Error} when the contract is missing or invalid
 */
export function repaintTuning(worldData) {
  const r = worldData?.repaint
  if (!r || typeof r !== 'object') {
    throw new Error('world.repaint is required (bayRadius, maxClearSpeed, label, toast, clearLines)')
  }
  if (!Number.isFinite(r.bayRadius) || r.bayRadius <= 0) {
    throw new Error('world.repaint.bayRadius must be a finite number > 0')
  }
  if (!Number.isFinite(r.maxClearSpeed) || r.maxClearSpeed < 0) {
    throw new Error('world.repaint.maxClearSpeed must be a finite number >= 0')
  }
  if (typeof r.label !== 'string' || !r.label.trim()) {
    throw new Error('world.repaint.label must be a non-empty string')
  }
  if (typeof r.toast !== 'string' || !r.toast.trim()) {
    throw new Error('world.repaint.toast must be a non-empty string')
  }
  if (!Array.isArray(r.clearLines) || r.clearLines.length === 0 ||
      r.clearLines.some((line) => typeof line !== 'string' || !line.trim())) {
    throw new Error('world.repaint.clearLines must be a non-empty string array')
  }
  return {
    bayRadius: r.bayRadius,
    maxClearSpeed: r.maxClearSpeed,
    label: r.label,
    objective: typeof r.objective === 'string' && r.objective.trim() ? r.objective : r.label,
    toast: r.toast,
    clearLines: r.clearLines.slice(),
    sfx: typeof r.sfx === 'string' && r.sfx.trim() ? r.sfx : null,
  }
}

/** First clear uses clearLines[0]; then 1, 2, … wrapping. */
export function clearLineAt(clearCount, clearLines) {
  if (!Array.isArray(clearLines) || clearLines.length === 0) {
    throw new Error('clearLines must be a non-empty array')
  }
  const index = Math.max(0, Math.floor(Number(clearCount) || 0)) % clearLines.length
  return clearLines[index]
}

export function createRepaintLatch() {
  return { shopId: null }
}

export function isInsideRepaintBay(shop, x, z, bayRadius) {
  if (!shop?.at || !Number.isFinite(x) || !Number.isFinite(z)) return false
  if (!Number.isFinite(bayRadius) || bayRadius < 0) {
    throw new Error('bayRadius must be a finite number >= 0')
  }
  return Math.hypot(shop.at.x - x, shop.at.z - z) <= bayRadius
}

/** Nearest shop by Euclidean distance. Data-driven — no district hardcoding. */
export function nearestRepaintShop(shops, x, z) {
  if (!shops?.length || !Number.isFinite(x) || !Number.isFinite(z)) return null
  let best = null
  let bestD = Infinity
  for (const shop of shops) {
    if (!shop?.at) continue
    const d = Math.hypot(shop.at.x - x, shop.at.z - z)
    if (d < bestD) {
      bestD = d
      best = shop
    }
  }
  return best
}

export function shopAtPosition(shops, x, z, bayRadius) {
  for (const shop of shops || []) {
    if (isInsideRepaintBay(shop, x, z, bayRadius)) return shop
  }
  return null
}

/**
 * Drop the one-shot latch once the actor leaves the bay that last cleared.
 * @returns {{ shopId: string|null }}
 */
export function releaseRepaintLatch(latch, shops, x, z, bayRadius) {
  if (!latch?.shopId) return { shopId: null }
  const shop = (shops || []).find((item) => item.id === latch.shopId)
  if (!shop || !isInsideRepaintBay(shop, x, z, bayRadius)) return { shopId: null }
  return { shopId: latch.shopId }
}

/**
 * Decide whether this frame clears COMPLIANCE at a Reply All Repaint bay.
 *
 * Rules (WORLD-BIBLE §6 + gameplay contract):
 * - mounted vehicle only
 * - speed at or below authored maxClearSpeed (parked / crawling)
 * - tier or heat must be nonzero
 * - one-shot while remaining in the same bay (latch)
 * - leaving and returning with new heat can clear again
 */
export function evaluateRepaintClear({
  mounted,
  speed,
  tier,
  heat,
  x,
  z,
  shops,
  latch,
  tuning,
}) {
  if (!tuning || !Number.isFinite(tuning.bayRadius) || !Number.isFinite(tuning.maxClearSpeed)) {
    throw new Error('evaluateRepaintClear requires validated tuning (bayRadius, maxClearSpeed)')
  }
  const bayRadius = tuning.bayRadius
  const maxSpeed = tuning.maxClearSpeed
  const nextLatch = releaseRepaintLatch(latch, shops, x, z, bayRadius)
  const shop = shopAtPosition(shops, x, z, bayRadius)
  const cleared = { tier: 0, heat: 0 }

  if (!shop) {
    return { action: 'none', shop: null, reason: 'outside-bay', compliance: { tier, heat }, latch: nextLatch }
  }

  if (nextLatch.shopId === shop.id) {
    return {
      action: 'none',
      shop,
      reason: 'latched',
      compliance: { tier, heat },
      latch: nextLatch,
    }
  }

  // Mounted-only protection — unit tests assert this by name.
  if (!mounted) {
    return {
      action: 'none',
      shop,
      reason: 'not-mounted',
      compliance: { tier, heat },
      latch: nextLatch,
    }
  }

  const absSpeed = Math.abs(Number(speed) || 0)
  if (absSpeed > maxSpeed) {
    return {
      action: 'none',
      shop,
      reason: 'too-fast',
      compliance: { tier, heat },
      latch: nextLatch,
    }
  }

  if ((tier || 0) <= 0 && (heat || 0) <= 0) {
    return {
      action: 'none',
      shop,
      reason: 'already-clear',
      compliance: { tier: 0, heat: 0 },
      latch: nextLatch,
    }
  }

  return {
    action: 'clear',
    shop,
    reason: 'cleared',
    compliance: cleared,
    latch: { shopId: shop.id },
  }
}

/** Pure clear of the compliance struct. */
export function clearComplianceState(compliance = {}) {
  return {
    ...compliance,
    tier: 0,
    heat: 0,
  }
}

/**
 * Guidance bookkeeping when heat drops to zero away from a shop
 * (decay / debug). Never touches mission-owned waypoints.
 */
export function shouldClearRepaintWaypoint({ ownsWaypoint, missionActive, tier, heat }) {
  if (missionActive) return false
  if (!ownsWaypoint) return false
  return (tier || 0) <= 0 && (heat || 0) <= 0
}
