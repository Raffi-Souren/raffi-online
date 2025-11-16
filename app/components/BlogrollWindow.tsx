"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"

interface BlogrollItem {
  id: number
  title: string
  description: string
  url: string
  category: string
}

const blogrollItems: BlogrollItem[] = [
  {
    id: 1,
    title: "Poolsuite",
    description: "The ultimate summer soundtrack and lifestyle brand that captures the essence of poolside vibes.",
    url: "https://poolsuite.net/",
    category: "Music",
  },
  {
    id: 2,
    title: "KidTakeOver",
    description: "Creative collective pushing boundaries in music, fashion, and digital culture.",
    url: "https://kidtakeover.com/",
    category: "Creative",
  },
  {
    id: 3,
    title: "Bowery Showroom",
    description: "Curated fashion and lifestyle destination showcasing emerging and established brands.",
    url: "https://boweryshowroom.com/",
    category: "Venue",
  },
]

interface BlogrollWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function BlogrollWindow({ isOpen, onClose }: BlogrollWindowProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")

  if (!isOpen) return null

  const categories = ["All", ...Array.from(new Set(blogrollItems.map((item) => item.category)))]

  const filteredItems = blogrollItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <WindowShell title="BLOGROLL" onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ color: '#111827' }}>Blogroll</h2>
          <p className="text-gray-600 text-sm" style={{ color: '#4B5563' }}>Curated links to inspiring websites and resources</p>
        </div>

        {/* Search and Filter */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search sites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: '#111827' }}
            />

            <div className="flex gap-2 flex-wrap">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                    selectedCategory === category
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  style={{ color: selectedCategory === category ? '#FFFFFF' : '#374151' }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Blogroll Items */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900" style={{ color: '#111827' }}>{item.title}</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded" style={{ color: '#1E40AF' }}>{item.category}</span>
                </div>
                <p className="text-gray-600 mb-3" style={{ color: '#4B5563' }}>{item.description}</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  {item.url} →
                </a>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center text-gray-500 py-4" style={{ color: '#6B7280' }}>No sites found matching your criteria</div>
          )}
        </div>

        {/* Stats */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t" style={{ color: '#6B7280' }}>
          Showing {filteredItems.length} of {blogrollItems.length} sites
        </div>
      </div>
    </WindowShell>
  )
}
