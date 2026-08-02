"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useAudio, type Track } from "../context/AudioContext"
import { FEATURED_RAFS_CRATE } from "@/data/audio-library"

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

const ANALOG_DIGITAL_VIDEOS: Video[] = [
  {
    id: "ad-1",
    title: "ANALOG & DIGITAL 001",
    youtubeId: "FD9Zc_q3y6A",
  },
  {
    id: "ad-2",
    title: "ANALOG & DIGITAL 002",
    youtubeId: "1JfRgKDIG9c",
  },
  {
    id: "ad-3",
    title: "ANALOG & DIGITAL 003",
    youtubeId: "xceycOJgOlI",
  },
  {
    id: "ad-4",
    title: "ANALOG & DIGITAL 004",
    youtubeId: "H--Ohwv2j8s",
  },
]

// Holy-grail Boiler Room & Cercle sets. These stream continuously so you can
// roll from one set straight into the next while you work.
const DJ_SETS: Video[] = [
  {
    id: "djset-fred-again",
    title: "Fred again.. — Boiler Room London",
    youtubeId: "c0-hvjV2A5Y",
  },
  {
    id: "djset-ben-bohmer",
    title: "Ben Böhmer — Cercle, Cappadocia",
    youtubeId: "RvRhUHTV_8k",
  },
  {
    id: "djset-solomun",
    title: "Solomun — Cercle, Théâtre Antique d'Orange",
    youtubeId: "QHDRRxKlimY",
  },
  {
    id: "djset-carl-cox",
    title: "Carl Cox — Cercle, Château de Chambord",
    youtubeId: "ZdAwiV4T22I",
  },
  {
    id: "djset-keinemusik",
    title: "Keinemusik — Cercle, Giza Pyramids",
    youtubeId: "vnuIDZCN2ow",
  },
  {
    id: "djset-black-coffee",
    title: "Black Coffee — Cercle, Salle Wagram",
    youtubeId: "SGqg_ZzThDU",
  },
  {
    id: "djset-fkj",
    title: "FKJ — Cercle, Salar de Uyuni",
    youtubeId: "sCNlt5nvSI8",
  },
]

interface Podcast {
  id: string
  title: string
  show: string
  description: string
  youtubeId: string
  apple: string
  spotify: string
  youtube: string
}

// Talks & podcast appearances. Watch in the iPod (YouTube) or pop out to your
// platform of choice.
const PODCASTS: Podcast[] = [
  {
    id: "mds-ai-deployments",
    title: "AI Deployments: A Practical Guide",
    show: "Making Data Simple",
    description:
      "Shipping enterprise AI in the real world — replayability, infrastructure, Mac Minis, guardrails, and what actually breaks between demo and production.",
    youtubeId: "-oWAk7dMf9w",
    apple: "https://podcasts.apple.com/us/podcast/making-data-simple/id605818735",
    spotify: "https://open.spotify.com/episode/5OxZkTGk7J6rrPswpmQfiy",
    youtube: "https://www.youtube.com/watch?v=-oWAk7dMf9w",
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
  | "djSets"
  | "videoPlayer"
  | "podcasts"
  | "podcastDetail"
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

const IPOD_WIDTH = 280
const IPOD_HEIGHT = 460
const MIN_USABLE_SCALE = 0.75

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
    shuffle,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
  } = useAudio()

  const [currentScreen, setCurrentScreen] = useState<MenuScreen>("main")
  const [menuStack, setMenuStack] = useState<MenuScreen[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [currentVideoPlaylist, setCurrentVideoPlaylist] = useState<Video[]>(ANALOG_DIGITAL_VIDEOS)
  const [isVideoPlaying, setIsVideoPlaying] = useState(true)
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [playerLayout, setPlayerLayout] = useState({ scale: 1, needsVerticalScroll: false })

  const playerViewportRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef<number | null>(null)
  const accumulatedRotationRef = useRef(0)
  const scrollRotationRef = useRef(0)
  const lastScrollAtRef = useRef(0)
  const mouseWheelActiveRef = useRef(false)
  const touchWheelActiveRef = useRef(false)
  const videoIframeRef = useRef<HTMLIFrameElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const screenScrollRef = useRef<HTMLDivElement>(null)

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
          { label: "Podcasts / Talks", submenu: "podcasts" },
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
        return [
          { label: "DJ SETS", submenu: "djSets" },
          { label: "ANALOG & DIGITAL", submenu: "analogDigital" },
        ]
      case "analogDigital":
        return ANALOG_DIGITAL_VIDEOS.map((video, index) => ({
          label: video.title,
          action: () => {
            setCurrentVideoPlaylist(ANALOG_DIGITAL_VIDEOS)
            setCurrentVideo(video)
            setCurrentVideoIndex(index)
            setIsVideoPlaying(true)
            setCurrentScreen("videoPlayer")
          },
        }))
      case "djSets":
        return DJ_SETS.map((video, index) => ({
          label: video.title,
          action: () => {
            setCurrentVideoPlaylist(DJ_SETS)
            setCurrentVideo(video)
            setCurrentVideoIndex(index)
            setIsVideoPlaying(true)
            setCurrentScreen("videoPlayer")
          },
        }))
      case "podcasts":
        return PODCASTS.map((podcast) => ({
          label: podcast.title,
          action: () => {
            setCurrentPodcast(podcast)
            setCurrentScreen("podcastDetail")
          },
        }))
      case "podcastDetail":
        return []
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
        return FEATURED_RAFS_CRATE.map((track) => ({
          label: track.title,
          action: () => {
            setPlaylist(FEATURED_RAFS_CRATE)
            playTrack(track)
            setCurrentScreen("nowPlaying")
          },
        }))
      case "settings":
        return [
          {
            label: `Shuffle: ${shuffle ? "On" : "Off"}`,
            action: toggleShuffle,
          },
          {
            label: `Repeat: ${repeatMode === "off" ? "Off" : repeatMode === "one" ? "One" : "All"}`,
            action: cycleRepeatMode,
          },
          { label: "EQ: Flat" },
        ]
      case "about":
        return [{ label: "BadCompany Radio" }, { label: "notgoodcompany.com" }, { label: "v1.0" }]
      default:
        return []
    }
  }, [currentScreen, playTrack, setPlaylist, shuffle, repeatMode, toggleShuffle, cycleRepeatMode])

  const menuItems = getMenuItems()

  // Seed the default playlist once, but never hijack a session that's already
  // playing (e.g. a record dug out of the crate).
  const seededPlaylistRef = useRef(false)
  useEffect(() => {
    if (seededPlaylistRef.current) return
    seededPlaylistRef.current = true
    if (!currentTrack) setPlaylist(BADCOMPANY_MIXES)
  }, [currentTrack, setPlaylist])

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
      handleVideoPlayPause()
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

  const navigateByWheel = useCallback(
    (steps: number) => {
      if (!steps) return

      const hasSelectableRows =
        currentScreen !== "nowPlaying" && currentScreen !== "videoPlayer" && menuItems.length > 0

      if (hasSelectableRows) {
        setSelectedIndex((prev) => Math.max(0, Math.min(menuItems.length - 1, prev + steps)))
        return
      }

      // Detail screens have no highlighted rows, but the click wheel should
      // still work like an iPod wheel and move their scrollable copy.
      screenScrollRef.current?.scrollBy({ top: steps * 28, behavior: "auto" })
    },
    [currentScreen, menuItems.length],
  )

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

        const STEP = 30
        if (Math.abs(accumulatedRotationRef.current) >= STEP) {
          // Advance by however many full steps were rotated so a fast spin
          // moves multiple items instead of getting stuck on one.
          const steps = Math.trunc(accumulatedRotationRef.current / STEP)
          navigateByWheel(steps)

          // Keep the leftover rotation so movement stays smooth.
          accumulatedRotationRef.current -= steps * STEP
        }
      }

      lastAngleRef.current = angle
    },
    [navigateByWheel],
  )

  const handleJogWheelScroll = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault()

      const now = performance.now()
      if (now - lastScrollAtRef.current > 180) scrollRotationRef.current = 0
      lastScrollAtRef.current = now

      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1
      scrollRotationRef.current += event.deltaY * multiplier

      const STEP = 36
      const steps = Math.max(-3, Math.min(3, Math.trunc(scrollRotationRef.current / STEP)))
      if (!steps) return

      navigateByWheel(steps)
      scrollRotationRef.current -= steps * STEP
    },
    [navigateByWheel],
  )

  const handleWheelStart = () => {
    lastAngleRef.current = null
    accumulatedRotationRef.current = 0
  }

  const handleWheelEnd = () => {
    lastAngleRef.current = null
  }

  useEffect(() => {
    const viewport = playerViewportRef.current
    if (!viewport) return

    const updatePlayerLayout = () => {
      const availableWidth = viewport.clientWidth
      const availableHeight = viewport.clientHeight
      if (availableWidth <= 0 || availableHeight <= 0) return

      const widthScale = availableWidth / IPOD_WIDTH
      const heightScale = availableHeight / IPOD_HEIGHT
      const fitScale = Math.min(1, widthScale, heightScale)
      // Never create horizontal overflow. On short screens, preserve a usable
      // click wheel and let this local viewport scroll vertically instead.
      const minimumScale = Math.min(1, widthScale, MIN_USABLE_SCALE)
      const scale = Math.max(fitScale, minimumScale)
      const needsVerticalScroll = IPOD_HEIGHT * scale > availableHeight + 1

      setPlayerLayout((previous) => {
        if (Math.abs(previous.scale - scale) < 0.001 && previous.needsVerticalScroll === needsVerticalScroll) {
          return previous
        }
        return { scale, needsVerticalScroll }
      })
    }

    updatePlayerLayout()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePlayerLayout)
      return () => window.removeEventListener("resize", updatePlayerLayout)
    }

    const resizeObserver = new ResizeObserver(updatePlayerLayout)
    resizeObserver.observe(viewport)
    return () => resizeObserver.disconnect()
  }, [])

  // Keep the highlighted row in view when scrolling long lists so the
  // selection never disappears off-screen.
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  // Guard against a stale selectedIndex when moving to a shorter menu.
  useEffect(() => {
    setSelectedIndex((prev) => {
      const maxIndex = Math.max(0, menuItems.length - 1)
      return prev > maxIndex ? maxIndex : prev
    })
  }, [menuItems.length])

  const isWheelControl = (target: EventTarget | null) => target instanceof Element && target.closest("button") !== null

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isWheelControl(event.target)) return
    mouseWheelActiveRef.current = true
    handleWheelStart()
    handleWheelMove(event.clientX, event.clientY)
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mouseWheelActiveRef.current && event.buttons === 1) {
      handleWheelMove(event.clientX, event.clientY)
    }
  }

  const handleMouseEnd = () => {
    if (!mouseWheelActiveRef.current) return
    mouseWheelActiveRef.current = false
    handleWheelEnd()
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1 || isWheelControl(event.target)) return
    touchWheelActiveRef.current = true
    handleWheelStart()
    const touch = event.touches[0]
    handleWheelMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = () => {
    if (!touchWheelActiveRef.current) return
    touchWheelActiveRef.current = false
    handleWheelEnd()
  }

  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchWheelActiveRef.current || event.touches.length !== 1) return
      // Suppress page/viewport movement only during an intentional wheel spin.
      event.preventDefault()
      const touch = event.touches[0]
      handleWheelMove(touch.clientX, touch.clientY)
    }

    wheel.addEventListener("touchmove", handleTouchMove, { passive: false })
    return () => wheel.removeEventListener("touchmove", handleTouchMove)
  }, [handleWheelMove])

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
      case "djSets":
        return "DJ SETS"
      case "videoPlayer":
        return currentVideo?.title || "Video"
      case "podcasts":
        return "Podcasts / Talks"
      case "podcastDetail":
        return currentPodcast?.show || "Talk"
      case "settings":
        return "Settings"
      case "about":
        return "About"
      default:
        return "iPod"
    }
  }

  const handleVideoPlayPause = useCallback(() => {
    if (videoIframeRef.current?.contentWindow) {
      if (isVideoPlaying) {
        videoIframeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*")
      } else {
        videoIframeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', "*")
      }
      setIsVideoPlaying(!isVideoPlaying)
    }
  }, [isVideoPlaying])

  const handleNextVideo = useCallback(() => {
    const nextIndex = (currentVideoIndex + 1) % currentVideoPlaylist.length
    setCurrentVideoIndex(nextIndex)
    setCurrentVideo(currentVideoPlaylist[nextIndex])
    setIsVideoPlaying(true)
  }, [currentVideoIndex, currentVideoPlaylist])

  const handlePrevVideo = useCallback(() => {
    const prevIndex = currentVideoIndex === 0 ? currentVideoPlaylist.length - 1 : currentVideoIndex - 1
    setCurrentVideoIndex(prevIndex)
    setCurrentVideo(currentVideoPlaylist[prevIndex])
    setIsVideoPlaying(true)
  }, [currentVideoIndex, currentVideoPlaylist])

  const renderedWidth = IPOD_WIDTH * playerLayout.scale
  const renderedHeight = IPOD_HEIGHT * playerLayout.scale

  return (
    <div
      ref={playerViewportRef}
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: playerLayout.needsVerticalScroll ? "flex-start" : "center",
        minHeight: 0,
        overflowX: "hidden",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        width: "100%",
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          height: `${renderedHeight}px`,
          position: "relative",
          width: `${renderedWidth}px`,
        }}
      >
        <div
          className="relative select-none"
          style={{
            width: `${IPOD_WIDTH}px`,
            height: `${IPOD_HEIGHT}px`,
            background: "linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 50%, #c0c0c0 100%)",
            borderRadius: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)",
            border: "1px solid #999",
            transform: `scale(${playerLayout.scale})`,
            transformOrigin: "top left",
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
          {shuffle && (
            <span className="text-xs font-bold" style={{ color: "#000" }} title="Shuffle on">
              S
            </span>
          )}
          {repeatMode !== "off" && (
            <span className="text-xs font-bold" style={{ color: "#000" }} title={`Repeat ${repeatMode}`}>
              {repeatMode === "one" ? "R1" : "R"}
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
                    ref={videoIframeRef}
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${currentVideo.youtubeId}?autoplay=1&modestbranding=1&rel=0&enablejsapi=1`}
                    title={currentVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="text-xs mt-1 truncate w-full text-center" style={{ color: "#000", fontSize: "9px" }}>
                  {currentVideo.title} ({currentVideoIndex + 1}/{currentVideoPlaylist.length})
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
            ) : currentScreen === "podcastDetail" && currentPodcast ? (
              <div ref={screenScrollRef} className="h-full overflow-y-auto px-2 py-1 text-left">
                <p
                  className="font-bold leading-tight"
                  style={{ color: "#000", fontFamily: "Chicago, system-ui", fontSize: "11px" }}
                >
                  {currentPodcast.title}
                </p>
                <p className="mb-1" style={{ color: "#cc4400", fontSize: "9px" }}>
                  {currentPodcast.show}
                </p>
                <p className="mb-2 leading-snug" style={{ color: "#333", fontSize: "9px" }}>
                  {currentPodcast.description}
                </p>
                <button
                  onClick={() => {
                    const podcastVideo: Video = {
                      id: currentPodcast.id,
                      title: currentPodcast.title,
                      youtubeId: currentPodcast.youtubeId,
                    }
                    setCurrentVideoPlaylist([podcastVideo])
                    setCurrentVideo(podcastVideo)
                    setCurrentVideoIndex(0)
                    setIsVideoPlaying(true)
                    setCurrentScreen("videoPlayer")
                  }}
                  className="w-full mb-2 rounded font-bold"
                  style={{
                    background: "#3366cc",
                    color: "#fff",
                    fontSize: "9px",
                    padding: "4px 0",
                    border: "1px solid #2255bb",
                  }}
                >
                  ▶ Watch on iPod
                </button>
                <div className="flex gap-1">
                  {[
                    { label: "Apple", href: currentPodcast.apple },
                    { label: "Spotify", href: currentPodcast.spotify },
                    { label: "YouTube", href: currentPodcast.youtube },
                  ].map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center rounded"
                      style={{
                        background: "#e0e0e0",
                        color: "#000",
                        fontSize: "8px",
                        padding: "3px 0",
                        border: "1px solid #aaa",
                        textDecoration: "none",
                      }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
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
                    ref={selectedIndex === index ? selectedItemRef : null}
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
        aria-label="iPod click wheel. Rotate or scroll to navigate."
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
          touchAction: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseEnd}
        onMouseLeave={handleMouseEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={handleJogWheelScroll}
      >
        <button
          type="button"
          aria-label={
            currentScreen === "videoPlayer"
              ? "Play or pause video"
              : currentScreen === "nowPlaying"
                ? "Play or pause track"
                : "Select highlighted item"
          }
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          style={{
            width: "60px",
            height: "60px",
            background: "linear-gradient(180deg, #f0f0f0 0%, #d8d8d8 100%)",
            borderRadius: "50%",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            border: "none",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
          onClick={handleSelect}
        />

        <button
          type="button"
          aria-label="Back to previous menu"
          className="absolute left-1/2 -translate-x-1/2 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          style={{
            alignItems: "flex-start",
            cursor: "pointer",
            display: "flex",
            fontSize: "10px",
            fontWeight: "bold",
            color: "#333",
            background: "none",
            border: "none",
            fontFamily: "system-ui",
            height: "60px",
            justifyContent: "center",
            paddingTop: "8px",
            top: 0,
            WebkitTapHighlightColor: "transparent",
            width: "80px",
          }}
          onClick={handleBack}
        >
          MENU
        </button>

        <button
          type="button"
          aria-label={currentScreen === "videoPlayer" ? "Previous video" : "Previous track"}
          className="absolute top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          style={{
            alignItems: "center",
            cursor: "pointer",
            display: "flex",
            fontSize: "14px",
            color: "#333",
            background: "none",
            border: "none",
            height: "80px",
            justifyContent: "flex-start",
            left: 0,
            paddingLeft: "12px",
            WebkitTapHighlightColor: "transparent",
            width: "50px",
          }}
          onClick={currentScreen === "videoPlayer" ? handlePrevVideo : previousTrack}
        >
          ⏮
        </button>

        <button
          type="button"
          aria-label={currentScreen === "videoPlayer" ? "Next video" : "Next track"}
          className="absolute top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          style={{
            alignItems: "center",
            cursor: "pointer",
            display: "flex",
            fontSize: "14px",
            color: "#333",
            background: "none",
            border: "none",
            height: "80px",
            justifyContent: "flex-end",
            paddingRight: "12px",
            right: 0,
            WebkitTapHighlightColor: "transparent",
            width: "50px",
          }}
          onClick={currentScreen === "videoPlayer" ? handleNextVideo : nextTrack}
        >
          ⏭
        </button>

        <button
          type="button"
          aria-label={currentScreen === "videoPlayer" ? "Play or pause video" : "Play or pause track"}
          className="absolute left-1/2 -translate-x-1/2 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          style={{
            alignItems: "flex-end",
            bottom: 0,
            cursor: "pointer",
            display: "flex",
            fontSize: "12px",
            color: "#333",
            background: "none",
            border: "none",
            height: "60px",
            justifyContent: "center",
            paddingBottom: "8px",
            WebkitTapHighlightColor: "transparent",
            width: "80px",
          }}
          onClick={
            currentScreen === "videoPlayer" ? handleVideoPlayPause : () => (isPlaying ? pauseTrack() : resumeTrack())
          }
        >
          {currentScreen === "videoPlayer" ? (isVideoPlaying ? "❚❚" : "▶") : "▶❚❚"}
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
      </div>
    </div>
  )
}
