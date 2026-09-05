import assert from "node:assert/strict"
import test from "node:test"
import type { RunRequest } from "./raf-os"
import { sampleRunEvidence, sampleSubmissionBefore, sampleSubmissionEvidence } from "./raf-os-fixtures"
import { DEFAULT_GEMINI_MODEL } from "./raf-os-gemini"
import {
  configuredProviders,
  RAF_ROUTING_POLICY,
  routingPlan,
  runRoutedReview,
  type ProviderConfig,
} from "./raf-os-routing"
import { DEFAULT_RAF_MODEL, RafHttpError } from "./raf-os-server"

const keys = { GEMINI_API_KEY: "fictional-google-key", OPENAI_API_KEY: "fictional-openai-key" }
const clock = () => 100_000
const signal = () => new AbortController().signal
const submission = (overrides: Partial<RunRequest> = {}): RunRequest => ({
  action: "compare",
  current: sampleSubmissionEvidence,
  previous: sampleSubmissionBefore,
  challenge: "Keep the fictional pilot's contrary observation visible.",
  provider: "auto",
  allowGoogle: true,
  ...overrides,
})
const automatic = () => routingPlan(submission(), configuredProviders(keys))
const review = (config: ProviderConfig) => ({
  result: sampleRunEvidence.result,
  model: config.provider + "-fixture-returned-version",
  modelRequest: { model: config.model, input: "Fictional comparison payload." },
})
const providerFailure = (providerStatus: number, providerCode = "UNAVAILABLE") =>
  new RafHttpError("Fictional provider failure.", providerStatus === 429 ? 429 : 503, undefined, {
    providerStatus,
    providerCode,
    providerParameter: "unknown",
  })
const statusIs = (status: number) => (error: unknown) => error instanceof RafHttpError && error.status === status

test("configured routes deterministically prefer Gemini and accept model configuration only from the server", () => {
  assert.deepEqual(
    configuredProviders({
      ...keys,
      GEMINI_API_KEY: "  " + keys.GEMINI_API_KEY + "  ",
      GEMINI_BASE_URL: "https://untrusted.example",
    }),
    [
      { provider: "gemini", model: DEFAULT_GEMINI_MODEL, apiKey: keys.GEMINI_API_KEY },
      { provider: "openai", model: DEFAULT_RAF_MODEL, apiKey: keys.OPENAI_API_KEY },
    ],
  )
  assert.equal(automatic().reason, "configured_primary")
  assert.deepEqual(
    automatic().candidates.map((candidate) => candidate.provider),
    ["gemini", "openai"],
  )
  assert.deepEqual(
    configuredProviders({ GEMINI_API_KEY: " \n", OPENAI_API_KEY: keys.OPENAI_API_KEY }).map((item) => item.provider),
    ["openai"],
  )
  assert.deepEqual(configuredProviders({}), [])
  const custom = configuredProviders({
    ...keys,
    GEMINI_MODEL: " gemini-fixture-version ",
    OPENAI_MODEL: " fixture-model:1 ",
  })
  assert.deepEqual(
    custom.map((item) => item.model),
    ["gemini-fixture-version", "fixture-model:1"],
  )
  for (const model of ["../escape", "https://other.example/model", "bad model", "x".repeat(101)]) {
    assert.throws(() => configuredProviders({ ...keys, GEMINI_MODEL: model }), statusIs(503))
    assert.throws(() => configuredProviders({ ...keys, OPENAI_MODEL: model }), statusIs(503))
  }
})

test("legacy consent permits OpenAI only and never implicitly adds Google", () => {
  const providers = configuredProviders(keys)
  for (const allowGoogle of [undefined, false]) {
    const plan = routingPlan(submission({ allowGoogle }), providers)
    assert.deepEqual(
      plan.candidates.map((candidate) => candidate.provider),
      ["openai"],
    )
    assert.equal(plan.reason, "consent_scope")
    assert.throws(() => routingPlan(submission({ allowGoogle, provider: "gemini" }), providers), statusIs(400))
    assert.throws(
      () => routingPlan(submission({ allowGoogle }), configuredProviders({ GEMINI_API_KEY: keys.GEMINI_API_KEY })),
      statusIs(400),
    )
  }
  const openAIOnly = routingPlan(
    submission({ allowGoogle: undefined }),
    configuredProviders({ OPENAI_API_KEY: keys.OPENAI_API_KEY }),
  )
  assert.equal(openAIOnly.reason, "configured_primary")
  assert.equal(openAIOnly.candidates[0].provider, "openai")
})

test("manual choices produce one permitted provider and unavailable selections fail before invocation", () => {
  for (const provider of ["gemini", "openai"] as const) {
    const plan = routingPlan(submission({ provider }), configuredProviders(keys))
    assert.equal(plan.reason, "visitor_selected")
    assert.deepEqual(
      plan.candidates.map((candidate) => candidate.provider),
      [provider],
    )
  }
  assert.throws(
    () => routingPlan(submission({ provider: "gemini" }), configuredProviders({ OPENAI_API_KEY: keys.OPENAI_API_KEY })),
    statusIs(503),
  )
  assert.equal(
    routingPlan(submission({ provider: "openai", allowGoogle: false }), configuredProviders(keys)).candidates[0]
      .provider,
    "openai",
  )
})

test("primary success invokes one whole comparison and exposes only bounded routing metadata", async () => {
  const calls: string[] = []
  const accepted = await runRoutedReview(
    automatic(),
    async (config) => {
      calls.push(config.provider)
      return review(config)
    },
    signal(),
    clock() + 52_000,
    clock,
  )
  assert.deepEqual(calls, ["gemini"])
  assert.equal(accepted.result, sampleRunEvidence.result)
  assert.equal(accepted.result.changes.length, 2)
  assert.equal(accepted.model, "gemini-fixture-returned-version")
  assert.deepEqual(accepted.routing, { provider: "gemini", reason: "configured_primary", policy: RAF_ROUTING_POLICY })
  assert.equal(RAF_ROUTING_POLICY, "provider-routing-v1")
  assert.equal("apiKey" in accepted, false)
  for (const key of Object.values(keys)) assert.equal(JSON.stringify(accepted).includes(key), false)
  assert.deepEqual(Object.keys(accepted.routing).sort(), ["policy", "provider", "reason"])
})

test("only provider 429, 5xx and explicitly classified network failures use the OpenAI backup", async () => {
  for (const error of [
    providerFailure(429),
    providerFailure(500),
    providerFailure(503),
    providerFailure(504),
    providerFailure(599),
    providerFailure(0, "NETWORK_ERROR"),
  ]) {
    const calls: string[] = []
    const accepted = await runRoutedReview(
      automatic(),
      async (config) => {
        calls.push(config.provider)
        if (config.provider === "gemini") throw error
        return review(config)
      },
      signal(),
      clock() + 52_000,
      clock,
    )
    assert.deepEqual(calls, ["gemini", "openai"])
    assert.equal(accepted.result, sampleRunEvidence.result)
    assert.equal(accepted.model, "openai-fixture-returned-version")
    assert.deepEqual(accepted.routing, {
      provider: "openai",
      reason: "temporary_provider_failure",
      policy: RAF_ROUTING_POLICY,
    })
    for (const key of Object.values(keys)) assert.equal(JSON.stringify(accepted).includes(key), false)
  }
})

test("fallback requires at least 15 seconds remaining when the first provider fails", async () => {
  for (const remaining of [-1, 0, 14_999, 15_000, 15_001]) {
    const calls: string[] = []
    const failure = providerFailure(503)
    const pending = runRoutedReview(
      automatic(),
      async (config) => {
        calls.push(config.provider)
        if (config.provider === "gemini") throw failure
        return review(config)
      },
      signal(),
      clock() + remaining,
      clock,
    )
    if (remaining < 15_000) {
      await assert.rejects(pending, (error: unknown) => error === failure)
      assert.deepEqual(calls, ["gemini"])
    } else {
      assert.equal((await pending).routing.provider, "openai")
      assert.deepEqual(calls, ["gemini", "openai"])
    }
  }
  let now = clock()
  const failure = providerFailure(429)
  let calls = 0
  await assert.rejects(
    runRoutedReview(
      automatic(),
      async () => {
        calls++
        now += 38_000
        throw failure
      },
      signal(),
      clock() + 52_000,
      () => now,
    ),
    (error: unknown) => error === failure,
  )
  assert.equal(calls, 1, "time spent by the primary is deducted before considering fallback")
})

test("authentication, schema, refusal, local quota and unclassified errors do not trigger another provider", async () => {
  const errors = [
    providerFailure(400, "INVALID_ARGUMENT"),
    providerFailure(401, "UNAUTHENTICATED"),
    providerFailure(403, "PERMISSION_DENIED"),
    providerFailure(404, "NOT_FOUND"),
    providerFailure(408, "TIMEOUT"),
    providerFailure(422, "REFUSAL"),
    providerFailure(499, "CANCELLED"),
    providerFailure(600),
    providerFailure(0, "UNKNOWN"),
    providerFailure(200, "INVALID_SCHEMA"),
    new RafHttpError("Source and evidence checks failed.", 502),
    new RafHttpError("Model refused.", 422),
    new RafHttpError("Local budget exceeded.", 429),
    new RafHttpError("Configuration unavailable.", 503),
    new TypeError("Unclassified implementation or transport error."),
    new Error("Unknown failure."),
  ]
  for (const failure of errors) {
    const calls: string[] = []
    await assert.rejects(
      runRoutedReview(
        automatic(),
        async (config) => {
          calls.push(config.provider)
          throw failure
        },
        signal(),
        clock() + 52_000,
        clock,
      ),
      (error: unknown) => error === failure,
    )
    assert.deepEqual(calls, ["gemini"])
  }
})

test("a manual selection never falls back even after a transient failure", async () => {
  for (const provider of ["gemini", "openai"] as const) {
    const plan = routingPlan(submission({ provider }), configuredProviders(keys))
    const failure = providerFailure(503)
    const calls: string[] = []
    await assert.rejects(
      runRoutedReview(
        plan,
        async (config) => {
          calls.push(config.provider)
          throw failure
        },
        signal(),
        clock() + 52_000,
        clock,
      ),
      (error: unknown) => error === failure,
    )
    assert.deepEqual(calls, [provider])
  }
})

test("one failed backup ends the attempt and preserves its failure", async () => {
  const failures = [providerFailure(503), providerFailure(429)]
  const calls: string[] = []
  await assert.rejects(
    runRoutedReview(
      automatic(),
      async (config) => {
        calls.push(config.provider)
        throw failures[calls.length - 1]
      },
      signal(),
      clock() + 52_000,
      clock,
    ),
    (error: unknown) => error === failures[1],
  )
  assert.deepEqual(calls, ["gemini", "openai"])
})

test("an already aborted request invokes no provider", async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  await assert.rejects(
    runRoutedReview(
      automatic(),
      async (config) => {
        calls++
        return review(config)
      },
      controller.signal,
      clock() + 52_000,
      clock,
    ),
    statusIs(408),
  )
  assert.equal(calls, 0)
})

test("cancellation during a failed primary prevents backup invocation", async () => {
  const controller = new AbortController()
  const failure = providerFailure(503)
  const calls: string[] = []
  await assert.rejects(
    runRoutedReview(
      automatic(),
      async (config) => {
        calls.push(config.provider)
        controller.abort()
        throw failure
      },
      controller.signal,
      clock() + 52_000,
      clock,
    ),
    (error: unknown) => error === failure,
  )
  assert.deepEqual(calls, ["gemini"])
})

test("a provider resolving after cancellation cannot publish a successful review", async () => {
  const controller = new AbortController()
  const calls: string[] = []
  await assert.rejects(
    runRoutedReview(
      automatic(),
      async (config) => {
        calls.push(config.provider)
        controller.abort()
        return review(config)
      },
      controller.signal,
      clock() + 52_000,
      clock,
    ),
    statusIs(408),
  )
  assert.deepEqual(calls, ["gemini"])
})
