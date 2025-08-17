"use client"

import { useState, useEffect } from "react"
import { WindowsIcons } from "./Icons"

interface UnderConstructionWindowProps {
  title: string
  onClose: () => void
}

export default function UnderConstructionWindow({ title, onClose }: UnderConstructionWindowProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return ""
        return prev + "."
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="window fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[600px] h-[90vh] md:h-auto overflow-hidden z-50">
      <div className="window-title sticky top-0 z-10">
        <span>
          {WindowsIcons.Settings} {title} - Under Construction
        </span>
        <button className="ml-auto" onClick={onClose}>
          {WindowsIcons.Close}
        </button>
      </div>
      <div className="window-content text-center py-12">
        <div className="mb-8">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="pyrex-text mb-4">UNDER CONSTRUCTION</h2>
          <div className="canary-text mb-6">
            {title} is currently being built{dots}
            <br />
            Check back soon for updates!
          </div>
        </div>

        <div className="bg-black p-6 border border-yellow-400 mb-6">
          <div className="text-yellow-400 font-bold mb-2">🔨 What's Coming:</div>
          <div className="text-left text-sm space-y-1">
            {title === "Pitch Startup" && (
              <>
                <div>• AI-powered startup pitch feedback</div>
                <div>• Pitch deck analysis</div>
                <div>• Market research insights</div>
                <div>• Investment readiness scoring</div>
              </>
            )}
            {title === "Web Crates" && (
              <>
                <div>• Curated web development resources</div>
                <div>• Code snippets and templates</div>
                <div>• Developer tools collection</div>
                <div>• Open source project showcase</div>
              </>
            )}
            {title === "DJ Sets" && (
              <>
                <div>• Live mix recordings</div>
                <div>• SoundCloud/Mixcloud embeds</div>
                <div>• Track listings and downloads</div>
                <div>• Event booking information</div>
              </>
            )}
            {title === "Projects Labels" && (
              <>
                <div>• Enterprise AI implementations</div>
                <div>• Startup consulting work</div>
                <div>• Creative tech installations</div>
                <div>• Open source contributions</div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button className="win-btn" onClick={onClose}>
            {WindowsIcons.Home} Back to Desktop
          </button>
          <button className="win-btn" onClick={() => window.open("mailto:hello@raffi-souren.com", "_blank")}>
            {WindowsIcons.Email} Get Notified
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-400">
          <div className="mb-2">🎯 Expected Launch: Q2 2025</div>
          <div>Built with ❤️ using Next.js & AI</div>
        </div>
      </div>
    </div>
  )
}
