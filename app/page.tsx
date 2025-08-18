"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import Counter from "./components/Counter"
import GameSelector from "./components/GameSelector"
import BlogrollWindow from "./components/BlogrollWindow"
import NotesWindow from "./components/NotesWindow"
import UnderConstructionWindow from "./components/UnderConstructionWindow"
import DesktopWindow from "../components/DesktopWindow"

// Lazy load heavy features - don't ship on first paint
const EasterEgg = dynamic(() => import("./components/EasterEgg"), {
  ssr: false,
  loading: () => null,
})

export default function Home() {
  const [activeWindow, setActiveWindow] = useState<string | null>(null)
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false)
  const [easterEggForceOpen, setEasterEggForceOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState("")

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      )
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Working features first - v147 style with black labels
  const workingIcons = [
    {
      icon: "👤",
      label: "ABOUT\nRAF\nVINYL",
      action: "about",
    },
    {
      icon: "🌐",
      label: "BLOGROLL\n2025",
      action: "blogroll",
    },
    {
      icon: "🎮",
      label: "GAMES",
      action: "games",
    },
    {
      icon: "📝",
      label: "MY\nNOTES",
      action: "notes",
    },
  ]

  // Coming soon features at bottom - v147 style with black labels
  const comingSoonIcons = [
    {
      icon: "🎵",
      label: 'DJ SETS\n12"\n(COMING\nSOON)',
      action: "music",
    },
    {
      icon: "📁",
      label: "PROJECTS\n(COMING\nSOON)",
      action: "projects",
    },
    {
      icon: "💻",
      label: "PITCH\nSTARTUP\n(COMING\nSOON)",
      action: "terminal",
    },
  ]

  // Working start menu items
  const startMenuItems = [
    { name: "About", icon: "👤", action: "about" },
    { name: "Blogroll", icon: "🌐", action: "blogroll" },
    { name: "Games", icon: "🎮", action: "games" },
    { name: "My Notes", icon: "📝", action: "notes" },
    { name: "Email", icon: "📧", action: "email" },
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
      // Force open the easter egg popup
      setEasterEggForceOpen(true)
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

  // Body scroll lock effect
  useEffect(() => {
    if (activeWindow) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [activeWindow])

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Windows 2000 Background */}
      <Image
        src="/windows-2000-background.png"
        alt=""
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-center -z-10 pointer-events-none select-none"
        quality={85}
      />

      {/* Desktop Icons */}
      <div className="absolute inset-0 p-4 md:p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 h-full">
          {/* Top Row */}
          <div className="flex flex-col items-center">
            <button onClick={() => handleIconClick("about")} className="desktop-icon group mb-2">
              <div className="text-4xl md:text-5xl mb-2">👤</div>
            </button>
            <div className="desktop-label">ABOUT</div>
          </div>

          <div className="flex flex-col items-center">
            <button onClick={() => handleIconClick("blogroll")} className="desktop-icon group mb-2">
              <div className="text-4xl md:text-5xl mb-2">🌐</div>
            </button>
            <div className="desktop-label">BLOGROLL 2025</div>
          </div>

          <div className="flex flex-col items-center">
            <button onClick={() => handleIconClick("games")} className="desktop-icon group mb-2">
              <div className="text-4xl md:text-5xl mb-2">🎮</div>
            </button>
            <div className="desktop-label">GAMES</div>
          </div>

          <div className="flex flex-col items-center">
            <button onClick={() => handleIconClick("notes")} className="desktop-icon group mb-2">
              <div className="text-4xl md:text-5xl mb-2">📝</div>
            </button>
            <div className="desktop-label">MY NOTES</div>
          </div>

          {/* Bottom Row - Positioned higher to avoid taskbar */}
          <div className="flex flex-col items-center self-end mb-16 md:mb-20">
            <button onClick={() => handleIconClick("music")} className="desktop-icon group mb-2">
              <div className="text-4xl md:text-5xl mb-2">🎵</div>
            </button>
            <div className="desktop-label">DJ SETS 12" (COMING SOON)</div>
          </div>

          <div className="flex flex-col items-center self-end mb-16 md:mb-20">
            <button onClick={() => handleIconClick("projects")} className="desktop-icon group mb-2">
              <div className="text-4xl md:text-5xl mb-2">📁</div>
            </button>
            <div className="desktop-label">PROJECTS (COMING SOON)</div>
          </div>

          <div className="flex flex-col items-center self-end mb-16 md:mb-20">
            <button onClick={() => handleIconClick("terminal")} className="desktop-icon group mb-2">
              <div className="text-4xl md:text-5xl mb-2">💻</div>
            </button>
            <div className="desktop-label">PITCH STARTUP (COMING SOON)</div>
          </div>
        </div>
      </div>

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

      {/* Easter Egg - Always visible for bouncing question mark + force open capability */}
      <EasterEgg forceOpen={easterEggForceOpen} onForceClose={() => setEasterEggForceOpen(false)} />

      {/* Taskbar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-gradient-to-r from-blue-600 to-blue-700 border-t border-blue-500 flex items-center px-2 z-[1000] safe-area-inset-bottom">
        {/* Start Button */}
        <button
          onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
          className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold transition-colors"
        >
          <span className="text-lg">🏁</span>
          Start
        </button>

        {/* Active Window Indicator */}
        {activeWindow && <div className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded">{activeWindow}</div>}

        {/* Time */}
        <div className="ml-auto text-white text-sm font-mono bg-blue-800 px-2 py-1 rounded">{currentTime}</div>
      </div>

      {/* Enhanced Start Menu */}
      {isStartMenuOpen && (
        <div className="fixed bottom-12 left-0 start-menu z-[2000] safe-area-inset-bottom">
          <div className="start-menu-header">
            <span className="flex items-center gap-2">
              <span>🏁</span> RAF OS v2.0
            </span>
          </div>
          <div className="p-1">
            <button onClick={() => handleIconClick("about")} className="start-menu-item w-full text-left">
              <span className="text-base">👤</span>
              <span>About Raf Vinyl</span>
            </button>
            <button onClick={() => handleIconClick("blogroll")} className="start-menu-item w-full text-left">
              <span className="text-base">🌐</span>
              <span>Blogroll 2025</span>
            </button>
            <button onClick={() => handleIconClick("games")} className="start-menu-item w-full text-left">
              <span className="text-base">🎮</span>
              <span>Games</span>
            </button>
            <button onClick={() => handleIconClick("notes")} className="start-menu-item w-full text-left">
              <span className="text-base">📝</span>
              <span>My Notes</span>
            </button>
            <div className="start-menu-separator"></div>
            <button onClick={() => handleIconClick("easter-egg")} className="start-menu-item w-full text-left">
              <span className="text-base">🎵</span>
              <span>Digging in the Crates</span>
            </button>
            <button onClick={() => handleIconClick("email")} className="start-menu-item w-full text-left">
              <span className="text-base">📧</span>
              <span>Email Raffi</span>
            </button>
            <div className="start-menu-separator"></div>
            <button onClick={() => handleIconClick("terminal")} className="start-menu-item w-full text-left">
              <span className="text-base">💻</span>
              <span>Pitch Me a Startup</span>
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close start menu */}
      {isStartMenuOpen && <div className="fixed inset-0 z-[1500]" onClick={() => setIsStartMenuOpen(false)} />}
    </div>
  )
}
