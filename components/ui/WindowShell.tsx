"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

interface WindowShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  id?: string
}

export default function WindowShell({ title, onClose, children, className = "", id }: WindowShellProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: "0",
          zIndex: 100,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] flex flex-col p-2 pointer-events-none"
        style={{
          // Backup inline styles for production
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          padding: "0.5rem",
        }}
      >
        <div
          className="bg-white text-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] min-w-[300px] min-h-[200px] flex flex-col pointer-events-auto mx-auto"
          style={{
            // Backup inline styles for production
            backgroundColor: "#ffffff",
            color: "#111827",
            margin: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Blue Title Bar */}
          <div
            style={{
              background: "linear-gradient(to right, #2563eb, #1d4ed8)",
              color: "white",
              padding: "0.5rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTopLeftRadius: "0.5rem",
              borderTopRightRadius: "0.5rem",
            }}
          >
            <h2
              style={{
                fontWeight: "bold",
                fontSize: "0.875rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: "0.5rem",
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: "0.25rem",
                borderRadius: "0.25rem",
                transition: "background-color 0.2s",
                flexShrink: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "white",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e3a8a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              aria-label="Close window"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.5rem",
              backgroundColor: "#ffffff",
              color: "#111827",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
