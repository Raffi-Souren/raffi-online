export type ResearchArchitectureId = "dfah" | "output-drift" | "grantdrift"

export interface ResearchStation {
  id: string
  title: string
  subtitle: string
  description: string
  sourceLabel: string
  sourceUrl?: string
}

export interface ResearchArchitecture {
  id: ResearchArchitectureId
  label: string
  title: string
  question: string
  description: string
  levels: [string, string]
  stations: ResearchStation[]
  sourceUrl?: string
  paperUrl?: string
  preview?: boolean
}

const repository = "https://github.com/ibm-client-engineering/output-drift-financial-llms"
const source = (path: string) => `${repository}/blob/main/${path}`

// Public package docs and the historical runner define these routes. Room
// placement is a reading aid, not a claim about a deployed infrastructure.
export const RESEARCH_ARCHITECTURES: ResearchArchitecture[] = [
  {
    id: "dfah",
    label: "DFAH-Bench",
    title: "Same decision. Which path?",
    question: "When the answer stays the same, does the agent still take the same observable route?",
    description: "Walk from the replay contract to the evidence used to compare repeated agent runs.",
    levels: ["Contract & execution", "Evidence & review"],
    sourceUrl: repository,
    paperUrl: "https://arxiv.org/abs/2607.20491",
    stations: [
      { id: "suite", title: "Define the suite", subtitle: "Cases + versioned contract", description: "Start with a named, versioned suite: cases, allowed decisions, required observation channels and tool interfaces. Exact fixture and schema identities keep the comparison tied to the same task.", sourceLabel: "Suite and comparison contract", sourceUrl: source("docs/dfah/design.md#contract-identity-and-comparability") },
      { id: "manifest", title: "Pin the agent", subtitle: "Manifest + preflight", description: "The adapter declares the agent and request settings. A bounded check_agent preflight checks the integration before a larger replay; it does not certify a model or production system.", sourceLabel: "Bring your own agent", sourceUrl: source("docs/dfah/bring-your-own-agent.md") },
      { id: "replay", title: "Run the replays", subtitle: "Same cases, repeated runs", description: "A fixed run plan binds the chosen cases, replay count and seed. The user-owned adapter runs the agent; DFAH does not replace its framework or silently retry ambiguous provider calls.", sourceLabel: "Replay control and run identity", sourceUrl: source("docs/dfah/design.md#artifact-first-resumability") },
      { id: "episodes", title: "Keep the record", subtitle: "Committed episode artifacts", description: "Each episode records the decision and observed tool trajectory. Planned, dispatching, terminal and committed boundaries distinguish a safe resume from an unknown result after dispatch.", sourceLabel: "Artifact-first resumability", sourceUrl: source("docs/dfah/design.md#artifact-first-resumability") },
      { id: "eligibility", title: "Qualify the evidence", subtitle: "Comparable + observable", description: "Before measuring agreement, qualify replay count, contract identity and the required channels. Missing evidence stays unavailable; an observed empty tool path is different from a missing path.", sourceLabel: "Replay eligibility implementation", sourceUrl: source("src/dfah/metrics/eligibility.py") },
      { id: "report", title: "Compare & review", subtitle: "Decision + path agreement", description: "Read decision agreement alongside exact tool-path agreement, then inspect flagged cases or apply a project-specific gate. Repeatability measures the observed record; it does not establish correctness or hidden reasoning.", sourceLabel: "Package report and review workflow", sourceUrl: source("README_DFAH.md") },
    ],
  },
  {
    id: "output-drift",
    label: "LLM Output Drift",
    title: "Same inputs. How much changes?",
    question: "How repeatable is a model’s output when the task and serving conditions are held explicit?",
    description: "Follow the original output-drift experiment from task fixtures through repeated conditions and task-specific checks.",
    levels: ["Inputs & experiment", "Checks & analysis"],
    sourceUrl: repository,
    paperUrl: "https://arxiv.org/abs/2511.07585",
    stations: [
      { id: "fixtures", title: "Choose the task", subtitle: "RAG, JSON summary, SQL", description: "The historical runner separates three tasks: citation-bearing answers over financial text, policy-bounded JSON summaries and text-to-SQL. Each task has its own fixtures and expected output shape.", sourceLabel: "Task definitions", sourceUrl: source("harness/task_definitions.py") },
      { id: "prepare", title: "Fix the inputs", subtitle: "Prompts + task context", description: "Prepare the prompt and task context consistently. The RAG branch uses a deterministic retriever; the summary and SQL branches use their own schema, policy or database context.", sourceLabel: "Task preparation and deterministic retrieval", sourceUrl: source("harness/deterministic_retriever.py") },
      { id: "conditions", title: "Repeat conditions", subtitle: "Model, sampling, concurrency", description: "Run declared combinations of provider, model, temperature, seed and concurrency. Repeated trials make output variation visible within a named experimental condition.", sourceLabel: "Historical evaluation runner", sourceUrl: source("scripts/workshop/run_evaluation.py") },
      { id: "validate", title: "Check the output", subtitle: "Citations, schema, invariants", description: "Apply checks that match the task: citation validation for RAG, JSON-schema checks for summaries and query/invariant checks for SQL. A text difference and a task violation remain different observations.", sourceLabel: "Task-specific validation", sourceUrl: source("harness/task_definitions.py") },
      { id: "measure", title: "Measure variation", subtitle: "Drift + task checks + latency", description: "Compare output against its reference run with normalized edit distance, alongside task-specific violations and latency. Cross-provider comparisons use explicit workshop tolerances rather than a general safety claim.", sourceLabel: "Cross-provider comparison", sourceUrl: source("harness/cross_provider_validation.py") },
      { id: "analysis", title: "Inspect the pattern", subtitle: "Traces, tables, figures", description: "Preserve per-run traces, then group results by experimental condition. Figures let a reader inspect where drift and validation failures change with sampling or concurrency.", sourceLabel: "Historical analysis figures", sourceUrl: source("scripts/workshop/plot_results.py") },
    ],
  },
  {
    id: "grantdrift",
    label: "GrantDrift",
    title: "The agent changed. Does permission still apply?",
    question: "Can an action remain within its limit while the approval behind it no longer applies?",
    description: "A high-level research preview of authority continuity and effect containment. This view includes no private code, results or records.",
    levels: ["Declared authority & observations", "Continuity & containment"],
    preview: true,
    stations: [
      { id: "grant", title: "Declare authority", subtitle: "Who may do what", description: "Begin with an explicit grant: the actor, allowed action, relevant context and limits. A task goal and permission to act answer different questions.", sourceLabel: "High-level research preview" },
      { id: "change", title: "Describe the change", subtitle: "Before + after context", description: "Make the change visible. A different model or tool context can matter even when the next attempted action looks similar.", sourceLabel: "High-level research preview" },
      { id: "observations", title: "Check observations", subtitle: "What can be established?", description: "Read the supplied observations before drawing a conclusion. Missing, inconsistent or unusable evidence should preserve uncertainty.", sourceLabel: "High-level research preview" },
      { id: "continuity", title: "Check continuity", subtitle: "Does the grant still bind?", description: "Ask whether the authored authority still covers the changed actor and context. An action below a numerical limit can still require renewed approval.", sourceLabel: "High-level research preview" },
      { id: "containment", title: "Check containment", subtitle: "Attempted + realized effects", description: "Separately ask whether attempted and realized effects remain within the declared scope and cumulative limits. Continuity and containment are distinct checks.", sourceLabel: "High-level research preview" },
      { id: "conclusion", title: "Keep the conclusion", subtitle: "Findings + uncertainty", description: "Preserve the findings and their evidence limits for review. An offline assessment describes the supplied record; this sketch does not claim runtime enforcement.", sourceLabel: "High-level research preview" },
    ],
  },
]

export function getResearchArchitecture(id: ResearchArchitectureId) {
  return RESEARCH_ARCHITECTURES.find((architecture) => architecture.id === id) ?? RESEARCH_ARCHITECTURES[0]
}
