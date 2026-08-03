/**
 * RAFFI WORLD — global state, data loading, seeded RNG, event bus.
 *
 * Everything downstream reads the parsed JSON from here. No module is allowed
 * to hardcode a world fact that lives in /data.
 */

// ---------------------------------------------------------------- RNG ---

/** mulberry32. Small, fast, reproducible across devices. */
export function createRng(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a — turns any string into a stable 32-bit seed. */
export function hashSeed(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Convenience wrapper with the helpers generators actually want. */
export function makeRng(seed) {
  const next = typeof seed === 'string' ? createRng(hashSeed(seed)) : createRng(seed)
  const range = (min, max) => min + next() * (max - min)
  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Weighted pick from `{key: weight}`. */
    weighted(map) {
      let total = 0
      for (const k in map) total += map[k]
      let r = next() * total
      for (const k in map) {
        r -= map[k]
        if (r <= 0) return k
      }
      return Object.keys(map)[0]
    },
    /** Deterministic sub-stream, so one generator can't desync another. */
    fork: (tag) => makeRng(hashSeed(tag + ':' + Math.floor(next() * 0xffffffff))),
  }
}

// -------------------------------------------------------------- utils ---

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
export function lerp(a, b, t) { return a + (b - a) * t }
/** Frame-rate independent damping. `rate` is roughly "units per second". */
export function damp(a, b, rate, dt) { return lerp(a, b, 1 - Math.exp(-rate * dt)) }
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** "#rrggbb" sRGB -> linear {r,g,b} floats for Three vertex colours. */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  const linear = (byte) => {
    const channel = byte / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  }
  return {
    r: linear((n >> 16) & 255),
    g: linear((n >> 8) & 255),
    b: linear(n & 255),
  }
}
export function hexToInt(hex) { return parseInt(hex.slice(1), 16) }

/** Sanitised, length-capped visitor name for ?to=NAME. Never trust the URL. */
export function sanitizeName(raw) {
  if (!raw) return null
  const cleaned = String(raw)
    // Allow only letters, numbers, spaces, apostrophes and hyphens.
    .replace(/[^\p{L}\p{N} '\-]/gu, '')
    // Collapse runs of whitespace so "?to=a%20%20%20b" can't pad the greeter.
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
  // Reject names that are only punctuation/whitespace (e.g. "?to=---"): a real
  // name needs at least one letter or number.
  if (!cleaned || !/[\p{L}\p{N}]/u.test(cleaned)) return null
  return cleaned.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

// -------------------------------------------------------- event bus ---

const listeners = new Map()

export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set())
    listeners.get(evt).add(fn)
    return () => bus.off(evt, fn)
  },
  off(evt, fn) { listeners.get(evt)?.delete(fn) },
  emit(evt, payload) {
    const set = listeners.get(evt)
    if (!set) return
    for (const fn of set) {
      try { fn(payload) } catch (err) { console.error('[bus]', evt, err) }
    }
  },
}

// ------------------------------------------------------- query params ---

const params = new URLSearchParams(location.search)

export const query = {
  debug: params.get('debug') === '1',
  seed: params.get('seed') || null,
  to: sanitizeName(params.get('to')),
  grade: params.get('grade'),
  district: params.get('district'),
  /** Audit harness hook: skips the start gate so screenshots need no click. */
  auto: params.get('auto') === '1',
  hour: params.has('hour') ? Number(params.get('hour')) : null,
  lowfi: params.get('lowfi') === '1',
}

// ------------------------------------------------------------ device ---

const coarse = matchMedia('(pointer: coarse)').matches
export const device = {
  touch: coarse || 'ontouchstart' in window,
  mobile: coarse && Math.min(screen.width, screen.height) < 820,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
}

// -------------------------------------------------------------- data ---

const DATA_FILES = ['world', 'blocks', 'props', 'vehicles', 'npcs', 'dialogue', 'missions', 'radio']

export const data = {}

/**
 * Loads all eight data files. `onProgress(fraction, label)` drives the boot bar.
 * Comment keys (`$foo`) are left in place — they are documentation for whoever
 * edits the JSON next, and the engine simply never reads them.
 */
export async function loadData(onProgress = () => {}) {
  const base = new URL('../data/', import.meta.url)
  let done = 0
  await Promise.all(
    DATA_FILES.map(async (name) => {
      const res = await fetch(new URL(name + '.json', base))
      if (!res.ok) throw new Error(`failed to load ${name}.json (${res.status})`)
      data[name] = await res.json()
      done++
      onProgress(done / DATA_FILES.length, name + '.json')
    })
  )
  return data
}

// ------------------------------------------------------------- state ---

/** The single mutable game state. Systems read it; only their owner writes. */
export const state = {
  ready: false,
  paused: false,
  time: 0,
  dt: 0,
  frame: 0,

  seed: 'port-vantage-v1',
  rng: null,

  /** 'foot' | 'vehicle' */
  mode: 'foot',
  district: null,
  interior: null,

  player: {
    x: 0, y: 0, z: 0,
    yaw: 0,
    vx: 0, vz: 0,
    speed: 0,
    running: false,
    vehicle: null,
    mountCameraHeight: null,
    mountMapRadius: null,
    health: 1,
  },

  navigation: { waypoint: null },

  camera: { x: 0, z: 0, yaw: 0, zoom: 1, orthoHeight: 46 },

  grade: { current: 'dusk', target: 'dusk', blend: 1, forced: null },

  radio: { on: false, stationIndex: 0, bpm: 92, beat: 0, bar: 0, beatPhase: 0 },

  compliance: { tier: 0, heat: 0, lastContact: -999 },

  mission: { active: null, objectiveIndex: 0, elapsed: 0, data: null },

  stats: { drawCalls: 0, triangles: 0, fps: 0 },

  debug: { on: query.debug, fly: false, wireframe: false, collide: false },
}

/** Called once data is parsed, before generation. */
export function initState() {
  state.seed = query.seed || data.world.seed
  state.rng = makeRng(state.seed)
  const spawn = data.world.spawn
  state.player.x = spawn.x
  state.player.z = spawn.z
  state.player.yaw = spawn.yaw
  state.district = spawn.district
  state.camera.x = spawn.x
  state.camera.z = spawn.z
  state.camera.yaw = (data.world.camera.yawDeg * Math.PI) / 180
  state.camera.orthoHeight = data.world.camera.orthoHeightFoot
  state.grade.current = query.grade || gradeForHour(currentHour())
  state.grade.target = state.grade.current
  return state
}

/** Local hour, overridable by ?hour= for deterministic audits. */
export function currentHour() {
  if (query.hour !== null && !Number.isNaN(query.hour)) return clamp(query.hour, 0, 23)
  return new Date().getHours()
}

/** Maps an hour to a grade using world.json's cycle table. */
export function gradeForHour(hour) {
  const cycle = data.world?.timeOfDay?.cycle
  if (!cycle) return 'dusk'
  for (const band of cycle) {
    const { fromHour: a, toHour: b, grade } = band
    if (a < b ? hour >= a && hour < b : hour >= a || hour < b) return grade
  }
  return 'dusk'
}

/** Lookup helpers so nothing else has to scan arrays. */
export function districtById(id) { return data.world.districts.find((d) => d.id === id) || null }
export function districtAt(x, z) {
  for (const d of data.world.districts) {
    const b = d.bounds
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return d
  }
  return null
}
export function line(id) { return data.dialogue.lines[id] || null }
