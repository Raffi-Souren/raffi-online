import test from 'node:test'
import assert from 'node:assert/strict'
import { createPrintJob, movePrintRegistration, lockPrintRegistration, pullPrintInk, finishPrintLayer, printCoverage, printQuality, emptyPrintProgress, recordPrint, validatePrintProgress } from '../game/print-core.js'
function pull(job, seconds = 2) { for (let i = 0; i <= 120; i++) pullPrintInk(job, i / 120, i / 120 * seconds + 1) }
function finish(job, offset = 0) { for (let i = 0; i < 2; i++) { movePrintRegistration(job, offset, 0); lockPrintRegistration(job); pull(job); assert.equal(finishPrintLayer(job), true) } }
test('a finished print requires two actual registered full ink pulls', () => {
  const job = createPrintJob({ title: 'A NIGHT ON WILLOW', format: 'sleeve' }, 'edition-1')
  assert.equal(finishPrintLayer(job), false); lockPrintRegistration(job); assert.equal(finishPrintLayer(job), false)
  pull(job); assert.equal(printCoverage(job), 1); assert.equal(finishPrintLayer(job), true); assert.equal(job.layer, 1); assert.equal(job.phase, 'register')
  lockPrintRegistration(job); pull(job); assert.equal(finishPrintLayer(job), true); assert.equal(job.phase, 'done'); assert.equal(job.layers.length, 2)
})
test('registration affects the actual saved recipe and print quality', () => {
  const clean = createPrintJob({}, 'clean'), offset = createPrintJob({}, 'offset'); finish(clean); finish(offset, 12)
  assert.equal(printQuality(clean), 100); assert.ok(printQuality(offset) < 80); assert.equal(offset.layers[1].offset.x, 12)
})
test('rushed or interrupted pulls do not fill unseen paper, and a new pass corrects the ink', () => {
  const job = createPrintJob({}, 'ink'); lockPrintRegistration(job); pull(job, .15)
  assert.ok(printCoverage(job) < .88); assert.equal(finishPrintLayer(job), false)
  pullPrintInk(job, .1, 20); pullPrintInk(job, .9, 40); assert.ok(printCoverage(job) < .88)
  pull(job); assert.equal(printCoverage(job), 1)
})
test('edition rewards are idempotent and reproduced saved layers validate', () => {
  const job = createPrintJob({}, 'one'); finish(job)
  const first = recordPrint(emptyPrintProgress(), job); assert.equal(first.added, true); assert.equal(first.invited, true)
  const repeat = recordPrint(first.state, job); assert.equal(repeat.added, false); assert.equal(repeat.state.printed, 1)
  const reload = validatePrintProgress(JSON.parse(JSON.stringify(first.state))); assert.equal(reload.ok, true); assert.deepEqual(reload.state.last.layers, job.layers)
  const another = createPrintJob({}, 'two'); finish(another); const second = recordPrint(reload.state, another); assert.equal(second.added, true); assert.equal(second.invited, false)
})
test('old saves get an empty collection and corrupt layer data cannot partially load', () => {
  assert.deepEqual(validatePrintProgress(undefined).state, emptyPrintProgress())
  const job = createPrintJob({}, 'one'); finish(job); const record = recordPrint(emptyPrintProgress(), job).state
  record.last.layers[0].coverage[4] = Infinity; assert.equal(validatePrintProgress(record).ok, false)
  record.last.layers[0] = null; assert.equal(validatePrintProgress(record).ok, false)
  assert.equal(validatePrintProgress({ printed: 1, invited: false, recent: [], last: null }).ok, false)
})
test('variable pen pressure uses the same coverage threshold before and after saving', () => {
  const job = createPrintJob({}, 'pressure')
  for (let layer = 0; layer < 2; layer++) {
    lockPrintRegistration(job)
    for (let i = 0; i <= 120; i++) pullPrintInk(job, i / 120, i / 60 + 1, i < 44 ? .43745 : .44245)
    if (printCoverage(job) < .88) { assert.equal(finishPrintLayer(job), false); pull(job) }
    assert.equal(finishPrintLayer(job), true)
  }
  const recorded = recordPrint(emptyPrintProgress(), job)
  assert.equal(recorded.added, true)
  assert.equal(validatePrintProgress(JSON.parse(JSON.stringify(recorded.state))).ok, true)
})
