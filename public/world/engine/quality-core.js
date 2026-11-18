/**
 * RAFFI WORLD — automatic graphics quality, pure rules.
 *
 * Auto mode aims for the best picture the device holds at a steady frame
 * rate. It starts from what the GPU looks like, then a governor watches frame
 * times: when frames run long it first lowers the render resolution a step at
 * a time, and only then drops a tier; when frames have been short for a
 * while it raises resolution back, then tries the next tier up. A tier that
 * could not hold is remembered as the ceiling, so it never flip-flops.
 * No browser, storage or renderer effects here.
 */

export const TIERS = ['performance', 'balanced', 'high', 'ultra']

export const GOVERNOR = {
  /** Frames to ignore after any change: shader compiles and resizes. */
  warmup: 90,
  /** Exponential average weight per frame. */
  alpha: 0.06,
  /** Average frame time (ms) that counts as too slow (under ~48 fps). */
  slowMs: 21,
  /** Below this the frame has room to spare (a steady 60 fps or better). */
  fastMs: 17.6,
  /** Seconds of steady fast frames before trying for more. */
  fastHold: 6,
  /** Seconds frames must stay slow before anything is lowered: one hitch is not a trend. */
  slowHold: 1,
  /** One very long frame counts as this long at most. */
  frameCap: 100,
  /** Seconds between any two changes. */
  cooldown: 2.5,
  /** A probe that turns slow within this many seconds is undone. */
  probeWindow: 8,
  minScale: 0.7,
  scaleStep: 0.1,
}

const index = (tier) => Math.max(0, TIERS.indexOf(tier))

/**
 * What kind of GPU a WebGL renderer string describes. Software renderers are
 * what headless CI and some locked-down machines use; they get the lightest
 * tier and stay there.
 */
export function classifyGpu(renderer = '', { mobile = false } = {}) {
  const name = String(renderer).toLowerCase()
  if (/swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|lavapipe/.test(name)) return 'software'
  if (mobile) {
    // Recent Apple and Adreno 7xx parts are console-class; the rest are not.
    if (/apple (a1[5-9]|m\d)|apple gpu|adreno.{0,12}7\d\d|adreno.{0,12}8\d\d/.test(name)) return 'mobile-high'
    return 'mobile'
  }
  if (/nvidia|geforce|quadro|rtx|gtx|radeon (rx|pro|vii)|radeon\(tm\) (rx|pro)|\brx \d{3,4}|arc\(tm\) a|intel.{0,12}arc|apple m\d (pro|max|ultra)/.test(name)) return 'discrete'
  if (/apple m\d|apple gpu/.test(name)) return 'apple'
  if (/intel|uhd|iris|radeon\(tm\) graphics|radeon graphics|vega \d|mali|adreno|powervr/.test(name)) return 'integrated'
  return 'unknown'
}

/** Where auto mode starts, and the highest tier it may ever try. */
export function startPlan(gpuClass) {
  switch (gpuClass) {
    case 'software': return { tier: 'performance', ceiling: 'performance' }
    case 'mobile': return { tier: 'performance', ceiling: 'balanced' }
    case 'mobile-high': return { tier: 'balanced', ceiling: 'high' }
    case 'discrete': return { tier: 'high', ceiling: 'ultra' }
    case 'apple': return { tier: 'high', ceiling: 'ultra' }
    case 'integrated': return { tier: 'balanced', ceiling: 'high' }
    default: return { tier: 'balanced', ceiling: 'ultra' }
  }
}

/** Applies a ceiling learned on this device in an earlier visit. */
export function applyLearnedCeiling(plan, learned) {
  if (!TIERS.includes(learned)) return plan
  const ceiling = TIERS[Math.min(index(plan.ceiling), index(learned))]
  return { tier: TIERS[Math.min(index(plan.tier), index(ceiling))], ceiling }
}

export function createGovernor({ tier, ceiling, scale = 1 }) {
  return { tier, ceiling, scale, average: 16.7, samples: 0, fastFor: 0, slowFor: 0, lastChange: -Infinity, probe: null }
}

/**
 * Feeds one frame. `frameMs` is the time since the previous frame; `now` is
 * seconds. Returns null, or the change to make: { scale } or { tier, scale }.
 * The governor state is updated to match the change it returns.
 */
export function stepGovernor(governor, frameMs, now, tuning = GOVERNOR) {
  if (!(frameMs > 0) || frameMs > 1000) return null
  governor.average += (Math.min(frameMs, tuning.frameCap) - governor.average) * tuning.alpha
  if (++governor.samples < tuning.warmup) return null
  governor.fastFor = governor.average < tuning.fastMs ? governor.fastFor + frameMs / 1000 : 0
  governor.slowFor = governor.average > tuning.slowMs ? governor.slowFor + frameMs / 1000 : 0
  const slow = governor.slowFor >= tuning.slowHold
  // A tier that was being tried and could not hold goes back, and becomes the limit.
  if (governor.probe && slow && now - governor.probe.at <= tuning.probeWindow) {
    const back = governor.probe.from
    governor.ceiling = back
    governor.probe = null
    return change(governor, { tier: back, scale: 1 }, now)
  }
  if (governor.probe && now - governor.probe.at > tuning.probeWindow) governor.probe = null
  if (now - governor.lastChange < tuning.cooldown) return null
  if (slow) {
    if (governor.scale > tuning.minScale + 1e-6) return change(governor, { scale: round(Math.max(tuning.minScale, governor.scale - tuning.scaleStep)) }, now)
    if (index(governor.tier) > 0) {
      const lower = TIERS[index(governor.tier) - 1]
      // Falling out of a tier means it is too much for this device.
      governor.ceiling = TIERS[Math.min(index(governor.ceiling), index(lower))]
      return change(governor, { tier: lower, scale: 1 }, now)
    }
    return null
  }
  if (governor.fastFor < tuning.fastHold) return null
  if (governor.scale < 1 - 1e-6) return change(governor, { scale: round(Math.min(1, governor.scale + tuning.scaleStep)) }, now)
  if (index(governor.tier) < index(governor.ceiling)) {
    governor.probe = { from: governor.tier, at: now }
    return change(governor, { tier: TIERS[index(governor.tier) + 1], scale: 1 }, now)
  }
  return null
}

function change(governor, next, now) {
  if (next.tier) governor.tier = next.tier
  governor.scale = next.scale
  governor.lastChange = now
  governor.samples = 0
  governor.fastFor = 0
  governor.slowFor = 0
  governor.average = 16.7
  return next
}

const round = (value) => Math.round(value * 100) / 100
