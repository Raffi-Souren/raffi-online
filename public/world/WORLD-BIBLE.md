# RAFFI WORLD — World Bible

> Phase 0 artifact. Written before any rendering code. Everything in `/data` is
> authored against this document; the engine is a compiler for that data.

---

## 1. The pitch in one line

A sun-bleached PS2-era isometric crime city where the crime is process, the
police are middle management, and the wanted level is a calendar invite.

## 2. Tone

Dry, affectionate, deadpan. The joke is structural: enterprise software culture
has exactly the same escalating-consequences ladder as a crime game, and neither
is as serious as it believes. Nobody in this world is cruel. The worst thing
that happens to you is a meeting.

**Rules of tone:**

- Pursuers are never menacing. They are apologetic, procedural, and extremely
  persistent. A Legal Review that corners you says "we just want to align."
- No blood, no death, no destruction. Losing a chase means an accepted invite.
- Satire punches at process, never at people. No real named individuals appear.
- Signage and radio ad-reads carry most of the comedy. The missions play straight
  and let the framing do the work.
- Jank is charm. A pedestrian clipping a planter is fine. A pedestrian walking
  through a tower is a blocker.

## 3. The city — PORT VANTAGE

A fictional composite coastal city on a peninsula. Water on every outer edge.
No real neighborhood names, no real street addresses, no geo-accurate map. The
geography is archetypal so it reads as anywhere and nowhere: an old residential
bluff, a glass financial core, a neon strip, a working waterfront, a stadium.

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

An elevated expressway ring touches all five districts, entered by on-ramps.
Surface arterials connect adjacent districts on a loose grid. Design target:
any district to any other in under 90 seconds by car.

## 4. Camera law

Fixed 3/4 isometric, orthographic, pitch 55°, yaw fixed with optional 90° snap.
Rigidly parented to the player with damped follow and velocity look-ahead. Two
zoom levels, on-foot and in-vehicle. **No free look, no orbit, no first person.**

Consequences that bind every other decision:

1. Geometry is authored on a grid. Districts are tile maps, not freehand scenes.
2. Only camera-facing faces are ever visible. Do not model back walls, building
   interiors that are never entered, or roof detail beyond silhouette.
3. Screenshot audits are deterministic, which is the only way this build can be
   checked by something that cannot perceive motion.

## 5. Look — PS2, not PS1

Low poly with **clean, correct** geometry. Vertex lighting baked at generation
time from one directional key and one ambient fill. No realtime lights. Blob
shadows only. Textures 64–128px, procedural, one atlas for the whole world.
Heavy coloured distance fog is the primary mood instrument.

Internal buffer 512×288, nearest-neighbour upscale. Final pass quantises to
16-bit 5:6:5 with 4×4 ordered Bayer dithering.

**Explicitly forbidden:** vertex snapping, affine texture warble (both PS1),
bloom, AO, depth of field, motion blur, realtime shadows, PBR.

### Colour grades

| Grade | Fog | Key | Shadow tint | Mood |
|---|---|---|---|---|
| `dusk` | `#E86A9C` → `#F4B26A` | `#FFE9C4` | `#3A2A55` | Magenta and amber sunset haze |
| `haze` | `#C9BE8E` | `#FFF4D2` | `#4A4530` | Dusty, blown out, midday |
| `night` | `#1B2340` | `#8FA8FF` | `#0C1024` | Wet asphalt, neon reflections |

Time of day cycles these. The pause menu can force one. A radio station can
override the world grade while it plays.

## 6. COMPLIANCE LEVEL

Replaces the wanted level. Five tiers, shown as icons top-right.

| Tier | Name | Pursuer | Behaviour |
|---|---|---|---|
| 1 | Slack message | Notification drone | Follows, does not intercept |
| 2 | Calendar hold | Coordinator on foot | Jogs toward the player |
| 3 | Skip level | Sedan, one | Drives, tries to pull alongside |
| 4 | Steering committee | Sedans, three | Coordinated, box the player in |
| 5 | Legal review | Black sedans, four + drone | Relentless, blocks intersections |

Cleared by parking at any **Reply All Repaint** shop, which resets the level to
zero and repaints the vehicle a new two-tone. Commit to the joke completely.

Pursuer dialogue is dry, bureaucratic, never mean. Getting caught produces an
accepted calendar invite and a fade, not a death screen.

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

## 9. Performance budget

Hard limits; a violation is a bug.

- 60fps sustained, iPhone 12, mobile Safari, 390×844
- < 120 draw calls/frame
- < 60,000 visible triangles/frame
- < 8MB initial payload excluding audio
- < 5s to playable on simulated 4G

One `InstancedMesh` per building archetype per district. One texture atlas.
Frustum culling (trivial under a fixed camera). District streaming with
expressway tunnels as the hand-off cover. Pooled pedestrians, vehicles, particles.

## 10. Glossary

- **Grade** — one of the three named colour LUTs.
- **Block** — one grid cell of a district's tile map.
- **Archetype** — a parametric family (building, vehicle, NPC) expanded by seed.
- **Tool** — one of the six verbs an NPC policy may emit.
- **Compliance** — the wanted level.
- **Fog card** — unreachable painted backdrop geometry, e.g. the far skyline.

## 11. Naming rules

Everything is fictional. Streets are generic (`HARBOR ST`, `9TH AVE`).
Businesses are satirical (`Reply All Repaint`, `Sunrise Deli`, `Vantage Group`).
No real people, no real addresses, no real neighborhoods. Consented cameos only,
and there are none in v1.
