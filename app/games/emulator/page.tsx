"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"

// Lazy load the heavy emulator component
const RetroEmulator = dynamic(() => import("@/app/components/RetroEmulator"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-xl text-white">Loading Emulator...</p>
      </div>
    </div>
  ),
})

interface GameCore {
  id: string
  name: string
  description: string
  fileTypes: string[]
}

const availableCores: GameCore[] = [
  {
    id: "nes",
    name: "Nintendo (NES)",
    description: "8-bit Nintendo Entertainment System",
    fileTypes: [".nes"],
  },
  {
    id: "snes",
    name: "Super Nintendo (SNES)",
    description: "16-bit Super Nintendo Entertainment System",
    fileTypes: [".smc", ".sfc"],
  },
  {
    id: "gb",
    name: "Game Boy",
    description: "Nintendo Game Boy handheld console",
    fileTypes: [".gb"],
  },
  {
    id: "gbc",
    name: "Game Boy Color",
    description: "Nintendo Game Boy Color handheld console",
    fileTypes: [".gbc"],
  },
  {
    id: "genesis",
    name: "Sega Genesis",
    description: "16-bit Sega Genesis/Mega Drive",
    fileTypes: [".md", ".gen"],
  },
]

export default function EmulatorPage() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [selectedCore, setSelectedCore] = useState<string | null>(null)
  const [emulatorStarted, setEmulatorStarted] = useState(false)

  const startEmulator = (coreId: string) => {
    setSelectedCore(coreId)
    setEmulatorStarted(true)
  }

  const closeEmulator = () => {
    setEmulatorStarted(false)
    setSelectedCore(null)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Educational Disclaimer */}
      {!disclaimerAccepted && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
          <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-6 max-w-2xl">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">⚠️</span>
              <h2 className="text-xl font-bold text-black">Educational Purposes Only</h2>
            </div>
            <div className="text-black text-sm space-y-3 mb-6">
              <p>
                <strong>This emulator is provided for educational and preservation purposes only.</strong>
              </p>
              <p>
                Users are responsible for ensuring they own the original games and have legal rights to the ROM files
                used. Please respect copyright laws and intellectual property rights.
              </p>
              <p>
                By proceeding, you acknowledge that you understand these terms and will only use ROM files that you
                legally own.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setDisclaimerAccepted(true)}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-semibold min-h-[44px]"
              >
                I Understand & Accept
              </button>
              <Link
                href="/"
                className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 font-semibold min-h-[44px] flex items-center"
              >
                Go Back
              </Link>
            </div>
          </div>
        </div>
      )}

      {disclaimerAccepted && (
        <div className="max-w-7xl mx-auto p-4">
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2">RetroArch Web Emulator</h1>
            <p className="text-gray-400">Play classic console games in your browser using EmulatorJS</p>
          </div>

          {/* Console Selection */}
          {!emulatorStarted && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4">Select Console</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {availableCores.map((core) => (
                  <div
                    key={core.id}
                    className="p-6 bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-blue-400 rounded-lg cursor-pointer transition-all min-h-[120px] flex flex-col justify-center"
                    onClick={() => startEmulator(core.id)}
                  >
                    <h3 className="font-bold text-lg mb-2">{core.name}</h3>
                    <p className="text-sm text-gray-300 mb-3">{core.description}</p>
                    <div className="text-xs text-gray-400">
                      <span className="font-semibold">Supported files:</span> {core.fileTypes.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emulator */}
          {emulatorStarted && selectedCore && (
            <div className="mb-6">
              <RetroEmulator core={selectedCore} onClose={closeEmulator} />
            </div>
          )}

          {/* Resources */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Resources & Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2">EmulatorJS Links:</h4>
                <ul className="space-y-1 text-blue-400">
                  <li>
                    <a
                      href="https://emulatorjs.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline min-h-[44px] flex items-center"
                    >
                      • Official Website
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/EmulatorJS/EmulatorJS"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline min-h-[44px] flex items-center"
                    >
                      • GitHub Repository
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://emulatorjs.org/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline min-h-[44px] flex items-center"
                    >
                      • Documentation
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Legal Notice:</h4>
                <ul className="space-y-1 text-gray-300">
                  <li>• Only use ROM files you legally own</li>
                  <li>• Respect copyright and intellectual property</li>
                  <li>• This is for educational purposes only</li>
                  <li>• We do not provide or host ROM files</li>
                  <li>• EmulatorJS is open source software</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Final Disclaimer */}
          <div className="mt-6 p-4 bg-red-900 bg-opacity-50 rounded text-red-200 text-sm">
            <p className="font-bold mb-2">⚖️ Legal Reminder</p>
            <p>
              This emulator is provided for educational purposes only. EmulatorJS is open source software. Users must
              provide their own legally-owned ROM files. We do not provide, host, or distribute copyrighted game files.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
