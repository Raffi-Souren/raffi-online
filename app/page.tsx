"use client"

import { useState } from "react"
import { WindowsIcons } from "./components/Icons"
import Counter from "./components/Counter"
import EasterEgg from "./components/EasterEgg"
import GameSelector from "./components/GameSelector"
import BlogrollWindow from "./components/BlogrollWindow"
import NotesWindow from "./components/NotesWindow"
import UnderConstructionWindow from "./components/UnderConstructionWindow"

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
      // Easter egg is always visible, just close menu - this should trigger the easter egg
      setIsStartMenuOpen(false)
      // The easter egg is always visible and clickable
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
    <div className="min-h-screen flex flex-col">
      {/* Desktop Icons */}
      <div className="flex-1 flex flex-col justify-between p-2">
        {/* Working Features - Top Area */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 justify-items-center">
          {workingIcons.map((item, index) => (
            <button key={`working-${index}`} className="desktop-icon" onClick={() => handleIconClick(item.action)}>
              <span className="desktop-icon-emoji">{item.icon}</span>
              <div className="desktop-icon-label">{item.label}</div>
            </button>
          ))}
        </div>

        {/* Coming Soon Features - Bottom Area */}
        <div className="grid grid-cols-3 gap-2 justify-items-center mb-4">
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

      {/* Active Windows - v76 sizing */}
      {activeWindow === "about" && (
        <div className="window fixed bottom-8 left-4 w-[600px] md:w-[700px] h-[500px] md:h-[600px] overflow-y-auto z-50">
          <div className="window-title sticky top-0 z-10">
            <span>{WindowsIcons.User} ABOUT ME - RAF.TXT</span>
            <button className="ml-auto" onClick={() => setActiveWindow(null)}>
              {WindowsIcons.Close}
            </button>
          </div>
          <div className="window-content">
            <div className="mb-4 flex items-start gap-4">
              <div className="w-20 h-20 bg-white flex items-center justify-center text-black font-bold">RAF</div>
              <div>
                <h1 className="pyrex-text mb-2">RAFFI SOURENKHATCHADOURIAN</h1>
                <p className="canary-text mb-4">NYC-based AI architect and technology consultant</p>
              </div>
            </div>

            {/* Bio Section */}
            <div className="mb-6 p-4 bg-black border border-yellow-400">
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

            {/* AI Summit Keynote Embed */}
            <div className="mb-6 p-4 bg-black border border-yellow-400">
              <h3 className="text-yellow-400 font-bold mb-3">🎤 AI SUMMIT KEYNOTE - BANKING ON AI AGENTS</h3>
              <p className="text-white text-sm mb-3">Finance stage at Javits Center NYC - Dec 14, 2024</p>
              <div style={{ padding: "62.5% 0 0 0", position: "relative" }}>
                <iframe
                  src="https://player.vimeo.com/video/1047612862?badge=0&autopause=0&player_id=0&app_id=58479"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                  title="Banking on AI Agents - Keynote @ AI Summit 12-14-24"
                ></iframe>
              </div>
              <script src="https://player.vimeo.com/api/player.js"></script>
            </div>

            {/* Counters */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Counter end={150} label="DJ Sets" icon={WindowsIcons.Music} />
                <Counter end={120} label="Events" icon={WindowsIcons.Calendar} />
                <Counter end={30} label="AI Projects" icon={WindowsIcons.MyComputer} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Games Window */}
      {activeWindow === "games" && (
        <div className="window fixed top-20 left-1/2 -translate-x-1/2 w-[90vw] max-w-[900px] h-[80vh] overflow-y-auto z-50">
          <div className="window-title sticky top-0 z-10">
            <span>{WindowsIcons.Games} RETRO GAMES</span>
            <button className="ml-auto" onClick={() => setActiveWindow(null)}>
              {WindowsIcons.Close}
            </button>
          </div>
          <div className="window-content">
            <GameSelector />
          </div>
        </div>
      )}

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

      {/* Taskbar */}
      <div className="taskbar flex items-center gap-2">
        <button className="start-btn" onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}>
          {WindowsIcons.Windows} Start
        </button>
        {activeWindow && (
          <button className="win-btn flex items-center gap-2">
            {WindowsIcons[activeWindow]} {activeWindow}
          </button>
        )}
        <div className="ml-auto bg-white px-2 py-1 border border-gray-400 text-black">{currentTime}</div>
      </div>

      {/* Start Menu */}
      {isStartMenuOpen && (
        <div className="window absolute bottom-8 left-0 w-64">
          <div className="window-content">
            <div className="bg-black text-white p-4 mb-2">
              <div className="pyrex-text">RAF OS</div>
              <div className="canary-text">Version 1.0</div>
            </div>
            <div className="space-y-2">
              {startMenuItems.map((item) => (
                <button
                  key={item.name}
                  className="w-full text-left px-4 py-2 hover:bg-yellow-400 hover:text-black flex items-center gap-2 transition-colors"
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

      {/* Easter Egg */}
      <EasterEgg />
    </div>
  )
}
