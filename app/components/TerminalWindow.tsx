"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Upload, X, TerminalIcon, Send } from "lucide-react"

interface TerminalWindowProps {
  onClose: () => void
}

export default function TerminalWindow({ onClose }: TerminalWindowProps) {
  const [input, setInput] = useState("")
  const [history, setHistory] = useState<string[]>([
    "Welcome to RAF OS Terminal v2.0",
    "Type your startup pitch or upload your deck...",
    "",
  ])
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, []) // Updated dependency

  const handleCommand = async () => {
    if (!input.trim() && !file) return

    setHistory((prev) => [...prev, `> ${input}`, ""])
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("pitch", input)
      if (file) {
        formData.append("file", file)
      }

      const response = await fetch("/api/startup-pitch", {
        method: "POST",
        body: formData,
      })

      let data
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json()
      } else {
        // If the response is not JSON, read it as text
        const text = await response.text()
        throw new Error(`Server responded with non-JSON data: ${text}`)
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to get feedback")
      }

      setHistory((prev) => [...prev, "AI Feedback:", data.feedback, ""])
    } catch (error) {
      console.error("Error getting feedback:", error)
      setHistory((prev) => [...prev, `Error: ${error.message || "Failed to process pitch. Please try again."}`, ""])
    } finally {
      setIsLoading(false)
      setInput("")
      setFile(null)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFile(file)
      setHistory((prev) => [...prev, `Uploaded: ${file.name}`, ""])
    }
  }

  return (
    <div className="window fixed inset-0 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 w-full md:w-[800px] h-[90vh] md:h-[600px] overflow-hidden z-50">
      <div className="window-title sticky top-0 z-10">
        <span className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" /> RAF OS Terminal
        </span>
        <button className="ml-auto" onClick={onClose}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="window-content h-full flex flex-col bg-black p-0">
        <div ref={terminalRef} className="flex-1 overflow-auto p-4 font-mono text-green-400">
          {history.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {line}
            </div>
          ))}
          {isLoading && <div className="animate-pulse">Processing...</div>}
        </div>
        <div className="border-t border-gray-800 p-2 flex gap-2">
          <button className="win-btn flex items-center gap-2 bg-black" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            {file ? "Change Deck" : "Upload Deck"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.ppt,.pptx"
            className="hidden"
          />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCommand()}
              placeholder="Type your pitch here..."
              className="flex-1 bg-black text-green-400 border border-gray-800 rounded px-2 font-mono focus:outline-none focus:border-green-400"
            />
            <button className="win-btn flex items-center gap-2 bg-black" onClick={handleCommand} disabled={isLoading}>
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

