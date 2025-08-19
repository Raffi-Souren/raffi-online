"use client"
import Image from "next/image"
import WindowShell from "../../components/ui/WindowShell"

interface AboutWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function AboutWindow({ isOpen, onClose }: AboutWindowProps) {
  if (!isOpen) return null

  return (
    <WindowShell id="about" title="ABOUT ME - RAF.TXT" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        {/* Header with RAF Logo */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <Image
            src="/RAF-logo.png"
            alt="RAF Logo"
            width={80}
            height={80}
            className="rounded-lg border border-gray-200"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RAFFI</h1>
            <p className="text-gray-600">Entrepreneur | AI Architect | DJ</p>
          </div>
        </div>

        {/* Bio Section */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block">
            😎 ABOUT
          </h2>
          <p className="text-gray-700 leading-relaxed">
            AI architect at IBM, helping companies build and scale AI products. Advisor at Nameless Ventures, co-founder of Bad Company and indify. Based in NYC, usually digging for vinyl, DJing at a friends function, or experimenting with new tech.
          </p>
        </div>

        {/* Contact Section */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block">
            📧 CONTACT
          </h2>
          <div className="space-y-2">
            <p className="text-gray-700">
              <span className="font-semibold">Email:</span>{" "}
              <a href="mailto:raffi@notgoodcompany.com" className="text-blue-600 hover:underline">
                raffi@notgoodcompany.com
              </a>
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Location:</span> Brooklyn, New York
            </p>
          </div>
        </div>

        {/* AI Summit Keynote Embed */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block">
            🌀 AI SUMMIT KEYNOTE - BANKING ON AI AGENTS
          </h3>
          <p className="text-gray-600 mb-3">Finance stage at Javits Center NYC - Dec 14, 2024</p>
          <div className="w-full">
            <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
              <iframe
                src="https://player.vimeo.com/video/1047612862?badge=0&autopause=0&player_id=0&app_id=58479"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                title="Banking on AI Agents - Keynote @ AI Summit 12-14-24"
                className="rounded-lg border border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* BADCO F/W Capsule Embed */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block">
            🎨 BADCO F/W CAPSULE - SCREENPRINTING AND HOSTING POP-UPS
          </h3>
          <p className="text-gray-600 mb-3">Bowery Showroom 2021-2023</p>
          <div className="w-full">
            <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
              <iframe
                src="https://player.vimeo.com/video/647500740?badge=0&autopause=0&player_id=0&app_id=58479"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                title="BADCOMPANY F/W 21-22 CAPSULE"
                className="rounded-lg border border-gray-200"
              />
            </div>
          </div>
        </div>
      </div>
    </WindowShell>
  )
}
