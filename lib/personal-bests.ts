import { useCallback, useEffect, useState } from "react"
import { readGameStorage, writeGameStorage } from "./game-utils"

/** "high" keeps the largest value (points); "low" keeps the smallest (times). */
export type BestOrder = "high" | "low"

const PREFIX = "raffi-best:"

export function readBest(id: string): number | null {
  const value = Number(readGameStorage(PREFIX + id))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function isBetter(value: number, best: number | null, order: BestOrder): boolean {
  if (!Number.isFinite(value) || value <= 0) return false
  if (best === null) return true
  return order === "high" ? value > best : value < best
}

/** Stores the value when it beats the saved best. Returns the resulting best and whether it is new. */
export function submitBest(id: string, value: number, order: BestOrder): { best: number | null; isNew: boolean } {
  const previous = readBest(id)
  if (!isBetter(value, previous, order)) return { best: previous, isNew: false }
  const rounded = Math.round(value)
  writeGameStorage(PREFIX + id, String(rounded))
  return { best: rounded, isNew: true }
}

export function usePersonalBest(id: string, order: BestOrder) {
  const [best, setBest] = useState<number | null>(null)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    setBest(readBest(id))
    setIsNew(false)
  }, [id])

  const submit = useCallback(
    (value: number) => {
      const result = submitBest(id, value, order)
      setBest(result.best)
      setIsNew(result.isNew)
      return result.isNew
    },
    [id, order],
  )

  const clearNew = useCallback(() => setIsNew(false), [])

  return { best, isNew, submit, clearNew }
}
