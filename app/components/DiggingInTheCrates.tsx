"use client"

import { useState, useEffect } from "react"
import WindowShell from "../../components/ui/WindowShell"
import { SoundCloudEmbed } from "../../components/ui/SoundCloudEmbed"
import { SOUNDCLOUD_TRACKS, type Track } from "../../data/soundcloud-tracks"

interface DiggingInTheCratesProps {
  isOpen: boolean
  onClose: () => void
}

export default function DiggingInTheCrates({ isOpen, onClose }: DiggingInTheCratesProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [shuffledTracks, setShuffledTracks] = useState<Track[]>([])
  const [discoveredCount, setDiscoveredCount] = useState(1)

  // Initialize tracks on mount
  useEffect(() => {
    const shuffled = [...SOUNDCLOUD_TRACKS].sort(() => Math.random() - 0.5)
    setShuffledTracks(shuffled)
    if (shuffled.length > 0) {
      setCurrentTrack(shuffled[0])
    }
  }, [])

  // Filter tracks based on search
  const filteredTracks = shuffledTracks.filter(
    (track) =>
      track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Handle shuffle
  const handleShuffle = () => {
    const shuffled = [...SOUNDCLOUD_TRACKS].sort(() => Math.random() - 0.5)
    setShuffledTracks(shuffled)
    if (shuffled.length > 0) {
      setCurrentTrack(shuffled[0])
      setDiscoveredCount((prev) => prev + 1)
    }
  }

  // Handle random track
  const handleRandom = () => {
    const randomIndex = Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)
    const randomTrack = SOUNDCLOUD_TRACKS[randomIndex]
    setCurrentTrack(randomTrack)
    setDiscoveredCount((prev) => prev + 1)
  }

  // Handle track selection
  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track)
    setDiscoveredCount((prev) => prev + 1)
  }

  return (
    <WindowShell id="digging-crates" title="DIGGING IN THE CRATES - SOUNDCLOUD" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="content-section">
          <h2 className="section-title">Digging in the Crates</h2>
          <p className="text-xs text-gray-600">Discover rare tracks and hidden gems from SoundCloud</p>
        </div>

        {/* Controls */}
        <div className="content-section">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={handleRandom} className="xp-button text-xs bg-orange-100 hover:bg-orange-200">
              🎲 Random
            </button>
            <button onClick={handleShuffle} className="xp-button text-xs bg-blue-100 hover:bg-blue-200">
              🔀 Shuffle
            </button>
          </div>

          <input
            type="text"
            placeholder="Search tracks or artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="xp-input w-full"
          />
        </div>

        {/* Now Playing */}
        {currentTrack && (
          <div className="content-section">
            <h3 className="section-title">Now Playing</h3>
            <div className="bg-white p-3 rounded border border-gray-200 mb-3">
              <div className="font-semibold text-sm text-gray-900">{currentTrack.title}</div>
              <div className="text-xs text-gray-600 mb-2">by {currentTrack.artist}</div>
              <SoundCloudEmbed
                url={currentTrack.url}
                title={`${currentTrack.title} by ${currentTrack.artist}`}
                height={120}
              />
            </div>
          </div>
        )}

        {/* Track List */}
        <div className="content-section">
          <h3 className="section-title">Track Crates</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredTracks.map((track, index) => (
              <div key={track.id} onClick={() => handleTrackSelect(track)} className="track-item">
                <div className="track-number">{(index + 1).toString().padStart(2, "0")}</div>
                <div className="track-info">
                  <div className="track-title">{track.title}</div>
                  <div className="track-artist">{track.artist}</div>
                </div>
                <div className="text-orange-500 text-xs">{currentTrack?.id === track.id ? "🎵" : "▶"}</div>
              </div>
            ))}
          </div>

          {filteredTracks.length === 0 && (
            <div className="text-center text-gray-500 py-4 text-xs">No tracks found matching your search</div>
          )}
        </div>

        {/* Stats */}
        <div className="content-section">
          <div className="text-xs text-gray-600 text-center">
            {filteredTracks.length} tracks available • {discoveredCount} discoveries made
          </div>
        </div>
      </div>
    </WindowShell>
  )
}
