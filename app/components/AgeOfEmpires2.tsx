"use client"

export default function AgeOfEmpires2() {
  const handlePlayGame = () => {
    window.open("https://dos.zone/age-of-empires2/", "_blank", "noopener,noreferrer")
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-900 via-yellow-800 to-orange-900 p-2 sm:p-4 md:p-6">
      <div className="max-w-2xl text-center space-y-3 sm:space-y-4 md:space-y-6">
        {/* Logo/Title */}
        <div className="space-y-1 sm:space-y-2">
          <h1
            className="text-3xl sm:text-4xl md:text-6xl font-bold text-amber-200 drop-shadow-lg"
            style={{ fontFamily: "serif" }}
          >
            AGE OF
          </h1>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">
            EMPIRES II
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-amber-300 font-semibold">The Age of Kings</p>
        </div>

        {/* Description */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
          <p className="text-gray-200 text-xs sm:text-sm md:text-base leading-relaxed">
            Command medieval civilizations and lead them to victory in this legendary real-time strategy game.
          </p>
          <div className="text-[10px] sm:text-xs md:text-sm text-gray-400 space-y-0.5 sm:space-y-1">
            <p>🏰 13 civilizations with unique units and technologies</p>
            <p>⚔️ Build armies, manage resources, conquer enemies</p>
            <p>🌍 Campaign through historic battles and scenarios</p>
            <p>⚡ Powered by DOS.Zone emulation technology</p>
          </div>
        </div>

        {/* Play Button */}
        <button
          onClick={handlePlayGame}
          className="w-full max-w-md px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600 hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 text-white font-bold text-base sm:text-lg rounded-lg shadow-2xl transition-all transform hover:scale-105 active:scale-95"
        >
          ⚔️ Play Age of Empires II
        </button>

        {/* Info */}
        <div className="text-[10px] sm:text-xs text-gray-400 space-y-0.5 sm:space-y-1">
          <p>Opens in a new tab via DOS.Zone</p>
          <p>May take 2-3 minutes to load • Desktop recommended</p>
          <a
            href="https://dos.zone/age-of-empires2/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline"
          >
            Direct link →
          </a>
        </div>

        {/* Controls Guide */}
        <div className="bg-black/30 rounded-lg p-3 sm:p-4 text-left text-[10px] sm:text-xs md:text-sm text-gray-300 space-y-1 sm:space-y-2">
          <p className="font-bold text-white">Controls:</p>
          <div className="grid grid-cols-2 gap-1 sm:gap-2">
            <div>
              <span className="text-amber-400">Left Click</span> - Select
            </div>
            <div>
              <span className="text-amber-400">Right Click</span> - Action
            </div>
            <div>
              <span className="text-amber-400">Drag</span> - Box Select
            </div>
            <div>
              <span className="text-amber-400">Arrow Keys</span> - Scroll
            </div>
            <div>
              <span className="text-amber-400">Ctrl + #</span> - Create Group
            </div>
            <div>
              <span className="text-amber-400">#</span> - Select Group
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-2">
            Tip: Start with the tutorial to learn building, resource gathering, and combat basics!
          </p>
        </div>
      </div>
    </div>
  )
}
