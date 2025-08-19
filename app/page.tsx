"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import GameSelector from "./components/GameSelector"
import BlogrollWindow from "./components/BlogrollWindow"
import { NotesWindow } from "./components/NotesWindow"
import AboutWindow from "./components/AboutWindow"
import UnderConstructionWindow from "./components/UnderConstructionWindow"
import { DesktopIcon } from "../components/ui/DesktopIcon"
import StartMenu from "../components/ui/StartMenu"
import QuestionBlock from "../components/easter/QuestionBlock"
import DiggingInTheCrates from "./components/DiggingInTheCrates"

export default function Home() {
  const [activeWindow, setActiveWindow] = useState<string | null>(null)
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false)
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

  const openWindow = (windowId: string) => {
    setActiveWindow(windowId)
    setIsStartMenuOpen(false)
  }

  const handleIconClick = (action: string) => {
    setIsStartMenuOpen(false) // Close start menu when opening window

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

  const closeWindow = () => {
    setActiveWindow(null)
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Windows XP Background with priority to avoid flash */}
      <Image
        src="/windows-bg.jpg"
        alt="Windows XP Background"
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-center -z-10 pointer-events-none select-none"
        quality={85}
      />

      {/* Desktop Icons Container with bottom padding for taskbar */}
      <div className="absolute inset-0 p-4 md:p-8 pb-[72px] md:pb-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 h-full">
          {/* Top Row */}
          <div className="flex flex-col items-center">
            <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
          </div>

          <div className="flex flex-col items-center">
            <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
          </div>

          <div className="flex flex-col items-center">
            <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
          </div>

          <div className="flex flex-col items-center">
            <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
          </div>

          {/* Bottom Row - Hidden on mobile, positioned for desktop */}
          <div className="hidden md:flex flex-col items-center self-end mb-16">
            <DesktopIcon label="DJ SETS 12 INCH (COMING SOON)" icon="🎵" onClick={() => handleIconClick("music")} />
          </div>

          <div className="hidden md:flex flex-col items-center self-end mb-16">
            <DesktopIcon label="PROJECTS (COMING SOON)" icon="📁" onClick={() => handleIconClick("projects")} />
          </div>
        </div>
      </div>

      {/* Question Block Easter Egg */}
      <QuestionBlock onClick={() => openWindow("crate-digging")} />

      {/* About Me Window */}
      <AboutWindow isOpen={activeWindow === "about"} onClose={closeWindow} />

      {/* Games Window */}
      <GameSelector isOpen={activeWindow === "games"} onClose={closeWindow} />

      {/* Crate Digging Window */}
      <DiggingInTheCrates isOpen={activeWindow === "crate-digging"} onClose={closeWindow} />

      {/* Blogroll Window */}
      <BlogrollWindow isOpen={activeWindow === "blogroll"} onClose={closeWindow} />

      {/* Notes Window */}
      <NotesWindow isOpen={activeWindow === "notes"} onClose={closeWindow} />

      {/* Under Construction Windows */}
      {activeWindow?.startsWith("construction-") && (
        <UnderConstructionWindow
          title={getConstructionTitle(activeWindow.replace("construction-", ""))}
          onClose={closeWindow}
        />
      )}

      {/* Taskbar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-gradient-to-r from-blue-600 to-blue-700 border-t border-blue-500 flex items-center px-2 z-[70] safe-area-inset-bottom">
        {/* Start Button */}
        <button
          onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
          className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold transition-colors"
          aria-label="Open Start Menu"
        >
          <span className="text-lg">🏁</span>
          Start
        </button>

        {/* Active Window Indicator */}
        {activeWindow && (
          <div className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded">
            {activeWindow.replace("construction-", "").toUpperCase()}
          </div>
        )}

        {/* Time */}
        <div className="ml-auto text-white text-sm font-mono bg-blue-800 px-2 py-1 rounded">{currentTime}</div>
      </div>

      {/* Start Menu */}
      <StartMenu
        isOpen={isStartMenuOpen}
        onOpenAbout={() => handleIconClick("about")}
        onOpenBlogroll={() => handleIconClick("blogroll")}
        onOpenGames={() => handleIconClick("games")}
        onOpenNotes={() => handleIconClick("notes")}
        onOpenEasterEgg={() => openWindow("crate-digging")}
        onOpenEmail={() => handleIconClick("email")}
      />

      {/* Click outside to close start menu */}
      {isStartMenuOpen && (
        <div className="fixed inset-0 z-[65]" onClick={() => setIsStartMenuOpen(false)} aria-hidden="true" />
      )}
    </div>
  )
}
