export interface ResearchPaper {
  id: string
  title: string
  url: string
  date: string
  coAuthors?: string
  authors?: string
  venue?: string
  summary?: string
  studyUrl?: string
  codeUrl?: string
  sourceNote?: string
  sourceUrl?: string
}

const replayExplorer = "https://ibm-client-engineering.github.io/output-drift-financial-llms/explorer/"
const outputDriftCode = "https://github.com/ibm-client-engineering/output-drift-financial-llms"

// Shared by Notes and the Lab library. AI-paper metadata and summaries were
// checked against the linked arXiv abstracts on 2026-10-30. Earlier papers
// retain the titles, dates, and links from the existing Notes archive.
export const RESEARCH_PAPERS: ResearchPaper[] = [
  {
    id: "when-replay-agreement-misleads",
    title: "When Replay Agreement Misleads: Capture Loss and Cancellation in Local Agents",
    url: "https://lnkd.in/p/gsz3S5Tm",
    date: "Dec 2026",
    venue: "Poster · SLM-Agents Workshop at NeurIPS 2026, Paris",
  },
  {
    id: "dfah-bench",
    title: "DFAH-Bench: What Agreement Leaves Unmeasured in Financial Agents",
    url: "https://arxiv.org/abs/2607.20491",
    date: "Jun 2026 · revised Oct 2026",
    summary:
      "In the reported financial-agent tests, matching final decisions could conceal different tool paths, omitted actions, or decisions unsupported by the task’s rules. The banking comparisons are descriptive because some outcomes were missing.",
    studyUrl: replayExplorer,
    codeUrl: outputDriftCode,
  },
  {
    id: "forecasting-future-language",
    title: "Forecasting Future Language: Context Design for Mention Markets",
    url: "https://arxiv.org/abs/2602.21229",
    date: "Feb 2026",
    venue: "Poster · Advances in Financial AI Workshop at ICLR 2026, Rio de Janeiro",
    coAuthors:
      "Sumin Kim, Jihoon Kwon, Yoon Kim, Nicole Kagan, Raffi Khatchadourian, Wonbin Ahn, Alejandro Lopez-Lira, Jaewon Lee, Yoontae Hwang, Oscar Levy, Yongjae Lee, Chanyeol Choi",
    summary:
      "In the reported earnings-call mention-market experiments, richer context and updates anchored to market probabilities improved forecasts. Combining market probabilities with the model’s update produced more robust predictions than either alone.",
  },
  {
    id: "replayable-financial-agents",
    title: "Replayable Financial Agents: A Determinism-Faithfulness Assurance Harness for Tool-Using LLM Agents",
    url: "https://arxiv.org/abs/2601.15322",
    date: "Jan 2026 · revised Oct 2026",
    summary:
      "The harness treats repeated decisions, tool-name sets, ordered tool calls, and support from evidence as separate questions. Its synthetic financial-task experiments show that a stable answer does not necessarily imply a stable execution.",
    studyUrl: replayExplorer,
    codeUrl: outputDriftCode,
  },
  {
    id: "llm-output-drift",
    title: "LLM Output Drift: Cross-Provider Validation & Mitigation for Financial Workflows",
    url: "https://arxiv.org/abs/2511.07585",
    date: "Nov 2025",
    venue: "AI4F Workshop at ACM ICAIF 2025, Singapore",
    coAuthors: "Rolando Franco",
    summary:
      "Across five tested model architectures and three financial tasks, repeatability varied with the model, task, and configuration. The paper combines controlled generation, task-specific checks, and cross-provider comparisons to evaluate output drift.",
    studyUrl: "https://ibm-client-engineering.github.io/output-drift-financial-llms/",
    codeUrl: outputDriftCode,
  },
  {
    id: "armenian-textbooks",
    title: "Impact of External Forces and the Digital Age on the Turkish Narrative of Armenians in Turkey's Textbooks",
    url: "https://www.academia.edu/44288138/Impact_of_External_Forces_and_the_Digital_Age_on_the_Turkish_Narrative_of_Armenians_in_Turkeys_Textbooks?source=swp_share",
    date: "May 2017",
  },
  {
    id: "ticketmaster-antitrust",
    title: "Ticketmaster and Live Nation Antitrust Violations",
    url: "https://drive.google.com/file/d/1ClBedYKfuRYiJU-DCmV45wRHUd2_Ier2/view?usp=sharing",
    date: "May 2017",
  },
  {
    id: "recession-stock-performance",
    title: "The Effect of a US Recession and Macroeconomic Variables on Stock Market Performance",
    url: "https://drive.google.com/file/d/1fJcGuypNM7N-oBu6caEDm0hJlokZfihB/view?usp=sharing",
    date: "Dec 2015",
  },
]

// Collected reading from saved papers and the existing research bibliographies,
// with titles, authors and dates checked against their primary arXiv pages.
// These are not authored by Raffi and stay out of Notes' own-paper catalogue.
export const RESEARCH_READING: ResearchPaper[] = [
  {
    id: "self-evolving-agent-systems",
    title: "Next-Generation Agentic Reinforcement Learning Systems Enable Self-Evolving Agents",
    url: "https://arxiv.org/abs/2607.01120",
    date: "Jul 2026",
    authors: "Ran Yan, Wei Fu, Jiale Li, Shusheng Xu, and collaborators",
    summary:
      "This position paper proposes shared trajectory data, a governed data proxy, and an evolution control plane for learning from deployed agent work. AReaL2.0 illustrates one branch of the proposed online learning loop; the broader architecture remains a research direction.",
    sourceNote: "Collected reading on governed learning from agent trajectories.",
  },
  {
    id: "gamut",
    title: "Two-Level Meta-Rubrics for Evaluating Open-Ended Generation: GAMUT, a Benchmark for Factual Completeness",
    url: "https://arxiv.org/abs/2607.19322",
    date: "Jul 2026 · revised Aug 2026",
    authors: "Xilun Chen, Zhaleh Feizollahi, Ross Goodwin, Seungwhan Moon, Scott Yih, Pinar Donmez, Babak Damavandi, Luna Dong",
    summary:
      "GAMUT evaluates factual completeness in long-form answers grounded in wearable imagery. Its structured meta-rubrics compile into binary checks, separating the richness needed to describe a good answer from the simpler checks used to grade it.",
    sourceNote: "Collected reading on factual completeness and evaluation rubrics.",
  },
  {
    id: "react",
    title: "ReAct: Synergizing Reasoning and Acting in Language Models",
    url: "https://arxiv.org/abs/2210.03629",
    date: "Oct 2022 · revised Mar 2023",
    authors: "Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao",
    venue: "ICLR 2023",
    summary:
      "ReAct interleaves model-generated reasoning traces and actions that gather information from tools or environments. It is useful background for understanding why an agent’s sequence of actions deserves evaluation alongside its final answer.",
    sourceNote: "Cited in the Replayable Financial Agents research bibliography.",
    sourceUrl: "https://arxiv.org/abs/2601.15322",
  },
  {
    id: "agentbench",
    title: "AgentBench: Evaluating LLMs as Agents",
    url: "https://arxiv.org/abs/2308.03688",
    date: "Aug 2023 · revised Oct 2025",
    authors: "Xiao Liu, Hao Yu, Hanchen Zhang, Yifan Xu, Xuanyu Lei, Hanyu Lai, Yu Gu, Hangliang Ding, Kaiwen Men, Kejuan Yang, Shudan Zhang, Xiang Deng, Aohan Zeng, Zhengxiao Du, Chenhui Zhang, Sheng Shen, Tianjun Zhang, Yu Su, Huan Sun, Minlie Huang, Yuxiao Dong, Jie Tang",
    venue: "ICLR 2024",
    summary:
      "AgentBench evaluates language-model agents across eight interactive environments. Its focus on multi-step reasoning, decisions, and instruction following provides context for evaluating agents beyond a single response.",
    sourceNote: "Cited in the Replayable Financial Agents research bibliography.",
    sourceUrl: "https://arxiv.org/abs/2601.15322",
  },
  {
    id: "helm",
    title: "Holistic Evaluation of Language Models",
    url: "https://arxiv.org/abs/2211.09110",
    date: "Nov 2022 · revised Oct 2023",
    authors: "Percy Liang, Rishi Bommasani, Tony Lee, Dimitris Tsipras, and collaborators",
    venue: "Transactions on Machine Learning Research, 2023",
    summary:
      "HELM compares language models across scenarios and multiple measures, including accuracy, calibration, robustness, fairness, and efficiency. It makes evaluation coverage and trade-offs visible rather than reducing a model to one score.",
    sourceNote: "Cited in the DFAH-Bench research bibliography.",
    sourceUrl: "https://arxiv.org/abs/2607.20491",
  },
  {
    id: "self-consistency",
    title: "Self-Consistency Improves Chain of Thought Reasoning in Language Models",
    url: "https://arxiv.org/abs/2203.11171",
    date: "Mar 2022 · revised Mar 2023",
    authors: "Xuezhi Wang, Jason Wei, Dale Schuurmans, Quoc Le, Ed Chi, Sharan Narang, Aakanksha Chowdhery, Denny Zhou",
    venue: "ICLR 2023",
    summary:
      "Self-consistency samples multiple reasoning paths and selects an answer by combining their outputs. The paper reports gains on arithmetic and commonsense benchmarks; that use of variation is a useful counterpoint to research on repeatable execution.",
    sourceNote: "Cited in the DFAH-Bench research bibliography.",
    sourceUrl: "https://arxiv.org/abs/2607.20491",
  },
]

export type LabResearchPaper = ResearchPaper & { collection: "own" | "reading" }

export const LAB_RESEARCH_PAPERS: LabResearchPaper[] = [
  ...RESEARCH_PAPERS.map((paper) => ({ ...paper, collection: "own" as const })),
  ...RESEARCH_READING.map((paper) => ({ ...paper, collection: "reading" as const })),
]
