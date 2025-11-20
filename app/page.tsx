"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import QuestionBlock from "../components/easter/QuestionBlock"
import DesktopIcon from "../components/ui/DesktopIcon"
import StartMenu from "../components/ui/StartMenu"
import Taskbar from "./components/Taskbar"
import AboutWindow from "./components/AboutWindow"
import GameSelector from "./components/GameSelector"
import DiggingInTheCrates from "./components/DiggingInTheCrates"
import BlogrollWindow from "./components/BlogrollWindow"
import NotesWindow from "./components/NotesWindow"
import UnderConstructionWindow from "./components/UnderConstructionWindow"
import NowPlaying from "./components/NowPlaying"
import GlobalAudioPlayer from "./components/GlobalAudioPlayer" // Import GlobalAudioPlayer
import { useAudio } from "./context/AudioContext"

export default function Home() {
  const [showStartMenu, setShowStartMenu] = useState(false)
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
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768)
    checkDesktop()
    window.addEventListener("resize", checkDesktop)
    return () => window.removeEventListener("resize", checkDesktop)
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
      <div style={{ position: "fixed", inset: 0, zIndex: -10, height: "100vh", width: "100vw" }}>
        <Image
          src="/windows-bg.jpg"
          alt="Windows XP Background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          quality={85}
          style={{ objectFit: "cover", objectPosition: "center", width: "100%", height: "100%" }}
        />
      </div>

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

      <div
        style={{
          position: "fixed",
          bottom: "5rem",
          left: "1rem",
          zIndex: 20,
        }}
        className="md:bottom-20"
      >
        <QuestionBlock onClick={handleEasterEggClick} />
      </div>

      {/* Now Playing Component */}
      <NowPlaying />

      {/* GlobalAudioPlayer to handle actual audio playback */}
      <GlobalAudioPlayer />

      {/* Taskbar - z-50 */}
      <Taskbar onStartClick={handleStartMenuToggle} onWindowClick={openWindow} openWindows={openWindows} />

      {showStartMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 90, backgroundColor: "transparent" }}
            onClick={() => setShowStartMenu(false)}
          />
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
