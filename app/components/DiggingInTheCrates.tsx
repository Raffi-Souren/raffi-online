"use client"

import { useState } from "react"
import { WindowShell } from "../../components/ui/WindowShell"
import { SoundCloudEmbed } from "../../components/ui/SoundCloudEmbed"
import { SOUNDCLOUD_TRACKS, type SoundCloudTrack } from "../../data/soundcloud-tracks"

interface DiggingInTheCratesProps {
  isOpen: boolean
  onClose: () => void
}

export function DiggingInTheCrates({ isOpen, onClose }: DiggingInTheCratesProps) {
  const [selectedTrack, setSelectedTrack] = useState<SoundCloudTrack | null>(SOUNDCLOUD_TRACKS[0] || null)
  const [searchTerm, setSearchTerm] = useState("")

  if (!isOpen) return null

  const filteredTracks = SOUNDCLOUD_TRACKS.filter(
    (track) =>
      track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <WindowShell title="DIGGING IN THE CRATES - SOUNDCLOUD" onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-3">🎧</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Digging in the Crates</h1>
          <p className="text-gray-600 text-sm">Discover rare tracks and hidden gems from SoundCloud</p>
        </div>

        {/* Search */}
        <div className="bg-gray-50 rounded-lg p-4">
          <input
            type="text"
            placeholder="Search tracks or artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Now Playing */}
        {selectedTrack && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block">
              NOW PLAYING
            </h2>
            <SoundCloudEmbed
              embedUrl={selectedTrack.embedUrl}
              title={selectedTrack.title}
              artist={selectedTrack.artist}
            />
          </div>
        )}

        {/* Track List */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-green-400 pb-1 inline-block">
            TRACK CRATES
          </h2>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredTracks.map((track, index) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrack(track)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedTrack?.id === track.id
                    ? "bg-blue-100 border-l-4 border-blue-500"
                    : "bg-white hover:bg-gray-50 border border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-lg">{selectedTrack?.id === track.id ? "🎵" : "🎶"}</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm">{track.title}</h4>
                    <p className="text-xs text-gray-600">{track.artist}</p>
                  </div>
                  {selectedTrack?.id === track.id && <div className="text-blue-500 text-xs font-semibold">PLAYING</div>}
                </div>
              </div>
            ))}
          </div>

          {filteredTracks.length === 0 && (
            <div className="text-center text-gray-500 py-4">No tracks found matching your search</div>
          )}
        </div>

        {/* Stats */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t">
          {filteredTracks.length} tracks available • Curated collection
        </div>
      </div>
    </WindowShell>
  )
}
