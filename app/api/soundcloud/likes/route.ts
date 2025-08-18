import { fetchLikedTrackUrls, resolveOEmbed, type Track } from "@/lib/soundcloud"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get("user") || "djsweeterman"

  try {
    // 1. Fetch track URLs from the likes page
    const tracks: Track[] = await fetchLikedTrackUrls(username)

    // 2. Resolve oEmbed for each one and filter to embeddable tracks
    const results: Track[] = []
    for (const track of tracks.slice(0, 20)) {
      // Limit to first 20 for performance
      const { ok, html } = await resolveOEmbed(track.url)
      if (ok) {
        results.push({ ...track, embedHtml: html })
      }
    }

    return Response.json(results)
  } catch (error) {
    console.error("Error fetching SoundCloud likes:", error)
    return Response.json({ error: "Failed to fetch likes" }, { status: 500 })
  }
}
