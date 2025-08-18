"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { WindowsIcons } from "./components/Icons"
import Counter from "./components/Counter"
import GameSelector from "./components/GameSelector"
import BlogrollWindow from "./components/BlogrollWindow"
import NotesWindow from "./components/NotesWindow"
import UnderConstructionWindow from "./components/UnderConstructionWindow"
import DesktopWindow from "../components/DesktopWindow"

// Dynamic import EasterEgg with SSR disabled
const EasterEgg = dynamic(() => import("./components/EasterEgg"), {
  ssr: false,
  loading: () => null,
})

export default function Home() {
  const [activeWindow, setActiveWindow] = useState<string | null>(null)
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false)
  const currentTime = new Date().toLocaleTimeString()

  // Working features first - v76 style labels
  const workingIcons = [
    {
      icon: WindowsIcons.User,
      label: "ABOUT RAF\nVINYL",
      action: "about",
    },
    {
      icon: WindowsIcons.Internet,
      label: "BLOGROLL\n2025",
      action: "blogroll",
    },
    {
      icon: WindowsIcons.Games,
      label: "GAMES",
      action: "games",
    },
    {
      icon: WindowsIcons.Notes,
      label: "MY\nNOTES",
      action: "notes",
    },
  ]

  // Coming soon features at bottom - v76 style labels
  const comingSoonIcons = [
    {
      icon: WindowsIcons.Music,
      label: 'DJ SETS\n12"\n(COMING SOON)',
      action: "music",
    },
    {
      icon: WindowsIcons.Documents,
      label: "PROJECTS\n(COMING SOON)",
      action: "projects",
    },
    {
      icon: WindowsIcons.Terminal,
      label: "PITCH\nSTARTUP\n(COMING SOON)",
      action: "terminal",
    },
  ]

  // Working start menu items - FIXED single CD emoji and easter egg action
  const startMenuItems = [
    { name: "About", icon: WindowsIcons.User, action: "about" },
    { name: "Blogroll", icon: WindowsIcons.Internet, action: "blogroll" },
    { name: "Games", icon: WindowsIcons.Games, action: "games" },
    { name: "My Notes", icon: WindowsIcons.Notes, action: "notes" },
    { name: "Email", icon: WindowsIcons.Email, action: "email" },
    { name: "Digging in the Crates", icon: "💿", action: "easter-egg" },
  ]

  const handleIconClick = (action: string) => {
    if (action === "music" || action === "projects" || action === "terminal") {
      setActiveWindow(`construction-${action}`)
    } else if (action === "email") {
      // Fixed email handling
      try {
        const email = "raffi@notgoodcompany.com"
        const subject = "Contact from Website"
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`

        // Try to open mailto, fallback to copying email
        const link = document.createElement("a")
        link.href = mailtoUrl
        link.click()

        // Also copy to clipboard as backup
        navigator.clipboard.writeText(email).catch(() => {})
      } catch (error) {
        // Fallback - show email in alert
        alert("Email: raffi@notgoodcompany.com")
      }
      setIsStartMenuOpen(false)
    } else if (action === "easter-egg") {
      // The easter egg is handled by the EasterEgg component itself
      // Just close the start menu
      setIsStartMenuOpen(false)
    } else {
      setActiveWindow(action)
    }
  }

  const getConstructionTitle = (action: string) => {
    switch (action) {
      case "music":
        return "DJ Sets"
      case "projects":
        return "Projects"
      case "terminal":
        return "Pitch Startup"
      default:
        return "Feature"
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-system relative">
      {/* Desktop Content Area - Takes remaining space above taskbar */}
      <div className="flex-1 flex flex-col justify-between p-1 md:p-2 pb-8">
        {/* Working Features - Top Area */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1 md:gap-2 justify-items-center">
          {workingIcons.map((item, index) => (
            <button key={`working-${index}`} className="desktop-icon" onClick={() => handleIconClick(item.action)}>
              <span className="desktop-icon-emoji">{item.icon}</span>
              <div className="desktop-icon-label">{item.label}</div>
            </button>
          ))}
        </div>

        {/* Coming Soon Features - Bottom Area */}
        <div className="grid grid-cols-3 gap-1 md:gap-2 justify-items-center">
          {comingSoonIcons.map((item, index) => (
            <button
              key={`coming-${index}`}
              className="desktop-icon coming-soon"
              onClick={() => handleIconClick(item.action)}
            >
              <span className="desktop-icon-emoji">{item.icon}</span>
              <div className="desktop-icon-label">{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Fixed Taskbar at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 taskbar flex items-center gap-1 md:gap-2 z-[100]">
        <button className="start-btn min-h-[32px]" onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}>
          {WindowsIcons.Windows} Start
        </button>
        {activeWindow && (
          <button className="win-btn flex items-center gap-1 md:gap-2 text-xs md:text-sm min-h-[32px]">
            {WindowsIcons[activeWindow]} {activeWindow}
          </button>
        )}
        <div className="ml-auto bg-white px-1 md:px-2 py-1 border border-gray-400 text-black text-xs md:text-sm">
          {currentTime}
        </div>
      </div>

      {/* Start Menu */}
      {isStartMenuOpen && (
        <div className="fixed bottom-7 md:bottom-8 left-0 window w-56 md:w-64 z-[200]">
          <div className="window-content">
            <div className="bg-black text-white p-3 mb-2">
              <div className="pyrex-text text-base md:text-xl">RAF OS</div>
              <div className="canary-text text-xs md:text-sm">Version 1.0</div>
            </div>
            <div className="space-y-1">
              {startMenuItems.map((item) => (
                <button
                  key={item.name}
                  className="w-full text-left px-3 py-2 hover:bg-yellow-400 hover:text-black flex items-center gap-2 transition-colors text-sm min-h-[44px]"
                  onClick={() => {
                    handleIconClick(item.action)
                    setIsStartMenuOpen(false)
                  }}
                >
                  {item.icon} {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* About Me Window */}
      <DesktopWindow title="ABOUT ME - RAF.TXT" isOpen={activeWindow === "about"} onClose={() => setActiveWindow(null)}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white flex items-center justify-center text-black font-bold text-sm md:text-base shrink-0">
              RAF
            </div>
            <div className="text-center md:text-left">
              <h1 className="pyrex-text mb-2">RAFFI SOURENKHATCHADOURIAN</h1>
              <p className="canary-text mb-4">NYC-based AI architect and technology consultant</p>
            </div>
          </div>

          {/* Bio Section */}
          <div className="p-3 bg-black border border-yellow-400">
            <h3 className="text-yellow-400 font-bold mb-3">BIO</h3>
            <p className="text-white text-sm leading-relaxed mb-3">
              Raffi is an NYC-based AI Architect driving generative AI transformations for IBM's enterprise clients
              since 2016 - from early Watson solutions to today's large-scale automation initiatives. He's also an
              entrepreneur and advisor @ Nameless Ventures, plus co-founder of Bad Company, a creative collective
              managing partnerships at high-profile NYC venues.
            </p>
            <p className="text-white text-sm leading-relaxed">
              Previously COO @ indify (music data startup through Thought Into Action incubator). Outside corporate
              life, he's deep in NYC's creative scene - DJing across city venues, playing pick-up soccer in Brooklyn,
              and crate-digging for vinyls with family.
            </p>
          </div>

          {/* AI Summit Keynote Embed - Fixed responsive sizing */}
          <div className="p-3 bg-black border border-yellow-400">
            <h3 className="text-yellow-400 font-bold mb-3">🎤 AI SUMMIT KEYNOTE - BANKING ON AI AGENTS</h3>
            <p className="text-white text-sm mb-3">Finance stage at Javits Center NYC - Dec 14, 2024</p>
            <div className="w-full">
              <iframe
                className="w-full h-[250px] md:h-[300px] rounded-md border border-gray-700"
                src="https://player.vimeo.com/video/1047612862?badge=0&autopause=0&player_id=0&app_id=58479"
                loading="lazy"
                decoding="async"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Banking on AI Agents - Keynote @ AI Summit 12-14-24"
              />
            </div>
          </div>

          {/* Enhanced Counters Section */}
          <div className="space-y-4">
            <h3 className="text-yellow-400 font-bold text-center">BY THE NUMBERS</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Counter end={150} label="DJ Sets" icon="🎧" />
              <Counter end={120} label="Events" icon="📅" />
              <Counter end={30} label="AI Projects" icon="🤖" />
            </div>
          </div>
        </div>
      </DesktopWindow>

      {/* Games Window */}
      <DesktopWindow title="RETRO GAMES" isOpen={activeWindow === "games"} onClose={() => setActiveWindow(null)}>
        <GameSelector />
      </DesktopWindow>

      {/* Blogroll Window */}
      {activeWindow === "blogroll" && <BlogrollWindow onClose={() => setActiveWindow(null)} />}

      {/* Notes Window */}
      {activeWindow === "notes" && <NotesWindow onClose={() => setActiveWindow(null)} />}

      {/* Under Construction Windows */}
      {activeWindow?.startsWith("construction-") && (
        <UnderConstructionWindow
          title={getConstructionTitle(activeWindow.replace("construction-", ""))}
          onClose={() => setActiveWindow(null)}
        />
      )}

      {/* Easter"")}
          onClose={() => setActiveWindow(null)}
        />
      )}

      {/* Easter Egg - Always visible for bouncing question mark */}
      <EasterEgg />
    </div>
  )
}
