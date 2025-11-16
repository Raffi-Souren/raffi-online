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
  const [currentTime, setCurrentTime] = useState("12:00 AM")
  const [openWindows, setOpenWindows] = useState<Record<string, boolean>>({
    about: false,
    games: false,
    crates: false,
    blogroll: false,
    notes: false,
    startup: false,
    counter: false,
  })

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
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
    } else if (action === "startup") {
      window.open("https://chatgpt.com/g/g-68a497212bfc81918b450e9ca7ee67ba-raf-os-terminal", "_blank")
    } else {
      openWindow(action)
    }
  }

  const handleEasterEggClick = () => {
    openWindow("crates")
  }

  const handleStartMenuToggle = () => {
    setShowStartMenu(!showStartMenu)
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Image
        src="/windows-bg.jpg"
        alt="Windows XP Background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
        style={{ zIndex: -10 }}
        quality={85}
      />

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Mobile layout */}
        <div className="grid grid-cols-2 gap-4 p-4 pb-20 md:hidden pointer-events-auto">
          <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
          <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
          <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
          <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
          <div className="col-span-2 flex justify-center">
            <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden md:block">
          <div className="absolute top-8 left-8 pointer-events-auto">
            <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
          </div>
          <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-auto">
            <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
          </div>
          <div className="absolute top-8 right-1/3 pointer-events-auto">
            <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
          </div>
          <div className="absolute top-8 right-8 pointer-events-auto">
            <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
          </div>
          <div className="absolute bottom-32 left-8 pointer-events-auto">
            <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
          </div>
        </div>

        <div className="fixed bottom-20 left-4 pointer-events-auto" style={{ zIndex: 20 }}>
          <QuestionBlock onClick={handleEasterEggClick} />
        </div>
      </div>

      {/* Windows - only render when open */}
      {openWindows.about && <AboutWindow isOpen={openWindows.about} onClose={() => closeWindow("about")} />}
      {openWindows.games && <GameSelector isOpen={openWindows.games} onClose={() => closeWindow("games")} />}
      {openWindows.crates && <DiggingInTheCrates isOpen={openWindows.crates} onClose={() => closeWindow("crates")} />}
      {openWindows.blogroll && <BlogrollWindow isOpen={openWindows.blogroll} onClose={() => closeWindow("blogroll")} />}
      {openWindows.notes && <NotesWindow isOpen={openWindows.notes} onClose={() => closeWindow("notes")} />}
      {openWindows.startup && (
        <UnderConstructionWindow
          isOpen={openWindows.startup}
          onClose={() => closeWindow("startup")}
          title="Pitch Me a Startup"
        />
      )}
      {openWindows.counter && (
        <UnderConstructionWindow
          isOpen={openWindows.counter}
          onClose={() => closeWindow("counter")}
          title="By the Numbers"
        />
      )}

      {/* Start Menu */}
      {showStartMenu && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 90 }} onClick={() => setShowStartMenu(false)} />
          <StartMenu isOpen={showStartMenu} onClose={() => setShowStartMenu(false)} onOpenWindow={openWindow} />
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-12 bg-gradient-to-r from-blue-600 to-blue-700 border-t border-blue-500 flex items-center px-2" style={{ zIndex: 50 }}>
        <button
          onClick={handleStartMenuToggle}
          className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold transition-colors"
        >
          <span className="text-lg">🏁</span>
          Start
        </button>

        {Object.entries(openWindows).some(([, isOpen]) => isOpen) && (
          <div className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded">
            {Object.entries(openWindows)
              .filter(([, isOpen]) => isOpen)
              .map(([name]) => name.toUpperCase())
              .join(", ")}
          </div>
        )}

        <div className="ml-auto text-white text-sm font-mono bg-blue-800 px-2 py-1 rounded">{currentTime}</div>
      </div>
    </div>
  )
}
