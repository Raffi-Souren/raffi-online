"use client"

import type { ReactNode } from "react"
import { X } from 'lucide-react'

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
      <div 
        style={{
          position: 'fixed',
          inset: '0',
          zIndex: 100,
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        style={{
          position: 'fixed',
          inset: '0',
          zIndex: 101,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            borderRadius: '0.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            height: '100%',
            maxWidth: '56rem',
            maxHeight: '90vh',
            minWidth: '300px',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto'
          }}
          className={className}
        >
          {/* Blue Title Bar */}
          <div 
            style={{
              background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
              color: 'white',
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopLeftRadius: '0.5rem',
              borderTopRightRadius: '0.5rem'
            }}
          >
            <h2 
              style={{
                fontWeight: 'bold',
                fontSize: '0.875rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: '0.5rem'
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: '0.25rem',
                borderRadius: '0.25rem',
                transition: 'background-color 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e3a8a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Close window"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div 
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              backgroundColor: '#ffffff',
              color: '#111827'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
