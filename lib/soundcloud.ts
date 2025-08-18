import axios from "axios"
import * as cheerio from "cheerio"

export interface Track {
  id: string
  title?: string
  url: string
  artist?: string
  embedHtml?: string
}

/**
 * Fetch the likes page and extract canonical track URLs.
 * Uses cheerio to parse the JS-disabled HTML.
 */
export async function fetchLikedTrackUrls(username: string): Promise<Track[]> {
  const url = `https://soundcloud.com/${username}/likes`
  const { data: html } = await axios.get<string>(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  })

  const $ = cheerio.load(html)
  const trackLinks = new Set<string>()

  // Each liked track appears as a heading with an anchor; extract hrefs like `/artist/slug`
  $("a").each((_, el) => {
    const href = $(el).attr("href")
    if (
      href &&
      /^\/[^/]+\/[^/]+$/.test(href) && // only /artist/track style links
      !href.includes("/sets/") &&
      !href.endsWith("/likes") &&
      !href.endsWith("/reposts")
    ) {
      trackLinks.add(`https://soundcloud.com${href}`)
    }
  })

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
