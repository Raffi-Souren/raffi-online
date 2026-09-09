/** A small live-print popup: design, register two screens, pull ink, keep the edition. */
import * as THREE from 'three'
import { state, data, bus } from '../engine/state.js'
import { resetInput } from '../engine/input.js'
import { makePed } from '../gen/peds.js'
import { MeshBuilder } from '../gen/builder.js'
import { PRINT_FORMATS, PRINT_MOTIFS, PRINT_PALETTES, normalizePrintDesign, createPrintJob, movePrintRegistration, lockPrintRegistration, pullPrintInk, releasePrintPull, finishPrintLayer, printCoverage, printQuality, emptyPrintProgress, recordPrint, validatePrintProgress } from './print-core.js'
import { drawPrintArt } from './print-art.js'

const HOST = { x: -333, z: -403, radius: 3.5 }
let deps, root, canvas, instructions, buttons, designForm, title, progress = emptyPrintProgress(), design = normalizePrintDesign(), job = null, opened = false, dragging = null, paper, cursor = 0, status, invitation, displayCanvas, displayTexture
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node }
const button = (text, fn) => { const node = el('button', '', text); node.type = 'button'; node.addEventListener('click', fn); return node }
function release() { dragging = null; if (job) releasePrintPull(job) }

export function initPrintStudio(options) {
  deps = options
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./print-studio.css', import.meta.url).href; document.head.append(css)
  root = el('section', 'print-studio hidden'); root.id = 'print-studio'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'print-title')
  const card = el('div', 'print-card'), header = el('header', 'print-header'); title = el('h2', '', 'NEIGHBORHOOD EDITIONS'); title.id = 'print-title'; header.append(el('span', 'print-edition', 'LIVE PRINT / NYC'), title, button('Back to Brooklyn ×', closePrintStudio))
  const body = el('div', 'print-body'), workbench = el('div', 'print-workbench'); canvas = el('canvas'); canvas.width = 600; canvas.height = 720; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Print workbench. Arrow keys align your screen. Hold Space to pull ink down. You can also drag the screen and squeegee.'); workbench.append(canvas)
  const side = el('div', 'print-sidebar'); side.append(el('p', 'print-person', 'MAE / THE LIVE-PRINT TABLE')); instructions = el('p', 'print-instructions'); instructions.setAttribute('aria-live', 'polite'); status = el('p', 'print-status'); status.setAttribute('aria-live', 'polite'); invitation = el('p', 'print-invitation hidden')
  designForm = el('form', 'print-design')
  for (const [id, label, values] of [['format', 'Make something', PRINT_FORMATS], ['motif', 'Artwork', PRINT_MOTIFS], ['palette', 'Two inks', Object.keys(PRINT_PALETTES)]]) {
    const row = el('label', '', label), select = el('select'); select.name = id
    for (const value of values) { const option = el('option', '', value.replaceAll('-', ' ')); option.value = value; select.append(option) }
    select.value = design[id]; select.addEventListener('change', () => { design[id] = select.value; draw() }); row.append(select); designForm.append(row)
  }
  const caption = el('label', '', 'Your headline'), input = el('input'); input.name = 'title'; input.maxLength = 32; input.value = design.title; input.autocomplete = 'off'; input.addEventListener('input', () => { design.title = normalizePrintDesign({ ...design, title: input.value }).title; draw() }); caption.append(input); designForm.append(caption); designForm.addEventListener('submit', event => { event.preventDefault(); begin() })
  buttons = el('div', 'print-buttons'); side.append(instructions, designForm, status, invitation, buttons, el('p', 'print-note', 'Inspired by Raffi’s NYC live-print and popup work. Original artwork, made here by you.')); body.append(workbench, side); card.append(header, body); root.append(card); document.body.append(root)
  canvas.addEventListener('pointerdown', event => {
    if (!job || job.phase === 'done') return
    event.preventDefault(); canvas.setPointerCapture(event.pointerId); canvas.focus(); const point = canvasPoint(event)
    dragging = { id: event.pointerId, x: point.x, y: point.y, offset: { ...job.offset } }
    if (job.phase === 'pull') { cursor = Math.max(0, Math.min(1, (point.y - paper.y) / paper.h)); pullPrintInk(job, cursor, performance.now() / 1000, event.pressure || .5) }
  })
  canvas.addEventListener('pointermove', event => {
    if (!dragging || dragging.id !== event.pointerId || !job) return
    const point = canvasPoint(event)
    if (job.phase === 'register') movePrintRegistration(job, dragging.offset.x + point.x - dragging.x, dragging.offset.y + point.y - dragging.y)
    else if (job.phase === 'pull') { cursor = Math.max(0, Math.min(1, (point.y - paper.y) / paper.h)); pullPrintInk(job, cursor, performance.now() / 1000, event.pressure || .5) }
    draw(); updateStatus()
  })
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, release)
  window.addEventListener('keydown', event => {
    if (!opened) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closePrintStudio(); return }
    if (event.target !== canvas || !job) return
    if (job.phase === 'register' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); movePrintRegistration(job, job.offset.x + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0), job.offset.y + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)); draw(); updateStatus() }
    if (job.phase === 'pull' && event.code === 'Space') { event.preventDefault(); if (!event.repeat) { cursor = 0; releasePrintPull(job); pullPrintInk(job, 0, performance.now() / 1000); dragging = { keyboard: true } } }
  }, true)
  window.addEventListener('keyup', event => { if (event.code === 'Space' && dragging?.keyboard) release() }, true)
  root.addEventListener('keydown', event => { if (event.key !== 'Tab') return; const nodes = [...root.querySelectorAll('button:not([disabled]),input,select,canvas')].filter(n => n.getClientRects().length), i = nodes.indexOf(document.activeElement); if (event.shiftKey && i <= 0) { event.preventDefault(); nodes.at(-1)?.focus() } else if (!event.shiftKey && i === nodes.length - 1) { event.preventDefault(); nodes[0]?.focus() } })
  document.addEventListener('visibilitychange', release)
  window.addEventListener('blur', release)
  window.addEventListener('message', event => { if (event.source === window.parent && event.origin === location.origin && event.data?.type === 'raffi-world:activity') release() })
  buildStand(); showDesign()
}
function canvasPoint(event) { const b = canvas.getBoundingClientRect(), scale = Math.min(b.width / 600, b.height / 720); return { x: (event.clientX - b.x - (b.width - 600 * scale) / 2) / scale, y: (event.clientY - b.y - (b.height - 720 * scale) / 2) / scale } }
function draw() {
  const active = job && job.phase !== 'done' ? { layer: job.layer, offset: job.offset, coverage: job.phase === 'register' ? Array(48).fill(.6) : job.coverage } : null
  paper = drawPrintArt(canvas.getContext('2d'), job?.design || design, job?.layers || null, active, job?.phase === 'register')
  if (job?.phase === 'pull') {
    const ctx = canvas.getContext('2d'), y = paper.y + cursor * paper.h
    ctx.fillStyle = '#ad7550'; ctx.fillRect(paper.x - 8, y - 12, paper.w + 16, 20); ctx.fillStyle = '#323e36'; ctx.fillRect(paper.x - 8, y + 8, paper.w + 16, 5)
    ctx.fillStyle = '#fff4d9'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PULL DOWN', paper.x + paper.w / 2, y + 2); ctx.textAlign = 'left'
  }
}
function showDesign() {
  release(); job = null; title.textContent = 'NEIGHBORHOOD EDITIONS'; designForm.classList.remove('hidden'); invitation.classList.add('hidden')
  instructions.textContent = progress.printed ? `“I remember your ${progress.last.design.format}. Make another edition, or pull up the one you kept.”` : '“Pick a poster, record sleeve or shirt. Design it, line up two screens, and pull your own ink. A little misregistration has character.”'
  buttons.replaceChildren(button('Set up the first screen', begin)); if (progress.last) buttons.append(button('See my last print', () => { job = { ...structuredClone(progress.last), phase: 'done', layer: 1 }; showResult(false) }))
  status.textContent = 'Choose a format, artwork and two-ink palette. Your headline belongs to this print.'; draw()
}
function begin() { job = createPrintJob(design, globalThis.crypto?.randomUUID?.() || `print-${Date.now()}-${Math.random().toString(36).slice(2)}`); designForm.classList.add('hidden'); invitation.classList.add('hidden'); showStage() }
function showStage() {
  release(); cursor = 0; title.textContent = `SCREEN ${job.layer + 1} / 2`
  instructions.textContent = job.phase === 'register' ? '“Move the screen until the red circles sit on the black registration crosses. Drag, use the arrows, or nudge with the buttons. You decide when it is ready.”' : '“Start above the paper and pull down steadily. Cover the whole print. Thin areas? Make another pass before lifting the screen.”'
  buttons.replaceChildren()
  if (job.phase === 'register') {
    const nudges = el('div', 'print-nudges')
    for (const [label, x, y] of [['←', -1, 0], ['↑', 0, -1], ['↓', 0, 1], ['→', 1, 0]]) nudges.append(button(label, () => { movePrintRegistration(job, job.offset.x + x, job.offset.y + y); draw(); updateStatus() }))
    buttons.append(nudges, button('Clamp screen · add ink', () => { lockPrintRegistration(job); showStage() }))
  } else {
    const lift = button(job.layer === 0 ? 'Lift screen · second colour' : 'Lift screen · keep my print', () => { if (!finishPrintLayer(job)) return; if (job.phase === 'done') showResult(true); else showStage() }); lift.dataset.printLift = ''; buttons.append(lift)
  }
  buttons.append(button('Start a different design', showDesign)); draw(); updateStatus(); canvas.focus()
}
function updateStatus() {
  if (!job) return
  if (job.phase === 'register') status.textContent = `Registration offset: ${Math.round(job.offset.x)} across / ${Math.round(job.offset.y)} down. Small offsets print cleaner.`
  else if (job.phase === 'pull') { const coverage = Math.floor(printCoverage(job) * 100); status.textContent = `${coverage}% ink coverage · drag from top to bottom, or hold Space on the workbench.`; const lift = buttons.querySelector('[data-print-lift]'); if (lift) lift.disabled = printCoverage(job) < .88 }
}
function showResult(accept) {
  release(); designForm.classList.add('hidden'); title.textContent = 'YOUR EDITION / PULLED BY HAND'
  let newlyInvited = false
  if (accept) {
    const saved = recordPrint(progress, job)
    if (!saved.added && !progress.recent.includes(job.id)) {
      instructions.textContent = 'This edition could not be added to the collection. Your other prints are safe.'
      status.textContent = 'You can export the artwork or start a fresh edition.'
      invitation.classList.add('hidden'); buttons.replaceChildren(button('Save a PNG of my print', download), button('Make another edition', showDesign), button('Back to Brooklyn', closePrintStudio)); draw(); return
    }
    progress = saved.state; newlyInvited = saved.invited
    if (saved.added) { const station = data.radio.stations.find(station => station.id === 'KFLP'); if (station) station.unlocked = true; updatePrintDisplay(); bus.emit('print-checkpoint') }
  }
  instructions.textContent = `“${printQuality(job) >= 90 ? 'Clean registration. Those colours sit beautifully.' : 'That offset makes it yours.'} Your ${job.design.format} is in the collection.”`
  status.textContent = `${printQuality(job)}% print quality · ${progress.printed} edition${progress.printed === 1 ? '' : 's'} pulled. Your latest design and both ink layers are saved.`
  if (deps.saveStatus?.().lastError) status.textContent = 'Your print is kept for this session, but browser storage could not save it. Export the PNG to keep a copy.'
  invitation.classList.toggle('hidden', !progress.invited); invitation.textContent = newlyInvited ? 'Mae: “The people making sleeves put together FLIP SIDE. I saved the frequency for you.” KFLP is now available on your city radio.' : 'Mae remembers your print-table visit. The sleeve crew’s FLIP SIDE station is still in your radio.'
  buttons.replaceChildren(button('Save a PNG of my print', download), button('Make another edition', showDesign), button('Back to Brooklyn', closePrintStudio)); draw()
}
function download() { const output = document.createElement('canvas'); output.width = 1200; output.height = 1440; drawPrintArt(output.getContext('2d'), job.design, job.layers); output.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `neighborhood-edition-${job.design.format}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000) }, 'image/png') }
export function printStudioContext() { if (!deps || opened || state.mode === 'vehicle' || state.interior || state.mission.active || Math.hypot(state.player.x - HOST.x, state.player.z - HOST.z) > HOST.radius) return null; return { ...HOST, kind: 'print-studio', key: 'E', label: 'PRINT', prompt: 'Make a print with Mae', target: HOST } }
export function openPrintStudio() { if (!printStudioContext()) return false; opened = true; deps.onOpen(); root.classList.remove('hidden'); showDesign(); root.querySelector('select')?.focus(); return true }
export function closePrintStudio() { if (!opened) return; opened = false; release(); resetInput(); root.classList.add('hidden'); deps.onClose(); document.getElementById('view')?.focus({ preventScroll: true }) }
export const isPrintStudioOpen = () => opened
export function updatePrintStudio(dt) { if (!opened || !dragging?.keyboard || !job || job.phase !== 'pull' || document.hidden) return; cursor = Math.min(1, cursor + dt * .5); pullPrintInk(job, cursor, performance.now() / 1000); draw(); updateStatus(); if (cursor >= 1) release() }
export const printProgressSnapshot = () => structuredClone(progress)
export const printStudioSnapshot = () => ({ open: opened, job: job ? structuredClone(job) : null, progress: printProgressSnapshot() })
export function restorePrintProgress(value) { const valid = validatePrintProgress(value); if (!valid.ok) return false; closePrintStudio(); progress = valid.state; updatePrintDisplay(); return true }
function updatePrintDisplay() { if (!displayCanvas) return; drawPrintArt(displayCanvas.getContext('2d'), progress.last?.design || normalizePrintDesign({ title: 'MAKE A PRINT' }), progress.last?.layers || null); displayTexture.needsUpdate = true }
function buildStand() {
  const b = new MeshBuilder(data.blocks.vertexLighting, deps.atlas), white = deps.atlas.uv('white')
  for (const x of [-334, -332]) for (const z of [-406.4, -405.6]) b.box({ x, y: .65, z, w: .09, h: .9, d: .09, rect: white, color: '#566451' })
  b.box({ x: -333, y: 1.13, z: -406, w: 2.4, h: .12, d: 1.25, rect: white, color: '#b39b77' })
  for (let i = 0; i < 3; i++) b.box({ x: -333.7 + i * .65, y: 1.23, z: -406, w: .5, h: .07, d: .7, rect: white, color: ['#f1e7cb', '#dd674f', '#3b6556'][i] })
  const mesh = new THREE.Mesh(b.build(), deps.materials.opaque); mesh.name = 'neighborhood-print-table'; mesh.castShadow = mesh.receiveShadow = true; deps.scene.add(mesh)
  deps.collision?.add({ type: 'box', x: -333, z: -406, hx: 1.2, hz: .625, tag: 'print-table' })
  displayCanvas = document.createElement('canvas'); displayCanvas.width = 384; displayCanvas.height = 460
  displayTexture = new THREE.CanvasTexture(displayCanvas); displayTexture.colorSpace = THREE.SRGBColorSpace; updatePrintDisplay()
  const display = new THREE.Mesh(new THREE.PlaneGeometry(.85, 1.02), new THREE.MeshStandardMaterial({ map: displayTexture, roughness: .93, side: THREE.DoubleSide })); display.name = 'your-neighborhood-edition'; display.position.set(-333.7, 1.7, -406.5); display.rotation.x = -.12; display.castShadow = display.receiveShadow = true; deps.scene.add(display)
  const host = makePed(data.npcs, 'commuter', state.seed + ':print:mae', deps.materials.actor, deps.atlas, data.blocks.vertexLighting); host.name = 'ped:print-mae'; host.position.set(HOST.x, .2, HOST.z - 1); host.userData.npcId = 'print:mae'; host.userData.appearanceId = 'mae'; host.userData.conversationCharacter = true; (deps.actorScene || deps.scene).add(host)
}
