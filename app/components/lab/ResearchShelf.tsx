"use client"

import { useState, type CSSProperties } from "react"
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Network, Stamp } from "lucide-react"
import { LAB_RESEARCH_PAPERS, RESEARCH_PAPERS, RESEARCH_READING } from "@/data/research-papers"
import type { ResearchArchitectureId } from "@/data/research-architectures"

interface ResearchShelfProps {
  active?: boolean
  motionPaused?: boolean
  onOpenNotes?: () => void
  onOpenArchitecture?: (project: ResearchArchitectureId) => void
}

const linkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  minHeight: 44,
  padding: "9px 12px",
  border: "1px solid #7f9db9",
  borderRadius: 3,
  background: "#f5f4ec",
  boxShadow: "inset 0 1px 0 #fff",
  color: "#163f77",
  fontSize: 12,
  textDecoration: "none",
}

const focusClass = "hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]"
type ResearchCollection = "all" | "own" | "reading"

export default function ResearchShelf({ onOpenNotes, onOpenArchitecture }: ResearchShelfProps) {
  const [collection, setCollection] = useState<ResearchCollection>("all")
  const [selectedId, setSelectedId] = useState("dfah-bench")
  const [marginOpen, setMarginOpen] = useState(false)
  const visiblePapers = LAB_RESEARCH_PAPERS.filter((paper) => collection === "all" || paper.collection === collection)
  const selectedIndex = Math.max(0, visiblePapers.findIndex((paper) => paper.id === selectedId))
  const paper = visiblePapers[selectedIndex]
  const isArxiv = paper.url.startsWith("https://arxiv.org/")
  const source = isArxiv ? "arXiv" : paper.url.includes("academia.edu") ? "Academia.edu" : paper.url.includes("drive.google.com") ? "Google Drive" : new URL(paper.url).hostname

  const chooseCollection = (nextCollection: ResearchCollection) => {
    const nextPapers = LAB_RESEARCH_PAPERS.filter((entry) => nextCollection === "all" || entry.collection === nextCollection)
    setCollection(nextCollection)
    if (!nextPapers.some((entry) => entry.id === selectedId)) setSelectedId(nextPapers[0].id)
  }

  const move = (direction: number) => {
    const next = (selectedIndex + direction + visiblePapers.length) % visiblePapers.length
    setSelectedId(visiblePapers[next].id)
  }

  return (
    <section aria-label="Research library" data-research-library="true" style={{ padding: "12px clamp(10px, 2vw, 16px) 16px", color: "#1d2c43", fontFamily: "Tahoma, Verdana, sans-serif" }}>
      <div style={{ background: "#ece9d8", border: "1px solid #7f9db9", borderRadius: 2, padding: "0 clamp(10px, 2vw, 16px) 14px", boxShadow: "inset 0 1px 0 #fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "9px 0", borderBottom: "1px solid #b9c7d9" }}>
          <p style={{ display: "flex", alignItems: "center", gap: 7, margin: 0, color: "#0a246a", fontSize: 13, fontWeight: 700 }}><BookOpen size={18} color="#245edb" aria-hidden="true" />Research library</p>
          {onOpenNotes && <button type="button" onClick={onOpenNotes} className={focusClass} style={{ ...linkStyle, padding: "6px 9px", fontSize: 11 }}>Own papers in Notes <ArrowRight size={12} aria-hidden="true" /></button>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", alignItems: "end", gap: 10, paddingTop: 12 }}>
        <div style={{ minWidth: 0 }}>
        <label htmlFor="research-collection-select" style={{ display: "block", margin: "0 0 5px", fontSize: 11, color: "#334d71" }}>Collection</label>
        <select id="research-collection-select" value={collection} onChange={(event) => chooseCollection(event.target.value as ResearchCollection)} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]" style={{ display: "block", width: "100%", minWidth: 0, minHeight: 44, padding: "9px 28px 9px 10px", border: "1px solid #7f9db9", borderRadius: 2, background: "#fff", color: "#1d2c43", fontFamily: "inherit", fontSize: 12, boxShadow: "inset 1px 1px 2px #dde4ed" }}>
          <option value="all">All papers · {LAB_RESEARCH_PAPERS.length}</option>
          <option value="own">Own research · {RESEARCH_PAPERS.length}</option>
          <option value="reading">Reading list · {RESEARCH_READING.length}</option>
        </select>
        </div>
        <div style={{ minWidth: 0 }}>
        <label htmlFor="research-paper-select" style={{ display: "block", margin: "0 0 5px", fontSize: 11, color: "#334d71" }}>Browse the catalogue · {visiblePapers.length} papers</label>
        <select id="research-paper-select" value={paper.id} onChange={(event) => setSelectedId(event.target.value)} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]" style={{ display: "block", width: "100%", minWidth: 0, minHeight: 44, padding: "9px 28px 9px 10px", border: "1px solid #7f9db9", borderRadius: 2, background: "#fff", color: "#1d2c43", fontFamily: "inherit", fontSize: 12, boxShadow: "inset 1px 1px 2px #dde4ed" }}>
          {visiblePapers.map((entry, index) => <option key={entry.id} value={entry.id}>{String(index + 1).padStart(2, "0")} · {entry.title}</option>)}
        </select>
        </div>
        </div>

        <article aria-labelledby="selected-paper-title" data-research-paper={paper.id} data-research-collection={paper.collection} style={{ marginTop: 12, padding: "clamp(14px, 2.5vw, 22px)", border: "1px solid #7f9db9", borderTop: "3px solid #245edb", borderRadius: 1, background: "#fff", boxShadow: "inset 1px 1px 0 #edf2f8", overflowWrap: "anywhere" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 7, paddingBottom: 9, marginBottom: 14, borderBottom: "1px solid #dce5f1", color: "#58708e", fontSize: 10, lineHeight: 1.6 }}>
            <span>File {String(selectedIndex + 1).padStart(2, "0")} of {String(visiblePapers.length).padStart(2, "0")}</span>
            <span>{paper.date}</span>
          </div>
          <p style={{ margin: "0 0 9px", color: "#315a91", fontSize: 11, fontWeight: 700 }}>{paper.collection === "own" ? "Own research" : "Reading list · other authors"}</p>
          <h3 id="selected-paper-title" aria-live="polite" aria-atomic="true" style={{ margin: "0 0 14px", maxWidth: 720, color: "#0a246a", fontFamily: "inherit", fontSize: "clamp(18px, 2.5vw, 23px)", fontWeight: 700, lineHeight: 1.35 }}>{paper.title}</h3>
          {paper.venue && <p style={{ margin: "0 0 12px", color: "#4b6484", fontSize: 11, lineHeight: 1.7 }}>{paper.venue}</p>}
          {paper.summary && <p style={{ margin: "0 0 16px", maxWidth: 700, fontSize: 13, lineHeight: 1.75, color: "#344b67" }}>{paper.summary}</p>}
          {paper.authors && <details style={{ margin: "0 0 12px", fontSize: 11, color: "#4b6484", lineHeight: 1.7 }}><summary className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ cursor: "pointer", width: "fit-content", minHeight: 44, lineHeight: "44px" }}>Authors</summary><p style={{ margin: "2px 0 0", maxWidth: 650 }}>{paper.authors}</p></details>}
          {paper.coAuthors && <details style={{ margin: "0 0 12px", fontSize: 11, color: "#4b6484", lineHeight: 1.7 }}><summary className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ cursor: "pointer", width: "fit-content", minHeight: 44, lineHeight: "44px" }}>Co-authors</summary><p style={{ margin: "2px 0 0", maxWidth: 650 }}>{paper.coAuthors}</p></details>}
          {paper.sourceNote && <p style={{ margin: "0 0 16px", fontSize: 11, lineHeight: 1.75, color: "#4b6484" }}>{paper.sourceUrl ? <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ color: "#003399" }}>{paper.sourceNote}</a> : paper.sourceNote}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <a href={paper.url} target="_blank" rel="noopener noreferrer" className={focusClass} style={{ ...linkStyle, background: "#dce9fa", borderColor: "#316ac5", fontWeight: 700 }}>{paper.linkLabel ?? "Read paper"} <ExternalLink size={13} aria-hidden="true" /></a>
            {paper.studyUrl && <a href={paper.studyUrl} target="_blank" rel="noopener noreferrer" className={focusClass} style={linkStyle}>Interactive study <ExternalLink size={13} aria-hidden="true" /></a>}
            {paper.codeUrl && <a href={paper.codeUrl} target="_blank" rel="noopener noreferrer" className={focusClass} style={linkStyle}>Code <ExternalLink size={13} aria-hidden="true" /></a>}
            {onOpenArchitecture && (paper.id === "llm-output-drift" || paper.id === "dfah-bench") && <button type="button" onClick={() => onOpenArchitecture(paper.id === "llm-output-drift" ? "output-drift" : "dfah")} className={focusClass} style={{ ...linkStyle, cursor: "pointer" }}><Network size={14} aria-hidden="true" />Explore the architecture</button>}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 10, color: "#58708e" }}>{source}{isArxiv ? " · paper and revision history" : paper.collection === "own" ? " · from the Notes archive" : " · primary source"}</p>
        </article>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <div style={{ display: "flex", gap: 7 }}>
            <button type="button" onClick={() => move(-1)} aria-label="Previous research paper" className={focusClass} style={{ ...linkStyle, cursor: "pointer", padding: "8px 11px" }}><ArrowLeft size={14} aria-hidden="true" />Previous</button>
            <button type="button" onClick={() => move(1)} aria-label="Next research paper" className={focusClass} style={{ ...linkStyle, cursor: "pointer", padding: "8px 11px" }}>Next<ArrowRight size={14} aria-hidden="true" /></button>
          </div>
          <button type="button" aria-expanded={marginOpen} aria-controls="research-margin-note" onClick={() => setMarginOpen((value) => !value)} className={focusClass} style={{ ...linkStyle, minHeight: 44, padding: "6px 9px", color: "#163f77", fontSize: 10, cursor: "pointer" }}><Stamp size={14} aria-hidden="true" />CHECK THE MARGIN</button>
        </div>
        {marginOpen && <aside id="research-margin-note" style={{ marginTop: 12, padding: "12px 14px", border: "1px solid #c9bc76", borderRadius: 3, background: "#ffffe1", color: "#3c4653", fontFamily: "inherit", fontSize: 12, lineHeight: 1.75 }}>
          A repeatable answer can still take a different path. The replay framework measures decisions, tool sequences, and support from evidence separately. <a href="https://arxiv.org/abs/2601.15322" target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ color: "#003399", whiteSpace: "nowrap" }}>In the paper <span aria-hidden="true">↗</span></a>
        </aside>}
      </div>
    </section>
  )
}
