/**
 * Downtown Dig colors, organised by role so readability is testable.
 *
 * The rule the level follows: the far and mid planes (sky, skyline, el train,
 * brownstones) stay dark and cool, while everything the player can stand on,
 * collect or must avoid is lighter, warmer and outlined. Amber is reserved for
 * rewards (records, ? blocks); pink-red is reserved for danger. Decorative lit
 * windows use a dimmer brass so they never read as a pickup.
 *
 * These values are a starting point. Tune them freely, but keep
 * lib/crate-run-palette.test.ts green.
 */
export const DIG_COLORS = {
  // Far plane
  skyTop: "#0b1122",
  skyHorizon: "#1f2a46",
  skyline: "#161f38",
  elTrack: "#121a2e",
  trainBody: "#59627a",
  // Mid plane (always drawn fully opaque so nothing ghosts through)
  brownstone: "#3a2129",
  brownstoneTrim: "#24151b",
  windowLit: "#8f6a3a",
  windowDark: "#1a2033",
  // Play plane
  sidewalk: "#e9dfc4",
  sidewalkFace: "#b8ad93",
  brickBlock: "#e0704a",
  mortar: "#f6e6c2",
  stoop: "#c9b38c",
  stoopTread: "#f3e8c8",
  fireEscape: "#b3c8dc",
  fireEscapeRail: "#e8f1fa",
  speakerBody: "#0b0f19",
  speakerRim: "#e9e2cc",
  usedBlock: "#8a7d6b",
  questionBlock: "#ffc94a",
  questionGlyph: "#7d3122",
  pitVoid: "#03050a",
  outline: "#05070c",
  // Actors
  player: "#3fd0c9",
  playerSkin: "#f2c9a0",
  recordDisc: "#121826",
  recordRim: "#f6ecc9",
  recordLabel: "#ffc94a",
  enemyBody: "#c9d3df",
  enemyRim: "#ff5c7a",
  // HUD
  hudText: "#f3e8bf",
  hudBg: "#121826",
} as const

export type DigColor = keyof typeof DIG_COLORS

/** Planes the player looks through. Every gameplay object must separate from each. */
export const DIG_BACKGROUNDS: DigColor[] = ["skyTop", "skyHorizon", "brownstone"]
/** Things you can stand on or bump. */
export const DIG_SOLIDS: DigColor[] = ["sidewalk", "brickBlock", "stoop", "fireEscape", "speakerRim", "usedBlock", "questionBlock"]
/** Decorative highlights that must recede behind gameplay. */
export const DIG_DECOR: DigColor[] = ["windowLit", "skyline", "trainBody"]

function channel(value: number) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string) {
  const h = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two hex colors (1 to 21). */
export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Hue in degrees (0 to 360) for telling reward and danger colors apart. */
export function hue(hex: string) {
  const h = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  const raw = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (raw * 60 + 360) % 360
}
