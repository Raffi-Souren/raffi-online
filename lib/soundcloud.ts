export interface Track {
  id: string
  title?: string
  url: string
  artist?: string
  embedHtml?: string
}

/**
 * Fetch the likes page and extract canonical track URLs.
 * Uses simple regex matching instead of cheerio to avoid webpack issues.
 */
export async function fetchLikedTrackUrls(username: string): Promise<Track[]> {
  const url = `https://soundcloud.com/${username}/likes`
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  })
  const html = await response.text()

  const trackLinks = new Set<string>()
  
  // Extract href attributes from anchor tags that match track URL patterns
  const hrefRegex = /href="(\/[^/]+\/[^/"]+)"/g
  let match
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]
    if (
      href &&
      /^\/[^/]+\/[^/]+$/.test(href) && // only /artist/track style links
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
    const response = await fetch(
      `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json&maxheight=166`
    )
    const data = await response.json()
    return { ok: true, html: data.html }
  } catch {
    return { ok: false }
  }
}
