"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

const MotionContext = createContext<{
  reducedMotion: boolean
}>({ reducedMotion: true })

export function MotionProvider({ children }: { children: ReactNode }) {
  // Keep movement off until the visitor’s preference has been read.
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(preference.matches)
    sync()
    preference.addEventListener("change", sync)
    return () => preference.removeEventListener("change", sync)
  }, [])
  return <MotionContext.Provider value={{ reducedMotion }}>{children}</MotionContext.Provider>
}

export function useMotionPreference() {
  return useContext(MotionContext)
}
