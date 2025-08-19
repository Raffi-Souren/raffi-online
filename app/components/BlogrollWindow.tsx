"use client"

import WindowShell from "../../components/ui/WindowShell"

interface BlogrollItem {
  id: string
  name: string
  url: string
  description: string
  category: string
  icon: string
}

const BLOGROLL_ITEMS: BlogrollItem[] = [
  {
    id: "poolsuite",
    name: "Poolsuite",
    url: "https://poolsuite.net/",
    description: "Summer vibes and poolside aesthetics",
    category: "Lifestyle",
    icon: "🏊‍♂️",
  },
  {
    id: "kidtakeover",
    name: "KidTakeOver",
    url: "https://kidtakeover.com/",
    description: "Creative collective and cultural platform",
    category: "Culture",
    icon: "👶",
  },
  {
    id: "bowery-showroom",
    name: "Bowery Showroom",
    url: "https://boweryshowroom.com/",
    description: "NYC fashion and lifestyle destination",
    category: "Fashion",
    icon: "👗",
  },
]

interface BlogrollWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function BlogrollWindow({ isOpen, onClose }: BlogrollWindowProps) {
  const handleLinkClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <WindowShell id="blogroll" title="BLOGROLL - LINKS.HTM" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="content-section">
          <h2 className="section-title">Blogroll</h2>
          <p className="text-xs text-gray-600">Curated links to inspiring websites and platforms</p>
        </div>

        {/* Links List */}
        <div className="content-section">
          <div className="space-y-3">
            {BLOGROLL_ITEMS.map((item) => (
              <div
                key={item.id}
                onClick={() => handleLinkClick(item.url)}
                className="link-item cursor-pointer p-3 bg-white rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-600 mb-1">{item.url}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                    <div className="inline-block px-2 py-1 bg-gray-100 text-xs rounded mt-2">{item.category}</div>
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
            {BLOGROLL_ITEMS.length} curated links • Updated regularly
          </div>
        </div>
      </div>
    </WindowShell>
  )
}
