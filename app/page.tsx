"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import QuestionBlock from "../components/easter/QuestionBlock"
import DesktopIcon from "../components/ui/DesktopIcon"
import StartMenu from "../components/ui/StartMenu"
import DesktopContextMenu from "../components/ui/DesktopContextMenu"
import Taskbar from "./components/Taskbar"
import NowPlaying from "./components/NowPlaying"
import WindowShell, { WindowActivityProvider } from "../components/ui/WindowShell"

const AboutWindow = dynamic(() => import("./components/AboutWindow"))
const GameSelector = dynamic(() => import("./components/GameSelector"))
const DiggingInTheCrates = dynamic(() => import("./components/DiggingInTheCrates"))
const BlogrollWindow = dynamic(() => import("./components/BlogrollWindow"))
const NotesWindow = dynamic(() => import("./components/NotesWindow"))
const UnderConstructionWindow = dynamic(() => import("./components/UnderConstructionWindow"))
const IPodWindow = dynamic(() => import("./components/IPodWindow"))
const ProjectsWindow = dynamic(() => import("./components/ProjectsWindow"))
const RaffiWorldWindow = dynamic(() => import("./components/RaffiWorldWindow"))
const RafOsTerminal = dynamic(() => import("./components/RafOsTerminal"))

const DESKTOP_SHORTCUTS = [
  { action: "about", icon: "👤", label: "ABOUT" },
  { action: "blogroll", icon: "🌐", label: "BLOGROLL" },
  { action: "games", icon: "🎮", label: "GAMES" },
  { action: "notes", icon: "📝", label: "NOTES" },
  { action: "ipod", icon: "🎧", label: "iPod" },
  { action: "projects", icon: "🛠️", label: "PROJECTS" },
  { action: "world", icon: "🌆", label: "RAFFI WORLD" },
  { action: "startup", icon: "💡", label: "RAF OS TERMINAL" },
] as const

// Keep every window in a stable DOM slot. Visual ordering is supplied through
// WindowActivityProvider so bringing the World iframe forward never moves or
// reloads its browsing context.
const WINDOW_SLOTS = [
  "about",
  "games",
  "crates",
  "blogroll",
  "notes",
  "ipod",
  "world",
  "projects",
  "startup",
  "counter",
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
  // Closing the terminal ends its request, while its mounted session survives.
  // Minimizing only hides the shell, so a running request can still finish.
  const [terminalLaunched, setTerminalLaunched] = useState(false)
  const [terminalMinimized, setTerminalMinimized] = useState(false)
  // Oldest to newest. WindowShell consumes the derived layer through context;
  // taskbar, quick-launch, Start-menu, and desktop launches all use this path.
  const [windowOrder, setWindowOrder] = useState<string[]>([])

  useEffect(() => {
    const app = new URLSearchParams(window.location.search).get("app")
    if (app && WINDOW_SLOTS.some((name) => name === app)) {
      setOpenWindows((previous) => ({ ...previous, [app]: true }))
      setWindowOrder([app])
      if (app === "world") setWorldLaunched(true)
      if (app === "startup") setTerminalLaunched(true)
    }

    // Only the terminal participates in browser navigation. Other apps keep
    // their existing state when Back closes or Forward restores this session.
    const syncTerminalLocation = () => {
      const terminalOpen = new URLSearchParams(window.location.search).get("app") === "startup"
      setOpenWindows((previous) => ({ ...previous, startup: terminalOpen }))
      setTerminalMinimized(false)
      setWindowOrder((previous) => {
        const others = previous.filter((name) => name !== "startup")
        return terminalOpen ? [...others, "startup"] : others
      })
      if (terminalOpen) {
        setTerminalLaunched(true)
        setShowStartMenu(false)
      }
    }
    window.addEventListener("popstate", syncTerminalLocation)
    return () => window.removeEventListener("popstate", syncTerminalLocation)
  }, [])

  const bringToFront = (windowName: string) => {
    setWindowOrder((prev) => {
      if (prev[prev.length - 1] === windowName) return prev
      return [...prev.filter((name) => name !== windowName), windowName]
    })
  }

  const openWindow = (windowName: string) => {
    if (windowName === "world") setWorldLaunched(true)
    if (windowName === "startup") {
      setTerminalLaunched(true)
      setTerminalMinimized(false)
      const url = new URL(window.location.href)
      if (url.searchParams.get("app") !== "startup") {
        url.searchParams.set("app", "startup")
        window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      }
    }
    setOpenWindows((prev) => ({ ...prev, [windowName]: true }))
    bringToFront(windowName)
    setShowStartMenu(false)
  }

  const closeWindow = (windowName: string) => {
    setOpenWindows((prev) => ({ ...prev, [windowName]: false }))
    if (windowName === "startup") {
      setTerminalMinimized(false)
      const url = new URL(window.location.href)
      if (url.searchParams.get("app") === "startup") {
        url.searchParams.delete("app")
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      }
    }
    // World is minimized rather than destroyed. Keeping its stable slot in the
    // order preserves the iframe; restoring it simply promotes its layer.
    if (windowName !== "world") {
      setWindowOrder((prev) => prev.filter((name) => name !== windowName))
    }
  }

  let activeWindow: string | null = null
  for (let index = windowOrder.length - 1; index >= 0; index--) {
    const name = windowOrder[index]
    if (openWindows[name] && !(name === "startup" && terminalMinimized)) {
      activeWindow = name
      break
    }
  }

  const renderWindow = (windowName: (typeof WINDOW_SLOTS)[number]) => {
    switch (windowName) {
      case "about":
        return <AboutWindow isOpen={openWindows.about} onClose={() => closeWindow("about")} />
      case "games":
        return <GameSelector isOpen={openWindows.games} onClose={() => closeWindow("games")} />
      case "crates":
        return <DiggingInTheCrates isOpen={openWindows.crates} onClose={() => closeWindow("crates")} />
      case "blogroll":
        return <BlogrollWindow isOpen={openWindows.blogroll} onClose={() => closeWindow("blogroll")} />
      case "notes":
        return <NotesWindow isOpen={openWindows.notes} onClose={() => closeWindow("notes")} />
      case "ipod":
        return <IPodWindow isOpen={openWindows.ipod} onClose={() => closeWindow("ipod")} />
      case "world":
        return <RaffiWorldWindow isOpen={openWindows.world} onClose={() => closeWindow("world")} />
      case "projects":
        return (
          <WindowShell title="PROJECTS" onClose={() => closeWindow("projects")}>
            <ProjectsWindow />
          </WindowShell>
        )
      case "startup":
        return (
          <RafOsTerminal
            isOpen={openWindows.startup}
            isMinimized={terminalMinimized}
            onClose={() => closeWindow("startup")}
            onMinimize={() => setTerminalMinimized(true)}
          />
        )
      case "counter":
        return (
          <UnderConstructionWindow
            isOpen={openWindows.counter}
            onClose={() => closeWindow("counter")}
            title="By the Numbers"
          />
        )
    }
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
      className="relative overflow-hidden"
      style={{
        minHeight: "100dvh",
        height: "100dvh",
      }}
    >
      {/* Background - behind everything */}
      <div
        data-desktop-bg="true"
        style={{ position: "fixed", inset: 0, zIndex: -10, height: "100dvh", width: "100vw" }}
      >
        <Image
          src="/windows-bg.jpg"
          alt="Windows XP Background"
          fill
          priority
          sizes="100vw"
          quality={85}
          style={{ objectFit: "cover", objectPosition: "center", width: "100%", height: "100%" }}
        />
      </div>

      {/* Desktop Context Menu */}
      <DesktopContextMenu onOpenWindow={openWindow} />

      <div data-desktop-icons="true" className="desktop-shortcuts">
        {DESKTOP_SHORTCUTS.map((shortcut) => (
          <div key={shortcut.action} className={`desktop-shortcut desktop-shortcut-${shortcut.action}`}>
            <DesktopIcon label={shortcut.label} icon={shortcut.icon} onClick={() => handleIconClick(shortcut.action)} />
          </div>
        ))}
      </div>

      <QuestionBlock active={activeWindow === null} onClick={handleEasterEggClick} />

      {/* Now Playing Component */}
      <NowPlaying />

      {/* Taskbar - z-50 */}
      <Taskbar
        onStartClick={handleStartMenuToggle}
        onWindowClick={openWindow}
        openWindows={openWindows}
        persistentWindows={{ world: worldLaunched }}
        minimizedWindows={{ startup: terminalMinimized }}
        activeWindow={activeWindow}
      />

      {showStartMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9000, backgroundColor: "transparent" }}
            onClick={() => setShowStartMenu(false)}
          />
          <StartMenu isOpen={showStartMenu} onClose={() => setShowStartMenu(false)} onOpenWindow={openWindow} />
        </>
      )}

      {/* Stable window slots; their context layer implements foreground order. */}
      {WINDOW_SLOTS.map((windowName) => {
        const keepWorldMounted = windowName === "world" && worldLaunched
        const keepTerminalMounted = windowName === "startup" && terminalLaunched
        if (!openWindows[windowName] && !keepWorldMounted && !keepTerminalMounted) return null
        const orderIndex = Math.max(windowOrder.indexOf(windowName), 0)
        return (
          <WindowActivityProvider
            key={windowName}
            active={!showStartMenu && activeWindow === windowName}
            layer={100 + orderIndex * 2}
            onActivate={() => bringToFront(windowName)}
          >
            {renderWindow(windowName)}
          </WindowActivityProvider>
        )
      })}
    </div>
  )
}
