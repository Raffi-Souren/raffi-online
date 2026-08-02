import { test } from "node:test"
import assert from "node:assert/strict"

import {
  FEATURED_OVERRIDES,
  FEATURED_RAFS_CRATE,
  HOMIE_DISCOVERY_IDS,
  RAFS_CRATE,
  getRandomTrackIndex,
} from "../data/audio-library"
import { resolveTrackEnd } from "./audio-engine"

// --- getRandomTrackIndex ----------------------------------------------------

test("getRandomTrackIndex returns 0 for degenerate lengths", () => {
  assert.equal(getRandomTrackIndex(0), 0)
  assert.equal(getRandomTrackIndex(1), 0)
  assert.equal(getRandomTrackIndex(1, 0), 0)
  assert.equal(getRandomTrackIndex(Number.NaN), 0)
  assert.equal(getRandomTrackIndex(-5), 0)
})

test("getRandomTrackIndex always stays in range", () => {
  for (let i = 0; i < 500; i++) {
    const index = getRandomTrackIndex(7)
    assert.ok(Number.isInteger(index), `${index} is not an integer`)
    assert.ok(index >= 0 && index < 7, `${index} out of range`)
  }
})

test("getRandomTrackIndex never repeats the current index", () => {
  for (const current of [0, 1, 2, 3]) {
    for (let i = 0; i < 200; i++) {
      assert.notEqual(getRandomTrackIndex(4, current), current)
    }
  }
})

test("getRandomTrackIndex tolerates an out-of-range current index", () => {
  const index = getRandomTrackIndex(3, 99)
  assert.ok(index >= 0 && index < 3)
})

// --- featured crate ---------------------------------------------------------

test("FEATURED_RAFS_CRATE resolves 50 unique canonical tracks", () => {
  assert.equal(FEATURED_RAFS_CRATE.length, 50)
  assert.equal(new Set(FEATURED_RAFS_CRATE.map((track) => track.id)).size, 50)
  assert.ok(FEATURED_RAFS_CRATE.every((track) => track.url.startsWith("https://soundcloud.com/")))
})

test("FEATURED_RAFS_CRATE applies curated display metadata", () => {
  const auditorium = FEATURED_RAFS_CRATE.find((track) => track.id === "mos-def-auditorium-2")
  const tems = FEATURED_RAFS_CRATE.find((track) => track.id === "tems-me-u-blk-remix")

  assert.deepEqual({ title: auditorium?.title, artist: auditorium?.artist }, { title: "Auditorium", artist: "Mos Def" })
  assert.deepEqual(
    { title: tems?.title, artist: tems?.artist },
    { title: "Me & U (BLK Remix)", artist: "Tems" },
  )
})

test("FEATURED_RAFS_CRATE prioritizes homie tracks after the hand-picked head", () => {
  const start = FEATURED_OVERRIDES.length
  assert.deepEqual(
    FEATURED_RAFS_CRATE.slice(start, start + HOMIE_DISCOVERY_IDS.length).map((track) => track.id),
    [...HOMIE_DISCOVERY_IDS],
  )
})

// Both curated lists reference ids in the canonical crate and resolve with a
// `track ? [track] : []` fallback, so an id that stops resolving is dropped
// silently and backfilled with a raw-handle track. These assertions turn that
// into a named failure.
//
// Note there is deliberately no `track.artist === override.artist` check: the
// featured track's artist is *built from* the override, so such an assertion
// can never fail. The override is the source of truth for display names — the
// testable invariants are that the id resolves and the URL stays canonical.
test("every curated override resolves against the canonical crate", () => {
  const canonicalById = new Map(RAFS_CRATE.map((track) => [track.id, track]))

  for (const override of FEATURED_OVERRIDES) {
    const canonical = canonicalById.get(override.id)
    assert.ok(canonical, `override "${override.id}" is not in the canonical crate`)

    const track = FEATURED_RAFS_CRATE.find((candidate) => candidate.id === override.id)
    assert.ok(track, `override "${override.id}" did not make it into the featured crate`)

    // URLs must stay single-sourced — overrides may restyle display text only.
    assert.equal(track.url, canonical.url, `"${override.id}" drifted from the canonical URL`)
  }

  // The hand-picked sequence must lead the crate, in declaration order.
  assert.deepEqual(
    FEATURED_RAFS_CRATE.slice(0, FEATURED_OVERRIDES.length).map((track) => track.id),
    FEATURED_OVERRIDES.map((override) => override.id),
  )
})

test("every homie discovery id resolves against the canonical crate", () => {
  const canonicalIds = new Set(RAFS_CRATE.map((track) => track.id))
  for (const id of HOMIE_DISCOVERY_IDS) {
    assert.ok(canonicalIds.has(id), `homie id "${id}" is not in the canonical crate`)
  }
})

test("the canonical crate has no duplicate ids or urls", () => {
  assert.equal(new Set(RAFS_CRATE.map((track) => track.id)).size, RAFS_CRATE.length)
  assert.equal(new Set(RAFS_CRATE.map((track) => track.url)).size, RAFS_CRATE.length)
})

// --- resolveTrackEnd --------------------------------------------------------

const base = { currentIndex: 0, playlistLength: 5, shuffle: false, repeatMode: "all" as const }

test("repeat all advances to the next track", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: 2 }), { type: "advance", index: 3 })
})

test("repeat all wraps around at the end of the playlist", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: 4 }), { type: "advance", index: 0 })
})

test("repeat off stops at the end of the playlist", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: 4, repeatMode: "off" }), { type: "stop" })
})

test("repeat off still advances mid-playlist", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: 1, repeatMode: "off" }), { type: "advance", index: 2 })
})

test("repeat one replays regardless of position or shuffle", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, repeatMode: "one" }), { type: "replay" })
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: 4, repeatMode: "one" }), { type: "replay" })
  assert.deepEqual(resolveTrackEnd({ ...base, repeatMode: "one", shuffle: true }), { type: "replay" })
})

test("repeat one works even without a playlist", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, playlistLength: 0, repeatMode: "one" }), { type: "replay" })
})

test("shuffle picks a track via the injected picker", () => {
  const action = resolveTrackEnd({
    ...base,
    currentIndex: 2,
    shuffle: true,
    pickRandomIndex: (length, current) => {
      assert.equal(length, 5)
      assert.equal(current, 2)
      return 4
    },
  })
  assert.deepEqual(action, { type: "advance", index: 4 })
})

test("shuffle keeps going past the end of the playlist", () => {
  const action = resolveTrackEnd({
    ...base,
    currentIndex: 4,
    shuffle: true,
    repeatMode: "off",
    pickRandomIndex: () => 1,
  })
  assert.deepEqual(action, { type: "advance", index: 1 })
})

test("a single-track playlist replays under repeat all instead of no-op advancing", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: 0, playlistLength: 1 }), { type: "replay" })
})

test("a single-track playlist stops under repeat off", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: 0, playlistLength: 1, repeatMode: "off" }), {
    type: "stop",
  })
})

test("an empty playlist stops", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: -1, playlistLength: 0 }), { type: "stop" })
})

test("an unknown current track starts from the top of the playlist", () => {
  assert.deepEqual(resolveTrackEnd({ ...base, currentIndex: -1 }), { type: "advance", index: 0 })
})

test("default behavior is unchanged: shuffle off + repeat all walks the playlist and wraps", () => {
  const visited: number[] = []
  let index = 0
  for (let i = 0; i < 6; i++) {
    const action = resolveTrackEnd({ currentIndex: index, playlistLength: 5, shuffle: false, repeatMode: "all" })
    assert.equal(action.type, "advance")
    index = (action as { type: "advance"; index: number }).index
    visited.push(index)
  }
  assert.deepEqual(visited, [1, 2, 3, 4, 0, 1])
})
