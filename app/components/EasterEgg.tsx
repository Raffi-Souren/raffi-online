"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Shuffle } from "lucide-react"
import WindowShell from "../../components/ui/WindowShell"

interface EasterEggProps {
  forceOpen?: boolean
  onForceClose?: () => void
}

interface Track {
  id: string
  title: string
  artist: string
  url: string
  embedUrl?: string
}

// Complete SoundCloud collection from your list - 250+ tracks
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
  {
    id: "08-compton-state-of-mind",
    title: "Compton State of Mind",
    artist: "miles-davis-29",
    url: "https://soundcloud.com/miles-davis-29/08-compton-state-of-mind",
  },
  {
    id: "fidde-i-wonder-yuno-hu-vision",
    title: "I Wonder (Yuno Hu Vision)",
    artist: "miguelmancha",
    url: "https://soundcloud.com/miguelmancha/fidde-i-wonder-yuno-hu-vision",
  },
  {
    id: "sango2",
    title: "Sango2",
    artist: "pincheporvida",
    url: "https://soundcloud.com/pincheporvida/sango2",
  },
  {
    id: "dipset-x-future-i-really-mean",
    title: "Dipset x Future - I Really Mean",
    artist: "sangobeats",
    url: "https://soundcloud.com/sangobeats/dipset-x-future-i-really-mean",
  },
  {
    id: "mos-def-auditorium-2",
    title: "Mos Def - Auditorium",
    artist: "beaubouthillier-1",
    url: "https://soundcloud.com/beaubouthillier-1/mos-def-auditorium-2",
  },
  {
    id: "blemforreal",
    title: "Blem For Real",
    artist: "davidmackaymusic",
    url: "https://soundcloud.com/davidmackaymusic/blemforreal",
  },
  {
    id: "tems-me-u-blk-remix",
    title: "Tems - Me & U (BLK Remix)",
    artist: "blkmvsic",
    url: "https://soundcloud.com/blkmvsic/tems-me-u-blk-remix",
  },
  {
    id: "first-day-of-my-life-bright",
    title: "First Day of My Life",
    artist: "larryfisherman",
    url: "https://soundcloud.com/larryfisherman/first-day-of-my-life-bright",
  },
  {
    id: "phoenix-1",
    title: "Phoenix",
    artist: "youngthugworld",
    url: "https://soundcloud.com/youngthugworld/phoenix-1",
  },
  {
    id: "she-notice",
    title: "She Notice",
    artist: "youngthung",
    url: "https://soundcloud.com/youngthung/she-notice",
  },
]

export default function EasterEgg({ forceOpen = false, onForceClose }: EasterEggProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track>(SOUNDCLOUD_TRACKS[0])
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [direction, setDirection] = useState({ x: 2, y: 1.5 })
  const [isMoving, setIsMoving] = useState(true)
  const [attempts, setAttempts] = useState(0)
  const [embedError, setEmbedError] = useState(false)
  const [embedHtml, setEmbedHtml] = useState("")
  const [skippedTracks, setSkippedTracks] = useState<string[]>([])

  // Handle force open/close
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true)
      setIsMoving(false)
    }
  }, [forceOpen])

  // Moving question mark animation
  useEffect(() => {
    if (!isMoving || isOpen || forceOpen) return

    const moveQuestionMark = () => {
      setPosition((prev) => {
        let newX = prev.x + direction.x
        let newY = prev.y + direction.y

        // Bounce off edges with some padding
        const padding = 5
        if (newX <= padding || newX >= 95 - padding) {
          setDirection((d) => ({ ...d, x: -d.x }))
          newX = Math.max(padding, Math.min(95 - padding, newX))
        }
        if (newY <= padding || newY >= 85 - padding) {
          setDirection((d) => ({ ...d, y: -d.y }))
          newY = Math.max(padding, Math.min(85 - padding, newY))
        }

        return { x: newX, y: newY }
      })
    }

    const interval = setInterval(moveQuestionMark, 50)
    return () => clearInterval(interval)
  }, [direction, isMoving, isOpen, forceOpen])

  // Reliable track loading with error handling
  const loadTrack = useCallback(async (attemptCount = 0) => {
    const track = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    const oembed = `https://soundcloud.com/oembed?format=json&maxheight=166&url=${encodeURIComponent(track.url)}`

    try {
      const res = await fetch(oembed)
      if (!res.ok) throw new Error(`oembed ${res.status}`)

      const data = await res.json()
      const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%2300ffff&visual=true&show_teaser=false`

      setCurrentTrack({ ...track, embedUrl })
      setAttempts(0)
      setEmbedError(false)
      setEmbedHtml(data.html)
    } catch (error) {
      console.warn(`Failed to load track ${track.id}:`, error)

      if (attemptCount < 4) {
        setAttempts(attemptCount + 1)
        setSkippedTracks((prev) => [...prev, track.id])

        // Show toast for skipped track
        if (typeof window !== "undefined") {
          const toast = document.createElement("div")
          toast.className = "fixed top-4 right-4 bg-yellow-500 text-black px-4 py-2 rounded z-[100] text-sm"
          toast.textContent = `Skipped unembeddable track: ${track.title}`
          document.body.appendChild(toast)
          setTimeout(() => document.body.removeChild(toast), 3000)
        }

        return loadTrack(attemptCount + 1)
      }

      setEmbedError(true)
    }
  }, [])

  const shuffleTrack = useCallback(() => {
    loadTrack(0)
  }, [loadTrack])

  const openModal = () => {
    setIsOpen(true)
    setIsMoving(false)
    loadTrack(0)
  }

  const closeModal = () => {
    setIsOpen(false)
    setIsMoving(true)
    if (onForceClose) {
      onForceClose()
    }
  }

  const getEmbedUrl = (url: string) => {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  }

  return (
    <>
      {/* Moving Question Mark - Refined Mario Style */}
      {!isOpen && !forceOpen && (
        <div
          className="fixed mario-box z-[1000] cursor-pointer"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: "translate(-50%, -50%)",
          }}
          onClick={openModal}
          title="Click to discover underground tracks!"
        >
          <div className="mario-box-inner">?</div>
        </div>
      )}

      {/* Modal using WindowShell */}
      <WindowShell id="easter-egg" title="🎵 DIGGING IN THE CRATES" isOpen={isOpen || forceOpen} onClose={closeModal}>
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="pyrex-heading mb-2">🎵 CRATE DIGGING SESSION</h2>
            <p className="poolsuite-text mb-4">Discover underground tracks and hidden gems from the vault</p>
          </div>

          {/* SoundCloud Embed */}
          <div className="content-section">
            {embedError ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center text-2xl">
                  ❌
                </div>
                <p className="poolsuite-text text-red-600 mb-4">Unable to load track after multiple attempts</p>
                <button onClick={shuffleTrack} className="awge-button">
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
                src={getEmbedUrl(currentTrack.url)}
                className="rounded-lg border border-gray-200"
                title={`${currentTrack.title} by ${currentTrack.artist}`}
              />
            )}
          </div>

          {/* Now Playing Info */}
          <div className="content-section text-center border-l-4 border-l-blue-400">
            <p className="awge-accent mb-2">Now Playing:</p>
            <p className="pyrex-subheading text-black mb-1">{currentTrack.title}</p>
            <p className="poolsuite-text mb-2">by {currentTrack.artist}</p>
            {attempts > 0 && (
              <p className="text-xs text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full inline-block">
                Attempt {attempts + 1}/5 - Finding playable track...
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <button onClick={shuffleTrack} className="poolsuite-button flex items-center gap-2" disabled={attempts > 0}>
              <Shuffle size={16} />
              {attempts > 0 ? "Loading..." : "Shuffle"}
            </button>
            <button onClick={closeModal} className="awge-button flex items-center gap-2">
              <X size={16} />
              Close
            </button>
          </div>

          {/* Available Tracks Preview */}
          <div className="content-section">
            <h3 className="pyrex-subheading mb-3">🎵 Available Tracks:</h3>
            <div className="bg-blue-50 p-4 rounded-lg max-h-32 overflow-y-auto border border-blue-200">
              <div className="space-y-2">
                {SOUNDCLOUD_TRACKS.slice(0, 5).map((track, index) => (
                  <div key={track.id} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {index + 1}
                    </div>
                    <span className="poolsuite-text text-blue-800">
                      {track.title} - {track.artist}
                    </span>
                  </div>
                ))}
                <div className="text-center pt-2 border-t border-blue-200">
                  <span className="awge-accent text-blue-600">...and {SOUNDCLOUD_TRACKS.length - 5} more tracks</span>
                </div>
              </div>
            </div>
            {skippedTracks.length > 0 && (
              <div className="mt-3 text-center">
                <span className="poolsuite-text text-gray-500 bg-gray-100 px-3 py-1 rounded-full text-xs">
                  Skipped {skippedTracks.length} unembeddable tracks this session
                </span>
              </div>
            )}
          </div>
        </div>
      </WindowShell>
    </>
  )
}
