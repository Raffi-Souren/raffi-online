"use client"
import { useState, useEffect, useRef } from "react"
import { Shuffle, X } from "lucide-react"

type Track = {
  id: string
  url: string
  title: string
  artist: string
}

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
    artist: "Four Tet",
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
    id: "compton-state-of-mind",
    title: "Compton State of Mind",
    artist: "Miles Davis",
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
    title: "Sango Mix",
    artist: "pincheporvida",
    url: "https://soundcloud.com/pincheporvida/sango2",
  },
  {
    id: "dipset-x-future-i-really-mean",
    title: "Dipset X Future - I Really Mean",
    artist: "sangobeats",
    url: "https://soundcloud.com/sangobeats/dipset-x-future-i-really-mean",
  },
  {
    id: "mos-def-auditorium-2",
    title: "Auditorium",
    artist: "Mos Def",
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
    title: "Me & U (BLK Remix)",
    artist: "Tems",
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
    artist: "Young Thug",
    url: "https://soundcloud.com/youngthugworld/phoenix-1",
  },
  {
    id: "she-notice",
    title: "She Notice",
    artist: "youngthung",
    url: "https://soundcloud.com/youngthung/she-notice",
  },
  {
    id: "casts-of-a-dreamer-full-tape",
    title: "Casts of a Dreamer (Full Tape)",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/casts-of-a-dreamer-full-tape",
  },
  {
    id: "gordo-x-drake-healing-my-pal-al-remix",
    title: "Healing (My Pal Al Remix)",
    artist: "GORDO x Drake",
    url: "https://soundcloud.com/mypalalmusic/gordo-x-drake-healing-my-pal-al-remix-1",
  },
  {
    id: "sade-sweetest-taboo-november-rose-amapiano-remix",
    title: "Sweetest Taboo (November Rose Amapiano Remix)",
    artist: "Sade",
    url: "https://soundcloud.com/novemberrosemusic/sade-sweetest-taboo-november-rose-amapiano-remix",
  },
  {
    id: "name",
    title: "Name",
    artist: "theconcreteleaksystem",
    url: "https://soundcloud.com/theconcreteleaksystem/name",
  },
  {
    id: "mitsubishi-sony",
    title: "Mitsubishi Sony",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/mitsubishi-sony",
  },
]

export default function EasterEgg() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [position, setPosition] = useState({ x: 100, y: 100 })
  const [velocity, setVelocity] = useState({ x: 1.5, y: 1.2 })
  const animationRef = useRef<number>()
  const boundsRef = useRef({ width: 0, height: 0 })

  // Update bounds on resize
  useEffect(() => {
    const updateBounds = () => {
      boundsRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    }

    updateBounds()
    window.addEventListener("resize", updateBounds)
    return () => window.removeEventListener("resize", updateBounds)
  }, [])

  // Bouncing animation - COMPLETELY FIXED
  useEffect(() => {
    const animate = () => {
      setPosition((prev) => {
        const bounds = boundsRef.current
        const boxSize = 50 // Mario box size
        const taskbarHeight = 40 // Account for taskbar

        let newX = prev.x + velocity.x
        let newY = prev.y + velocity.y

        // Bounce off left/right walls
        if (newX <= 0) {
          newX = 0
          velocity.x = Math.abs(velocity.x) // Force positive
        } else if (newX >= bounds.width - boxSize) {
          newX = bounds.width - boxSize
          velocity.x = -Math.abs(velocity.x) // Force negative
        }

        // Bounce off top/bottom walls
        if (newY <= 0) {
          newY = 0
          velocity.y = Math.abs(velocity.y) // Force positive
        } else if (newY >= bounds.height - boxSize - taskbarHeight) {
          newY = bounds.height - boxSize - taskbarHeight
          velocity.y = -Math.abs(velocity.y) // Force negative
        }

        return { x: newX, y: newY }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const loadRandomTrack = () => {
    setIsLoading(true)
    const randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    setCurrentTrack(randomTrack)
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleClick = () => {
    setIsModalOpen(true)
    if (!currentTrack) {
      loadRandomTrack()
    }
  }

  const buildEmbedUrl = (track: Track) => {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [isModalOpen])

  return (
    <>
      {/* Fixed Mario Question Mark - z-40 pointer-events-auto */}
      <div
        className="mario-box fixed z-40 cursor-pointer pointer-events-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {/* Modal with fixed backdrop and proper scrolling */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Fixed backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-70" onClick={() => setIsModalOpen(false)} />

          {/* Modal panel with max height and scroll */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div>
                  <h2 className="text-lg font-bold text-white">Digging in the Crates</h2>
                  <p className="text-sm text-gray-400">RAF's SoundCloud Gems • {SOUNDCLOUD_TRACKS.length} tracks</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="p-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                  <span className="ml-3 text-white">Loading track...</span>
                </div>
              ) : currentTrack ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{currentTrack.title}</h3>
                      <p className="text-sm text-gray-400">{currentTrack.artist}</p>
                    </div>
                    <button
                      onClick={loadRandomTrack}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg flex items-center gap-2 transition-colors"
                      disabled={isLoading}
                    >
                      <Shuffle className="w-4 h-4" />
                      Next Track
                    </button>
                  </div>

                  <div className="w-full">
                    <iframe
                      width="100%"
                      height="166"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      src={buildEmbedUrl(currentTrack)}
                      className="w-full rounded-md"
                      key={currentTrack.id}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <button
                    onClick={loadRandomTrack}
                    className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg"
                  >
                    Start Discovery
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-700">
                <span>Click outside to close • ESC to exit</span>
                {currentTrack && (
                  <a
                    href={currentTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    View on SoundCloud →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
