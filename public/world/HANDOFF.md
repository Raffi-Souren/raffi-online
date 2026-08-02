# RAFFI WORLD — Handoff

## [2026-08-02 18:15] FROM: grok — REPLY ALL REPAINT COMPLIANCE CLEAR

**Shipped:** the first honest COMPLIANCE clear loop. `game/compliance-core.js`
holds pure mounted-only / speed / latch / nearest-shop rules; `game/compliance.js`
wires HUD pips, authored `repaint-1`/`repaint-2` dialogue, toast, and
`gen/vehicles.js` `repaint()` on the mounted mesh. Shop locations, bay radius,
and max clear speed compile from `data/world.json` (`repaint` + `repaintShops`)
— no hardcoded shop IDs, coordinates, districts, or radii in engine code.

**Behavior:** a mounted vehicle crawling at or under `repaint.maxClearSpeed`
inside an authored bay zeros tier + heat, repaints hull/cabin vertex colours,
fires dialogue/toast, and latches until the actor leaves the bay. On-foot and
high-speed drive-throughs do nothing. Active mission waypoints are never
overwritten; with heat and no active mission the minimap routes to the nearest
data shop as `REPLY ALL REPAINT`. Debug exposes `setComplianceTier` /
`complianceSnapshot` under `?debug=1`.

**Guards:** seven pure compliance-core tests (mounted-only, speed boundary,
clear/reset, latch, leave/re-enter, data-driven nearest shop). Browser smoke
extends DEAL CLOCK → heat → on-foot negative → high-speed negative → park clear
→ colour-buffer change → latch → re-enter → mission waypoint preservation, plus
desktop/mobile dusk+night shop screenshots. Mutation: removing mounted-only
fails its named unit test; skipping tier reset fails clear-reset; skipping
`repaint()` leaves the colour buffer unchanged. All restored before green.

**Budgets (shop view, seed=FIXED):** ≤14 draw calls, ~30k tris (under 120 / 60k).

**Deferred:** pursuers/catches, Replay All Repaint audio playback of
`compliance-clear` SFX metadata, interiors, remaining missions. Shop sign
readability under fixed iso remains a content jank item (see JANK.md).

## [2026-08-02 17:57] FROM: codex — PAUSE TRAP FIXED AND AUDITED

**Root cause:** the pause panel rendered five enabled buttons but the engine
only consumed Tab/Escape; no `data-pause` click handler existed. A real browser
confirmed every click reached its button and silently changed nothing. The
mobile-first build also had no touch control capable of opening pause.

**Changed:** one `setPaused` transition now owns keyboard, touch, and RESUME.
Tab opens the modal and then returns to native focus traversal; Escape closes.
The spec-backed colour control cycles AUTO → DUSK → HAZE → NIGHT → AUTO. Touch
gets a safe-area-aware PAUSE button. REWIND, MAP, and QUIT are disabled and
labeled COMING SOON because their replay math, full map, and XP shell contract
are not implemented; no placeholder mechanics were fabricated.

**Guard and visual audit:** the browser smoke asserts live paused state,
RESUME, focus traversal, all four grade states, honest disabled actions, and
390×844 PAUSE → RESUME. The original code failed by name at RESUME; a deliberate
grade no-op failed by name at DUSK. After restoration the full desktop/mobile
journey passes. `/tmp/raffi-world-pause-{desktop,mobile}.png` were reviewed and
the panel/control remain in bounds without covering COMPLIANCE or the minimap.

**Deferred:** real REWIND still requires two actual runs and live DAR/TAR; MAP
requires an authored full-map mode; QUIT requires the Phase 5 parent-shell
message contract. They must remain unavailable until those systems are real.

## [2026-08-02 17:21] FROM: codex — RIDE EXIT/REMOUNT BLOCKER FIXED

**Root cause:** mount and exit each started a 400ms cooldown, but the main loop
consumed the edge-triggered input before checking that lock. The visible EXIT
control therefore discarded its first press, and the visible remount prompt
discarded the next one. Desktop cars also hid their supported E-to-exit action
while reserving Space for the handbrake.

**Changed:** ride transitions are immediately responsive; mounted desktop HUD
now shows `SPACE / E · EXIT` for skateboard/scooter and `E · EXIT` for cars.
Dismount clears inherited vehicle motion and tests both sides of the ride
against static collision so the player lands safely within remount range.

**Guard:** `tools/onboarding-smoke.mjs` now covers immediate and moving
skateboard exit → same-board remount, immediate and moving grand-tourer exit →
same-car remount, the desktop mounted key hints, and the touch EXIT → same-board
remount cycle. The test failed by name on the original cooldown and again when
a dropped board was deliberately mutation-marked occupied, then passed after
restoration. `npm test`, `npm run lint`, and the expanded browser smoke pass.

**Deferred:** real-device iOS must still exercise two long-press EXIT cycles;
Playwright touch taps cannot prove Safari's hide-on-touchend behavior. Nearby
mission/transit action arbitration remains visible nearest-target behavior and
is recorded in `PREDICTED-JANK.md` for the next gameplay audit.

## [2026-08-02 16:05] FROM: codex — MOBILITY + DEAL CLOCK VERTICAL SLICE COMPLETE

**Shipped:** fresh players now spawn beside THE CRIB GARAGE and its generated
skateboard, scooter, original unbadged grand tourer, and VANTAGE EXPRESS subway.
Space/E and touch context controls mount rides; mobile throttle and EXIT are
separate inputs, and nonblocking calls cannot steal throttle. The round minimap draws the generated road graph, a recalculating
route, heading, destination, and route distance. Subway service fades directly
to the active mission door.

**Playable content:** DEAL CLOCK is the first complete mission. Its manager
briefing gates the timer, a loaner car is guaranteed at the destination, four
unique order-independent lobby stops raise COMPLIANCE once each, timeout permits
retry, and success unlocks the next authored mission without pretending the
unsupported mission mechanics already exist. Captioned mentor/manager/transit
dialogue uses a two-press typewriter box on desktop and one clear NEXT control
on mobile.

**Audit:** `audit/phase3-final/` contains 60/60 reviewed views with 0 errors,
maximum 16/120 calls and 47,737/60,000 triangles. `tools/onboarding-smoke.mjs`
passes the crib → board → subway → DEAL CLOCK flow plus mobile GAS/EXIT and HUD
bounds. The brighter baked fill, blue-slate garage, HUD backplates, and persistent
cyan player locator address the reported muddy colour and lost-player problems.

**Guards:** seven mission-core and seven lot-placement tests pass. Deliberately
removing the vehicle-only rule, unique-stop rule, and briefing gate made each
named mission test fail before restoration. The browser smoke also pins the
active GPS stop across mission-loaner entry; this caught a real waypoint reset.

**Plan change:** keep RAFFI WORLD fixed-isometric. A future RAFFI WORLD 2 can
explore a third-person freely walkable camera, but no current camera law changed.
No outside game repo or proprietary GTA asset was copied; the useful inspiration
was applied as interaction grammar only.

**Deferred:** the seven remaining authored missions still require their real
mechanics. Resume the original Phase 3 content plan with interiors, expressway,
and district identity, then NPC/compliance/replay. Real-device iOS and short
landscape-phone testing remain release gates. Local normal-play URL in this
workspace is `http://localhost:3001/world/index.html` while that dev server runs.

## [2026-08-02 14:58] FROM: codex — PHASE 1/2 BROWSER VERIFICATION COMPLETE

**Shipped:** the game now boots and renders in Chromium; the atlas is a 9×9
1152px procedural sheet; player visibility and debug teleport sync are fixed;
cars and peds are one merged mesh per actor; lot footprints clear roads,
sidewalks, water, keepouts, district bounds, and each other; all four facade
directions are legal; the post chain uses a correct linear/sRGB pipeline with
data-driven dusk/haze/night grades.

**Audit:** `tools/audit.mjs` captured and reviewed 60 deterministic frames at
`audit/phase2-final/`. Result: 60/60, zero browser/network errors, zero budget
violations, maximum 14/120 draw calls and 47,557/60,000 visible triangles. A
stricter foot/vehicle × four-yaw seam sweep peaked at 17 calls and 56,101
triangles. The Yards vehicle smoke test passed enter → drive → exit.

**Guards:** `tools/lot-placement.test.mjs` has seven passing tests. Deliberately
breaking facade orientation and road clearance made each named test fail before
the production logic was restored, so neither assertion is vacuous.

**Audit findings / plan change:** no Phase 2 geometry or HUD blocker remains.
Phase 3 should begin with district identity while building the already-planned
interiors and expressway: stronger Downtown plaza/lobby cues, Strip parking-lot
language, Yards crane/container silhouettes, and Bowl tailgate/ramp identity.
Keep the faceted stadium ring as charm. Details live in `JANK.md`.

**Deferred:** interiors, expressway, NPC/compliance/missions/replay, radio/audio,
XP shell integration, and real-device Mobile Safari validation remain in their
original phase order. Local review URL:
`http://localhost:3000/world/index.html?debug=1`.

**Status as of this document: Phase 0 complete, Phase 1 ~90% written, Phase 2 partially written. Nothing has been run in a browser yet.**

That last sentence is the single most important fact on this page. All 19 ES
modules parse (`node --input-type=module --check`), and all 8 JSON files parse,
but no frame has ever been rendered. Treat the first task as "make it boot",
not "add features".

---

## 1. What this is

A playable, browser-native, mobile-first open-world game: fixed 3/4 isometric,
PS2-era art direction, five districts of a fictional coastal city called **Port
Vantage**. Crime-city satire where the crime is corporate process — the wanted
level is `COMPLIANCE`, escalating from "Slack message" to "Legal review", and
you clear it by parking at a **Reply All Repaint**.

Full design contract: **`WORLD-BIBLE.md`**, in this directory. Read it first.
It is the authority on tone, camera law, art direction, and the mechanics.

## 2. Where it lives and how it runs

It is a **standalone static app** at `public/world/` inside the Next.js repo
`raffi-online`. No bundler, no build step, no framework — vanilla ES modules
plus three.js. It is served by Next as static files.

```bash
npm run dev
# then open:
open http://localhost:3000/world/index.html?debug=1
```

Three.js is **vendored locally** at `vendor/three.module.js` + `three.core.js`
(v0.183.2, copied from `node_modules/three/build/`). This is a deliberate
deviation from the spec's "Three.js from a CDN": `next.config.mjs` sets a CSP
with `script-src 'self'`, so a CDN script is blocked. Keep it vendored.

The import map in `index.html` maps `three` → `./vendor/three.module.js`.

## 3. Architecture — the one rule

**The engine is a compiler for `/data`. It hardcodes no world facts.**

If you cannot change a district's building density by editing one number in
`data/blocks.json`, the architecture has been violated — fix that before
continuing. This is the property that makes the world editable after the
generating agent is gone, and it is worth more than any single feature.

Eight data files, all authored in Phase 0, all parsing, ~95KB total:

| File | Owns |
|---|---|
| `data/world.json` | District bounds, road graph spec, expressway spline, landmarks, interiors, camera law, colour grades, render budget |
| `data/blocks.json` | Block grammar: lotting rules, 9 building archetypes, per-district weights/density, 21 facade definitions, vertex-lighting constants |
| `data/props.json` | ~40 props as primitive `parts` recipes. `gen/props.js` is a dumb interpreter — a new prop is a data edit, never a code edit |
| `data/vehicles.json` | 9 parametric vehicle archetypes (8 spawnable + the pursuer sedan), handling, traffic budget |
| `data/npcs.json` | 9 NPC archetypes, the 6-verb tool set, policies, pursuer tiers, compliance tuning, replay-buffer config |
| `data/dialogue.json` | Every line keyed by id, with `voices` resolved **by name** (no ElevenLabs voice ids committed) |
| `data/missions.json` | All 8 missions as objective lists |
| `data/radio.json` | 6 stations synthesised from step patterns — zero audio payload; `bpm` drives the world clock, `grade` overrides colour |

## 4. File-by-file status

### Written and parsing

| File | What it does | Confidence |
|---|---|---|
| `index.html`, `style.css` | Canvas, HUD, touch controls, pause, rewind overlay, boot screen. Safe-area insets throughout | high |
| `engine/state.js` | Seeded RNG (mulberry32/FNV-1a), data loading, event bus, query params, `sanitizeName` for `?to=`, district lookup | high |
| `engine/render.js` | Renderer, render target, 6 shared materials, grade/fog/sky application, `internalSizeFor` (keeps constant pixel *area* while matching display aspect — fixes portrait stretch) | medium |
| `engine/post.js` | The final pass: grade → 5:6:5 quantise + 4×4 Bayer dither → nearest blit. No bloom/AO/DOF, deliberately | medium |
| `engine/camera.js` | Fixed iso rig: ortho, pitch 55°, yaw 45° with 90° snaps, damped follow, velocity look-ahead, two zoom levels, `movementBasis()` for screen-relative input | high |
| `engine/input.js` | Keyboard + floating virtual stick + context buttons + pinch. Edge-triggered `consume()` | high |
| `engine/physics.js` | Spatial-hash collision (box/circle/ramp), iterative circle push-out, arcade vehicle step | medium |
| `engine/debug.js` | `?debug=1`: flyover, coord/heading readout, wireframe, collision overlay, draw-call + triangle counters, `window.RAFFI_WORLD` audit API | medium |
| `engine/main.js` | Boot sequence + main loop + transport clock + parked-car spawning | medium |
| `gen/atlas.js` | One 1024² procedural atlas, 8×8 cells of 128px: facades with window grids baked in, roads, sidewalks, cobble, crosswalk, chainlink, blob, signage text | medium |
| `gen/builder.js` | Mesh accumulator. Bakes the key light + fill + face AO into vertex colours at generation time. **The runtime scene has zero lights** | medium |
| `gen/roads.js` | Node/edge graph from arterial spec, asphalt, sidewalks, kerbs, lane dashes, intersections, crosswalks | medium |
| `gen/blocks.js` | Lot subdivision on the district grid | low — see PREDICTED-JANK #8, #9 |
| `gen/buildings.js` | The shape grammar: extrude → setback → cap → window grid → lit windows → roof props | medium |
| `gen/props.js` | Prop recipe interpreter + street furniture placement | medium |
| `gen/peds.js` | Capsule-and-box rigs, procedural animation, beat quantisation hook | medium |
| `gen/vehicles.js` | Parametric car generator from silhouette params | medium |
| `gen/world.js` | Scene assembly: water, fog cards, per-district groups, hero landmarks (stadium, tower, lobby, club, apartment, promenade, bridge, cranes) | medium |
| `game/player.js` | Walking, driving, enter/exit, screen-relative steering | medium |
| `game/hud.js` | DOM HUD updates | high |

### Not written yet

- `game/missions.js`, `game/compliance.js`, `game/radio.js`, `game/replay.js`
- `engine/audio.js` (the transport clock exists in `main.js`; audio does not)
- `shell/xp-window.js`, `shell/installer.js`
- `tools/audit.mjs` (Playwright), `tools/voice.mjs` (ElevenLabs)
- `JANK.md`
- Interiors (`mainframe`, `club-floor`, `pitch`) — declared in `world.json`, no scene built
- Expressway ring — spline is in `world.json`, no geometry generated
- NPC spawning/pooling — archetypes and policies are authored, nothing instantiates them

## 5. Non-negotiables (do not "improve" these)

1. **Camera is fixed 3/4 isometric.** Orthographic, pitch 55°, yaw snaps in 90°
   steps only. No free look, no orbit, no first person, ever. Everything else
   depends on this: geometry is authored on a grid, only camera-facing faces are
   built, and screenshot audits are only deterministic because of it.
2. **PS2, not PS1.** No vertex snapping, no affine texture warble. Clean low-poly
   geometry, baked vertex lighting, blob shadows, heavy coloured fog, 512×288
   internal buffer, 5:6:5 + Bayer dither. No bloom, AO, DOF, or motion blur.
3. **No realtime lights.** Lighting is baked into vertex colours in
   `gen/builder.js`. If you find yourself adding a `THREE.PointLight`, stop.
4. **No downloaded assets.** Every mesh, texture and sound is generated in code.
5. **Archetypes only.** No real named private individuals as NPCs. No real
   street addresses, no geo-accurate map.
6. **Replay divergence must be real.** The DAR/TAR percentages are computed live
   from two runs. Non-determinism comes honestly from pathfinding tiebreaks and
   collision resolution order — see the comment at the top of `engine/physics.js`.
   Never hardcode or fake those numbers; the mechanic is worthless if faked.
7. **Tone: dry, affectionate, never mean.** Getting caught produces a calendar
   invite, not a death screen.

## 6. Do these first, in this order

1. **Boot it.** `npm run dev`, open `/world/index.html?debug=1`. Expect failures.
   Fix until a frame renders and the debug readout shows sane coordinates.
2. **Fix the draw-call blowout.** Highest-confidence known problem:
   `gen/vehicles.js` builds ~15 meshes with cloned materials per car, and
   `spawnParkedCars` places up to 35. That alone is ~500 draw calls against a
   budget of 120. Merge each car into one geometry, or instance per archetype.
   Same issue, smaller, in `gen/peds.js`.
3. **Fix lot placement.** `PREDICTED-JANK.md` #8 and #9: the push-off-street
   nudge runs *after* the road test so lots can be shoved into another road, and
   `ry` only ever takes two values so stoops can face backwards.
4. **Build `tools/audit.mjs`** (Playwright, needs installing) before adding more
   content. `window.RAFFI_WORLD.teleport/setGrade/getState` already exist in
   `engine/debug.js` for it to drive. Capture ≥4 positions per district × 3
   grades, write to `audit/{phase}/`, then fill in `JANK.md`.
5. Then continue the phase plan: interiors + expressway (Phase 3), NPCs +
   compliance + missions + replay ghosts (Phase 4), radio/audio + XP shell +
   mobile polish (Phase 5).

## 7. Shell integration (Phase 5, not started)

The game boots from the existing Windows XP desktop at `raffi.computer`
(`app/page.tsx`, `app/components/GameSelector.tsx`, `components/ui/WindowShell.tsx`).

Plan: add a `RAFFI WORLD.EXE` desktop icon that opens a draggable/resizable XP
window containing `<iframe src="/world/index.html">`. Same-origin, so the
existing CSP `frame-src 'self'` already permits it. Maximise → fullscreen +
landscape lock. Escape returns to the desktop with state preserved. The loader
should be an InstallShield-style wizard followed by a defragmenter progress
display. The XP taskbar becomes the HUD; the Start menu becomes the pause menu;
the system clock drives time of day (`engine/state.js` `currentHour()` already
reads it, and `?hour=` overrides it for deterministic audits).

## 8. Repo conventions that apply

From `agents.md` at the repo root:

- Run `npm run build` before pushing; it runs TypeScript + ESLint and must pass.
- Commit messages lowercase and imperative (`feat: add x`).
- No `console.log` in production code (`console.info`/`console.error` on boot is
  fine and used deliberately).
- The `public/world/` app is plain JS and is **not** type-checked by the Next
  build — do not assume the build catches errors in it.
- `data/audio-library.ts` and `lib/audio-engine.ts` in the repo root belong to
  the *site's* SoundCloud player. Unrelated to this game. Do not touch.

## 9. Useful URLs

| URL | Purpose |
|---|---|
| `/world/index.html` | Normal play |
| `/world/index.html?debug=1` | Debug HUD, flyover (F), wireframe (G), collision (C), grade cycle (V) |
| `/world/index.html?debug=1&auto=1` | Skips the START gate — required for screenshot automation |
| `?seed=FIXED` | Deterministic world |
| `?grade=night` | Force a colour grade |
| `?hour=23` | Force the time of day |
| `?lowfi=1` | Force the mobile-sized internal buffer |
| `?to=NAME` | Personalised greeter (name is sanitised and length-capped in `state.js`) |

---

## 10. Codex pickup prompt

Paste everything below into a fresh Codex session opened on this repo.

````
You are picking up a partially built game. Read these three files before writing
any code, in this order:

  public/world/WORLD-BIBLE.md      — the design contract
  public/world/HANDOFF.md          — current state, file-by-file status
  public/world/PREDICTED-JANK.md   — known/suspected defects, written before any run

CONTEXT

RAFFI WORLD is a standalone static game at public/world/ inside a Next.js repo.
Vanilla ES modules + three.js vendored at public/world/vendor/. No bundler.
Fixed 3/4 isometric, PS2-era art direction, five districts, crime-city satire
where the wanted level is corporate COMPLIANCE.

Phase 0 (all eight /data JSON files + world bible) is complete.
Phase 1 (engine skeleton, camera, PS2 post chain, debug mode) is ~90% written.
Phase 2 (city generation) is partially written.

CRITICAL: nothing has ever been run in a browser. All 19 modules parse and all
8 JSON files parse, but zero frames have been rendered. Assume it is broken.

YOUR FIRST TASK, before any feature work:

1. Run `npm run dev` and open http://localhost:3000/world/index.html?debug=1
2. Fix whatever prevents a frame from rendering. Work through boot errors one at
   a time. The boot screen prints failures into #boot-status.
3. Report what was broken and what you changed. Do not add features until a
   frame renders and the ?debug=1 readout shows sane coordinates, a district
   name, and draw-call/triangle counts.

THEN, in this order:

4. Fix the draw-call blowout. gen/vehicles.js builds ~15 meshes with cloned
   materials per car and engine/main.js spawns up to 35 parked cars — roughly
   500 draw calls against a budget of 120. Merge each vehicle into a single
   geometry or instance per archetype. Same problem, smaller, in gen/peds.js.
   Verify against the counters in the debug readout.
5. Fix lot placement — PREDICTED-JANK.md items 8 and 9.
6. Build tools/audit.mjs with Playwright (needs installing). It must launch
   ?debug=1&auto=1&seed=FIXED, drive window.RAFFI_WORLD.teleport() and
   .setGrade() through at least four inspection positions per district across
   all three colour grades, write PNGs to audit/{phase}/ with a contact sheet,
   and then you must review every image and fill in JANK.md with a table of
   Screenshot | Issue | Severity (blocker/visible/charm) | Fixed.
7. Only then continue the phase plan in HANDOFF.md section 6.

RULES YOU MAY NOT BREAK (see WORLD-BIBLE sections 4 and 5):

- The camera is fixed 3/4 isometric, orthographic, pitch 55°, yaw snapping in
  90° steps. No free look, no orbit, no first person, ever.
- PS2 not PS1: no vertex snapping, no affine texture warble, no bloom, no AO,
  no depth of field, no motion blur, no realtime shadows, no PBR.
- No realtime lights. Lighting is baked into vertex colours at generation time
  in gen/builder.js.
- No downloaded assets, models, or sprite sheets. Everything is generated.
- The engine is a compiler for /data and hardcodes no world facts. If changing
  a district's `density` in data/blocks.json does not change that district,
  that is a bug in the architecture — fix it.
- NPC archetypes only. No real named individuals, no real addresses.
- The replay-ghost DAR/TAR percentages must be computed live from two real runs.
  Divergence comes from genuine non-determinism in pathfinding tiebreaks and
  collision resolution order. Never fake or hardcode those numbers.
- Tone is dry and affectionate, never mean. Getting caught produces a calendar
  invite, not a death screen.

WORKING STYLE

- After each phase, output a short status: what shipped, what the audit found,
  what changed in the plan, what is deferred.
- Maintain JANK.md and PREDICTED-JANK.md. Not all jank should be fixed — jank is
  part of the aesthetic. Fix blockers: geometry gaps, z-fighting, floating
  props, unreachable areas, HUD off-screen.
- Repo conventions are in agents.md at the repo root. `npm run build` must pass
  before pushing, but note it does NOT type-check public/world/ — that is plain
  JS and the Next build will not catch errors there.
- Do not touch data/audio-library.ts or lib/audio-engine.ts at the repo root.
  Those belong to the site's SoundCloud player and are unrelated.
````
