'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="fixed top-0 right-0 z-50 p-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-black"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      
      {isOpen && (
        <nav className="fixed inset-0 bg-white z-50 p-6">
          <div className="flex justify-end">
            <button
              onClick={() => setIsOpen(false)}
              className="text-black"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <a href="#ai" className="text-black text-xl hover:opacity-70">AI Services</a>
            <a href="#design" className="text-black text-xl hover:opacity-70">Design</a>
            <a href="#blockchain" className="text-black text-xl hover:opacity-70">Blockchain</a>
            <a href="#events" className="text-black text-xl hover:opacity-70">Events</a>
          </div>
        </nav>
      )}
    </header>
  )
}

