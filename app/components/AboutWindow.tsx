"use client"

import WindowShell from "../../components/ui/WindowShell"
import Image from "next/image"

interface AboutWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function AboutWindow({ isOpen, onClose }: AboutWindowProps) {
  if (!isOpen) return null

  return (
    <WindowShell title="ABOUT ME - RAF.TXT" onClose={onClose}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
          <div className="w-20 h-20 shrink-0">
            <Image src="/RAF-logo.png" alt="RAF Logo" width={80} height={80} className="w-full h-full object-contain" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">RAFFI KHATCHADOURIAN</h1>
            <p className="text-lg text-gray-600 mb-4">NYC-based AI architect and technology consultant</p>
          </div>
        </div>

        {/* Bio Section */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b-2 border-blue-400 pb-1 inline-block">BIO</h3>
          <div className="space-y-4 text-gray-700">
            <p>
              AI architect @ IBM watsonx. Advisor @ Nameless Ventures. Co-founder Bad Company creative collective. Ex-COO indify. Mathematical Economics, Colgate.
            </p>
            <p>
              Building at the intersection of enterprise AI and NYC creative culture. DJing, soccer, vinyl.
            </p>
          </div>
        </div>

        {/* AI Summit Keynote Embed */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block">
            🎤 AI SUMMIT KEYNOTE - BANKING ON AI AGENTS
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
