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

// One detent per 30 degrees — twelve rows per full turn. Coarse enough that a
// resting hand never registers, fine enough that a flick walks a long list.
const WHEEL_DETENT_DEGREES = 30
// Angles are unstable near the hub, where a pixel of travel swings the bearing
// wildly. Ignore samples inside this fraction of the radius; 0.4 of the 160px
// wheel clears the 60px Select button.
const WHEEL_DEAD_ZONE_RATIO = 0.4
// Pixels of copy to move per detent on screens that scroll text instead of
// highlighting rows.
const WHEEL_SCROLL_PIXELS_PER_DETENT = 28
// Total swept rotation that promotes a press from "tap" to "spin". Below this a
// press is left completely alone so it lands on MENU, a skip button or
// play/pause; above it the wheel takes over the pointer and eats the closing
// click. Both effects share this one threshold so a press can never fall
// between them and do nothing at all.
const WHEEL_GESTURE_CONFIRM_DEGREES = 8

/**
 * Bearing of a point on the wheel, in degrees clockwise from 3 o'clock.
 *
 * Returns 0-359 so the seam sits at 3 o'clock, and `null` inside the dead zone
 * so callers can drop the sample instead of acting on a meaningless angle.
 */
function wheelBearingDegrees(dx: number, dy: number, radius: number) {
  if (Math.hypot(dx, dy) < radius * WHEEL_DEAD_ZONE_RATIO) return null
  const degrees = Math.atan2(dy, dx) * (180 / Math.PI)
  return (degrees + 360) % 360
}

/**
 * Signed shortest rotation from one bearing to another.
 *
 * Bearings wrap at the 359/0 seam, so a pointer crossing it reads as a ~359
 * degree jump in the wrong direction. Folding the raw difference back into
 * (-180, 180] keeps one continuous drag continuous.
 */
function shortestAngleDelta(fromDegrees: number, toDegrees: number) {
  let delta = (toDegrees - fromDegrees) % 360
  if (delta > 180) delta -= 360
  if (delta <= -180) delta += 360
  return delta
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
  const sweptRotationRef = useRef(0)
  const scrollRotationRef = useRef(0)
  const lastScrollAtRef = useRef(0)
  const wheelDidRotateRef = useRef(false)
  // Mouse, touch and pen all arrive as pointer events, so one captured pointer
  // id is the whole gesture bookkeeping.
  const wheelPointerIdRef = useRef<number | null>(null)
  const videoIframeRef = useRef<HTMLIFrameElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const menuListRef = useRef<HTMLDivElement>(null)
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

  // The wheel only ever moves something that already exists on screen. Now
  // Playing and the video player have no rows and no scrollable copy, so the
  // wheel stays inert there rather than inventing navigation or interrupting
  // whatever is playing.
  const hasSelectableRows =
    currentScreen !== "nowPlaying" && currentScreen !== "videoPlayer" && menuItems.length > 0
  const hasScrollableCopy = currentScreen === "podcastDetail"
  const wheelCanRotate = hasSelectableRows || hasScrollableCopy

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

      if (hasSelectableRows) {
        setSelectedIndex((prev) => Math.max(0, Math.min(menuItems.length - 1, prev + steps)))
        return
      }

      if (hasScrollableCopy) {
        // Detail screens have no highlighted rows, but the click wheel should
        // still work like an iPod wheel and move their scrollable copy.
        screenScrollRef.current?.scrollBy({
          top: steps * WHEEL_SCROLL_PIXELS_PER_DETENT,
          behavior: "auto",
        })
      }
    },
    [hasScrollableCopy, hasSelectableRows, menuItems.length],
  )

  // Bearing of a client point on the wheel, or null if the wheel is gone or the
  // point sits in the hub dead zone.
  const readWheelBearing = useCallback((clientX: number, clientY: number) => {
    const wheel = wheelRef.current
    if (!wheel) return null

    const rect = wheel.getBoundingClientRect()
    const radius = rect.width / 2
    if (radius <= 0) return null

    return wheelBearingDegrees(clientX - (rect.left + radius), clientY - (rect.top + rect.height / 2), radius)
  }, [])

  const trackWheelRotation = useCallback(
    (clientX: number, clientY: number) => {
      const bearing = readWheelBearing(clientX, clientY)

      if (bearing === null) {
        // Inside the dead zone: pause the gesture rather than end it, and
        // re-seed on the way out so crossing the hub emits nothing.
        lastAngleRef.current = null
        return
      }

      const previousBearing = lastAngleRef.current
      lastAngleRef.current = bearing
      if (previousBearing === null) return

      const delta = shortestAngleDelta(previousBearing, bearing)
      accumulatedRotationRef.current += delta
      sweptRotationRef.current += Math.abs(delta)
      if (sweptRotationRef.current >= WHEEL_GESTURE_CONFIRM_DEGREES) {
        wheelDidRotateRef.current = true
      }

      // Emit every whole detent the pointer swept, so a fast spin moves several
      // rows instead of getting stuck on one.
      const steps = Math.trunc(accumulatedRotationRef.current / WHEEL_DETENT_DEGREES)
      if (!steps) return

      // Keep the leftover rotation so slow movement stays smooth.
      accumulatedRotationRef.current -= steps * WHEEL_DETENT_DEGREES
      navigateByWheel(steps)
    },
    [navigateByWheel, readWheelBearing],
  )

  const handleJogWheelScroll = useCallback(
    (event: WheelEvent) => {
      // Screens with nothing to move keep native scrolling.
      if (!wheelCanRotate) return
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
    [navigateByWheel, wheelCanRotate],
  )

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

  // Keep the highlighted row in view when scrolling long lists so the selection
  // never disappears off-screen. This nudges the list's own scrollTop instead of
  // calling scrollIntoView, which would also drag the surrounding window and the
  // page around while the wheel is being spun.
  useEffect(() => {
    const row = selectedItemRef.current
    const list = menuListRef.current
    if (!row || !list) return

    const listRect = list.getBoundingClientRect()
    if (listRect.height <= 0) return
    const rowRect = row.getBoundingClientRect()
    // The chassis is CSS-scaled, so convert measured client pixels back into
    // the list's own unscaled scroll pixels.
    const toScrollPixels = list.clientHeight / listRect.height

    if (rowRect.top < listRect.top) {
      list.scrollTop -= (listRect.top - rowRect.top) * toScrollPixels
    } else if (rowRect.bottom > listRect.bottom) {
      list.scrollTop += (rowRect.bottom - listRect.bottom) * toScrollPixels
    }
  }, [currentScreen, selectedIndex])

  // Guard against a stale selectedIndex when moving to a shorter menu.
  useEffect(() => {
    setSelectedIndex((prev) => {
      const maxIndex = Math.max(0, menuItems.length - 1)
      return prev > maxIndex ? maxIndex : prev
    })
  }, [menuItems.length])

  const isCenterControl = (target: EventTarget | null) =>
    target instanceof Element && target.closest("[data-wheel-center]") !== null

  const handleWheelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Secondary mouse buttons are not a spin. Touch and pen always report 0.
    if (event.button > 0) return

    // A fresh press ends the "this was a drag" state so the tap that follows
    // reaches its button normally.
    wheelDidRotateRef.current = false

    // The hub owns Select; only the annulus rotates.
    if (isCenterControl(event.target)) return
    if (!wheelCanRotate) return
    if (wheelPointerIdRef.current !== null) return
    if (readWheelBearing(event.clientX, event.clientY) === null) return

    wheelPointerIdRef.current = event.pointerId
    lastAngleRef.current = null
    accumulatedRotationRef.current = 0
    sweptRotationRef.current = 0
    // No pointer capture yet — capturing here would retarget the closing click
    // to the wheel and kill every ordinary tap on the controls it covers.
    trackWheelRotation(event.clientX, event.clientY)
  }

  const handleWheelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerIdRef.current !== event.pointerId) return
    // Suppress page scrolling and text selection only while a spin is actually
    // running; an idle pointer over the wheel behaves normally.
    if (event.cancelable) event.preventDefault()
    trackWheelRotation(event.clientX, event.clientY)

    // Once this is definitely a spin, take the pointer so it survives leaving
    // the 160px wheel — which happens constantly on the scaled-down phone
    // layout — and so the release lands here to have its click swallowed.
    //
    // Only pointerup and pointercancel end the gesture. lostpointercapture must
    // not: touch pointers are implicitly captured at pointerdown, so claiming
    // them explicitly here fires a lostpointercapture for the implicit capture
    // and would otherwise cancel the spin on its very first move.
    if (wheelDidRotateRef.current && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const handleWheelPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerIdRef.current !== event.pointerId) return
    wheelPointerIdRef.current = null
    lastAngleRef.current = null
    accumulatedRotationRef.current = 0
    sweptRotationRef.current = 0
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // wheelDidRotateRef stays set so the click this release generates is
    // swallowed below instead of firing MENU, play/pause or a skip button.
  }

  const handleWheelClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!wheelDidRotateRef.current) return
    wheelDidRotateRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return

    wheel.addEventListener("wheel", handleJogWheelScroll, { passive: false })
    return () => wheel.removeEventListener("wheel", handleJogWheelScroll)
  }, [handleJogWheelScroll])

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
          className="flex h-full w-full flex-col overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #b8c8b8 0%, #a8b8a8 100%)",
            borderRadius: "2px",
          }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-between gap-1 px-2 py-1"
            style={{
              background: "linear-gradient(180deg, #8898a8 0%, #7888a8 100%)",
              borderBottom: "1px solid #6878a8",
            }}
          >
            {/* truncate + min-w-0: a long title like "Fred again.. — Boiler
                Room London" used to wrap onto a second line, making this bar
                taller than the 24px the screen below assumed and pushing the
                Expand button out through the bezel. */}
            <span
              className="min-w-0 truncate text-xs font-bold"
              style={{ color: "#000", fontFamily: "Chicago, system-ui" }}
              title={getScreenTitle()}
            >
              {getScreenTitle()}
            </span>
            <div className="flex flex-shrink-0 items-center gap-1">
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

          {/* flex-1 rather than calc(100% - 24px): the content area now derives
              its height from whatever the header actually measures, so a taller
              status bar can never overflow the screen. */}
          <div className="min-h-0 flex-1 overflow-hidden p-1">
            {currentScreen === "videoPlayer" && currentVideo ? (
              // The video absorbs all leftover height; the caption and Expand
              // button are flex-shrink-0 so they can never be clipped off the
              // bottom. The old layout gave the frame a fixed 16:9 box that
              // could not shrink (flex items default to min-height:auto), so on
              // a long title the button overflowed a hidden container.
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <div className="min-h-0 w-full flex-1 overflow-hidden rounded bg-black">
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
                <p
                  className="w-full flex-shrink-0 truncate text-center text-xs"
                  style={{ color: "#000", fontSize: "9px" }}
                >
                  {currentVideo.title} ({currentVideoIndex + 1}/{currentVideoPlaylist.length})
                </p>
                {onExpandVideo && (
                  <button
                    onClick={() => onExpandVideo(currentVideo.youtubeId, currentVideo.title)}
                    className="flex-shrink-0 rounded px-2 py-0.5 text-xs"
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
              <div ref={menuListRef} className="space-y-0 overflow-y-auto h-full">
                {menuItems.map((item, index) => (
                  <div
                    key={index}
                    ref={selectedIndex === index ? selectedItemRef : null}
                    data-ipod-row
                    data-selected={selectedIndex === index}
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
          // Only claim the touch gesture on screens the wheel can actually
          // move; elsewhere a swipe over the wheel still scrolls the page.
          touchAction: wheelCanRotate ? "none" : "auto",
          WebkitTapHighlightColor: "transparent",
        }}
        onPointerDown={handleWheelPointerDown}
        onPointerMove={handleWheelPointerMove}
        onPointerUp={handleWheelPointerEnd}
        onPointerCancel={handleWheelPointerEnd}
        onClickCapture={handleWheelClickCapture}
      >
        <button
          data-wheel-center
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
