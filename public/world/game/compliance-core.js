/**
 * Pure COMPLIANCE / Reply All Repaint rules.
 * Runtime wiring (HUD, dialogue, vehicle mesh) lives in compliance.js.
 */

/** @returns {ReadonlyArray<{id:string,district:string,at:{x:number,z:number},yaw?:number}>} */
export function listRepaintShops(worldData) {
  const shops = worldData?.repaintShops
  return Array.isArray(shops) ? shops.slice() : []
}

/** Authored bay / speed / copy. Never invent shop coordinates here. */
export function repaintTuning(worldData) {
  const r = worldData?.repaint || {}
  return {
    bayRadius: Number.isFinite(r.bayRadius) ? r.bayRadius : 6.5,
    maxClearSpeed: Number.isFinite(r.maxClearSpeed) ? r.maxClearSpeed : 2.5,
    label: r.label || 'REPLY ALL REPAINT',
    objective: r.objective || 'PARK AT REPLY ALL REPAINT',
    toast: r.toast || 'COMPLIANCE CLEARED',
    clearLines: Array.isArray(r.clearLines) && r.clearLines.length ? r.clearLines.slice() : ['repaint-1', 'repaint-2'],
    sfx: r.sfx || 'compliance-clear',
  }
}

export function createRepaintLatch() {
  return { shopId: null }
}

export function isInsideRepaintBay(shop, x, z, bayRadius) {
  if (!shop?.at || !Number.isFinite(x) || !Number.isFinite(z)) return false
  const r = Number.isFinite(bayRadius) ? bayRadius : 0
  return Math.hypot(shop.at.x - x, shop.at.z - z) <= r
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
 *
 * @returns {{
 *   action: 'none'|'clear',
 *   shop: object|null,
 *   reason: string,
 *   compliance: { tier: number, heat: number },
 *   latch: { shopId: string|null },
 * }}
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
  const bayRadius = tuning?.bayRadius ?? 6.5
  const maxSpeed = tuning?.maxClearSpeed ?? 2.5
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
