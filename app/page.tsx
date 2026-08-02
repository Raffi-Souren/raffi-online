"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import QuestionBlock from "../components/easter/QuestionBlock"
import DesktopIcon from "../components/ui/DesktopIcon"
import StartMenu from "../components/ui/StartMenu"
import DesktopContextMenu from "../components/ui/DesktopContextMenu"
import Taskbar from "./components/Taskbar"
import NowPlaying from "./components/NowPlaying"
import WindowShell from "../components/ui/WindowShell"

const AboutWindow = dynamic(() => import("./components/AboutWindow"))
const GameSelector = dynamic(() => import("./components/GameSelector"))
const DiggingInTheCrates = dynamic(() => import("./components/DiggingInTheCrates"))
const BlogrollWindow = dynamic(() => import("./components/BlogrollWindow"))
const NotesWindow = dynamic(() => import("./components/NotesWindow"))
const UnderConstructionWindow = dynamic(() => import("./components/UnderConstructionWindow"))
const IPodWindow = dynamic(() => import("./components/IPodWindow"))
const ProjectsWindow = dynamic(() => import("./components/ProjectsWindow"))

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
    ipod: false,
    projects: false,
  })
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
      } catch {
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
    <div
      className="relative min-h-screen h-screen overflow-hidden"
      style={{
        minHeight: "100dvh",
        height: "100dvh",
      }}
    >
      {/* Background - behind everything */}
      <div data-desktop-bg="true" style={{ position: "fixed", inset: 0, zIndex: -10, height: "100dvh", width: "100vw" }}>
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

      {/* Desktop Context Menu */}
      <DesktopContextMenu onOpenWindow={openWindow} />

      <div className="absolute inset-0 z-10 hidden md:block">
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
        <div className="absolute top-32 left-8">
          <DesktopIcon label="iPod" icon="🎧" onClick={() => handleIconClick("ipod")} />
        </div>
        <div className="absolute top-32 right-8">
          <DesktopIcon label="PROJECTS" icon="🛠️" onClick={() => handleIconClick("projects")} />
        </div>
      </div>

      <div
        className="grid grid-cols-2 content-start gap-4 overflow-y-auto md:hidden"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: "calc(40px + env(safe-area-inset-bottom, 0px))",
          left: 0,
          zIndex: 10,
          paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))",
          paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
          paddingBottom: "5rem",
          paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <DesktopIcon label="ABOUT" icon="👤" onClick={() => handleIconClick("about")} />
        <DesktopIcon label="BLOGROLL" icon="🌐" onClick={() => handleIconClick("blogroll")} />
        <DesktopIcon label="GAMES" icon="🎮" onClick={() => handleIconClick("games")} />
        <DesktopIcon label="NOTES" icon="📝" onClick={() => handleIconClick("notes")} />
        <DesktopIcon label="iPod" icon="🎧" onClick={() => handleIconClick("ipod")} />
        <DesktopIcon label="PROJECTS" icon="🛠️" onClick={() => handleIconClick("projects")} />
        <DesktopIcon label="PITCH STARTUP" icon="💡" onClick={() => handleIconClick("startup")} />
      </div>

      <div
        style={{
          position: "fixed",
          bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          left: "calc(1rem + env(safe-area-inset-left, 0px))",
          zIndex: 20,
        }}
      >
        <QuestionBlock onClick={handleEasterEggClick} />
      </div>

      {/* Now Playing Component */}
      <NowPlaying />

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
      {openWindows.ipod && <IPodWindow isOpen={openWindows.ipod} onClose={() => closeWindow("ipod")} />}
      {openWindows.projects && (
        <WindowShell title="PROJECTS" onClose={() => closeWindow("projects")}>
          <ProjectsWindow />
        </WindowShell>
      )}
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
