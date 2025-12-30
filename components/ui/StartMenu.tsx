"use client"

import { X } from "lucide-react"

interface StartMenuProps {
  isOpen: boolean
  onClose: () => void
  onOpenWindow: (windowName: string) => void
}

export default function StartMenu({ isOpen, onClose, onOpenWindow }: StartMenuProps) {
  if (!isOpen) return null

  const handlePitchStartup = () => {
    window.open("https://chatgpt.com/g/g-68a497212bfc81918b450e9ca7ee67ba-raf-os-terminal", "_blank")
    onClose()
  }

  const menuItems = [
    { icon: "👤", label: "About", action: () => onOpenWindow("about") },
    { icon: "🌐", label: "Blogroll", action: () => onOpenWindow("blogroll") },
    { icon: "🎮", label: "Games", action: () => onOpenWindow("games") },
    { icon: "🎧", label: "iPod", action: () => onOpenWindow("ipod") },
    { icon: "🛠️", label: "Projects", action: () => onOpenWindow("projects") },
    { icon: "📝", label: "Notes", action: () => onOpenWindow("notes") },
    { icon: "💡", label: "Pitch Startup", action: handlePitchStartup },
  ]

  return (
    <div
      style={{
        position: "fixed",
        bottom: "3rem",
        left: "0.5rem",
        zIndex: 91,
      }}
    >
      <div
        style={{
          background: "linear-gradient(to bottom, #3b82f6, #1d4ed8)",
          border: "2px solid #60a5fa",
          borderTopLeftRadius: "0.5rem",
          borderTopRightRadius: "0.5rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          width: "16rem",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(to right, #2563eb, #1e40af)",
            padding: "0.5rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTopLeftRadius: "0.375rem",
            borderTopRightRadius: "0.375rem",
          }}
        >
          <span
            style={{
              color: "white",
              fontWeight: "bold",
              fontSize: "0.875rem",
            }}
          >
            Start Menu
          </span>
          <button
            onClick={onClose}
            style={{
              color: "white",
              borderRadius: "0.25rem",
              padding: "0.25rem",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Menu Items */}
        <div style={{ padding: "0.5rem" }}>
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.5rem 0.75rem",
                color: "white",
                borderRadius: "0.25rem",
                transition: "background-color 0.2s",
                textAlign: "left",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <span style={{ fontSize: "1.125rem" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: "#1e40af",
            padding: "0.5rem 1rem",
            borderBottomLeftRadius: "0.375rem",
            borderBottomRightRadius: "0.375rem",
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: "0.75rem",
              textAlign: "center",
            }}
          >
            v303
          </div>
        </div>
      </div>
    </div>
  )
}
