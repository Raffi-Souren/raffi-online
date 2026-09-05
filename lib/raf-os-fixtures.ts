import { RAF_PROMPT, RAF_RUBRIC, SCORE_DIMENSIONS, textSources } from "./raf-os"
import type { Critique, RunResult, Submission } from "./raf-os"

const fictional =
  "FICTIONAL EXAMPLE: ParcelBench, its shops, and every observation below are invented for a deterministic contract demonstration."
const positioning =
  "ParcelBench helps independent repair shops track parts deliveries and notify technicians when a missing part arrives."
const hypothesis =
  "We believe owners will pay for fewer interrupted jobs. We have not run a paid pilot or collected buyer interviews."
const forecast = "Forecast: we expect ten paying shops next quarter."
const unknowns = "The team has not supplied operating costs, retention data, or a legal data room."
const pilot =
  "Founder-reported pilot notes: three independent repair-shop owners used the prototype for two weeks. Two paid for the pilot, and one declined because the alert did not fit the shop's workflow."

export const sampleSubmissionBefore: Submission = {
  text: [fictional, positioning, hypothesis, forecast, unknowns].join("\n\n"),
  deck: null,
}

export const sampleSubmissionWording: Submission = {
  text: [
    fictional,
    "ParcelBench is the operating desk for independent repair shops: track incoming parts, alert technicians, and keep repairs moving.",
    hypothesis,
    forecast,
    unknowns,
  ].join("\n\n"),
  deck: null,
}

export const sampleSubmissionEvidence: Submission = {
  text: [fictional, positioning, pilot, forecast, unknowns].join("\n\n"),
  deck: null,
}

function review(hasPilot: boolean): Critique["review"] {
  return {
    snapshot: hasPilot
      ? "Fictional example: a small, founder-reported paid pilot adds limited demand support and exposes a workflow objection. Costs and retention remain unknown."
      : "Fictional example: ParcelBench states a specific workflow and buyer, but demand remains a hypothesis. No paid pilot is supplied.",
    findings: [
      {
        topic: "A specific buyer and workflow",
        observation:
          "The pitch names independent repair shops and delayed parts; the frequency and cost of the problem have not been measured.",
        status: "founder_claim",
        refs: ["v2:p2"],
        nextStep: "Observe a parts-delivery handoff and record interruptions with the shop owner's permission.",
      },
      {
        topic: "Demand and workflow fit",
        observation: hasPilot
          ? "Two paid pilots are reported alongside one workflow rejection. This small, short cohort does not establish repeat demand."
          : "Willingness to pay is the founder's belief; the submitted text explicitly reports no paid pilot or buyer interviews.",
        status: hasPilot ? "reported_evidence" : "founder_claim",
        refs: ["v2:p3"],
        nextStep: "Document the paid offer, the full invited cohort, repeat usage, and the reason for declining.",
      },
      {
        topic: "Economics and retention are unknown",
        observation:
          "The supplied material does not include operating costs, retention observations, or a legal data room.",
        status: "unknown",
        refs: ["v2:p5"],
        nextStep: "Track delivery cost and retention over a defined period before making a margin claim.",
      },
    ],
    scorecard: SCORE_DIMENSIONS.map((dimension) => {
      const known = dimension === "Problem" || dimension === "Solution" || (hasPilot && dimension === "Demand")
      return {
        dimension,
        score: known ? (dimension === "Demand" ? 2 : 1) : null,
        reason: known
          ? dimension === "Demand"
            ? "A short, founder-reported pilot supplies limited demand support; repeat payment is not established."
            : "The pitch names a specific workflow; independent observation is still missing."
          : "The supplied example does not establish enough information to assess this dimension.",
        refs: known ? [dimension === "Demand" ? "v2:p3" : "v2:p2"] : [],
      }
    }),
    recommendations: [
      {
        action: "Observe the workflow",
        thisWeek: "Ask one willing shop to show a complete parts-delivery handoff.",
        metric: "Interruptions and minutes lost per observed handoff.",
      },
      {
        action: "Run a bounded paid offer",
        thisWeek: "Write the pilot price, duration, eligibility, and refund terms before inviting shops.",
        metric: "Invitations, acceptances, payments, completions, and declines in the same cohort.",
      },
      {
        action: "Measure the objection",
        thisWeek: "Ask a shop that declines where the alert interrupts its existing workflow.",
        metric: "Recorded objections and repeat use after the first week.",
      },
    ],
    pilot: {
      buyer: "An owner of an independent repair shop who manages incoming parts.",
      offer: "A two-week parts-arrival alert pilot with an explicit price and opt-out.",
      successMetric: "Paid completions and repeat use, alongside reported workflow interruptions.",
      proposedThreshold:
        "Proposed decision rule, not a result: two of three invited shops pay and use alerts during both weeks.",
      thisWeek: "Agree on the offer and record baseline handoffs before starting.",
      decision:
        "Continue only if the decision rule is met without increasing workflow interruptions; otherwise revise the alert flow.",
    },
    valueProp:
      "For repair-shop owners coordinating incoming parts, ParcelBench organizes arrival alerts so technicians can find the next repair to resume.",
    questions: [
      "Who checks parts arrivals today?",
      "What was included in the paid pilot offer?",
      "Which costs are needed to serve one shop?",
    ],
    investorTake:
      "This fictional example supports a focused next experiment, not an investment recommendation or a verified traction claim.",
  }
}

export const sampleResultBefore: Critique = {
  review: review(false),
  changes: [],
  comparisonSummary: "",
}

export const sampleResultWording: Critique = {
  review: review(false),
  changes: [
    {
      topic: "Positioning",
      kind: "wording_only",
      before: {
        statement: "The earlier pitch names parts tracking and arrival alerts.",
        quote: positioning,
        refs: ["v1:p2"],
        status: "founder_claim",
        evidenceType: "opinion",
      },
      after: {
        statement: "The revised pitch connects the same features to repair coordination.",
        quote:
          "ParcelBench is the operating desk for independent repair shops: track incoming parts, alert technicians, and keep repairs moving.",
        refs: ["v2:p2"],
        status: "founder_claim",
        evidenceType: "opinion",
      },
      explanation: "The sentence is clearer, but it supplies no new buyer observation, payment, or operating record.",
      nextProof: "Observe the proposed workflow and document a paid pilot with a defined cohort.",
    },
  ],
  comparisonSummary: "The pitch is clearer. Its evidence status is unchanged.",
}

export const sampleResultEvidence: Critique = {
  review: review(true),
  changes: [
    {
      topic: "Limited payment support",
      kind: "support_added",
      before: {
        statement: "Willingness to pay is a hypothesis.",
        quote: "We believe owners will pay for fewer interrupted jobs.",
        refs: ["v1:p3"],
        status: "founder_claim",
        evidenceType: "opinion",
      },
      after: {
        statement: "The founder reports two paid pilots in a three-shop, two-week cohort.",
        quote: "Two paid for the pilot",
        refs: ["v2:p3"],
        status: "reported_evidence",
        evidenceType: "commercial_commitment",
      },
      explanation:
        "The new statement reports a concrete payment observation. It is not independently verified and does not establish renewal or retention.",
      nextProof: "Supply redacted payment records and the complete cohort's follow-up, including repeat usage.",
    },
    {
      topic: "Workflow rejection",
      kind: "contrary_evidence",
      before: {
        statement: "The founder expects owners to want fewer interruptions.",
        quote: "We believe owners will pay for fewer interrupted jobs.",
        refs: ["v1:p3"],
        status: "founder_claim",
        evidenceType: "opinion",
      },
      after: {
        statement: "One shop declined because the alert did not fit its workflow.",
        quote: "one declined because the alert did not fit the shop's workflow",
        refs: ["v2:p3"],
        status: "reported_evidence",
        evidenceType: "customer_statement",
      },
      explanation:
        "This observation challenges the workflow assumption. It is retained separately from the two reported payments.",
      nextProof: "Record the shop's objection and test a revised alert flow against its existing process.",
    },
  ],
  comparisonSummary:
    "The fictional pilot adds limited payment support and a distinct workflow objection. The forecast remains a forecast; retention and economics remain unknown.",
}

function fixtureRun(result: Critique, current: Submission, comparing: boolean): RunResult {
  return {
    result,
    sources: [...(comparing ? textSources(sampleSubmissionBefore.text, "v1") : []), ...textSources(current.text, "v2")],
    model: "fixture/not-a-model-run",
    rubric: RAF_RUBRIC,
    prompt: RAF_PROMPT,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

// Static, authored demonstrations of the contract. These are never API fallbacks.
export const sampleRunBefore = fixtureRun(sampleResultBefore, sampleSubmissionBefore, false)
export const sampleRunWording = fixtureRun(sampleResultWording, sampleSubmissionWording, true)
export const sampleRunEvidence = fixtureRun(sampleResultEvidence, sampleSubmissionEvidence, true)
