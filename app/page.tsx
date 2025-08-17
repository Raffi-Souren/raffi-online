"use client"

import { useState } from "react"
import { WindowsIcons } from "./components/Icons"
import SongOfTheDay from "./components/SongOfTheDay"
import Counter from "./components/Counter"
import EasterEgg from "./components/EasterEgg"
import TerminalWindow from "./components/TerminalWindow"
import GameSelector from "./components/GameSelector"
import PoolsuitePlayer from "./components/PoolsuitePlayer"
import NotesWindow from "./components/NotesWindow"

export default function Home() {
  const [activeWindow, setActiveWindow] = useState<string | null>(null)
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false)
  const currentTime = new Date().toLocaleTimeString()

  const desktopIcons = [
    {
      icon: WindowsIcons.User,
      label: "About RAF\nVinyl",
      action: "about",
    },
    {
      icon: WindowsIcons.Music,
      label: 'DJ Sets\n12"',
      action: "music",
    },
    {
      icon: WindowsIcons.Poolsuite,
      label: "Poolsuite\nFM",
      action: "poolsuite",
    },
    {
      icon: WindowsIcons.Documents,
      label: "Projects\nLabels",
      action: "projects",
    },
    {
      icon: WindowsIcons.Games,
      label: "Games\nBeats",
      action: "games",
    },
    {
      icon: WindowsIcons.Internet,
      label: "Web\nCrates",
      action: "internet",
    },
    {
      icon: WindowsIcons.Terminal,
      label: "Pitch\nStartup",
      action: "terminal",
    },
    {
      icon: WindowsIcons.Notes,
      label: "My\nNotes",
      action: "notes",
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop Icons */}
      <div className="flex-1 p-2 grid grid-cols-3 md:grid-cols-6 gap-2 content-start">
        {desktopIcons.map((item, index) => (
          <button key={index} className="desktop-icon" onClick={() => setActiveWindow(item.action)}>
            <span className="desktop-icon-emoji">{item.icon}</span>
            <div className="desktop-icon-label">{item.label}</div>
          </button>
        ))}
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

      {/* Poolsuite Window */}
      {activeWindow === "poolsuite" && (
        <div className="window fixed inset-0 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 w-full md:w-[800px] h-[90vh] md:h-[600px] overflow-hidden z-50">
          <div className="window-title sticky top-0 z-10">
            <span>{WindowsIcons.Poolsuite} Poolsuite FM</span>
            <button className="ml-auto" onClick={() => setActiveWindow(null)}>
              {WindowsIcons.Close}
            </button>
          </div>
          <div className="window-content p-0 h-[calc(100%-2rem)]">
            <PoolsuitePlayer />
          </div>
        </div>
      )}

      {/* Terminal Window */}
      {activeWindow === "terminal" && <TerminalWindow onClose={() => setActiveWindow(null)} />}

      {/* Notes Window */}
      {activeWindow === "notes" && <NotesWindow onClose={() => setActiveWindow(null)} />}

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
