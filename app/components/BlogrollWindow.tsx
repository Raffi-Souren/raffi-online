"use client"

import { useState } from "react"
import DesktopWindow from "../../components/DesktopWindow"

interface BlogrollWindowProps {
  onClose: () => void
}

export default function BlogrollWindow({ onClose }: BlogrollWindowProps) {
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null)

  const blogrollItems = [
    {
      name: "Poolsuite FM",
      description: "Retro web radio for the summer internet",
      url: "https://poolsuite.net",
      type: "embed",
      embedType: "poolsuite",
    },
    {
      name: "KidTakeOver",
      description: "Underground music collective",
      url: "https://www.youtube.com/@KidsTakeOver",
      type: "embed",
      embedType: "youtube",
      embedUrl: "https://www.youtube.com/embed/DcdjDJm1nDw?si=5AP2rLJ2Sg0c3NpU",
    },
    {
      name: "Bowery Showroom",
      description: "NYC creative space and gallery",
      url: "https://boweryshowroom.com/",
      type: "embed",
      embedType: "instagram",
      embedUrl: "https://www.instagram.com/boweryshowroom/embed",
    },
  ]

  const renderEmbed = (item: any) => {
    if (item.embedType === "poolsuite") {
      return (
        <div className="w-full h-full">
          <iframe
            className="w-full h-[60vh] md:h-[70vh] rounded-md border border-gray-700"
            src="https://poolsuite.net"
            loading="lazy"
            decoding="async"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
      )
    } else if (item.embedType === "youtube") {
      return (
        <div className="w-full h-full">
          <iframe
            className="w-full h-[60vh] md:h-[70vh] rounded-md border border-gray-700"
            src={item.embedUrl}
            title="YouTube video player"
            loading="lazy"
            decoding="async"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )
    }
    return null
  }

  if (activeEmbed) {
    const item = blogrollItems.find((item) => item.name === activeEmbed)
    return (
      <DesktopWindow title={item?.name || "Embed"} isOpen={true} onClose={() => setActiveEmbed(null)}>
        <div className="h-full">{item && renderEmbed(item)}</div>
      </DesktopWindow>
    )
  }

  return (
    <DesktopWindow title="BLOGROLL" isOpen={true} onClose={onClose}>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="p-3 bg-black border border-yellow-400">
          <h2 className="text-yellow-400 font-bold mb-3 text-center md:text-left">
            📚 LIST OF BLOGS/APPS I'M USING IN 2025
          </h2>
        </div>

        {/* Blogroll Items */}
        <div className="space-y-4">
          {blogrollItems.map((item, index) => (
            <div key={index} className="p-3 bg-black border border-yellow-400">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 gap-3">
                <div className="flex-1">
                  <h3 className="text-yellow-400 font-bold text-lg mb-2">{item.name}</h3>
                  <p className="text-white text-sm mb-2">{item.description}</p>
                  <p className="text-blue-400 text-xs font-mono break-all">{item.url}</p>
                </div>
                <div className="flex flex-col md:flex-row gap-2 md:ml-4">
                  {item.type === "embed" && (
                    <button
                      className="win-btn text-xs min-h-[44px] px-4 whitespace-nowrap"
                      onClick={() => setActiveEmbed(item.name)}
                    >
                      OPEN EMBED
                    </button>
                  )}
                  <button
                    className="win-btn text-xs min-h-[44px] px-4 whitespace-nowrap"
                    onClick={() => window.open(item.url, "_blank")}
                  >
                    VISIT SITE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Description */}
        <div className="p-3 bg-black border border-yellow-400">
          <p className="text-white text-sm leading-relaxed">
            This is my curated list of websites, apps, and platforms that I'm actively using and following in 2025. Each
            represents a different aspect of my interests in AI, music, art, and technology.
          </p>
        </div>
      </div>
    </DesktopWindow>
  )
}
