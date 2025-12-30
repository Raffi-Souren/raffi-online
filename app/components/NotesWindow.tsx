"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"

interface Article {
  version: string
  title: string
  url: string
  platform?: "linkedin" | "substack"
}

interface ResearchPaper {
  title: string
  url: string
}

interface Event {
  title: string
  date: string
  location: string
  description: string
  url?: string
  status: "upcoming" | "previous"
  type: "speaking" | "keynote" | "panel" | "dj" | "other" | "events"
}

interface PressItem {
  title: string
  publication: string
  description: string
  url: string
}

const ARTICLES: Article[] = [
  {
    version: "v1",
    title: "Variables - A series bridging academic & professional",
    url: "https://open.substack.com/pub/raf94/p/variables-a-series-bridging-academic?r=1vmhm5&utm_campaign=post&utm_medium=web",
    platform: "substack",
  },
  {
    version: "v12",
    title: "Real or AI? Why Enterprise Needs Provenance-First Verification",
    url: "https://www.linkedin.com/pulse/real-ai-why-enterprise-needs-provenance-first-raffi-khatchadourian-v5rhe/",
    platform: "linkedin",
  },
  {
    version: "v11",
    title: "Singapore, Sovereign AI, and Shipping",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v11-singapore-khatchadourian-10hae/",
    platform: "linkedin",
  },
  {
    version: "v10",
    title: "When 27B Beats 400B: The Specialization Inflection (and Where Frontier Still Wins)",
    url: "https://www.linkedin.com/pulse/when-27b-beats-400b-specialization-inflection-where-khatchadourian-wicee/",
    platform: "linkedin",
  },
  {
    version: "v9",
    title: "Deterministic AI & System Design: Why 'Same Input, Same Output' Wins in 2025",
    url: "https://www.linkedin.com/pulse/deterministic-ai-system-design-why-same-input-output-khatchadourian-gjtge?trackingId=5qB7ijaFT%2F%2BxvZ5nY5ihCw%3D%3D&lipi=urn%3Ali%3Apage%3Ad_flagship3_detail_base%3BwGOJNykqTpaunCewTRczMA%3D%3D",
    platform: "linkedin",
  },
  {
    version: "v8",
    title: "When Bigger Stops Being Better",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v8-when-bigger-khatchadourian-gbjee",
    platform: "linkedin",
  },
  {
    version: "v7",
    title: "AI Infrastructure at an Open Source Inflection Point",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v7-ai-open-khatchadourian-zzsqe",
    platform: "linkedin",
  },
  {
    version: "v6",
    title: "Small Language Models and the Service Layer Reality",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v6-small-layer-khatchadourian-zmdce",
    platform: "linkedin",
  },
  {
    version: "v5",
    title: "Stress-Testing Blockchain and AI at Global Scale",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v5-blockchain-khatchadourian-hwske",
    platform: "linkedin",
  },
  {
    version: "v4",
    title: "Shipping Real Value in the AI Champagne Era",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v4-shipping-khatchadourian-nqmae",
    platform: "linkedin",
  },
  {
    version: "v3",
    title: "Research, but make it deep",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v3-research-khatchadourian-nqmae",
    platform: "linkedin",
  },
  {
    version: "v2",
    title: "Are Today's AI Agents Actually Agentic?",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-todays-ai-raffi-khatchadourian-zp0ke",
    platform: "linkedin",
  },
  {
    version: "v1",
    title: "AI Agents in Finance and Crypto",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-ai-agents-raffi-khatchadourian-ulpfe",
    platform: "linkedin",
  },
]

const RESEARCH_PAPERS: ResearchPaper[] = [
  {
    title: "LLM Output Drift: Cross-Provider Validation & Mitigation for Financial Workflows",
    url: "https://arxiv.org/abs/2511.07585",
  },
  {
    title: "Impact of External Forces and the Digital Age on the Turkish Narrative of Armenians in Turkey's Textbooks",
    url: "https://www.academia.edu/44288138/Impact_of_External_Forces_and_the_Digital_Age_on_the_Turkish_Narrative_of_Armenians_in_Turkeys_Textbooks?source=swp_share",
  },
  {
    title: "Ticketmaster and Live Nation Antitrust Violations",
    url: "https://drive.google.com/file/d/1ClBedYKfuRYiJU-DCmV45wRHUd2_Ier2/view?usp=sharing",
  },
  {
    title: "The Effect of a US Recession and Macroeconomic Variables on Stock Market Performance",
    url: "https://drive.google.com/file/d/1fJcGuypNM7N-oBu6caEDm0hJlokZfihB/view?usp=sharing",
  },
]

const EVENTS: Event[] = [
  {
    title: "AI4F @ ACM ICAIF",
    date: "Nov 15, 2025",
    location: "Singapore",
    description:
      "LLM Output Drift: Cross-Provider Validation & Mitigation for Financial Workflows - Keynote presentation on AI research for finance",
    url: "https://player.vimeo.com/video/1137311394?h=f943914abd",
    status: "previous",
    type: "keynote",
  },
  {
    title: "Building Gen AI for Capital Markets",
    date: "2025-08-21 at 18:00",
    location: "NYC",
    description: "Deep dive into implementing generative AI solutions for capital markets",
    url: "https://lu.ma/chks6i58",
    status: "previous",
    type: "speaking",
  },
  {
    title: "AI Summit @ Javits Center",
    date: "Dec 2024",
    location: "Javits Center, NYC",
    description:
      "Hyper automation in banking and finance - keynote presentation on the future of AI in financial services",
    url: "https://vimeo.com/1041803978/881d636822",
    status: "previous",
    type: "keynote",
  },
  {
    title: "AI in Finance @ a16z Tech Week NYC",
    date: "May 2025",
    location: "a16z NYC",
    description: "Reliable GenAI in Quant Finance - panel discussion on implementing AI in quantitative finance",
    url: "https://www.linkedin.com/posts/raffi-khatchadourian_genai-finance-modelcompression-activity-7336880144894083072-vH4C",
    status: "previous",
    type: "panel",
  },
  {
    title: "BoweryLand DJ Set",
    date: "Summer 2024",
    location: "NYC",
    description: "DJ performance at BoweryLand event",
    url: "https://x.com/DeadliestKhatch/status/1827123754347925770",
    status: "previous",
    type: "dj",
  },
  {
    title: "BADCOMPANY F/W 21-22 CAPSULE",
    date: "2022",
    location: "NYC",
    description: "Recap video from pop up",
    url: "https://vimeo.com/647500740",
    status: "previous",
    type: "other",
  },
  {
    title: "BADCO WORLD",
    date: "2017-2024",
    location: "NYC",
    description:
      "Events from 2017-2024 (highlights incl Ice Spice NYFW '23, Lil Keed NYFW '22, Drip or Drown pool party series on Arlo Wburg Hotel rooftop)",
    url: "https://www.notgoodcompany.com/",
    status: "previous",
    type: "events",
  },
]

const PRESS: PressItem[] = [
  {
    title: "20-Year-Old Entrepreneur Is Using Data to Retune the Music Industry",
    publication: "General Assembly",
    description: "Interview on indify startup",
    url: "https://generalassemb.ly/blog/20-year-old-entrepreneur-is-using-data-to-retune-the-music-industry/",
  },
]

interface NotesWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function NotesWindow({ isOpen, onClose }: NotesWindowProps) {
  const [activeTab, setActiveTab] = useState<"articles" | "research" | "events">("articles")

  if (!isOpen) return null

  const upcomingEvents = EVENTS.filter((event) => event.status === "upcoming")
  const previousEvents = EVENTS.filter((event) => event.status === "previous")

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "keynote":
        return "KEYNOTE"
      case "panel":
        return "PANEL"
      case "dj":
        return "DJ SET"
      case "speaking":
        return "SPEAKING"
      case "events":
        return "EVENTS"
      default:
        return "EVENT"
    }
  }

  const getEventStatusLabel = (status: string) => {
    return status === "upcoming" ? "UPCOMING" : "COMPLETED"
  }

  const tabButtonStyle = (isActive: boolean) => ({
    flex: 1,
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
    color: isActive ? "#3b82f6" : "#6b7280",
    backgroundColor: isActive ? "#eff6ff" : "transparent",
    transition: "all 0.2s",
    cursor: "pointer",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    outline: "none",
  })

  const cardStyle = {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "0.5rem",
    padding: "1rem",
  }

  return (
    <WindowShell title="NOTES" onClose={onClose}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          backgroundColor: "#ffffff",
          color: "#111827",
        }}
        className="text-black"
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#111827", marginBottom: "0.5rem" }}>
            MY ARTICLES, RESEARCH PAPERS & EVENTS
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Collection of writings, research, and speaking engagements
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
          <button onClick={() => setActiveTab("articles")} style={tabButtonStyle(activeTab === "articles")}>
            📝 Articles
          </button>
          <button onClick={() => setActiveTab("research")} style={tabButtonStyle(activeTab === "research")}>
            🎓 Papers
          </button>
          <button onClick={() => setActiveTab("events")} style={tabButtonStyle(activeTab === "events")}>
            📅 Events
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ backgroundColor: "#f9fafb", borderRadius: "0.5rem", padding: "1.5rem" }}>
          {activeTab === "articles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Substack Section */}
              <div>
                <div
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: "600",
                    color: "#FF6719",
                    marginBottom: "1rem",
                    borderBottom: "2px solid #FF6719",
                    paddingBottom: "0.25rem",
                    display: "inline-block",
                  }}
                >
                  🧡 Substack
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {ARTICLES.filter((a) => a.platform === "substack").map((article) => (
                    <div key={article.url} style={cardStyle}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: "bold",
                              color: "#FF6719",
                              backgroundColor: "#FFF0E5",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            {article.version}
                          </span>
                          <h4 style={{ fontWeight: "600", color: "#111827" }}>{article.title}</h4>
                        </div>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#FF6719", fontWeight: "500", fontSize: "0.875rem", textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LinkedIn Articles Section */}
              <div>
                <div
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: "600",
                    color: "#2563eb",
                    marginBottom: "1rem",
                    borderBottom: "2px solid #60a5fa",
                    paddingBottom: "0.25rem",
                    display: "inline-block",
                  }}
                >
                  📝 LinkedIn Articles
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "0.5rem" }}>
                    From Consumer Buzz to Enterprise Adoption Series
                  </h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {ARTICLES.filter((a) => a.platform !== "substack").map((article) => (
                    <div key={article.version} style={cardStyle}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: "bold",
                              color: "#2563eb",
                              backgroundColor: "#dbeafe",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            {article.version}
                          </span>
                          <h4 style={{ fontWeight: "600", color: "#111827" }}>{article.title}</h4>
                        </div>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#2563eb", fontWeight: "500", fontSize: "0.875rem", textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Press Section */}
              <div>
                <div
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: "600",
                    color: "#16a34a",
                    marginBottom: "1rem",
                    borderBottom: "2px solid #4ade80",
                    paddingBottom: "0.25rem",
                    display: "inline-block",
                  }}
                >
                  📰 Press
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {PRESS.map((item, index) => (
                    <div key={index} style={cardStyle}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontWeight: "600", color: "#111827", marginBottom: "0.25rem" }}>{item.title}</h4>
                          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                            {item.publication}
                          </p>
                          <p style={{ fontSize: "0.875rem", color: "#374151" }}>{item.description}</p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#16a34a",
                            fontWeight: "500",
                            fontSize: "0.875rem",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            marginLeft: "1rem",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "research" && (
            <div>
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#9333ea",
                  marginBottom: "1rem",
                  borderBottom: "2px solid #c084fc",
                  paddingBottom: "0.25rem",
                  display: "inline-block",
                }}
              >
                🎓 Research Papers
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {RESEARCH_PAPERS.map((paper, index) => (
                  <div key={index} style={{ ...cardStyle, borderLeft: "4px solid #22c55e" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h4 style={{ fontWeight: "600", color: "#111827", flex: 1, paddingRight: "1rem" }}>
                        {paper.title}
                      </h4>
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#9333ea",
                          fontWeight: "500",
                          fontSize: "0.875rem",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        View →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "events" && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Upcoming Events */}
                <div>
                  <div
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      color: "#16a34a",
                      marginBottom: "1rem",
                      borderBottom: "2px solid #4ade80",
                      paddingBottom: "0.25rem",
                      display: "inline-block",
                    }}
                  >
                    📅 UPCOMING
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {upcomingEvents.map((event, index) => (
                      <div key={index} style={{ ...cardStyle, borderLeft: "4px solid #22c55e" }}>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              backgroundColor: "#d1fae5",
                              color: "#166534",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            {getEventTypeLabel(event.type)}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              backgroundColor: "#dbeafe",
                              color: "#1e40af",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            {getEventStatusLabel(event.status)}
                          </span>
                        </div>
                        <div style={{ fontWeight: "600", color: "#111827", marginBottom: "0.25rem" }}>
                          {event.title}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                          {event.date} • {event.location}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "0.75rem" }}>
                          {event.description}
                        </div>
                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#2563eb",
                              fontWeight: "500",
                              fontSize: "0.875rem",
                              textDecoration: "none",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >
                            RSVP on Luma →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Previous Events */}
                {previousEvents.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: "600",
                        color: "#6b7280",
                        marginBottom: "1rem",
                        borderBottom: "2px solid #9ca3af",
                        paddingBottom: "0.25rem",
                        display: "inline-block",
                      }}
                    >
                      📋 PREVIOUS
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {previousEvents.map((event, index) => (
                        <div key={index} style={{ ...cardStyle, borderLeft: "4px solid #9ca3af" }}>
                          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                backgroundColor: "#f3f4f6",
                                color: "#374151",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                              }}
                            >
                              {getEventTypeLabel(event.type)}
                            </span>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                backgroundColor: "#f3f4f6",
                                color: "#374151",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                              }}
                            >
                              {getEventStatusLabel(event.status)}
                            </span>
                          </div>
                          <div style={{ fontWeight: "600", color: "#111827", marginBottom: "0.25rem" }}>
                            {event.title}
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                            {event.date} • {event.location}
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "0.75rem" }}>
                            {event.description}
                          </div>
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#2563eb",
                                fontWeight: "500",
                                fontSize: "0.875rem",
                                textDecoration: "none",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                              {event.type === "keynote" || event.type === "panel"
                                ? "🎥 Watch Replay"
                                : event.type === "events"
                                  ? "View Portfolio"
                                  : "View"}{" "}
                              →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </WindowShell>
  )
}
