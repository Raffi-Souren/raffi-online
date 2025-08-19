"use client"

import { useCallback, useEffect, useRef } from "react"

export function useBodyScrollLock() {
  const scrollPosition = useRef(0)

  const lockScroll = useCallback(() => {
    scrollPosition.current = window.pageYOffset
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollPosition.current}px`
    document.body.style.width = "100%"
  }, [])

  const unlockScroll = useCallback(() => {
    document.body.style.removeProperty("overflow")
    document.body.style.removeProperty("position")
    document.body.style.removeProperty("top")
    document.body.style.removeProperty("width")
    window.scrollTo(0, scrollPosition.current)
  }, [])

  useEffect(() => {
    return () => {
      unlockScroll()
    }
  }, [unlockScroll])

  return { lockScroll, unlockScroll }
}
