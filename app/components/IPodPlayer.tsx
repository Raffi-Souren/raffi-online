"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useAudio, type Track } from "../context/AudioContext"

interface Video {
  id: string
  title: string
  youtubeId: string
}

const BADCOMPANY_MIXES: Track[] = [
  {
    id: "bc-1",
    title: "BadCompany Radio",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/playlists/1789261161",
  },
  {
    id: "bc-2",
    title: "WARM",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/1324245148",
  },
  {
    id: "bc-3",
    title: "LATE NIGHT",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/1179462235",
  },
  {
    id: "bc-4",
    title: "HOUSE PARTY",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/playlists/704616300",
  },
  {
    id: "bc-5",
    title: "DISCO FUNK",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/1124902333",
  },
  {
    id: "bc-6",
    title: "POOLSIDE",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/585063546",
  },
  {
    id: "bc-7",
    title: "SUNSET",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/921126772",
  },
  {
    id: "bc-8",
    title: "GROOVE",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/playlists/992564092",
  },
  {
    id: "bc-9",
    title: "WEEKEND",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/757237381",
  },
  {
    id: "bc-10",
    title: "DEEP HOUSE",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/688176064",
  },
  {
    id: "bc-11",
    title: "SUMMER VIBES",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/524785323",
  },
  {
    id: "bc-12",
    title: "AFTER HOURS",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/677024604",
  },
  {
    id: "bc-13",
    title: "MORNING COFFEE",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/513780693",
  },
  {
    id: "bc-14",
    title: "ROOFTOP",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/tracks/459410418",
  },
]

const RAFS_CRATE: Track[] = [
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
    artist: "DJ Sweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-beirut",
  },
  {
    id: "chopsuey",
    title: "Chop Suey",
    artist: "Osive",
    url: "https://soundcloud.com/osive/chopsuey",
  },
  {
    id: "gordos-dilemma",
    title: "Gordo's Dilemma",
    artist: "Gordo",
    url: "https://soundcloud.com/gordoszn/gordos-dilemma",
  },
  {
    id: "08-compton-state-of-mind",
    title: "Compton State of Mind",
    artist: "Miles Davis",
    url: "https://soundcloud.com/miles-davis-29/08-compton-state-of-mind",
  },
  {
    id: "fidde-i-wonder-yuno-hu-vision",
    title: "I Wonder (Yuno Hu Vision)",
    artist: "Fidde",
    url: "https://soundcloud.com/miguelmancha/fidde-i-wonder-yuno-hu-vision",
  },
  {
    id: "sango2",
    title: "Sango2",
    artist: "Pinche Por Vida",
    url: "https://soundcloud.com/pincheporvida/sango2",
  },
  {
    id: "dipset-x-future-i-really-mean",
    title: "Dipset x Future - I Really Mean",
    artist: "Sango",
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
    artist: "David Mackay",
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
    artist: "Mac Miller",
    url: "https://soundcloud.com/larryfisherman/first-day-of-my-life-bright",
  },
]

const ANALOG_DIGITAL_VIDEOS: Video[] = [
  {
    id: "ad-1",
    title: "ANALOG & DIGITAL 001",
    youtubeId: "FD9Zc_q3y6A",
  },
  {
    id: "ad-2",
    title: "ANALOG & DIGITAL 002",
    youtubeId: "3JZ_D3ELwOQ",
  },
  {
    id: "ad-3",
    title: "ANALOG & DIGITAL 003",
    youtubeId: "5qap5aO4i9A",
  },
  {
    id: "ad-4",
    title: "ANALOG & DIGITAL 004",
    youtubeId: "kJQP7kiw5Fk",
  },
]

type MenuScreen =
  | "main"
  | "music"
  | "playlists"
  | "badcompany"
  | "rafscrate"
  | "nowPlaying"
  | "videos"
  | "videoPlaylists"
  | "analogDigital"
  | "videoPlayer"
  | "settings"
  | "about"

interface MenuItem {
  label: string
  action?: () => void
  submenu?: MenuScreen
}

interface IPodPlayerProps {
  onExpandVideo?: (youtubeId: string, title: string) => void
}

export default function IPodPlayer({ onExpandVideo }: IPodPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    pauseTrack,
    resumeTrack,
    nextTrack,
    previousTrack,
    setPlaylist,
    currentTime,
    duration,
  } = useAudio()

  const [currentScreen, setCurrentScreen] = useState<MenuScreen>("main")
  const [menuStack, setMenuStack] = useState<MenuScreen[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)

  const wheelRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef<number | null>(null)
  const accumulatedRotationRef = useRef(0)

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  const getMenuItems = useCallback((): MenuItem[] => {
    switch (currentScreen) {
      case "main":
        return [
          { label: "Music", submenu: "music" },
          { label: "Videos", submenu: "videos" },
          { label: "Now Playing", submenu: "nowPlaying" },
          { label: "Settings", submenu: "settings" },
          { label: "About", submenu: "about" },
        ]
      case "music":
        return [{ label: "Playlists", submenu: "playlists" }]
      case "playlists":
        return [
          { label: "BadCompany Mixes", submenu: "badcompany" },
          { label: "RAF's Crate", submenu: "rafscrate" },
        ]
      case "videos":
        return [{ label: "Playlists", submenu: "videoPlaylists" }]
      case "videoPlaylists":
        return [{ label: "ANALOG & DIGITAL", submenu: "analogDigital" }]
      case "analogDigital":
        return ANALOG_DIGITAL_VIDEOS.map((video) => ({
          label: video.title,
          action: () => {
            setCurrentVideo(video)
            setCurrentScreen("videoPlayer")
          },
        }))
      case "badcompany":
        return BADCOMPANY_MIXES.map((track) => ({
          label: track.title,
          action: () => {
            setPlaylist(BADCOMPANY_MIXES)
            playTrack(track)
            setCurrentScreen("nowPlaying")
          },
        }))
      case "rafscrate":
        return RAFS_CRATE.map((track) => ({
          label: track.title,
          action: () => {
            setPlaylist(RAFS_CRATE)
            playTrack(track)
            setCurrentScreen("nowPlaying")
          },
        }))
      case "settings":
        return [
          {
            label: `Shuffle: ${shuffleEnabled ? "On" : "Off"}`,
            action: () => setShuffleEnabled(!shuffleEnabled),
          },
          {
            label: `Repeat: ${repeatEnabled ? "On" : "Off"}`,
            action: () => setRepeatEnabled(!repeatEnabled),
          },
          { label: "EQ: Flat" },
        ]
      case "about":
        return [{ label: "BadCompany Radio" }, { label: "notgoodcompany.com" }, { label: "v1.0" }]
      default:
        return []
    }
  }, [currentScreen, playTrack, setPlaylist, shuffleEnabled, repeatEnabled])

  const menuItems = getMenuItems()

  useEffect(() => {
    setPlaylist(BADCOMPANY_MIXES)
  }, [setPlaylist])

  const handleSelect = useCallback(() => {
    if (currentScreen === "nowPlaying") {
      if (isPlaying) {
        pauseTrack()
      } else {
        resumeTrack()
      }
      return
    }

    if (currentScreen === "videoPlayer") {
      return
    }

    const item = menuItems[selectedIndex]
    if (item?.action) {
      item.action()
    } else if (item?.submenu) {
      setMenuStack((prev) => [...prev, currentScreen])
      setCurrentScreen(item.submenu)
      setSelectedIndex(0)
    }
  }, [currentScreen, menuItems, selectedIndex, isPlaying, pauseTrack, resumeTrack])

  const handleBack = useCallback(() => {
    if (menuStack.length > 0) {
      const prevScreen = menuStack[menuStack.length - 1]
      setMenuStack((prev) => prev.slice(0, -1))
      setCurrentScreen(prevScreen)
      setSelectedIndex(0)
    }
  }, [menuStack])

  const handleWheelMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!wheelRef.current) return

      const rect = wheelRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI)

      if (lastAngleRef.current !== null) {
        let delta = angle - lastAngleRef.current

        if (delta > 180) delta -= 360
        if (delta < -180) delta += 360

        accumulatedRotationRef.current += delta

        if (Math.abs(accumulatedRotationRef.current) >= 30) {
          const direction = accumulatedRotationRef.current > 0 ? 1 : -1
          const maxIndex = currentScreen === "nowPlaying" || currentScreen === "videoPlayer" ? 0 : menuItems.length - 1

          setSelectedIndex((prev) => {
            const newIndex = prev + direction
            if (newIndex < 0) return 0
            if (newIndex > maxIndex) return maxIndex
            return newIndex
          })

          accumulatedRotationRef.current = 0
        }
      }

      lastAngleRef.current = angle
    },
    [menuItems.length, currentScreen],
  )

  const handleWheelStart = () => {
    lastAngleRef.current = null
    accumulatedRotationRef.current = 0
  }

  const handleWheelEnd = () => {
    lastAngleRef.current = null
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      handleWheelMove(e.clientX, e.clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleWheelMove(touch.clientX, touch.clientY)
  }

  const getScreenTitle = () => {
    switch (currentScreen) {
      case "main":
        return "iPod"
      case "music":
        return "Music"
      case "playlists":
        return "Playlists"
      case "badcompany":
        return "BadCompany"
      case "rafscrate":
        return "RAF's Crate"
      case "nowPlaying":
        return "Now Playing"
      case "videos":
        return "Videos"
      case "videoPlaylists":
        return "Playlists"
      case "analogDigital":
        return "ANALOG & DIGITAL"
      case "videoPlayer":
        return currentVideo?.title || "Video"
      case "settings":
        return "Settings"
      case "about":
        return "About"
      default:
        return "iPod"
    }
  }

  return (
    <div
      className="relative mx-auto select-none"
      style={{
        width: "280px",
        height: "460px",
        background: "linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 50%, #c0c0c0 100%)",
        borderRadius: "24px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)",
        border: "1px solid #999",
      }}
    >
      <div
        className="absolute"
        style={{
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "200px",
          height: "160px",
          background: "#1a1a1a",
          borderRadius: "4px",
          padding: "4px",
        }}
      >
        <div
          className="w-full h-full overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #b8c8b8 0%, #a8b8a8 100%)",
            borderRadius: "2px",
          }}
        >
          <div
            className="flex items-center justify-between px-2 py-1"
            style={{
              background: "linear-gradient(180deg, #8898a8 0%, #7888a8 100%)",
              borderBottom: "1px solid #6878a8",
            }}
          >
            <span className="text-xs font-bold" style={{ color: "#000", fontFamily: "Chicago, system-ui" }}>
              {getScreenTitle()}
            </span>
            <div className="flex items-center gap-1">
              {shuffleEnabled && (
                <span className="text-xs" style={{ color: "#000" }}>
                  🔀
                </span>
              )}
              {repeatEnabled && (
                <span className="text-xs" style={{ color: "#000" }}>
                  🔁
                </span>
              )}
              {isPlaying && (
                <span className="text-xs" style={{ color: "#000" }}>
                  ▶
                </span>
              )}
              <span className="text-xs" style={{ color: "#000" }}>
                🔋
              </span>
            </div>
          </div>

          <div className="p-1 h-[calc(100%-24px)] overflow-hidden">
            {currentScreen === "videoPlayer" && currentVideo ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-full bg-black rounded overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${currentVideo.youtubeId}?autoplay=1&modestbranding=1&rel=0`}
                    title={currentVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="text-xs mt-1 truncate w-full text-center" style={{ color: "#000", fontSize: "9px" }}>
                  {currentVideo.title}
                </p>
                {onExpandVideo && (
                  <button
                    onClick={() => onExpandVideo(currentVideo.youtubeId, currentVideo.title)}
                    className="mt-1 px-2 py-0.5 text-xs rounded"
                    style={{
                      background: "#3366cc",
                      color: "#fff",
                      fontSize: "8px",
                      border: "1px solid #2255bb",
                    }}
                  >
                    ⤢ Expand
                  </button>
                )}
              </div>
            ) : currentScreen === "nowPlaying" ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                {currentTrack ? (
                  <>
                    <div
                      className="w-14 h-14 mb-2 flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #FF5500 0%, #FF3300 100%)",
                        borderRadius: "4px",
                        border: "1px solid #333",
                      }}
                    >
                      <span className="text-xl">🎵</span>
                    </div>
                    <p
                      className="text-xs font-bold truncate w-full px-2"
                      style={{ color: "#000", fontFamily: "Chicago, system-ui", fontSize: "10px" }}
                    >
                      {currentTrack.title}
                    </p>
                    <p className="text-xs truncate w-full px-2" style={{ color: "#333", fontSize: "9px" }}>
                      {currentTrack.artist}
                    </p>
                    <div className="mt-2 w-full px-3">
                      <div className="h-1.5 w-full rounded" style={{ background: "#666", border: "1px solid #444" }}>
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${progressPercent}%`,
                            background: "#333",
                            transition: "width 0.5s linear",
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span style={{ color: "#333", fontSize: "8px", fontFamily: "monospace" }}>
                          {formatTime(currentTime)}
                        </span>
                        <span style={{ color: "#333", fontSize: "8px", fontFamily: "monospace" }}>
                          {formatTime(duration)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#333", fontSize: "9px" }}>
                      {isPlaying ? "▶ Playing" : "❚❚ Paused"}
                    </p>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-xs mb-2" style={{ color: "#333" }}>
                      No track selected
                    </p>
                    <p className="text-xs" style={{ color: "#666", fontSize: "9px" }}>
                      Go to Music → Playlists
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-0 overflow-y-auto h-full">
                {menuItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-2 py-1"
                    style={{
                      background: selectedIndex === index ? "#3366cc" : "transparent",
                      color: selectedIndex === index ? "#fff" : "#000",
                      fontFamily: "Chicago, system-ui",
                      fontSize: "11px",
                    }}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.submenu && <span>▶</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        ref={wheelRef}
        className="absolute cursor-pointer"
        style={{
          bottom: "40px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "160px",
          height: "160px",
          background: "linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 50%, #ccc 100%)",
          borderRadius: "50%",
          boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)",
        }}
        onMouseDown={handleWheelStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleWheelEnd}
        onMouseLeave={handleWheelEnd}
        onTouchStart={handleWheelStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleWheelEnd}
      >
        <button
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-95"
          style={{
            width: "50px",
            height: "50px",
            background: "linear-gradient(180deg, #f0f0f0 0%, #d8d8d8 100%)",
            borderRadius: "50%",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            border: "none",
          }}
          onClick={handleSelect}
        />

        <button
          className="absolute left-1/2 -translate-x-1/2 transition-opacity hover:opacity-70"
          style={{
            top: "8px",
            fontSize: "10px",
            fontWeight: "bold",
            color: "#333",
            background: "none",
            border: "none",
            fontFamily: "system-ui",
          }}
          onClick={handleBack}
        >
          MENU
        </button>

        <button
          className="absolute top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
          style={{
            left: "12px",
            fontSize: "14px",
            color: "#333",
            background: "none",
            border: "none",
          }}
          onClick={previousTrack}
        >
          ⏮
        </button>

        <button
          className="absolute top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
          style={{
            right: "12px",
            fontSize: "14px",
            color: "#333",
            background: "none",
            border: "none",
          }}
          onClick={nextTrack}
        >
          ⏭
        </button>

        <button
          className="absolute left-1/2 -translate-x-1/2 transition-opacity hover:opacity-70"
          style={{
            bottom: "8px",
            fontSize: "12px",
            color: "#333",
            background: "none",
            border: "none",
          }}
          onClick={() => (isPlaying ? pauseTrack() : resumeTrack())}
        >
          ▶❚❚
        </button>
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 text-center"
        style={{
          bottom: "12px",
          fontSize: "10px",
          color: "#666",
          fontFamily: "system-ui",
          fontWeight: "500",
        }}
      >
        iPod
      </div>
    </div>
  )
}
