import { z } from "zod/v3"
import { validateCritique, type Source } from "./raf-os"
import { RAF_LIMITS, RafHttpError, type buildModelRequest } from "./raf-os-server"

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash"
const pdfPrefix = "data:application/pdf;base64,"
const modelName = /^gemini-[a-z0-9][a-z0-9.-]{0,90}$/i

/** The model selects the URL; body is the exact JSON payload committed by the run audit. */
export function buildGeminiRequest(request: ReturnType<typeof buildModelRequest>, model = DEFAULT_GEMINI_MODEL) {
  if (!modelName.test(model)) throw new RafHttpError("The model configuration is unavailable.", 503)
  return {
    model,
    body: {
      systemInstruction: { parts: [{ text: request.instructions }] },
      contents: request.input.map((message) => ({
        role: "user" as const,
        parts: message.content.map((part) => {
          if (part.type === "input_text" && "text" in part) return { text: part.text }
          if (part.type === "input_file" && "file_data" in part && part.file_data.startsWith(pdfPrefix)) {
            return { inlineData: { mimeType: "application/pdf", data: part.file_data.slice(pdfPrefix.length) } }
          }
          throw new RafHttpError("The model input could not be prepared.", 400)
        }),
      })),
      generationConfig: {
        maxOutputTokens: Math.min(request.max_output_tokens, 6500),
        thinkingConfig: { thinkingLevel: "LOW" as const, includeThoughts: false },
        responseMimeType: "application/json",
        responseJsonSchema: request.text.format.schema,
      },
    },
  }
}

const safetyRatings = z.array(z.object({ blocked: z.boolean().optional() })).optional()
const envelopeSchema = z.object({
  modelVersion: z.string().min(1).max(120).optional(),
  error: z.unknown().optional(),
  promptFeedback: z.object({ blockReason: z.string().optional(), safetyRatings }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        safetyRatings,
        content: z
          .object({
            role: z.literal("model"),
            parts: z.array(
              z
                .object({
                  text: z.string().optional(),
                  thought: z.boolean().optional(),
                  thoughtSignature: z.string().optional(),
                })
                .strict(),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
})
const blockedReasons = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
  "IMAGE_PROHIBITED_CONTENT",
  "IMAGE_RECITATION",
  "ESCALATION",
])
const refusal = () =>
  new RafHttpError("The model couldn't review this submission. Try a different pitch or remove sensitive details.", 422)
const unreadable = () => new RafHttpError("The model response could not be read. Please try again.", 502)
const interrupted = () => new RafHttpError("The review was interrupted or timed out. Please try again when ready.", 408)
const networkFailure = () =>
  new RafHttpError("The model service is temporarily unavailable. Please try again later.", 503, undefined, {
    providerStatus: 0,
    providerCode: "NETWORK_ERROR",
    providerParameter: "unknown",
  })

export function parseGeminiResponse(value: unknown, sources: Source[], comparing: boolean) {
  const parsed = envelopeSchema.safeParse(value)
  if (!parsed.success || parsed.data.error) throw unreadable()
  const { promptFeedback, candidates, modelVersion } = parsed.data
  if (
    (promptFeedback?.blockReason && promptFeedback.blockReason !== "BLOCK_REASON_UNSPECIFIED") ||
    promptFeedback?.safetyRatings?.some((rating) => rating.blocked)
  )
    throw refusal()
  if (candidates?.length !== 1) throw unreadable()
  const candidate = candidates[0]
  if (blockedReasons.has(candidate.finishReason ?? "") || candidate.safetyRatings?.some((rating) => rating.blocked)) {
    throw refusal()
  }
  if (candidate.finishReason !== "STOP") {
    throw new RafHttpError("The model did not complete the review. Try a shorter submission.", 502)
  }
  const parts = candidate.content?.parts.filter((part) => !part.thought)
  if (!modelVersion || !parts?.length || parts.some((part) => typeof part.text !== "string")) throw unreadable()
  try {
    return {
      result: validateCritique(JSON.parse(parts.map((part) => part.text).join("")), sources, comparing),
      model: modelVersion,
    }
  } catch {
    throw new RafHttpError("The review did not pass its source and evidence checks. Please try again.", 502)
  }
}

async function readProviderJson(body: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal) {
  if (!body) throw unreadable()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  const cancel = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener("abort", cancel, { once: true })
  try {
    while (true) {
      if (signal.aborted) throw interrupted()
      const { value, done } = await reader.read().catch((error: unknown) => {
        if (error instanceof TypeError) throw networkFailure()
        throw error
      })
      if (signal.aborted) throw interrupted()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        cancel()
        throw unreadable()
      }
      chunks.push(value)
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size))) as unknown
  } finally {
    signal.removeEventListener("abort", cancel)
    reader.releaseLock()
  }
}

const failureSchema = z.object({
  error: z.object({
    status: z.string().optional(),
    details: z
      .array(z.object({ fieldViolations: z.array(z.object({ field: z.string().optional() })).optional() }))
      .optional(),
  }),
})
const safeDiagnostic = (value: string | undefined) =>
  value && /^[A-Za-z0-9_.\[\]-]{1,100}$/.test(value) ? value : "unknown"

export async function requestGemini(
  request: ReturnType<typeof buildGeminiRequest>,
  apiKey: string,
  sources: Source[],
  comparing: boolean,
  signal: AbortSignal,
) {
  if (!modelName.test(request.model) || !apiKey) throw new RafHttpError("The model configuration is unavailable.", 503)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener("abort", abort, { once: true })
  if (signal.aborted) abort()
  const timer = setTimeout(abort, RAF_LIMITS.timeoutMs)
  try {
    if (controller.signal.aborted) throw interrupted()
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + request.model + ":generateContent",
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      },
    ).catch((error: unknown) => {
      if (error instanceof TypeError) throw networkFailure()
      throw error
    })
    if (!response.ok) {
      let providerCode = "unknown"
      let providerParameter = "unknown"
      try {
        const parsed = failureSchema.safeParse(await readProviderJson(response.body, 16_000, controller.signal))
        if (parsed.success) {
          providerCode = safeDiagnostic(parsed.data.error.status)
          providerParameter = safeDiagnostic(
            parsed.data.error.details?.flatMap((detail) => detail.fieldViolations ?? [])[0]?.field,
          )
        }
      } catch {
        // Provider messages and field descriptions can contain credentials or submitted text.
      }
      if (controller.signal.aborted) throw interrupted()
      if (response.status === 429)
        throw new RafHttpError("The model service is busy. Please try again shortly.", 429, 60, {
          providerStatus: 429,
          providerCode,
          providerParameter,
        })
      throw new RafHttpError("The model service is temporarily unavailable. Please try again later.", 503, undefined, {
        providerStatus: response.status,
        providerCode,
        providerParameter,
      })
    }
    const value = await readProviderJson(response.body, 256_000, controller.signal)
    return parseGeminiResponse(value, sources, comparing)
  } catch (error) {
    if (controller.signal.aborted) throw interrupted()
    if (error instanceof RafHttpError) throw error
    throw new RafHttpError("The model service could not complete the review. Please try again later.", 502)
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", abort)
  }
}
