"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, ExternalLink } from "lucide-react"

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
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Blogroll</h2>
          <p className="text-gray-500 text-sm">Curated links to inspiring websites and resources</p>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search sites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`text-xs ${selectedCategory === category ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-gray-50"}`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Blogroll Items */}
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="group hover:shadow-md transition-all duration-200 border-gray-200"
              style={{ backgroundColor: "#ffffff" }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                    {item.category}
                  </Badge>
                </div>
                <p className="text-gray-600 text-sm mb-3 leading-relaxed">{item.description}</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline gap-1"
                >
                  Visit Site <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p>No sites found matching your criteria</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          Showing {filteredItems.length} of {blogrollItems.length} sites
        </div>
      </div>
    </WindowShell>
  )
}
