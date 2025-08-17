'use client'

import { useState } from 'react'

export default function StartupPitch() {
  const [pitch, setPitch] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback('')
    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/startup-pitch', {
        method: 'POST',
        body: JSON.stringify({ pitch }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to get feedback')
      const data = await response.json()
      setFeedback(data.feedback)
      // Log user pitch for improvement (ensure GDPR compliance)
      logUserPitch(pitch, data.feedback)
    } catch (error) {
      console.error('Error getting feedback:', error)
      setError('Our AI is taking a break. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  const logUserPitch = async (pitch, feedback) => {
    try {
      await fetch('/api/log-pitch', {
        method: 'POST',
        body: JSON.stringify({ pitch, feedback }),
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Error logging pitch:', error)
    }
  }

  return (
    <div className="bg-gray-100 p-6 rounded-lg">
      <h2 className="text-2xl font-serif mb-4">Pitch Me a Startup</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          rows={4}
          placeholder="Enter your startup pitch here..."
        ></textarea>
        <button 
          type="submit" 
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? 'Getting Feedback...' : 'Get Feedback'}
        </button>
      </form>
      {error && (
        <div className="mt-4 text-red-500">{error}</div>
      )}
      {feedback && (
        <div className="mt-4">
          <h3 className="text-xl font-serif mb-2">AI Feedback:</h3>
          <p>{feedback}</p>
        </div>
      )}
    </div>
  )
}

