"use client"

import { useState, useEffect } from "react"
import { Shuffle } from "lucide-react"
import axios from "axios"

const LIKED_TRACKS = [
  {
    id: "sade-sweetest-taboo",
    title: "Sade - Sweetest Taboo (November Rose Amapiano Remix)",
    artist: "November Rose Music",
    url: "https://soundcloud.com/novemberrosemusic/sade-sweetest-taboo-november-rose-amapiano-remix",
  },
  {
    id: "name-it-after-me",
    title: "NAME IT AFTER ME - CONCRETE BOYS",
    artist: "tHE CONCRETE LeaK sYstem",
    url: "https://soundcloud.com/theconcreteleaksystem/name",
  },
  {
    id: "yukon-up-mashup",
    title: "YUKON x UP (DJ Hunny Bee Mashup)",
    artist: "DJ Hunny Bee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-mashup",
  },
  {
    id: "blaccmass-radio",
    title: "BLACCMASS RADIO - ONE NIGHT ONLY",
    artist: "blaccmass",
    url: "https://soundcloud.com/blaccmass/blaccmass-radio-one-night-only",
  },
  {
    id: "four-tet-insect",
    title: "Four Tet – Insect Near Piha Beach",
    artist: "O'Shee",
    url: "https://soundcloud.com/oshee/four-tet-insect-near-piha-beach",
  },
  {
    id: "four-tet-caribou-jamie",
    title: "Four Tet/Caribou/Jamie XX DJ Set",
    artist: "Hyak.fm",
    url: "https://soundcloud.com/hyakfm/four-tet-caribou-jamie-xx-dj-set",
  },
  {
    id: "habibi-funk-plus",
    title: "حبيبي فانك بلس",
    artist: "raf",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-plus",
  },
  {
    id: "compton-state-mind",
    title: "Compton State Of Mind – Kendrick Lamar (2012)",
    artist: "Kendrick Lamar",
    url: "https://soundcloud.com/kendrick-lamar-music/compton-state-of-mind",
  },
  {
    id: "fidde-i-wonder",
    title: "Fidde – I wonder (Yunô Hu vision)",
    artist: "Miguel Mancha",
    url: "https://soundcloud.com/miguel-mancha/fidde-i-wonder-yuno-hu-vision",
  },
  {
    id: "donaty-tirate",
    title: "donaty – tirate (sango & por vida remix)",
    artist: "por vida",
    url: "https://soundcloud.com/porvida/donaty-tirate-sango-por-vida-remix",
  },
  {
    id: "disclosure-latch",
    title: "Latch (feat. Sam Smith)",
    artist: "Disclosure",
    url: "https://soundcloud.com/disclosure/latch-feat-sam-smith",
  },
  {
    id: "flume-sleepless",
    title: "Sleepless",
    artist: "Flume",
    url: "https://soundcloud.com/flume/sleepless",
  },
  {
    id: "odesza-say-my-name",
    title: "Say My Name (feat. Zyra)",
    artist: "ODESZA",
    url: "https://soundcloud.com/odesza/say-my-name-feat-zyra",
  },
  {
    id: "kaytranada-glowed-up",
    title: "GLOWED UP (feat. Anderson .Paak)",
    artist: "KAYTRANADA",
    url: "https://soundcloud.com/kaytranada/glowed-up-feat-anderson-paak",
  },
  {
    id: "jamie-xx-gosh",
    title: "Gosh",
    artist: "Jamie xx",
    url: "https://soundcloud.com/jamie-xx/gosh",
  },
  {
    id: "bonobo-kiara",
    title: "Kiara (feat. Bajka)",
    artist: "Bonobo",
    url: "https://soundcloud.com/bonobomusic/kiara-feat-bajka",
  },
  {
    id: "tycho-a-walk",
    title: "A Walk",
    artist: "Tycho",
    url: "https://soundcloud.com/tycho/a-walk",
  },
  {
    id: "moderat-a-new-error",
    title: "A New Error",
    artist: "Moderat",
    url: "https://soundcloud.com/moderat-official/a-new-error",
  },
  {
    id: "bicep-glue",
    title: "Glue",
    artist: "Bicep",
    url: "https://soundcloud.com/bicep-music/glue",
  },
  {
    id: "caribou-odessa",
    title: "Odessa",
    artist: "Caribou",
    url: "https://soundcloud.com/caribouband/odessa",
  },
]

export default function EasterEgg() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isRevealed, setIsRevealed] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(LIKED_TRACKS[0])
  const [embedHtml, setEmbedHtml] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [embedError, setEmbedError] = useState(false)

  useEffect(() => {
    const moveIcon = () => {
      const maxX = window.innerWidth - 40
      const maxY = window.innerHeight - 40
      setPosition({
        x: Math.random() * maxX,
        y: Math.random() * maxY,
      })
    }

    const interval = setInterval(moveIcon, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchEmbed = async () => {
      setIsLoading(true)
      setEmbedError(false)

      try {
        const response = await axios.get(
          `https://soundcloud.com/oembed?format=json&url=${currentTrack.url}&maxheight=166`,
        )
        setEmbedHtml(response.data.html)
      } catch (error) {
        setEmbedError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmbed()
  }, [currentTrack])

  const shuffleTrack = () => {
    setIsLoading(true)

    setTimeout(() => {
      const randomTrack = LIKED_TRACKS[Math.floor(Math.random() * LIKED_TRACKS.length)]
      setCurrentTrack(randomTrack)
      setIsLoading(false)
    }, 800)
  }

  const handleClick = () => {
    setIsRevealed(true)
    shuffleTrack()
  }

  return (
    <>
      <div
        className="mario-box absolute transition-all duration-1000 cursor-pointer z-40"
        style={{ left: position.x, top: position.y }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {isRevealed && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="window w-full max-w-[500px]">
            <div className="window-title">
              🎵 SECRET TRACK FOUND!
              <button className="ml-auto text-red-500 hover:text-red-400" onClick={() => setIsRevealed(false)}>
                ❌
              </button>
            </div>
            <div className="window-content">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-green-400 text-xl">✅</span>
                <div>
                  <div className="font-bold text-yellow-400">Congratulations!</div>
                  <div className="text-sm text-gray-300">You've discovered a track from djsweeterman's likes!</div>
                </div>
              </div>

              {/* Track Info */}
              <div className="mb-4 p-3 bg-black border border-yellow-400 rounded">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm leading-tight">{currentTrack.title}</div>
                    <div className="text-xs text-gray-400 mt-1">by {currentTrack.artist}</div>
                  </div>
                  <button
                    className="win-btn flex items-center gap-1 text-xs ml-2 flex-shrink-0 px-2 py-1"
                    onClick={shuffleTrack}
                    disabled={isLoading}
                  >
                    <Shuffle className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                    {isLoading ? "..." : "SHUFFLE"}
                  </button>
                </div>
              </div>

              {/* SoundCloud Embed */}
              <div className="mb-4 bg-gray-900 rounded overflow-hidden border border-gray-700">
                {isLoading ? (
                  <div className="h-[166px] flex items-center justify-center bg-gray-900">
                    <div className="text-yellow-400 animate-pulse">Loading new track...</div>
                  </div>
                ) : embedError ? (
                  <div className="h-[166px] flex items-center justify-center bg-gray-900 text-red-500">
                    This track is not embeddable.{" "}
                    <a
                      href={currentTrack.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm underline"
                    >
                      View on SoundCloud →
                    </a>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: embedHtml }} />
                )}
              </div>

              <div className="flex justify-between items-center">
                <a
                  href={currentTrack.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  View on SoundCloud →
                </a>
                <button className="win-btn px-4 py-1" onClick={() => setIsRevealed(false)}>
                  CLOSE
                </button>
              </div>

              {/* Attribution */}
              <div className="mt-3 text-xs text-gray-500 text-center">From djsweeterman's SoundCloud likes</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
