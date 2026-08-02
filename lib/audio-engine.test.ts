import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import ts from "typescript"

import {
  FEATURED_OVERRIDES,
  FEATURED_RAFS_CRATE,
  FEATURED_TRACK_IDS,
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
  const start = FEATURED_TRACK_IDS.length
  assert.deepEqual(
    FEATURED_RAFS_CRATE.slice(start, start + HOMIE_DISCOVERY_IDS.length).map((track) => track.id),
    [...HOMIE_DISCOVERY_IDS],
  )
})

// The hand-picked and homie lists reference ids in the canonical crate and
// resolve with a `track ? [track] : []` fallback, so an id that stops resolving
// is dropped silently and backfilled. These assertions turn that into a named
// failure.
//
// Note there is deliberately no `track.artist === override.artist` check: the
// featured track's artist is *built from* the override, so such an assertion
// can never fail. The testable invariants are that ids resolve, URLs stay
// canonical, and every sparse override actually changes canonical metadata.
test("every hand-picked featured id resolves against the canonical crate", () => {
  const canonicalById = new Map(RAFS_CRATE.map((track) => [track.id, track]))

  for (const id of FEATURED_TRACK_IDS) {
    const canonical = canonicalById.get(id)
    assert.ok(canonical, `featured id "${id}" is not in the canonical crate`)

    const track = FEATURED_RAFS_CRATE.find((candidate) => candidate.id === id)
    assert.ok(track, `featured id "${id}" did not make it into the featured crate`)
    assert.equal(track.url, canonical.url, `"${id}" drifted from the canonical URL`)
  }

  assert.deepEqual(
    FEATURED_RAFS_CRATE.slice(0, FEATURED_TRACK_IDS.length).map((track) => track.id),
    [...FEATURED_TRACK_IDS],
  )
})

test("every curated override resolves against the canonical crate", () => {
  const canonicalById = new Map(RAFS_CRATE.map((track) => [track.id, track]))

  for (const override of FEATURED_OVERRIDES) {
    const canonical = canonicalById.get(override.id)
    assert.ok(canonical, `override "${override.id}" is not in the canonical crate`)

    const track = FEATURED_RAFS_CRATE.find((candidate) => candidate.id === override.id)
    assert.ok(track, `override "${override.id}" did not make it into the featured crate`)

    // URLs must stay single-sourced — overrides may restyle display text only.
    assert.equal(track.url, canonical.url, `"${override.id}" drifted from the canonical URL`)

    const changesCanonicalMetadata =
      (override.title !== undefined && override.title !== canonical.title) ||
      (override.artist !== undefined && override.artist !== canonical.artist)
    assert.ok(changesCanonicalMetadata, `override "${override.id}" does not change canonical display metadata`)
  }
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

const RETIRED_UNAVAILABLE_TRACK_IDS = [
  "compton-state-of-mind",
  "dear-april-justice-remix",
  "donaty-tirate-sango-por-vida-remix",
  "fidde-i-wonder-yuno-hu-vision",
  "fidde-i-wonder-yuno-hu-vision-mancha",
  "four-tet-caribou-jamie-xx-dj-set",
  "four-tet-insect-near-piha-beach-oshee",
  "frank-ocean-white-ferrari-2023-coachella-version-remake-2",
  "gosh",
  "habibi-funk-plus",
  "kanye-west-when-i-see-it-tell-your-friends-remix",
  "latch-feat-sam-smith",
  "mitsubishi-sony",
  "novacane-frank-ocean-jun-tanaka-edit",
  "rich-baby-daddy-pherris-edit-a-side",
  "sideways",
  "slide-on-me",
  "u-n-i-t-y",
  "yeye-prodpharoah",
  "yukon-x-up-dj-hunny-bee-mashup",
] as const

const VERIFIED_REPLACEMENT_URLS = [
  [
    "frank-ocean-new-music-from-blonded-xmas-episode",
    "https://soundcloud.com/jashua-garcia-938775795/i-can-escape-iceman-blonded-radio-xmas",
  ],
  [
    "gordo-x-drake-healing-my-pal-al-remix-1",
    "https://soundcloud.com/alanaguero/gordo-x-drake-healing-my-pal-al-remix-1",
  ],
  [
    "idris-muhammad-could-heaven-ever-be-like-this-house-remix",
    "https://soundcloud.com/raczeyjulas/idris-muhammad-could-heaven-ever-be-like-this-house-remix",
  ],
  ["lil-yachty-cortex", "https://soundcloud.com/user-642226191/cortex"],
  ["say-my-name-feat-zyra", "https://soundcloud.com/odesza/say_my_name"],
  ["she-notice", "https://soundcloud.com/youngthugworld/she-notice"],
] as const

test("the canonical crate contains 212 tracks after unavailable entries are retired", () => {
  assert.equal(RAFS_CRATE.length, 212)
})

test("retired unavailable track ids cannot return through canonical or curated lists", () => {
  const canonicalIds = new Set(RAFS_CRATE.map((track) => track.id))
  const curatedIds = new Set([
    ...FEATURED_TRACK_IDS,
    ...FEATURED_OVERRIDES.map((override) => override.id),
    ...HOMIE_DISCOVERY_IDS,
  ])

  for (const id of RETIRED_UNAVAILABLE_TRACK_IDS) {
    assert.ok(!canonicalIds.has(id), `retired unavailable track "${id}" returned to the canonical crate`)
    assert.ok(!curatedIds.has(id), `retired unavailable track "${id}" returned to a curated list`)
  }
})

test("repaired tracks keep their verified SoundCloud replacement urls", () => {
  const canonicalById = new Map(RAFS_CRATE.map((track) => [track.id, track]))

  for (const [id, expectedUrl] of VERIFIED_REPLACEMENT_URLS) {
    const track = canonicalById.get(id)
    assert.ok(track, `repaired track "${id}" is missing from the canonical crate`)
    assert.equal(track.url, expectedUrl, `repaired track "${id}" lost its verified replacement URL`)
  }
})

test("canonical artists are display names rather than raw SoundCloud handles", () => {
  for (const track of RAFS_CRATE) {
    const handle = new URL(track.url).pathname.split("/")[1]
    assert.notEqual(track.artist, handle, `"${track.id}" still uses raw SoundCloud handle "${handle}"`)
  }
})

test("canonical track ids and urls remain unchanged", () => {
  const identity = JSON.stringify(RAFS_CRATE.map(({ id, url }) => [id, url]))
  const digest = createHash("sha256").update(identity).digest("hex")
  assert.equal(digest, "bf9f95dc144abda25b4dd6e17791c30597be9f8b3496d3b6065f5949a9c57c2c")
})

test("crate tracks keep the audio-library dependency type-only at runtime", () => {
  const source = readFileSync(resolve(process.cwd(), "data/crates-tracks.ts"), "utf8")
  assert.match(
    source,
    /^import type\s*\{\s*Track\s*\}\s*from\s*["']\.\/audio-library["']/m,
    "crates-tracks.ts must import Track with `import type`",
  )

  // The ordinary test compiler elides an unused value import too, so checking
  // only .test-build would make `import { Track }` look safe. Verbatim-module
  // transpilation preserves that accidental value edge and makes it observable.
  const verbatimOutput = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText
  assert.doesNotMatch(
    verbatimOutput,
    /require\(["']\.\/audio-library["']\)/,
    "verbatim crates-tracks output must not load audio-library at runtime",
  )

  const compiled = readFileSync(resolve(process.cwd(), ".test-build/data/crates-tracks.js"), "utf8")
  assert.doesNotMatch(
    compiled,
    /require\(["']\.\/audio-library["']\)/,
    "compiled crates-tracks.js must not load audio-library at runtime",
  )
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
