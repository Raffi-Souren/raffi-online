"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowUpRight, Download, FileText, X } from "lucide-react"
import WindowShell, { useWindowActivity } from "../../components/ui/WindowShell"
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

const ink = "var(--raf-ink)",
  green = "var(--raf-green)",
  muted = "var(--raf-muted)",
  amber = "var(--raf-amber)",
  line = "var(--raf-line)"
const control: CSSProperties = {
  border: `1px solid ${line}`,
  borderRadius: 0,
  padding: "8px 11px",
  color: ink,
  background: "var(--raf-surface)",
  font: "inherit",
  fontSize: 14,
  minHeight: "var(--raf-control-height, 38px)",
  cursor: "pointer",
}
const field: CSSProperties = {
  width: "100%",
  background: "var(--raf-bg)",
  color: ink,
  border: `1px solid ${line}`,
  borderRadius: 0,
  padding: "10px 12px",
  font: "inherit",
  fontSize: 16,
  lineHeight: 1.6,
  caretColor: green,
  resize: "vertical",
}
const sample =
  "Fictional example (invented for exploration):\n\nWe help independent venues turn first-time ticket buyers into repeat visitors. Today their ticketing data and email lists are disconnected.\n\nWe interviewed six venue operators. Four described exporting spreadsheets after each event. We have not tested willingness to pay.\n\nOur idea is a weekly audience follow-up tool. We plan to charge $100 per venue per month. Our next step is a pilot with one venue."
const statusLabels = {
  unknown: "Unknown",
  founder_claim: "Founder claim",
  reported_evidence: "Reported evidence",
  supplied_document: "Supplied document",
}
type Props = { isOpen: boolean; isMinimized: boolean; onClose: () => void; onMinimize: () => void }
type View = "draft" | "review" | "changes" | "protocol" | "privacy"
type FollowUp = {
  kind: "challenge" | "revision"
  sourceVersion: number
  sourceRunId: string
  finding?: string
  question?: string
}
type SessionRun = SavedRun & { followUp?: FollowUp }
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

function reviewMarkdown(run: SessionRun) {
  return exportRun(run) + (run.followUp ? [
    "", "## Review conversation", "",
    `${run.followUp.kind === "challenge" ? "Rechecked" : "Revised"} from version ${run.followUp.sourceVersion}.`,
    ...(run.followUp.finding ? [`Finding: ${run.followUp.finding}`] : []),
    ...(run.followUp.question ? [`Your question: ${run.followUp.question}`] : []),
    "",
  ].join("\n") : "")
}

function References({ ids, sources }: { ids: string[]; sources: Source[] }) {
  if (!ids.length) return <span style={{ color: muted, fontSize: 12 }}>No source supplied</span>
  return (
    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {ids.map((id) => {
        const source = sources.find((entry) => entry.id === id)
        return (
          <details key={id} style={{ fontSize: 12, color: muted, maxWidth: "100%" }}>
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
  const { active: windowActive } = useWindowActivity()
  const [draft, setDraft] = useState("")
  const [deck, setDeck] = useState<Submission["deck"]>(null)
  const [previousDraft, setPreviousDraft] = useState("")
  const [previousDeck, setPreviousDeck] = useState<Submission["deck"]>(null)
  const [manualCompare, setManualCompare] = useState(false)
  const [baselineId, setBaselineId] = useState("")
  const [challenge, setChallenge] = useState("")
  const [runs, setRuns] = useState<SessionRun[]>([])
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
  const [challengeTarget, setChallengeTarget] = useState<{ run: SessionRun; topic: string; observation: string } | null>(null)
  const [reviewChallenge, setReviewChallenge] = useState("")
  const [showCommands, setShowCommands] = useState(false)
  const [focusTarget, setFocusTarget] = useState<"pitch" | "challenge" | "result" | null>(null)
  const [revealSection, setRevealSection] = useState<"pilot" | "valueprop" | null>(null)
  const [freshFocus, setFreshFocus] = useState<"pilot" | "valueprop" | null>(null)
  const request = useRef<AbortController | null>(null)
  const infoHistory = useRef<View[]>([])
  const fileEpoch = useRef(0)
  const sessionEpoch = useRef(0)
  const outputArea = useRef<HTMLDivElement>(null)
  const pitchField = useRef<HTMLTextAreaElement>(null)
  const commandField = useRef<HTMLInputElement>(null)
  const challengeField = useRef<HTMLTextAreaElement>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const fullReview = useRef<HTMLDetailsElement>(null)
  const pilotDetails = useRef<HTMLDetailsElement>(null)
  const valuePropDetails = useRef<HTMLDetailsElement>(null)
  const active = runs.find((run) => run.id === selectedId) ?? runs[runs.length - 1]
  const baseline = runs.find((run) => run.id === baselineId)
  const hasInput = !!draft.trim() || !!deck
  const hasBaseline = manualCompare ? !!previousDraft.trim() || !!previousDeck : !!baseline
  const readyToSend = hasInput && consent && !fileBusy

  useEffect(() => {
    if (!focusTarget || !isOpen || isMinimized || !windowActive) return
    const target = focusTarget === "pitch" ? pitchField.current : focusTarget === "challenge" ? challengeField.current : resultHeading.current
    if (target) {
      const frame = requestAnimationFrame(() => {
        target.focus()
        setFocusTarget(null)
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [focusTarget, view, selectedId, challengeTarget, isOpen, isMinimized, windowActive])

  useEffect(() => {
    if (!revealSection || view !== "review" || !isOpen || isMinimized || !windowActive) return
    const section = revealSection === "pilot" ? pilotDetails.current : valuePropDetails.current
    if (!fullReview.current || !section) return
    fullReview.current.open = true
    section.open = true
    const frame = requestAnimationFrame(() => {
      section.querySelector("summary")?.focus()
      section.scrollIntoView({ block: "start" })
      setRevealSection(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [revealSection, view, selectedId, isOpen, isMinimized, windowActive])

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
      sessionEpoch.current++
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
    sessionEpoch.current++
    setFileBusy(false)
    setRuns([])
    setSelectedId("")
    setBaselineId("")
    setDraft("")
    setPreviousDraft("")
    setDeck(null)
    setPreviousDeck(null)
    setChallenge("")
    setReviewChallenge("")
    setChallengeTarget(null)
    setShowCommands(false)
    setFreshFocus(null)
    setRevealSection(null)
    setManualCompare(false)
    setConsent(false)
    setProvider("auto")
    setError("")
    setNotice("Session cleared.")
    setView("draft")
    setClearPending(false)
    setFocusTarget("pitch")
    infoHistory.current = []
    if (commandField.current) commandField.current.value = ""
  }

  function revise(runToRevise = active) {
    if (!runToRevise || busy) return
    // Keep work in progress when opening a saved review; only replace a pristine editor.
    const editorIsSaved = !hasInput || runs.some((saved) =>
      saved.submission.text === draft.trim() && saved.submission.deck?.data === deck?.data,
    )
    if (editorIsSaved) {
      setDraft(runToRevise.submission.text)
      setDeck(runToRevise.submission.deck)
    }
    setBaselineId(runToRevise.id)
    setManualCompare(false)
    setFreshFocus(null)
    setChallenge(runToRevise.followUp?.question ?? "")
    setView("draft")
    setFocusTarget("pitch")
    setNotice(`Version ${runToRevise.version} is your comparison baseline. ${editorIsSaved ? "Edit the pitch below, then compare what changed." : "Your in-progress edits are preserved below."}`)
  }

  function showResultSection(section: "pilot" | "valueprop") {
    const matchesDraft = (saved: SessionRun) => saved.submission.text === draft.trim() && saved.submission.deck?.data === deck?.data
    const matching = active && matchesDraft(active) ? active : [...runs].reverse().find(matchesDraft)
    if (matching) {
      setSelectedId(matching.id)
      setView("review")
      setRevealSection(section)
      setNotice("")
    } else {
      setFreshFocus(section)
      setView("draft")
      setNotice(`This pitch needs a fresh review. Analyze pitch will send it for a review focused on ${section === "pilot" ? "the pilot" : "the value proposition"}.`)
    }
  }

  function backFromInfo() {
    setView(infoHistory.current.pop() ?? "draft")
  }

  function showInfo(next: "protocol" | "privacy") {
    infoHistory.current = view === "protocol" || view === "privacy" ? [...infoHistory.current, view] : [view]
    setView(next)
  }

  function showHelp() {
    if (view === "protocol") backFromInfo()
    else showInfo("protocol")
  }

  function challengeFinding(finding = active?.result.review.findings[0]) {
    if (!active || !finding || busy) return
    setChallengeTarget({ run: active, topic: finding.topic, observation: finding.observation })
    setReviewChallenge("")
    setFocusTarget("challenge")
  }

  async function run(action: RunRequest["action"], followUp?: { submission: Submission; context: string; record: FollowUp }) {
    if (request.current || fileBusy) return
    setNotice("")
    setError("")
    if (!followUp && !hasInput) {
      setError("Paste your idea or attach a PDF to start.")
      return
    }
    if (!consent) {
      setError("Allow the selected provider to review your material before sending it.")
      setView("draft")
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
    const submission = followUp?.submission ?? { text: draft.trim(), deck }
    try {
      const response = await fetch("/api/raf-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          current: submission,
          previous: previous ?? null,
          challenge: followUp?.context ?? challenge.trim(),
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
      const saved: SessionRun = {
        ...output,
        id: crypto.randomUUID(),
        version: (runs[runs.length - 1]?.version ?? runs.length) + 1,
        submission,
        baselineId: previous && !manualCompare ? baselineId : null,
        followUp: followUp?.record ?? (action === "compare" && baseline && !manualCompare ? {
          kind: "revision",
          sourceRunId: baseline.id,
          sourceVersion: baseline.version ?? 1,
          finding: baseline.followUp?.finding,
          question: challenge.trim() || baseline.followUp?.question,
        } : undefined),
      }
      setRuns((old) => [...old.slice(-5), saved])
      setSelectedId(saved.id)
      setBaselineId(saved.id)
      setView(action === "compare" ? "changes" : "review")
      setChallengeTarget(null)
      setReviewChallenge("")
      setFocusTarget(action === "pilot" || action === "valueprop" ? null : "result")
      setRevealSection(action === "pilot" || action === "valueprop" ? action : null)
      setFreshFocus(null)
      setNotice("")
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
      "/help": showHelp,
      "/analyze": () => void run("analyze"),
      "/deck": () => {
        setView("draft")
        setNotice("Attach a PDF using the deck control.")
      },
      "/compare": () => void run("compare"),
      "/iterate": () => {
        if (active) revise()
        else setView("draft")
      },
      "/pilot": () => showResultSection("pilot"),
      "/valueprop": () => showResultSection("valueprop"),
      "/export": () => {
        if (active) download(reviewMarkdown(active), "raf-os-review.md", "text/markdown")
      },
      "/clear": () => setClearPending(true),
    }
    const execute = commands[value.trim().toLowerCase()]
    if (execute) execute()
    else setNotice("Unknown command. Use /help to see the available actions.")
  }

  async function exportAudit() {
    if (!active) return
    const epoch = sessionEpoch.current
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(active.submission))
      const digest = await crypto.subtle.digest("SHA-256", bytes)
      if (epoch !== sessionEpoch.current) return
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
      if (epoch === sessionEpoch.current) setError("Could not export the record. Try the Markdown export.")
    }
  }

  const upload = (previous = false) => (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      <label className="raf-file-action" style={{ ...control, position: "relative", display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
        <FileText size={14} />
        <span>{previous ? "Earlier PDF" : "Attach PDF"}</span>
        <input
          aria-label={previous ? "Upload earlier deck" : "Upload pitch deck"}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy || fileBusy}
          title="PDF, up to 1 MB and 24 pages"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
          onChange={(event) => {
            void chooseFile(event.target.files?.[0], previous)
            event.target.value = ""
          }}
        />
      </label>
      {(previous ? previousDeck : deck) && (
        <span style={{ fontSize: 12, overflowWrap: "anywhere" }}>
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

  const challengeComposer = () => active && challengeTarget?.run.id === active.id && (
    <div style={{ margin: "20px 0" }}>
      {challengeTarget?.run.id === active.id && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const question = reviewChallenge.trim()
            if (!question || !challengeTarget) return
            void run("analyze", {
              submission: challengeTarget.run.submission,
              context: `Recheck a finding from version ${challengeTarget.run.version}.\nFinding: ${challengeTarget.topic.slice(0, 200)}\nEarlier observation: ${challengeTarget.observation.slice(0, 600)}\nUser challenge: ${question}`.slice(0, 2000),
              record: {
                kind: "challenge",
                sourceRunId: challengeTarget.run.id,
                sourceVersion: challengeTarget.run.version ?? 1,
                finding: challengeTarget.topic,
                question,
              },
            })
          }}
          style={{ marginTop: 18, borderLeft: `2px solid ${line}`, padding: "8px 14px" }}
        >
          <h3 style={{ fontSize: 15, color: green, margin: "0 0 8px" }}>Recheck: {challengeTarget.topic}</h3>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.7 }}>{challengeTarget.observation}</p>
          <label htmlFor="raf-follow-up" style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
            What should the review reconsider?
          </label>
          <textarea
            id="raf-follow-up"
            autoComplete="off"
            ref={challengeField}
            rows={3}
            maxLength={1000}
            value={reviewChallenge}
            disabled={busy}
            onChange={(event) => setReviewChallenge(event.target.value)}
            placeholder="Point to a passage, page, or assumption the review missed."
            style={field}
          />
          <p style={{ fontSize: 12, color: muted, margin: "8px 0 12px" }}>
            This sends your question and version {challengeTarget.run.version}&apos;s original pitch to the selected provider.
            Add new results to the pitch when you revise it so they can be cited in the comparison.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" disabled={busy || !reviewChallenge.trim()} style={{ ...control, color: green }}>
              Recheck this finding
            </button>
            <button type="button" disabled={busy} onClick={() => setChallengeTarget(null)} style={control}>
              Keep this review
            </button>
          </div>
        </form>
      )}
    </div>
  )

  const reviewRecord = () => active && (
            <details style={{ border: `1px solid ${line}`, padding: 10, marginBottom: 16, fontSize: 12, color: muted }}>
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
              <button style={{ ...control, fontSize: 12 }} onClick={() => void exportAudit()}>
                Export evidence record (JSON)
              </button>
            </details>
  )

  return (
    <WindowShell
      appearance="terminal"
      title="RAF OS TERMINAL"
      onClose={onClose}
      onMinimize={onMinimize}
      hidden={!isOpen || isMinimized}
      fullBleed
      initialFocusRef={pitchField}
      className="raf-window"
      maxWidth="840px"
      compact
    >
      <div
        className="raf-terminal"
        style={{
          height: "var(--raf-height, auto)",
          maxHeight: "calc(100dvh - 88px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          background: "var(--raf-bg)",
          color: ink,
          fontFamily: '"IBM Plex Mono", Menlo, Monaco, Consolas, monospace',
          fontSize: 16,
          lineHeight: 1.6,
          colorScheme: "dark",
        }}
      >
        <header className="raf-header" style={{ padding: "var(--raf-header-padding, 18px 24px 12px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h1 style={{ color: green, fontSize: 17, fontWeight: 600, margin: 0 }}>VENTURE REVIEW</h1>
            <button onClick={view === "privacy" ? backFromInfo : showHelp} style={{ ...control, border: 0, background: "transparent", color: muted, fontSize: 12 }}>
              {view === "protocol" || view === "privacy" ? "Back" : "Help"}
            </button>
          </div>
          {view === "draft" && <p style={{ color: muted, fontSize: 15, margin: "4px 0 0" }}>Paste your pitch. Find the next thing to test.</p>}
          {active && view === "draft" && <button onClick={() => setView("review")} style={{ ...control, border: 0, padding: "8px 0 0", background: "transparent", color: muted, fontSize: 12 }}>Back to review</button>}
          {active && view === "review" && active.result.changes.length > 0 && <button onClick={() => setView("changes")} style={{ ...control, border: 0, padding: "8px 0 0", background: "transparent", color: muted, fontSize: 12 }}>View comparison</button>}
          {view === "changes" && <button onClick={() => setView("review")} style={{ ...control, border: 0, padding: "8px 0 0", background: "transparent", color: muted, fontSize: 12 }}>Read revised review</button>}
        </header>
        <div
          ref={outputArea}
          className="raf-output"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "var(--raf-output-padding, 8px 24px 18px)",
            overflowWrap: "anywhere",
            scrollbarColor: `${line} #101d15`,
          }}
        >
          <div style={{ width: "100%", maxWidth: "78ch", margin: "0 auto" }}>
          {(busy || fileBusy || notice || available === false) && <div
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              gap: 10,
              color: busy ? green : muted,
              fontSize: 12,
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: `1px dashed ${line}`,
            }}
          >
            <span>
              {busy
                ? "Reviewing supplied material… You can cancel this request."
                : fileBusy
                  ? "Reading your PDF…"
                  : notice ||
                    (available === false
                      ? "Live analysis is temporarily unavailable. Your draft stays here; find the GPT version in Help."
                      : "")}
            </span>
          </div>}
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
              {baseline && !manualCompare && (
                <div style={{ borderLeft: `2px solid ${line}`, padding: "6px 12px", marginBottom: 14, fontSize: 13, color: muted }}>
                  Comparing with version {baseline.version}.
                  {baseline.followUp?.question && <p style={{ margin: "6px 0 0" }}>Your earlier challenge: {baseline.followUp.question}</p>}
                </div>
              )}
              <label htmlFor="raf-pitch" style={{ display: "block", marginBottom: 8, fontSize: 15 }}>Your pitch</label>
              <textarea
                id="raf-pitch"
                ref={pitchField}
                autoComplete="off"
                value={draft}
                maxLength={16000}
                rows={5}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                style={field}
                placeholder="Who needs this, what have you tested, and what comes next?"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {upload()}
                <button
                  disabled={busy}
                  style={{ ...control, border: 0, background: "transparent", color: muted, fontSize: 13, marginTop: 8 }}
                  onClick={() => {
                    if (!draft.trim() && !deck) {
                      setDraft(sample)
                      setNotice("Fictional example loaded. Nothing has been sent.")
                    } else setNotice("Your pitch is preserved. Clear it first to load the fictional example.")
                  }}
                >
                  Try an example
                </button>
                {draft.length > 0 && <span style={{ fontSize: 11, color: muted, marginLeft: "auto" }}>{draft.length.toLocaleString()} / 16,000</span>}
              </div>
              {deck && <p style={{ fontSize: 12, color: muted, margin: "6px 0" }}>PDF: up to 1 MB and 24 pages. Image pages are read by the model.</p>}
              <label style={{ display: "flex", gap: 9, alignItems: "flex-start", margin: "16px 0 6px", fontSize: 13, color: muted, lineHeight: 1.6 }}>
                <input
                  id="raf-consent"
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(event) => setConsent(event.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  Use {provider === "auto" ? "OpenAI or Google Gemini" : provider === "gemini" ? "Google Gemini" : "OpenAI"} to review my submission.
                </span>
              </label>
              <p style={{ color: muted, fontSize: 12, margin: "0 0 16px 22px" }}>
                Encrypted in transit. This site doesn’t store your pitch. <button onClick={() => showInfo("privacy")} style={{ border: 0, padding: 0, color: green, background: "transparent", font: "inherit", textDecoration: "underline", cursor: "pointer" }}>Privacy</button>
              </p>
              {busy ? (
                <button onClick={cancel} style={{ ...control, borderColor: amber, color: amber }}>Cancel request</button>
              ) : (
                <button
                  disabled={!readyToSend}
                  onClick={() => void run(freshFocus ?? (hasBaseline ? "compare" : "analyze"))}
                  style={{ ...control, color: "#102217", background: green, borderColor: green, fontWeight: 700 }}
                >
                  {hasBaseline && !freshFocus ? "Compare revision" : "Analyze pitch"}
                </button>
              )}
              <details style={{ borderTop: `1px solid ${line}`, paddingTop: 12, marginTop: 18 }}>
                <summary style={{ cursor: "pointer", color: muted, fontSize: 13 }}>Options</summary>
                <label
                  htmlFor="raf-challenge"
                  style={{ display: "block", color: muted, fontSize: 14, marginTop: 18, marginBottom: 7 }}
                >
                  Anything the next review should pay attention to?
                </label>
                <textarea
                  id="raf-challenge"
                  autoComplete="off"
                  value={challenge}
                  maxLength={2000}
                  rows={2}
                  disabled={busy}
                  onChange={(e) => setChallenge(e.target.value)}
                  style={field}
                  placeholder="e.g. The pilot was paid; review the invoice on page 8."
                />
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                  <label htmlFor="raf-provider" style={{ color: muted, fontSize: 14 }}>
                    Provider
                  </label>
                  <select
                    id="raf-provider"
                    value={provider}
                    disabled={busy || fileBusy}
                    onChange={(event) => {
                      setProvider(event.target.value as ProviderChoice)
                      setConsent(false)
                    }}
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
                <p id="raf-provider-help" style={{ color: muted, fontSize: 12, lineHeight: 1.6, margin: "8px 0 0" }}>
                  Auto uses OpenAI when configured, otherwise Gemini, with one backup attempt during a temporary
                  provider outage. A manual choice stays on that provider.
                </p>
                <details style={{ borderTop: `1px solid ${line}`, paddingTop: 12, marginTop: 18 }}>
                  <summary style={{ cursor: "pointer", color: green, fontSize: 14 }}>{hasBaseline ? "Change comparison baseline" : "Compare two drafts"}</summary>
                <div style={{ paddingTop: 12 }}>
                  {runs.length > 0 && (
                    <label style={{ display: "block", fontSize: 14 }}>
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
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
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
                        autoComplete="off"
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
                {hasBaseline && <button disabled={busy || !readyToSend} onClick={() => void run("analyze")} style={{ ...control, marginTop: 16, fontSize: 13 }}>Analyze without comparison</button>}
              </details>
            </>
          )}
          {view === "review" && active && (
            <>
              <h2 className="raf-result-heading" ref={resultHeading} tabIndex={-1} style={{ fontSize: 20, color: green, margin: "4px 0 14px" }}>
                The take
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.75, margin: "0 0 18px" }}>{active.result.review.snapshot}</p>
              {active.followUp && (
                <div style={{ borderLeft: `2px solid ${line}`, padding: "8px 12px", marginBottom: 18, fontSize: 14, color: muted }}>
                  <p style={{ margin: 0 }}>
                    {active.followUp.kind === "challenge" ? "Rechecked" : "Revised"} from version {active.followUp.sourceVersion}
                    {active.followUp.finding ? `: ${active.followUp.finding}` : "."}
                  </p>
                  {active.followUp.question && <p style={{ margin: "8px 0 0" }}>You asked: {active.followUp.question}</p>}
                </div>
              )}
              <section style={{ borderTop: `1px solid ${line}`, paddingTop: 16 }}>
                <h3 style={{ color: green, fontSize: 15, margin: "0 0 12px" }}>Key findings</h3>
                {active.result.review.findings.slice(0, 2).map((finding) => (
                  <article key={finding.topic} style={{ marginBottom: 20 }}>
                    <h4 style={{ fontSize: 15, margin: "0 0 6px" }}>{finding.topic}</h4>
                    <p style={{ margin: "0 0 8px", fontSize: 15, lineHeight: 1.75 }}>{finding.observation}</p>
                    <span style={{ color: muted, fontSize: 12 }}>{statusLabels[finding.status]}</span>
                    <References ids={finding.refs} sources={active.sources} />
                    <button disabled={busy} onClick={() => challengeFinding(finding)} style={{ ...control, padding: "4px 0", border: 0, background: "transparent", color: muted, fontSize: 12 }}>
                      Challenge this finding
                    </button>
                  </article>
                ))}
              </section>
              <section style={{ borderLeft: `2px solid ${green}`, padding: "10px 14px", margin: "22px 0" }}>
                <h3 style={{ color: green, fontSize: 15, margin: "0 0 8px" }}>Next test</h3>
                <strong style={{ fontSize: 15 }}>{active.result.review.recommendations[0].action}</strong>
                <p style={{ margin: "8px 0", lineHeight: 1.75 }}>{active.result.review.recommendations[0].thisWeek}</p>
                <p style={{ color: amber, fontSize: 14, margin: 0 }}>Measure: {active.result.review.recommendations[0].metric}</p>
              </section>
              {challengeComposer()}
              <p style={{ color: muted, fontSize: 12, margin: "18px 0" }}>
                This review uses your supplied material. Evidence is not independently verified; missing information stays unknown.
              </p>
              <details ref={fullReview} style={{ borderTop: `1px solid ${line}`, padding: "14px 0" }}>
                <summary style={{ color: green, cursor: "pointer" }}>Full review</summary>
              <details style={{ borderTop: `1px solid ${line}`, padding: "14px 0" }}>
                <summary style={{ color: green, cursor: "pointer" }}>All findings and next steps</summary>
                {active.result.review.findings.map((finding, i) => (
                  <article key={i} style={{ borderTop: `1px solid ${line}`, padding: "16px 0", marginTop: i === 0 ? 14 : 0 }}>
                    <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>{finding.topic}</h3>
                    <span style={{ color: muted, fontSize: 12 }}>{statusLabels[finding.status]}</span>
                    <p style={{ lineHeight: 1.75 }}>{finding.observation}</p>
                    <References ids={finding.refs} sources={active.sources} />
                    <p style={{ lineHeight: 1.7 }}>Next test: {finding.nextStep}</p>
                    <button disabled={busy} onClick={() => challengeFinding(finding)} style={{ ...control, fontSize: 13 }}>
                      Challenge this finding
                    </button>
                  </article>
                ))}
              </details>
              <details style={{ borderTop: `1px solid ${line}`, padding: "14px 0" }}>
                <summary style={{ color: green, cursor: "pointer" }}>See the eight-part evidence scorecard</summary>
                <p style={{ color: muted, fontSize: 12 }}>Scores assess this submission. Unknown means missing information, not zero.</p>
              <div style={{ overflowX: "auto", margin: "12px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead style={{ color: muted, background: "#0c1811" }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8 }}>Dimension</th>
                      <th style={{ textAlign: "left", padding: 8 }}>0–5</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.result.review.scorecard.map((s) => (
                      <tr key={s.dimension} style={{ borderTop: `1px solid ${line}` }}>
                        <td style={{ padding: 8, verticalAlign: "top" }}>{s.dimension}</td>
                        <td
                          style={{
                            padding: 8,
                            color: s.score === null ? muted : green,
                            verticalAlign: "top",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {s.score ?? "Unknown"}
                        </td>
                        <td style={{ padding: 8, lineHeight: 1.6, minWidth: 180, verticalAlign: "top" }}>
                          {s.reason}
                          <References ids={s.refs} sources={active.sources} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </details>
              <details style={{ borderTop: `1px solid ${line}`, padding: "14px 0" }}>
                <summary style={{ color: green, cursor: "pointer" }}>Plan the rest of this week</summary>
                {active.result.review.recommendations.slice(1).map((r, i) => (
                  <div key={i} style={{ padding: "16px 0", lineHeight: 1.7 }}>
                    <strong>{r.action}</strong>
                    <p>{r.thisWeek}</p>
                    <span style={{ color: amber }}>Measure: {r.metric}</span>
                  </div>
                ))}
              </details>
              <details ref={pilotDetails} style={{ borderTop: `1px solid ${line}`, padding: "14px 0" }}>
                <summary style={{ color: green, cursor: "pointer" }}>Pilot plan</summary>
              <dl style={{ margin: 0 }}>
                {Object.entries(active.result.review.pilot).map(([key, value]) => (
                  <div key={key} style={{ borderTop: `1px solid ${line}`, padding: "10px 0" }}>
                    <dt style={{ color: muted, fontSize: 12 }}>
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
              </details>
              <details ref={valuePropDetails} style={{ borderTop: `1px solid ${line}`, padding: "14px 0" }}>
                <summary style={{ color: green, cursor: "pointer" }}>Value proposition</summary>
                <p style={{ lineHeight: 1.8 }}>{active.result.review.valueProp}</p>
              </details>
              <details style={{ borderTop: `1px solid ${line}`, padding: "14px 0" }}>
                <summary style={{ color: green, cursor: "pointer" }}>Open questions and investor perspective</summary>
                <p style={{ lineHeight: 1.8 }}>{active.result.review.investorTake}</p>
                {!!active.result.review.questions.length && (
                  <>
                    <h3 style={{ color: green, fontSize: 15 }}>Questions for your next version</h3>
                    <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                      {active.result.review.questions.map((q) => <li key={q}>{q}</li>)}
                    </ul>
                  </>
                )}
              </details>
              {reviewRecord()}
              </details>
            </>
          )}
          {view === "changes" && active && (
            <>
              <h2 className="raf-result-heading" ref={resultHeading} tabIndex={-1} style={{ color: green, fontSize: 20, margin: "4px 0 14px" }}>
                {active.result.changes.length ? comparisonVerdict(active.result.changes) : "Ready for a revision"}
              </h2>
              {!active.result.changes.length ? (
                <>
                  <p style={{ lineHeight: 1.8 }}>
                    Version {active.version} is saved. Revise the pitch to see whether your next version adds evidence or changes the wording.
                  </p>
                  {challengeComposer()}
                </>
              ) : (
                <>
                  <p style={{ color: muted, fontSize: 13 }}>
                    {active.followUp ? `Version ${active.followUp.sourceVersion}` : "Earlier pitch"} compared with version {active.version}.
                    {active.followUp?.question && ` Your earlier challenge: ${active.followUp.question}`}
                  </p>
                  <p style={{ lineHeight: 1.8 }}>{active.result.comparisonSummary}</p>
                  <p style={{ lineHeight: 1.8 }}>
                    Added support: <strong style={{ color: green }}>{active.result.changes.filter((c) => c.kind === "support_added").length}</strong>.
                    {" "}Wording changes: <strong>{active.result.changes.filter((c) => c.kind === "wording_only").length}</strong>.
                    {" "}New claims without proof: <strong>{active.result.changes.filter((c) => c.kind === "unsupported_claim").length}</strong>.
                  </p>
                  <p style={{ fontSize: 12, color: amber }}>
                    Change counts are calculated from the validated ledger. Classification is a model judgment; a new
                    claim is not automatically new evidence.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
                    {Object.entries(CHANGE_LABELS).map(([kind, label]) => {
                      const count = active.result.changes.filter((c) => c.kind === kind).length
                      return count ? (
                        <span key={kind} style={{ border: `1px solid ${line}`, padding: "8px 10px", fontSize: 12 }}>
                          {label} <strong style={{ color: green }}>{count}</strong>
                        </span>
                      ) : null
                    })}
                  </div>
                  {challengeComposer()}
                  <h3 style={{ fontSize: 15, color: green, margin: "24px 0 10px" }}>What changed, with sources</h3>
                  {active.result.changes.map((change, i) => (
                    <details key={i} style={{ borderTop: `1px solid ${line}`, padding: "16px 0" }}>
                      <summary style={{ fontSize: 15, cursor: "pointer", color: green }}>
                        {change.topic} <span style={{ color: amber, fontSize: 12 }}> / {CHANGE_LABELS[change.kind]}</span>
                      </summary>
                      <div className="raf-comparison" style={{ marginTop: 14 }}>
                        {(["before", "after"] as const).map((side) => (
                          <div key={side} style={{ padding: 12, background: "#0c1710", border: `1px solid ${line}` }}>
                            <div style={{ color: muted, fontSize: 11 }}>
                              {side === "before" ? "Earlier pitch" : "Revised pitch"} · {statusLabels[change[side].status]}
                            </div>
                            <p style={{ lineHeight: 1.75 }}>{change[side].statement}</p>
                            {change[side].quote && (
                              <blockquote
                                style={{
                                  margin: "10px 0",
                                  borderLeft: `2px solid ${line}`,
                                  paddingLeft: 10,
                                  fontSize: 14,
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
                      <p style={{ color: green, lineHeight: 1.7 }}>Next evidence to collect: {change.nextProof}</p>
                    </details>
                  ))}
                  <section style={{ borderTop: `1px solid ${line}`, padding: "16px 0" }}>
                    <h3 style={{ fontSize: 15, color: green, margin: "0 0 10px" }}>What is still unknown</h3>
                    {active.result.review.findings.some((finding) => finding.status === "unknown") ? active.result.review.findings.filter((finding) => finding.status === "unknown").map((finding) => (
                      <details key={finding.topic} style={{ padding: "8px 0" }}>
                        <summary style={{ cursor: "pointer" }}>{finding.topic}</summary>
                        <p>{finding.observation}</p>
                        <p style={{ color: muted }}>Next test: {finding.nextStep}</p>
                        <References ids={finding.refs} sources={active.sources} />
                      </details>
                    )) : <p style={{ color: muted, fontSize: 13 }}>The model marked no findings as unknown. That does not independently verify the supplied evidence.</p>}
                  </section>
                </>
              )}
            </>
          )}
          {view === "privacy" && (
            <section style={{ fontSize: 14, lineHeight: 1.8 }}>
              <h2 style={{ color: green, fontSize: 20, marginTop: 0 }}>Privacy</h2>
              <p>This review doesn’t send Raffi a copy or add your pitch to an inbox. You decide what to export or share separately.</p>
              <details open style={{ borderTop: `1px solid ${line}`, paddingTop: 12, marginTop: 16 }}>
                <summary style={{ color: green, cursor: "pointer" }}>Your session</summary>
                <p style={{ color: muted }}>Drafts, PDFs, questions, comparison baselines and the latest six reviews stay in this tab’s memory. Clear session or reload removes this app session and cancels pending reviews. Minimizing or pressing the red close button preserves the session. Exported files remain on your device.</p>
              </details>
              <details style={{ borderTop: `1px solid ${line}`, paddingTop: 12, marginTop: 16 }}>
                <summary style={{ color: green, cursor: "pointer" }}>Processing and site data</summary>
                <p style={{ color: muted }}>Your submission includes the pitch, PDFs, earlier versions and review questions you send. The server and selected AI provider process readable content. HTTPS encrypts it in transit; this is not end-to-end encryption that hides it from the server or provider.</p>
                <p style={{ color: muted }}>Auto may use another configured provider as a backup during an outage. A manual choice stays on that provider.</p>
                <p style={{ color: muted }}>The app does not write pitch content or review responses to application logs, databases or files. Rate limits retain pseudonymous identifiers and timestamps, without pitch content.</p>
              </details>
              <details style={{ borderTop: `1px solid ${line}`, paddingTop: 12, marginTop: 16 }}>
                <summary style={{ color: green, cursor: "pointer" }}>AI provider terms</summary>
                <p style={{ color: muted }}>OpenAI API content is not used to train its models unless data sharing is enabled. Gemini’s protection against general model training depends on paid billing for this API project; free-tier terms may allow training and human review. Optional provider data sharing can change these terms.</p>
                <p style={{ color: muted }}>The app asks providers not to save response records. Providers may retain content for abuse monitoring: normally up to 30 days for OpenAI and 55 days for Google. Their terms describe exceptions and approved controls. This app does not promise zero provider retention.</p>
                <p style={{ color: muted, fontSize: 12 }}>
                  <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener noreferrer" style={{ color: green }}>OpenAI data controls</a>{" · "}
                  <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" style={{ color: green }}>Gemini terms</a>{" · "}
                  <a href="https://ai.google.dev/gemini-api/docs/usage-policies" target="_blank" rel="noopener noreferrer" style={{ color: green }}>Google abuse monitoring</a>
                </p>
              </details>
            </section>
          )}
          {view === "protocol" && (
            <>
              <h2 style={{ color: green, fontSize: 20 }}>How the review works</h2>
              <p style={{ color: muted, fontSize: 13 }}><button onClick={() => showInfo("privacy")} style={{ ...control, border: 0, padding: 0, background: "transparent", color: green, fontSize: 13, textDecoration: "underline" }}>Privacy</button> explains provider processing, session memory and clearing your work.</p>
              <a href={GPT_BACKUP} target="_blank" rel="noopener noreferrer" style={{ color: green, fontSize: 13, display: "inline-flex", gap: 5, alignItems: "center", marginBottom: 12 }}>Open the GPT version <ArrowUpRight size={13} /></a>
              <p style={{ color: muted, fontSize: 12, marginTop: 0 }}>Opens ChatGPT with its own data settings; this session isn’t transferred.</p>
              <p style={{ lineHeight: 1.8 }}>
                The model interprets the business. Code checks the review contract before displaying an answer. No
                overall “startup score” hides missing evidence.
              </p>
              <p style={{ color: muted, fontSize: 13 }}>The latest six reviews stay in this tab. Closing the window preserves the session; refreshing clears it. Export anything you want to keep. Review rubric: {RAF_RUBRIC}.</p>
              <div className="raf-comparison">
                <section>
                  <h3 style={{ fontSize: 16, color: green }}>Enforced in code</h3>
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
                  <h3 style={{ fontSize: 16, color: amber }}>Still model judgments</h3>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
                    <li>Whether a claim is plausible or evidence is persuasive.</li>
                    <li>The evidence type and change classification.</li>
                    <li>Scores, recommendations, and proposed experiments.</li>
                    <li>Reading PDF pages, including quoted content.</li>
                  </ul>
                  <p style={{ color: muted, fontSize: 14, lineHeight: 1.8 }}>
                    Passing the contract is not proof of factual accuracy. Challenge a finding with a specific passage
                    or result. A repeatable answer can still be wrong.
                  </p>
                </section>
              </div>
              <h3 style={{ color: green, fontSize: 16 }}>Founder reference shelf</h3>
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
              <p style={{ color: muted, fontSize: 12, lineHeight: 1.8 }}>
                Historical examples are guidance, not evidence about your business or a guarantee of fundraising. RAF OS
                is independent of YC. Reviews use supplied materials and curated references; they do not perform live
                market research.
              </p>
              <h3 style={{ color: green, fontSize: 16 }}>Commands</h3>
              <p style={{ lineHeight: 2 }}>
                /analyze · /deck · /compare · /iterate · /pilot · /valueprop · /export · /clear · /help
              </p>
              <p style={{ color: muted, fontSize: 12 }}>
                Commands select app actions. They never execute a shell. Use the Draft fields for your pitch and
                revision context.
              </p>
              <p style={{ color: muted, fontSize: 12 }}>For a matching saved pitch, /pilot and /valueprop open the existing review without a new request. If the draft changed, you will be offered a fresh review before anything is sent.</p>
            </>
          )}
          {(view === "changes" || view === "protocol") && reviewRecord()}
          </div>
        </div>
        <footer
          style={{
            borderTop: `1px solid ${line}`,
            background: "#0c1710",
            padding: "4px 14px",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {runs.length > 0 && (
            <>
              {(view === "review" || view === "changes") && <button disabled={busy} onClick={() => revise()} style={{ ...control, background: green, borderColor: green, color: "#102217", fontWeight: 700 }}>Revise pitch</button>}
              <button
                style={control}
                onClick={() => active && download(reviewMarkdown(active), "raf-os-review.md", "text/markdown")}
                aria-label="Export review as Markdown"
              >
                <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><Download size={14} /> Export review</span>
              </button>
              {runs.length > 1 ? <select
                aria-label="Review version"
                disabled={busy}
                value={active?.id ?? ""}
                style={{ ...control, maxWidth: 150, fontSize: 12 }}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {runs.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    Version {r.version ?? i + 1}
                    {r.result.changes.length ? " · compared" : ""}
                  </option>
                ))}
              </select> : <span style={{ color: muted, fontSize: 12 }}>Version 1</span>}
            </>
          )}
          {(!active || showCommands) && <form
            className="raf-command-line"
            onSubmit={(e) => {
              e.preventDefault()
              const input = e.currentTarget.elements.namedItem("command") as HTMLInputElement
              command(input.value)
              input.value = ""
            }}
            style={{
              flex: "1 1 240px",
              display: "flex",
              alignItems: "center",
              minWidth: 0,
              minHeight: 40,
              padding: "0 10px",
              border: `1px solid var(--raf-command-border, ${line})`,
              borderRadius: 0,
              background: "#09130d",
            }}
          >
            <label htmlFor="raf-command" style={{ color: green, paddingRight: 10, fontSize: 14, whiteSpace: "nowrap" }}>
              raf&gt;
            </label>
            <input
              id="raf-command"
              ref={commandField}
              name="command"
              aria-label="Terminal command"
              placeholder="/help"
              autoComplete="off"
              maxLength={40}
              style={{ ...field, minWidth: 0, padding: "8px 0", height: 38, border: 0, background: "transparent" }}
            />
          </form>}
          {active && <button
            aria-expanded={showCommands}
            onClick={() => setShowCommands((shown) => !shown)}
            style={{ ...control, fontSize: 12, color: muted, marginLeft: "auto" }}
          >
            Commands
          </button>}
          {busy && view !== "draft" && (
            <button onClick={cancel} style={{ ...control, color: amber }}>
              Cancel
            </button>
          )}
          {(view === "protocol" || view === "privacy") && <button style={{ ...control, fontSize: 12, color: muted }} onClick={() => setClearPending(true)}>
            Clear session…
          </button>}
          {clearPending && (
            <div
              role="alert"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 12,
                color: amber,
              }}
            >
              Cancel pending reviews and clear drafts, PDFs, questions and all review versions from this tab? Exported files stay on your device.
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
          .raf-terminal {
            --raf-bg: #030805;
            --raf-surface: #101a13;
            --raf-ink: #78fa96;
            --raf-green: #a4ffb9;
            --raf-muted: #a1b5a5;
            --raf-amber: #ffd18a;
            --raf-line: #32613e;
          }
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
          .raf-command-line:focus-within {
            --raf-command-border: #a4ffb9;
          }
          .raf-file-action:focus-within {
            outline: 2px solid #a4ffb9;
            outline-offset: 3px;
          }
          :global(.raf-window[data-maximized="true"]) .raf-terminal {
            --raf-height: 100%;
          }
          .raf-terminal textarea::placeholder,
          .raf-terminal input::placeholder {
            color: #a1b5a5;
          }
          .raf-terminal :global(:focus-visible) {
            outline: 2px solid #a4ffb9;
            outline-offset: 3px;
          }
          .raf-terminal .raf-result-heading:focus-visible {
            outline: none;
          }
          @media (max-width: 600px) {
            .raf-terminal {
              --raf-height: calc(100dvh - 88px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
              --raf-control-height: 44px;
            }
            .raf-header {
              --raf-header-padding: 10px 12px 8px;
            }
            .raf-output {
              --raf-output-padding: 8px 12px 14px;
            }
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
