import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Calendar, Music, ArrowRight } from "lucide-react"

const features = [
  {
    title: "Latest Writing",
    description: "From Consumer Buzz to Enterprise Adoption v8",
    subtitle: "When Bigger Stops Being Better",
    icon: FileText,
    href: "/writing",
    badge: "v8",
    color: "text-blue-400",
  },
  {
    title: "Next Event",
    description: "Building Gen AI for Capital Markets",
    subtitle: "Aug 21, 2025 • NYC",
    icon: Calendar,
    href: "/events",
    badge: "RSVP",
    color: "text-green-400",
  },
  {
    title: "Latest Mix",
    description: "Deep House Sessions #47",
    subtitle: "2hr journey through underground sounds",
    icon: Music,
    href: "/music",
    badge: "NEW",
    color: "text-purple-400",
  },
]

export default function FeatureCards() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="group cursor-pointer hover:scale-105 transition-transform duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-1 rounded">{feature.badge}</span>
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold mb-2">{feature.description}</h3>
                <p className="text-muted text-sm mb-4">{feature.subtitle}</p>
                <Button variant="ghost" size="sm" asChild className="p-0 h-auto">
                  <Link href={feature.href} className="flex items-center text-accent">
                    View More <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
