import { join } from "node:path"
import { Worker } from "node:worker_threads"

const unreadable = () => new Error("PDF validation failed.")

/** Validate in disposable memory without allowing parser diagnostics into server logs. */
export async function pdfPageCount(bytes: Uint8Array, signal?: AbortSignal): Promise<number> {
  if (signal?.aborted) throw unreadable()
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(process.cwd(), "lib/raf-os-pdf-worker.cjs"), {
      workerData: bytes,
      stdout: true,
      stderr: true,
      env: {},
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    })
    let settled = false
    const finish = (pageCount: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
      void worker.terminate().then(
        () => (pageCount === null ? reject(unreadable()) : resolve(pageCount)),
        () => reject(unreadable()),
      )
    }
    const abort = () => finish(null)
    const timer = setTimeout(abort, 5000)
    // Drain without storing or forwarding data. Other requests retain their
    // ordinary logging; no global console or dependency prototype is modified.
    worker.stdout.resume()
    worker.stderr.resume()
    worker.once("message", (value: unknown) =>
      finish(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null),
    )
    worker.once("error", () => finish(null))
    worker.once("exit", () => finish(null))
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) abort()
  })
}
