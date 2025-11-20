"use client"

import { useState } from "react"

export default function DoomGame() {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-[600px] aspect-video relative bg-black rounded-lg overflow-hidden border-2 border-gray-700 shadow-lg">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-green-500 font-mono">
            Loading DOOM Captcha...
          </div>
        )}
        <iframe
          src="https://doom-captcha.vercel.app/"
          className="w-full h-full border-0"
          onLoad={() => setIsLoaded(true)}
          allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"
          title="DOOM Captcha"
        />
      </div>
      <div className="mt-4 text-center">
        <p className="text-gray-400 text-sm font-mono mb-2">Prove you are human by slaying demons.</p>
        <div className="text-xs text-gray-500">
          Credit:{" "}
          <a
            href="https://x.com/rauchg/status/1874130110120706556"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Guillermo Rauch
          </a>
        </div>
      </div>
    </div>
  )
}
