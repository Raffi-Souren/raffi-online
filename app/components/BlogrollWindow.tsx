"use client"

import { useState } from "react"
import { WindowsIcons } from "./Icons"

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
      embedUrl: "https://www.instagram.com/boweryshowroom/",
    },
  ]

  const renderEmbed = (item: any) => {
    if (item.embedType === "poolsuite") {
      return (
        <div className="w-full h-full">
          <iframe
            className="w-full h-[60vh] md:h-[70vh] rounded-md border border-gray-400"
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
            className="w-full h-[60vh] md:h-[70vh] rounded-md border border-gray-400"
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
      <div className="fixed inset-0 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 w-full md:w-[900px] h-[90vh] md:h-[700px] overflow-hidden z-50 window">
        <div className="window-title text-xs md:text-sm">
          <span className="flex items-center gap-1">
            {WindowsIcons.Internet} {item?.name || "Embed"}
          </span>
          <button className="ml-auto hover:bg-red-600 px-2 py-1 rounded" onClick={() => setActiveEmbed(null)}>
            {WindowsIcons.Close}
          </button>
        </div>
        <div className="window-content text-sm md:text-base p-0 h-[calc(100%-2rem)]">
          <div className="h-full">{item && renderEmbed(item)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 w-full md:w-[600px] h-[90vh] md:h-auto md:max-h-[80vh] overflow-y-auto z-50 window">
      <div className="window-title text-xs md:text-sm">
        <span className="flex items-center gap-1">{WindowsIcons.Internet} BLOGROLL</span>
        <button className="ml-auto hover:bg-red-600 px-2 py-1 rounded" onClick={onClose}>
          {WindowsIcons.Close}
        </button>
      </div>
      <div className="window-content text-sm md:text-base">
        <div className="space-y-4">
          <h2 className="text-black font-bold text-lg uppercase tracking-wider text-center md:text-left">
            LIST OF BLOGS/APPS I'M USING IN 2025
          </h2>

          <div className="space-y-3">
            {blogrollItems.map((item, index) => (
              <div key={index} className="border border-gray-400 p-3 bg-white">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-2">
                  <h3 className="text-black font-bold">{item.name}</h3>
                  <div className="flex gap-2">
                    {item.type === "embed" && (
                      <button
                        className="win-btn text-xs min-h-[44px] px-3 flex-1 md:flex-none"
                        onClick={() => setActiveEmbed(item.name)}
                      >
                        OPEN EMBED
                      </button>
                    )}
                    <button
                      className="win-btn text-xs min-h-[44px] px-3 flex-1 md:flex-none"
                      onClick={() => window.open(item.url, "_blank")}
                    >
                      VISIT SITE
                    </button>
                  </div>
                </div>
                <p className="text-gray-700 text-sm mb-1">{item.description}</p>
                <p className="text-blue-600 text-xs font-mono break-all">{item.url}</p>
              </div>
            ))}
          </div>

          <div className="p-3 border border-gray-400 mt-4 bg-gray-100">
            <p className="text-gray-800 text-sm">
              This is my curated list of websites, apps, and platforms that I'm actively using and following in 2025.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
