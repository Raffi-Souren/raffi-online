"use client"

import { type CSSProperties, type ReactNode, useSyncExternalStore } from "react"

const SHORT_SCREEN = "(max-height: 540px)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(SHORT_SCREEN)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

const isShortScreen = () => window.matchMedia(SHORT_SCREEN).matches

interface HowToPlayProps {
  children: ReactNode
  style?: CSSProperties
}

/** Shows the controls legend inline, but folds it behind "How to play" on short screens. */
export default function HowToPlay({ children, style }: HowToPlayProps) {
  const short = useSyncExternalStore(subscribe, isShortScreen, () => false)
  if (!short) return <div style={style}>{children}</div>
  return (
    <details className="intro-howto" style={style}>
      <summary>How to play</summary>
      {children}
    </details>
  )
}
