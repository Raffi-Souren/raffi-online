'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const inspirations = [
  {
    name: 'Poolsuite',
    url: 'https://poolsuite.net',
    description: 'Retro web aesthetics meets modern functionality'
  },
  {
    name: 'AWGE',
    url: 'https://awge.com',
    description: 'Minimalist retro gaming vibes'
  },
  {
    name: 'YesGoodMusic',
    url: 'https://yesgoodmusic.co',
    description: 'Early blogging days inspiration'
  }
]

export default function Inspirations() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`retro-window fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
      ${isOpen ? 'block' : 'hidden'} z-50 w-96`}>
      <div className="flex justify-between items-center p-2 bg-gray-200 border-b-2 border-black">
        <h2 className="pixel-text">INSPIRATIONS.txt</h2>
        <button onClick={() => setIsOpen(false)} className="retro-button p-1">
          <X size={16} />
        </button>
      </div>
      <div className="p-4 bg-white">
        {inspirations.map((site, index) => (
          <div key={index} className="mb-4 last:mb-0">
            <a 
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:bg-gray-100 p-2"
            >
              <h3 className="pixel-text text-lg">{site.name}</h3>
              <p className="text-sm text-gray-600">{site.description}</p>
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

