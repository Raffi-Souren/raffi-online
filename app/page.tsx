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

const APP_VERSION = "v267-VISIBILITY-TEST"
const BUILD_TIME = new Date().toISOString()

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.log("✅ Component mounted, setting mounted=true")
  }, [])

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
    console.log("🖱️ Icon clicked:", action)
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

  if (!mounted) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <Image
          src="/windows-bg.jpg"
          alt="Windows XP Background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center -z-10 pointer-events-none select-none"
          quality={85}
        />
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-2xl font-bold bg-black bg-opacity-75 p-8 rounded">
          Loading...
        </div>
      </div>
    )
  }

  console.log("🎨 Rendering Home component with mounted=true")

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Backdrop for Start Menu */}
      {showStartMenu && <div className="fixed inset-0 z-30" onClick={() => setShowStartMenu(false)} />}
      
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

      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold text-2xl z-50 border-4 border-black">
        🔴 VISIBILITY TEST - If you see this, rendering works!
      </div>

      {/* Desktop Icons Container */}
      <div className="absolute inset-0 p-4 md:p-8 pb-[72px] md:pb-0 z-10">
        {/* Mobile Layout - 2x3 Grid with Better Spacing */}
        <div className="grid grid-cols-2 gap-8 h-full md:hidden">
          {/* Row 1 */}
          <div className="flex flex-col items-center justify-start pt-4">
            <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
          </div>
          <div className="flex flex-col items-center justify-start pt-4">
            <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
          </div>

          {/* Row 2 */}
          <div className="flex flex-col items-center justify-start">
            <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
          </div>
          <div className="flex flex-col items-center justify-start">
            <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
          </div>

          {/* Row 3 - PITCH STARTUP centered with more spacing */}
          <div className="flex flex-col items-center justify-start col-span-2 pt-8">
            <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
          </div>
        </div>

        {/* Desktop Layout - Spread Out Icons with Ample Spacing */}
        <div className="hidden md:block h-full relative">
          {/* ABOUT - Top Left */}
          <div className="absolute top-8 left-8">
            <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
          </div>

          {/* BLOGROLL - Top Center */}
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
            <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
          </div>

          {/* GAMES - Top Center-Right */}
          <div className="absolute top-8 right-1/3">
            <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
          </div>

          {/* NOTES - Top Right */}
          <div className="absolute top-8 right-8">
            <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
          </div>

          {/* PITCH STARTUP - Bottom Left with Significant Spacing */}
          <div className="absolute bottom-32 left-8">
            <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
          </div>
        </div>
      </div>

      {/* Question Block Easter Egg */}
      <div className="fixed bottom-20 right-4 z-20">
        <QuestionBlock onClick={handleEasterEggClick} />
      </div>

      {/* Windows */}
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
      <StartMenu isOpen={showStartMenu} onClose={() => setShowStartMenu(false)} onOpenWindow={openWindow} />

      {/* Taskbar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-gradient-to-r from-blue-600 to-blue-700 border-t border-blue-500 flex items-center px-2 z-30">
        {/* Start Button */}
        <button
          onClick={handleStartMenuToggle}
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

        <div className="ml-auto mr-2 text-white text-xs bg-red-600 px-2 py-1 rounded font-mono font-bold">
          {APP_VERSION}
        </div>

        {/* Time */}
        <div className="text-white text-sm font-mono bg-blue-800 px-2 py-1 rounded">{currentTime}</div>
      </div>
    </div>
  )
}
