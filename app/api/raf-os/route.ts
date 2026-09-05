import { NextResponse } from "next/server"
import { RAF_PROMPT, RAF_RUBRIC, type RunResult } from "@/lib/raf-os"
import {
  auditRun,
  buildModelRequest,
  dailyBudget,
  isSameOrigin,
  parseRunRequest,
  prepareSubmission,
  RAF_LIMITS,
  RafHttpError,
  readBoundedJson,
  readSession,
  releaseUsage,
  requestModel,
  reserveUsage,
  usageIdentity,
} from "@/lib/raf-os-server"

import { buildGeminiRequest, requestGemini } from "@/lib/raf-os-gemini"
import { configuredProviders, routingPlan, runRoutedReview } from "@/lib/raf-os-routing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

function availability() {
  return process.env.RAF_OS_ENABLED !== "false" && Boolean(process.env.DATABASE_URL?.trim()) && Boolean(sessionSecret())
}

function sessionSecret() {
  return (
    process.env.RAF_OS_SESSION_SECRET?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    ""
  )
}

function attachSession(response: NextResponse, session: ReturnType<typeof readSession>) {
  response.cookies.set(session.name, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  })
  return response
}

export async function GET(request: Request) {
  let available = availability()
  let providers: ReturnType<typeof configuredProviders> = []
  try {
    dailyBudget()
    providers = configuredProviders()
    available = available && providers.length > 0
  } catch {
    available = false
  }
  const response = NextResponse.json(
    {
      available,
      providers: providers.map((item) => item.provider),
      defaultProvider: providers[0]?.provider ?? null,
      message: available
        ? "Ready to review your pitch."
        : "RAF OS analysis is temporarily unavailable. You can still open the GPT.",
    },
    { headers },
  )
  if (available) attachSession(response, readSession(request.headers.get("cookie"), sessionSecret()))
  return response
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Open RAF OS on this site to submit your pitch." }, { status: 403, headers })
  if (!availability())
    return NextResponse.json(
      { error: "RAF OS analysis is temporarily unavailable. Please try again later." },
      { status: 503, headers },
    )
  const secret = sessionSecret()
  const databaseUrl = process.env.DATABASE_URL!.trim()
  const session = readSession(request.headers.get("cookie"), secret)
  const controller = new AbortController()
  const abort = () => controller.abort()
  request.signal.addEventListener("abort", abort, { once: true })
  if (request.signal.aborted) abort()
  const deadline = Date.now() + RAF_LIMITS.timeoutMs
  const timer = setTimeout(abort, RAF_LIMITS.timeoutMs)
  let reservation: string | null = null
  try {
    const cap = dailyBudget()
    const body = parseRunRequest(await readBoundedJson(request, controller.signal))
    const providers = configuredProviders()
    if (!providers.length) throw new RafHttpError("RAF OS analysis is temporarily unavailable.", 503)
    const plan = routingPlan(body, providers)
    const prepared: Awaited<ReturnType<typeof prepareSubmission>>[] = []
    if (body.previous) prepared.push(await prepareSubmission(body.previous, "v1"))
    prepared.push(await prepareSubmission(body.current, body.previous ? "v2" : "v1"))
    if (controller.signal.aborted) throw new RafHttpError("The review timed out. Please try a shorter submission.", 504)
    const sources = prepared.flatMap((item) => item.sources)
    reservation = await reserveUsage(databaseUrl, usageIdentity(request, session.id, secret), cap, controller.signal)
    if (controller.signal.aborted) throw new RafHttpError("The review timed out. Please try again.", 504)
    const reviewed = await runRoutedReview(
      plan,
      async (config) => {
        const sharedRequest = buildModelRequest(body, prepared, config.model)
        if (config.provider === "gemini") {
          const modelRequest = buildGeminiRequest(sharedRequest, config.model)
          return {
            ...(await requestGemini(modelRequest, config.apiKey, sources, Boolean(body.previous), controller.signal)),
            modelRequest,
          }
        }
        return {
          ...(await requestModel(sharedRequest, config.apiKey, sources, Boolean(body.previous), controller.signal)),
          modelRequest: sharedRequest,
        }
      },
      controller.signal,
      deadline,
    )
    const result: RunResult = {
      result: reviewed.result,
      model: reviewed.model,
      routing: reviewed.routing,
      sources,
      rubric: RAF_RUBRIC,
      prompt: RAF_PROMPT,
      createdAt: new Date().toISOString(),
      audit: auditRun(body, reviewed.result, sources, reviewed.modelRequest),
    }
    return attachSession(NextResponse.json(result, { headers }), session)
  } catch (error) {
    const failure = controller.signal.aborted
      ? new RafHttpError("The review was interrupted or timed out. Please try a shorter submission.", 504)
      : error instanceof RafHttpError
        ? error
        : new RafHttpError("RAF OS could not complete this review. Please try again later.", 503)
    return attachSession(
      NextResponse.json(
        { error: failure.message, ...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}) },
        {
          status: failure.status,
          headers: { ...headers, ...(failure.retryAfter ? { "Retry-After": String(failure.retryAfter) } : {}) },
        },
      ),
      session,
    )
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener("abort", abort)
    if (reservation) await releaseUsage(databaseUrl, reservation)
  }
}
