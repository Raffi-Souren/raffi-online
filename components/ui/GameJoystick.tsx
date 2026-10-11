"use client"

import { useEffect, useRef, useState } from "react"
import { Move } from "lucide-react"

export type StickPosition = { x: number; y: number }

interface GameJoystickProps {
  onChange: (position: StickPosition) => void
  label?: string
  axis?: "both" | "horizontal" | "vertical"
  disabled?: boolean
  size?: number
  fourWay?: boolean
  resetKey?: string | number
}

/** One finger owns the stick; other fingers remain free for action buttons. */
export default function GameJoystick({ onChange, label = "Movement stick", axis = "both", disabled = false, size = 112, fourWay = false, resetKey }: GameJoystickProps) {
  const callback = useRef(onChange)
  callback.current = onChange
  const pointer = useRef<number | null>(null)
  const keys = useRef(new Set<string>())
  const [position, setPosition] = useState<StickPosition>({ x: 0, y: 0 })

  const emit = (x: number, y: number) => {
    if (axis === "horizontal") y = 0
    if (axis === "vertical") x = 0
    const distance = Math.hypot(x, y)
    if (distance < 0.16) { x = 0; y = 0 }
    else {
      const strength = Math.min(1, (distance - 0.16) / 0.84)
      x = x / distance * strength
      y = y / distance * strength
      if (fourWay) {
        if (Math.abs(x) > Math.abs(y)) { x = Math.sign(x); y = 0 }
        else { x = 0; y = Math.sign(y) }
      }
    }
    const next = { x, y }
    setPosition(next)
    callback.current(next)
  }

  const reset = () => {
    pointer.current = null
    keys.current.clear()
    setPosition({ x: 0, y: 0 })
    callback.current({ x: 0, y: 0 })
  }

  useEffect(() => {
    const heldKeys = keys.current
    reset()
    const hidden = () => { if (document.hidden) reset() }
    window.addEventListener("blur", reset)
    window.addEventListener("resize", reset)
    document.addEventListener("visibilitychange", hidden)
    return () => {
      window.removeEventListener("blur", reset)
      window.removeEventListener("resize", reset)
      document.removeEventListener("visibilitychange", hidden)
      pointer.current = null
      heldKeys.clear()
      callback.current({ x: 0, y: 0 })
    }
    // The callback ref keeps input current without releasing a held stick on renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, resetKey, axis, fourWay])

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const radius = Math.min(box.width, box.height) * 0.34
    emit((event.clientX - box.left - box.width / 2) / radius, (event.clientY - box.top - box.height / 2) / radius)
  }
  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return
    reset()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const keyboard = (event: React.KeyboardEvent<HTMLDivElement>, down: boolean) => {
    if (!event.key.startsWith("Arrow")) return
    event.preventDefault()
    event.stopPropagation()
    if (disabled) return
    if (down) keys.current.add(event.key)
    else keys.current.delete(event.key)
    emit(Number(keys.current.has("ArrowRight")) - Number(keys.current.has("ArrowLeft")), Number(keys.current.has("ArrowDown")) - Number(keys.current.has("ArrowUp")))
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-roledescription="thumbstick"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      title={`${label}: drag to move, release to stop. Arrow keys also work.`}
      data-game-joystick=""
      className="game-touch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (disabled || pointer.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return
        event.preventDefault()
        pointer.current = event.pointerId
        try { event.currentTarget.setPointerCapture(event.pointerId) } catch { reset(); return }
        move(event)
      }}
      onPointerMove={(event) => { if (!disabled && pointer.current === event.pointerId) move(event) }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(event) => keyboard(event, true)}
      onKeyUp={(event) => keyboard(event, false)}
      onBlur={reset}
      style={{ width: size, height: size, flexShrink: 0, position: "relative", borderRadius: "50%", border: "2px solid #788b9a", background: "radial-gradient(circle, #213142, #121c29)", boxShadow: "inset 0 3px 8px #0009, 0 2px 0 #fff3", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", opacity: disabled ? 0.45 : 1, cursor: disabled ? "default" : "grab" }}
    >
      <Move size={size * 0.72} aria-hidden="true" style={{ position: "absolute", left: "14%", top: "14%", color: "#93a7b655", pointerEvents: "none" }} />
      <span aria-hidden="true" style={{ position: "absolute", left: "28%", top: "28%", width: "44%", height: "44%", borderRadius: "50%", border: "2px solid #b3c4d3", background: "radial-gradient(circle at 35% 25%, #8798ac, #43566c)", boxShadow: "0 3px 6px #0008", transform: `translate(${position.x * size * 0.27}px, ${position.y * size * 0.27}px)`, pointerEvents: "none" }} />
    </div>
  )
}
