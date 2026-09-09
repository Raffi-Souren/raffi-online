/** Accessible local save slots; a mission save is explicitly a briefing checkpoint. */
import { bus } from '../engine/state.js'
import { saveGame, loadGame, saveSlots } from './saves.js'

let root, list, notice, callbacks, resumeSlot = null
export function initSaveMenu(actions) {
  callbacks = actions
  root = document.getElementById('save-menu')
  list = document.getElementById('save-slots')
  notice = document.getElementById('save-notice')
  document.getElementById('save-close').addEventListener('click', () => callbacks.close())
  document.getElementById('boot-continue').addEventListener('click', () => {
    if (!resumeSlot) return
    callbacks.start()
    const result = loadGame(resumeSlot)
    if (!result.ok) { showSaveMenu(); notice.textContent = result.error }
  })
  bus.on('saves-changed', refresh)
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const buttons = [...root.querySelectorAll('button:not(:disabled)')]
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
  })
}
function refresh() {
  if (!list) return
  const focusSlot = document.activeElement?.dataset.saveSlot
  const focusAction = document.activeElement?.dataset.saveAction
  list.replaceChildren()
  const slots = saveSlots()
  resumeSlot = slots.filter((s) => s.valid).sort((a, b) => b.savedAt - a.savedAt)[0]?.slot || null
  document.getElementById('boot-continue').classList.toggle('hidden', !resumeSlot)
  for (const slot of slots) {
    const row = document.createElement('section')
    const title = document.createElement('h3')
    title.textContent = slot.slot === 'auto' ? 'Autosave' : 'Slot ' + slot.slot.slice(-1)
    const detail = document.createElement('p')
    detail.textContent = slot.valid ? slot.location + ' · ' + slot.completed + '/' + slot.total + ' jobs · ' + new Date(slot.savedAt).toLocaleString() : slot.empty ? 'Empty slot' : slot.error
    const buttons = document.createElement('div')
    for (const action of slot.slot === 'auto' ? ['load'] : ['save', 'load']) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = action === 'save' ? 'Save here' : 'Load'
      button.disabled = action === 'load' && !slot.valid
      button.dataset.saveSlot = slot.slot
      button.dataset.saveAction = action
      button.addEventListener('click', () => {
        const result = action === 'save' ? saveGame(slot.slot) : loadGame(slot.slot)
        notice.textContent = result.ok ? action === 'save' ? 'Saved on this browser.' : 'Save loaded.' : result.error
      })
      buttons.append(button)
    }
    row.append(title, detail, buttons)
    list.append(row)
  }
  if (focusSlot && focusAction) list.querySelector(`[data-save-slot="${focusSlot}"][data-save-action="${focusAction}"]`)?.focus()
}
export function showSaveMenu() {
  refresh()
  if (notice) notice.textContent = 'Autosaves every minute and at mission checkpoints. Active jobs resume at their briefing. Saves stay in this browser.'
  root?.classList.remove('hidden')
  document.getElementById('save-close')?.focus()
}
export function hideSaveMenu() { root?.classList.add('hidden') }
