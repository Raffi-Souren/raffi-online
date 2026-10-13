"use client"

import { useSyncExternalStore } from "react"

/**
 * Phones, tablets and narrow windows, where keyboard play is not an option.
 * Signal Lost made this call first; every game decides the same way.
 */
export const TOUCH_CONTROLS_QUERY = "(pointer: coarse), (hover: none), (max-width: 700px)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(TOUCH_CONTROLS_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** True when on-screen sticks and buttons should show instead of keyboard hints. */
export function useTouchControls() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(TOUCH_CONTROLS_QUERY).matches,
    () => false,
  )
}
