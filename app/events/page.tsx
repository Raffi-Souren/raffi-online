"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Users, ExternalLink, Play } from "lucide-react"
import { formatDate } from "@/lib/utils"
import eventsData from "@/data/events.json"

export default function EventsPage() {
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming")
  const { events } = eventsData

  const filteredEvents = events.filter((event) => event.status === filter)

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl font-bold mb-4">Speaking & Events</h1>
          <p className="text-muted text-lg">Talks, panels, and appearances on AI, technology, and the future of work</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="glass-card p-1 flex">
            <Button
              variant={filter === "upcoming" ? "default" : "ghost"}
              onClick={() => setFilter("upcoming")}
              className="rounded-r-none"
            >
              Upcoming
            </Button>
            <Button
              variant={filter === "past" ? "default" : "ghost"}
              onClick={() => setFilter("past")}
              className="rounded-l-none"
            >
              Past
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm bg-accent/20 text-accent px-2 py-1 rounded uppercase">
                        {event.type}
                      </span>
                      {event.status === "upcoming" && (
                        <span className="text-green-400 text-sm font-medium">Upcoming</span>
                      )}
                    </div>
                    <CardTitle className="text-xl mb-2 group-hover:text-accent transition-colors">
                      {event.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      {formatDate(event.date)} at {event.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{event.venue}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{event.attendees} attendees</span>
                  </div>
                </div>

                <p className="text-muted mb-4">{event.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {event.topics.map((topic) => (
                    <span key={topic} className="text-xs bg-secondary text-muted px-2 py-1 rounded">
                      {topic}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  {event.lumaUrl && event.status === "upcoming" && (
                    <Button asChild>
                      <a
                        href={event.lumaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        RSVP on Luma
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}

                  {event.recordingUrl && event.status === "past" && (
                    <Button variant="outline" asChild>
                      <a
                        href={event.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Watch Recording
                      </a>
                    </Button>
                  )}

                  {event.slidesUrl && event.status === "past" && (
                    <Button variant="outline" asChild>
                      <a
                        href={event.slidesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        View Slides
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted">No {filter} events at the moment.</p>
          </div>
        )}
      </div>
    </div>
  )
}
