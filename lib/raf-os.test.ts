import assert from "node:assert/strict"
import test from "node:test"
import { comparisonVerdict, exportRun, SCORE_DIMENSIONS, textSources, validateCritique } from "./raf-os"
import type { Change, Critique, Source } from "./raf-os"
import { sampleRunBefore, sampleRunEvidence, sampleRunWording, sampleSubmissionBefore } from "./raf-os-fixtures"

function editedEvidence(edit: (result: Critique) => void) {
  const result = structuredClone(sampleRunEvidence.result)
  edit(result)
  return result
}

const validateEvidence = (result: unknown, sources: Source[] = sampleRunEvidence.sources) =>
  validateCritique(result, sources, true)

test("the three fictional demonstrations satisfy the contract and carry explicit fixture provenance", () => {
  for (const [run, comparing] of [
    [sampleRunBefore, false],
    [sampleRunWording, true],
    [sampleRunEvidence, true],
  ] as const) {
    assert.deepEqual(validateCritique(run.result, run.sources, comparing), run.result)
    assert.equal(run.model, "fixture/not-a-model-run")
    assert.match(run.result.review.snapshot, /fictional example/i)
    assert.equal(run.result.review.scorecard.length, 8)
    assert.deepEqual(
      run.result.review.scorecard.map((entry) => entry.dimension),
      SCORE_DIMENSIONS,
    )
  }
})

test("unknown dimensions stay null and export as Unknown, separately from a supported zero", () => {
  const result = structuredClone(sampleRunBefore.result)
  result.review.scorecard[0].score = 0
  const valid = validateCritique(result, sampleRunBefore.sources, false)
  assert.equal(valid.review.scorecard.find((entry) => entry.dimension === "Demand")?.score, null)
  const markdown = exportRun({
    ...sampleRunBefore,
    result: valid,
    id: "fixture",
    submission: sampleSubmissionBefore,
    baselineId: null,
  })
  assert.match(markdown, /Problem: 0\/5/)
  assert.match(markdown, /Demand: Unknown/)
  assert.doesNotMatch(markdown, /Demand: 0\/5/)
  assert.match(markdown, /not independently verified/)
})

test("scorecards require eight unique known dimensions and finite integer scores in range", () => {
  const missing = structuredClone(sampleRunBefore.result)
  missing.review.scorecard.pop()
  assert.throws(() => validateCritique(missing, sampleRunBefore.sources, false))
  const duplicate = structuredClone(sampleRunBefore.result)
  duplicate.review.scorecard[7].dimension = "Problem"
  assert.throws(() => validateCritique(duplicate, sampleRunBefore.sources, false), /scorecard/i)
  for (const score of [-1, 6, 0.5, NaN, Infinity]) {
    const result = structuredClone(sampleRunBefore.result)
    result.review.scorecard[0].score = score
    assert.throws(() => validateCritique(result, sampleRunBefore.sources, false), String(score))
  }
  const unknownDimension = structuredClone(sampleRunBefore.result)
  const invalid = {
    ...unknownDimension,
    review: {
      ...unknownDimension.review,
      scorecard: [
        { ...unknownDimension.review.scorecard[0], dimension: "Hype" },
        ...unknownDimension.review.scorecard.slice(1),
      ],
    },
  }
  assert.throws(() => validateCritique(invalid, sampleRunBefore.sources, false))
})

test("paragraph sources preserve actual text and give blank-separated paragraphs stable versioned IDs", () => {
  assert.deepEqual(textSources("  First line\ncontinued.  \n \n\n  Second paragraph. \n", "v1"), [
    { id: "v1:p1", label: "V1 · paragraph 1", text: "First line\ncontinued." },
    { id: "v1:p2", label: "V1 · paragraph 2", text: "Second paragraph." },
  ])
  assert.deepEqual(textSources(" \n\n ", "v2"), [])
})

test("quoted text permits whitespace and case normalization without accepting invented words", () => {
  const normalizedQuote = editedEvidence((result) => {
    result.changes[0].after.quote = "  TWO\n  PAID for the PILOT  "
  })
  assert.doesNotThrow(() => validateEvidence(normalizedQuote))
  const inventedQuote = editedEvidence((result) => {
    result.changes[0].after.quote = "Two renewed for a full year"
  })
  assert.throws(() => validateEvidence(inventedQuote), /quote/i)
})

test("fabricated source IDs are rejected in findings, scores, and both comparison sides", () => {
  const edits: Array<(result: Critique) => void> = [
    (result) => {
      result.review.findings[0].refs = ["v2:invented"]
    },
    (result) => {
      result.review.scorecard[0].refs = ["v2:invented"]
    },
    (result) => {
      result.changes[0].before.refs = ["v1:invented"]
    },
    (result) => {
      result.changes[0].after.refs = ["v2:invented"]
    },
  ]
  for (const edit of edits) assert.throws(() => validateEvidence(editedEvidence(edit)), /unavailable source/i)
})

test("comparison passages must cite their own version even when the other source exists", () => {
  for (const side of ["before", "after"] as const) {
    const result = editedEvidence((value) => {
      value.changes[0][side].refs = [side === "before" ? "v2:p3" : "v1:p3"]
    })
    assert.throws(() => validateEvidence(result), /wrong version/i)
  }
})

test("an exact quote must be anchored to a supplied source", () => {
  const result = editedEvidence((value) => {
    value.changes[0].before.refs = []
  })
  assert.throws(() => validateEvidence(result), /source/i)
})

test("a null-text attachment cannot make an invented text quote pass source matching", () => {
  const result = editedEvidence((value) => {
    value.changes[0].after.quote = "All shops renewed for a full year"
    value.changes[0].after.refs.push("v2:attachment")
  })
  const sources = [
    ...sampleRunEvidence.sources,
    { id: "v2:attachment", label: "Fictional unread attachment", text: null },
  ]
  assert.throws(() => validateEvidence(result, sources), /quote|text|verif|extract/i)
})

test("analysis cannot silently include a comparison, and compare cannot omit its ledger", () => {
  assert.throws(() => validateCritique(sampleRunBefore.result, sampleRunBefore.sources, true), /comparison/i)
  assert.throws(() => validateCritique(sampleRunWording.result, sampleRunWording.sources, false), /comparison/i)
})

test("positive and contrary evidence changes both require a quote, source, and evidence status", () => {
  for (const kind of ["support_added", "contrary_evidence"] as const) {
    const edits: Array<(change: Change) => void> = [
      (change) => {
        change.after.quote = ""
      },
      (change) => {
        change.after.refs = []
      },
      (change) => {
        change.after.status = "founder_claim"
      },
      (change) => {
        change.after.status = "unknown"
      },
    ]
    for (const edit of edits) {
      const result = editedEvidence((value) => {
        value.changes[0].kind = kind
        edit(value.changes[0])
      })
      assert.throws(() => validateEvidence(result), /source|observation|evidence/i)
    }
  }
})

test("declared forecasts, opinions, and unknowns cannot count as observed support", () => {
  for (const evidenceType of ["forecast", "opinion", "unknown"] as const) {
    const result = editedEvidence((value) => {
      value.changes[0].after = {
        statement: "The founder predicts future paying shops.",
        quote: "Forecast: we expect ten paying shops next quarter.",
        refs: ["v2:p4"],
        status: "reported_evidence",
        evidenceType,
      }
    })
    assert.throws(() => validateEvidence(result), /forecast|opinion|evidence|support/i)
  }
})

test("declared evidence types are explicit categories, not keyword guesses about truth", () => {
  const text = "Fictional operating record: the forecast review recorded two completed paid pilots."
  const result = editedEvidence((value) => {
    value.changes[0].after = {
      statement: "A supplied fictional log records completed pilots.",
      quote: text,
      refs: ["v2:log"],
      status: "supplied_document",
      evidenceType: "operating_record",
    }
  })
  assert.doesNotThrow(() =>
    validateEvidence(result, [
      ...sampleRunEvidence.sources,
      { id: "v2:log", label: "Fictional operating log excerpt", text },
    ]),
  )
})

test("a forecast can be a cited unsupported claim without being promoted to observed evidence", () => {
  const result = editedEvidence((value) => {
    value.changes = [
      {
        ...value.changes[0],
        kind: "unsupported_claim",
        after: {
          statement: "The founder predicts ten paying shops.",
          quote: "Forecast: we expect ten paying shops next quarter.",
          refs: ["v2:p4"],
          status: "founder_claim",
          evidenceType: "forecast",
        },
      },
    ]
  })
  assert.doesNotThrow(() => validateEvidence(result))
  result.changes[0].after.status = "reported_evidence"
  assert.throws(() => validateEvidence(result), /claim|forecast|evidence/i)
})

test("wording-only edits cannot upgrade evidence status", () => {
  const result = structuredClone(sampleRunWording.result)
  result.changes[0].after.status = "reported_evidence"
  assert.throws(() => validateCritique(result, sampleRunWording.sources, true), /wording|evidence/i)
})

test("wording-only and unchanged entries cannot relabel an opinion as a measurement", () => {
  for (const kind of ["wording_only", "unchanged"] as const) {
    const result = structuredClone(sampleRunWording.result)
    result.changes[0].kind = kind
    result.changes[0].after.evidenceType = "measurement"
    assert.throws(() => validateCritique(result, sampleRunWording.sources, true), /wording|evidence/i)
  }
})

test("every reported or supplied passage requires a quoted observation, even outside evidence upgrades", () => {
  const sources = [
    ...sampleRunEvidence.sources,
    { id: "v1:existing", label: "Fictional earlier pilot note", text: "Two paid for the pilot" },
  ]
  for (const status of ["reported_evidence", "supplied_document"] as const) {
    for (const side of ["before", "after"] as const) {
      for (const absent of ["quote", "refs", "observation"] as const) {
        const result = editedEvidence((value) => {
          const after = { ...value.changes[0].after, status }
          value.changes = [
            {
              ...value.changes[0],
              kind: "unchanged",
              before: { ...after, refs: ["v1:existing"] },
              after,
            },
          ]
          if (absent === "quote") value.changes[0][side].quote = ""
          if (absent === "refs") value.changes[0][side].refs = []
          if (absent === "observation") value.changes[0][side].evidenceType = "forecast"
        })
        assert.throws(() => validateEvidence(result, sources), /source|observation/i)
      }
    }
  }
})

test("a PDF-only citation remains permitted with explicit unverified source text", () => {
  const result = editedEvidence((value) => {
    value.changes[0].after = {
      ...value.changes[0].after,
      refs: ["v2:deck:p1"],
      quote: "Fictional page-only observation that the text validator cannot authenticate.",
    }
  })
  const sources = [...sampleRunEvidence.sources, { id: "v2:deck:p1", label: "Fictional PDF · page 1", text: null }]
  assert.doesNotThrow(() => validateEvidence(result, sources))
  assert.equal(sources.find((source) => source.id === "v2:deck:p1")?.text, null)
})

test("repeating the same quote across versions cannot become new evidence through relabeling", () => {
  for (const beforeStatus of ["founder_claim", "reported_evidence"] as const) {
    const result = editedEvidence((value) => {
      value.changes[0].before = { ...value.changes[0].after, refs: ["v1:existing"], status: beforeStatus }
      value.changes[0].after.quote = "  TWO\n PAID FOR THE PILOT "
    })
    const sources = [
      ...sampleRunEvidence.sources,
      { id: "v1:existing", label: "Fictional earlier pilot note", text: "Two paid for the pilot" },
    ]
    assert.throws(() => validateEvidence(result, sources), /same quote|repeat|new evidence/i)
  }
})

test("quoted reported observations and supplied operating records are accepted with bounded provenance", () => {
  assert.doesNotThrow(() => validateEvidence(sampleRunEvidence.result))
  const text = "Fictional pilot log: two shops completed a paid pilot on 12 January."
  const result = editedEvidence((value) => {
    value.changes[0].after = {
      statement: "The supplied fictional log records two paid completions.",
      quote: "two shops completed a paid pilot on 12 January",
      refs: ["v2:log"],
      status: "supplied_document",
      evidenceType: "operating_record",
    }
  })
  const validated = validateEvidence(result, [
    ...sampleRunEvidence.sources,
    { id: "v2:log", label: "Fictional supplied pilot log", text },
  ])
  assert.equal(validated.changes[0].after.status, "supplied_document")
  assert.equal(validated.changes[1].after.status, "reported_evidence")
})

test("contrary evidence retains its own classification rather than becoming positive support", () => {
  const result = editedEvidence((value) => {
    value.changes = [value.changes[1]]
  })
  const validated = validateEvidence(result)
  assert.equal(validated.changes[0].kind, "contrary_evidence")
  assert.match(validated.changes[0].after.quote, /declined/)
  assert.equal(comparisonVerdict(validated.changes), "New contrary evidence")
})

test("the revision verdict is deterministic across order, wording, unchanged items, and mixed outcomes", () => {
  const support = sampleRunEvidence.result.changes[0]
  const contrary = sampleRunEvidence.result.changes[1]
  const wording = sampleRunWording.result.changes[0]
  const unchanged: Change = { ...wording, kind: "unchanged" }
  const removed: Change = { ...support, kind: "evidence_removed" }
  assert.equal(comparisonVerdict([]), "No material change")
  assert.equal(comparisonVerdict([unchanged]), "No material change")
  assert.equal(comparisonVerdict([wording, unchanged]), "Wording only")
  assert.equal(comparisonVerdict([wording, support, unchanged]), "Stronger support")
  assert.equal(comparisonVerdict([support, contrary]), "Mixed changes")
  assert.equal(comparisonVerdict([contrary, wording, support]), "Mixed changes")
  assert.equal(comparisonVerdict([removed, support]), "Mixed changes")
})
