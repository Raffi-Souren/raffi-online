"use client"

import { useState } from "react"

interface BlogrollWindowProps {
  onClose: () => void
}

export default function BlogrollWindow({ onClose }: BlogrollWindowProps) {
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null)

  const blogrollItems = [
    {
      id: "poolsuite",
      name: "Poolsuite FM",
      description: "Retro web radio for the summer internet",
      url: "https://poolsuite.net/",
      embedUrl: "https://poolsuite.net/",
    },
    {
      id: "kidtakeover",
      name: "KidTakeOver",
      description: "Underground music collective",
      url: "https://www.youtube.com/@KidsTakeOver",
      embedUrl: "https://www.youtube.com/@KidsTakeOver",
    },
    {
      id: "bowery-showroom",
      name: "Bowery Showroom",
      description: "NYC's premier underground venue",
      url: "https://www.instagram.com/boweryshowroom/",
      embedUrl: "https://www.instagram.com/boweryshowroom/",
    },
    {
      id: "awge",
      name: "AWGE",
      description: "Creative collective and multimedia company",
      url: "https://awge.com/",
      embedUrl: "https://awge.com/",
    },
    {
      id: "hypebeast",
      name: "Hypebeast",
      description: "Culture, fashion, and lifestyle platform",
      url: "https://hypebeast.com/",
      embedUrl: "https://hypebeast.com/",
    },
    {
      id: "complex",
      name: "Complex",
      description: "Music, style, and pop culture magazine",
      url: "https://complex.com/",
      embedUrl: "https://complex.com/",
    },
    {
      id: "fader",
      name: "The Fader",
      description: "Music and culture magazine",
      url: "https://thefader.com/",
      embedUrl: "https://thefader.com/",
    },
    {
      id: "pitchfork",
      name: "Pitchfork",
      description: "Music reviews and cultural commentary",
      url: "https://pitchfork.com/",
      embedUrl: "https://pitchfork.com/",
    },
  ]

  const handleOpenEmbed = (item: any) => {
    window.open(item.embedUrl, "_blank")
  }

  const handleVisitSite = (item: any) => {
    window.open(item.url, "_blank")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="window w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="window-title bg-blue-600 text-white">
          <span className="flex items-center gap-2">🌐 BLOGROLL</span>
          <button className="ml-auto hover:bg-red-600 px-2 py-1 rounded text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="window-content flex-1 overflow-y-auto bg-gray-200">
          <div className="text-center py-6">
            <h1 className="text-2xl font-bold text-black mb-2">LIST OF BLOGS/APPS I'M USING IN 2025</h1>
          </div>

          <div className="space-y-4 px-4 pb-4">
            {blogrollItems.map((item) => (
              <div key={item.id} className="bg-white border border-gray-300 rounded p-4">
                <div className="mb-4">
                  <h3 className="font-bold text-lg text-black mb-2">{item.name}</h3>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => handleOpenEmbed(item)}
                      className="bg-gray-400 hover:bg-gray-500 text-black font-bold py-2 px-4 border border-gray-600"
                    >
                      OPEN EMBED
                    </button>
                    <button
                      onClick={() => handleVisitSite(item)}
                      className="bg-gray-400 hover:bg-gray-500 text-black font-bold py-2 px-4 border border-gray-600"
                    >
                      VISIT SITE
                    </button>
                  </div>
                  <p className="text-gray-700 mb-2">{item.description}</p>
                  <a
                    href={item.url}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.url}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
