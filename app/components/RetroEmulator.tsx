"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Upload, X } from "lucide-react"

interface RetroEmulatorProps {
  core: string
  onClose: () => void
}

export default function RetroEmulator({ core, onClose }: RetroEmulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    setIsLoading(true)
    setError(null)

    // Clear any existing content
    const gameContainer = containerRef.current
    gameContainer.innerHTML = ""

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
          window.EJS_player = '#game-container';
          window.EJS_core = '${core}';
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
          window.EJS_onGameStart = function() {
            console.log('Game started');
          };
          window.EJS_onLoadState = function() {
            console.log('State loaded');
          };
        `

        // Create loader script
        const loaderScript = document.createElement("script")
        loaderScript.src = "https://cdn.emulatorjs.org/stable/data/loader.js"
        loaderScript.type = "text/javascript"
        loaderScript.async = true

        loaderScript.onload = () => {
          console.log("EmulatorJS loaded successfully")
          setIsLoading(false)
        }

        loaderScript.onerror = (error) => {
          console.error("Failed to load EmulatorJS:", error)
          setError("Failed to load emulator. Please check your internet connection and try again.")
          setIsLoading(false)
        }

        // Add scripts to document
        document.head.appendChild(configScript)
        document.head.appendChild(loaderScript)
      } catch (error) {
        console.error("Error setting up emulator:", error)
        setError("Error setting up emulator")
        setIsLoading(false)
      }
    }, 100)

    // Cleanup on unmount
    return () => {
      const scripts = document.querySelectorAll('script[src*="emulatorjs"], script[src*="loader.js"]')
      scripts.forEach((script) => script.remove())
    }
  }, [core])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      const blob = new Blob([arrayBuffer])
      const url = URL.createObjectURL(blob)

      // Update EJS configuration with the ROM file
      ;(window as any).EJS_gameUrl = url
      ;(window as any).EJS_gameName = file.name

      console.log("ROM file loaded:", file.name)
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">RetroArch Web Emulator - {core.toUpperCase()}</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* ROM Upload */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Upload ROM File
            <input
              type="file"
              accept=".nes,.smc,.sfc,.gb,.gbc,.md,.gen,.zip"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <p className="text-sm text-gray-400">Select a ROM file that you legally own to start playing</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-xl text-white">Loading {core.toUpperCase()} Emulator...</p>
            <p className="text-gray-400 mt-2">This may take a moment...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-xl text-red-400 mb-2">Error Loading Emulator</p>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Emulator Container */}
      <div
        id="game-container"
        ref={containerRef}
        className={`w-full bg-black ${isLoading || error ? "hidden" : ""}`}
        style={{ minHeight: "480px", aspectRatio: "4/3" }}
      />

      {/* Instructions */}
      {!isLoading && !error && (
        <div className="p-4 bg-gray-800 text-sm text-gray-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Keyboard Controls:</h4>
              <div className="space-y-1">
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
            <div>
              <h4 className="font-semibold mb-2">Instructions:</h4>
              <ul className="space-y-1 text-xs">
                <li>• Upload a ROM file using the button above</li>
                <li>• Only use ROM files that you legally own</li>
                <li>• The emulator supports save states</li>
                <li>• Use the virtual gamepad on mobile devices</li>
                <li>• Press F11 for fullscreen mode</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
