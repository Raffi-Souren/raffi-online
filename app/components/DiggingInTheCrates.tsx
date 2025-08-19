"use client"

import { useState, useCallback } from "react"
import { Shuffle, X } from "lucide-react"
import WindowShell from "../../components/ui/WindowShell"

interface Track {
  id: string
  title: string
  artist: string
  url: string
}

// SoundCloud tracks from your collection
const SOUNDCLOUD_TRACKS: Track[] = [
  {
    id: "yukon-x-up-dj-hunny-bee-remix",
    title: "Yukon X Up (DJ Hunny Bee Remix)",
    artist: "djhunnybee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-remix",
  },
  {
    id: "four-tet-insect-near-piha-beach",
    title: "Insect Near Piha Beach",
    artist: "user-982065028",
    url: "https://soundcloud.com/user-982065028/four-tet-insect-near-piha-beach",
  },
  {
    id: "habibi-funk-beirut",
    title: "Habibi Funk Beirut",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-beirut",
  },
  {
    id: "chopsuey",
    title: "Chop Suey",
    artist: "osive",
    url: "https://soundcloud.com/osive/chopsuey",
  },
  {
    id: "gordos-dilemma",
    title: "Gordo's Dilemma",
    artist: "gordoszn",
    url: "https://soundcloud.com/gordoszn/gordos-dilemma",
  },
]

interface DiggingInTheCratesProps {
  isOpen: boolean
  onClose: () => void
}

export default function DiggingInTheCrates({ isOpen, onClose }: DiggingInTheCratesProps) {
  const [currentTrack, setCurrentTrack] = useState<Track>(SOUNDCLOUD_TRACKS[0])
  const [embedError, setEmbedError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const shuffleTrack = useCallback(() => {
    setIsLoading(true)
    setEmbedError(false)

    const randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    setCurrentTrack(randomTrack)

    // Simulate loading time
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }, [])

  const getEmbedUrl = (url: string) => {
    if (!url) return null
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  }

  if (!isOpen) return null

  const embedUrl = getEmbedUrl(currentTrack.url)

  return (
    <WindowShell title="🎵 DIGGING IN THE CRATES" onClose={onClose}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🎵 CRATE DIGGING SESSION</h2>
          <p className="text-gray-600 mb-4">Discover underground tracks and hidden gems from the vault</p>
        </div>

        {/* SoundCloud Embed */}
        <div className="bg-gray-50 rounded-lg p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center text-2xl animate-spin">
                🎵
              </div>
              <p className="text-gray-600">Loading track...</p>
            </div>
          ) : embedError || !embedUrl ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center text-2xl">
                ❌
              </div>
              <p className="text-red-600 mb-4">Unable to load track</p>
              <button onClick={shuffleTrack} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Try Another Track
              </button>
            </div>
          ) : (
            <iframe
              width="100%"
              height="300"
              scrolling="no"
              frameBorder="no"
              allow="autoplay"
              src={embedUrl}
              className="rounded-lg border border-gray-200"
              title={`${currentTrack.title} by ${currentTrack.artist}`}
              onError={() => setEmbedError(true)}
            />
          )}
        </div>

        {/* Now Playing Info */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <p className="text-blue-800 font-semibold mb-2">Now Playing:</p>
          <p className="text-gray-900 font-bold text-lg mb-1">{currentTrack.title}</p>
          <p className="text-gray-600">by {currentTrack.artist}</p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={shuffleTrack}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            disabled={isLoading}
          >
            <Shuffle size={16} />
            {isLoading ? "Loading..." : "Shuffle"}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            <X size={16} />
            Close
          </button>
        </div>

        {/* Available Tracks Preview */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">🎵 Available Tracks:</h3>
          <div className="bg-blue-50 p-4 rounded-lg max-h-32 overflow-y-auto border border-blue-200">
            <div className="space-y-2">
              {SOUNDCLOUD_TRACKS.slice(0, 5).map((track, index) => (
                <div key={track.id} className="flex items-center gap-2 text-sm">
                  <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {index + 1}
                  </div>
                  <span className="text-blue-800">
                    {track.title} - {track.artist}
                  </span>
                </div>
              ))}
              <div className="text-center pt-2 border-t border-blue-200">
                <span className="text-blue-600 font-semibold">...and {SOUNDCLOUD_TRACKS.length - 5} more tracks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WindowShell>
  )
}
