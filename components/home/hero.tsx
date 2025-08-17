"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

const titles = ["AI Architect", "DJ & Producer", "Creative Technologist", "Enterprise Consultant"]

export default function Hero() {
  const [currentTitle, setCurrentTitle] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTitle((prev) => (prev + 1) % titles.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-transparent to-accent/20" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px),
            linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px)
          `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
          <span className="text-foreground">Raffi Souren</span>
          <br />
          <span className="text-accent typewriter inline-block min-h-[1.2em]">{titles[currentTitle]}</span>
        </h1>

        <p className="text-muted text-lg md:text-xl mb-8 max-w-2xl mx-auto">
          Building enterprise AI solutions at IBM while crafting sonic experiences that move bodies and minds across
          NYC's underground scene.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/writing">
              Latest Writing <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/music">Listen Now</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
