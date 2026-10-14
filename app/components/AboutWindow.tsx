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
    <WindowShell id="about" title="ABOUT ME - RAF.TXT" onClose={onClose}>
      <div className="space-y-6 text-gray-900">
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
            <h1 className="text-2xl font-bold text-gray-900">
              RAFFI
            </h1>
            <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              Field CTO & Account Technical Leader · IBM Financial Services
            </p>
            <p className="text-gray-600">
              DJ, builder, and a few things in between.
            </p>
          </div>
        </div>

        {/* Bio Section */}
        <div
          className="bg-white p-6 shadow-sm"
          style={{ border: "1px solid #b9c7d9", borderRadius: 6 }}
        >
          <h2
            className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block"
          >
            😎 ABOUT
          </h2>
          <p className="text-gray-700 leading-relaxed">
            I’m Raffi. I DJ, build things, and like bringing people together. Music runs through a lot of
            it—from co-founding indify to throwing events and making things with Bad Company, the
            creative collective I co-founded.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.625, marginTop: 12 }}>
            New York is home, on both sides of the East River. This desktop is a place for the records,
            games, experiments, and ideas I pick up along the way. Some things are finished. Others
            I’m still making and breaking.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.625, marginTop: 16 }}>
            For work, I’m a Field CTO and Account Technical Leader at IBM, helping financial services
            teams put AI and automation into production. I also research how to make AI more reliable
            and advise Nameless.
          </p>
          <a
            href="https://www.raffisourenkhatchadourian.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", color: "#1d4ed8", marginTop: 12, fontSize: 14 }}
            className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Professional bio & work ↗
          </a>
        </div>

        {/* Timeline, as on the about slide */}
        <div
          className="bg-white p-6 shadow-sm"
          style={{ border: "1px solid #b9c7d9", borderRadius: 6 }}
        >
          <h2
            className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block"
          >
            🗂️ RAF.TXT
          </h2>
          <dl style={{ display: "grid", gap: 14, margin: 0 }}>
            {[
              {
                name: "YesGoodMusic",
                years: "2011–2014",
                note: "Interviews with Logic (2011) and more. Coverage of Kendrick Lamar, Swedish House Mafia and Bon Iver.",
              },
              {
                name: "BADCOMPANY",
                years: "2018–2024",
                note: "DJing with friends in NYC. A childhood ticket business funded my DJ equipment.",
              },
              {
                name: "Research",
                years: "2024–present",
                note: "AI agents, output drift and replayable systems.",
              },
            ].map((entry) => (
              <div key={entry.name}>
                <dt style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
                  <strong style={{ color: "#111827" }}>{entry.name}</strong>
                  <span style={{ color: "#4b5563", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{entry.years}</span>
                </dt>
                <dd style={{ margin: "2px 0 0", color: "#374151", lineHeight: 1.6 }}>{entry.note}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Contact Section */}
        <div
          className="bg-white p-6 shadow-sm"
          style={{ border: "1px solid #b9c7d9", borderRadius: 6 }}
        >
          <h2
            className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block"
          >
            📧 CONTACT
          </h2>
          <div className="space-y-2">
            <p className="text-gray-700">
              <span className="font-semibold">Email:</span>{" "}
              <a
                href="mailto:raffi@notgoodcompany.com"
                className="text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                raffi@notgoodcompany.com
              </a>
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Location:</span> Brooklyn, NY
            </p>
          </div>
        </div>

        {/* AI Summit Keynote Embed */}
        <div className="bg-white p-6 shadow-sm" style={{ border: "1px solid #b9c7d9", borderRadius: 6 }}>
          <h3
            className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block"
          >
            🌀 BANKING ON AI AGENTS · AI SUMMIT 2024
          </h3>
          <p className="text-gray-600 mb-3">
            Finance stage at Javits Center NYC - Dec 14, 2024
          </p>
          <div className="w-full">
            <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
              <iframe
                src="https://player.vimeo.com/video/1047612862?badge=0&autopause=0&player_id=0&app_id=58479"
                loading="lazy"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Banking on AI Agents - Keynote @ AI Summit 12-14-24"
                className="rounded-lg border border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* BADCO F/W Capsule Embed */}
        <div className="bg-white p-6 shadow-sm" style={{ border: "1px solid #b9c7d9", borderRadius: 6 }}>
          <h3
            className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-blue-400 pb-1 inline-block"
          >
            🎨 BADCO F/W CAPSULE - SCREENPRINTING AND HOSTING POP-UPS
          </h3>
          <p className="text-gray-600 mb-3">
            Bowery Showroom 2021-2023
          </p>
          <div className="w-full">
            <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
              <iframe
                src="https://player.vimeo.com/video/647500740?badge=0&autopause=0&player_id=0&app_id=58479"
                loading="lazy"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
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
