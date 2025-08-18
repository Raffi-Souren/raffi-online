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
  {
    id: "casts-of-a-dreamer-full-tape",
    title: "Casts of a Dreamer (Full Tape)",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/casts-of-a-dreamer-full-tape",
  },
  {
    id: "gordo-x-drake-healing-my-pal-al-remix-1",
    title: "Gordo x Drake - Healing (My Pal Al Remix)",
    artist: "mypalalmusic",
    url: "https://soundcloud.com/mypalalmusic/gordo-x-drake-healing-my-pal-al-remix-1",
  },
  {
    id: "sade-sweetest-taboo-november-rose-amapiano-remix",
    title: "Sade - Sweetest Taboo (November Rose Amapiano Remix)",
    artist: "novemberrosemusic",
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

// Spinner keyframes as a CSS string
const spinnerCSS = `
  @keyframes easter-egg-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .easter-egg-spinner {
    animation: easter-egg-spin 1s linear infinite;
  }
`

export default function EasterEgg() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // SIMPLIFIED POSITIONING - Start in center, move predictably
  const [x, setX] = useState(300)
  const [y, setY] = useState(200)
  const [dx, setDx] = useState(2)
  const [dy, setDy] = useState(1.5)

  const intervalRef = useRef<NodeJS.Timeout>()

  // Add CSS to document head
  useEffect(() => {
    const styleElement = document.createElement("style")
    styleElement.textContent = spinnerCSS
    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // SIMPLE ANIMATION LOOP - No complex RAF, just setInterval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setX((prevX) => {
        const newX = prevX + dx
        const maxX = window.innerWidth - 60

        if (newX <= 20 || newX >= maxX) {
          setDx(-dx)
          return Math.max(20, Math.min(maxX, newX))
        }
        return newX
      })

      setY((prevY) => {
        const newY = prevY + dy
        const maxY = window.innerHeight - 100 // Leave room for taskbar

        if (newY <= 20 || newY >= maxY) {
          setDy(-dy)
          return Math.max(20, Math.min(maxY, newY))
        }
        return newY
      })
    }, 16) // ~60fps

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [dx, dy])

  // Reset position on window resize
  useEffect(() => {
    const handleResize = () => {
      setX(Math.min(x, window.innerWidth - 60))
      setY(Math.min(y, window.innerHeight - 100))
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [x, y])

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

  return (
    <>
      {/* MARIO BOX - SIMPLIFIED POSITIONING */}
      <div
        onClick={handleClick}
        style={{
          position: "fixed",
          left: `${x}px`,
          top: `${y}px`,
          zIndex: 9999, // MAXIMUM Z-INDEX
          width: "50px",
          height: "50px",
          background: "linear-gradient(135deg, #ffd700 0%, #ffb347 50%, #ffa500 100%)",
          border: "3px solid #8b4513",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "inset 3px 3px 0px rgba(255, 255, 255, 0.6), inset -3px -3px 0px rgba(0, 0, 0, 0.4), 3px 3px 12px rgba(0, 0, 0, 0.5)",
          cursor: "pointer",
          fontSize: "28px",
          fontWeight: "900",
          color: "#8b4513",
          textShadow: "2px 2px 0px rgba(255, 255, 255, 0.8), -1px -1px 0px rgba(0, 0, 0, 0.3)",
          userSelect: "none",
          transition: "transform 0.1s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)"
        }}
      >
        ?
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: "32rem",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                backgroundColor: "#374151",
                borderBottom: "1px solid #4b5563",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "24px" }}>🎵</span>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "white", margin: 0 }}>
                    Digging in the Crates
                  </h2>
                  <p style={{ fontSize: "14px", color: "#9ca3af", margin: 0 }}>
                    RAF's SoundCloud Gems • {SOUNDCLOUD_TRACKS.length} tracks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  color: "#9ca3af",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#4b5563"
                  e.currentTarget.style.color = "white"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent"
                  e.currentTarget.style.color = "#9ca3af"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "16px" }}>
              {isLoading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px 0",
                  }}
                >
                  <div
                    className="easter-egg-spinner"
                    style={{
                      width: "32px",
                      height: "32px",
                      border: "2px solid #06b6d4",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                    }}
                  ></div>
                  <span style={{ marginLeft: "12px", color: "white" }}>Loading track...</span>
                </div>
              ) : currentTrack ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "white",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {currentTrack.title}
                      </h3>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#9ca3af",
                          margin: 0,
                        }}
                      >
                        {currentTrack.artist}
                      </p>
                    </div>
                    <button
                      onClick={loadRandomTrack}
                      disabled={isLoading}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#06b6d4",
                        color: "black",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "500",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#0891b2"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#06b6d4"
                      }}
                    >
                      <Shuffle size={16} />
                      Next Track
                    </button>
                  </div>

                  <div style={{ width: "100%" }}>
                    <iframe
                      width="100%"
                      height="166"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      src={buildEmbedUrl(currentTrack)}
                      style={{ width: "100%", borderRadius: "6px" }}
                      key={currentTrack.id}
                    />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px 0",
                  }}
                >
                  <button
                    onClick={loadRandomTrack}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#06b6d4",
                      color: "black",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#0891b2"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#06b6d4"
                    }}
                  >
                    Start Discovery
                  </button>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  color: "#6b7280",
                  paddingTop: "8px",
                  borderTop: "1px solid #374151",
                  marginTop: "16px",
                }}
              >
                <span>Click outside to close • ESC to exit</span>
                {currentTrack && (
                  <a
                    href={currentTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#22d3ee",
                      textDecoration: "underline",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#06b6d4"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#22d3ee"
                    }}
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
