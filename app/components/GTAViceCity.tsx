"use client"

import { useState } from "react"

export default function GTAViceCity() {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-2 sm:p-4">
      <div
        className="w-full max-w-[800px] relative bg-black rounded-lg overflow-hidden border-2 border-purple-700 shadow-lg"
        style={{
          aspectRatio: "16/10",
          maxHeight: "70vh",
        }}
      >
        {!isLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-500 font-mono">
            <div className="text-lg sm:text-xl mb-2">Loading GTA: Vice City...</div>
            <div className="text-xs sm:text-sm text-gray-400">Powered by DOS.Zone - This may take a minute to load</div>
          </div>
        )}
        <iframe
          src="https://dos.zone/grand-theft-auto-vice-city/"
          className="w-full h-full border-0"
          onLoad={() => setIsLoaded(true)}
          allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads"
          title="GTA Vice City"
        />
      </div>
      <div className="mt-2 sm:mt-4 text-center max-w-[600px]">
        <p className="text-gray-400 text-xs sm:text-sm font-mono mb-2">
          The open-source implementation of GTA Vice City running in your browser
        </p>
        <div className="text-xs text-gray-500">
          Technology Demo via{" "}
          <a
            href="https://dos.zone/grand-theft-auto-vice-city/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline"
          >
            DOS.Zone
          </a>
          {" • "}
          Powered by reVC engine
        </div>
      </div>
    </div>
  )
}
