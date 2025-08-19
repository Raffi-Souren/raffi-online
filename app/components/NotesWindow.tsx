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
}

const ARTICLES: Article[] = [
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
    title: "Impact of External Forces and the Digital Age on the Turkish Narrative of Armenians in Turkey's Textbooks",
    url: "#",
  },
  {
    title: "Ticketmaster and Live Nation Antitrust Violations",
    url: "#",
  },
  {
    title: "The Effect of a US Recession and Macroeconomic Variables on Stock Market Performance",
    url: "#",
  },
]

const EVENTS: Event[] = [
  {
    title: "Building Gen AI for Capital Markets",
    date: "2025-08-21 at 18:00",
    location: "NYC",
    description: "Deep dive into implementing generative AI solutions for capital markets",
    url: "https://lu.ma/chks6i58",
    status: "upcoming",
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
            📝 LinkedIn Articles
          </button>
          <button
            onClick={() => setActiveTab("research")}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "research"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            🎓 Research Papers
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
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">SPEAKING</span>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">UPCOMING</span>
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
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">SPEAKING</span>
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">COMPLETED</span>
                          </div>
                          <div className="font-semibold text-gray-900 mb-1">{event.title}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            {event.date} • {event.location}
                          </div>
                          <div className="text-sm text-gray-700">{event.description}</div>
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
