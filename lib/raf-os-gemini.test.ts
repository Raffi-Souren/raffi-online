import assert from "node:assert/strict"
import test from "node:test"
import { PDFDocument } from "pdf-lib"
import { sampleRunBefore, sampleRunEvidence, sampleSubmissionBefore } from "./raf-os-fixtures"
import { buildModelRequest, prepareSubmission, RafHttpError } from "./raf-os-server"
import {
  buildGeminiRequest,
  DEFAULT_GEMINI_MODEL,
  parseGeminiResponse,
  projectGeminiSchema,
  requestGemini,
} from "./raf-os-gemini"

const fakeKey = "fictional-gemini-key-not-a-credential"
const modelVersion = "gemini-3.7-flash-fixture-version"
const errorStatus = (status: number) => (error: unknown) => error instanceof RafHttpError && error.status === status
const modelRequest = async () =>
  buildModelRequest({ current: sampleSubmissionBefore, previous: null, action: "analyze", challenge: "" }, [
    await prepareSubmission(sampleSubmissionBefore, "v2"),
  ])
const responseEnvelope = (result = sampleRunBefore.result) => ({
  modelVersion,
  candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: JSON.stringify(result) }] } }],
})

test("Gemini converts the same source-bearing input and schema into native text and inline PDF parts", async () => {
  const pdf = await PDFDocument.create()
  pdf.addPage([120, 120])
  const data = Buffer.from(await pdf.save()).toString("base64")
  const submission = {
    text: "A fictional deck.",
    deck: { name: "fictional.pdf", data: "data:application/pdf;base64," + data },
  }
  const openAI = buildModelRequest(
    { current: submission, previous: null, action: "analyze", challenge: "Keep the evidence status explicit." },
    [await prepareSubmission(submission, "v2")],
  )
  const converted = buildGeminiRequest(openAI)
  assert.equal(converted.model, DEFAULT_GEMINI_MODEL)
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-3.7-flash")
  assert.deepEqual(converted.body.systemInstruction, { parts: [{ text: openAI.instructions }] })
  assert.deepEqual(converted.body.contents[0].parts.at(-1), { inlineData: { mimeType: "application/pdf", data } })
  assert.match(JSON.stringify(converted.body.contents), /v2:deck:p1/)
  assert.equal(converted.body.generationConfig.responseMimeType, "application/json")
  assert.deepEqual(converted.body.generationConfig.responseJsonSchema, projectGeminiSchema(openAI.text.format.schema))
  assert.deepEqual(converted.body.generationConfig.thinkingConfig, { thinkingLevel: "LOW", includeThoughts: false })
  assert.equal(converted.body.generationConfig.maxOutputTokens, 6500)
  assert.equal("store" in converted.body, false)
  assert.equal("tools" in converted.body, false)
  assert.equal("candidateCount" in converted.body.generationConfig, false)
  assert.equal("temperature" in converted.body.generationConfig, false)
  assert.equal(JSON.stringify(converted).includes(fakeKey), false)
  assert.throws(() => buildGeminiRequest(openAI, "../other-host?key=private"), errorStatus(503))
})

test("Gemini schema projection keeps structure and nullability while removing unsupported keywords at every depth", () => {
  const original = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    additionalProperties: false,
    required: ["labels", "score"],
    properties: {
      labels: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        uniqueItems: true,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["maxLength"],
          properties: {
            maxLength: {
              type: "string",
              title: "Verbatim passage",
              description: "Use an exact source substring without adding ellipses.",
              minLength: 1,
              maxLength: 40,
              pattern: "^a",
              enum: ["alpha", "beta"],
              madeUp: true,
            },
          },
        },
      },
      score: { anyOf: [{ type: "integer", minimum: 0, maximum: 5, multipleOf: 1 }, { type: "null" }] },
    },
    propertyOrdering: ["score", "labels"],
    madeUp: "remove me",
  }
  const snapshot = structuredClone(original)
  const expected = {
    type: "object",
    additionalProperties: false,
    required: ["labels", "score"],
    properties: {
      labels: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["maxLength"],
          properties: {
            maxLength: {
              type: "string",
              title: "Verbatim passage",
              description: "Use an exact source substring without adding ellipses.",
              enum: ["alpha", "beta"],
            },
          },
          propertyOrdering: ["maxLength"],
        },
      },
      score: { anyOf: [{ type: "integer", minimum: 0, maximum: 5 }, { type: "null" }] },
    },
    propertyOrdering: ["labels", "score"],
  }
  assert.deepEqual(projectGeminiSchema(original), expected)
  assert.deepEqual(original, snapshot)
  assert.deepEqual(projectGeminiSchema({ type: "object", additionalProperties: true }), {
    type: "object",
    additionalProperties: true,
    propertyOrdering: [],
  })
})

test("building a Gemini request leaves the complete OpenAI schema untouched and length constraints still reject locally", async () => {
  const openAI = await modelRequest()
  const before = structuredClone(openAI.text.format.schema)
  const projected = buildGeminiRequest(openAI).body.generationConfig.responseJsonSchema
  assert.deepEqual(openAI.text.format.schema, before)
  assert.match(JSON.stringify(before), /"maxLength":1200/)
  assert.doesNotMatch(JSON.stringify(projected), /"(?:minLength|maxLength|\$schema)":/)
  const overlong = structuredClone(sampleRunBefore.result)
  overlong.review.snapshot = "x".repeat(1201)
  assert.throws(() => parseGeminiResponse(responseEnvelope(overlong), sampleRunBefore.sources, false), errorStatus(502))
})

test("Gemini keeps the actual model version and runs the same text and comparison contracts", () => {
  assert.deepEqual(parseGeminiResponse(responseEnvelope(), sampleRunBefore.sources, false), {
    result: sampleRunBefore.result,
    model: modelVersion,
  })
  assert.deepEqual(
    parseGeminiResponse(responseEnvelope(sampleRunEvidence.result), sampleRunEvidence.sources, true).result,
    sampleRunEvidence.result,
  )
  const fabricated = structuredClone(sampleRunEvidence.result)
  fabricated.changes[0].after.quote = "Invented quotation absent from the submitted pitch."
  assert.throws(
    () => parseGeminiResponse(responseEnvelope(fabricated), sampleRunEvidence.sources, true),
    errorStatus(502),
  )
  const missingSource = structuredClone(sampleRunBefore.result)
  missingSource.review.findings[0].refs = ["v2:p999"]
  assert.throws(
    () => parseGeminiResponse(responseEnvelope(missingSource), sampleRunBefore.sources, false),
    errorStatus(502),
  )
  assert.throws(
    () => parseGeminiResponse(responseEnvelope(sampleRunEvidence.result), sampleRunEvidence.sources, false),
    errorStatus(502),
  )
})

test("Gemini accepts completed text parts without exposing thought text", () => {
  const result = JSON.stringify(sampleRunBefore.result)
  const parts = [
    { text: "Private model reasoning", thought: true },
    { text: result.slice(0, 30) },
    { text: result.slice(30), thoughtSignature: "opaque" },
  ]
  const response = { modelVersion, candidates: [{ finishReason: "STOP", content: { role: "model", parts } }] }
  assert.deepEqual(parseGeminiResponse(response, sampleRunBefore.sources, false).result, sampleRunBefore.result)
  assert.throws(
    () => parseGeminiResponse({ ...response, modelVersion: undefined }, sampleRunBefore.sources, false),
    errorStatus(502),
  )
  assert.throws(
    () =>
      parseGeminiResponse(
        { ...response, candidates: [...response.candidates, ...response.candidates] },
        sampleRunBefore.sources,
        false,
      ),
    errorStatus(502),
  )
})

test("Gemini never accepts safety refusals, token truncation, tools or malformed JSON as a review", () => {
  assert.throws(
    () => parseGeminiResponse({ ...responseEnvelope(), error: { message: fakeKey } }, sampleRunBefore.sources, false),
    errorStatus(502),
  )
  for (const finishReason of ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "ESCALATION"]) {
    const response = responseEnvelope()
    response.candidates[0].finishReason = finishReason
    assert.throws(() => parseGeminiResponse(response, sampleRunBefore.sources, false), errorStatus(422))
  }
  for (const finishReason of ["MAX_TOKENS", "OTHER", "MALFORMED_RESPONSE", ""]) {
    const response = responseEnvelope()
    response.candidates[0].finishReason = finishReason
    assert.throws(() => parseGeminiResponse(response, sampleRunBefore.sources, false), errorStatus(502))
  }
  assert.throws(() => parseGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } }, [], false), errorStatus(422))
  assert.throws(
    () =>
      parseGeminiResponse({ ...responseEnvelope(), promptFeedback: { safetyRatings: [{ blocked: true }] } }, [], false),
    errorStatus(422),
  )
  assert.throws(
    () =>
      parseGeminiResponse(
        { modelVersion, candidates: [{ finishReason: "STOP", safetyRatings: [{ blocked: true }] }] },
        [],
        false,
      ),
    errorStatus(422),
  )
  for (const part of [
    { text: "not JSON" },
    { functionCall: { name: "unrequested_tool" } },
    { text: "{}", thought: true },
  ]) {
    assert.throws(
      () =>
        parseGeminiResponse(
          { modelVersion, candidates: [{ finishReason: "STOP", content: { role: "model", parts: [part] } }] },
          [],
          false,
        ),
      errorStatus(502),
    )
  }
})

test(
  "Gemini transport posts the audited payload once to the trusted endpoint with a header-only key",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch
    const request = buildGeminiRequest(await modelRequest())
    let calls = 0
    globalThis.fetch = async (url, options) => {
      calls++
      assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent")
      assert.equal(String(url).includes(fakeKey), false)
      assert.equal(new Headers(options?.headers).get("x-goog-api-key"), fakeKey)
      assert.equal(options?.body, JSON.stringify(request.body))
      assert.equal(options?.method, "POST")
      assert.equal(options?.redirect, "error")
      assert.equal(options?.cache, "no-store")
      assert.ok(options?.signal instanceof AbortSignal)
      return new Response(JSON.stringify(responseEnvelope()))
    }
    try {
      assert.deepEqual(
        await requestGemini(request, fakeKey, sampleRunBefore.sources, false, new AbortController().signal),
        {
          result: sampleRunBefore.result,
          model: modelVersion,
        },
      )
      assert.equal(calls, 1)
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)

test(
  "Gemini provider failures disclose only bounded diagnostic tokens and never error messages",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch
    const request = buildGeminiRequest(await modelRequest())
    const cases = [
      {
        status: 400,
        body: {
          error: {
            status: "INVALID_ARGUMENT",
            message: "The schema is too complex. " + fakeKey,
            details: [{ reason: "API_KEY_INVALID", metadata: { secret: fakeKey } }],
          },
        },
        code: "API_KEY_INVALID",
        parameter: "unknown",
      },
      {
        status: 400,
        body: {
          error: {
            status: "INVALID_ARGUMENT",
            message: "API key not valid. Please pass a valid API key. " + fakeKey,
            details: [{ reason: "invalid\n" + fakeKey }],
          },
        },
        code: "API_KEY_INVALID",
        parameter: "unknown",
      },
      ...[
        {
          message: "The specified schema produces a constraint that has too many states for serving.",
          code: "SCHEMA_TOO_COMPLEX",
        },
        {
          message: "A schema in GenerationConfig exceeds the maximum allowed nesting depth.",
          code: "SCHEMA_TOO_COMPLEX",
        },
        {
          message: "Gemini API free tier is not available in your country. Please enable billing on your project.",
          code: "BILLING_REQUIRED",
        },
        { message: "Thinking level MINIMAL is not supported for this model.", code: "THINKING_CONFIG_INVALID" },
        { message: "Unexpected generic error involving schema, billing, and thinking.", code: "INVALID_ARGUMENT" },
      ].map((entry) => ({
        status: 400,
        body: { error: { status: "INVALID_ARGUMENT", message: entry.message + " " + fakeKey } },
        code: entry.code,
        parameter: "unknown",
      })),
      ...["api_key_invalid", "API_KEY_INVALID\nPRIVATE", "API_KEY_INVALID<script>", "A".repeat(101)].map((reason) => ({
        status: 400,
        body: { error: { status: "INVALID_ARGUMENT", message: fakeKey, details: [{ reason }] } },
        code: "INVALID_ARGUMENT",
        parameter: "unknown",
      })),
      {
        status: 400,
        body: {
          error: {
            status: "INVALID_ARGUMENT",
            message: fakeKey,
            details: [{ fieldViolations: [{ field: "generationConfig.responseJsonSchema", description: fakeKey }] }],
          },
        },
        code: "INVALID_ARGUMENT",
        parameter: "generationConfig.responseJsonSchema",
      },
      {
        status: 401,
        body: { error: { status: "UNAUTHENTICATED", message: fakeKey } },
        code: "UNAUTHENTICATED",
        parameter: "unknown",
      },
      {
        status: 400,
        body: {
          error: {
            status: "<script>private</script>",
            details: [{ fieldViolations: [{ field: "private\n" + fakeKey }] }],
          },
        },
        code: "unknown",
        parameter: "unknown",
      },
      {
        status: 503,
        body: { error: { status: "x".repeat(101), details: [{ fieldViolations: [{ field: "x".repeat(101) }] }] } },
        code: "unknown",
        parameter: "unknown",
      },
      { status: 400, body: "malformed private " + fakeKey, code: "unknown", parameter: "unknown" },
      { status: 401, body: "x".repeat(16_001), code: "unknown", parameter: "unknown" },
      {
        status: 429,
        body: { error: { status: "RESOURCE_EXHAUSTED", message: fakeKey } },
        code: "RESOURCE_EXHAUSTED",
        parameter: "unknown",
      },
    ]
    try {
      for (const entry of cases) {
        let calls = 0
        globalThis.fetch = async () => {
          calls++
          return new Response(typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body), {
            status: entry.status,
          })
        }
        await assert.rejects(
          requestGemini(request, fakeKey, [], false, new AbortController().signal),
          (error: unknown) => {
            assert.ok(error instanceof RafHttpError)
            assert.equal(error.status, entry.status === 429 ? 429 : 503)
            if (entry.status === 429) assert.equal(error.retryAfter, 60)
            assert.deepEqual(error.diagnostic, {
              providerStatus: entry.status,
              providerCode: entry.code,
              providerParameter: entry.parameter,
            })
            assert.equal((JSON.stringify(error) + error.message).includes(fakeKey), false)
            return true
          },
        )
        assert.equal(calls, 1)
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)

test("Gemini bounds streamed response bytes without trusting Content-Length", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch
  const request = buildGeminiRequest(await modelRequest())
  let cancelled = false
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(128_001))
          controller.enqueue(new Uint8Array(128_001))
        },
        cancel() {
          cancelled = true
        },
      }),
      { headers: { "content-length": "1" } },
    )
  try {
    await assert.rejects(requestGemini(request, fakeKey, [], false, new AbortController().signal), errorStatus(502))
    assert.equal(cancelled, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test(
  "Gemini marks network failures for routing while malformed payloads remain validation failures",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch
    const request = buildGeminiRequest(await modelRequest())
    const scenarios = [
      {
        fetch: async () => {
          throw new TypeError("Network details " + fakeKey)
        },
        status: 503,
      },
      {
        fetch: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new TypeError("Stream details " + fakeKey))
              },
            }),
          ),
        status: 503,
      },
      { fetch: async () => new Response(new Uint8Array([0xff, 0xfe])), status: 502 },
      { fetch: async () => new Response("invalid JSON " + fakeKey), status: 502 },
      {
        fetch: async () =>
          new Response(JSON.stringify({ ...responseEnvelope(), candidates: [{ finishReason: "MAX_TOKENS" }] })),
        status: 502,
      },
      { fetch: async () => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })), status: 422 },
    ]
    try {
      for (const scenario of scenarios) {
        let calls = 0
        globalThis.fetch = async () => {
          calls++
          return scenario.fetch()
        }
        await assert.rejects(
          requestGemini(request, fakeKey, [], false, new AbortController().signal),
          (error: unknown) => {
            assert.ok(error instanceof RafHttpError)
            assert.equal(error.status, scenario.status)
            if (scenario.status === 503)
              assert.deepEqual(error.diagnostic, {
                providerStatus: 0,
                providerCode: "NETWORK_ERROR",
                providerParameter: "unknown",
              })
            else assert.equal(error.diagnostic, undefined)
            assert.equal((JSON.stringify(error) + error.message).includes(fakeKey), false)
            return true
          },
        )
        assert.equal(calls, 1)
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)

test(
  "Gemini aborts a pending body and does not start a request already cancelled",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch
    const request = buildGeminiRequest(await modelRequest())
    const controller = new AbortController()
    let calls = 0
    let cancelled = false
    globalThis.fetch = async (_url, options) => {
      calls++
      options?.signal?.addEventListener(
        "abort",
        () => {
          cancelled = true
        },
        { once: true },
      )
      return new Response(
        new ReadableStream({
          start() {
            queueMicrotask(() => controller.abort())
          },
        }),
      )
    }
    try {
      await assert.rejects(requestGemini(request, fakeKey, [], false, controller.signal), errorStatus(408))
      assert.equal(cancelled, true)
      assert.equal(calls, 1)
      await assert.rejects(requestGemini(request, fakeKey, [], false, controller.signal), errorStatus(408))
      assert.equal(calls, 1)
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)
