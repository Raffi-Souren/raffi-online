/**
 * RAFFI WORLD — captioned conversations and calls.
 *
 * Dialogue stays in dialogue.json. This module only owns presentation: a
 * compact RPG text box, speaker colour, typewriter timing, queueing, and the
 * two-press "finish text / advance" rhythm used by handheld RPGs.
 */

import { bus, data } from '../engine/state.js'

let els = {}
let queue = []
let current = null
let visibleCharacters = 0
let holdTimer = 0

export function initDialogue(elements) {
  els = elements
  bus.on('dialogue', (payload) => {
    if (typeof payload === 'string') queueDialogue([{ text: payload }])
    else if (payload?.id) queueDialogue(payload.id, payload)
    else if (payload?.text) queueDialogue([{ text: payload.text, ...payload }], payload)
  })
  bus.on('subtitle', (text) => queueDialogue([{ text }], { duration: 3.4 }))
}

export function queueDialogue(lineIds, options = {}) {
  const items = Array.isArray(lineIds) ? lineIds : [lineIds]
  const resolved = items
    .map((item) => resolveLine(item, options))
    .filter((item) => item?.text)

  for (let i = 0; i < resolved.length; i++) {
    queue.push({
      ...resolved[i],
      blocking: options.blocking ?? resolved[i].blocking ?? false,
      duration: options.duration ?? resolved[i].duration ?? null,
      onComplete: i === resolved.length - 1 ? options.onComplete || null : null,
    })
  }
  if (!current) showNext()
}

function resolveLine(item, options) {
  if (typeof item === 'string') {
    const source = data.dialogue.lines[item]
    if (!source) return null
    return buildLine(source, options)
  }
  return buildLine(item || {}, options)
}

function buildLine(source, options) {
  const substitutions = options.substitutions || {}
  const raw = source.subtitle || source.text || ''
  const text = String(raw).replace(/\{(\w+)\}/g, (_, key) => substitutions[key] ?? '')
  const speaker = source.speaker || options.speaker || null
  const speakerData = data.dialogue.speakers?.[speaker] || null
  return {
    text,
    label: source.label || speakerData?.label || options.label || 'PORT VANTAGE',
    accent: source.accent || speakerData?.accent || options.accent || '#39E6FF',
    delivery: source.delivery || options.delivery || 'caption',
    blocking: source.blocking,
    duration: source.duration,
  }
}

function showNext() {
  current = queue.shift() || null
  if (!current) {
    hideBox()
    return
  }

  visibleCharacters = 0
  holdTimer = current.duration || Math.max(3.2, Math.min(7.5, 1.8 + current.text.length / 18))
  els.root?.classList.add('show')
  bus.emit('dialogue-state', true)
  els.root?.classList.toggle('call', current.delivery === 'call')
  els.root?.style.setProperty('--speaker-accent', current.accent)
  if (els.kicker) els.kicker.textContent = current.delivery === 'call' ? 'INCOMING CALL' : 'DIALOGUE'
  if (els.speaker) els.speaker.textContent = current.label
  if (els.text) els.text.textContent = ''
  if (els.next) els.next.classList.remove('ready')
}

export function updateDialogue(dt) {
  if (!current) return
  if (visibleCharacters < current.text.length) {
    visibleCharacters = Math.min(current.text.length, visibleCharacters + dt * 44)
    if (els.text) els.text.textContent = current.text.slice(0, Math.floor(visibleCharacters))
    if (visibleCharacters >= current.text.length) els.next?.classList.add('ready')
    return
  }

  if (!current.blocking) {
    holdTimer -= dt
    if (holdTimer <= 0) finishCurrent()
  }
}

/** First press completes typing; second press advances. */
export function advanceDialogue() {
  if (!current) return false
  if (visibleCharacters < current.text.length) {
    visibleCharacters = current.text.length
    if (els.text) els.text.textContent = current.text
    els.next?.classList.add('ready')
    return true
  }
  finishCurrent()
  return true
}

function finishCurrent() {
  const callback = current?.onComplete
  current = null
  if (callback) callback()
  if (!current) showNext()
}

function hideBox() {
  els.root?.classList.remove('show', 'call')
  if (els.text) els.text.textContent = ''
  bus.emit('dialogue-state', false)
}

export function isDialogueBlocking() {
  return !!current?.blocking
}

export function isDialogueActive() {
  return !!current
}

/** Debug/audit hook; production flow advances through the normal input path. */
export function dismissDialogue() {
  queue = []
  current = null
  hideBox()
}
