"use client"

import { useState, useEffect, useRef } from "react"
import { Shuffle, X, Music, Loader2 } from "lucide-react"

type Track = {
  id: string
  url: string
  title?: string
  artist?: string
  embedUrl?: string
}

const SOUNDCLOUD_LIKES = [
  {
    id: "sade-sweetest-taboo-november-rose-amapiano-remix",
    title: "Sade Sweetest Taboo November Rose Amapiano Remix",
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
    id: "yukon-x-up-dj-hunny-bee-mashup",
    title: "Yukon X Up Dj Hunny Bee Mashup",
    artist: "djhunnybee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-mashup",
  },
  {
    id: "blaccmass-radio-one-night-only",
    title: "Blaccmass Radio One Night Only",
    artist: "blaccmass",
    url: "https://soundcloud.com/blaccmass/blaccmass-radio-one-night-only",
  },
  {
    id: "four-tet-insect-near-piha-beach",
    title: "Four Tet Insect Near Piha Beach",
    artist: "oshee",
    url: "https://soundcloud.com/oshee/four-tet-insect-near-piha-beach",
  },
  {
    id: "four-tet-caribou-jamie-xx-dj-set",
    title: "Four Tet Caribou Jamie Xx Dj Set",
    artist: "hyakfm",
    url: "https://soundcloud.com/hyakfm/four-tet-caribou-jamie-xx-dj-set",
  },
  {
    id: "habibi-funk-plus",
    title: "Habibi Funk Plus",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-plus",
  },
  {
    id: "compton-state-of-mind",
    title: "Compton State Of Mind",
    artist: "kendrick-lamar-music",
    url: "https://soundcloud.com/kendrick-lamar-music/compton-state-of-mind",
  },
  {
    id: "fidde-i-wonder-yuno-hu-vision",
    title: "Fidde I Wonder Yuno Hu Vision",
    artist: "miguel-mancha",
    url: "https://soundcloud.com/miguel-mancha/fidde-i-wonder-yuno-hu-vision",
  },
  {
    id: "donaty-tirate-sango-por-vida-remix",
    title: "Donaty Tirate Sango Por Vida Remix",
    artist: "porvida",
    url: "https://soundcloud.com/porvida/donaty-tirate-sango-por-vida-remix",
  },
  {
    id: "latch-feat-sam-smith",
    title: "Latch Feat Sam Smith",
    artist: "disclosure",
    url: "https://soundcloud.com/disclosure/latch-feat-sam-smith",
  },
  {
    id: "sleepless",
    title: "Sleepless",
    artist: "flume",
    url: "https://soundcloud.com/flume/sleepless",
  },
  {
    id: "say-my-name-feat-zyra",
    title: "Say My Name Feat Zyra",
    artist: "odesza",
    url: "https://soundcloud.com/odesza/say-my-name-feat-zyra",
  },
  {
    id: "glowed-up-feat-anderson-paak",
    title: "Glowed Up Feat Anderson Paak",
    artist: "kaytranada",
    url: "https://soundcloud.com/kaytranada/glowed-up-feat-anderson-paak",
  },
  {
    id: "gosh",
    title: "Gosh",
    artist: "jamie-xx",
    url: "https://soundcloud.com/jamie-xx/gosh",
  },
  {
    id: "kiara-feat-bajka",
    title: "Kiara Feat Bajka",
    artist: "bonobomusic",
    url: "https://soundcloud.com/bonobomusic/kiara-feat-bajka",
  },
  {
    id: "a-walk",
    title: "A Walk",
    artist: "tycho",
    url: "https://soundcloud.com/tycho/a-walk",
  },
  {
    id: "a-new-error",
    title: "A New Error",
    artist: "moderat-official",
    url: "https://soundcloud.com/moderat-official/a-new-error",
  },
  {
    id: "glue",
    title: "Glue",
    artist: "bicep-music",
    url: "https://soundcloud.com/bicep-music/glue",
  },
  {
    id: "odessa",
    title: "Odessa",
    artist: "caribouband",
    url: "https://soundcloud.com/caribouband/odessa",
  },
  {
    id: "yukon-x-up-dj-hunny-bee-remix",
    title: "Yukon X Up Dj Hunny Bee Remix",
    artist: "djhunnybee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-remix",
  },
  {
    id: "habibi-funk-beirut",
    title: "Habibi Funk Beirut",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-beirut",
  },
  {
    id: "chopsuey",
    title: "Chopsuey",
    artist: "osive",
    url: "https://soundcloud.com/osive/chopsuey",
  },
  {
    id: "gordos-dilemma",
    title: "Gordos Dilemma",
    artist: "gordoszn",
    url: "https://soundcloud.com/gordoszn/gordos-dilemma",
  },
  {
    id: "08-compton-state-of-mind",
    title: "08 Compton State Of Mind",
    artist: "miles-davis-29",
    url: "https://soundcloud.com/miles-davis-29/08-compton-state-of-mind",
  },
  {
    id: "sango2",
    title: "Sango2",
    artist: "pincheporvida",
    url: "https://soundcloud.com/pincheporvida/sango2",
  },
  {
    id: "dipset-x-future-i-really-mean",
    title: "Dipset X Future I Really Mean",
    artist: "sangobeats",
    url: "https://soundcloud.com/sangobeats/dipset-x-future-i-really-mean",
  },
  {
    id: "mos-def-auditorium-2",
    title: "Mos Def Auditorium 2",
    artist: "beaubouthillier-1",
    url: "https://soundcloud.com/beaubouthillier-1/mos-def-auditorium-2",
  },
  {
    id: "blemforreal",
    title: "Blemforreal",
    artist: "davidmackaymusic",
    url: "https://soundcloud.com/davidmackaymusic/blemforreal",
  },
  {
    id: "tems-me-u-blk-remix",
    title: "Tems Me U Blk Remix",
    artist: "blkmvsic",
    url: "https://soundcloud.com/blkmvsic/tems-me-u-blk-remix",
  },
  {
    id: "first-day-of-my-life-bright",
    title: "First Day Of My Life Bright",
    artist: "larryfisherman",
    url: "https://soundcloud.com/larryfisherman/first-day-of-my-life-bright",
  },
  {
    id: "phoenix-1",
    title: "Phoenix 1",
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
    title: "Casts Of A Dreamer Full Tape",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/casts-of-a-dreamer-full-tape",
  },
  {
    id: "gordo-x-drake-healing-my-pal-al-remix-1",
    title: "Gordo X Drake Healing My Pal Al Remix 1",
    artist: "mypalalmusic",
    url: "https://soundcloud.com/mypalalmusic/gordo-x-drake-healing-my-pal-al-remix-1",
  },
  {
    id: "mitsubishi-sony",
    title: "Mitsubishi Sony",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/mitsubishi-sony",
  },
  {
    id: "gilga-01-childish-gambino-1",
    title: "Gilga 01 Childish Gambino 1",
    artist: "david-nelson-494707975",
    url: "https://soundcloud.com/david-nelson-494707975/gilga-01-childish-gambino-1",
  },
  {
    id: "partynextdoor-showing-you-baile-baile-funk-edit",
    title: "Partynextdoor Showing You Baile Baile Funk Edit",
    artist: "ang-official",
    url: "https://soundcloud.com/ang-official/partynextdoor-showing-you-baile-baile-funk-edit",
  },
  {
    id: "beyonce-end-of-time-sydney-sousa-baile-funk-edit",
    title: "Beyonce End Of Time Sydney Sousa Baile Funk Edit",
    artist: "dj-sydney-sousa",
    url: "https://soundcloud.com/dj-sydney-sousa/beyonce-end-of-time-sydney-sousa-baile-funk-edit",
  },
  {
    id: "peggy-gou-it-goes-like-nanana-baile-funk-edit",
    title: "Peggy Gou It Goes Like Nanana Baile Funk Edit",
    artist: "caiohot",
    url: "https://soundcloud.com/caiohot/peggy-gou-it-goes-like-nanana-baile-funk-edit",
  },
  {
    id: "sango-amor-di-american-loverboy",
    title: "Sango Amor Di American Loverboy",
    artist: "manlikesirene",
    url: "https://soundcloud.com/manlikesirene/sango-amor-di-american-loverboy",
  },
  {
    id: "bitch-dont-kill-my-funk-b",
    title: "Bitch Dont Kill My Funk B",
    artist: "b_smileloco98",
    url: "https://soundcloud.com/b_smileloco98/bitch-dont-kill-my-funk-b",
  },
  {
    id: "chamber-of-reflection-brazilian-funk-remix",
    title: "Chamber Of Reflection Brazilian Funk Remix",
    artist: "user-167742358",
    url: "https://soundcloud.com/user-167742358/chamber-of-reflection-brazilian-funk-remix",
  },
  {
    id: "fisherrr-shekdash-remix",
    title: "Fisherrr Shekdash Remix",
    artist: "shekdash",
    url: "https://soundcloud.com/shekdash/fisherrr-shekdash-remix",
  },
  {
    id: "slim",
    title: "Slim",
    artist: "musicbysamson",
    url: "https://soundcloud.com/musicbysamson/slim",
  },
  {
    id: "rich-baby-daddy-pherris-edit-a-side",
    title: "Rich Baby Daddy Pherris Edit A Side",
    artist: "pherrismusic",
    url: "https://soundcloud.com/pherrismusic/rich-baby-daddy-pherris-edit-a-side",
  },
  {
    id: "lose-my-breath-yanghi-amapiano-edit",
    title: "Lose My Breath Yanghi Amapiano Edit",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/lose-my-breath-yanghi-amapiano-edit",
  },
  {
    id: "kanye-west-i-wonder-yanghi-amapiano-edit-free-dl-1",
    title: "Kanye West I Wonder Yanghi Amapiano Edit Free Dl 1",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/kanye-west-i-wonder-yanghi-amapiano-edit-free-dl-1",
  },
  {
    id: "gunna-fukumean-yanghi-baile-edit",
    title: "Gunna Fukumean Yanghi Baile Edit",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/gunna-fukumean-yanghi-baile-edit",
  },
  {
    id: "4batz-act-ii-bailefunk-adr",
    title: "4batz Act Ii Bailefunk Adr",
    artist: "alldayrayatx",
    url: "https://soundcloud.com/alldayrayatx/4batz-act-ii-bailefunk-adr",
  },
]

export default function EasterEgg() {
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [velocity, setVelocity] = useState({ x: 2, y: 2 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const animationRef = useRef<number | null>(null)

  // Movement animation
  useEffect(() => {
    if (isModalOpen) return // Pause movement when modal is open

    const animate = () => {
      setPosition((prev) => {
        let newX = prev.x + velocity.x
        let newY = prev.y + velocity.y
        let newVelX = velocity.x
        let newVelY = velocity.y

        // Bounce off walls
        if (newX <= 0 || newX >= window.innerWidth - 50) {
          newVelX = -velocity.x
          newX = newX <= 0 ? 0 : window.innerWidth - 50
        }
        if (newY <= 0 || newY >= window.innerHeight - 50) {
          newVelY = -velocity.y
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
  }, [velocity, isModalOpen])

  // Load random track
  const loadRandomTrack = async () => {
    setIsLoading(true)

    // Add slight delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500))

    const randomTrack = SOUNDCLOUD_LIKES[Math.floor(Math.random() * SOUNDCLOUD_LIKES.length)]

    // Create proper embed URL with cyan aesthetic colors
    const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
      randomTrack.url,
    )}&color=%2300ffff&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`

    setCurrentTrack({
      ...randomTrack,
      embedUrl,
    })

    setIsLoading(false)
  }

  // Handle icon click
  const handleClick = () => {
    setIsModalOpen(true)
    loadRandomTrack()
  }

  // Shuffle to new track
  const shuffleTrack = () => {
    loadRandomTrack()
  }

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setIsModalOpen(false)
      }
    }

    if (isModalOpen) {
      window.addEventListener("keydown", handleEsc)
      return () => window.removeEventListener("keydown", handleEsc)
    }
  }, [isModalOpen])

  return (
    <>
      {/* Moving Yellow Mario Question Mark */}
      <div
        className="mario-box absolute transition-all duration-1000 cursor-pointer z-40"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {/* SoundCloud Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

          {/* Modal Content */}
          <div className="relative w-full max-w-2xl bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Music className="w-6 h-6 text-cyan-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">Discovery Mode</h2>
                  <p className="text-xs text-gray-400">Curated from @djsweeterman's collection</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Track Info & Controls */}
            {currentTrack && !isLoading && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{currentTrack.title}</h3>
                    <p className="text-sm text-gray-400">{currentTrack.artist}</p>
                  </div>

                  <button
                    onClick={shuffleTrack}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-cyan-500/30"
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

            {/* SoundCloud Embed */}
            {currentTrack && !isLoading && (
              <div className="relative w-full h-[400px] bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  scrolling="no"
                  frameBorder="no"
                  allow="autoplay"
                  src={currentTrack.embedUrl}
                  className="absolute inset-0"
                />
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/50">
              <p className="text-xs text-center text-gray-500">Press ESC to close • Click outside to dismiss</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
