"use client"
import { useState } from "react"
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
    id: "mitsubishi-sony",
    title: "Mitsubishi Sony",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/mitsubishi-sony",
  },
  {
    id: "partynextdoor-showing-you-baile-baile-funk-edit",
    title: "Showing You (Baile Funk Edit)",
    artist: "PARTYNEXTDOOR",
    url: "https://soundcloud.com/ang-official/partynextdoor-showing-you-baile-baile-funk-edit",
  },
  {
    id: "beyonce-end-of-time-sydney-sousa-baile-funk-edit",
    title: "End of Time (Sydney Sousa Baile Funk Edit)",
    artist: "Beyoncé",
    url: "https://soundcloud.com/dj-sydney-sousa/beyonce-end-of-time-sydney-sousa-baile-funk-edit",
  },
  {
    id: "peggy-gou-it-goes-like-nanana-baile-funk-edit",
    title: "It Goes Like (Nanana) Baile Funk Edit",
    artist: "Peggy Gou",
    url: "https://soundcloud.com/caiohot/peggy-gou-it-goes-like-nanana-baile-funk-edit",
  },
  {
    id: "sango-amor-di-american-loverboy",
    title: "Amor Di American Loverboy",
    artist: "Sango",
    url: "https://soundcloud.com/manlikesirene/sango-amor-di-american-loverboy",
  },
  {
    id: "chamber-of-reflection-brazilian-funk-remix",
    title: "Chamber of Reflection (Brazilian Funk Remix)",
    artist: "Mac DeMarco",
    url: "https://soundcloud.com/user-167742358/chamber-of-reflection-brazilian-funk-remix",
  },
  {
    id: "fisherrr-shekdash-remix",
    title: "Fisher (Shekdash Remix)",
    artist: "shekdash",
    url: "https://soundcloud.com/shekdash/fisherrr-shekdash-remix",
  },
  {
    id: "kanye-west-i-wonder-yanghi-amapiano-edit",
    title: "I Wonder (Yanghi Amapiano Edit)",
    artist: "Kanye West",
    url: "https://soundcloud.com/giovaneyanghi/kanye-west-i-wonder-yanghi-amapiano-edit-free-dl-1",
  },
  {
    id: "4batz-act-ii-bailefunk-adr",
    title: "Act II (Baile Funk Edit)",
    artist: "4batz",
    url: "https://soundcloud.com/alldayrayatx/4batz-act-ii-bailefunk-adr",
  },
  {
    id: "raf-republic-mar-7",
    title: "RAF Republic Mar 7",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/raf-republic-mar-7",
  },
  {
    id: "andromeda-by-sweeterman",
    title: "Andromeda By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/andromeda-by-sweeterman",
  },
  {
    id: "kim-k-by-sweeterman",
    title: "Kim K By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/kim-k-by-sweeterman",
  },
  {
    id: "jam-with-brie",
    title: "Jam With Brie",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/jam-with-brie",
  },
  {
    id: "whats-the-move-with-brie",
    title: "What's The Move With Brie",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/whats-the-move-with-brie",
  },
  {
    id: "escondido-x-badco",
    title: "Escondido X BadCo",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/escondido-x-badco",
  },
  {
    id: "tristan-thompson",
    title: "Tristan Thompson",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/tristan-thompson",
  },
  {
    id: "ftsv1latenightsnacc",
    title: "FTS V1 Late Night Snacc",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/ftsv1latenightsnacc",
  },
  {
    id: "ftsv1dinner",
    title: "FTS V1 Dinner",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/ftsv1dinner",
  },
  {
    id: "ftsv1breakfast",
    title: "FTS V1 Breakfast",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/ftsv1breakfast",
  },
  {
    id: "drake-sweeterman-explicit",
    title: "Sweeterman (Explicit)",
    artist: "Drake",
    url: "https://soundcloud.com/chargedupdrake/drake-sweeterman-explicit",
  },
  {
    id: "latch-feat-sam-smith",
    title: "Latch (feat. Sam Smith)",
    artist: "Disclosure",
    url: "https://soundcloud.com/disclosure/latch-feat-sam-smith",
  },
  {
    id: "sleepless",
    title: "Sleepless",
    artist: "Flume",
    url: "https://soundcloud.com/flume/sleepless",
  },
  {
    id: "say-my-name-feat-zyra",
    title: "Say My Name (feat. Zyra)",
    artist: "ODESZA",
    url: "https://soundcloud.com/odesza/say-my-name-feat-zyra",
  },
  {
    id: "glowed-up-feat-anderson-paak",
    title: "Glowed Up (feat. Anderson .Paak)",
    artist: "Kaytranada",
    url: "https://soundcloud.com/kaytranada/glowed-up-feat-anderson-paak",
  },
  {
    id: "gosh",
    title: "Gosh",
    artist: "Jamie xx",
    url: "https://soundcloud.com/jamie-xx/gosh",
  },
  {
    id: "kiara-feat-bajka",
    title: "Kiara (feat. Bajka)",
    artist: "Bonobo",
    url: "https://soundcloud.com/bonobomusic/kiara-feat-bajka",
  },
  {
    id: "a-walk",
    title: "A Walk",
    artist: "Tycho",
    url: "https://soundcloud.com/tycho/a-walk",
  },
  {
    id: "a-new-error",
    title: "A New Error",
    artist: "Moderat",
    url: "https://soundcloud.com/moderat-official/a-new-error",
  },
  {
    id: "glue",
    title: "Glue",
    artist: "Bicep",
    url: "https://soundcloud.com/bicep-music/glue",
  },
  {
    id: "odessa",
    title: "Odessa",
    artist: "Caribou",
    url: "https://soundcloud.com/caribouband/odessa",
  },
]

export default function EasterEgg() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadRandomTrack = () => {
    setIsLoading(true)
    const randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    setCurrentTrack(randomTrack)
    // Small delay to show loading state
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
      {/* Animated Mario Question Mark - Bottom Left Corner */}
      <div className="mario-box fixed bottom-16 left-4 z-[2000] cursor-pointer" onClick={handleClick}>
        <div className="mario-box-inner">?</div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setIsModalOpen(false)} />

          <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div>
                  <h2 className="text-lg font-bold text-white">Discovery Mode</h2>
                  <p className="text-sm text-gray-400">{SOUNDCLOUD_TRACKS.length} curated tracks</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
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
                      key={currentTrack.id} // Force re-render when track changes
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
