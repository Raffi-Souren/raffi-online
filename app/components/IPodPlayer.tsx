"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import YouTubePlayer from "react-player/youtube"
import {
  ChevronRight,
  Disc3,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react"
import { useAudio, type Track } from "../context/AudioContext"
import { BADCOMPANY_MIXES, FEATURED_RAFS_CRATE } from "@/data/audio-library"

interface Video {
  id: string
  title: string
  youtubeId: string
}

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

const IPOD_WIDTH = 280
const IPOD_HEIGHT = 460
const MIN_USABLE_SCALE = 0.75
const WHEEL_DETENT_DEGREES = 30
const WHEEL_DEAD_ZONE_RATIO = 0.4
const WHEEL_GESTURE_CONFIRM_DEGREES = 8
const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
const lcdFont = '"Lucida Grande", "Trebuchet MS", sans-serif'
const ellipsis: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }

function wheelBearingDegrees(dx: number, dy: number, radius: number) {
  if (Math.hypot(dx, dy) < radius * WHEEL_DEAD_ZONE_RATIO) return null
  return (Math.atan2(dy, dx) * (180 / Math.PI) + 360) % 360
}

function shortestAngleDelta(fromDegrees: number, toDegrees: number) {
  let delta = (toDegrees - fromDegrees) % 360
  if (delta > 180) delta -= 360
  if (delta <= -180) delta += 360
  return delta
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`
}

type VideoStatus = "connecting" | "ready" | "playing" | "paused" | "buffering" | "error"

export default function IPodPlayer() {
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
    isLoading,
    error,
    volume,
    setVolume,
    seekTo,
  } = useAudio()
  const [currentScreen, setCurrentScreen] = useState<MenuScreen>("main")
  const [menuStack, setMenuStack] = useState<{ screen: MenuScreen; index: number }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [currentVideoPlaylist, setCurrentVideoPlaylist] = useState<Video[]>(ANALOG_DIGITAL_VIDEOS)
  const [videoRequested, setVideoRequested] = useState(false)
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("ready")
  const [expandedVideo, setExpandedVideo] = useState(false)
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [playbackControl, setPlaybackControl] = useState<"volume" | "seek">("volume")
  const [playerLayout, setPlayerLayout] = useState({ scale: 1, needsVerticalScroll: false })
  const playerViewportRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef<number | null>(null)
  const accumulatedRotationRef = useRef(0)
  const sweptRotationRef = useRef(0)
  const scrollRotationRef = useRef(0)
  const lastScrollAtRef = useRef(0)
  const wheelDidRotateRef = useRef(false)
  const wheelPointerIdRef = useRef<number | null>(null)
  const videoPlayerRef = useRef<YouTubePlayer>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)
  const menuListRef = useRef<HTMLDivElement>(null)
  const screenScrollRef = useRef<HTMLDivElement>(null)
  const currentVideo = currentVideoPlaylist[currentVideoIndex]

  const navigate = useCallback(
    (screen: MenuScreen, index = selectedIndex) => {
      setMenuStack((stack) => [...stack, { screen: currentScreen, index }])
      setCurrentScreen(screen)
      setSelectedIndex(0)
    },
    [currentScreen, selectedIndex],
  )

  const playVideo = useCallback(
    (videos: Video[], index: number) => {
      pauseTrack()
      setCurrentVideoPlaylist(videos)
      setCurrentVideoIndex(index)
      setVideoStatus("connecting")
      setVideoRequested(true)
      navigate("videoPlayer", index)
    },
    [navigate, pauseTrack],
  )

  const playMusic = useCallback(
    (tracks: Track[], index: number) => {
      setPlaylist(tracks)
      playTrack(tracks[index])
      navigate("nowPlaying", index)
    },
    [navigate, playTrack, setPlaylist],
  )

  const menuItems: MenuItem[] = (() => {
    switch (currentScreen) {
      case "main":
        return [
          { label: "Music", submenu: "music" },
          { label: "Videos", submenu: "videos" },
          { label: "Podcasts / Talks", submenu: "podcasts" },
          { label: "Now Playing", submenu: "nowPlaying" },
          { label: "Settings", submenu: "settings" },
          { label: "About Raffi", submenu: "about" },
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
          { label: "DJ Sets", submenu: "djSets" },
          { label: "ANALOG & DIGITAL", submenu: "analogDigital" },
        ]
      case "analogDigital":
        return ANALOG_DIGITAL_VIDEOS.map((video, index) => ({
          label: video.title,
          action: () => playVideo(ANALOG_DIGITAL_VIDEOS, index),
        }))
      case "djSets":
        return DJ_SETS.map((video, index) => ({
          label: video.title,
          action: () => playVideo(DJ_SETS, index),
        }))
      case "podcasts":
        return PODCASTS.map((podcast, index) => ({
          label: podcast.title,
          action: () => {
            setCurrentPodcast(podcast)
            navigate("podcastDetail", index)
          },
        }))
      case "badcompany":
        return BADCOMPANY_MIXES.map((track, index) => ({
          label: track.title,
          action: () => playMusic(BADCOMPANY_MIXES, index),
        }))
      case "rafscrate":
        return FEATURED_RAFS_CRATE.map((track, index) => ({
          label: track.title,
          action: () => playMusic(FEATURED_RAFS_CRATE, index),
        }))
      case "settings":
        return [
          { label: `Shuffle: ${shuffle ? "On" : "Off"}`, action: toggleShuffle },
          {
            label: `Repeat: ${repeatMode === "off" ? "Off" : repeatMode === "one" ? "One" : "All"}`,
            action: cycleRepeatMode,
          },
        ]
      default:
        return []
    }
  })()

  const hasSelectableRows = menuItems.length > 0
  const hasScrollableCopy = currentScreen === "podcastDetail" || currentScreen === "about"
  const wheelCanRotate =
    hasSelectableRows || hasScrollableCopy || currentScreen === "nowPlaying" || currentScreen === "videoPlayer"

  const handleVideoPlayPause = useCallback(() => {
    const player = videoPlayerRef.current?.getInternalPlayer()
    if (videoStatus === "playing" || videoStatus === "buffering") {
      player?.pauseVideo?.()
      setVideoRequested(false)
    } else {
      pauseTrack()
      player?.playVideo?.()
      setVideoRequested(true)
    }
  }, [pauseTrack, videoStatus])

  const handlePlayPause = () => {
    if (currentScreen === "videoPlayer") handleVideoPlayPause()
    else if (isPlaying) pauseTrack()
    else if (currentTrack) resumeTrack()
    else playMusic(BADCOMPANY_MIXES, 0)
  }

  const activateItem = (index: number) => {
    const item = menuItems[index]
    if (item?.action) item.action()
    else if (item?.submenu) navigate(item.submenu, index)
  }

  const watchPodcast = () => {
    if (!currentPodcast) return
    playVideo([{ id: currentPodcast.id, title: currentPodcast.title, youtubeId: currentPodcast.youtubeId }], 0)
  }

  const handleSelect = () => {
    if (currentScreen === "nowPlaying") setPlaybackControl((mode) => (mode === "volume" ? "seek" : "volume"))
    else if (currentScreen === "videoPlayer") handleVideoPlayPause()
    else if (currentScreen === "podcastDetail") watchPodcast()
    else activateItem(selectedIndex)
  }

  const handleBack = () => {
    if (expandedVideo) {
      setExpandedVideo(false)
      return
    }
    const previous = menuStack[menuStack.length - 1]
    if (!previous) return
    if (currentScreen === "videoPlayer") setVideoRequested(false)
    setMenuStack((stack) => stack.slice(0, -1))
    setCurrentScreen(previous.screen)
    setSelectedIndex(previous.index)
  }

  const changeVideo = (direction: number) => {
    if (!currentVideoPlaylist.length) return
    const count = currentVideoPlaylist.length
    const offset = shuffle && count > 1 ? 1 + Math.floor(Math.random() * (count - 1)) : direction
    const next = (currentVideoIndex + offset + count) % count
    if (next === currentVideoIndex) {
      videoPlayerRef.current?.seekTo(0, "seconds")
      videoPlayerRef.current?.getInternalPlayer()?.playVideo?.()
    } else {
      setCurrentVideoIndex(next)
      setVideoStatus("connecting")
    }
    pauseTrack()
    setVideoRequested(true)
  }

  const handleVideoEnded = () => {
    if (repeatMode === "one") {
      videoPlayerRef.current?.seekTo(0, "seconds")
      videoPlayerRef.current?.getInternalPlayer()?.playVideo?.()
    } else if (repeatMode === "off" && !shuffle && currentVideoIndex === currentVideoPlaylist.length - 1) {
      setVideoRequested(false)
      setVideoStatus("paused")
    } else changeVideo(1)
  }

  const navigateByWheel = useCallback(
    (steps: number) => {
      if (!steps) return
      if (hasSelectableRows) setSelectedIndex((index) => Math.max(0, Math.min(menuItems.length - 1, index + steps)))
      else if (hasScrollableCopy) screenScrollRef.current?.scrollBy({ top: steps * 28, behavior: "auto" })
      else if (currentScreen === "nowPlaying" && playbackControl === "seek") seekTo(currentTime + steps * 5)
      else setVolume(Math.max(0, Math.min(100, volume + steps * 5)))
    },
    [
      currentScreen,
      currentTime,
      hasScrollableCopy,
      hasSelectableRows,
      menuItems.length,
      playbackControl,
      seekTo,
      setVolume,
      volume,
    ],
  )

  const readWheelBearing = useCallback((clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return null
    return wheelBearingDegrees(
      clientX - (rect.left + rect.width / 2),
      clientY - (rect.top + rect.height / 2),
      rect.width / 2,
    )
  }, [])

  const trackWheelRotation = useCallback(
    (clientX: number, clientY: number) => {
      const bearing = readWheelBearing(clientX, clientY)
      if (bearing === null) {
        lastAngleRef.current = null
        return
      }
      const previous = lastAngleRef.current
      lastAngleRef.current = bearing
      if (previous === null) return
      const delta = shortestAngleDelta(previous, bearing)
      accumulatedRotationRef.current += delta
      sweptRotationRef.current += Math.abs(delta)
      if (sweptRotationRef.current >= WHEEL_GESTURE_CONFIRM_DEGREES) wheelDidRotateRef.current = true
      const steps = Math.trunc(accumulatedRotationRef.current / WHEEL_DETENT_DEGREES)
      if (!steps) return
      accumulatedRotationRef.current -= steps * WHEEL_DETENT_DEGREES
      navigateByWheel(steps)
    },
    [navigateByWheel, readWheelBearing],
  )

  const handleJogWheelScroll = useCallback(
    (event: WheelEvent) => {
      if (!wheelCanRotate) return
      event.preventDefault()
      const now = performance.now()
      if (now - lastScrollAtRef.current > 180) scrollRotationRef.current = 0
      lastScrollAtRef.current = now
      scrollRotationRef.current += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1)
      const steps = Math.max(-3, Math.min(3, Math.trunc(scrollRotationRef.current / 36)))
      if (!steps) return
      navigateByWheel(steps)
      scrollRotationRef.current -= steps * 36
    },
    [navigateByWheel, wheelCanRotate],
  )

  useEffect(() => {
    const viewport = playerViewportRef.current
    if (!viewport) return
    const update = () => {
      const { clientWidth: width, clientHeight: height } = viewport
      if (width <= 0 || height <= 0) return
      const scale = Math.max(
        Math.min(1, width / IPOD_WIDTH, height / IPOD_HEIGHT),
        Math.min(1, width / IPOD_WIDTH, MIN_USABLE_SCALE),
      )
      const needsVerticalScroll = IPOD_HEIGHT * scale > height + 1
      setPlayerLayout((previous) =>
        Math.abs(previous.scale - scale) < 0.001 && previous.needsVerticalScroll === needsVerticalScroll
          ? previous
          : { scale, needsVerticalScroll },
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    playerViewportRef.current?.focus({ preventScroll: true })
  }, [currentScreen])

  useEffect(() => {
    const row = selectedItemRef.current
    const list = menuListRef.current
    if (!row || !list) return
    const listRect = list.getBoundingClientRect()
    if (listRect.height <= 0) return
    const rowRect = row.getBoundingClientRect()
    const factor = list.clientHeight / listRect.height
    if (rowRect.top < listRect.top) list.scrollTop -= (listRect.top - rowRect.top) * factor
    else if (rowRect.bottom > listRect.bottom) list.scrollTop += (rowRect.bottom - listRect.bottom) * factor
  }, [currentScreen, selectedIndex])

  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return
    wheel.addEventListener("wheel", handleJogWheelScroll, { passive: false })
    return () => wheel.removeEventListener("wheel", handleJogWheelScroll)
  }, [handleJogWheelScroll])

  useEffect(() => {
    if (currentScreen !== "videoPlayer" || videoStatus !== "connecting") return
    const timeout = window.setTimeout(() => setVideoStatus("error"), 15000)
    return () => window.clearTimeout(timeout)
  }, [currentScreen, currentVideoIndex, videoStatus])

  // A different desktop player can claim audio while the iPod is open.
  useEffect(() => {
    if (isPlaying && currentScreen === "videoPlayer") setVideoRequested(false)
  }, [isPlaying, currentScreen])

  const handleWheelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button > 0 || !event.isPrimary) return
    wheelDidRotateRef.current = false
    if (event.target instanceof Element && event.target.closest("[data-wheel-center]")) return
    if (
      !wheelCanRotate ||
      wheelPointerIdRef.current !== null ||
      readWheelBearing(event.clientX, event.clientY) === null
    )
      return
    wheelPointerIdRef.current = event.pointerId
    lastAngleRef.current = null
    accumulatedRotationRef.current = 0
    sweptRotationRef.current = 0
    trackWheelRotation(event.clientX, event.clientY)
  }

  const handleWheelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerIdRef.current !== event.pointerId) return
    if (event.cancelable) event.preventDefault()
    trackWheelRotation(event.clientX, event.clientY)
    // Capture only confirmed spins so an ordinary press still clicks its button.
    if (wheelDidRotateRef.current && !event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleWheelPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerIdRef.current !== event.pointerId) return
    wheelPointerIdRef.current = null
    lastAngleRef.current = null
    accumulatedRotationRef.current = 0
    sweptRotationRef.current = 0
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleWheelClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!wheelDidRotateRef.current || event.detail === 0) return
    wheelDidRotateRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement) return
    if (event.key === "ArrowDown") navigateByWheel(1)
    else if (event.key === "ArrowUp") navigateByWheel(-1)
    else if (event.key === "ArrowLeft" || event.key === "Backspace") handleBack()
    else if (event.key === "ArrowRight") handleSelect()
    else if (event.key === "Home" && hasSelectableRows) setSelectedIndex(0)
    else if (event.key === "End" && hasSelectableRows) setSelectedIndex(menuItems.length - 1)
    else if (
      event.key === "Enter" &&
      (event.target === event.currentTarget ||
        (event.target instanceof Element && event.target.hasAttribute("data-ipod-row")))
    )
      handleSelect()
    else if (event.key === " " && event.target === event.currentTarget) handlePlayPause()
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  const titles: Record<MenuScreen, string> = {
    main: "Raffi’s iPod",
    music: "Music",
    playlists: "Playlists",
    badcompany: "BadCompany",
    rafscrate: "RAF's Crate",
    nowPlaying: "Now Playing",
    videos: "Videos",
    videoPlaylists: "Playlists",
    analogDigital: "ANALOG & DIGITAL",
    djSets: "DJ Sets",
    videoPlayer: currentVideo?.title || "Video",
    podcasts: "Podcasts / Talks",
    podcastDetail: currentPodcast?.show || "Talk",
    settings: "Settings",
    about: "About Raffi",
  }
  const title = titles[currentScreen]
  const videoActive = currentScreen === "videoPlayer"
  const playing = videoActive ? videoStatus === "playing" : isPlaying && !isLoading && !error
  const videoMessage = {
    connecting: "Connecting to YouTube…",
    ready: "Press play to start",
    playing: "Playing",
    paused: "Paused",
    buffering: "Buffering…",
    error: "Video unavailable. Open on YouTube.",
  }[videoStatus]
  const wheelButtonStyle: React.CSSProperties = {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    background: "transparent",
    color: "#747976",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  }

  return (
    <div
      ref={playerViewportRef}
      data-ipod-player
      tabIndex={0}
      aria-label="iPod player"
      onKeyDown={handleKeyDown}
      className={focusClass}
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: playerLayout.needsVerticalScroll && !expandedVideo ? "flex-start" : "center",
        minHeight: 0,
        overflowX: "hidden",
        overflowY: "auto",
        width: "100%",
        outlineOffset: -2,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          height: expandedVideo ? "100%" : IPOD_HEIGHT * playerLayout.scale,
          position: "relative",
          width: expandedVideo ? "100%" : IPOD_WIDTH * playerLayout.scale,
        }}
      >
        <div
          data-ipod-chassis
          style={{
            position: "relative",
            userSelect: "none",
            width: expandedVideo ? "100%" : IPOD_WIDTH,
            height: expandedVideo ? "100%" : IPOD_HEIGHT,
            background: expandedVideo
              ? "#151817"
              : "linear-gradient(105deg, #c7cac7 0%, #fbfcf9 2%, #f5f6f2 46%, #e0e3dd 98%, #929892 100%)",
            borderRadius: expandedVideo ? 8 : 28,
            boxShadow: expandedVideo
              ? "none"
              : "0 14px 25px #12221f40, inset 0 1px 2px #fff, inset 0 -2px 4px #727b7280",
            border: "1px solid #939b92",
            transform: expandedVideo ? "none" : `scale(${playerLayout.scale})`,
            transformOrigin: "top left",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: expandedVideo ? 0 : 23,
              left: expandedVideo ? 0 : 24,
              width: expandedVideo ? "100%" : 230,
              height: expandedVideo ? "100%" : 192,
              background: "#333d34",
              borderRadius: expandedVideo ? 8 : 8,
              padding: expandedVideo ? 6 : 5,
              boxShadow: expandedVideo ? "none" : "0 1px 1px #fff, inset 0 2px 4px #0008",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
                overflow: "hidden",
                background: "linear-gradient(#eaf0db, #d6dfc6)",
                borderRadius: 3,
                color: "#253026",
                fontFamily: lcdFont,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexShrink: 0,
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  padding: "5px 8px",
                  height: 27,
                  background: "linear-gradient(#f4f7e9, #c6d0b6)",
                  borderBottom: "1px solid #98a58b",
                }}
              >
                <span title={title} style={{ ...ellipsis, fontSize: 12, fontWeight: 700, minWidth: 0 }}>
                  {title}
                </span>
                <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
                  {shuffle && <Shuffle size={12} aria-label="Shuffle on" />}
                  {repeatMode !== "off" &&
                    (repeatMode === "one" ? (
                      <Repeat1 size={13} aria-label="Repeat one" />
                    ) : (
                      <Repeat size={13} aria-label="Repeat all" />
                    ))}
                  {playing && <Play size={10} fill="currentColor" aria-label="Playing" />}
                  <span
                    aria-hidden="true"
                    style={{
                      width: 17,
                      height: 9,
                      border: "1px solid #68785c",
                      borderRadius: 1,
                      boxShadow: "2px 0 0 -1px #68785c",
                      background: "repeating-linear-gradient(90deg, #63765b 0 3px, transparent 3px 4px)",
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                {videoActive && currentVideo ? (
                  <div style={{ display: "flex", height: "100%", flexDirection: "column", gap: 3, padding: 5 }}>
                    <div
                      data-ipod-video
                      style={{ minHeight: 0, flex: 1, width: "100%", overflow: "hidden", background: "#000" }}
                    >
                      <YouTubePlayer
                        ref={videoPlayerRef}
                        url={`https://www.youtube.com/watch?v=${currentVideo.youtubeId}`}
                        width="100%"
                        height="100%"
                        playing={videoRequested}
                        controls
                        playsinline
                        volume={volume / 100}
                        config={{ playerVars: { rel: 0 } }}
                        onReady={() => setVideoStatus("ready")}
                        onPlay={() => {
                          pauseTrack()
                          setVideoRequested(true)
                          setVideoStatus("playing")
                        }}
                        onPause={() => {
                          setVideoRequested(false)
                          setVideoStatus("paused")
                        }}
                        onBuffer={() => setVideoStatus("buffering")}
                        onBufferEnd={() =>
                          setVideoStatus(
                            videoPlayerRef.current?.getInternalPlayer()?.getPlayerState?.() === 1 ? "playing" : "ready",
                          )
                        }
                        onEnded={handleVideoEnded}
                        onError={() => {
                          setVideoRequested(false)
                          setVideoStatus("error")
                        }}
                      />
                    </div>
                    <div role="status" style={{ ...ellipsis, fontSize: expandedVideo ? 12 : 9 }}>
                      {videoMessage} · {currentVideoIndex + 1}/{currentVideoPlaylist.length}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 5,
                        flexShrink: 0,
                      }}
                    >
                      <a
                        className={focusClass}
                        href={`https://www.youtube.com/watch?v=${currentVideo.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: expandedVideo ? 12 : 9,
                          color: "#254d7d",
                          textDecoration: "underline",
                        }}
                      >
                        YouTube
                      </a>
                      <button
                        className={focusClass}
                        onClick={() => setExpandedVideo((value) => !value)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          border: "1px solid #6f805e",
                          background: "#eef3e4",
                          padding: "3px 6px",
                          borderRadius: 3,
                          fontSize: expandedVideo ? 12 : 10,
                          cursor: "pointer",
                        }}
                      >
                        {expandedVideo ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        {expandedVideo ? "Back to iPod" : "Expand"}
                      </button>
                    </div>
                  </div>
                ) : currentScreen === "podcastDetail" && currentPodcast ? (
                  <div ref={screenScrollRef} style={{ height: "100%", overflowY: "auto", padding: 9, fontSize: 11 }}>
                    <p style={{ fontWeight: 700, lineHeight: 1.25 }}>{currentPodcast.title}</p>
                    <p style={{ marginTop: 5, lineHeight: 1.4 }}>{currentPodcast.description}</p>
                    <button
                      className={focusClass}
                      onClick={watchPodcast}
                      style={{
                        width: "100%",
                        margin: "8px 0",
                        border: "1px solid #265488",
                        background: "#376da1",
                        color: "white",
                        padding: 6,
                        borderRadius: 2,
                        cursor: "pointer",
                      }}
                    >
                      Watch on iPod
                    </button>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 7 }}>
                      {[
                        { label: "Apple", href: currentPodcast.apple },
                        { label: "Spotify", href: currentPodcast.spotify },
                        { label: "YouTube", href: currentPodcast.youtube },
                      ].map((link) => (
                        <a
                          key={link.label}
                          className={focusClass}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#254d7d", textDecoration: "underline" }}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : currentScreen === "nowPlaying" ? (
                  <div
                    style={{
                      height: "100%",
                      padding: "9px 10px 5px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    {currentTrack ? (
                      <>
                        <div style={{ display: "flex", gap: 9, alignItems: "center", minHeight: 45 }}>
                          <div
                            aria-hidden="true"
                            style={{
                              width: 44,
                              height: 44,
                              background: "#364535",
                              borderRadius: 3,
                              color: "#d7e1c7",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Disc3 size={34} strokeWidth={1.2} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p title={currentTrack.title} style={{ ...ellipsis, fontWeight: 700, fontSize: 11 }}>
                              {currentTrack.title}
                            </p>
                            <p style={{ ...ellipsis, fontSize: 10, marginTop: 2 }}>{currentTrack.artist}</p>
                          </div>
                        </div>
                        <input
                          aria-label="Track position"
                          className={focusClass}
                          type="range"
                          min={0}
                          max={Math.max(duration, 1)}
                          value={Math.min(currentTime, duration || 0)}
                          step={1}
                          disabled={!duration || !!error}
                          onChange={(event) => seekTo(Number(event.target.value))}
                          style={{ width: "100%", height: 12, accentColor: "#455a36", cursor: "pointer" }}
                        />
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 9,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          <span>{formatTime(currentTime)}</span>
                          <span>−{formatTime(Math.max(0, duration - currentTime))}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 9 }}>
                          <Volume2 size={12} />
                          <input
                            aria-label="Volume"
                            className={focusClass}
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={volume}
                            onChange={(event) => setVolume(Number(event.target.value))}
                            style={{ minWidth: 0, width: "100%", height: 12, accentColor: "#455a36" }}
                          />
                          <span>{Math.round(volume)}%</span>
                        </div>
                        <p role="status" title={error || undefined} style={{ ...ellipsis, fontSize: 9 }}>
                          {error
                            ? "Unavailable — try next track"
                            : isLoading
                              ? "Connecting to SoundCloud…"
                              : `${isPlaying ? "Playing" : "Paused"} · Wheel: ${playbackControl === "seek" ? "seek" : "volume"}`}
                        </p>
                      </>
                    ) : (
                      <div style={{ margin: "auto", textAlign: "center", fontSize: 11 }}>
                        <Disc3 size={30} style={{ margin: "0 auto 8px" }} />
                        <p>No track selected</p>
                        <p style={{ marginTop: 4, fontSize: 10 }}>Press play or choose a playlist.</p>
                      </div>
                    )}
                  </div>
                ) : currentScreen === "about" ? (
                  <div
                    ref={screenScrollRef}
                    style={{ height: "100%", overflowY: "auto", padding: 10, fontSize: 11, lineHeight: 1.5 }}
                  >
                    <strong>Raffi Khatchadourian</strong>
                    <p style={{ marginTop: 5 }}>
                      Field CTO at IBM. Co-founder of Bad Company and indify. Brooklyn, New York.
                    </p>
                    <p style={{ marginTop: 8 }}>Building AI products, digging for vinyl, and DJing with friends.</p>
                    <a
                      className={focusClass}
                      href="mailto:raffi@notgoodcompany.com"
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        color: "#254d7d",
                        overflowWrap: "anywhere",
                      }}
                    >
                      raffi@notgoodcompany.com
                    </a>
                    <p style={{ marginTop: 8 }}>
                      Turn the wheel to browse. Press the center to select. MENU takes you back.
                    </p>
                    <p style={{ marginTop: 8 }}>
                      While music plays, turn for volume. Press the center to switch to seeking.
                    </p>
                    <a
                      className={focusClass}
                      href="https://notgoodcompany.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: 8, color: "#254d7d" }}
                    >
                      notgoodcompany.com
                    </a>
                  </div>
                ) : (
                  <div ref={menuListRef} aria-label={title} style={{ overflowY: "auto", height: "100%" }}>
                    {menuItems.map((item, index) => (
                      <button
                        key={`${currentScreen}-${index}`}
                        ref={selectedIndex === index ? selectedItemRef : null}
                        data-ipod-row
                        data-selected={selectedIndex === index}
                        tabIndex={selectedIndex === index ? 0 : -1}
                        className={focusClass}
                        onFocus={() => setSelectedIndex(index)}
                        onClick={() => activateItem(index)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          width: "100%",
                          border: 0,
                          textAlign: "left",
                          padding: "5px 8px",
                          background: selectedIndex === index ? "linear-gradient(#4a88b7, #316490)" : "transparent",
                          color: selectedIndex === index ? "white" : "#253026",
                          fontFamily: lcdFont,
                          fontSize: 12,
                          lineHeight: "16px",
                          cursor: "pointer",
                        }}
                      >
                        <span title={item.label} style={ellipsis}>
                          {item.label}
                        </span>
                        {item.submenu && <ChevronRight size={12} style={{ flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div
            aria-hidden="true"
            style={{
              display: expandedVideo ? "none" : "block",
              position: "absolute",
              top: 233,
              width: "100%",
              textAlign: "center",
              color: "#a1a7a0",
              fontSize: 10,
              fontFamily: lcdFont,
            }}
          >
            iPod
          </div>
          <div
            ref={wheelRef}
            aria-label="iPod click wheel. Rotate or scroll to navigate."
            style={{
              display: expandedVideo ? "none" : "block",
              position: "absolute",
              bottom: 35,
              left: 55,
              width: 170,
              height: 170,
              background: "linear-gradient(135deg, #fafbf8, #e5e8e1)",
              borderRadius: "50%",
              boxShadow: "inset 0 1px 3px #626e6233, 0 1px 1px #fff",
              touchAction: wheelCanRotate ? "none" : "auto",
              WebkitTapHighlightColor: "transparent",
            }}
            onPointerDown={handleWheelPointerDown}
            onPointerMove={handleWheelPointerMove}
            onPointerUp={handleWheelPointerEnd}
            onPointerCancel={handleWheelPointerEnd}
            onPointerLeave={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) handleWheelPointerEnd(event)
            }}
            onClickCapture={handleWheelClickCapture}
          >
            <button
              data-wheel-center
              type="button"
              aria-label={
                videoActive
                  ? "Play or pause video"
                  : currentScreen === "nowPlaying"
                    ? "Switch between volume and seek"
                    : currentScreen === "podcastDetail"
                      ? "Watch podcast"
                      : "Select highlighted item"
              }
              className={`${focusClass} transition-transform active:scale-95`}
              onClick={handleSelect}
              style={{
                ...wheelButtonStyle,
                zIndex: 1,
                left: 53,
                top: 53,
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f8faf5, #dce1d7)",
                boxShadow: "0 1px 3px #87908077, inset 0 1px 2px #fff",
              }}
            />
            <button
              type="button"
              aria-label="Back to previous menu"
              className={`${focusClass} hover:opacity-70`}
              onClick={handleBack}
              style={{
                ...wheelButtonStyle,
                top: 0,
                left: 45,
                width: 80,
                height: 49,
                fontFamily: lcdFont,
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              MENU
            </button>
            <button
              type="button"
              aria-label={videoActive ? "Previous video" : "Previous track"}
              className={`${focusClass} hover:opacity-70`}
              onClick={videoActive ? () => changeVideo(-1) : previousTrack}
              style={{ ...wheelButtonStyle, top: 55, left: 0, width: 49, height: 60 }}
            >
              <SkipBack size={20} fill="currentColor" strokeWidth={1} />
            </button>
            <button
              type="button"
              aria-label={videoActive ? "Next video" : "Next track"}
              className={`${focusClass} hover:opacity-70`}
              onClick={videoActive ? () => changeVideo(1) : nextTrack}
              style={{ ...wheelButtonStyle, top: 55, right: 0, width: 49, height: 60 }}
            >
              <SkipForward size={20} fill="currentColor" strokeWidth={1} />
            </button>
            <button
              type="button"
              aria-label={videoActive ? "Play or pause video" : "Play or pause track"}
              className={`${focusClass} hover:opacity-70`}
              onClick={handlePlayPause}
              style={{ ...wheelButtonStyle, bottom: 0, left: 45, width: 80, height: 49, gap: 3 }}
            >
              <Play size={13} fill="currentColor" />
              <Pause size={13} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
