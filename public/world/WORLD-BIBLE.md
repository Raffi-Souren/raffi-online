# RAFFI WORLD — World Bible

## September 9 follow-up — current player and control contract

The historical verification section at the end describes the published db25e8a rebuild. The following character/gameplay pass retains its NYC music, sports, printing, missions and relationship consequences.

Player walk2.8m/s and run6m/s use phase-blended source clips; holdShift or double-tapW/Up on desktop, holdRUN on touch. On-foot mouse/touch look remains at the chosen bearing while stopped. J/PUNCH is a brief non-injurious startle interaction with no damage/death reward; contact is valid only on foot, and loading resets transients. Skateboards have their own7.2m camera pullback, a physical deck silhouette, independent rider/board kickflip and aligned rail catch/slide/hop-off. Vehicle chase/ownership and collision contracts remain intact.

The player has the supplied-reference-inspired full front/downward wavy hair, dark round acetate glasses, green polo and warmer skin. Named hosts are reserved from ambient selection; nearby conversation partners get detail priority inside the existing cap. Citizens use bounded sidewalk detours around static and dynamic obstacles; population count remains bounded.

Touch control ownership excludes pinch mixing; zoom uses explicit buttons and DRIFT is distinct from BRAKE. Typed negation/questions/quotes/conditions/mixed intentions never commit obligations. A completed story reports its actual outcome. Graphics recovery offers only supported actions and verified save information.

Current evidence:453tests/build pass; runtime/assets `a6ed3a22f9b96efd42cc35f0eb806ce8c19606da1bb27577872b53bcaef28ab7`. Review and provenance are in HANDOFF/JANK and `artifacts/raffi-world-review/index.html`. Keep historical/current browser pacing separate; no physical-phone or photorealism claim.

> Current contract: September 9, 2026. The user's NYC modernisation brief and later
> tone/conversation/music overrides replace the original Phase 0 art restrictions.
> Historical sections below describe source systems, not permission to undo working play.

---

## 1. The pitch in one line

A compact NYC game about music, friends, soccer, neighborhood life, ambition,
and the occasional bad decision. Modern browser 3D, a responsive third-person
camera, and short missions with understandable stakes.

## 2. Tone and conversations

Characters have their own lives and believable motivations. Allow sincerity,
tension, humor and quiet. Corporate satire is occasional Mainframe flavor.
Player-facing pursuit uses Heat, Lost them and Try again; internal compliance
IDs remain compatible. No blood or death. Reply All Repaint stays a background joke.

The first typed encounter is Last Crate: return a personal collection, cover the
gig with replacement records, or negotiate a handoff. Each branch must have real
playable objectives and a remembered later consequence. Data defines requirements,
rewards and relationship changes. Local intent parsing accepts paraphrases;
questions and ambiguity never silently commit. Optional replies and walking away
remain available. Save decisions; rewards are idempotent. Typing owns input.

## 3. NYC and Brooklyn

Recognisably Brooklyn-inspired, deliberately compressed rather than geographically
exact. Heights: brownstones, stoops, canopy and promenade. Downtown: Brooklyn glass
and stone, office lobbies and Mainframe. Nightlife: record shops, clubs, bodegas and
flyers. Yards: Red Hook/Navy Yard brick, docks and containers. Bowl: an original NYC
stadium neighborhood and playable pitch. Existing district, street and save IDs
remain stable; visible names can evolve deliberately.

World bounds: `x ∈ [-640, 680]`, `z ∈ [-460, 420]`. One unit is one metre.
Compass: `-Z` is north, `+X` is east.

### THE HEIGHTS — spawn, northwest bluff

Brownstone rows on a grid, cobblestone side streets, mature street trees. A
fenced waterfront promenade along the north edge looks across the harbour at a
skyline the player can never reach — it is a fog card, and it should always
stay one. A suspension bridge anchors the north edge and carries the expressway
off-map.

The player's apartment is here. It is the save point and the wardrobe. Quiet
ambience: gulls, distant traffic, one air conditioner.

### DOWNTOWN — glass core, northeast of centre

Financial district. Setback glass towers, hard-edged plazas, a corporate campus
with an enterable lobby. Streets are wide and shadowed. Pedestrian density is
highest here at midday and drops to near zero at night.

**THE MAINFRAME** sits beneath the largest tower: a basement of humming
cabinets, raised floor tiles, and punch-card corridors. Cold blue, fluorescent,
**no fog** — it is the visual opposite of everything above ground and that
contrast is the point. Entered via the campus lobby.

### THE STRIP — nightlife, south of centre

Neon, low buildings, wet asphalt. A record store with browsable crates. A club
with a functioning DJ booth. Late-night food. A surface parking lot that acts as
the world's most reliable vehicle spawn. Best district in the `night` grade and
the game should show it off there first.

### THE YARDS — industrial waterfront, east

Shipping containers stacked in seeded rows, gantry cranes, freight rail, chain
link, wide empty lots. This is the driving district: ramps, loading docks, long
straights, nothing precious to hit. Almost no pedestrians.

### THE BOWL — stadium, southwest

A stadium ringed by a parking sea. Tailgate lots, a spiral pedestrian ramp,
floodlight pylons visible from every district as a navigation landmark. The
interior pitch is accessible and hosts the penalty shootout.

### Connectivity

Surface arterials connect the five districts; Willow Place supplies the opening
local street. The elevated expressway remains an authored future route, not a
claim of current runtime connectivity. Any mission using it must first provide
continuous drivable surfaces, ramps, barriers and camera clearance.

## 4. Camera law

Perspective chase is the default. Preserve C/V/CAM cycling, Q/X orbit, Classic
ISO and Bird's Eye options. Foot movement is camera-relative; the collision-aware
boom, drag look and frame-rate-independent damping keep the actor readable. Driving
uses damped chase, mild speed distance/FOV and look into turns. No automatic hood
switch. Space/E interactions and mobile controls preserve their established meanings.

## 5. Modern presentation and local assets

WebGL2 is the baseline. PBR materials with coherent albedo/normal/roughness, sun/sky,
shadows, plausible local lights, tone mapping, anti-aliasing and restrained bloom.
Modern daylight must hold up without fog hiding unfinished models. Geometry needs
complete sides/roofs, coherent scale, readable silhouettes and grounded contact.
Depth of field and motion blur default off. High-tier AO/CSM are measured options;
WebGPU is optional and must not become a separate world implementation.

Use small curated original/CC0 assets, local under assets with source/author/license/
modification/size/LOD manifests. Prefer 1K–2K maps and a provisional 10–20 MB first-play
transfer budget. Blender is optional if unavailable; use reproducible local scripts,
aligned Three GLTFLoader/SkeletonUtils, AnimationMixer and glTF inspection/validation.
Source-art previews are not acceptance evidence; verify appearance in the live game.

Auto conservatively chooses Low/Medium/High from capability and observed frame time
with hysteresis. Low targets mobile ~540p/30 fps; Medium ~720p–1080p/60 fps on a named
reference device. Report real resolution, effects, backend, median/p95 frame time,
visible/shadow/post draws and loading. Headless software GPU is correctness evidence,
not a consumer-device performance claim. Initial Medium scene goals <250draws and
<150kvisible triangles can be revised with measured visual benefit. Instance compatible
actors and spatially chunk static geometry. Near skinned characters are allowed.

### Colour grades

| Grade | Fog | Key | Shadow tint | Mood |
|---|---|---|---|---|
| `dusk` | `#E86A9C` → `#F4B26A` | `#FFE9C4` | `#3A2A55` | Magenta and amber sunset haze |
| `haze` | `#C9BE8E` | `#FFF4D2` | `#4A4530` | Daylight: balanced sun and sky, restrained haze |
| `night` | `#1B2340` | `#8FA8FF` | `#0C1024` | Wet asphalt, neon reflections |

Time of day cycles these. The pause menu can force one. A radio station can
override the world grade while it plays.

## 6. Heat and recovery

Five Heat tiers keep the existing pursuit rules and internal IDs. The HUD uses
Heat, Lost them, Caught and Try again. A following drone, a runner and escalating
sedan groups make the pressure visible. Getting caught produces a brief fade and
returns control without blood, death or a forced meeting joke.

Parking slowly inside a Reply All Repaint bay clears Heat and changes the car's
two-tone paint. Escape without contact also lets Heat decay. Active mission
waypoints take priority over repaint guidance. Corporate dialogue belongs around
Mainframe; neighborhood encounters have ordinary human stakes.

## 7. RADIO and the music-reactive city

Six stations, cycled with a button while driving. Each carries a `bpm` and an
optional `grade` override in `radio.json`. While a station plays, the world
quantises to its bpm: streetlight flicker, crosswalk signal cadence, club
lighting, and pedestrian walk-cycle phase. Changing the station changes the
city's tempo and colour. The record store crates unlock and reorder stations.

This is the DJ set as level design, and it is the cheapest large win in the
build: one clock, many subscribers.

## 8. REPLAY GHOSTS — the signature mechanic

Every NPC runs a small decision policy over a fixed tool set:
`walk`, `enter`, `talk`, `buy`, `flee`, `idle`. Every decision and resulting
action is appended to a ring buffer covering the last 90 seconds.

`REWIND` in the pause menu re-runs the buffered window with the same world seed
and the same policies, then draws the previous run's actor paths as translucent
coloured ghosts beside the new run.

What the player sees: NPCs overwhelmingly make the **same decisions** and
visibly take **different paths** to execute them. An overlay reads
`decision agreement: NN%` and `path agreement: NN%`, computed live from the two
runs.

**The divergence must be real.** It comes from honest non-determinism in
pathfinding tiebreaks and in collision resolution order, not from hardcoded
numbers. If the percentages are ever faked the mechanic is worthless.

## 9. Performance and simulation contract

The old 60k-triangle, 120-draw, 8MB and fixed-isometric limits are superseded by
section 5. Initial Medium targets are fewer than 250 total scene/shadow/post draws
and 150k visible triangles. A measured increase needs a visible benefit and an
explicit recorded decision. First-play transfer targets 10–20MB; decoded textures
and render targets are separate costs. Low targets about 540p/30fps on iPhone 12
class hardware; that claim requires a real sustained phone run.

Gameplay advances at 60Hz with at most eight catch-up ticks per frame. Extra stall
time is reported and discarded, avoiding a runaway backlog. Actor transforms and
camera focus interpolate between the latest simulation states; rendering restores
simulation transforms before collisions, save reads or subsequent ticks. Input
edges run once per display frame. Hidden/minimized games and modals do not accrue
catch-up time. Replay decisions and mission clocks use the simulation clock.

Measure a 60-second moving route after warm-up, recording browser/GPU, viewport,
internal resolution, median/p95, hitches, visible/shadow/post work, transferred
bytes and decoded texture estimates. Metal-backed headless Chromium on the Mac
is named hardware evidence, with the headless condition disclosed; SwiftShader
numbers are correctness evidence only. Neither establishes mobile thermal behavior.
The block consistency pass also requires a foreground browser run on the same
route and build, with document focus/visibility recorded. A screenshot's total
triangle submissions include shadows and must not be compared to visible-only
geometry or a differently framed/warmed route without explaining both conditions.

## 10. Glossary

- **Grade** — one of the three named colour LUTs.
- **Block** — one grid cell of a district's tile map.
- **Archetype** — a parametric family (building, vehicle, NPC) expanded by seed.
- **Tool** — one of the six verbs an NPC policy may emit.
- **Compliance** — the wanted level.
- **Fog card** — unreachable painted backdrop geometry, e.g. the far skyline.

## 11. Naming rules

NYC and Brooklyn references are welcome. Use a deliberately compressed city with
original businesses, characters, vehicles and music. Do not imply a precise street
reconstruction or import another game's branded assets. Internal district, seed,
mission and save identifiers stay compatible even when visible names change.

## Current gameplay additions and milestone order

Keep the existing eight-mission flow and fix regressions; do not rebuild systems
merely because older audits called them absent. First deliver one convincing block,
walking/car play and a second district. Then living traffic/audio, complete core loop,
Last Crate decisions, map/recovery and host/mobile verification. Broader effects follow.
Preserve Crate Quest and record-hunt rewards. Add tangible original/licensed sleeve and
flyer reveals (No Sleep: NYC Nightlife Flyers 1988–1999 is visual reference, not a raw
licensed art pack), and the user's real Ghost Deck demo as an optional embedded booth.
Saves include autosave/manual slots; active mission saves resume authored checkpoints.
The home yellow question block keeps its songs and opens clickable/typed game cheats.
Explicit map pins survive choosing a ride or subway travel. An active mission keeps
its own route; accepting a new story objective can replace a manual pin.

The current visual gate is one coherent daylight Brooklyn block: actual ordinary
traffic archetypes, closest-visible animated people, branching street trees,
recessed storefront displays and an intersection. Keep collisions/ownership,
story decisions and music discoveries intact. Prioritize nearby detail and cheaper
distance representations. Preserve walking/vehicle clearances and use a few
purposeful activities before adding population. Normal UI has contextual prompts,
a brief district arrival cue and no developer overlay or permanent perspective
player ring. Deliver matched camera before/after frames and uncut normal-input
walking/driving footage; fixture renders do not replace playable evidence.

Acceptance brief: /Users/rsk/Downloads/raffi-world-nyc-modern-rewrite-prompt.md,
plus subsequent user messages in this task. Keep reviewable changes on the feature
branch. Do not merge or deploy production without authorization.

The population addendum requires twelve distinct adult identities prepared in
Blender: actual fitted body, facial and garment geometry, varied hair, stable seed
assignment and recognisable near/far LODs. Colour swaps alone do not count as new
people. Preserve individual animation mixers and grounded movement. Source packs
stay outside the public payload; `tools/download-population-source.py` pins the
Blender runtime/MPFB revision and records source hashes. Review a front/side/walking
lineup and grayscale silhouette comparison before accepting the cast.

Waterfront Pickup is an optional connected park. Jules accepts typed or tappable
tennis/soccer/boxing choices; questions explain without committing. Tennis is first
to three with positioning, timing and placement. Soccer is a compact2v2 with useful
passing, supporting teammates and defenders. Boxing is friendly scored sparring
with distance, guard, stamina and counters. Each activity owns its camera/input and
freezes with pause or host interruption; exploration position and parked vehicles
stay intact. Practice/watch/abandonment grant no match result. Results save once,
and Jules remembers both wins and losses. All three choices must work before the
park is called complete. Use ordinary-input entry/play/exit and save/reload footage.

Mae's live-print table connects Raffi's documented NYC design/printing and popup
work to an optional making activity. Players choose original artwork, a poster,
record sleeve or shirt, and two inks; align the screens and pull coverage manually.
The actual offsets and ink coverage reproduce the saved edition, which can be
exported as a PNG. The first completed print unlocks FLIP SIDE, and Mae remembers
the latest format. An abandoned print grants nothing. Browser storage holds compact
validated recipes rather than image blobs. No paid assets or copied flyer-book
pages are required for this activity.

Reference access: the supplied X status URLs were retried during the September9
pass and returned403/cache misses or no indexed result. Do not attribute unseen
technical advice to those posts. The supplied Something Big world page is a
client-rendered visual reference. MPFB/MakeHuman source, the Quaternius animation
library and Three.js source are the inspectable implementation references; the
asset manifests record the exact inputs actually used.


## September 9 local verification

The completed local pass has 441 passing unit tests, a passing production build,
and matching runtime/asset fingerprints across the final street/park/sports
recordings and 182-view Medium complexity gate (145,491 visible triangles /
191 total draws). The accepted fingerprint is
`1d03e7d3c8ed0fa0abf79fb7cd1140422b5ef911f22ef6fad4095d1c2c7533a1`.

On the M4 Pro, the 60-second focused foreground routes measured 33.3 ms median /
34.9 ms p95 in every tier, with no frames over 50 ms. Metal headless measured
8.3 / 10.3 ms. A bare DOM animation and bare WebGL clear reproduce the same
foreground/headless pacing split. This is a measured session constraint, not a
claim of 120 fps foreground play or 60 fps certification. Low renders 916×572
at this viewport; Medium and High render 1440×900 internally. First-play local
transfer including warm-up was approximately 7.4–8.4 MB. Scene-material texture
estimates are approximately 61–106 MB; render targets, driver overhead and geometry
buffers are excluded. No sustained real-phone thermal result is claimed.

The review page, direct captures, uncut silent videos and machine-readable reports
are kept outside the public game payload at `artifacts/raffi-world-review/`. See
JANK.md for preservation evidence and remaining visual limits. No deployment is
included in this pass.
