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
