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
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          width: "90vw",
          maxWidth: "1024px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            color: "#111827",
            borderRadius: "0.5rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            maxHeight: "90vh",
          }}
        >
          {/* Blue Title Bar */}
          <div
            style={{
              background: "linear-gradient(to right, #2563eb, #1d4ed8)",
              color: "white",
              padding: "0.75rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTopLeftRadius: "0.5rem",
              borderTopRightRadius: "0.5rem",
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontWeight: "bold",
                fontSize: "1rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: "0.5rem",
                margin: 0,
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: "0.5rem",
                borderRadius: "0.25rem",
                transition: "background-color 0.2s",
                flexShrink: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 102,
                minWidth: "32px",
                minHeight: "32px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
              aria-label="Close window"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              overflowX: "hidden",
              padding: "1.5rem",
              backgroundColor: "#ffffff",
              color: "#111827",
              minHeight: 0,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
