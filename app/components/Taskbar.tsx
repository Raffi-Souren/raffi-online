"use client"

import { useState, useEffect } from "react"
import { Disc, Gamepad2, User } from "lucide-react"

interface TaskbarProps {
  onStartClick: () => void
  onWindowClick: (windowName: string) => void
  openWindows: Record<string, boolean>
}

export default function Taskbar({ onStartClick, onWindowClick, openWindows }: TaskbarProps) {
  const [currentTime, setCurrentTime] = useState("12:00 AM")

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

    // Initial update
    updateTime()

    // Sync with seconds to update exactly on the minute change if possible, otherwise just every second
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-10 z-[9999] bg-[#245DDA] border-t-2 border-[#3E80F1] flex items-center px-2 shadow-md select-none w-full"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        height: "40px",
        zIndex: 9999,
        backgroundColor: "#245DDA",
        borderTop: "2px solid #3E80F1",
        display: "flex",
        alignItems: "center",
        paddingLeft: "8px",
        paddingRight: "8px",
        justifyContent: "flex-start", // Keep items on left
      }}
    >
      <button
        onClick={onStartClick}
        className="flex items-center gap-2 px-2 py-1 rounded-r-lg rounded-tl-lg rounded-bl-lg transition-all active:translate-y-px hover:brightness-110"
        style={{
          background: "linear-gradient(to bottom, #3E9C4D 0%, #236F30 100%)",
          boxShadow: "inset 1px 1px 0px rgba(255,255,255,0.4), 2px 2px 3px rgba(0,0,0,0.3)",
          border: "none",
          color: "white",
          paddingRight: "10px",
          paddingLeft: "6px",
          height: "32px",
          minWidth: "80px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
        }}
      >
        <div className="italic font-bold text-lg not-italic drop-shadow-sm">
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
          className="text-lg italic font-bold"
          style={{
            textShadow: "0 1px 1px rgba(0,0,0,0.4)",
            fontStyle: "italic",
            fontWeight: "bold",
            fontSize: "18px",
            lineHeight: "1",
            display: "inline-block",
          }}
        >
          Start
        </span>
      </button>

      <div
        className="w-[2px] h-[28px] bg-[#1846A0] mx-2 shadow-[1px_0px_0px_rgba(255,255,255,0.2)]"
        style={{ width: "2px", height: "28px", backgroundColor: "#1846A0", margin: "0 8px", flexShrink: 0 }}
      ></div>

      {/* Quick Launch section with pinned apps (Crates, Games, About) */}
      <div
        className="flex items-center gap-1 mr-2 px-2 border-r border-[#1846A0] shadow-[1px_0px_0px_rgba(255,255,255,0.2)]"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px", // Increased gap to spread icons more
          marginRight: "8px",
          paddingRight: "8px",
          borderRight: "1px solid #1846A0",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => onWindowClick("crates")}
          className="p-1 hover:bg-[#3E80F1] rounded group relative transition-colors bg-transparent border-none"
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
        >
          <Disc size={20} className="text-white drop-shadow-md" />
        </button>
        <button
          onClick={() => onWindowClick("games")}
          className="p-1 hover:bg-[#3E80F1] rounded group relative transition-colors bg-transparent border-none"
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
          title="Games"
        >
          <Gamepad2 size={20} className="text-white drop-shadow-md" />
        </button>
        <button
          onClick={() => onWindowClick("about")}
          className="p-1 hover:bg-[#3E80F1] rounded group relative transition-colors bg-transparent border-none"
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
          title="About"
        >
          <User size={20} className="text-white drop-shadow-md" />
        </button>
      </div>

      {Object.entries(openWindows).some(([, isOpen]) => isOpen) && (
        <div
          className="flex gap-1 overflow-x-auto mr-2"
          style={{
            display: "flex",
            gap: "4px",
            overflowX: "auto",
            marginRight: "8px",
            flexGrow: 1,
            justifyContent: "flex-start",
          }}
        >
          {Object.entries(openWindows)
            .filter(([, isOpen]) => isOpen)
            .map(([name]) => (
              <div
                key={name}
                className="px-4 py-1 bg-[#1F50B8] hover:bg-[#2860D6] text-white text-xs rounded shadow-[inset_1px_1px_0px_rgba(255,255,255,0.2)] cursor-pointer transition-colors min-w-[100px] truncate border-b-2 border-[#153885]"
                style={{
                  padding: "4px 16px",
                  backgroundColor: "#1F50B8",
                  color: "white",
                  fontSize: "12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  minWidth: "100px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  borderBottom: "2px solid #153885",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {name.toUpperCase()}
              </div>
            ))}
        </div>
      )}

      {/* Added explicit marginLeft: auto to force time to the right */}
      <div
        className={`ml-auto flex items-center bg-[#0F9DDE] px-3 py-1 rounded border border-[#0B76A8] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] text-white text-xs font-sans`}
        style={{
          marginLeft: "auto", // This pushes the element to the far right
          display: "flex",
          alignItems: "center",
          backgroundColor: "#0F9DDE",
          padding: "4px 12px",
          borderRadius: "4px",
          border: "1px solid #0B76A8",
          color: "white",
          fontSize: "12px",
          flexShrink: 0,
        }}
        suppressHydrationWarning
      >
        <span className="mr-2">🔈</span>
        {currentTime}
      </div>
    </div>
  )
}
