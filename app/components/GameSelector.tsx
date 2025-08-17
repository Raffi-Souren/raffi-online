'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Smartphone, Music, Gamepad, Radio, Phone, Monitor } from 'lucide-react'
import BlackberryMockup from './BlackberryMockup'
import IpodClassicMockup from './IpodClassicMockup'
import RazorPhoneMockup from './RazorPhoneMockup'
import DesktopMockup from './DesktopMockup'

type Device = 'blackberry' | 'ipod' | 'gameboy' | 'psp' | 'razor' | 'desktop' | null

export default function GameSelector() {
  const [selectedDevice, setSelectedDevice] = useState<Device>(null)

  const devices = [
    {
      id: 'blackberry',
      name: 'Blackberry',
      icon: Smartphone,
      description: 'Play Brickbreaker',
      color: 'bg-gray-900'
    },
    {
      id: 'ipod',
      name: 'iPod Classic',
      icon: Music,
      description: 'Play Parachute',
      color: 'bg-zinc-200'
    },
    {
      id: 'razor',
      name: 'Motorola Razr',
      icon: Phone,
      description: 'Play Snake',
      color: 'bg-pink-600'
    },
    {
      id: 'desktop',
      name: 'Desktop PC',
      icon: Monitor,
      description: 'Play Minesweeper',
      color: 'bg-blue-700'
    },
    {
      id: 'gameboy',
      name: 'Gameboy',
      icon: Gamepad,
      description: 'Coming Soon',
      color: 'bg-green-600'
    },
    {
      id: 'psp',
      name: 'PSP',
      icon: Radio,
      description: 'Coming Soon',
      color: 'bg-blue-900'
    }
  ]

  if (selectedDevice === 'blackberry') {
    return (
      <div className="relative">
        <button
          onClick={() => setSelectedDevice(null)}
          className="absolute top-4 right-4 z-50 bg-gray-800 text-white px-3 py-1 rounded-md hover:bg-gray-700"
        >
          Back
        </button>
        <BlackberryMockup />
      </div>
    )
  }

  if (selectedDevice === 'ipod') {
    return (
      <div className="relative">
        <button
          onClick={() => setSelectedDevice(null)}
          className="absolute top-4 right-4 z-50 bg-gray-800 text-white px-3 py-1 rounded-md hover:bg-gray-700"
        >
          Back
        </button>
        <IpodClassicMockup />
      </div>
    )
  }

  if (selectedDevice === 'razor') {
    return (
      <div className="relative">
        <button
          onClick={() => setSelectedDevice(null)}
          className="absolute top-4 right-4 z-50 bg-gray-800 text-white px-3 py-1 rounded-md hover:bg-gray-700"
        >
          Back
        </button>
        <RazorPhoneMockup />
      </div>
    )
  }

  if (selectedDevice === 'desktop') {
    return (
      <div className="relative">
        <button
          onClick={() => setSelectedDevice(null)}
          className="absolute top-4 right-4 z-50 bg-gray-800 text-white px-3 py-1 rounded-md hover:bg-gray-700"
        >
          Back
        </button>
        <DesktopMockup />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 max-w-3xl mx-auto">
      {devices.map((device) => (
        <Card
          key={device.id}
          className={`p-6 cursor-pointer transition-transform hover:scale-105 ${device.color} text-white`}
          onClick={() => setSelectedDevice(device.id as Device)}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <device.icon size={48} />
            <div>
              <h3 className="font-bold text-lg">{device.name}</h3>
              <p className="text-sm opacity-80">{device.description}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
