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

/** Pick a random track index that differs from `current` (when possible). */
export function getRandomTrackIndex(length: number, current: number): number {
  if (length <= 1) return 0
  let next = current
  while (next === current) {
    next = Math.floor(Math.random() * length)
  }
  return next
}
