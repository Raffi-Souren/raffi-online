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
    id: "kim-k-by-sweeterman",
    title: "Kim K By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/kim-k-by-sweeterman",
  },
  {
    id: "habibi-funk-beirut",
    title: "Habibi Funk Beirut",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-beirut",
  },
  {
    id: "disclosure-latch-feat-sam-smith",
    title: "Latch (feat. Sam Smith)",
    artist: "disclosure",
    url: "https://soundcloud.com/disclosure/latch-feat-sam-smith",
  },
]

export default function EasterEgg() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)

  const loadRandomTrack = () => {
    const randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    setCurrentTrack(randomTrack)
  }

  const handleClick = () => {
    setIsModalOpen(true)
    if (!currentTrack) {
      loadRandomTrack()
    }
  }

  const buildEmbedUrl = (track: Track) => {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
  }

  return (
    <>
      {/* Static Mario Question Mark - Bottom Left Corner */}
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
              {currentTrack && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{currentTrack.title}</h3>
                      <p className="text-sm text-gray-400">{currentTrack.artist}</p>
                    </div>
                    <button
                      onClick={loadRandomTrack}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg flex items-center gap-2"
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
                    />
                  </div>
                </>
              )}

              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-700">
                <span>Click outside to close</span>
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
