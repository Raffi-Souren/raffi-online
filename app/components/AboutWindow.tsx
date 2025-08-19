"use client"

import { X } from "lucide-react"
import Image from "next/image"

interface AboutWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function AboutWindow({ isOpen, onClose }: AboutWindowProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Window */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">ABOUT ME - RAF.TXT</span>
          </div>
          <button onClick={onClose} className="hover:bg-blue-800 p-1 rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-60px)]">
          {/* Header Section */}
          <div className="flex items-center gap-6 mb-8 pb-6 border-b border-gray-200">
            <Image src="/RAF-logo.png" alt="RAF Logo" width={80} height={80} className="rounded-lg" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">RAFFI KHATCHADOURIAN</h1>
              <p className="text-gray-600 text-lg">NYC-based AI architect and technology consultant</p>
            </div>
          </div>

          {/* Bio Section */}
          <div className="mb-8">
            <p className="text-gray-700 leading-relaxed mb-4">
              Technology consultant and AI architect based in NYC. I help companies build and scale AI products at IBM, mostly working on watsonx for financial services clients. Also advising at Nameless Ventures and running Bad Company, a creative collective that throws events around the city.
            </p>
            <p className="text-gray-700 leading-relaxed">
              When I'm not working on AI systems, or advising startups, I'm usually digging for vinyl with fam, DJing at a friends function, or playing pick-up soccer.
            </p>
          </div>

          {/* Timeline Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b-2 border-blue-400 pb-2 inline-block">
              Recent Highlights
            </h2>

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

            {/* Other Timeline Items */}
            <div className="space-y-4">
              <div className="border-l-4 border-blue-400 pl-4">
                <h3 className="font-semibold text-gray-900">🚀 AI Consulting & Architecture</h3>
                <p className="text-gray-600 text-sm">Ongoing - Present</p>
                <p className="text-gray-700 mt-1">
                  Helping startups and enterprises implement AI solutions, from strategy to deployment.
                </p>
              </div>

              <div className="border-l-4 border-blue-400 pl-4">
                <h3 className="font-semibold text-gray-900">🎯 Technology Innovation</h3>
                <p className="text-gray-600 text-sm">2020 - Present</p>
                <p className="text-gray-700 mt-1">
                  Exploring emerging technologies and their practical applications in business contexts.
                </p>
              </div>

              <div className="border-l-4 border-blue-400 pl-4">
                <h3 className="font-semibold text-gray-900">🌐 Creative Projects</h3>
                <p className="text-gray-600 text-sm">2017 - Present</p>
                <p className="text-gray-700 mt-1">
                  Various creative collaborations spanning fashion, events, and digital experiences.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Get in Touch</h2>
            <div className="flex flex-wrap gap-4">
              <a href="mailto:raffi@notgoodcompany.com" className="text-blue-600 hover:text-blue-800 transition-colors">
                📧 raffi@notgoodcompany.com
              </a>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">📍 New York City</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
