"use client"

import { useState } from "react"
import { WindowShell } from "../../components/ui/WindowShell"

interface Event {
  id: number
  title: string
  date: string
  location: string
  description: string
  type: "speaking" | "upcoming"
  status: "upcoming" | "previous"
}

const events: Event[] = [
  {
    id: 1,
    title: "Building Gen AI for Capital Markets",
    date: "2025-08-21 at 18:00",
    location: "NYC",
    description:
      "Exploring the intersection of artificial intelligence and financial technology in modern capital markets.",
    type: "speaking",
    status: "upcoming",
  },
  {
    id: 2,
    title: "AI Architecture Patterns Workshop",
    date: "2025-09-15 at 14:00",
    location: "San Francisco",
    description: "Hands-on workshop covering scalable AI system design and implementation strategies.",
    type: "upcoming",
    status: "upcoming",
  },
  {
    id: 3,
    title: "Future of Technology Consulting",
    date: "2024-11-20 at 16:00",
    location: "Boston",
    description: "Panel discussion on emerging trends in technology consulting and digital transformation.",
    type: "speaking",
    status: "previous",
  },
]

interface NotesWindowProps {
  isOpen: boolean
  onClose: () => void
}

export function NotesWindow({ isOpen, onClose }: NotesWindowProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "previous">("upcoming")

  if (!isOpen) return null

  const upcomingEvents = events.filter((event) => event.status === "upcoming")
  const previousEvents = events.filter((event) => event.status === "previous")

  return (
    <WindowShell title="NOTES" onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">MY ARTICLES, RESEARCH PAPERS & EVENTS</h1>
          <p className="text-gray-600 text-sm">Collection of writings, research, and speaking engagements</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "upcoming"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            📅 UPCOMING EVENTS
          </button>
          <button
            onClick={() => setActiveTab("previous")}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "previous"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            📋 PREVIOUS EVENTS
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-50 rounded-lg p-4">
          {activeTab === "upcoming" && (
            <div>
              <div className="text-lg font-semibold text-green-600 mb-4 border-b-2 border-green-400 pb-1 inline-block">
                UPCOMING EVENTS
              </div>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="bg-white border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">SPEAKING</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">UPCOMING</span>
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

          {activeTab === "previous" && (
            <div>
              <div className="text-lg font-semibold text-gray-600 mb-4 border-b-2 border-gray-400 pb-1 inline-block">
                PREVIOUS EVENTS
              </div>
              <div className="space-y-3">
                {previousEvents.map((event) => (
                  <div key={event.id} className="bg-white border-l-4 border-gray-400 rounded-lg p-4">
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

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t">
          For speaking inquiries and collaboration opportunities, please reach out via LinkedIn or email.
        </div>
      </div>
    </WindowShell>
  )
}
