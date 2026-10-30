const researchArchitecture = {
  slug: "architecture-studio",
  title: "Architecture Studio",
  date: "2026-10-30",
  caption: "Walk through the systems behind the research.",
  description: "An orbitable research mall for DFAH-Bench, LLM Output Drift, and a high-level GrantDrift preview.",
  medium: "Research / spatial interface",
  notes: [
    "Bring the cutaway-mall interaction into Raffi’s lab: connected rooms, a guided route, and a readable explanation at every stop.",
    "Use the public DFAH package design and historical output-drift runner to define the stations. Spatial placement is a reading guide, not a deployment diagram.",
    "Keep GrantDrift at the level of the approved conceptual overview. This view includes no private results, code, account architecture, or internal links.",
  ],
  references: [
    { label: "DFAH package design", url: "https://github.com/ibm-client-engineering/output-drift-financial-llms/blob/main/docs/dfah/design.md" },
    { label: "DFAH-Bench paper", url: "https://arxiv.org/abs/2607.20491" },
    { label: "LLM Output Drift paper", url: "https://arxiv.org/abs/2511.07585" },
  ],
} as const

export default researchArchitecture
