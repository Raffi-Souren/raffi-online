"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Smartphone, Music, Gamepad, Radio, Phone, Monitor } from "lucide-react"

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
