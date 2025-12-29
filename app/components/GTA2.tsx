"use client"

export default function GTA2() {
  const handlePlayGame = () => {
    window.open("https://dos.zone/grand-theft-auto2/", "_blank", "noopener,noreferrer")
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-yellow-900 to-red-900 p-2 sm:p-4 md:p-6">
      <div className="max-w-2xl text-center space-y-3 sm:space-y-4 md:space-y-6">
        {/* Logo/Title */}
        <div className="space-y-1 sm:space-y-2">
          <h1
            className="text-3xl sm:text-4xl md:text-6xl font-bold text-white drop-shadow-lg"
            style={{ fontFamily: "serif" }}
          >
            GRAND THEFT AUTO
          </h1>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            2
          </h2>
        </div>

        {/* Description */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
          <p className="text-gray-200 text-xs sm:text-sm md:text-base leading-relaxed">
            Experience the classic top-down crime game in your browser. Play GTA 2 with its iconic retro gameplay and
            urban chaos.
          </p>
          <div className="text-[10px] sm:text-xs md:text-sm text-gray-400 space-y-0.5 sm:space-y-1">
            <p>🎮 Top-down action gameplay with keyboard controls</p>
            <p>🏙️ Explore a dystopian future city</p>
            <p>⚡ Powered by DOS.Zone emulation technology</p>
          </div>
        </div>

        {/* Play Button */}
        <button
          onClick={handlePlayGame}
          className="w-full max-w-md px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 hover:from-yellow-500 hover:via-orange-500 hover:to-red-500 text-white font-bold text-base sm:text-lg rounded-lg shadow-2xl transition-all transform hover:scale-105 active:scale-95"
        >
          🎮 Play GTA 2
        </button>

        {/* Info */}
        <div className="text-[10px] sm:text-xs text-gray-400 space-y-0.5 sm:space-y-1">
          <p>Opens in a new tab via DOS.Zone</p>
          <p>May take 1-2 minutes to load • Desktop recommended</p>
          <a
            href="https://dos.zone/grand-theft-auto2/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 hover:underline"
          >
            Direct link →
          </a>
        </div>

        {/* Controls Guide */}
        <div className="bg-black/30 rounded-lg p-3 sm:p-4 text-left text-[10px] sm:text-xs md:text-sm text-gray-300 space-y-1 sm:space-y-2">
          <p className="font-bold text-white">Controls:</p>
          <div className="grid grid-cols-2 gap-1 sm:gap-2">
            <div>
              <span className="text-yellow-400">Arrow Keys</span> - Move
            </div>
            <div>
              <span className="text-yellow-400">Ctrl</span> - Fire
            </div>
            <div>
              <span className="text-yellow-400">Enter</span> - Enter Vehicle
            </div>
            <div>
              <span className="text-yellow-400">Tab</span> - Change Weapon
            </div>
            <div>
              <span className="text-yellow-400">Space</span> - Secondary Fire
            </div>
            <div>
              <span className="text-yellow-400">Shift</span> - Sprint
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
