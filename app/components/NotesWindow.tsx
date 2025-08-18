"use client"

import { useState } from "react"
import { WindowsIcons } from "./Icons"

interface Article {
  version: string
  title: string
  url: string
  type: "LinkedIn" | "Research"
}

interface Event {
  title: string
  date: string
  time?: string
  venue: string
  lumaUrl?: string
  replayUrl?: string
  type: string
  status: string
  description?: string
}

const articles: Article[] = [
  // LinkedIn Articles - From Consumer Buzz to Enterprise Adoption Series
  {
    version: "v8",
    title: "When Bigger Stops Being Better",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v8-when-bigger-khatchadourian-gbjee",
    type: "LinkedIn",
  },
  {
    version: "v7",
    title: "AI Infrastructure at an Open Source Inflection Point",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v7-ai-open-khatchadourian-zzsqe",
    type: "LinkedIn",
  },
  {
    version: "v6",
    title: "Small Language Models and the Service Layer Reality",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v6-small-layer-khatchadourian-zmdce",
    type: "LinkedIn",
  },
  {
    version: "v5",
    title: "Stress-Testing Blockchain and AI at Global Scale",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v5-blockchain-khatchadourian-hwske",
    type: "LinkedIn",
  },
  {
    version: "v4",
    title: "Shipping Real Value in the AI Champagne Era",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v3-research-khatchadourian-nqmae",
    type: "LinkedIn",
  },
  {
    version: "v3",
    title: "Research, but make it deep",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-todays-ai-raffi-khatchadourian-zp0ke",
    type: "LinkedIn",
  },
  {
    version: "v2",
    title: "Are Today's AI Agents Actually Agentic?",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-todays-ai-raffi-khatchadourian-zp0ke",
    type: "LinkedIn",
  },
  {
    version: "v1",
    title: "AI Agents in Finance and Crypto",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-ai-agents-raffi-khatchadourian-ulpfe",
    type: "LinkedIn",
  },
  // Research Papers
  {
    version: "",
    title: "Impact of External Forces and the Digital Age on the Turkish Narrative of Armenians in Turkey's Textbooks",
    url: "https://www.academia.edu/44288138/Impact_of_External_Forces_and_the_Digital_Age_on_the_Turkish_Narrative_of_Armenians_in_Turkeys_Textbooks",
    type: "Research",
  },
  {
    version: "",
    title: "Ticketmaster and Live Nation Antitrust Violations",
    url: "https://www.academia.edu/95690323/Ticketmaster_and_Live_Nation_Antitrust_Violations",
    type: "Research",
  },
  {
    version: "",
    title: "The Effect of a US Recession and Macroeconomic Variables on Stock Market Performance",
    url: "https://www.academia.edu/127439445/The_Effect_of_a_US_Recession_and_Macroeconomic_Variables_on_Stock_Market_Performance",
    type: "Research",
  },
]

const upcomingEvents: Event[] = [
  {
    title: "Building Gen AI for Capital Markets",
    date: "2025-08-21",
    time: "18:00",
    venue: "NYC",
    lumaUrl: "https://lu.ma/chks6i58",
    type: "speaking",
    status: "upcoming",
    description: "Deep dive into implementing generative AI solutions for capital markets",
  },
]

const previousEvents: Event[] = [
  {
    title: "AI Summit @ Javits Center",
    date: "Dec 2024",
    venue: "Javits Center, NYC",
    replayUrl: "https://vimeo.com/1041803978/881d636822",
    type: "keynote",
    status: "past",
    description:
      "Hyper automation in banking and finance - keynote presentation on the future of AI in financial services",
  },
  {
    title: "AI in Finance @ a16z Tech Week NYC",
    date: "May 2025",
    venue: "a16z NYC",
    replayUrl:
      "https://www.linkedin.com/posts/raffi-khatchadourian_genai-finance-modelcompression-activity-7336880144894083072-vH4C?utm_source=share&utm_medium=member_desktop&rcm=ACoAABPUWSgBJVLvatVBEiSUU0ICEXhNODcutls",
    type: "panel",
    status: "past",
    description: "Reliable GenAI in Quant Finance - panel discussion on implementing AI in quantitative finance",
  },
]

interface NotesWindowProps {
  onClose: () => void
}

export default function NotesWindow({ onClose }: NotesWindowProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "previous">("upcoming")

  return (
    <div className="window fixed bottom-8 right-4 w-[600px] md:w-[700px] h-[500px] md:h-[600px] overflow-y-auto z-50">
      <div className="window-title sticky top-0 z-10">
        <span>{WindowsIcons.Notes} RAF'S NOTES</span>
        <button className="ml-auto" onClick={onClose}>
          {WindowsIcons.Close}
        </button>
      </div>
      <div className="window-content">
        <h2 className="pyrex-text mb-4">MY ARTICLES, RESEARCH PAPERS & EVENTS</h2>

        <div className="space-y-6">
          {/* Events Section with Tabs */}
          <div>
            <div className="flex gap-2 mb-4">
              <button
                className={`px-4 py-2 font-bold text-sm border-2 ${
                  activeTab === "upcoming"
                    ? "bg-green-600 text-white border-green-400"
                    : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
                }`}
                onClick={() => setActiveTab("upcoming")}
              >
                📅 UPCOMING
              </button>
              <button
                className={`px-4 py-2 font-bold text-sm border-2 ${
                  activeTab === "previous"
                    ? "bg-red-600 text-white border-red-400"
                    : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
                }`}
                onClick={() => setActiveTab("previous")}
              >
                📋 PREVIOUS
              </button>
            </div>

            {/* Upcoming Events */}
            {activeTab === "upcoming" && (
              <div className="bg-black p-3 border border-green-400">
                {upcomingEvents.map((event, index) => (
                  <div key={index} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-green-400 font-mono text-xs bg-green-400 bg-opacity-20 px-2 py-1 rounded">
                        {event.type.toUpperCase()}
                      </span>
                      <span className="text-green-400 text-xs">UPCOMING</span>
                    </div>
                    <h4 className="text-white font-bold">{event.title}</h4>
                    <p className="text-gray-400 text-sm">
                      {event.date} {event.time && `at ${event.time}`} • {event.venue}
                    </p>
                    {event.description && <p className="text-gray-300 text-sm mt-1">{event.description}</p>}
                    {event.lumaUrl && (
                      <a
                        href={event.lumaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm underline"
                      >
                        RSVP on Luma →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Previous Events */}
            {activeTab === "previous" && (
              <div className="bg-black p-3 border border-red-400">
                {previousEvents.map((event, index) => (
                  <div key={index} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-400 font-mono text-xs bg-red-400 bg-opacity-20 px-2 py-1 rounded">
                        {event.type.toUpperCase()}
                      </span>
                      <span className="text-red-400 text-xs">COMPLETED</span>
                    </div>
                    <h4 className="text-white font-bold">{event.title}</h4>
                    <p className="text-gray-400 text-sm">
                      {event.date} • {event.venue}
                    </p>
                    {event.description && <p className="text-gray-300 text-sm mt-1">{event.description}</p>}
                    {event.replayUrl && (
                      <a
                        href={event.replayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm underline inline-flex items-center gap-1 mt-2"
                      >
                        🎥 Watch Replay →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LinkedIn Articles Section */}
          <div>
            <h3 className="canary-text mb-2 text-yellow-400 font-bold">📝 LinkedIn Articles</h3>
            <div className="bg-black p-3 border border-yellow-400">
              <h4 className="text-yellow-400 mb-3 font-bold">From Consumer Buzz to Enterprise Adoption Series</h4>
              <ul className="space-y-2">
                {articles
                  .filter((article) => article.type === "LinkedIn")
                  .map((article, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {article.version && (
                        <span className="text-yellow-400 font-mono text-xs bg-yellow-400 bg-opacity-20 px-1 py-0.5 rounded flex-shrink-0">
                          {article.version}
                        </span>
                      )}
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm underline"
                      >
                        {article.title}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* Research Papers Section */}
          <div>
            <h3 className="canary-text mb-2 text-yellow-400 font-bold">🎓 Research Papers</h3>
            <div className="bg-black p-3 border border-yellow-400">
              <ul className="space-y-2">
                {articles
                  .filter((article) => article.type === "Research")
                  .map((article, index) => (
                    <li key={index}>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm underline"
                      >
                        {article.title}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
