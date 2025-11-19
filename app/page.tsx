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

      {/* Desktop Layout - Hidden on mobile, visible on md+ */}
      <div className="hidden md:block absolute inset-0 z-10">
        <div className="absolute top-8 left-8">
          <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
        </div>
        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
        </div>
        <div className="absolute top-8 right-32">
          <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
        </div>
        <div className="absolute top-8 right-8">
          <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
        </div>
        <div className="absolute bottom-32 left-8">
          <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
        </div>
      </div>

      {/* Mobile Layout - Grid, hidden on desktop */}
      <div className="md:hidden absolute inset-0 z-10 p-4 grid grid-cols-2 gap-4 content-start">
        <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
        <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
        <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
        <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
        <div className="col-span-2 mt-8">
          <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
        </div>
      </div>

      <div style={{ 
        position: 'fixed', 
        bottom: '5rem', 
        left: '1rem', 
        zIndex: 20 
      }}
      className="md:bottom-20"
      >
        <QuestionBlock onClick={handleEasterEggClick} />
      </div>

      {/* Taskbar - z-50 */}
      <div 
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '40px', zIndex: 50 }} 
        className="bg-[#245DDA] border-t-2 border-[#3E80F1] flex items-center px-2 shadow-md"
      >
        <button
          onClick={handleStartMenuToggle}
          className="flex items-center gap-2 px-2 py-1 bg-gradient-to-b from-[#3E9C4D] to-[#236F30] hover:brightness-110 text-white rounded-r-lg rounded-tl-lg rounded-bl-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.4)] transition-all active:translate-y-px"
          style={{
            boxShadow: '2px 2px 5px rgba(0,0,0,0.5), inset 1px 1px 0px rgba(255,255,255,0.3)'
          }}
        >
          <span className="text-lg drop-shadow-md italic font-bold pr-1">Start</span>
        </button>

        <div className="w-[2px] h-[28px] bg-[#1846A0] mx-2 shadow-[1px_0px_0px_rgba(255,255,255,0.2)]"></div>

        {Object.entries(openWindows).some(([, isOpen]) => isOpen) && (
          <div className="flex gap-1 overflow-x-auto">
            {Object.entries(openWindows)
              .filter(([, isOpen]) => isOpen)
              .map(([name]) => (
                <div key={name} className="px-4 py-1 bg-[#1F50B8] hover:bg-[#2860D6] text-white text-xs rounded shadow-[inset_1px_1px_0px_rgba(255,255,255,0.2)] cursor-pointer transition-colors min-w-[100px] truncate border-b-2 border-[#153885]">
                  {name.toUpperCase()}
                </div>
              ))}
          </div>
        )}

        <div className="ml-auto flex items-center bg-[#0F9DDE] px-3 py-1 rounded border border-[#0B76A8] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] text-white text-xs font-sans">
          <span className="mr-2">🔈</span>
          {currentTime}
        </div>
      </div>

      {showStartMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90, backgroundColor: 'transparent' }} onClick={() => setShowStartMenu(false)} />
          <StartMenu isOpen={showStartMenu} onClose={() => setShowStartMenu(false)} onOpenWindow={openWindow} />
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
