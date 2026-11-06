"use client"

import { useEffect, useRef } from "react"
import { Trophy } from "lucide-react"
import { usePersonalBest, type BestOrder } from "@/lib/personal-bests"

interface PersonalBestLineProps {
  /** Storage id, e.g. "overtime" or "dockyard-mission-2". */
  id: string
  /** This run's result. Mount the line only once the run has ended. */
  value: number
  order?: BestOrder
  format?: (value: number) => string
  color?: string
}

/** Records the finished run on this device once, then shows the best result. */
export default function PersonalBestLine({
  id,
  value,
  order = "high",
  format = (score) => `${score.toLocaleString("en-US")} pts`,
  color = "currentColor",
}: PersonalBestLineProps) {
  const { best, isNew, submit } = usePersonalBest(id, order)
  const recorded = useRef(false)

  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    submit(value)
  }, [submit, value])

  if (!isNew && best === null) return null
  return (
    <p
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        margin: "10px 0 0",
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.4,
        color,
      }}
    >
      <Trophy size={16} aria-hidden="true" />
      {isNew ? `New personal best: ${format(value)}` : `Your best: ${format(best ?? 0)}`}
    </p>
  )
}
