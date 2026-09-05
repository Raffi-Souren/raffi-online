"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowUpRight, Download, FileText, Terminal, X } from "lucide-react"
import WindowShell from "../../components/ui/WindowShell"
import {
  CHANGE_LABELS,
  GPT_BACKUP,
  RAF_RUBRIC,
  comparisonVerdict,
  exportRun,
  validateCritique,
  type RunRequest,
  type RunResult,
  type SavedRun,
  type Source,
  type Submission,
} from "../../lib/raf-os"

const ink = "#d7e4d9",
  green = "#a1e7a8",
  muted = "#9aaba1",
  amber = "#ffd18a",
  line = "#32483a"
const control: CSSProperties = {
  border: `1px solid ${line}`,
  borderRadius: 2,
  padding: "9px 12px",
  color: ink,
  background: "#17271d",
  font: "inherit",
  fontSize: 12,
  minHeight: 38,
  cursor: "pointer",
}
const field: CSSProperties = {
  width: "100%",
  background: "#0b1710",
  color: ink,
  border: `1px solid ${line}`,
  borderRadius: 2,
  padding: 12,
  font: "inherit",
  fontSize: 13,
  lineHeight: 1.7,
  resize: "vertical",
}
const sample =
  "We help independent venues turn first-time ticket buyers into repeat visitors. Today their ticketing data and email lists are disconnected.\n\nWe interviewed six venue operators. Four described exporting spreadsheets after each event. We have not tested willingness to pay.\n\nOur idea is a weekly audience follow-up tool. We plan to charge $100 per venue per month. Our next step is a pilot with one venue."
const statusLabels = {
  unknown: "Unknown",
  founder_claim: "Founder claim",
  reported_evidence: "Reported evidence",
  supplied_document: "Supplied document",
}
type Props = { isOpen: boolean; isMinimized: boolean; onClose: () => void; onMinimize: () => void }
type View = "draft" | "review" | "changes" | "protocol"
type ProviderChoice = NonNullable<RunRequest["provider"]>
type ModelProvider = Exclude<ProviderChoice, "auto">
const providerNames: Record<ModelProvider, string> = { gemini: "Gemini", openai: "OpenAI" }

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function References({ ids, sources }: { ids: string[]; sources: Source[] }) {
  if (!ids.length) return <span style={{ color: muted, fontSize: 11 }}>No source supplied</span>
  return (
    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {ids.map((id) => {
        const source = sources.find((entry) => entry.id === id)
        return (
          <details key={id} style={{ fontSize: 11, color: muted, maxWidth: "100%" }}>
            <summary style={{ cursor: "pointer", color: green }}>{source?.label ?? id}</summary>
            <p
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 8, borderLeft: `1px solid ${line}` }}
            >
              {source?.text ??
                "PDF page reference. The model read the supplied page; its quotation has not been checked against extracted text."}
            </p>
          </details>
        )
      })}
    </span>
  )
}

export default function RafOsTerminal({ isOpen, isMinimized, onClose, onMinimize }: Props) {
  const [draft, setDraft] = useState("")
  const [deck, setDeck] = useState<Submission["deck"]>(null)
  const [previousDraft, setPreviousDraft] = useState("")
  const [previousDeck, setPreviousDeck] = useState<Submission["deck"]>(null)
  const [manualCompare, setManualCompare] = useState(false)
  const [baselineId, setBaselineId] = useState("")
  const [challenge, setChallenge] = useState("")
  const [runs, setRuns] = useState<SavedRun[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [view, setView] = useState<View>("draft")
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [clearPending, setClearPending] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [provider, setProvider] = useState<ProviderChoice>("auto")
  const [configuredProviders, setConfiguredProviders] = useState<ModelProvider[]>([])
  const [defaultProvider, setDefaultProvider] = useState<ModelProvider | null>(null)
  const request = useRef<AbortController | null>(null)
  const fileEpoch = useRef(0)
  const outputArea = useRef<HTMLDivElement>(null)
  const active = runs.find((run) => run.id === selectedId) ?? runs[runs.length - 1]
  const baseline = runs.find((run) => run.id === baselineId)

  useEffect(() => {
    outputArea.current?.scrollTo({ top: 0 })
  }, [view, selectedId])
  useEffect(() => {
    if (error) outputArea.current?.scrollTo({ top: 0 })
  }, [error])

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/raf-os", { signal: controller.signal, cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return
        setAvailable(data.available === true)
        const configured = (["gemini", "openai"] as const).filter(
          (name) => Array.isArray(data.providers) && data.providers.includes(name),
        )
        setConfiguredProviders(configured)
        setDefaultProvider(configured.find((name) => name === data.defaultProvider) ?? null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false)
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!isOpen) {
      request.current?.abort()
      request.current = null
      setBusy(false)
    }
  }, [isOpen])
  useEffect(
    () => () => {
      request.current?.abort()
      fileEpoch.current++
    },
    [],
  )

  async function chooseFile(file: File | undefined, previous: boolean) {
    if (!file) return
    const epoch = ++fileEpoch.current
    setError("")
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      setError("Choose a PDF deck.")
      return
    }
    if (file.size > 1024 * 1024) {
      setError("This version accepts PDFs up to 1 MB and 24 pages. Compress your deck or paste its text.")
      return
    }
    setFileBusy(true)
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      if (fileEpoch.current === epoch) (previous ? setPreviousDeck : setDeck)({ name: file.name, data })
    } catch {
      if (fileEpoch.current === epoch) setError("The file could not be read. Try again or paste the text.")
    } finally {
      if (fileEpoch.current === epoch) setFileBusy(false)
    }
  }

  const cancel = () => {
    request.current?.abort()
    request.current = null
    setBusy(false)
    setNotice("Request cancelled. Your draft is still here.")
  }
  const clear = () => {
    cancel()
    fileEpoch.current++
    setFileBusy(false)
    setRuns([])
    setSelectedId("")
    setBaselineId("")
    setDraft("")
    setPreviousDraft("")
    setDeck(null)
    setPreviousDeck(null)
    setChallenge("")
    setManualCompare(false)
    setConsent(false)
    setProvider("auto")
    setError("")
    setNotice("Session cleared.")
    setView("draft")
    setClearPending(false)
  }

  async function run(action: RunRequest["action"]) {
    if (request.current || fileBusy) return
    setNotice("")
    setError("")
    if (!draft.trim() && !deck) {
      setError("Paste your idea or attach a PDF to start.")
      return
    }
    if (!consent) {
      setError("Please acknowledge the data notice before sending your pitch.")
      return
    }
    const previous =
      action === "compare" ? (manualCompare ? { text: previousDraft, deck: previousDeck } : baseline?.submission) : null
    if (action === "compare" && (!previous || (!previous.text.trim() && !previous.deck))) {
      setError("Choose a saved version or add the earlier draft to compare.")
      return
    }
    if (previous && previous.text === draft && previous.deck?.data === deck?.data) {
      setError("These versions are identical. Add your revision before comparing.")
      return
    }
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    const submission = { text: draft.trim(), deck }
    try {
      const response = await fetch("/api/raf-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          current: submission,
          previous: previous ?? null,
          challenge: challenge.trim(),
          action,
          allowGoogle: true,
          provider,
        } satisfies RunRequest),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "The review could not complete. Your draft is preserved.",
        )
      if (controller.signal.aborted) return
      const output = data as RunResult
      if (
        !Array.isArray(output.sources) ||
        typeof output.model !== "string" ||
        typeof output.createdAt !== "string" ||
        typeof output.rubric !== "string"
      )
        throw new Error("The service returned an incomplete review. Please retry.")
      validateCritique(output.result, output.sources, action === "compare")
      const saved: SavedRun = {
        ...output,
        id: crypto.randomUUID(),
        version: (runs[runs.length - 1]?.version ?? runs.length) + 1,
        submission,
        baselineId: previous && !manualCompare ? baselineId : null,
      }
      setRuns((old) => [...old.slice(-5), saved])
      setSelectedId(saved.id)
      setBaselineId(saved.id)
      setView(action === "compare" ? "changes" : "review")
      setAvailable(true)
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Connection lost. Your draft is preserved; try again.")
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }

  function command(value: string) {
    const commands: Record<string, () => void> = {
      "/help": () => setView("protocol"),
      "/analyze": () => void run("analyze"),
      "/deck": () => {
        setView("draft")
        setNotice("Attach a PDF using the deck control.")
      },
      "/compare": () => void run("compare"),
      "/iterate": () => {
        setView("draft")
        setNotice("Revise your draft, then compare it with the saved version.")
      },
      "/pilot": () => void run("pilot"),
      "/valueprop": () => void run("valueprop"),
      "/export": () => {
        if (active) download(exportRun(active), "raf-os-review.md", "text/markdown")
      },
      "/clear": () => setClearPending(true),
    }
    const execute = commands[value.trim().toLowerCase()]
    if (execute) execute()
    else setNotice("Unknown command. Use /help to see the available actions.")
  }

  async function exportAudit() {
    if (!active) return
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(active.submission))
      const digest = await crypto.subtle.digest("SHA-256", bytes)
      const hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
      const { submission, ...record } = active
      const counts = Object.fromEntries(
        Object.keys(CHANGE_LABELS).map((kind) => [kind, active.result.changes.filter((c) => c.kind === kind).length]),
      )
      download(
        JSON.stringify(
          {
            ...record,
            submission: { text: submission.text, deckName: submission.deck?.name ?? null },
            submissionSha256: hash,
            changeCounts: counts,
            verdict: comparisonVerdict(active.result.changes),
            checks: [
              "strict response schema",
              "source IDs exist",
              "comparison sources use correct versions",
              "text quotations match supplied paragraphs",
              "forecasts and opinions cannot be counted as new evidence",
              "repeated quotation cannot count as added support",
            ],
            limits: [
              "Evidence classification and scores are model judgments.",
              "PDF quotations are page-referenced, not text-verified.",
              "Supplied evidence is not independently authenticated.",
              "This record reproduces the returned review; rerunning the model may differ.",
            ],
          },
          null,
          2,
        ),
        "raf-os-review-record.json",
        "application/json",
      )
    } catch {
      setError("Could not export the record. Try the Markdown export.")
    }
  }

  const upload = (previous = false) => (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      <label style={{ ...control, display: "inline-flex", gap: 6, alignItems: "center" }}>
        <FileText size={14} />
        <span>{previous ? "Earlier PDF" : "Attach PDF"}</span>
        <input
          aria-label={previous ? "Upload earlier deck" : "Upload pitch deck"}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy || fileBusy}
          style={{ maxWidth: 170, fontSize: 11 }}
          onChange={(event) => {
            void chooseFile(event.target.files?.[0], previous)
            event.target.value = ""
          }}
        />
      </label>
      {(previous ? previousDeck : deck) && (
        <span style={{ fontSize: 11, overflowWrap: "anywhere" }}>
          {(previous ? previousDeck : deck)?.name}
          <button
            aria-label={previous ? "Remove earlier deck" : "Remove deck"}
            disabled={busy}
            style={{ ...control, padding: 5, marginLeft: 5 }}
            onClick={() => (previous ? setPreviousDeck : setDeck)(null)}
          >
            <X size={12} />
          </button>
        </span>
      )}
    </div>
  )

  return (
    <WindowShell
      appearance="terminal"
      title="RAF OS TERMINAL"
      onClose={onClose}
      onMinimize={onMinimize}
      hidden={!isOpen || isMinimized}
      fill
      fullBleed
      maxWidth="1120px"
      compact
    >
      <div
        className="raf-terminal"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#101d15",
          color: ink,
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontSize: 13,
        }}
      >
        <header
          className="raf-header"
          style={{
            padding: "var(--raf-header-padding, 18px 20px 13px)",
            borderBottom: `1px solid ${line}`,
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", gap: 9, alignItems: "center", color: green, fontSize: 16, fontWeight: 700 }}>
              <Terminal size={18} /> IDEA → PILOT → PROOF
            </div>
            <p className="raf-tagline" style={{ color: muted, fontSize: 12, margin: "8px 0 0" }}>
              Did the pitch get stronger—or just sound better?
            </p>
          </div>
          <a
            href={GPT_BACKUP}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: muted, fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}
          >
            GPT version <ArrowUpRight size={13} />
          </a>
        </header>
        <nav
          aria-label="Terminal views"
          style={{ display: "flex", gap: 0, flexWrap: "wrap", padding: "0 12px", borderBottom: `1px solid ${line}` }}
        >
          {(["draft", "review", "changes", "protocol"] as const).map((tab) => (
            <button
              key={tab}
              disabled={(tab === "review" || tab === "changes") && !active}
              aria-current={view === tab ? "page" : undefined}
              onClick={() => setView(tab)}
              style={{
                ...control,
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${view === tab ? green : "transparent"}`,
                color: view === tab ? green : muted,
                opacity: (tab === "review" || tab === "changes") && !active ? 0.5 : 1,
              }}
            >
              {tab === "protocol" ? "Review protocol" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <div
          ref={outputArea}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 20px", overflowWrap: "anywhere" }}
        >
          <div role="status" aria-live="polite" style={{ color: busy ? green : muted, fontSize: 11, marginBottom: 12 }}>
            {busy
              ? "Reviewing supplied material… You can cancel this request."
              : fileBusy
                ? "Reading your PDF…"
                : notice ||
                  (available === false
                    ? ">> Live analysis is temporarily unavailable. Your draft stays here; the GPT version is available above."
                    : ">> Latest six reviews stay in this tab. Closing preserves the session; refreshing clears it.")}
          </div>
          {error && (
            <p
              role="alert"
              style={{ borderLeft: `3px solid ${amber}`, color: amber, padding: 12, background: "#31281b" }}
            >
              {error}
            </p>
          )}
          {view === "draft" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <h2 style={{ fontSize: 14, margin: "4px 0 12px" }}>
                  — {runs.length ? "Revise your pitch" : "Start with the business"}
                </h2>
                <button
                  disabled={busy}
                  style={{ ...control, color: muted, fontSize: 11 }}
                  onClick={() => {
                    if (!draft && !deck) setDraft(sample)
                    else setNotice("Clear the draft first to load the fictional venue example.")
                  }}
                >
                  Load fictional example
                </button>
              </div>
              <label htmlFor="raf-pitch" style={{ display: "block", marginBottom: 8, color: muted, fontSize: 12 }}>
                Who has the problem, what happens today, and what have you actually tested?
              </label>
              <textarea
                id="raf-pitch"
                value={draft}
                maxLength={16000}
                rows={8}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
                style={field}
                placeholder="Describe your idea, buyer, current workaround, evidence, and next milestone…"
              />
              <div style={{ fontSize: 10, color: muted, textAlign: "right" }}>
                {draft.length.toLocaleString()} / 16,000
              </div>
              {upload()}
              <p style={{ fontSize: 11, color: muted }}>
                {deck
                  ? "PDF: up to 1 MB / 24 pages. Image pages are reviewed by the model."
                  : ">> No deck detected. A text review works; add a PDF for slide-level context."}
              </p>
              <details
                open={manualCompare || undefined}
                style={{ borderTop: `1px solid ${line}`, paddingTop: 14, marginTop: 16 }}
              >
                <summary style={{ cursor: "pointer", color: green }}>Compare with an earlier version</summary>
                <div style={{ paddingTop: 12 }}>
                  {runs.length > 0 && (
                    <label style={{ display: "block", fontSize: 12 }}>
                      Saved baseline{" "}
                      <select
                        disabled={busy || manualCompare}
                        value={baselineId}
                        onChange={(e) => setBaselineId(e.target.value)}
                        style={{ ...control, margin: "8px 0", width: "100%" }}
                      >
                        <option value="">Choose a version</option>
                        {runs.map((r, i) => (
                          <option value={r.id} key={r.id}>
                            Version {r.version ?? i + 1} ·{" "}
                            {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={manualCompare}
                      onChange={(e) => setManualCompare(e.target.checked)}
                    />{" "}
                    Paste or upload a separate earlier version
                  </label>
                  {manualCompare && (
                    <div style={{ marginTop: 12 }}>
                      <label htmlFor="raf-before" style={{ display: "block", marginBottom: 6 }}>
                        Earlier pitch
                      </label>
                      <textarea
                        id="raf-before"
                        value={previousDraft}
                        maxLength={16000}
                        disabled={busy}
                        rows={5}
                        style={field}
                        onChange={(e) => setPreviousDraft(e.target.value)}
                      />
                      {upload(true)}
                    </div>
                  )}
                </div>
              </details>
              <label
                htmlFor="raf-challenge"
                style={{ display: "block", color: muted, fontSize: 12, marginTop: 18, marginBottom: 7 }}
              >
                Challenge a finding or focus the review (optional)
              </label>
              <textarea
                id="raf-challenge"
                value={challenge}
                maxLength={2000}
                rows={2}
                disabled={busy}
                onChange={(e) => setChallenge(e.target.value)}
                style={field}
                placeholder="e.g. The pilot was paid; review the invoice on page 8."
              />
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                <label htmlFor="raf-provider" style={{ color: muted, fontSize: 12 }}>
                  Provider
                </label>
                <select
                  id="raf-provider"
                  value={provider}
                  disabled={busy || fileBusy}
                  onChange={(event) => setProvider(event.target.value as ProviderChoice)}
                  aria-describedby="raf-provider-help"
                  style={{ ...control, minWidth: 150, maxWidth: "100%" }}
                >
                  <option value="auto">Auto{defaultProvider ? ` · ${providerNames[defaultProvider]}` : ""}</option>
                  {configuredProviders.map((name) => (
                    <option key={name} value={name}>
                      {providerNames[name]}
                    </option>
                  ))}
                </select>
              </div>
              <p id="raf-provider-help" style={{ color: muted, fontSize: 11, lineHeight: 1.6, margin: "8px 0 0" }}>
                Auto uses Gemini when configured, otherwise OpenAI, with one backup attempt during a temporary provider
                outage. A manual choice stays on that provider.
              </p>
              <label
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "flex-start",
                  margin: "18px 0",
                  fontSize: 11,
                  color: muted,
                  lineHeight: 1.6,
                }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  I agree to send this pitch, any earlier version, and attached PDFs to OpenAI or Google Gemini for
                  analysis. Provider data-use and retention rules apply:{" "}
                  <a
                    href="https://developers.openai.com/api/docs/guides/your-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: green }}
                  >
                    OpenAI data controls
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://ai.google.dev/gemini-api/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: green }}
                  >
                    Google Gemini terms
                  </a>
                  . Do not submit confidential, sensitive, or personal information.
                </span>
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {busy ? (
                  <button onClick={cancel} style={{ ...control, borderColor: amber, color: amber }}>
                    Cancel request
                  </button>
                ) : (
                  <>
                    <button
                      disabled={fileBusy}
                      onClick={() => void run("analyze")}
                      style={{ ...control, color: "#102217", background: green, borderColor: green, fontWeight: 700 }}
                    >
                      Analyze pitch ↵
                    </button>
                    <button
                      disabled={fileBusy}
                      onClick={() => void run("compare")}
                      style={{ ...control, color: green }}
                    >
                      Compare revision
                    </button>
                    <button disabled={fileBusy} onClick={() => void run("pilot")} style={control}>
                      Build a pilot
                    </button>
                    <button disabled={fileBusy} onClick={() => void run("valueprop")} style={control}>
                      Value prop
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {active && (view === "review" || view === "changes" || view === "protocol") && (
            <details style={{ border: `1px solid ${line}`, padding: 10, marginBottom: 16, fontSize: 11, color: muted }}>
              <summary style={{ cursor: "pointer", color: green }}>Review record · {active.rubric}</summary>
              <p>
                {active.model} · {active.prompt} · {new Date(active.createdAt).toLocaleString()}
              </p>
              {active.routing && (
                <>
                  <p>
                    Provider: {active.routing.provider === "gemini" ? "Google Gemini" : "OpenAI"} · Routing policy:{" "}
                    {active.routing.policy}
                  </p>
                  <p style={{ lineHeight: 1.8 }}>Routing reason: {active.routing.reason}</p>
                </>
              )}
              {active.audit ? (
                <>
                  <p>
                    Source references checked: {active.audit.sourceReferencesChecked} · Text quotes matched:{" "}
                    {active.audit.textQuotesChecked} · PDF quotes unchecked: {active.audit.pdfQuotesUnchecked}
                  </p>
                  <p style={{ overflowWrap: "anywhere", lineHeight: 1.8 }}>
                    Output SHA-256: {active.audit.outputSha256}
                    <br />
                    Canonical format: {active.audit.canonicalization ?? "unspecified"}
                  </p>
                </>
              ) : (
                <p>No server audit metadata is available for this record.</p>
              )}
              <p style={{ lineHeight: 1.8 }}>
                Checks establish structural consistency. Classification and scores remain model judgments. Hashes bind
                content; they do not authenticate authorship or business facts.
              </p>
            </details>
          )}
          {view === "review" && active && (
            <>
              <h2 style={{ fontSize: 14, color: green }}>— Analysis</h2>
              <p style={{ fontSize: 14, lineHeight: 1.8 }}>{active.result.review.snapshot}</p>
              <p style={{ color: amber, fontSize: 11 }}>
                Scores assess this submission. Unknown means missing information, not zero. Supplied material is not
                independently verified.
              </p>
              <div style={{ overflowX: "auto", margin: "18px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8 }}>Dimension</th>
                      <th style={{ textAlign: "left", padding: 8 }}>0–5</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.result.review.scorecard.map((s) => (
                      <tr key={s.dimension} style={{ borderTop: `1px solid ${line}` }}>
                        <td style={{ padding: 8 }}>{s.dimension}</td>
                        <td style={{ padding: 8, color: s.score === null ? muted : green }}>{s.score ?? "Unknown"}</td>
                        <td style={{ padding: 8, lineHeight: 1.6, minWidth: 180 }}>
                          {s.reason}
                          <References ids={s.refs} sources={active.sources} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {active.result.review.findings.map((finding, i) => (
                <details key={i} open={i < 3} style={{ borderTop: `1px solid ${line}`, padding: "12px 0" }}>
                  <summary style={{ color: green, cursor: "pointer" }}>
                    {finding.topic}{" "}
                    <span style={{ color: muted, fontSize: 10 }}> / {statusLabels[finding.status]}</span>
                  </summary>
                  <p style={{ lineHeight: 1.75 }}>{finding.observation}</p>
                  <References ids={finding.refs} sources={active.sources} />
                  <p style={{ lineHeight: 1.7 }}>Next: {finding.nextStep}</p>
                </details>
              ))}
              <h3 style={{ color: green, fontSize: 13, marginTop: 24 }}>This week</h3>
              {active.result.review.recommendations.map((r, i) => (
                <div key={i} style={{ padding: "10px 0", borderTop: `1px solid ${line}`, lineHeight: 1.7 }}>
                  <strong>
                    {i + 1}. {r.action}
                  </strong>
                  <p>{r.thisWeek}</p>
                  <span style={{ color: amber }}>Track: {r.metric}</span>
                </div>
              ))}
              <h3 style={{ color: green, fontSize: 13, marginTop: 24 }}>First pilot</h3>
              <dl style={{ margin: 0 }}>
                {Object.entries(active.result.review.pilot).map(([key, value]) => (
                  <div key={key} style={{ borderTop: `1px solid ${line}`, padding: "10px 0" }}>
                    <dt style={{ color: muted, fontSize: 11 }}>
                      {
                        (
                          {
                            buyer: "Buyer",
                            offer: "Offer",
                            successMetric: "Success metric",
                            proposedThreshold: "Proposed threshold · test this",
                            thisWeek: "This week",
                            decision: "Decision rule",
                          } as Record<string, string>
                        )[key]
                      }
                    </dt>
                    <dd style={{ margin: "6px 0 0", lineHeight: 1.7 }}>{value}</dd>
                  </div>
                ))}
              </dl>
              <h3 style={{ color: green, fontSize: 13, marginTop: 24 }}>Value proposition</h3>
              <p style={{ lineHeight: 1.8 }}>{active.result.review.valueProp}</p>
              {!!active.result.review.questions.length && (
                <>
                  <h3 style={{ color: green, fontSize: 13 }}>To sharpen the next version</h3>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                    {active.result.review.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </>
              )}
              <p style={{ borderLeft: `2px solid ${green}`, padding: 12, lineHeight: 1.8 }}>
                Investor take: {active.result.review.investorTake}
              </p>
            </>
          )}
          {view === "changes" && active && (
            <>
              <h2 style={{ color: green, fontSize: 15 }}>
                — {active.result.changes.length ? comparisonVerdict(active.result.changes) : "Ready for a revision"}
              </h2>
              {!active.result.changes.length ? (
                <p style={{ lineHeight: 1.8 }}>
                  Return to Draft, edit your pitch, then select Compare revision. This version is saved as the baseline.
                </p>
              ) : (
                <>
                  <p style={{ lineHeight: 1.8 }}>{active.result.comparisonSummary}</p>
                  <p style={{ fontSize: 11, color: amber }}>
                    Change counts are calculated from the validated ledger. Classification is a model judgment; a new
                    claim is not automatically new evidence.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0" }}>
                    {Object.entries(CHANGE_LABELS).map(([kind, label]) => {
                      const count = active.result.changes.filter((c) => c.kind === kind).length
                      return count ? (
                        <span key={kind} style={{ border: `1px solid ${line}`, padding: "8px 10px", fontSize: 11 }}>
                          {label} <strong style={{ color: green }}>{count}</strong>
                        </span>
                      ) : null
                    })}
                  </div>
                  {active.result.changes.map((change, i) => (
                    <article key={i} style={{ borderTop: `1px solid ${line}`, padding: "18px 0" }}>
                      <div style={{ color: amber, fontSize: 10, marginBottom: 7 }}>
                        {CHANGE_LABELS[change.kind].toUpperCase()}
                      </div>
                      <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>{change.topic}</h3>
                      <div className="raf-comparison">
                        {(["before", "after"] as const).map((side) => (
                          <div key={side} style={{ padding: 12, background: "#0c1710", border: `1px solid ${line}` }}>
                            <div style={{ color: muted, fontSize: 10 }}>
                              {side.toUpperCase()} · {statusLabels[change[side].status]}
                            </div>
                            <p style={{ lineHeight: 1.75 }}>{change[side].statement}</p>
                            {change[side].quote && (
                              <blockquote
                                style={{
                                  margin: "10px 0",
                                  borderLeft: `2px solid ${line}`,
                                  paddingLeft: 10,
                                  fontSize: 12,
                                  lineHeight: 1.7,
                                }}
                              >
                                “{change[side].quote}”
                              </blockquote>
                            )}
                            <References ids={change[side].refs} sources={active.sources} />
                          </div>
                        ))}
                      </div>
                      <p style={{ lineHeight: 1.8 }}>{change.explanation}</p>
                      <p style={{ color: green, lineHeight: 1.7 }}>Next proof: {change.nextProof}</p>
                    </article>
                  ))}
                </>
              )}
            </>
          )}
          {view === "protocol" && (
            <>
              <h2 style={{ color: green, fontSize: 14 }}>— Review protocol / {RAF_RUBRIC}</h2>
              <p style={{ lineHeight: 1.8 }}>
                The model interprets the business. Code checks the review contract before displaying an answer. No
                overall “startup score” hides missing evidence.
              </p>
              <div className="raf-comparison">
                <section>
                  <h3 style={{ fontSize: 13, color: green }}>Enforced in code</h3>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
                    <li>Input size, PDF format and page limits.</li>
                    <li>Eight distinct score dimensions; unknown stays unknown.</li>
                    <li>Source IDs and before/after version boundaries.</li>
                    <li>Text quotations must match a supplied paragraph.</li>
                    <li>Forecasts and opinions cannot count as new evidence.</li>
                    <li>Repeated quotes cannot count as added support.</li>
                    <li>Change counts, summary verdict, and export records.</li>
                    <li>Server usage limits and cancellation.</li>
                  </ul>
                </section>
                <section>
                  <h3 style={{ fontSize: 13, color: amber }}>Still model judgments</h3>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
                    <li>Whether a claim is plausible or evidence is persuasive.</li>
                    <li>The evidence type and change classification.</li>
                    <li>Scores, recommendations, and proposed experiments.</li>
                    <li>Reading PDF pages, including quoted content.</li>
                  </ul>
                  <p style={{ color: muted, fontSize: 12, lineHeight: 1.8 }}>
                    Passing the contract is not proof of factual accuracy. Challenge a finding with a specific passage
                    or result. A repeatable answer can still be wrong.
                  </p>
                </section>
              </div>
              <h3 style={{ color: green, fontSize: 13 }}>Founder reference shelf</h3>
              <p style={{ lineHeight: 1.8 }}>
                Curated lessons from Raffi’s indify, Nameless, and Mallorca materials: test buyer behavior, distinguish
                plans from results, and define the next observable commitment. Private decks are not published or
                returned to visitors.
              </p>
              <p style={{ lineHeight: 1.9 }}>
                <a
                  style={{ color: green }}
                  href="https://www.ycombinator.com/blog/startup-school-week-1-recap-kevin-hale-and-eric-migicovsky/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  YC: customer interviews
                </a>
                <br />
                <a
                  style={{ color: green }}
                  href="https://www.reidhoffman.org/linkedin-pitch-to-greylock/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn: promises vs. execution
                </a>
                <br />
                <a
                  style={{ color: green }}
                  href="https://buffer.com/resources/the-slide-deck-we-used-to-raise-half-a-million-dollars/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buffer: founder-published fundraising deck
                </a>
                <br />
                <a
                  style={{ color: green }}
                  href="https://arxiv.org/abs/2601.15322"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Raffi’s research: repeatability and correctness
                </a>
              </p>
              <p style={{ color: muted, fontSize: 11, lineHeight: 1.8 }}>
                Historical examples are guidance, not evidence about your business or a guarantee of fundraising. RAF OS
                is independent of YC. Reviews use supplied materials and curated references; they do not perform live
                market research.
              </p>
              <h3 style={{ color: green, fontSize: 13 }}>Commands</h3>
              <p style={{ lineHeight: 2 }}>
                /analyze · /deck · /compare · /iterate · /pilot · /valueprop · /export · /clear · /help
              </p>
              <p style={{ color: muted, fontSize: 11 }}>
                Commands select app actions. They never execute a shell. Use the Draft fields for your pitch and
                revision context.
              </p>
            </>
          )}
        </div>
        <footer
          style={{
            borderTop: `1px solid ${line}`,
            background: "#112018",
            padding: "10px 14px",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {runs.length > 0 && (
            <>
              <select
                aria-label="Review version"
                value={active?.id ?? ""}
                style={{ ...control, maxWidth: 150, fontSize: 11 }}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {runs.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    Version {r.version ?? i + 1}
                    {r.result.changes.length ? " · compared" : ""}
                  </option>
                ))}
              </select>
              <button
                style={control}
                onClick={() => active && download(exportRun(active), "raf-os-review.md", "text/markdown")}
                aria-label="Export review as Markdown"
              >
                <Download size={14} />
              </button>
              <button style={{ ...control, fontSize: 11 }} onClick={() => void exportAudit()}>
                Export record
              </button>
            </>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const input = e.currentTarget.elements.namedItem("command") as HTMLInputElement
              command(input.value)
              input.value = ""
            }}
            style={{ flex: "1 1 120px", display: "flex", minWidth: 0 }}
          >
            <label htmlFor="raf-command" style={{ color: green, padding: "10px 7px 0 0" }}>
              &gt;
            </label>
            <input
              id="raf-command"
              name="command"
              aria-label="Terminal command"
              placeholder="/help"
              autoComplete="off"
              maxLength={40}
              style={{ ...field, minWidth: 0, padding: 8, height: 38 }}
            />
          </form>
          {busy && view !== "draft" && (
            <button onClick={cancel} style={{ ...control, color: amber }}>
              Cancel
            </button>
          )}
          <button style={{ ...control, fontSize: 11, color: muted }} onClick={() => setClearPending(true)}>
            Clear
          </button>
          {clearPending && (
            <div
              role="alert"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 11,
                color: amber,
              }}
            >
              Clear drafts, PDFs, and all saved versions from this tab?
              <button style={control} onClick={clear}>
                Clear session
              </button>
              <button style={control} onClick={() => setClearPending(false)}>
                Keep session
              </button>
            </div>
          )}
        </footer>
        <style jsx>{`
          .raf-comparison {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 12px;
          }
          .raf-terminal button:hover:not(:disabled) {
            filter: brightness(1.15);
          }
          .raf-terminal button:disabled {
            opacity: 0.5;
            cursor: default;
          }
          .raf-terminal :global(:focus-visible) {
            outline: 2px solid #a1e7a8;
            outline-offset: 3px;
          }
          @media (max-width: 600px) {
            .raf-comparison {
              grid-template-columns: minmax(0, 1fr);
            }
          }
          @media (max-height: 500px) {
            .raf-header {
              --raf-header-padding: 8px 14px;
            }
            .raf-tagline {
              display: none;
            }
          }
        `}</style>
      </div>
    </WindowShell>
  )
}
