export const RAF_CANONICAL = "raf-json-v1"

// Sorted-key pattern adapted from AI4F and GrantDrift. This local profile is not RFC 8785 or proof of authorship.
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>()

  function serialize(current: unknown): string {
    if (current === null || typeof current === "string" || typeof current === "boolean") return JSON.stringify(current)
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new TypeError("Canonical JSON requires finite numbers.")
      return JSON.stringify(current)
    }
    if (typeof current !== "object")
      throw new TypeError("Canonical JSON rejects undefined and unsupported value types.")
    if (ancestors.has(current)) throw new TypeError("Canonical JSON rejects cycles.")

    const array = Array.isArray(current)
    const prototype = Object.getPrototypeOf(current)
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON requires plain objects and arrays.")
    }
    const keys = Reflect.ownKeys(current)
    if (keys.some((key) => typeof key !== "string")) throw new TypeError("Canonical JSON rejects symbol keys.")
    ancestors.add(current)
    try {
      const propertyValue = (key: string): unknown => {
        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (!descriptor) throw new TypeError("Canonical JSON rejects array holes.")
        if (!("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError("Canonical JSON rejects accessors and hidden properties.")
        }
        return descriptor.value
      }
      if (array) {
        if (keys.length !== current.length + 1)
          throw new TypeError("Canonical JSON rejects array holes and extra properties.")
        const values: string[] = []
        for (let index = 0; index < current.length; index++) values.push(serialize(propertyValue(String(index))))
        return "[" + values.join(",") + "]"
      }
      return (
        "{" +
        (keys as string[])
          .sort()
          .map((key) => JSON.stringify(key) + ":" + serialize(propertyValue(key)))
          .join(",") +
        "}"
      )
    } finally {
      ancestors.delete(current)
    }
  }

  return serialize(value)
}
