"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { Link2, FlaskConical, Music2, SlidersHorizontal, FileText, Boxes, Terminal } from "lucide-react"
import WindowShell from "@/components/ui/WindowShell"
import { useMotionPreference } from "@/app/context/MotionContext"
import { DEFAULT_LAB_SLUG, getLabPost, LAB_POSTS, type LabSlug } from "@/data/lab"
import type { ResearchArchitectureId } from "@/data/research-architectures"

const loading = () => <p role="status" style={{ padding: 24, color: "#454c56", fontSize: 13 }}>Opening experiment…</p>
const TapeShelf = dynamic(() => import("./lab/TapeShelf"), { ssr: false, loading })
const GearAnatomy = dynamic(() => import("./lab/GearAnatomy"), { ssr: false, loading })
const ResearchShelf = dynamic(() => import("./lab/ResearchShelf"), { ssr: false, loading })
const ResearchArchitecture = dynamic(() => import("./lab/ResearchArchitecture"), { ssr: false, loading })
const roomIcons = { "tape-shelf": Music2, "gear-anatomy": SlidersHorizontal, research: FileText, "architecture-studio": Boxes }

interface LabWindowProps {
  isOpen: boolean
  active: boolean
  slug: LabSlug
  onSelect: (slug: LabSlug) => void
  onClose: () => void
  onOpenNotes: () => void
  onOpenRafOs?: () => void
}

export default function LabWindow({ isOpen, active, slug, onSelect, onClose, onOpenNotes, onOpenRafOs }: LabWindowProps) {
  const post = getLabPost(slug) ?? getLabPost(DEFAULT_LAB_SLUG)!
  const { reducedMotion } = useMotionPreference()
  const stageRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const navigationRef = useRef<HTMLElement>(null)
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
    const navigation = navigationRef.current
    if (!navigation) return
    const keepCurrentRoomVisible = () => {
      const current = navigation.querySelector<HTMLElement>('[aria-current="page"]')
      if (!current) return
      const left = current.offsetLeft
      const right = left + current.offsetWidth
      if (left < navigation.scrollLeft) navigation.scrollTo({ left, behavior: "auto" })
      else if (right > navigation.scrollLeft + navigation.clientWidth) navigation.scrollTo({ left: right - navigation.clientWidth, behavior: "auto" })
    }
    keepCurrentRoomVisible()
    const observer = new ResizeObserver(keepCurrentRoomVisible)
    observer.observe(navigation)
    return () => observer.disconnect()
  }, [slug, isOpen])

  useEffect(() => {
    if (shareState !== "copied") return
    const timer = window.setTimeout(() => setShareState("idle"), 3000)
    return () => window.clearTimeout(timer)
  }, [shareState])

  if (!isOpen) return null
  const running = active && inView && pageVisible
  const motionPaused = reducedMotion
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
      <div className="lab-window" style={{ display: "flex", flexDirection: "column", height: "min(780px, calc(100dvh - 156px))", minHeight: 120, background: "#ece9d8", color: "#1d2c43", fontFamily: "Tahoma, Verdana, sans-serif" }}>
        <header style={{ padding: "var(--lab-header-padding, 10px 14px 8px)", borderBottom: "1px solid #8ba4c4", boxShadow: "inset 0 -1px 0 #fff", flexShrink: 0, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <FlaskConical size={20} strokeWidth={1.7} color="#245edb" aria-hidden="true" />
              <h1 style={{ margin: 0, fontSize: "var(--lab-title-size, 20px)", color: "#0a246a", fontWeight: 700, whiteSpace: "nowrap" }}>The lab</h1>
            </div>
          </div>
          <p className="lab-subtitle" style={{ margin: "3px 0 7px", fontSize: 11, lineHeight: 1.5, color: "#405c7d" }}>Filed under play. Music, experiments, and the work behind them.</p>
          <nav ref={navigationRef} aria-label="Lab collection" style={{ position: "relative", display: "flex", gap: 4, flexWrap: "nowrap", overflowX: "auto", overflowY: "hidden", maxWidth: "100%", padding: "3px 2px", marginTop: "var(--lab-navigation-gap, 0px)", scrollbarWidth: "thin", scrollbarColor: "#9bb4d5 #ece9d8" }}>
            {LAB_POSTS.map((entry) => {
              const Icon = roomIcons[entry.slug]
              return (
              <a key={entry.slug} href={`/lab/${entry.slug}`} aria-current={entry.slug === slug ? "page" : undefined} onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                event.preventDefault()
                onSelect(entry.slug)
              }} className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, flexShrink: 0, whiteSpace: "nowrap", padding: "8px 11px", minHeight: 44, border: "1px solid", borderColor: entry.slug === slug ? "#316ac5" : "#aca899", background: entry.slug === slug ? "#dce9fa" : "#f5f4ec", boxShadow: entry.slug === slug ? "inset 0 1px 2px #b0c5e2" : "inset 0 1px 0 #fff", color: "#123567", borderRadius: 3, fontSize: 12, fontWeight: entry.slug === slug ? 700 : 400, textDecoration: "none" }}><Icon size={15} color={entry.slug === slug ? "#174fb0" : "#55758f"} aria-hidden="true" />{entry.title}</a>
              )
            })}
            {onOpenRafOs && <div style={{ display: "flex", alignItems: "stretch", flexShrink: 0, borderLeft: "1px solid #b5b4a8", marginLeft: 4, paddingLeft: 8 }}><button type="button" onClick={onOpenRafOs} aria-label="Open RAF OS pitch review" title="RAF OS · pitch review" className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "8px 11px", whiteSpace: "nowrap", border: "1px solid #aca899", borderRadius: 3, background: "#f5f4ec", boxShadow: "inset 0 1px 0 #fff", color: "#123567", fontSize: 12, cursor: "pointer" }}><Terminal size={15} color="#55758f" aria-hidden="true" />RAF OS</button></div>}
          </nav>
        </header>
        <div ref={scrollerRef} data-lab-scroll="true" style={{ overflowY: "auto", overscrollBehavior: "contain", minHeight: 0, flex: 1, background: "#fff" }}>
          <article aria-labelledby="lab-post-title" data-lab-post={post.slug}>
            <div style={{ padding: "var(--lab-post-padding, 12px 16px 14px)", background: "#f4f8fd", borderBottom: "1px solid #c8d6e8" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b6484" }}>{post.medium} <span aria-hidden="true">/</span> <time dateTime={post.date}>{new Date(`${post.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time></p>
                <button type="button" onClick={copyLink} aria-label="Copy experiment link" className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#163f77", minHeight: 44, padding: "6px 9px", border: "1px solid #7f9db9", borderRadius: 3, background: "#f5f4ec", boxShadow: "inset 0 1px 0 #fff" }}><Link2 size={13} aria-hidden="true" /><span aria-live="polite">{shareState === "copied" ? "Link copied" : "Copy link"}</span></button>
              </div>
              <h2 id="lab-post-title" style={{ margin: "0 0 5px", color: "#0a246a", fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>{post.title}</h2>
              <p style={{ margin: "0 0 4px", fontSize: 13, lineHeight: 1.5 }}>{post.caption}</p>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: "#4b607a", maxWidth: 650 }}>{post.description}</p>
              {shareState === "fallback" && <a href={linkPath} style={{ display: "block", marginTop: 8, color: "#24599a", overflowWrap: "anywhere", fontSize: 12 }}>Open or copy this experiment’s link: {linkPath}</a>}
            </div>
            <div ref={stageRef} data-lab-stage={post.slug} style={{ minHeight: 250 }}>
              {(inView || revealed === slug) && (post.slug === "tape-shelf" ? <TapeShelf key={post.slug} active={running} motionPaused={motionPaused} /> : post.slug === "gear-anatomy" ? <GearAnatomy key={post.slug} active={running} motionPaused={motionPaused} /> : post.slug === "research" ? <ResearchShelf key={post.slug} onOpenNotes={onOpenNotes} onOpenArchitecture={(project) => {
                setArchitectureProject(project)
                onSelect("architecture-studio")
              }} /> : <ResearchArchitecture key={post.slug} active={running} motionPaused={motionPaused} initialProject={architectureProject} onOpenResearch={() => onSelect("research")} />)}
            </div>
            <details key={post.slug} style={{ margin: "12px 16px 20px", border: "1px solid #b8c9df", background: "#f4f8fd", padding: "0 12px", fontSize: 12 }}>
              <summary className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ cursor: "pointer", minHeight: 44, lineHeight: "44px", color: "#0a246a", fontWeight: 700 }}>Build notes & references</summary>
              <ol style={{ paddingLeft: 20, margin: "7px 0 12px", lineHeight: 1.8, maxWidth: 720 }}>{post.notes.map((note) => <li key={note} style={{ paddingLeft: 3, marginBottom: 6 }}>{note}</li>)}</ol>
              <p style={{ margin: "12px 0 5px", color: "#4b607a" }}>References</p>
              {post.references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ display: "flex", alignItems: "center", color: "#003399", minHeight: 44, padding: "7px 0", width: "fit-content", maxWidth: "100%", overflowWrap: "anywhere" }}>{reference.label}</a>)}
            </details>
          </article>
        </div>
        <style jsx>{`
          @media (max-width: 600px) {
            .lab-window {
              --lab-header-padding: 7px 10px 6px;
              --lab-title-size: 18px;
              --lab-navigation-gap: 4px;
              --lab-post-padding: 10px 12px 12px;
            }
            .lab-subtitle { display: none; }
          }
        `}</style>
      </div>
    </WindowShell>
  )
}
