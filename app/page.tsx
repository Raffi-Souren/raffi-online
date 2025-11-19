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
import NowPlaying from "./components/NowPlaying"
import { useAudio } from "./context/AudioContext"
import { Play, Pause, Disc, Gamepad2, User } from 'lucide-react'

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
  const [isDesktop, setIsDesktop] = useState(false)
  const { currentTrack, isPlaying, togglePlay } = useAudio()

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

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768)
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
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

      {isDesktop ? (
        <div className="absolute inset-0 z-10">
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
      ) : (
        <div className="absolute inset-0 z-10 p-4 grid grid-cols-2 gap-4 content-start">
          <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
          <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
          <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
          <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
          <div className="col-span-2 mt-8">
            <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
          </div>
        </div>
      )}

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

      {/* Now Playing Component */}
      <NowPlaying />

      {/* Taskbar - z-50 */}
      <div 
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '40px', zIndex: 50 }} 
        className="bg-[#245DDA] border-t-2 border-[#3E80F1] flex items-center px-2 shadow-md"
      >
        <button
          onClick={handleStartMenuToggle}
          className="flex items-center gap-2 px-2 py-1 rounded-r-lg rounded-tl-lg rounded-bl-lg transition-all active:translate-y-px hover:brightness-110"
          style={{
            background: 'linear-gradient(to bottom, #3E9C4D 0%, #236F30 100%)',
            boxShadow: 'inset 1px 1px 0px rgba(255,255,255,0.4), 2px 2px 3px rgba(0,0,0,0.3)',
            border: 'none',
            color: 'white',
            paddingRight: '10px',
            paddingLeft: '6px'
          }}
        >
          <div className="italic font-bold text-lg not-italic drop-shadow-sm">
            <svg width="18" height="18" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }}>
              <path d="M0 12.402L35.454 7.613V41.89H0V12.402ZM46.567 5.99L88 0V41.804H46.567V5.99ZM0 49.938H35.454V84.134L0 79.433V49.938ZM46.567 49.938H88V88L46.567 82.093V49.938Z" fill="white"/>
            </svg>
          </div>
          <span className="text-lg italic font-bold" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.4)', fontStyle: 'italic', fontWeight: 'bold' }}>Start</span>
        </button>

        <div className="w-[2px] h-[28px] bg-[#1846A0] mx-2 shadow-[1px_0px_0px_rgba(255,255,255,0.2)]"></div>

        {/* Added Quick Launch section with pinned apps (Crates, Games, About) */}
        <div key="quick-launch-bar" className="flex items-center gap-1 mr-2 px-2 border-r border-[#1846A0] shadow-[1px_0px_0px_rgba(255,255,255,0.2)]">
          <button
            onClick={() => openWindow("crates")}
            className="p-1 hover:bg-[#3E80F1] rounded group relative transition-colors"
            title="Digging in the Crates"
          >
            <Disc size={20} className="text-white drop-shadow-md" />
          </button>
          <button
            onClick={() => openWindow("games")}
            className="p-1 hover:bg-[#3E80F1] rounded group relative transition-colors"
            title="Games"
          >
            <Gamepad2 size={20} className="text-white drop-shadow-md" />
          </button>
          <button
            onClick={() => openWindow("about")}
            className="p-1 hover:bg-[#3E80F1] rounded group relative transition-colors"
            title="About"
          >
            <User size={20} className="text-white drop-shadow-md" />
          </button>
        </div>

        {Object.entries(openWindows).some(([, isOpen]) => isOpen) && (
          <div className="flex gap-1 overflow-x-auto mr-2">
            {Object.entries(openWindows)
              .filter(([, isOpen]) => isOpen)
              .map(([name]) => (
                <div key={name} className="px-4 py-1 bg-[#1F50B8] hover:bg-[#2860D6] text-white text-xs rounded shadow-[inset_1px_1px_0px_rgba(255,255,255,0.2)] cursor-pointer transition-colors min-w-[100px] truncate border-b-2 border-[#153885]">
                  {name.toUpperCase()}
                </div>
              ))}
          </div>
        )}

        <div className={`ml-auto flex items-center bg-[#0F9DDE] px-3 py-1 rounded border border-[#0B76A8] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] text-white text-xs font-sans`}>
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
