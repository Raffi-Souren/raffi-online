"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import QuestionBlock from "../components/easter/QuestionBlock"
import DesktopIcon from "../components/ui/DesktopIcon"
import StartMenu from "../components/ui/StartMenu"
import DesktopContextMenu from "../components/ui/DesktopContextMenu"
import Taskbar from "./components/Taskbar"
import NowPlaying from "./components/NowPlaying"
import DesktopWelcome from "./components/DesktopWelcome"
import WindowShell, { WindowActivityProvider } from "../components/ui/WindowShell"
import { DEFAULT_LAB_SLUG, labSlugFromPath, type LabSlug } from "@/data/lab"

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
const LabWindow = dynamic(() => import("./components/LabWindow"))

const DESKTOP_SHORTCUTS = [
  { action: "about", icon: "👤", label: "ABOUT", description: "A little about me" },
  { action: "blogroll", icon: "🌐", label: "BLOGROLL", description: "Sites and people I follow" },
  { action: "games", icon: "🎮", label: "GAMES", description: "Pick up and play" },
  { action: "notes", icon: "📝", label: "NOTES", description: "Writing, research & talks" },
  { action: "ipod", icon: "🎧", label: "iPod", description: "Mixes & music" },
  { action: "projects", icon: "🛠️", label: "PROJECTS", description: "Things I’m making" },
  { action: "startup", icon: "💡", label: "RAF OS", description: "AI pitch review" },
  { action: "lab", icon: "🧪", label: "LAB", description: "Experiments, papers & architecture" },
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
  "lab",
] as const

const WELCOME_COLLAPSED_KEY = "raffi:welcome-collapsed"
const WELCOME_DISMISSED_KEY = "raffi:welcome-dismissed"

export default function Home() {
  const [showStartMenu, setShowStartMenu] = useState(false)
  const [welcomeCollapsed, setWelcomeCollapsed] = useState(false)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const [welcomeReady, setWelcomeReady] = useState(false)
  // First-time visitors still get to meet the "?" block once, even with welcome.txt open.
  const [blockPeek, setBlockPeek] = useState(false)
  const previousActiveWindowRef = useRef<string | null>(null)
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
    lab: false,
  })
  const [labSlug, setLabSlug] = useState<LabSlug>(DEFAULT_LAB_SLUG)
  const [notesTab, setNotesTab] = useState<"articles" | "research" | undefined>(undefined)
  const [notesTabRequest, setNotesTabRequest] = useState(0)
  // Keep World and terminal sessions in stable slots, including after closing.
  // A close removes their taskbar entry; a minimize keeps it available to restore.
  const [worldLaunched, setWorldLaunched] = useState(false)
  const [worldCheatRequest, setWorldCheatRequest] = useState<{ id: number; code: string | null } | null>(null)
  // Closing the terminal ends its request, while its mounted session survives.
  // Minimizing only hides the shell, so a running request can still finish.
  const [terminalLaunched, setTerminalLaunched] = useState(false)
  const [minimizedWindows, setMinimizedWindows] = useState<Record<string, boolean>>({})
  const [windowNotice, setWindowNotice] = useState<{ name: string; sequence: number } | null>(null)
  const [closedWindow, setClosedWindow] = useState<string | null>(null)
  // Oldest to newest. WindowShell consumes the derived layer through context;
  // taskbar, quick-launch, Start-menu, and desktop launches all use this path.
  const [windowOrder, setWindowOrder] = useState<string[]>([])

  useEffect(() => {
    const initialLabSlug = labSlugFromPath(window.location.pathname)
    if (initialLabSlug) setLabSlug(initialLabSlug)
    const requestedApp = new URLSearchParams(window.location.search).get("app")
    const app = requestedApp && WINDOW_SLOTS.some((name) => name === requestedApp) ? requestedApp : initialLabSlug ? "lab" : null
    if (app && WINDOW_SLOTS.some((name) => name === app)) {
      setOpenWindows((previous) => ({ ...previous, ...(initialLabSlug ? { lab: true } : {}), [app]: true }))
      setWindowOrder(initialLabSlug && app !== "lab" ? ["lab", app] : [app])
      if (app === "world") setWorldLaunched(true)
      if (app === "startup") setTerminalLaunched(true)
    }

    // Deep-linked apps participate in Back/Forward without disturbing other
    // open windows or reloading their sessions.
    const syncDesktopLocation = () => {
      const terminalOpen = new URLSearchParams(window.location.search).get("app") === "startup"
      const locationSlug = labSlugFromPath(window.location.pathname)
      const labOpen = Boolean(locationSlug) || new URLSearchParams(window.location.search).get("app") === "lab"
      if (locationSlug) setLabSlug(locationSlug)
      setOpenWindows((previous) => ({ ...previous, startup: terminalOpen, lab: labOpen }))
      setMinimizedWindows((previous) => ({ ...previous, startup: false, lab: false }))
      setWindowOrder((previous) => {
        const others = previous.filter((name) => name !== "startup" && name !== "lab")
        return [...others, ...(labOpen ? ["lab"] : []), ...(terminalOpen ? ["startup"] : [])]
      })
      if (terminalOpen) {
        setTerminalLaunched(true)
        setShowStartMenu(false)
      }
      if (labOpen) setShowStartMenu(false)
    }
    window.addEventListener("popstate", syncDesktopLocation)
    return () => window.removeEventListener("popstate", syncDesktopLocation)
  }, [])

  const bringToFront = (windowName: string) => {
    setWindowOrder((prev) => {
      if (prev[prev.length - 1] === windowName) return prev
      return [...prev.filter((name) => name !== windowName), windowName]
    })
  }

  const openWindow = (windowName: string, requestedLabSlug?: LabSlug) => {
    setMinimizedWindows((previous) => ({ ...previous, [windowName]: false }))
    setWindowNotice(null)
    if (windowName === "world") setWorldLaunched(true)
    if (windowName === "lab") {
      const targetSlug = requestedLabSlug ?? labSlug
      if (requestedLabSlug) setLabSlug(requestedLabSlug)
      const url = new URL(window.location.href)
      url.pathname = `/lab/${targetSlug}`
      url.searchParams.delete("app")
      if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
        window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      }
    }
    if (windowName === "startup") {
      setTerminalLaunched(true)
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
    setClosedWindow(windowName)
    setOpenWindows((prev) => ({ ...prev, [windowName]: false }))
    setMinimizedWindows((previous) => ({ ...previous, [windowName]: false }))
    setWindowNotice(null)
    if (windowName === "startup") {
      const url = new URL(window.location.href)
      if (url.searchParams.get("app") === "startup") {
        url.searchParams.delete("app")
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      }
    }
    if (windowName === "lab") {
      const url = new URL(window.location.href)
      if (labSlugFromPath(url.pathname)) url.pathname = "/"
      if (url.searchParams.get("app") === "lab") url.searchParams.delete("app")
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
    }
    setWindowOrder((prev) => prev.filter((name) => name !== windowName))
  }

  const selectLabPost = (slug: LabSlug) => {
    setLabSlug(slug)
    const url = new URL(window.location.href)
    url.pathname = `/lab/${slug}`
    url.searchParams.delete("app")
    if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
      window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
    }
  }

  const minimizeWindow = (windowName: string) => {
    setMinimizedWindows((previous) => ({ ...previous, [windowName]: true }))
    setWindowNotice((previous) => ({ name: windowName, sequence: (previous?.sequence ?? 0) + 1 }))
    setShowStartMenu(false)
  }

  let activeWindow: string | null = null
  for (let index = windowOrder.length - 1; index >= 0; index--) {
    const name = windowOrder[index]
    if (openWindows[name] && !minimizedWindows[name]) {
      activeWindow = name
      break
    }
  }

  useEffect(() => {
    try {
      if (window.localStorage.getItem(WELCOME_COLLAPSED_KEY) === "1") setWelcomeCollapsed(true)
      if (window.localStorage.getItem(WELCOME_DISMISSED_KEY) === "1") setWelcomeDismissed(true)
    } catch {
      // Storage can be unavailable; the controls still work for this visit.
    }
    setWelcomeReady(true)
    const peek = setTimeout(() => setBlockPeek(true), 10_000)
    return () => clearTimeout(peek)
  }, [])

  useEffect(() => {
    if (previousActiveWindowRef.current && activeWindow === null) setBlockPeek(true)
    previousActiveWindowRef.current = activeWindow
  }, [activeWindow])

  const changeWelcomeCollapsed = (collapsed: boolean) => {
    setWelcomeCollapsed(collapsed)
    try {
      window.localStorage.setItem(WELCOME_COLLAPSED_KEY, collapsed ? "1" : "0")
    } catch {
      // Not persisting is fine; the choice still applies for this visit.
    }
  }

  const dismissWelcome = () => {
    setWelcomeDismissed(true)
    try { window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1") } catch { /* Visit-only dismissal. */ }
    document.querySelector<HTMLButtonElement>('button[aria-label="Start menu"]')?.focus({ preventScroll: true })
  }

  const showWelcome = () => {
    setWelcomeDismissed(false)
    changeWelcomeCollapsed(false)
    setShowStartMenu(false)
    setWindowNotice(null)
    setMinimizedWindows((previous) => {
      const next = { ...previous }
      for (const name of WINDOW_SLOTS) if (openWindows[name]) next[name] = true
      return next
    })
    try { window.localStorage.removeItem(WELCOME_DISMISSED_KEY) } catch { /* Visit-only restore. */ }
    document.querySelector('[data-desktop-icons="true"]')?.scrollTo({ top: 0, behavior: "auto" })
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-desktop-welcome] button[aria-controls="desktop-welcome-content"]')?.focus({ preventScroll: true })
    })
  }

  useEffect(() => {
    if (!windowNotice) return
    const frame = requestAnimationFrame(() => {
      const task = document.querySelector<HTMLButtonElement>(`[data-window-task="${windowNotice.name}"]`)
      task?.scrollIntoView({ block: "nearest", inline: "nearest" })
      if (!activeWindow) task?.focus({ preventScroll: true })
    })
    const timer = window.setTimeout(() => setWindowNotice(null), 4000)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [windowNotice, activeWindow])

  useEffect(() => {
    if (!closedWindow) return
    if (activeWindow) {
      setClosedWindow(null)
      return
    }
    const frame = requestAnimationFrame(() => {
      const launcher = document.querySelector<HTMLButtonElement>(`[data-desktop-app="${closedWindow}"] button`)
      const start = document.querySelector<HTMLButtonElement>('[aria-label="Desktop taskbar"] [aria-label="Start menu"]')
      ;(launcher ?? start)?.focus({ preventScroll: true })
      setClosedWindow(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [closedWindow, activeWindow])

  const renderWindow = (windowName: (typeof WINDOW_SLOTS)[number]) => {
    switch (windowName) {
      case "about":
        return <AboutWindow isOpen={openWindows.about} onClose={() => closeWindow("about")} />
      case "games":
        return (
          <GameSelector
            isOpen={openWindows.games}
            onClose={() => closeWindow("games")}
            onOpenWorld={() => openWindow("world")}
          />
        )
      case "crates":
        return <DiggingInTheCrates isOpen={openWindows.crates} onClose={() => closeWindow("crates")} onWorldCheat={(code) => {
          setWorldCheatRequest((previous) => ({ id: (previous?.id ?? 0) + 1, code }))
          openWindow("world")
        }} />
      case "blogroll":
        return <BlogrollWindow isOpen={openWindows.blogroll} onClose={() => closeWindow("blogroll")} />
      case "notes":
        return <NotesWindow isOpen={openWindows.notes} onClose={() => closeWindow("notes")} initialTab={notesTab} tabRequest={notesTabRequest} onOpenLabResearch={() => {
          openWindow("lab", "research")
        }} />
      case "ipod":
        return <IPodWindow isOpen={openWindows.ipod} onClose={() => closeWindow("ipod")} />
      case "world":
        return (
          <RaffiWorldWindow
            isOpen={openWindows.world}
            cheatRequest={worldCheatRequest}
            onClose={() => closeWindow("world")}
            onOpenLab={(slug) => openWindow("lab", slug)}
            onOpenShelf={() => {
              minimizeWindow("world")
              openWindow("games")
            }}
          />
        )
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
            isMinimized={Boolean(minimizedWindows.startup)}
            onClose={() => closeWindow("startup")}
            onMinimize={() => minimizeWindow("startup")}
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
      case "lab":
        return <LabWindow isOpen={openWindows.lab} active={activeWindow === "lab" && !showStartMenu} slug={labSlug} onClose={() => closeWindow("lab")} onSelect={selectLabPost} onOpenNotes={() => {
          setNotesTab("research")
          setNotesTabRequest((request) => request + 1)
          minimizeWindow("lab")
          openWindow("notes")
        }} />
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
        {welcomeReady && !welcomeDismissed && <DesktopWelcome collapsed={welcomeCollapsed} onCollapsedChange={changeWelcomeCollapsed} onDismiss={dismissWelcome} onAbout={() => openWindow("about")} onExplore={() => openWindow("lab")} />}
        {DESKTOP_SHORTCUTS.map((shortcut) => (
          <div key={shortcut.action} data-desktop-app={shortcut.action} className={`desktop-shortcut desktop-shortcut-${shortcut.action}`}>
            <DesktopIcon label={shortcut.label} description={shortcut.description} icon={shortcut.icon} onClick={() => handleIconClick(shortcut.action)} />
          </div>
        ))}
      </div>

      <QuestionBlock active={(welcomeDismissed || welcomeCollapsed || blockPeek) && activeWindow === null && !showStartMenu} onClick={handleEasterEggClick} />

      {/* Now Playing Component */}
      <NowPlaying />

      {/* Taskbar - z-50 */}
      <Taskbar
        onStartClick={handleStartMenuToggle}
        onWindowClick={openWindow}
        onTaskClick={(name) => (activeWindow === name ? minimizeWindow(name) : openWindow(name))}
        openWindows={openWindows}
        minimizedWindows={minimizedWindows}
        minimizedNotice={windowNotice?.name}
        activeWindow={activeWindow}
      />

      {showStartMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9000, backgroundColor: "transparent" }}
            onClick={() => setShowStartMenu(false)}
          />
          <StartMenu isOpen={showStartMenu} onClose={() => setShowStartMenu(false)} onOpenWindow={openWindow} onShowWelcome={showWelcome} />
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
            minimized={Boolean(minimizedWindows[windowName]) || !openWindows[windowName]}
            windowId={windowName}
            layer={100 + orderIndex * 2}
            onActivate={() => bringToFront(windowName)}
            onMinimize={() => minimizeWindow(windowName)}
          >
            {renderWindow(windowName)}
          </WindowActivityProvider>
        )
      })}
    </div>
  )
}
