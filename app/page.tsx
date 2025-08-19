"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import QuestionBlock from "../components/easter/QuestionBlock"
import DesktopIcon from "../components/ui/DesktopIcon"
import StartMenu from "../components/ui/StartMenu"
import AboutWindow from "./components/AboutWindow"
import GameSelector from "./components/GameSelector"
import DiggingInTheCrates from "./components/DiggingInTheCrates"
import BlogrollWindow from "./components/BlogrollWindow"
import NotesWindow from "./components/NotesWindow"
import UnderConstructionWindow from "./components/UnderConstructionWindow"

export default function Home() {
  const [showStartMenu, setShowStartMenu] = useState(false)
  const [currentTime, setCurrentTime] = useState("")
  const [openWindows, setOpenWindows] = useState<Record<string, boolean>>({
    about: false,
    games: false,
    crates: false,
    blogroll: false,
    notes: false,
    startup: false,
    counter: false,
  })

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

  const openWindow = (windowName: string) => {
    setOpenWindows((prev) => ({ ...prev, [windowName]: true }))
    setShowStartMenu(false)
  }

  const closeWindow = (windowName: string) => {
    setOpenWindows((prev) => ({ ...prev, [windowName]: false }))
  }

  const handleIconClick = (action: string) => {
    if (action === "email") {
      try {
        const email = "raffi@notgoodcompany.com"
        const subject = "Contact from Website"
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`
        window.location.href = mailtoUrl
      } catch (error) {
        alert("Email: raffi@notgoodcompany.com")
      }
    } else {
      openWindow(action)
    }
  }

  const handleEasterEggClick = () => {
    openWindow("crates")
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Windows XP Background */}
      <Image
        src="/windows-bg.jpg"
        alt="Windows XP Background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center -z-10 pointer-events-none select-none"
        quality={85}
      />

      {/* Desktop Icons Container */}
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

          {/* Bottom Row - Hidden on mobile, removed "DIGGING IN THE CRATES" */}
          <div className="hidden md:flex flex-col items-center self-end mb-16">
            <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
          </div>
        </div>
      </div>

      {/* Question Block Easter Egg */}
      <div className="fixed bottom-20 right-4 z-20">
        <QuestionBlock onClick={handleEasterEggClick} />
      </div>

      {/* Windows */}
      <AboutWindow isOpen={openWindows.about} onClose={() => closeWindow("about")} />
      <GameSelector isOpen={openWindows.games} onClose={() => closeWindow("games")} />
      <DiggingInTheCrates isOpen={openWindows.crates} onClose={() => closeWindow("crates")} />
      <BlogrollWindow isOpen={openWindows.blogroll} onClose={() => closeWindow("blogroll")} />
      <NotesWindow isOpen={openWindows.notes} onClose={() => closeWindow("notes")} />
      <UnderConstructionWindow
        isOpen={openWindows.startup}
        onClose={() => closeWindow("startup")}
        title="Pitch Me a Startup"
      />
      <UnderConstructionWindow
        isOpen={openWindows.counter}
        onClose={() => closeWindow("counter")}
        title="By the Numbers"
      />

      {/* Start Menu */}
      {showStartMenu && <StartMenu onClose={() => setShowStartMenu(false)} onOpenWindow={openWindow} />}

      {/* Taskbar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-gradient-to-r from-blue-600 to-blue-700 border-t border-blue-500 flex items-center px-2 z-30">
        {/* Start Button */}
        <button
          onClick={() => setShowStartMenu(!showStartMenu)}
          className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold transition-colors"
        >
          <span className="text-lg">🏁</span>
          Start
        </button>

        {/* Active Window Indicator */}
        {Object.entries(openWindows).some(([, isOpen]) => isOpen) && (
          <div className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded">
            {Object.entries(openWindows)
              .filter(([, isOpen]) => isOpen)
              .map(([name]) => name.toUpperCase())
              .join(", ")}
          </div>
        )}

        {/* Time */}
        <div className="ml-auto text-white text-sm font-mono bg-blue-800 px-2 py-1 rounded">{currentTime}</div>
      </div>
    </div>
  )
}
