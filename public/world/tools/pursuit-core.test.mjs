import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  compilePursuitRoster,
  complianceTuning,
  createContactTracker,
  stepContactTracker,
  stepNoContactDecay,
  approachAngles,
  rosterSummary,
} from '../game/pursuit-core.js'

const npcs = JSON.parse(fs.readFileSync(new URL('../data/npcs.json', import.meta.url), 'utf8'))
const fixture = {
  pursuers: {
    'notification-drone': {
      tier: 1,
      label: 'Slack message',
      kind: 'drone',
      speed: 4.2,
      hoverY: 5.5,
      behaviour: 'follow-only',
      interceptRadius: 0,
      lines: ['pursuer-t1-a'],
    },
    coordinator: {
      tier: 2,
      label: 'Calendar hold',
      kind: 'foot',
      archetype: 'suit',
      speed: 3.5,
      behaviour: 'chase-foot',
      interceptRadius: 2.2,
      lines: ['pursuer-t2-a'],
    },
    'skip-level': {
      tier: 3,
      label: 'Skip level',
      kind: 'vehicle',
      vehicle: 'compliance-sedan',
      count: 1,
      behaviour: 'pull-alongside',
      interceptRadius: 3.0,
      lines: ['pursuer-t3-a'],
    },
    'steering-committee': {
      tier: 4,
      label: 'Steering committee',
      kind: 'vehicle',
      vehicle: 'compliance-sedan',
      count: 3,
      behaviour: 'box-in',
      interceptRadius: 3.2,
      lines: ['pursuer-t4-a'],
    },
    'legal-review': {
      tier: 5,
      label: 'Legal review',
      kind: 'mixed',
      vehicle: 'compliance-sedan',
      count: 4,
      drones: 1,
      behaviour: 'block-intersections',
      interceptRadius: 3.4,
      lines: ['pursuer-t5-a'],
    },
  },
  compliance: {
    decaySecondsPerTier: 28,
    decayRequiresNoContact: 9,
    caughtHoldSeconds: 2.2,
    repaintClearsAll: true,
    spawnDistance: { min: 55, max: 110 },
  },
}

test('tier-to-pursuer compilation from an independent fixture', () => {
  const t1 = compilePursuitRoster(fixture, 1)
  assert.equal(t1.length, 1)
  assert.equal(t1[0].kind, 'drone')
  assert.equal(t1[0].canCatch, false)

  const t2 = compilePursuitRoster(fixture, 2)
  assert.equal(t2.length, 1)
  assert.equal(t2[0].kind, 'foot')
  assert.equal(t2[0].canCatch, true)

  const t3 = compilePursuitRoster(fixture, 3)
  assert.equal(t3.length, 1)
  assert.equal(t3[0].kind, 'vehicle')
  assert.equal(t3[0].behaviour, 'pull-alongside')

  const t4 = compilePursuitRoster(fixture, 4)
  assert.equal(t4.length, 3)
  assert.ok(t4.every((s) => s.kind === 'vehicle'))

  const t5 = compilePursuitRoster(fixture, 5)
  const summary = rosterSummary(t5)
  assert.equal(summary.kinds.vehicle, 4)
  assert.equal(summary.kinds.drone, 1)
})

test('production npcs.json authored tier counts and kinds', () => {
  assert.equal(compilePursuitRoster(npcs, 1).length, 1)
  assert.equal(compilePursuitRoster(npcs, 2)[0].kind, 'foot')
  assert.equal(compilePursuitRoster(npcs, 3).length, 1)
  assert.equal(compilePursuitRoster(npcs, 4).length, 3)
  const t5 = rosterSummary(compilePursuitRoster(npcs, 5))
  assert.equal(t5.kinds.vehicle, 4)
  assert.equal(t5.kinds.drone, 1)
})

test('Tier 1 follow-only never catches even in contact', () => {
  const drone = compilePursuitRoster(fixture, 1)[0]
  assert.equal(drone.canCatch, false)
  let tracker = createContactTracker()
  for (let i = 0; i < 50; i++) {
    tracker = stepContactTracker(tracker, {
      canCatch: drone.canCatch,
      distance: 0.1,
      interceptRadius: drone.interceptRadius,
      dt: 0.1,
      holdSeconds: 2.2,
    })
  }
  assert.equal(tracker.caught, false)
  assert.equal(tracker.hold, 0)
})

test('sustained-contact catch threshold requires full hold', () => {
  const foot = compilePursuitRoster(fixture, 2)[0]
  const holdSeconds = fixture.compliance.caughtHoldSeconds
  let tracker = createContactTracker()
  tracker = stepContactTracker(tracker, {
    canCatch: true,
    distance: 1,
    interceptRadius: foot.interceptRadius,
    dt: holdSeconds - 0.05,
    holdSeconds,
  })
  assert.equal(tracker.caught, false)
  assert.ok(tracker.inContact)
  tracker = stepContactTracker(tracker, {
    canCatch: true,
    distance: 1,
    interceptRadius: foot.interceptRadius,
    dt: 0.1,
    holdSeconds,
  })
  assert.equal(tracker.caught, true)
})

test('contact break resets the catch timer', () => {
  const foot = compilePursuitRoster(fixture, 2)[0]
  let tracker = createContactTracker()
  tracker = stepContactTracker(tracker, {
    canCatch: true,
    distance: 1,
    interceptRadius: foot.interceptRadius,
    dt: 1.5,
    holdSeconds: 2.2,
  })
  assert.ok(tracker.hold > 1)
  tracker = stepContactTracker(tracker, {
    canCatch: true,
    distance: 99,
    interceptRadius: foot.interceptRadius,
    dt: 0.1,
    holdSeconds: 2.2,
  })
  assert.equal(tracker.hold, 0)
  assert.equal(tracker.inContact, false)
  assert.equal(tracker.caught, false)
})

test('no-contact tier decay uses authored thresholds', () => {
  const t = complianceTuning(fixture)
  let s = { noContactSeconds: 0, decaySeconds: 0 }
  // Before decayRequiresNoContact, no burn.
  s = stepNoContactDecay(s, {
    inContactWithAny: false,
    dt: t.decayRequiresNoContact - 0.1,
    decayRequiresNoContact: t.decayRequiresNoContact,
    decaySecondsPerTier: t.decaySecondsPerTier,
    tier: 3,
  })
  assert.equal(s.tier, 3)
  assert.equal(s.decayed, false)

  s = stepNoContactDecay(s, {
    inContactWithAny: false,
    dt: 0.2,
    decayRequiresNoContact: t.decayRequiresNoContact,
    decaySecondsPerTier: t.decaySecondsPerTier,
    tier: 3,
  })
  // Now accumulating decay time but not a full tier yet.
  assert.equal(s.tier, 3)

  s = stepNoContactDecay(s, {
    inContactWithAny: false,
    dt: t.decaySecondsPerTier,
    decayRequiresNoContact: t.decayRequiresNoContact,
    decaySecondsPerTier: t.decaySecondsPerTier,
    tier: 3,
  })
  assert.equal(s.tier, 2)
  assert.equal(s.decayed, true)
})

test('data mutations alter counts, speeds, radii, and timing', () => {
  const mutated = structuredClone(fixture)
  mutated.pursuers['steering-committee'].count = 5
  mutated.pursuers.coordinator.speed = 9
  mutated.pursuers.coordinator.interceptRadius = 5
  mutated.compliance.caughtHoldSeconds = 0.5

  assert.equal(compilePursuitRoster(mutated, 4).length, 5)
  assert.equal(compilePursuitRoster(mutated, 2)[0].speed, 9)
  assert.equal(compilePursuitRoster(mutated, 2)[0].interceptRadius, 5)

  const hold = complianceTuning(mutated).caughtHoldSeconds
  let tracker = createContactTracker()
  tracker = stepContactTracker(tracker, {
    canCatch: true,
    distance: 0.5,
    interceptRadius: 5,
    dt: 0.4,
    holdSeconds: hold,
  })
  assert.equal(tracker.caught, false)
  tracker = stepContactTracker(tracker, {
    canCatch: true,
    distance: 0.5,
    interceptRadius: 5,
    dt: 0.2,
    holdSeconds: hold,
  })
  assert.equal(tracker.caught, true)
})

test('approachAngles spreads multi-unit box attempts', () => {
  const a = approachAngles(3)
  assert.equal(a.length, 3)
  assert.ok(Math.abs(a[1] - a[0] - (Math.PI * 2) / 3) < 1e-9)
})

test('repaint-cancel contract is pure-clear of contact hold', () => {
  // Simulates cancelPursuit resetting contact after repaint.
  let tracker = createContactTracker()
  tracker = stepContactTracker(tracker, {
    canCatch: true,
    distance: 0.5,
    interceptRadius: 2,
    dt: 2,
    holdSeconds: 2.2,
  })
  assert.ok(tracker.hold > 0)
  tracker = createContactTracker()
  assert.equal(tracker.hold, 0)
  assert.equal(tracker.caught, false)
})
