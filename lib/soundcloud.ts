import axios from "axios"

export interface Track {
  id: string
  title?: string
  url: string
  artist?: string
  embedHtml?: string
}

/**
 * Fetch the likes page and extract canonical track URLs using regex parsing.
 * This avoids cheerio/undici compatibility issues with Next.js 14.
 */
export async function fetchLikedTrackUrls(username: string): Promise<Track[]> {
  const url = `https://soundcloud.com/${username}/likes`
  const { data: html } = await axios.get<string>(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  })

  const trackLinks = new Set<string>()
  
  // Match href attributes in anchor tags
  const hrefRegex = /href=["']([^"']+)["']/g
  let match
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]
    // Only /artist/track style links
    if (
      href &&
      /^\/[^/]+\/[^/]+$/.test(href) &&
      !href.includes("/sets/") &&
      !href.endsWith("/likes") &&
      !href.endsWith("/reposts")
    ) {
      trackLinks.add(`https://soundcloud.com${href}`)
    }
  }

  let counter = 1
  return Array.from(trackLinks).map((url) => ({
    id: `track-${counter++}`,
    url,
  }))
}

/**
 * Validate and fetch an embeddable iframe via SoundCloud's oEmbed.
 * Returns { ok: true, html } on success, otherwise { ok: false }.
 */
export async function resolveOEmbed(url: string) {
  try {
    const { data } = await axios.get<{ html: string }>("https://soundcloud.com/oembed", {
      params: { url, format: "json", maxheight: 166 },
    })
    return { ok: true, html: data.html }
  } catch {
    return { ok: false }
  }
}
