import type { Critique, RunRequest } from "./raf-os"
import { DEFAULT_GEMINI_MODEL } from "./raf-os-gemini"
import { DEFAULT_RAF_MODEL, RafHttpError } from "./raf-os-server"

export const RAF_ROUTING_POLICY = "provider-routing-v1"
type Provider = "openai" | "gemini"
type Environment = Partial<Record<string, string | undefined>>
export type ProviderConfig = { provider: Provider; model: string; apiKey: string }

/** Server configuration is the only source of provider endpoints, credentials, and models. */
export function configuredProviders(env: Environment = process.env): ProviderConfig[] {
  const providers: ProviderConfig[] = []
  if (env.GEMINI_API_KEY?.trim())
    providers.push({
      provider: "gemini",
      model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      apiKey: env.GEMINI_API_KEY.trim(),
    })
  if (env.OPENAI_API_KEY?.trim())
    providers.push({
      provider: "openai",
      model: env.OPENAI_MODEL?.trim() || DEFAULT_RAF_MODEL,
      apiKey: env.OPENAI_API_KEY.trim(),
    })
  if (providers.some((item) => !/^[A-Za-z0-9._:-]{1,100}$/.test(item.model)))
    throw new RafHttpError("The model configuration is unavailable.", 503)
  return providers
}

export function routingPlan(request: RunRequest, providers: ProviderConfig[]) {
  const chosen = request.provider ?? "auto"
  const permitted = providers.filter((item) => item.provider !== "gemini" || request.allowGoogle === true)
  if (chosen !== "auto") {
    if (chosen === "gemini" && request.allowGoogle !== true)
      throw new RafHttpError("Refresh RAF OS and accept the updated provider notice before using Gemini.", 400)
    const selected = permitted.find((item) => item.provider === chosen)
    if (!selected) throw new RafHttpError("That provider is unavailable. Select Auto or another provider.", 503)
    return { candidates: [selected], reason: "visitor_selected" }
  }
  if (!permitted.length)
    throw new RafHttpError("Refresh RAF OS and accept the updated provider notice before submitting.", 400)
  return {
    candidates: permitted,
    reason: providers[0]?.provider !== permitted[0].provider ? "consent_scope" : "configured_primary",
  }
}

function temporaryProviderFailure(error: unknown) {
  if (!(error instanceof RafHttpError)) return false
  const diagnostic = error.diagnostic
  return Boolean(
    diagnostic &&
      (diagnostic.providerStatus === 429 ||
        (diagnostic.providerStatus >= 500 && diagnostic.providerStatus <= 599) ||
        (diagnostic.providerStatus === 0 && diagnostic.providerCode === "NETWORK_ERROR")),
  )
}

/** A whole comparison stays in one request. Never fall back after a refusal or invalid review. */
export async function runRoutedReview(
  plan: ReturnType<typeof routingPlan>,
  invoke: (config: ProviderConfig) => Promise<{ result: Critique; model: string; modelRequest: unknown }>,
  signal: AbortSignal,
  deadline: number,
  now = Date.now,
) {
  for (let index = 0; index < plan.candidates.length; index++) {
    if (signal.aborted) throw new RafHttpError("The review was interrupted. Please try again when ready.", 408)
    const candidate = plan.candidates[index]
    try {
      const review = await invoke(candidate)
      if (signal.aborted) throw new RafHttpError("The review was interrupted. Please try again when ready.", 408)
      return {
        ...review,
        routing: {
          provider: candidate.provider,
          reason: index ? "temporary_provider_failure" : plan.reason,
          policy: RAF_ROUTING_POLICY,
        },
      }
    } catch (error) {
      if (
        signal.aborted ||
        index + 1 >= plan.candidates.length ||
        deadline - now() < 15_000 ||
        !temporaryProviderFailure(error)
      )
        throw error
    }
  }
  throw new RafHttpError("No model provider is configured.", 503)
}
