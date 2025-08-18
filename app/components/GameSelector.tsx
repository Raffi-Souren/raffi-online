"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Smartphone, Music, Gamepad, Radio, Phone, Monitor } from "lucide-react"
import BlackberryMockup from "./BlackberryMockup"
import IpodClassicMockup from "./IpodClassicMockup"
import RazorPhoneMockup from "./RazorPhoneMockup"
import DesktopMockup from "./DesktopMockup"
import WebGamesHub from "./WebGamesHub"
import WindowShell from "./WindowShell"

type Device = "blackberry" | "ipod" | "webgames" | "psp" | "razor" | "desktop" | null

export default function GameSelector() {
  const [selectedDevice, setSelectedDevice] = useState<Device>(null)

  const devices = [
    {
      id: "blackberry",
      name: "Blackberry",
      icon: Smartphone,
      description: "Play Brickbreaker",
      color: "bg-gray-900",
    },
    {
      id: "ipod",
      name: "iPod Classic",
      icon: Music,
      description: "Play Parachute",
      color: "bg-zinc-200",
    },
    {
      id: "razor",
      name: "Motorola Razr",
      icon: Phone,
      description: "Play Snake",
      color: "bg-pink-600",
    },
    {
      id: "desktop",
      name: "Desktop PC",
      icon: Monitor,
      description: "Play Minesweeper",
      color: "bg-blue-700",
    },
    {
      id: "webgames",
      name: "Web Games",
      icon: Gamepad,
      description: "Classic Arcade Games",
      color: "bg-green-600",
    },
    {
      id: "psp",
      name: "Emulator",
      icon: Radio,
      description: "Retro Console Games",
      color: "bg-blue-900",
    },
  ]

  if (selectedDevice === "blackberry") {
    return (
      <WindowShell title="BLACKBERRY BRICKBREAKER" onClose={() => setSelectedDevice(null)} size="md">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="scale-75 md:scale-100">
            <BlackberryMockup />
          </div>
        </div>
      </WindowShell>
    )
  }

  if (selectedDevice === "ipod") {
    return (
      <WindowShell title="IPOD CLASSIC PARACHUTE" onClose={() => setSelectedDevice(null)} size="md">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="scale-75 md:scale-100">
            <IpodClassicMockup />
          </div>
        </div>
      </WindowShell>
    )
  }

  if (selectedDevice === "razor") {
    return (
      <WindowShell title="MOTOROLA RAZR SNAKE" onClose={() => setSelectedDevice(null)} size="md">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="scale-75 md:scale-100">
            <RazorPhoneMockup />
          </div>
        </div>
      </WindowShell>
    )
  }

  if (selectedDevice === "desktop") {
    return (
      <WindowShell title="DESKTOP MINESWEEPER" onClose={() => setSelectedDevice(null)} size="lg">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="scale-75 md:scale-100 w-full max-w-4xl">
            <DesktopMockup />
          </div>
        </div>
      </WindowShell>
    )
  }

  if (selectedDevice === "webgames") {
    return (
      <WindowShell title="WEB GAMES HUB" onClose={() => setSelectedDevice(null)} size="lg">
        <div className="min-h-[400px]">
          <WebGamesHub />
        </div>
      </WindowShell>
    )
  }

  if (selectedDevice === "psp") {
    return (
      <WindowShell title="RETRO CONSOLE EMULATOR" onClose={() => setSelectedDevice(null)} size="md">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-lg md:text-2xl font-bold mb-4">Retro Console Emulator</h2>
            <p className="text-gray-400 mb-6 text-sm md:text-base">Play classic console games in your browser</p>
            <button
              onClick={() => window.open("/games/emulator", "_blank")}
              className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm md:text-base min-h-[44px]"
            >
              Open Emulator
            </button>
            <div className="mt-4 text-xs md:text-sm text-gray-500">
              <p>⚠️ Educational purposes only - Bring your own ROM files</p>
            </div>
          </div>
        </div>
      </WindowShell>
    )
  }

  return (
    <div className="max-h-[calc(82dvh-120px)] max-h-[calc(82svh-120px)] overflow-y-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
        {devices.map((device) => (
          <Card
            key={device.id}
            className={`p-3 cursor-pointer transition-transform hover:scale-105 ${device.color} text-white min-h-[72px] flex flex-col justify-center`}
            onClick={() => setSelectedDevice(device.id as Device)}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <device.icon size={24} className="md:w-8 md:h-8" />
              <div>
                <h3 className="font-bold text-sm">{device.name}</h3>
                <p className="text-xs opacity-80">{device.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
