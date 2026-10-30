"use client"

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"

const MotionContext = createContext<{
  paused: boolean
  setPaused: Dispatch<SetStateAction<boolean>>
  reducedMotion: boolean
}>({ paused: false, setPaused: () => {}, reducedMotion: true })

export function MotionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false)
  // Keep movement off until the visitor’s preference has been read.
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(preference.matches)
    sync()
    preference.addEventListener("change", sync)
    return () => preference.removeEventListener("change", sync)
  }, [])
  return <MotionContext.Provider value={{ paused, setPaused, reducedMotion }}>{children}</MotionContext.Provider>
}

export function useMotionPreference() {
  return useContext(MotionContext)
}
