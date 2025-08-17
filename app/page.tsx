"use client"

import { useState } from "react"
import { WindowsIcons } from "./components/Icons"
import SongOfTheDay from "./components/SongOfTheDay"
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

  // Working features first
  const workingIcons = [
    {
      icon: WindowsIcons.User,
      label: "About RAF\nVinyl",
      action: "about",
    },
    {
      icon: WindowsIcons.Internet,
      label: "Blogroll\n2025",
      action: "blogroll",
    },
    {
      icon: WindowsIcons.Games,
      label: "Games",
      action: "games",
    },
    {
      icon: WindowsIcons.Notes,
      label: "My\nNotes",
      action: "notes",
    },
  ]

  // Coming soon features at bottom (updated labels)
  const comingSoonIcons = [
    {
      icon: WindowsIcons.Music,
      label: 'DJ Sets\n12"\n(Coming soon)',
      action: "music",
    },
    {
      icon: WindowsIcons.Documents,
      label: "Projects\n(Coming soon)",
      action: "projects",
    },
    {
      icon: WindowsIcons.Terminal,
      label: "Pitch\nStartup\n(Coming soon)",
      action: "terminal",
    },
  ]

  const handleIconClick = (action: string) => {
    if (action === "music" || action === "projects" || action === "terminal") {
      // Show under construction for these
      setActiveWindow(`construction-${action}`)
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

      {/* Active Windows */}
      {activeWindow === "about" && (
        <div className="window fixed inset-0 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 w-full md:w-[800px] h-[90vh] md:h-auto md:max-h-[80vh] overflow-y-auto z-50">
          <div className="window-title sticky top-0 z-10">
            <span>{WindowsIcons.User} About Me - RAF.txt</span>
            <button className="ml-auto" onClick={() => setActiveWindow(null)}>
              {WindowsIcons.Close}
            </button>
          </div>
          <div className="window-content">
            <div className="mb-4 flex items-start gap-4">
              <div className="w-20 h-20 bg-white flex items-center justify-center text-black font-bold">RAF</div>
              <div>
                <h1 className="pyrex-text mb-2">Raffi Sourenkhatchadourian</h1>
                <p className="canary-text mb-4">NYC-based AI architect and technology consultant</p>
              </div>
            </div>
            <div className="space-y-4">
              <SongOfTheDay />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Counter end={500} label="DJ Sets" icon={WindowsIcons.Music} />
                <Counter end={100} label="Events" icon={WindowsIcons.Calendar} />
                <Counter end={50} label="AI Projects" icon={WindowsIcons.MyComputer} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Games Window */}
      {activeWindow === "games" && (
        <div className="window fixed inset-0 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 w-full md:w-[800px] h-[90vh] md:h-auto md:max-h-[80vh] overflow-y-auto z-50">
          <div className="window-title sticky top-0 z-10">
            <span>{WindowsIcons.Games} Retro Games</span>
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
              {Object.entries(WindowsIcons).map(([name, icon]) => (
                <button
                  key={name}
                  className="w-full text-left px-4 py-2 hover:bg-yellow-400 hover:text-black flex items-center gap-2 transition-colors"
                  onClick={() => {
                    setActiveWindow(name.toLowerCase())
                    setIsStartMenuOpen(false)
                  }}
                >
                  {icon} {name}
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
