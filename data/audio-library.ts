/**
 * Raffi Radio — consolidated audio library.
 *
 * This is the single entry point for all audio track data and the canonical
 * `Track` type. Other modules (AudioContext, GlobalAudioPlayer, IPodPlayer,
 * DiggingInTheCrates) should import from here.
 *
 * The large track array itself lives in `./crates-tracks` for readability;
 * this module re-exports it under friendlier names. To add a track, edit
 * `data/crates-tracks.ts` (the documented workflow in agents.md still works).
 */

// Canonical Track shape — the one source of truth for the whole audio system.
export interface Track {
  id: string
  title: string
  artist: string
  url: string
}

import { SOUNDCLOUD_TRACKS as CRATE_TRACKS } from "./crates-tracks"

// Raffi's main crate (everything in the SoundCloud library).
export const RAFS_CRATE: Track[] = CRATE_TRACKS

// Back-compat alias: existing imports of SOUNDCLOUD_TRACKS keep working.
export const SOUNDCLOUD_TRACKS: Track[] = CRATE_TRACKS

/** The stable, hand-picked opening sequence for the curated iPod crate. */
export const FEATURED_TRACK_IDS = [
  "yukon-x-up-dj-hunny-bee-remix",
  "four-tet-insect-near-piha-beach",
  "habibi-funk-beirut",
  "chopsuey",
  "gordos-dilemma",
  "08-compton-state-of-mind",
  "sango2",
  "dipset-x-future-i-really-mean",
  "mos-def-auditorium-2",
  "blemforreal",
  "tems-me-u-blk-remix",
  "first-day-of-my-life-bright",
] as const

/**
 * Intentional editorial exceptions for the featured crate. Artist names now
 * live in the canonical library; this sparse list only changes credits/titles
 * where the curated presentation intentionally differs from SoundCloud's
 * uploader metadata.
 */
export const FEATURED_OVERRIDES: ReadonlyArray<{
  id: string
  artist?: string
  title?: string
}> = [
  { id: "four-tet-insect-near-piha-beach", artist: "Four Tet" },
  { id: "mos-def-auditorium-2", title: "Auditorium", artist: "Mos Def" },
  { id: "tems-me-u-blk-remix", title: "Me & U (BLK Remix)", artist: "Tems" },
]

/**
 * The curated short crate shown in the iPod. URLs and base metadata stay
 * single-sourced in the canonical library; only display metadata is overridden.
 */
const CURATED_CRATE_SIZE = 50

const featuredOverrideById = new Map(FEATURED_OVERRIDES.map((override) => [override.id, override]))

const handPickedTracks = FEATURED_TRACK_IDS.flatMap((id) => {
  const track = CRATE_TRACKS.find((candidate) => candidate.id === id)
  const override = featuredOverrideById.get(id)
  return track
    ? [
        {
          ...track,
          title: override?.title ?? track.title,
          artist: override?.artist ?? track.artist,
        },
      ]
    : []
})

export const HOMIE_DISCOVERY_IDS = [
  "texas-speed-white-ferrari0",
  "kdot-x-radiohead",
  "beyonce-x-stardust-break-my-soul-sango-mix",
  "brent-faiyaz-all-mine-dwells-rmx",
  "semi-on-em-1979",
  "caffeine-vitamins",
] as const

const homieDiscoveryTracks = HOMIE_DISCOVERY_IDS.flatMap((id) => {
  const track = CRATE_TRACKS.find((candidate) => candidate.id === id)
  return track ? [track] : []
})

const prioritizedIds = new Set([...handPickedTracks, ...homieDiscoveryTracks].map((track) => track.id))

/**
 * The 50-track crate shown in the iPod. It opens with the original hand-picked
 * sequence, continues with direct tracks from Raffi's homies, then fills out
 * the session from Raffi / DJ Sweeterman's broader liked-track library.
 */
export const FEATURED_RAFS_CRATE: Track[] = [
  ...handPickedTracks,
  ...homieDiscoveryTracks,
  ...CRATE_TRACKS.filter((track) => !prioritizedIds.has(track.id)).slice(
    0,
    Math.max(0, CURATED_CRATE_SIZE - handPickedTracks.length - homieDiscoveryTracks.length),
  ),
]

/**
 * Pick a random track index that differs from `current` (when possible).
 *
 * Returns 0 for degenerate lengths so callers that already guard on an empty
 * playlist keep working; callers that don't should check `length` first.
 */
export function getRandomTrackIndex(length: number, current = -1): number {
  if (!Number.isFinite(length) || length <= 1) return 0

  const size = Math.floor(length)
  let next = Math.floor(Math.random() * size)

  // Bounded retry: with size >= 2 this virtually always exits on the first
  // pass, but the cap guarantees we can never spin forever on a bad `current`.
  for (let attempt = 0; next === current && attempt < 10; attempt++) {
    next = Math.floor(Math.random() * size)
  }

  // Last resort if the RNG kept landing on `current`: step to a neighbour.
  if (next === current) next = (current + 1) % size

  return next
}

export const BADCOMPANY_MIXES: Track[] = [
  {
    id: "bc-1",
    title: "BadCompany Radio",
    artist: "NotGoodCompany",
    url: "https://api.soundcloud.com/playlists/1789261161",
  },
  {
    id: "bc-2",
    title: "Writing On The Wall Set 8.13.22",
    artist: "MF KOBE",
    url: "https://api.soundcloud.com/tracks/1324245148",
  },
  {
    id: "bc-3",
    title: "Andromeda by sweeterman",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/tracks/1179462235",
  },
  {
    id: "bc-4",
    title: "Feed The Streets vol. I",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/playlists/704616300",
  },
  {
    id: "bc-5",
    title: "ISLA BÉRT [DRIP OR DROWN V4 SET]",
    artist: "BAKED GOOD",
    url: "https://api.soundcloud.com/tracks/1124902333",
  },
  {
    id: "bc-6",
    title: "🖤🖤🖤TRISTAN THOMPSON 🖤🖤🖤BY BRiE",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/tracks/585063546",
  },
  {
    id: "bc-7",
    title: "JAM with brie",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/tracks/921126772",
  },
  {
    id: "bc-8",
    title: "VDAY💔",
    artist: "raf",
    url: "https://api.soundcloud.com/playlists/992564092",
  },
  {
    id: "bc-9",
    title: '"SKYFALL" - NYE 2020 Set',
    artist: "BAKED GOOD",
    url: "https://api.soundcloud.com/tracks/757237381",
  },
  {
    id: "bc-10",
    title: "🕵️🕵️🕵️WHATS THE MOVE ??? 🕵️🕵️🕵️ with BRiE",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/tracks/688176064",
  },
  {
    id: "bc-11",
    title: "BAKED GOOD Set @ HAUNTED HOTEL (10.26.18)",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/tracks/524785323",
  },
  {
    id: "bc-12",
    title: "ESCONDIDO X BADCO with sweeterman",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/tracks/677024604",
  },
  {
    id: "bc-13",
    title: "BAD BUSINESS (BAKED GOOD Set 07.28.18)",
    artist: "BADCOMPANY",
    url: "https://api.soundcloud.com/tracks/513780693",
  },
  {
    id: "bc-14",
    title: "Palm Trees in NYC (BSAP x sweeterman)",
    artist: "raf",
    url: "https://api.soundcloud.com/tracks/459410418",
  },
]

export const FEATURED_BADCOMPANY_MIX = {
  track: BADCOMPANY_MIXES.find((track) => track.id === "bc-3")!,
  artwork: "https://i1.sndcdn.com/artworks-dbe3SpVgJXOyQmRQ-k8ppoQ-t500x500.jpg",
  note: "Andromeda by sweeterman, from the BADCOMPANY SoundCloud archive.",
} as const
