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
const RaffiWorldWindow = dynamic(() => import("./components/RaffiWorldWindow"))

const DESKTOP_SHORTCUTS = [
  { action: "about", icon: "👤", label: "ABOUT" },
  { action: "blogroll", icon: "🌐", label: "BLOGROLL" },
  { action: "games", icon: "🎮", label: "GAMES" },
  { action: "notes", icon: "📝", label: "NOTES" },
  { action: "ipod", icon: "🎧", label: "iPod" },
  { action: "projects", icon: "🛠️", label: "PROJECTS" },
  { action: "world", icon: "🌆", label: "RAFFI WORLD" },
  { action: "startup", icon: "💡", label: "PITCH STARTUP" },
] as const

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
    world: false,
  })
  // Once launched, keep RAFFI WORLD mounted so minimizing it preserves the
  // WebGL context, audio graph, and the player's current run.
  const [worldLaunched, setWorldLaunched] = useState(false)
  const openWindow = (windowName: string) => {
    if (windowName === "world") setWorldLaunched(true)
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

      <div data-desktop-icons="true" className="desktop-shortcuts">
        {DESKTOP_SHORTCUTS.map((shortcut) => (
          <div key={shortcut.action} className={`desktop-shortcut desktop-shortcut-${shortcut.action}`}>
            <DesktopIcon
              label={shortcut.label}
              icon={shortcut.icon}
              onClick={() => handleIconClick(shortcut.action)}
            />
          </div>
        ))}
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
      {worldLaunched && (
        <RaffiWorldWindow isOpen={openWindows.world} onClose={() => closeWindow("world")} />
      )}
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
