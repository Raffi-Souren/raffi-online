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
      
      {/* Background - behind everything */}
      <Image
        src="/windows-bg.jpg"
        alt="Windows XP Background"
        fill
        priority
        sizes="100vw"
        style={{ zIndex: -10 }}
        className="object-cover object-center"
        quality={85}
      />

      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        zIndex: 10,
        padding: '1rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
        gridTemplateRows: 'repeat(auto-fit, minmax(100px, auto))',
        gap: '0.5rem',
        alignContent: 'start',
        maxWidth: '100%'
      }}>
        {/* Mobile: stacked in grid, Desktop: positioned absolutely */}
        <div className="md:!absolute md:!top-8 md:!left-8" style={{ gridColumn: '1', gridRow: '1' }}>
          <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
        </div>
        <div className="md:!absolute md:!top-8 md:!left-1/2 md:!-translate-x-1/2" style={{ gridColumn: '2', gridRow: '1' }}>
          <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
        </div>
        <div className="md:!absolute md:!top-8 md:!right-1/3" style={{ gridColumn: '3', gridRow: '1' }}>
          <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
        </div>
        <div className="md:!absolute md:!top-8 md:!right-8" style={{ gridColumn: '1', gridRow: '2' }}>
          <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
        </div>
        <div className="md:!absolute md:!bottom-32 md:!left-8" style={{ gridColumn: '2', gridRow: '2' }}>
          <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
        </div>
      </div>

      <div className="fixed bottom-20 left-4 md:bottom-20 md:left-4 z-20">
        <QuestionBlock onClick={handleEasterEggClick} />
      </div>

      {/* Taskbar - z-50 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '3rem', zIndex: 50 }} className="bg-gradient-to-r from-blue-600 to-blue-700 border-t border-blue-500 flex items-center px-2">
        <button
          onClick={handleStartMenuToggle}
          className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold transition-colors"
        >
          <span className="text-lg">🏁</span>
          Start
        </button>

        {Object.entries(openWindows).some(([, isOpen]) => isOpen) && (
          <div className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded truncate max-w-[150px] md:max-w-none">
            {Object.entries(openWindows)
              .filter(([, isOpen]) => isOpen)
              .map(([name]) => name.toUpperCase())
              .join(", ")}
          </div>
        )}

        <div className="ml-auto text-white text-xs md:text-sm font-mono bg-blue-800 px-2 py-1 rounded">{currentTime}</div>
      </div>

      {/* Start Menu - z-90 */}
      {showStartMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowStartMenu(false)} />
          <div style={{ zIndex: 91 }}>
            <StartMenu isOpen={showStartMenu} onClose={() => setShowStartMenu(false)} onOpenWindow={openWindow} />
          </div>
        </>
      )}

      {/* Windows - z-100/101 via WindowShell */}
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
    </div>
  )
}
