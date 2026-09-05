"use client"

import { useState, useEffect } from "react"
import { Disc, Gamepad2, User } from "lucide-react"

interface TaskbarProps {
  onStartClick: () => void
  onWindowClick: (windowName: string) => void
  openWindows: Record<string, boolean>
  /** Stateful apps that remain restorable after their visible window is hidden. */
  persistentWindows?: Record<string, boolean>
  /** Open apps whose content is hidden without closing their session. */
  minimizedWindows?: Record<string, boolean>
  /** Current top window, used to distinguish active and background task buttons. */
  activeWindow?: string | null
}

const WINDOW_TITLES: Record<string, string> = {
  about: "ABOUT",
  games: "GAMES",
  crates: "CRATES",
  blogroll: "BLOGROLL",
  notes: "NOTES",
  ipod: "iPod",
  projects: "PROJECTS",
  world: "RAFFI WORLD",
  startup: "RAF OS TERMINAL",
  counter: "BY THE NUMBERS",
}

export default function Taskbar({
  onStartClick,
  onWindowClick,
  openWindows,
  persistentWindows = {},
  minimizedWindows = {},
  activeWindow = null,
}: TaskbarProps) {
  const [currentTime, setCurrentTime] = useState("12:00 AM")

  const taskbarWindowNames = Array.from(
    new Set([...Object.keys(openWindows), ...Object.keys(persistentWindows)]),
  ).filter((name) => openWindows[name] || persistentWindows[name])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      )
      // Self-correcting: schedule the next tick for the top of the next minute
      // instead of polling every second.
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
      timeoutId = setTimeout(updateTime, msUntilNextMinute)
    }

    updateTime()
    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <div
      className="shadow-md select-none"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        height: "calc(40px + env(safe-area-inset-bottom, 0px))",
        zIndex: 9999,
        backgroundColor: "#245DDA",
        borderTop: "2px solid #3E80F1",
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "max(4px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(4px, env(safe-area-inset-right, 0px))",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <button
          type="button"
          onClick={onStartClick}
          className="rounded-r-lg rounded-tl-lg rounded-bl-lg transition-all active:translate-y-px hover:brightness-110"
          aria-label="Start menu"
          style={{
            background: "linear-gradient(to bottom, #3E9C4D 0%, #236F30 100%)",
            boxShadow: "inset 1px 1px 0px rgba(255,255,255,0.4), 2px 2px 3px rgba(0,0,0,0.3)",
            border: "none",
            color: "white",
            paddingRight: "8px",
            paddingLeft: "6px",
            height: "32px",
            minWidth: "76px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
          }}
        >
          <div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 88 88"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}
            >
              <path
                d="M0 12.402L35.454 7.613V41.89H0V12.402ZM46.567 5.99L88 0V41.804H46.567V5.99ZM0 49.938H35.454V84.134L0 79.433V49.938ZM46.567 49.938H88V88L46.567 82.093V49.938Z"
                fill="white"
              />
            </svg>
          </div>
          <span
            style={{
              textShadow: "0 1px 1px rgba(0,0,0,0.4)",
              fontStyle: "italic",
              fontWeight: "bold",
              fontSize: "17px",
              lineHeight: "1",
              display: "inline-block",
            }}
          >
            Start
          </span>
        </button>

        <div
          className="hidden min-[520px]:block shadow-[1px_0px_0px_rgba(255,255,255,0.2)]"
          style={{
            width: "2px",
            height: "28px",
            backgroundColor: "#1846A0",
            marginLeft: "8px",
            marginRight: "8px",
            flexShrink: 0,
          }}
        ></div>

        {/* Quick Launch section with pinned apps (Crates, Games, About) */}
        <div
          className="shadow-[1px_0px_0px_rgba(255,255,255,0.2)]"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginRight: "4px",
            paddingRight: "4px",
            borderRight: "1px solid #1846A0",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => onWindowClick("crates")}
            className="hover:bg-[#3E80F1] rounded transition-colors"
            style={{
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
            }}
            title="Digging in the Crates"
            aria-label="Digging in the Crates"
          >
            <Disc size={20} className="text-white drop-shadow-md" />
          </button>
          <button
            type="button"
            onClick={() => onWindowClick("games")}
            className="hidden min-[520px]:flex hover:bg-[#3E80F1] rounded transition-colors"
            style={{
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
            }}
            title="Games"
            aria-label="Games"
          >
            <Gamepad2 size={20} className="text-white drop-shadow-md" />
          </button>
          <button
            type="button"
            onClick={() => onWindowClick("about")}
            className="hidden min-[520px]:flex hover:bg-[#3E80F1] rounded transition-colors"
            style={{
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
            }}
            title="About"
            aria-label="About"
          >
            <User size={20} className="text-white drop-shadow-md" />
          </button>
        </div>

        {taskbarWindowNames.length > 0 && (
          <div
            className="flex"
            style={{
              gap: "4px",
              overflowX: "auto",
              marginRight: "8px",
              flex: "1 1 auto",
              minWidth: 0,
            }}
          >
            {taskbarWindowNames.map((name) => {
              const minimized =
                Boolean(minimizedWindows[name]) || (!openWindows[name] && Boolean(persistentWindows[name]))
              const active = !minimized && activeWindow === name
              const title = WINDOW_TITLES[name] || name.toUpperCase()
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onWindowClick(name)}
                  className="hover:bg-[#2860D6] shadow-[inset_1px_1px_0px_rgba(255,255,255,0.2)] transition-colors"
                  title={minimized ? `Restore ${title}` : active ? `${title} (active)` : `Switch to ${title}`}
                  aria-label={minimized ? `Restore ${title} window` : `Switch to ${title} window`}
                  aria-pressed={active}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: minimized ? "#173D8F" : active ? "#153885" : "#1F50B8",
                    color: "white",
                    fontSize: "12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    minWidth: "clamp(72px, 22vw, 100px)",
                    maxWidth: "160px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    border: "none",
                    borderBottom: active ? "2px solid #8AB4FF" : "2px solid #153885",
                    display: "flex",
                    alignItems: "center",
                    textAlign: "left",
                    opacity: minimized ? 0.78 : 1,
                  }}
                >
                  {title}
                  {minimized ? " — MINIMIZED" : ""}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Time display */}
      <div
        className="shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] font-sans"
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "#0F9DDE",
          padding: "4px 6px",
          borderRadius: "4px",
          border: "1px solid #0B76A8",
          color: "white",
          fontSize: "12px",
          flexShrink: 0,
          marginLeft: "4px",
          whiteSpace: "nowrap",
          minWidth: "68px",
          justifyContent: "center",
        }}
        suppressHydrationWarning
      >
        <span className="mr-1 hidden min-[380px]:inline" aria-hidden="true">
          🔈
        </span>
        <span style={{ minWidth: "56px", textAlign: "center" }}>{currentTime}</span>
      </div>
    </div>
  )
}
