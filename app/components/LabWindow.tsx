"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { Link2, Pause, Play, FlaskConical } from "lucide-react"
import WindowShell from "@/components/ui/WindowShell"
import { useMotionPreference } from "@/app/context/MotionContext"
import { DEFAULT_LAB_SLUG, getLabPost, LAB_POSTS, type LabSlug } from "@/data/lab"
import type { ResearchArchitectureId } from "@/data/research-architectures"

const loading = () => <p role="status" style={{ padding: 24, color: "#454c56", fontSize: 13 }}>Opening experiment…</p>
const TapeShelf = dynamic(() => import("./lab/TapeShelf"), { ssr: false, loading })
const GearAnatomy = dynamic(() => import("./lab/GearAnatomy"), { ssr: false, loading })
const ResearchShelf = dynamic(() => import("./lab/ResearchShelf"), { ssr: false, loading })
const ResearchArchitecture = dynamic(() => import("./lab/ResearchArchitecture"), { ssr: false, loading })

interface LabWindowProps {
  isOpen: boolean
  active: boolean
  slug: LabSlug
  onSelect: (slug: LabSlug) => void
  onClose: () => void
  onOpenNotes: () => void
}

export default function LabWindow({ isOpen, active, slug, onSelect, onClose, onOpenNotes }: LabWindowProps) {
  const post = getLabPost(slug) ?? getLabPost(DEFAULT_LAB_SLUG)!
  const { paused, setPaused, reducedMotion } = useMotionPreference()
  const stageRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [revealed, setRevealed] = useState<LabSlug | null>(null)
  const [architectureProject, setArchitectureProject] = useState<ResearchArchitectureId>("dfah")
  const [pageVisible, setPageVisible] = useState(true)
  const [shareState, setShareState] = useState<"idle" | "copied" | "fallback">("idle")

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { root: scrollerRef.current })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [isOpen])

  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden)
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])

  useEffect(() => {
    setShareState("idle")
    document.title = `${post.title} · Raffi’s lab`
    scrollerRef.current?.scrollTo({ top: 0, behavior: "auto" })
  }, [slug, post.title])

  useEffect(() => () => { document.title = "Raffi Web" }, [])

  useEffect(() => {
    if (inView) setRevealed(slug)
  }, [inView, slug])

  useEffect(() => {
    if (shareState !== "copied") return
    const timer = window.setTimeout(() => setShareState("idle"), 3000)
    return () => window.clearTimeout(timer)
  }, [shareState])

  if (!isOpen) return null
  const running = active && inView && pageVisible
  const motionPaused = paused || reducedMotion
  const linkPath = `/lab/${post.slug}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(linkPath, window.location.origin).href)
      setShareState("copied")
    } catch {
      setShareState("fallback")
    }
  }

  return (
    <WindowShell title="LAB" onClose={onClose} fullBleed maxWidth="1120px">
      <div style={{ display: "flex", flexDirection: "column", height: "min(780px, calc(100dvh - 156px))", minHeight: 120, background: "#f4f2eb", color: "#273548", fontFamily: "Tahoma, Verdana, sans-serif" }}>
        <header style={{ padding: "15px 18px 12px", borderBottom: "1px solid #c5c3b8", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <FlaskConical size={21} strokeWidth={1.7} aria-hidden="true" />
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: -0.6 }}>The lab</h1>
            </div>
            <button type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)} className="hover:bg-[#e3e4dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #b9beb6", borderRadius: 3, background: "#f8f8f1", padding: "7px 10px", fontSize: 11, minHeight: 36 }}>
              {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
              {paused ? "Resume movement" : "Pause movement"}
            </button>
          </div>
          <p style={{ margin: "5px 0 12px", fontSize: 12, lineHeight: 1.5, color: "#53606d" }}>Experiments, papers, and the systems behind them.</p>
          <nav aria-label="Lab collection" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LAB_POSTS.map((entry) => (
              <a key={entry.slug} href={`/lab/${entry.slug}`} aria-current={entry.slug === slug ? "page" : undefined} onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                event.preventDefault()
                onSelect(entry.slug)
              }} className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]" style={{ display: "inline-flex", alignItems: "center", padding: "9px 12px", minHeight: 38, border: "1px solid", borderColor: entry.slug === slug ? "#536b55" : "#c3c4b9", background: entry.slug === slug ? "#dde6d7" : "#faf9f4", color: "#2d4034", borderRadius: 3, fontSize: 12, fontWeight: entry.slug === slug ? 700 : 400, textDecoration: "none" }}>{entry.title}</a>
            ))}
          </nav>
        </header>
        <div ref={scrollerRef} data-lab-scroll="true" style={{ overflowY: "auto", overscrollBehavior: "contain", minHeight: 0, flex: 1 }}>
          <article aria-labelledby="lab-post-title" data-lab-post={post.slug}>
            <div style={{ padding: "17px 18px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#68716d" }}>{post.medium} <span aria-hidden="true">/</span> <time dateTime={post.date}>{new Date(`${post.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time></p>
                <button type="button" onClick={copyLink} aria-label="Copy experiment link" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#24599a", minHeight: 36, padding: "4px 2px" }}><Link2 size={13} aria-hidden="true" /><span aria-live="polite">{shareState === "copied" ? "Link copied" : "Copy link"}</span></button>
              </div>
              <h2 id="lab-post-title" style={{ margin: "0 0 5px", fontSize: 24, lineHeight: 1.2, letterSpacing: -0.7, fontWeight: 700 }}>{post.title}</h2>
              <p style={{ margin: "0 0 4px", fontSize: 13, lineHeight: 1.5 }}>{post.caption}</p>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: "#59646a", maxWidth: 650 }}>{post.description}</p>
              {shareState === "fallback" && <a href={linkPath} style={{ display: "block", marginTop: 8, color: "#24599a", overflowWrap: "anywhere", fontSize: 12 }}>Open or copy this experiment’s link: {linkPath}</a>}
            </div>
            <div ref={stageRef} data-lab-stage={post.slug} style={{ minHeight: 250 }}>
              {(inView || revealed === slug) && (post.slug === "tape-shelf" ? <TapeShelf key={post.slug} active={running} motionPaused={motionPaused} /> : post.slug === "gear-anatomy" ? <GearAnatomy key={post.slug} active={running} motionPaused={motionPaused} /> : post.slug === "research" ? <ResearchShelf key={post.slug} onOpenNotes={onOpenNotes} onOpenArchitecture={(project) => {
                setArchitectureProject(project)
                onSelect("architecture-studio")
              }} /> : <ResearchArchitecture key={post.slug} active={running} motionPaused={motionPaused} initialProject={architectureProject} onOpenResearch={() => onSelect("research")} />)}
            </div>
            <details key={post.slug} style={{ margin: "16px 18px 24px", borderTop: "1px solid #cccbbf", paddingTop: 12, fontSize: 12 }}>
              <summary className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ cursor: "pointer", minHeight: 36, lineHeight: "36px", fontWeight: 700 }}>Build notes & references</summary>
              <ol style={{ paddingLeft: 20, margin: "7px 0 12px", lineHeight: 1.8, maxWidth: 720 }}>{post.notes.map((note) => <li key={note} style={{ paddingLeft: 3, marginBottom: 6 }}>{note}</li>)}</ol>
              <p style={{ margin: "12px 0 5px", color: "#59646a" }}>References</p>
              {post.references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ display: "block", color: "#24599a", padding: "7px 0", width: "fit-content", maxWidth: "100%", overflowWrap: "anywhere" }}>{reference.label}</a>)}
            </details>
          </article>
        </div>
      </div>
    </WindowShell>
  )
}
