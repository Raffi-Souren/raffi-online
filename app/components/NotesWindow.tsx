"use client"

import WindowShell from "../../components/ui/WindowShell"

interface Note {
  id: string
  title: string
  type: "article" | "research" | "post"
  url: string
  date: string
  description: string
  platform: string
}

const NOTES: Note[] = [
  {
    id: "ai-agents-banking",
    title: "Banking on AI Agents: The Future of Financial Services",
    type: "article",
    url: "https://linkedin.com/pulse/banking-ai-agents-future-financial-services-raffi-sourenkhatchadourian",
    date: "2024-12-14",
    description: "Exploring how AI agents are transforming the banking industry",
    platform: "LinkedIn",
  },
  {
    id: "generative-ai-enterprise",
    title: "Generative AI in Enterprise: Lessons from the Trenches",
    type: "article",
    url: "https://linkedin.com/pulse/generative-ai-enterprise-lessons-trenches-raffi-sourenkhatchadourian",
    date: "2024-11-20",
    description: "Real-world insights from implementing AI solutions at scale",
    platform: "LinkedIn",
  },
  {
    id: "music-data-startup",
    title: "Building a Music Data Startup: The indify Story",
    type: "post",
    url: "https://linkedin.com/pulse/building-music-data-startup-indify-story-raffi-sourenkhatchadourian",
    date: "2024-10-15",
    description: "Lessons learned from co-founding a music tech startup",
    platform: "LinkedIn",
  },
  {
    id: "ai-automation-research",
    title: "Large-Scale AI Automation: A Research Perspective",
    type: "research",
    url: "https://arxiv.org/abs/2024.ai.automation.raffi",
    date: "2024-09-30",
    description: "Academic paper on enterprise AI automation patterns",
    platform: "arXiv",
  },
  {
    id: "creative-tech-intersection",
    title: "The Intersection of Creativity and Technology",
    type: "article",
    url: "https://linkedin.com/pulse/intersection-creativity-technology-raffi-sourenkhatchadourian",
    date: "2024-08-25",
    description: "How technology enhances creative expression in music and art",
    platform: "LinkedIn",
  },
]

interface NotesWindowProps {
  isOpen: boolean
  onClose: () => void
}

export function NotesWindow({ isOpen, onClose }: NotesWindowProps) {
  const handleNoteClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const getTypeIcon = (type: Note["type"]) => {
    switch (type) {
      case "article":
        return "📄"
      case "research":
        return "🔬"
      case "post":
        return "📝"
      default:
        return "📄"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <WindowShell id="notes" title="NOTES - ARTICLES & RESEARCH" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="content-section">
          <h2 className="section-title">Notes & Publications</h2>
          <p className="text-xs text-gray-600">Articles, research papers, and thought pieces</p>
        </div>

        {/* Notes List */}
        <div className="content-section">
          <div className="space-y-3">
            {NOTES.map((note) => (
              <div
                key={note.id}
                onClick={() => handleNoteClick(note.url)}
                className="note-item cursor-pointer p-3 bg-white rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl">{getTypeIcon(note.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 mb-1">{note.title}</div>
                    <div className="text-xs text-gray-500 mb-2">{note.description}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{note.platform}</span>
                      <span>•</span>
                      <span>{formatDate(note.date)}</span>
                      <span>•</span>
                      <span className="capitalize">{note.type}</span>
                    </div>
                  </div>
                  <div className="text-blue-500 text-xs">↗</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="content-section">
          <div className="text-xs text-gray-600 text-center">
            {NOTES.length} publications • More on LinkedIn & arXiv
          </div>
        </div>
      </div>
    </WindowShell>
  )
}
