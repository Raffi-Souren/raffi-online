"use client"

import type React from "react"

import { useState } from "react"
import { Mail, CheckCircle, AlertCircle } from "lucide-react"

interface UnderConstructionWindowProps {
  title: string
  onClose: () => void
}

export default function UnderConstructionWindow({ title, onClose }: UnderConstructionWindowProps) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    setSubmitStatus("idle")

    try {
      // Create mailto link to send notification
      const subject = encodeURIComponent(`New notification request for ${title}`)
      const body = encodeURIComponent(
        `Someone wants to be notified about ${title}.\n\nEmail: ${email}\n\nSent from: ${window.location.href}`,
      )
      const mailtoLink = `mailto:raffi@notgoodcompany.com?subject=${subject}&body=${body}`

      // Open mailto link
      window.location.href = mailtoLink

      // Simulate success after a short delay
      setTimeout(() => {
        setSubmitStatus("success")
        setIsSubmitting(false)
        setEmail("")
      }, 1000)
    } catch (error) {
      setSubmitStatus("error")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Window */}
      <div className="relative bg-gray-200 border-2 border-gray-400 shadow-lg max-w-md w-full">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-2 py-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded-sm flex items-center justify-center">
              <span className="text-xs text-black font-bold">!</span>
            </div>
            <span className="text-sm font-bold">{title} - Under Construction</span>
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-gray-100">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-8 h-8 bg-yellow-400 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-black font-bold text-lg">⚠</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Coming Soon!</h3>
              <p className="text-gray-600 text-sm mb-4">
                {title} is currently under construction. Get notified when it's ready!
              </p>
            </div>
          </div>

          {submitStatus === "success" ? (
            <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-300 rounded">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 text-sm">Thanks! We'll notify you when it's ready.</span>
            </div>
          ) : submitStatus === "error" ? (
            <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-300 rounded mb-4">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800 text-sm">Something went wrong. Please try again.</span>
            </div>
          ) : null}

          {submitStatus !== "success" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Notifying..." : "Get Notified"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
