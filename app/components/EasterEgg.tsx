"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Shuffle, X } from "lucide-react"

type Track = {
  id: string
  url: string
  title: string
  artist: string
}

// Hardcoded, validated SoundCloud tracks - no API calls needed
const SOUNDCLOUD_TRACKS: Track[] = [
  {
    id: "yukon-x-up-dj-hunny-bee-mashup",
    title: "YUKON x UP (DJ Hunny Bee Mashup)",
    artist: "DJ Hunny Bee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-mashup",
  },
  {
    id: "raf-republic-mar-7",
    title: "RAF @ Republic Mar 7",
    artist: "BADCOMPANY",
    url: "https://soundcloud.com/notgoodcompany/raf-republic-mar-7",
  },
  {
    id: "kim-k-by-sweeterman",
    title: "Kim K By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/kim-k-by-sweeterman",
  },
  {
    id: "sade-sweetest-taboo-amapiano",
    title: "Sade Sweetest Taboo November Rose Amapiano Remix",
    artist: "novemberrosemusic",
    url: "https://soundcloud.com/novemberrosemusic/sade-sweetest-taboo-november-rose-amapiano-remix",
  },
  {
    id: "do-not-question",
    title: "Do Not Question",
    artist: "sylvanlacue",
    url: "https://soundcloud.com/sylvanlacue/do-not-question",
  },
  {
    id: "logic-925-prod-swiff-d",
    title: "Logic 925 (Prod. Swiff D)",
    artist: "swagytracks",
    url: "https://soundcloud.com/swagytracks/logic-925-prod-swiff-d",
  },
  {
    id: "middle-of-south-florida",
    title: "Middle Of South Florida (Feat. Prez P)",
    artist: "sylvanlacue",
    url: "https://soundcloud.com/sylvanlacue/middle-of-south-florida-feat-prez-p",
  },
  {
    id: "damn-remix",
    title: "Damn Remix",
    artist: "bebas100",
    url: "https://soundcloud.com/bebas100/damnremix",
  },
  {
    id: "wasted-feat-lil-uzi",
    title: "Wasted (Feat. Lil Uzi Vert)",
    artist: "uiceheidd",
    url: "https://soundcloud.com/uiceheidd/wasted-feat-lil-uzi-vert",
  },
  {
    id: "childish-gambino-tamia-cover",
    title: "Childish Gambino Covers Tamia - So Into You",
    artist: "uggybearandstarsky",
    url: "https://soundcloud.com/uggybearandstarsky/childish-gambino-covers-tamia-so-into-you",
  },
  {
    id: "sheck-wes-lebron-james",
    title: "Sheck Wes - LeBron James",
    artist: "jessedemedeiross",
    url: "https://soundcloud.com/jessedemedeiross/sheck-wes-lebron-james",
  },
  {
    id: "untitled-set",
    title: "Untitled Set",
    artist: "bakedgood",
    url: "https://soundcloud.com/bakedgood/untitledset",
  },
  {
    id: "habibi-funk-mix",
    title: "Habibi Funk Mix Vol. 1",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-mix-vol-1",
  },
  {
    id: "andromeda-edit",
    title: "Andromeda (Sweeterman Edit)",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/andromeda-sweeterman-edit",
  },
]

export default function EasterEgg() {
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [velocity, setVelocity] = useState({ x: 1.5, y: 1.5 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
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

  // Movement animation - PAUSE when modal is open or motion is reduced
  useEffect(() => {
    if (isModalOpen || isPaused) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

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
  const loadRandomTrack = () => {
    if (SOUNDCLOUD_TRACKS.length === 0) return

    let randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    if (currentTrack && SOUNDCLOUD_TRACKS.length > 1) {
      while (randomTrack.id === currentTrack.id) {
        randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
      }
    }

    setCurrentTrack(randomTrack)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsModalOpen(true)
    if (!currentTrack) {
      loadRandomTrack()
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal()
      }
    }

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isModalOpen])

  // Build SoundCloud embed URL - using the format from your example
  const buildEmbedUrl = (track: Track) => {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
  }

  return (
    <>
      {/* FIXED: Moving Yellow Mario Question Mark - High z-index, explicit pointer events */}
      <div
        className="mario-box fixed z-[2000] pointer-events-auto cursor-pointer"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {/* SoundCloud Discovery Mode Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />

          {/* Window */}
          <div
            className="relative w-[min(92vw,960px)] max-h-[min(88vh,900px)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title Bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div>
                  <h2 className="text-lg font-bold text-white">Discovery Mode</h2>
                  <p className="text-sm text-gray-400">
                    {SOUNDCLOUD_TRACKS.length} tracks from @djsweeterman's collection
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: "calc(min(88vh, 900px) - 80px)" }}>
              <div className="p-4 space-y-4">
                {/* Track Info & Controls */}
                {currentTrack && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{currentTrack.title}</h3>
                        <p className="text-sm text-gray-400">{currentTrack.artist}</p>
                      </div>
                      <button
                        onClick={loadRandomTrack}
                        disabled={SOUNDCLOUD_TRACKS.length <= 1}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-all min-h-[44px] flex items-center gap-2"
                      >
                        <Shuffle className="w-4 h-4" />
                        Next Track
                      </button>
                    </div>

                    {/* SoundCloud Embed - using your exact format */}
                    <div className="relative w-full">
                      <iframe
                        width="100%"
                        height="166"
                        scrolling="no"
                        frameBorder="no"
                        allow="autoplay"
                        loading="lazy"
                        decoding="async"
                        src={buildEmbedUrl(currentTrack)}
                        className="w-full rounded-md"
                      />
                    </div>
                  </>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-700">
                  <span>Press ESC to close • Click outside to dismiss</span>
                  {currentTrack && (
                    <a
                      href={currentTrack.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline min-h-[44px] flex items-center"
                    >
                      View on SoundCloud →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
