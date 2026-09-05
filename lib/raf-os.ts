import { z } from "zod/v3"

export const RAF_RUBRIC = "evidence-v1"
export const RAF_PROMPT = "founder-critic-v2"
export const GPT_BACKUP = "https://chatgpt.com/g/g-68a497212bfc81918b450e9ca7ee67ba-raf-os-terminal"
export const SCORE_DIMENSIONS = [
  "Problem",
  "Demand",
  "Solution",
  "GTM",
  "Economics",
  "Moat",
  "Team / story",
  "Data room",
] as const
export const CHANGE_LABELS = {
  support_added: "Stronger support",
  contrary_evidence: "New contrary evidence",
  wording_only: "Wording only",
  unsupported_claim: "New claim · proof missing",
  evidence_removed: "Support removed",
  unchanged: "No material change",
} as const
const sentence = z.string().trim().min(1).max(1200)
const refs = z.array(z.string().min(1).max(80)).max(6)
const status = z.enum(["unknown", "founder_claim", "reported_evidence", "supplied_document"])
const passage = z
  .object({
    statement: sentence,
    quote: z.string().trim().max(600),
    refs,
    status,
    evidenceType: z.enum([
      "unknown",
      "opinion",
      "forecast",
      "customer_statement",
      "measurement",
      "commercial_commitment",
      "operating_record",
    ]),
  })
  .strict()
const score = z
  .object({
    dimension: z.enum(SCORE_DIMENSIONS),
    score: z.number().int().min(0).max(5).nullable(),
    reason: sentence,
    refs,
  })
  .strict()
const finding = z.object({ topic: sentence, observation: sentence, status, refs, nextStep: sentence }).strict()
const recommendation = z.object({ action: sentence, thisWeek: sentence, metric: sentence }).strict()
const pilot = z
  .object({
    buyer: sentence,
    offer: sentence,
    successMetric: sentence,
    proposedThreshold: sentence,
    thisWeek: sentence,
    decision: sentence,
  })
  .strict()

export const reviewSchema = z
  .object({
    snapshot: sentence,
    findings: z.array(finding).min(3).max(14),
    scorecard: z.array(score).length(8),
    recommendations: z.array(recommendation).min(3).max(7),
    pilot,
    valueProp: sentence,
    questions: z.array(sentence).max(3),
    investorTake: sentence,
  })
  .strict()
export const changeSchema = z
  .object({
    topic: sentence,
    kind: z.enum([
      "support_added",
      "contrary_evidence",
      "wording_only",
      "unsupported_claim",
      "evidence_removed",
      "unchanged",
    ]),
    before: passage,
    after: passage,
    explanation: sentence,
    nextProof: sentence,
  })
  .strict()
export const resultSchema = z
  .object({
    review: reviewSchema,
    changes: z.array(changeSchema).max(8),
    comparisonSummary: z.string().max(1200),
  })
  .strict()
export type Critique = z.infer<typeof resultSchema>
export type Change = z.infer<typeof changeSchema>
export type Source = { id: string; label: string; text: string | null }
export type Submission = { text: string; deck: { name: string; data: string } | null }
export type RunRequest = {
  current: Submission
  previous: Submission | null
  challenge: string
  action: "analyze" | "compare" | "pilot" | "valueprop"
  allowGoogle?: boolean
  provider?: "auto" | "openai" | "gemini"
}
export type RunResult = {
  result: Critique
  sources: Source[]
  model: string
  routing?: { provider: "openai" | "gemini"; reason: string; policy: string }
  rubric: string
  prompt: string
  createdAt: string
  audit?: {
    inputSha256: string
    outputSha256: string
    canonicalization?: string
    modelRequestSha256?: string
    textQuotesChecked: number
    pdfQuotesUnchecked: number
    sourceReferencesChecked: number
  }
}
export type SavedRun = RunResult & { id: string; version?: number; submission: Submission; baselineId: string | null }

export function textSources(text: string, version: "v1" | "v2"): Source[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((paragraph, i) => ({
      id: `${version}:p${i + 1}`,
      label: `${version.toUpperCase()} · paragraph ${i + 1}`,
      text: paragraph.trim(),
    }))
}

export function comparisonVerdict(changes: Change[]) {
  const meaningful = changes.filter((change) => change.kind !== "unchanged")
  if (!meaningful.length) return "No material change"
  const kinds = new Set(meaningful.map((change) => change.kind))
  const substantive = Array.from(kinds).filter((kind) => kind !== "wording_only")
  if (substantive.length > 1) return "Mixed changes"
  return CHANGE_LABELS[substantive[0] ?? "wording_only"]
}

const normalized = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase()

/** Reject fabricated references and upgrades that the returned evidence ledger cannot support. */
export function validateCritique(value: unknown, sources: Source[], comparing: boolean): Critique {
  const result = resultSchema.parse(value)
  const byId = new Map(sources.map((source) => [source.id, source]))
  const checkRefs = (ids: string[]) => {
    if (ids.some((id) => !byId.has(id))) throw new Error("The review included an unavailable source.")
  }
  if (new Set(result.review.scorecard.map((entry) => entry.dimension)).size !== 8)
    throw new Error("Incomplete scorecard.")
  for (const entry of [...result.review.findings, ...result.review.scorecard]) checkRefs(entry.refs)
  if (comparing && result.changes.length === 0) throw new Error("The comparison was missing.")
  if (!comparing && result.changes.length > 0) throw new Error("Unexpected comparison.")
  for (const change of result.changes) {
    for (const [side, prefix] of [
      [change.before, "v1:"],
      [change.after, "v2:"],
    ] as const) {
      checkRefs(side.refs)
      if (side.refs.some((id) => !id.startsWith(prefix))) throw new Error("A comparison cited the wrong version.")
      if (side.quote && !side.refs.length) throw new Error("A quoted passage needs a source.")
      const quotedText = side.refs.map((id) => byId.get(id)!).filter((source) => source.text !== null)
      if (side.quote && quotedText.length > 0 && quotedText.length < side.refs.length)
        throw new Error("A quotation must identify either its text source or its PDF source.")
      if (
        side.quote &&
        quotedText.length === side.refs.length &&
        !quotedText.some((source) => normalized(source.text!).includes(normalized(side.quote)))
      )
        throw new Error("A quote did not match the supplied text.")
      if (
        ["reported_evidence", "supplied_document"].includes(side.status) &&
        (!side.quote || !side.refs.length || ["unknown", "opinion", "forecast"].includes(side.evidenceType))
      )
        throw new Error("Reported evidence needs a cited observation and an evidence type.")
    }
    if (["support_added", "contrary_evidence"].includes(change.kind)) {
      if (
        !["reported_evidence", "supplied_document"].includes(change.after.status) ||
        !change.after.refs.length ||
        !change.after.quote
      )
        throw new Error("An evidence change needs a cited observation.")
      if (["unknown", "opinion", "forecast"].includes(change.after.evidenceType))
        throw new Error("An opinion or forecast is not new evidence.")
      if (normalized(change.before.quote) === normalized(change.after.quote))
        throw new Error("Repeating the same quote does not add evidence.")
    }
    if (change.kind === "unsupported_claim" && !["founder_claim", "unknown"].includes(change.after.status))
      throw new Error("Inconsistent claim classification.")
    if (
      ["wording_only", "unchanged"].includes(change.kind) &&
      (change.before.status !== change.after.status || change.before.evidenceType !== change.after.evidenceType)
    )
      throw new Error("Wording alone cannot upgrade evidence status or type.")
  }
  return result
}

export function exportRun(run: SavedRun) {
  const { review, changes } = run.result
  const lines = [
    "# RAF OS — Analysis",
    "",
    review.snapshot,
    "",
    `Model: ${run.model} · Rubric: ${run.rubric} · Prompt: ${run.prompt}`,
    ...(run.routing
      ? [`Provider: ${run.routing.provider} · Routing: ${run.routing.reason} · Policy: ${run.routing.policy}`]
      : []),
    `Created: ${run.createdAt}`,
    "",
    "Evidence is assessed from supplied material, not independently verified.",
  ]
  if (changes.length) {
    lines.push("", `## Revision: ${comparisonVerdict(changes)}`, run.result.comparisonSummary)
    for (const c of changes)
      lines.push(
        "",
        `### ${c.topic} — ${CHANGE_LABELS[c.kind]}`,
        `Before: ${c.before.statement} [${c.before.refs.join(", ")}]`,
        `After: ${c.after.statement} [${c.after.refs.join(", ")}]`,
        c.explanation,
        `Next proof: ${c.nextProof}`,
      )
  }
  lines.push("", "## Critique")
  for (const f of review.findings)
    lines.push(
      "",
      `### ${f.topic}`,
      `${f.observation} (${f.status}; ${f.refs.join(", ") || "unknown"})`,
      `Next: ${f.nextStep}`,
    )
  lines.push("", "## Scorecard")
  for (const s of review.scorecard)
    lines.push(
      `- ${s.dimension}: ${s.score === null ? "Unknown" : `${s.score}/5`} — ${s.reason} [${s.refs.join(", ")}]`,
    )
  lines.push("", "## This week")
  for (const r of review.recommendations) lines.push(`- ${r.action}: ${r.thisWeek} Track: ${r.metric}`)
  lines.push(
    "",
    "## First pilot",
    ...Object.entries(review.pilot).map(([key, value]) => `${key}: ${value}`),
    "",
    "## Value proposition",
    review.valueProp,
    "",
    "## Questions",
    ...review.questions.map((q) => `- ${q}`),
    "",
    `Investor take: ${review.investorTake}`,
    "",
    "## Source index",
    ...run.sources.map((s) => `- ${s.id}: ${s.label}`),
  )
  return lines.join("\n")
}
