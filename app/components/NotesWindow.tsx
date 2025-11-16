"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"

interface Article {
  version: string
  title: string
  url: string
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
    version: "v10",
    title: "When 27B Beats 400B: The Specialization Inflection (and Where Frontier Still Wins)",
    url: "https://www.linkedin.com/pulse/when-27b-beats-400b-specialization-inflection-where-khatchadourian-wicee/",
  },
  {
    version: "v9",
    title: "Deterministic AI & System Design: Why 'Same Input, Same Output' Wins in 2025",
    url: "https://www.linkedin.com/pulse/deterministic-ai-system-design-why-same-input-output-khatchadourian-gjtge?trackingId=5qB7ijaFT%2F%2BxvZ5nY5ihCw%3D%3D&lipi=urn%3Ali%3Apage%3Ad_flagship3_detail_base%3BwGOJNykqTpaunCewTRczMA%3D%3D",
  },
  {
    version: "v8",
    title: "When Bigger Stops Being Better",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v8-when-bigger-khatchadourian-gbjee",
  },
  {
    version: "v7",
    title: "AI Infrastructure at an Open Source Inflection Point",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v7-ai-open-khatchadourian-zzsqe",
  },
  {
    version: "v6",
    title: "Small Language Models and the Service Layer Reality",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v6-small-layer-khatchadourian-zmdce",
  },
  {
    version: "v5",
    title: "Stress-Testing Blockchain and AI at Global Scale",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v5-blockchain-khatchadourian-hwske",
  },
  {
    version: "v4",
    title: "Shipping Real Value in the AI Champagne Era",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v4-shipping-khatchadourian-nqmae",
  },
  {
    version: "v3",
    title: "Research, but make it deep",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v3-research-khatchadourian-nqmae",
  },
  {
    version: "v2",
    title: "Are Today's AI Agents Actually Agentic?",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-todays-ai-raffi-khatchadourian-zp0ke",
  },
  {
    version: "v1",
    title: "AI Agents in Finance and Crypto",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-ai-agents-raffi-khatchadourian-ulpfe",
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
    description: "LLM Output Drift: Cross-Provider Validation & Mitigation for Financial Workflows - Keynote presentation on AI research for finance",
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

  return (
    <WindowShell title="NOTES" onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">MY ARTICLES, RESEARCH PAPERS & EVENTS</h1>
          <p className="text-gray-600 text-sm">Collection of writings, research, and speaking engagements</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("articles")}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "articles"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            📝 Articles
          </button>
          <button
            onClick={() => setActiveTab("research")}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "research"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            🎓 Papers
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "events"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            📅 Events
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-50 rounded-lg p-6">
          {activeTab === "articles" && (
            <div className="space-y-6">
              {/* LinkedIn Articles Section */}
              <div>
                <div className="text-lg font-semibold text-blue-600 mb-4 border-b-2 border-blue-400 pb-1 inline-block">
                  📝 LinkedIn Articles
                </div>
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">From Consumer Buzz to Enterprise Adoption Series</h3>
                </div>
                <div className="space-y-3">
                  {ARTICLES.map((article) => (
                    <div key={article.version} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {article.version}
                          </span>
                          <h4 className="font-semibold text-gray-900">{article.title}</h4>
                        </div>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-medium text-sm"
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
                <div className="text-lg font-semibold text-green-600 mb-4 border-b-2 border-green-400 pb-1 inline-block">
                  📰 Press
                </div>
                <div className="space-y-3">
                  {PRESS.map((item, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                          <p className="text-sm text-gray-600 mb-1">{item.publication}</p>
                          <p className="text-sm text-gray-700">{item.description}</p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline font-medium text-sm whitespace-nowrap ml-4"
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
              <div className="text-lg font-semibold text-purple-600 mb-4 border-b-2 border-purple-400 pb-1 inline-block">
                🎓 Research Papers
              </div>
              <div className="space-y-3">
                {RESEARCH_PAPERS.map((paper, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900 flex-1 pr-4">{paper.title}</h4>
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline font-medium text-sm whitespace-nowrap"
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
              <div className="space-y-6">
                {/* Upcoming Events */}
                <div>
                  <div className="text-lg font-semibold text-green-600 mb-4 border-b-2 border-green-400 pb-1 inline-block">
                    📅 UPCOMING
                  </div>
                  <div className="space-y-3">
                    {upcomingEvents.map((event, index) => (
                      <div key={index} className="bg-white border-l-4 border-green-500 rounded-lg p-4">
                        <div className="flex gap-2 mb-2">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {getEventTypeLabel(event.type)}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {getEventStatusLabel(event.status)}
                          </span>
                        </div>
                        <div className="font-semibold text-gray-900 mb-1">{event.title}</div>
                        <div className="text-sm text-gray-600 mb-2">
                          {event.date} • {event.location}
                        </div>
                        <div className="text-sm text-gray-700 mb-3">{event.description}</div>
                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium text-sm"
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
                    <div className="text-lg font-semibold text-gray-600 mb-4 border-b-2 border-gray-400 pb-1 inline-block">
                      📋 PREVIOUS
                    </div>
                    <div className="space-y-3">
                      {previousEvents.map((event, index) => (
                        <div key={index} className="bg-white border-l-4 border-gray-400 rounded-lg p-4">
                          <div className="flex gap-2 mb-2">
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                              {getEventTypeLabel(event.type)}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                              {getEventStatusLabel(event.status)}
                            </span>
                          </div>
                          <div className="font-semibold text-gray-900 mb-1">{event.title}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            {event.date} • {event.location}
                          </div>
                          <div className="text-sm text-gray-700 mb-3">{event.description}</div>
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium text-sm"
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
