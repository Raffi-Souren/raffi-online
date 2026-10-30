const research = {
  slug: "research",
  title: "Research papers",
  date: "2026-10-30",
  caption: "A reading room for the work behind the experiments.",
  description: "Browse the same research archive kept in Notes, with a few plain-language margins to read along the way.",
  medium: "Research",
  notes: [
    "Keep one shared bibliography for Notes and the Lab library.",
    "Check the four AI-paper entries against their current arXiv abstracts; preserve the earlier archive’s links and dates.",
    "Keep research findings tied to their reported experiments, with paper links for the full context.",
  ],
  references: [
    { label: "DFAH-Bench · arXiv", url: "https://arxiv.org/abs/2607.20491" },
    { label: "Forecasting Future Language · arXiv", url: "https://arxiv.org/abs/2602.21229" },
    { label: "Replayable Financial Agents · arXiv", url: "https://arxiv.org/abs/2601.15322" },
    { label: "LLM Output Drift · arXiv", url: "https://arxiv.org/abs/2511.07585" },
  ],
} as const

export default research
