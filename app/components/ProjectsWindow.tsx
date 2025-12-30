"use client"

import { ExternalLink, Github, Sparkles, FlaskConical } from "lucide-react"

interface Project {
  name: string
  description: string
  github: string
  demo?: string
  lab?: string
  madeWith: string
  year: string
}

const projects: Project[] = [
  {
    name: "raffi.online",
    description: "This website. Windows XP vibes, retro games, iPod music player, and more.",
    github: "https://github.com/Raffi-Souren/raffi-online",
    demo: "https://raffi-souren.vercel.app",
    madeWith: "v0.app",
    year: "2025",
  },
  {
    name: "LLM Output Drift Research",
    description:
      "Measuring temporal drift in LLM outputs for financial applications. Accepted to AI4F Workshop @ ACM ICAIF.",
    github: "https://github.com/ibm-client-engineering/output-drift-financial-llms",
    lab: "https://ibm-client-engineering.github.io/output-drift-financial-llms/",
    madeWith: "IBM Research",
    year: "2025",
  },
  {
    name: "Is It Real?",
    description: "Multi-signal authenticity verification for images and text. Provenance-first architecture.",
    github: "https://github.com/Raffi-Souren/is-it-real",
    demo: "https://is-it-real.vercel.app",
    madeWith: "Claude Code",
    year: "2025",
  },
  {
    name: "Food Label Analyzer",
    description: "Analyze food labels for authenticity and extract ingredients using OCR and AI.",
    github: "https://github.com/Raffi-Souren/food_label_analyzer",
    madeWith: "Project Bob @ IBM TechXchange",
    year: "2025",
  },
  {
    name: "Capital Markets Agent Factory",
    description: "AI agents for institutional trading, compliance, and research workflows.",
    github: "https://github.com/Raffi-Souren/genai-capital-mkts",
    demo: "https://cap-mkts.vercel.app",
    madeWith: "v0.app",
    year: "2025",
  },
]

export default function ProjectsWindow() {
  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
        </div>
        <p className="text-sm text-gray-500">Things I've built</p>
      </div>

      {/* Projects List - Added min-h-0 for proper scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {projects.map((project, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{project.description}</p>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">{project.year}</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">{project.madeWith}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  <Github className="w-3.5 h-3.5" />
                  Code
                </a>
                {project.lab && (
                  <a
                    href={project.lab}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    Lab
                  </a>
                )}
                {project.demo && (
                  <a
                    href={project.demo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Demo
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer - Added flex-shrink-0 to prevent footer from being hidden */}
      <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-white">
        <a
          href="https://github.com/Raffi-Souren"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Github className="w-4 h-4" />
          View all on GitHub
        </a>
      </div>
    </div>
  )
}
