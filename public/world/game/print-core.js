/** Original two-colour print recipes and hands-on registration / ink coverage. */
export const PRINT_FORMATS = ['poster', 'sleeve', 'shirt']
export const PRINT_MOTIFS = ['sound-system', 'city-grid', 'park-lines']
export const PRINT_PALETTES = { 'night-shift': ['#192f4f', '#ee644a'], 'court-side': ['#287665', '#dda82d'], 'after-hours': ['#633983', '#ef7fa1'] }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export function normalizePrintDesign(value = {}) {
  return { format: PRINT_FORMATS.includes(value.format) ? value.format : 'poster', motif: PRINT_MOTIFS.includes(value.motif) ? value.motif : 'sound-system', palette: Object.hasOwn(PRINT_PALETTES, value.palette) ? value.palette : 'night-shift', title: String(value.title || 'BROOKLYN AFTER HOURS').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32) || 'BROOKLYN AFTER HOURS' }
}
export function createPrintJob(design, id) {
  return { id, design: normalizePrintDesign(design), phase: 'register', layer: 0, offset: { x: 9, y: -7 }, layers: [], coverage: Array(48).fill(0), previous: null }
}
export function movePrintRegistration(job, x, y) {
  if (job.phase !== 'register') return false
  job.offset = { x: clamp(x, -18, 18), y: clamp(y, -18, 18) }; return true
}
export function lockPrintRegistration(job) {
  if (job.phase !== 'register') return false
  job.phase = 'pull'; job.previous = null; return true
}
export function printCoverage(job) { return job.coverage.reduce((a, b) => a + b, 0) / job.coverage.length }
export function pullPrintInk(job, y, clock, pressure = .5) {
  if (job.phase !== 'pull' || !Number.isFinite(clock) || !Number.isFinite(y)) return false
  y = clamp(y, 0, 1)
  const prev = job.previous
  job.previous = { y, clock }
  if (!prev || clock <= prev.clock || clock - prev.clock > .35 || y <= prev.y) return false
  const speed = (y - prev.y) / (clock - prev.clock)
  // Slow, even passes deposit a full layer; a rushed pass can be corrected.
  const deposit = Math.round(clamp(1.15 - Math.max(0, speed - 1.2) * .25, .22, 1) * clamp(pressure * 2, .55, 1) * 100) / 100
  for (let i = 0; i < job.coverage.length; i++) { const center = (i + .5) / job.coverage.length; if (center >= prev.y - .025 && center <= y + .025) job.coverage[i] = Math.max(job.coverage[i], deposit) }
  return true
}
export function releasePrintPull(job) { job.previous = null }
export function finishPrintLayer(job) {
  if (job.phase !== 'pull' || printCoverage(job) < .88) return false
  job.layers.push({ offset: { ...job.offset }, coverage: job.coverage.map(v => Math.round(v * 100) / 100) })
  if (job.layer === 1) { job.phase = 'done'; job.previous = null }
  else { job.layer = 1; job.phase = 'register'; job.offset = { x: -7, y: 8 }; job.coverage.fill(0); job.previous = null }
  return true
}
export function printQuality(job) {
  if (job.layers.length !== 2) return 0
  return Math.round(job.layers.reduce((sum, layer) => sum + (layer.coverage.reduce((a, b) => a + b, 0) / 48) * clamp(1 - Math.hypot(layer.offset.x, layer.offset.y) / 40, .25, 1), 0) * 50)
}
export function emptyPrintProgress() { return { printed: 0, invited: false, recent: [], last: null } }
export function validatePrintProgress(raw) {
  if (raw == null) return { ok: true, state: emptyPrintProgress() }
  const fail = { ok: false, error: 'The saved print collection is damaged.' }
  if (!raw || !Number.isInteger(raw.printed) || raw.printed < 0 || raw.printed > 1000000 || typeof raw.invited !== 'boolean' || raw.invited !== (raw.printed > 0) || !Array.isArray(raw.recent) || raw.recent.length > 32 || raw.recent.some(id => typeof id !== 'string' || id.length > 80) || new Set(raw.recent).size !== raw.recent.length || raw.recent.length > raw.printed) return fail
  if (raw.printed === 0) return raw.last === null && raw.recent.length === 0 ? { ok: true, state: emptyPrintProgress() } : fail
  const last = raw.last
  if (!last || !raw.recent.includes(last.id) || !Array.isArray(last.layers) || last.layers.length !== 2 || typeof last.design?.title !== 'string' || last.design.title.length > 32 || !PRINT_FORMATS.includes(last.design.format) || !PRINT_MOTIFS.includes(last.design.motif) || !Object.hasOwn(PRINT_PALETTES, last.design.palette)) return fail
  for (const layer of last.layers) if (!layer || typeof layer !== 'object' || !Number.isFinite(layer.offset?.x) || !Number.isFinite(layer.offset?.y) || Math.abs(layer.offset.x) > 18 || Math.abs(layer.offset.y) > 18 || !Array.isArray(layer.coverage) || layer.coverage.length !== 48 || layer.coverage.some(v => !Number.isFinite(v) || v < 0 || v > 1) || layer.coverage.reduce((a, b) => a + b, 0) / 48 < .88) return fail
  return { ok: true, state: { printed: raw.printed, invited: raw.invited, recent: [...raw.recent], last: { id: last.id, design: normalizePrintDesign(last.design), layers: structuredClone(last.layers) } } }
}
export function recordPrint(progress, job) {
  if (job.phase !== 'done' || progress.recent.includes(job.id)) return { state: progress, added: false, invited: false }
  const next = { printed: Math.min(1000000, progress.printed + 1), invited: true, recent: [...progress.recent, job.id].slice(-32), last: { id: job.id, design: { ...job.design }, layers: structuredClone(job.layers) } }
  const valid = validatePrintProgress(next)
  return valid.ok ? { state: valid.state, added: true, invited: !progress.invited } : { state: progress, added: false, invited: false }
}
