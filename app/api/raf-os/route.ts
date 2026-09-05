import { NextResponse } from "next/server"
import { RAF_PROMPT, RAF_RUBRIC, type RunResult } from "@/lib/raf-os"
import {
  auditRun,
  buildModelRequest,
  dailyBudget,
  DEFAULT_RAF_MODEL,
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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

function availability() {
  return (
    process.env.RAF_OS_ENABLED !== "false" &&
    Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.DATABASE_URL?.trim())
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
  try {
    dailyBudget()
  } catch {
    available = false
  }
  const response = NextResponse.json(
    {
      available,
      message: available
        ? "Ready to review your pitch."
        : "RAF OS analysis is temporarily unavailable. You can still open the GPT.",
    },
    { headers },
  )
  if (available) attachSession(response, readSession(request.headers.get("cookie"), process.env.OPENAI_API_KEY!.trim()))
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
  const apiKey = process.env.OPENAI_API_KEY!.trim()
  const databaseUrl = process.env.DATABASE_URL!.trim()
  const session = readSession(request.headers.get("cookie"), apiKey)
  const controller = new AbortController()
  const abort = () => controller.abort()
  request.signal.addEventListener("abort", abort, { once: true })
  if (request.signal.aborted) abort()
  const timer = setTimeout(abort, RAF_LIMITS.timeoutMs)
  let reservation: string | null = null
  try {
    const cap = dailyBudget()
    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_RAF_MODEL
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(model)) throw new RafHttpError("RAF OS is temporarily unavailable.", 503)
    const body = parseRunRequest(await readBoundedJson(request, controller.signal))
    const prepared = []
    if (body.previous) prepared.push(await prepareSubmission(body.previous, "v1"))
    prepared.push(await prepareSubmission(body.current, body.previous ? "v2" : "v1"))
    if (controller.signal.aborted) throw new RafHttpError("The review timed out. Please try a shorter submission.", 504)
    const sources = prepared.flatMap((item) => item.sources)
    reservation = await reserveUsage(databaseUrl, usageIdentity(request, session.id, apiKey), cap, controller.signal)
    if (controller.signal.aborted) throw new RafHttpError("The review timed out. Please try again.", 504)
    const modelRequest = buildModelRequest(body, prepared, model)
    const reviewed = await requestModel(modelRequest, apiKey, sources, Boolean(body.previous), controller.signal)
    const result: RunResult = {
      ...reviewed,
      sources,
      rubric: RAF_RUBRIC,
      prompt: RAF_PROMPT,
      createdAt: new Date().toISOString(),
      audit: auditRun(body, reviewed.result, sources, modelRequest),
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
