/**
 * Raffi Radio — pure playback decision logic.
 *
 * Deliberately framework-free (no React, no DOM) so the shuffle/repeat rules
 * can be unit tested without a renderer. `AudioContext` owns the state; this
 * module only answers "what should happen next?".
 */

// Relative (not "@/") so the standalone test build resolves it without the
// bundler's path aliases.
import { getRandomTrackIndex } from "../data/audio-library"

export type RepeatMode = "off" | "one" | "all"

/** What the player should do when the current track reaches its end. */
export type TrackEndAction =
  /** Restart the current track from 0 (needs an explicit seek — see GlobalAudioPlayer). */
  | { type: "replay" }
  /** Nothing left to play; stay on the current track, paused. */
  | { type: "stop" }
  /** Play `playlist[index]`. */
  | { type: "advance"; index: number }

export interface TrackEndInput {
  /** Index of the current track within the playlist, or -1 when it isn't in there. */
  currentIndex: number
  playlistLength: number
  shuffle: boolean
  repeatMode: RepeatMode
  /** Injectable for tests; defaults to the shared random picker. */
  pickRandomIndex?: (length: number, current?: number) => number
}

export function resolveTrackEnd({
  currentIndex,
  playlistLength,
  shuffle,
  repeatMode,
  pickRandomIndex = getRandomTrackIndex,
}: TrackEndInput): TrackEndAction {
  // Repeat-one wins over everything and doesn't need a playlist at all.
  if (repeatMode === "one") return { type: "replay" }

  if (playlistLength <= 0) return { type: "stop" }

  // A one-track playlist can only repeat itself. Advancing would resolve back
  // to the same track and silently no-op, so ask for an explicit replay.
  if (playlistLength === 1) {
    return repeatMode === "all" ? { type: "replay" } : { type: "stop" }
  }

  // Shuffle is checked before the end-of-playlist rule, matching the original
  // behavior: shuffling keeps going until the user stops it.
  if (shuffle) {
    return { type: "advance", index: pickRandomIndex(playlistLength, currentIndex) }
  }

  if (repeatMode === "off" && currentIndex === playlistLength - 1) {
    return { type: "stop" }
  }

  // Wraps for repeat "all"; an unknown current track (-1) starts from the top.
  return { type: "advance", index: (currentIndex + 1) % playlistLength }
}
