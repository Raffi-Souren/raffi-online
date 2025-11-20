import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Clock, Tag } from "lucide-react"
import { formatDate } from "@/lib/utils"
import articlesData from "@/data/articles.json"

export const metadata: Metadata = {
  title: "Writing - Raffi Web",
  description: "Articles and insights on AI implementation in enterprise environments",
  openGraph: {
    title: "Writing - Raffi Web",
    description: "Articles and insights on AI implementation in enterprise environments",
  },
}

export default function WritingPage() {
  const { articles } = articlesData

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl font-bold mb-4">From Consumer Buzz to Enterprise Adoption</h1>
          <p className="text-muted text-lg">
            An 8-part series exploring the reality of AI implementation in enterprise environments
          </p>
        </div>

        <div className="grid gap-6">
          {articles.map((article) => (
            <Card key={article.slug} className="group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm bg-accent/20 text-accent px-2 py-1 rounded">
                        {article.version}
                      </span>
                      <span className="text-muted text-sm flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {article.readTime}
                      </span>
                    </div>
                    <CardTitle className="text-xl mb-2 group-hover:text-accent transition-colors">
                      {article.title}
                    </CardTitle>
                    <p className="text-muted text-sm mb-3">{formatDate(article.publishDate)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted mb-4">{article.summary}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs bg-secondary text-muted px-2 py-1 rounded"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
                <Button variant="outline" asChild>
                  <Link
                    href={article.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    Read on LinkedIn
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
