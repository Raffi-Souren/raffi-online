"use client"

export default function DoomGame() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-red-950 via-gray-900 to-black p-2 sm:p-4">
      {/* Logo/Title */}
      <div className="mb-2 text-center">
        <h1
          className="text-5xl sm:text-7xl font-bold text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]"
          style={{ fontFamily: "monospace" }}
        >
          DOOM
        </h1>
        <h2 className="text-2xl sm:text-3xl font-bold text-green-500">CAPTCHA</h2>
        <p className="text-sm text-gray-400 font-mono">Prove you are human by slaying demons.</p>
        <p className="text-xs text-gray-500 mt-1">
          Credit:{" "}
          <a
            href="https://x.com/rauchg/status/1874130110120706556"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:underline"
          >
            Guillermo Rauch
          </a>
        </p>
      </div>

      {/* Game Embed */}
      <div className="w-full h-full max-w-5xl flex flex-col">
        <div className="flex-1 relative rounded-lg overflow-hidden border-2 border-red-900 shadow-2xl">
          <iframe
            src="https://doom-captcha.vercel.app/"
            className="w-full h-full"
            style={{ minHeight: "500px" }}
            allow="fullscreen; autoplay"
            title="DOOM CAPTCHA - Prove you are human by slaying demons"
          />
        </div>
      </div>

      {/* Controls Guide */}
      <div className="mt-2 text-xs text-gray-500 text-center font-mono">
        Use arrow keys or WASD to move, space to shoot
      </div>
    </div>
  )
}
