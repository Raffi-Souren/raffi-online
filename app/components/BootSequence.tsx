'use client'

import { useState, useEffect } from 'react'

export default function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const bootMessages = [
    'BOOTING SYSTEM...',
    'INITIALIZING MEMORY...',
    'LOADING ASSETS...',
    'ESTABLISHING CONNECTION...',
    'SYSTEM READY'
  ]

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step < bootMessages.length - 1) {
        setStep(step + 1)
      } else {
        setTimeout(onComplete, 1000)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [step, onComplete])

  return (
    <div className="fixed inset-0 bg-black text-green-500 flex items-center justify-center">
      <div className="font-mono">
        {bootMessages.slice(0, step + 1).map((message, i) => (
          <div key={i} className="mb-2">
            {message}
          </div>
        ))}
      </div>
    </div>
  )
}

