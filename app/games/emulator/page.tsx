"use client"

import { useEffect, useRef, useState } from "react"

interface GameROM {
  name: string
  core: string
  description: string
  controls: string[]
}

const availableGames: GameROM[] = [
  {
    name: "NES Demo",
    core: "nes",
    description: "Nintendo Entertainment System",
    controls: ["Arrow Keys: D-Pad", "Z: A Button", "X: B Button", "Enter: Start", "Shift: Select"],
  },
  {
    name: "Game Boy Demo",
    core: "gb",
    description: "Nintendo Game Boy",
    controls: ["Arrow Keys: D-Pad", "Z: A Button", "X: B Button", "Enter: Start", "Shift: Select"],
  },
  {
    name: "SNES Demo",
    core: "snes",
    description: "Super Nintendo Entertainment System",
    controls: ["Arrow Keys: D-Pad", "Z: A", "X: B", "A: X", "S: Y", "Q: L", "W: R", "Enter: Start", "Shift: Select"],
  },
]

const cores = [
  { id: "nes", name: "Nintendo (NES)", description: "8-bit Nintendo Entertainment System" },
  { id: "snes", name: "Super Nintendo (SNES)", description: "16-bit Super Nintendo Entertainment System" },
  { id: "gb", name: "Game Boy", description: "Nintendo Game Boy handheld console" },
  { id: "gbc", name: "Game Boy Color", description: "Nintendo Game Boy Color handheld console" },
  { id: "genesis", name: "Sega Genesis", description: "16-bit Sega Genesis/Mega Drive" },
]

export default function EmulatorPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [emulatorLoaded, setEmulatorLoaded] = useState(false)
  const [selectedCore, setSelectedCore] = useState("nes")

  const loadEmulator = () => {
    if (!containerRef.current || !disclaimerAccepted) return

    setIsLoading(true)

    // Clear any existing content
    const gameContainer = document.getElementById("game")
    if (gameContainer) {
      gameContainer.innerHTML = ""
    }

    // Remove existing EmulatorJS scripts
    const existingScripts = document.querySelectorAll('script[src*="emulatorjs"], script[src*="loader.js"]')
    existingScripts.forEach((script) => script.remove())

    // Remove existing config scripts
    const existingConfigs = document.querySelectorAll("script:not([src])")
    existingConfigs.forEach((script) => {
      if (script.innerHTML.includes("EJS_")) {
        script.remove()
      }
    })

    // Wait a moment for cleanup
    setTimeout(() => {
      try {
        // Create configuration script
        const configScript = document.createElement("script")
        configScript.type = "text/javascript"
        configScript.innerHTML = `
          window.EJS_player = '#game';
          window.EJS_core = '${selectedCore}';
          window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
          window.EJS_startOnLoaded = false;
          window.EJS_color = '#0f0f0f';
          window.EJS_VirtualGamepadSettings = {
            enabled: true,
            opacity: 0.8
          };
          window.EJS_biosUrl = '';
          window.EJS_gameUrl = '';
          window.EJS_gameName = 'EmulatorJS';
          window.EJS_loadStateOnStart = false;
        `

        // Create loader script
        const loaderScript = document.createElement("script")
        loaderScript.src = "https://cdn.emulatorjs.org/stable/data/loader.js"
        loaderScript.type = "text/javascript"
        loaderScript.async = true

        loaderScript.onload = () => {
          console.log("EmulatorJS loaded successfully")
          setIsLoading(false)
          setEmulatorLoaded(true)
        }

        loaderScript.onerror = (error) => {
          console.error("Failed to load EmulatorJS:", error)
          setIsLoading(false)
          // Try alternative CDN
          const fallbackScript = document.createElement("script")
          fallbackScript.src = "https://cdn.jsdelivr.net/gh/EmulatorJS/EmulatorJS@latest/data/loader.js"
          fallbackScript.onload = () => {
            setIsLoading(false)
            setEmulatorLoaded(true)
          }
          fallbackScript.onerror = () => {
            setIsLoading(false)
            alert("Failed to load emulator. Please check your internet connection and try again.")
          }
          document.head.appendChild(fallbackScript)
        }

        // Add scripts to document
        document.head.appendChild(configScript)
        document.head.appendChild(loaderScript)
      } catch (error) {
        console.error("Error setting up emulator:", error)
        setIsLoading(false)
      }
    }, 100)
  }

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      const scripts = document.querySelectorAll('script[src*="emulatorjs"], script[src*="loader.js"]')
      scripts.forEach((script) => script.remove())
    }
  }, [])

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
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-semibold"
              >
                I Understand & Accept
              </button>
              <button
                onClick={() => window.history.back()}
                className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 font-semibold"
              >
                Go Back
              </button>
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

          {/* Core Selection */}
          {!emulatorLoaded && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4">Select Console</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {cores.map((core) => (
                  <div
                    key={core.id}
                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                      selectedCore === core.id
                        ? "bg-blue-600 border-2 border-blue-400"
                        : "bg-gray-800 hover:bg-gray-700 border-2 border-transparent"
                    }`}
                    onClick={() => setSelectedCore(core.id)}
                  >
                    <h3 className="font-bold text-lg">{core.name}</h3>
                    <p className="text-sm text-gray-300">{core.description}</p>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <button
                  onClick={loadEmulator}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
                >
                  {isLoading ? "Loading Emulator..." : "Start Emulator"}
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-xl">Loading {cores.find((c) => c.id === selectedCore)?.name} Emulator...</p>
                <p className="text-gray-400 mt-2">This may take a moment...</p>
              </div>
            </div>
          )}

          {/* Emulator Container */}
          {emulatorLoaded && (
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">{cores.find((c) => c.id === selectedCore)?.name} Emulator</h2>
                <button
                  onClick={() => {
                    setEmulatorLoaded(false)
                    const gameContainer = document.getElementById("game")
                    if (gameContainer) gameContainer.innerHTML = ""
                    // Remove scripts
                    const scripts = document.querySelectorAll('script[src*="emulatorjs"], script[src*="loader.js"]')
                    scripts.forEach((script) => script.remove())
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Close Emulator
                </button>
              </div>

              <div
                id="game"
                ref={containerRef}
                className="w-full bg-black rounded border-2 border-gray-700"
                style={{ minHeight: "480px", aspectRatio: "4/3" }}
              />

              <div className="mt-4 p-4 bg-yellow-900 bg-opacity-50 rounded text-yellow-200 text-sm">
                <p className="font-bold mb-2">📁 ROM File Required</p>
                <p>
                  To play games, you need to provide your own ROM files. Use the file upload option in the emulator
                  interface above. Only use ROM files that you legally own.
                </p>
              </div>
            </div>
          )}

          {/* Instructions */}
          {emulatorLoaded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">How to Load Games</h3>
                <ol className="space-y-2 text-sm list-decimal list-inside">
                  <li>Click the folder icon in the emulator to browse for ROM files</li>
                  <li>Select a ROM file from your computer (must be legally owned)</li>
                  <li>Wait for the game to load</li>
                  <li>Use keyboard controls or virtual gamepad to play</li>
                </ol>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Keyboard Controls</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Arrow Keys:</span>
                    <span>D-Pad</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Z:</span>
                    <span>A Button</span>
                  </div>
                  <div className="flex justify-between">
                    <span>X:</span>
                    <span>B Button</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Enter:</span>
                    <span>Start</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shift:</span>
                    <span>Select</span>
                  </div>
                </div>
              </div>
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
                      className="hover:underline"
                    >
                      • Official Website
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/EmulatorJS/EmulatorJS"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      • GitHub Repository
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://emulatorjs.org/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      • Documentation
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Supported File Types:</h4>
                <ul className="space-y-1 text-gray-300">
                  <li>• NES: .nes files</li>
                  <li>• SNES: .smc, .sfc files</li>
                  <li>• Game Boy: .gb, .gbc files</li>
                  <li>• Genesis: .md, .gen files</li>
                  <li>• Most common ROM formats</li>
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
