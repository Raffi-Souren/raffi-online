"use client"

import { WindowShell } from "../../components/ui/WindowShell"
import Counter from "./Counter"

interface AboutWindowProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutWindow({ isOpen, onClose }: AboutWindowProps) {
  if (!isOpen) return null

  return (
    <WindowShell title="ABOUT ME - RAF.TXT" onClose={onClose}>
      <div className="space-y-6">
        {/* Profile Section */}
        <div className="content-section">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shrink-0">
              RAF
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">RAFFI SOURENKHATCHADOURIAN</h1>
              <p className="text-gray-600 text-sm mb-4">NYC-based AI architect and technology consultant</p>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-orange-400 pb-1 inline-block">
            BIO
          </h2>
          <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
            <p>
              Raffi is an NYC-based AI Architect driving generative AI transformations for IBM's enterprise clients
              since 2016 - from early Watson solutions to today's large-scale automation initiatives. He's also an
              entrepreneur and advisor @ Nameless Ventures, plus co-founder of Bad Company, a creative collective
              managing partnerships at high-profile NYC venues.
            </p>
            <p>
              Previously COO @ indify (music data startup through Thought Into Action incubator). Outside corporate
              life, he's deep in NYC's creative scene - DJing across city venues, playing pick-up soccer in Brooklyn,
              and crate-digging for vinyls with family.
            </p>
          </div>
        </div>

        {/* AI Summit Keynote */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block">
            🎤 AI SUMMIT KEYNOTE - BANKING ON AI AGENTS
          </h3>
          <p className="text-sm text-gray-600 mb-3">Finance stage at Javits Center NYC - Dec 14, 2024</p>
          <div className="w-full">
            <iframe
              className="w-full h-48 md:h-64 rounded-lg border border-gray-200"
              src="https://player.vimeo.com/video/1047612862?badge=0&autopause=0&player_id=0&app_id=58479"
              loading="lazy"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              title="Banking on AI Agents - Keynote @ AI Summit 12-14-24"
            />
          </div>
        </div>

        {/* By the Numbers */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center border-b-2 border-green-400 pb-1 inline-block w-full">
            BY THE NUMBERS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Counter end={150} label="DJ Sets" icon="🎧" />
            <Counter end={120} label="Events" icon="📅" />
            <Counter end={30} label="AI Projects" icon="🤖" />
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-purple-400 pb-1 inline-block">
            CONTACT
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>📧</span>
              <a href="mailto:raffi@notgoodcompany.com" className="text-blue-600 hover:underline">
                raffi@notgoodcompany.com
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span>🔗</span>
              <a
                href="https://linkedin.com/in/raffisourenkhatchadourian"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                LinkedIn
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span>🎵</span>
              <a
                href="https://soundcloud.com/notgoodcompany"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                SoundCloud
              </a>
            </div>
          </div>
        </div>
      </div>
    </WindowShell>
  )
}
