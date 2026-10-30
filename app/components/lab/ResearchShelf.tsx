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
  minHeight: 40,
  padding: "9px 12px",
  border: "1px solid #aeb5a2",
  borderRadius: 3,
  background: "#faf8ee",
  color: "#315a40",
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
    <section aria-label="Research library" data-research-library="true" style={{ padding: "0 18px 18px", color: "#293b31" }}>
      <div style={{ background: "#e8e5d9", border: "1px solid #c9c5b4", borderRadius: 4, padding: "14px clamp(10px, 3vw, 22px) 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid #c7c3b2" }}>
          <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}><BookOpen size={16} aria-hidden="true" />Research library</p>
          {onOpenNotes && <button type="button" onClick={onOpenNotes} className={focusClass} style={{ ...linkStyle, minHeight: 36, padding: "6px 10px", fontSize: 11 }}>Own papers in Notes <ArrowRight size={12} aria-hidden="true" /></button>}
        </div>

        <label htmlFor="research-collection-select" style={{ display: "block", margin: "14px 0 6px", fontSize: 11, fontWeight: 700 }}>Collection</label>
        <select id="research-collection-select" value={collection} onChange={(event) => chooseCollection(event.target.value as ResearchCollection)} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]" style={{ display: "block", width: "100%", minHeight: 42, padding: "9px 28px 9px 10px", border: "1px solid #b2b29f", borderRadius: 3, background: "#fcfaf0", color: "#293b31", fontSize: 12 }}>
          <option value="all">All papers · {LAB_RESEARCH_PAPERS.length}</option>
          <option value="own">Own research · {RESEARCH_PAPERS.length}</option>
          <option value="reading">Reading list · {RESEARCH_READING.length}</option>
        </select>
        <label htmlFor="research-paper-select" style={{ display: "block", margin: "12px 0 6px", fontSize: 11, fontWeight: 700 }}>Browse the catalogue · {visiblePapers.length} papers</label>
        <select id="research-paper-select" value={paper.id} onChange={(event) => setSelectedId(event.target.value)} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245dda]" style={{ display: "block", width: "100%", minWidth: 0, minHeight: 42, padding: "9px 28px 9px 10px", border: "1px solid #b2b29f", borderRadius: 3, background: "#fcfaf0", color: "#293b31", fontSize: 12 }}>
          {visiblePapers.map((entry, index) => <option key={entry.id} value={entry.id}>{String(index + 1).padStart(2, "0")} · {entry.title}</option>)}
        </select>

        <article aria-labelledby="selected-paper-title" data-research-paper={paper.id} data-research-collection={paper.collection} style={{ marginTop: 15, padding: "clamp(16px, 3vw, 26px)", border: "1px solid #d1cdbc", borderTop: "4px solid #6b8067", borderRadius: 2, background: "#fffdf5", boxShadow: "2px 3px 0 #d6d2c3", overflowWrap: "anywhere" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 15, color: "#6c7262", fontSize: 10, lineHeight: 1.6 }}>
            <span style={{ letterSpacing: 1.3 }}>REF. {String(selectedIndex + 1).padStart(2, "0")} / {String(visiblePapers.length).padStart(2, "0")}</span>
            <span>{paper.date}</span>
          </div>
          <p style={{ margin: "0 0 10px", color: paper.collection === "own" ? "#526849" : "#6d6244", fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{paper.collection === "own" ? "Own research" : "Reading list · other authors"}</p>
          <h3 id="selected-paper-title" aria-live="polite" aria-atomic="true" style={{ margin: "0 0 16px", maxWidth: 720, color: "#26372c", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 400, lineHeight: 1.3 }}>{paper.title}</h3>
          {paper.venue && <p style={{ margin: "0 0 12px", color: "#686750", fontSize: 11, lineHeight: 1.7 }}>{paper.venue}</p>}
          {paper.summary && <p style={{ margin: "0 0 18px", maxWidth: 700, fontSize: 13, lineHeight: 1.8, color: "#4e594c" }}>{paper.summary}</p>}
          {paper.authors && <details style={{ margin: "0 0 16px", fontSize: 11, color: "#626957", lineHeight: 1.7 }}><summary className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ cursor: "pointer", width: "fit-content", minHeight: 32, lineHeight: "32px" }}>Authors</summary><p style={{ margin: "2px 0 0", maxWidth: 650 }}>{paper.authors}</p></details>}
          {paper.coAuthors && <details style={{ margin: "0 0 16px", fontSize: 11, color: "#626957", lineHeight: 1.7 }}><summary className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ cursor: "pointer", width: "fit-content", minHeight: 32, lineHeight: "32px" }}>Co-authors</summary><p style={{ margin: "2px 0 0", maxWidth: 650 }}>{paper.coAuthors}</p></details>}
          {paper.sourceNote && <p style={{ margin: "0 0 16px", fontSize: 11, lineHeight: 1.8, color: "#626957" }}>{paper.sourceUrl ? <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ color: "#476344" }}>{paper.sourceNote}</a> : paper.sourceNote}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <a href={paper.url} target="_blank" rel="noopener noreferrer" className={focusClass} style={{ ...linkStyle, background: "#e3e9db", fontWeight: 700 }}>Read paper <ExternalLink size={13} aria-hidden="true" /></a>
            {paper.studyUrl && <a href={paper.studyUrl} target="_blank" rel="noopener noreferrer" className={focusClass} style={linkStyle}>Interactive study <ExternalLink size={13} aria-hidden="true" /></a>}
            {paper.codeUrl && <a href={paper.codeUrl} target="_blank" rel="noopener noreferrer" className={focusClass} style={linkStyle}>Code <ExternalLink size={13} aria-hidden="true" /></a>}
            {onOpenArchitecture && (paper.id === "llm-output-drift" || paper.id === "dfah-bench") && <button type="button" onClick={() => onOpenArchitecture(paper.id === "llm-output-drift" ? "output-drift" : "dfah")} className={focusClass} style={{ ...linkStyle, cursor: "pointer" }}><Network size={14} aria-hidden="true" />Explore the architecture</button>}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 10, color: "#717766" }}>{source}{isArxiv ? " · paper and revision history" : paper.collection === "own" ? " · from the Notes archive" : " · primary source"}</p>
        </article>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <div style={{ display: "flex", gap: 7 }}>
            <button type="button" onClick={() => move(-1)} aria-label="Previous research paper" className={focusClass} style={{ ...linkStyle, cursor: "pointer", padding: "8px 11px" }}><ArrowLeft size={14} aria-hidden="true" />Previous</button>
            <button type="button" onClick={() => move(1)} aria-label="Next research paper" className={focusClass} style={{ ...linkStyle, cursor: "pointer", padding: "8px 11px" }}>Next<ArrowRight size={14} aria-hidden="true" /></button>
          </div>
          <button type="button" aria-expanded={marginOpen} aria-controls="research-margin-note" onClick={() => setMarginOpen((value) => !value)} className={focusClass} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38, padding: "6px 9px", border: "1px dashed #8b967c", borderRadius: 2, color: "#5a6d4b", fontSize: 9, fontWeight: 700, letterSpacing: 1.1, transform: "rotate(-2deg)", cursor: "pointer" }}><Stamp size={14} aria-hidden="true" />CHECK THE MARGIN</button>
        </div>
        {marginOpen && <aside id="research-margin-note" style={{ marginTop: 14, padding: "12px 14px", borderLeft: "3px solid #a5ad83", background: "#f4f0d9", color: "#525a42", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 13, lineHeight: 1.7 }}>
          A repeatable answer can still take a different path. The replay framework measures decisions, tool sequences, and support from evidence separately. <a href="https://arxiv.org/abs/2601.15322" target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245dda]" style={{ color: "#315a40", whiteSpace: "nowrap" }}>In the paper <span aria-hidden="true">↗</span></a>
        </aside>}
      </div>
    </section>
  )
}
