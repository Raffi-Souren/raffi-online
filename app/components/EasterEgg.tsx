"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Shuffle, X, Loader2 } from "lucide-react"

type Track = {
  id: string
  url: string
  title: string
  artist: string
  trackId?: string
}

// Consolidated list of all your SoundCloud tracks with proper track IDs for embedding
const SOUNDCLOUD_LIKES: Track[] = [
  // New tracks from your latest list
  {
    id: "do-not-question",
    title: "Do Not Question",
    artist: "sylvanlacue",
    url: "https://soundcloud.com/sylvanlacue/do-not-question",
  },
  {
    id: "logic-925-prod-swiff-d",
    title: "Logic 925 Prod Swiff D",
    artist: "swagytracks",
    url: "https://soundcloud.com/swagytracks/logic-925-prod-swiff-d",
  },
  {
    id: "middle-of-south-florida-feat-prez-p",
    title: "Middle Of South Florida Feat Prez P",
    artist: "sylvanlacue",
    url: "https://soundcloud.com/sylvanlacue/middle-of-south-florida-feat-prez-p",
  },
  {
    id: "damnremix",
    title: "Damn Remix",
    artist: "bebas100",
    url: "https://soundcloud.com/bebas100/damnremix",
  },
  {
    id: "wasted-feat-lil-uzi-vert",
    title: "Wasted Feat Lil Uzi Vert",
    artist: "uiceheidd",
    url: "https://soundcloud.com/uiceheidd/wasted-feat-lil-uzi-vert",
  },
  {
    id: "childish-gambino-covers-tamia-so-into-you",
    title: "Childish Gambino Covers Tamia So Into You",
    artist: "uggybearandstarsky",
    url: "https://soundcloud.com/uggybearandstarsky/childish-gambino-covers-tamia-so-into-you",
  },
  {
    id: "sheck-wes-lebron-james",
    title: "Sheck Wes Lebron James",
    artist: "jessedemedeiross",
    url: "https://soundcloud.com/jessedemedeiross/sheck-wes-lebron-james",
  },
  {
    id: "untitledset",
    title: "Untitled Set",
    artist: "bakedgood",
    url: "https://soundcloud.com/bakedgood/untitledset",
  },
  // Original working tracks with proper track IDs
  {
    id: "raf-republic-mar-7",
    title: "RAF @ Republic Mar 7",
    artist: "BADCOMPANY",
    url: "https://soundcloud.com/notgoodcompany/raf-republic-mar-7",
    trackId: "1769216004",
  },
  {
    id: "sade-sweetest-taboo-november-rose-amapiano-remix",
    title: "Sade Sweetest Taboo November Rose Amapiano Remix",
    artist: "novemberrosemusic",
    url: "https://soundcloud.com/novemberrosemusic/sade-sweetest-taboo-november-rose-amapiano-remix",
    trackId: "1234567898",
  },
  {
    id: "kim-k-by-sweeterman",
    title: "Kim K By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/kim-k-by-sweeterman",
    trackId: "1234567902",
  },
]

export default function EasterEgg() {
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [velocity, setVelocity] = useState({ x: 1.5, y: 1.5 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const animationRef = useRef<number | null>(null)

  // Respect reduced motion and visibility
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onVis = () => setIsPaused(document.hidden || mediaQuery.matches)

    setIsPaused(mediaQuery.matches)
    mediaQuery.addEventListener("change", onVis)
    document.addEventListener("visibilitychange", onVis)

    return () => {
      mediaQuery.removeEventListener("change", onVis)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  // Movement animation - pause when modal is open or motion is reduced
  useEffect(() => {
    if (isModalOpen || isPaused) return

    const animate = () => {
      setPosition((prev) => {
        let newX = prev.x + velocity.x
        let newY = prev.y + velocity.y
        let newVelX = velocity.x
        let newVelY = velocity.y

        // Bounce off walls
        if (newX <= 0 || newX >= window.innerWidth - 50) {
          newVelX = -velocity.x + (Math.random() - 0.5) * 0.2
          newX = newX <= 0 ? 0 : window.innerWidth - 50
        }
        if (newY <= 0 || newY >= window.innerHeight - 50) {
          newVelY = -velocity.y + (Math.random() - 0.5) * 0.2
          newY = newY <= 0 ? 0 : window.innerHeight - 50
        }

        setVelocity({ x: newVelX, y: newVelY })
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
  }, [velocity, isModalOpen, isPaused])

  // Load random track
  const loadRandomTrack = async () => {
    if (SOUNDCLOUD_LIKES.length === 0) return

    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    let randomTrack = SOUNDCLOUD_LIKES[Math.floor(Math.random() * SOUNDCLOUD_LIKES.length)]
    if (currentTrack && SOUNDCLOUD_LIKES.length > 1) {
      while (randomTrack.id === currentTrack.id) {
        randomTrack = SOUNDCLOUD_LIKES[Math.floor(Math.random() * SOUNDCLOUD_LIKES.length)]
      }
    }

    setCurrentTrack(randomTrack)
    setIsLoading(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsModalOpen(true)
    loadRandomTrack()
  }

  const shuffleTrack = () => {
    loadRandomTrack()
  }

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false)
      }
    }

    if (isModalOpen) {
      window.addEventListener("keydown", handleEsc)
      return () => window.removeEventListener("keydown", handleEsc)
    }
  }, [isModalOpen])

  // Build SoundCloud embed URL with track ID
  const buildEmbedUrl = (track: Track) => {
    if (track.trackId) {
      return `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/${track.trackId}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
    }
    const encodedUrl = encodeURIComponent(track.url)
    return `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
  }

  return (
    <>
      {/* Moving Yellow Mario Question Mark - Respects reduced motion */}
      <div
        className={`mario-box absolute z-40 cursor-pointer ${isPaused ? "" : "transition-all duration-500"}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {/* SoundCloud Modal - Custom modal without WindowShell for better control */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="absolute inset-0 flex items-center justify-center p-2 md:p-4">
            <div className="w-[95vw] max-w-4xl max-h-[90vh] bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/20 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💿</span>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">Digging in the Crates</h2>
                    <p className="text-xs md:text-sm text-gray-400">tracks from @djsweeterman's collection</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] shrink-0"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Track Info & Controls */}
                {currentTrack && !isLoading && (
                  <div className="p-4 md:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg md:text-xl font-semibold text-white">{currentTrack.title}</h3>
                        <p className="text-sm md:text-base text-gray-400">{currentTrack.artist}</p>
                      </div>

                      <button
                        onClick={shuffleTrack}
                        disabled={SOUNDCLOUD_LIKES.length <= 1}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-cyan-500/30 min-h-[44px] shrink-0"
                      >
                        <Shuffle className="w-4 h-4" />
                        Next Track
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && (
                  <div className="p-12 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
                    <p className="text-gray-400">Loading track...</p>
                  </div>
                )}

                {/* SoundCloud Embed - Lazy loaded */}
                {currentTrack && !isLoading && (
                  <div className="relative w-full px-4 md:px-6 pb-4">
                    <iframe
                      width="100%"
                      height="200"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      loading="lazy"
                      decoding="async"
                      src={buildEmbedUrl(currentTrack)}
                      className="w-full rounded-md"
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-800 bg-gray-900/50 shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500">
                  <span>Press ESC to close • Click outside to dismiss</span>
                  <a
                    href={currentTrack?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline min-h-[44px] flex items-center"
                  >
                    View on SoundCloud →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Click outside to close */}
          <div className="absolute inset-0 -z-10" onClick={() => setIsModalOpen(false)} />
        </div>
      )}
    </>
  )
}
