"use client"

import DesktopWindow from "../../components/DesktopWindow"

interface UnderConstructionWindowProps {
  title: string
  onClose: () => void
}

export default function UnderConstructionWindow({ title, onClose }: UnderConstructionWindowProps) {
  const handleGetNotified = () => {
    const email = "raffi@notgoodcompany.com"
    const subject = `Get Notified - ${title} Feature Updates`
    const body = `Hi Raffi,

Please notify me when the ${title} feature is ready!

Thanks,`

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    try {
      window.location.href = mailtoUrl
    } catch (error) {
      // Fallback
      navigator.clipboard.writeText(email).catch(() => {})
      alert(`Email copied: ${email}`)
    }
  }

  const getFeatureDetails = (featureTitle: string) => {
    switch (featureTitle.toLowerCase()) {
      case "dj sets":
        return {
          description: "DJ Sets is currently being built.",
          features: [
            "• SoundCloud & Mixcloud integration",
            "• Live set recordings & tracklists",
            "• Curated playlists & mixes",
            "• Sticky audio player across site",
          ],
        }
      case "projects":
        return {
          description: "Projects is currently being built.",
          features: [
            "• IBM/watsonx enterprise deployments",
            "• Startup work (indify, Bad Company)",
            "• Open source contributions",
            "• Creative tech installations",
          ],
        }
      case "pitch startup":
        return {
          description: "Pitch Startup is currently being built.",
          features: [
            "• AI-powered startup pitch feedback",
            "• Pitch deck analysis",
            "• Market research insights",
            "• Investment readiness scoring",
          ],
        }
      default:
        return {
          description: `${featureTitle} is currently being built.`,
          features: [
            "• Feature planning in progress",
            "• UI/UX design phase",
            "• Development roadmap defined",
            "• Beta testing planned",
          ],
        }
    }
  }

  const { description, features } = getFeatureDetails(title)

  return (
    <DesktopWindow
      title={`⚠️ ${title.toUpperCase()} - UNDER CONSTRUCTION`}
      isOpen={true}
      onClose={onClose}
      isYellow={true}
    >
      <div className="min-h-[400px] flex flex-col">
        {/* Construction Icon */}
        <div className="text-center py-6">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-2xl font-bold text-yellow-400 uppercase tracking-wider mb-2">UNDER CONSTRUCTION</h2>
          <p className="text-yellow-300 text-sm">{description}</p>
          <p className="text-yellow-300 text-sm mt-1">Check back soon for updates!</p>
        </div>

        {/* What's Coming Section */}
        <div className="flex-1 px-6">
          <div className="border border-yellow-400 bg-black p-4 mb-6">
            <h3 className="text-yellow-400 font-bold mb-3 flex items-center gap-2">⚡ What's Coming:</h3>
            <div className="space-y-1">
              {features.map((feature, index) => (
                <p key={index} className="text-yellow-300 text-sm">
                  {feature}
                </p>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded border border-gray-500 min-h-[44px] transition-colors"
            >
              🏠 BACK TO DESKTOP
            </button>
            <button
              onClick={handleGetNotified}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded border border-yellow-400 min-h-[44px] transition-colors"
            >
              📧 GET NOTIFIED
            </button>
          </div>

          {/* Footer Info */}
          <div className="text-center text-xs text-yellow-500 space-y-1">
            <p>🚀 Expected Launch: Q2 2025</p>
            <p>Built with ❤️ using Next.js & AI</p>
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}
