# PREDICTED-JANK.md

Written **before** the first screenshot audit, as the spec requires. The gap
between what is predicted here and what the audit actually shows is itself the
useful artifact — record it in `JANK.md` after each phase.

Severity key: `blocker` (must fix) · `visible` (should fix) · `charm` (ship it).

---

## Phase 1 — engine skeleton, camera, post chain

Nothing has been rendered yet at the time of writing. These are predictions
from reading the code, not observations.

| # | Predicted issue | Where | Severity | How a human spots it |
|---|---|---|---|---|
| 1 | Atlas cell bleeding at facade edges despite the half-texel inset, because mipmaps are on and cells are only 128px | `gen/atlas.js` `texture.minFilter = LinearMipmapLinearFilter` | visible | Thin wrong-coloured seams along building corners, worse at distance. Fix: drop to `LinearFilter` or pad cells to 8px gutters. |
| 2 | Buildings float or sink — ground pad is at `y=0.005`, roads at `0.02`, sidewalks at `0.22`, and buildings start at `y=0` | `gen/world.js`, `gen/roads.js` | blocker | Z-fighting stripes on the ground plane; a visible gap under kerbs. |
| 3 | The `contact()` ground darkening applies to *every* vertex under 2.5m, including road and sidewalk planes, so all ground reads muddy | `gen/builder.js` | visible | The whole street is darker than the buildings sitting on it. |
| 4 | Ortho `near: -400` with camera distance 320 may clip the tops of the 210m hero tower | `data/world.json` camera, `gen/world.js` tower-hero | visible | The tower is sliced off flat at a constant screen height. |
| 5 | Fog `far` of 430 in dusk vs a 1320-unit-wide world means most of the city is solid fog colour | `data/world.json` grades | charm→visible | Reads as intended atmosphere on foot, as a wall when driving fast. |
| 6 | Nearest-filtered RT upscaled to a non-integer multiple produces uneven pixel sizes | `engine/render.js` `internalSizeFor` | charm | Shimmering pixel grid. Authentic-adjacent; only fix if it crawls. |
| 7 | Post-pass vignette (0.28) compounds with the shadow tint and crushes corners to black in `night` | `engine/post.js` | visible | Corners of the frame lose all detail at night. |

## Phase 2 — city generation (partially written, never run)

| # | Predicted issue | Where | Severity | How a human spots it |
|---|---|---|---|---|
| 8 | Lots overlap roads anyway: the push-off-street nudge in `layoutLots` moves a lot **after** the road test, so it can move *into* a different road | `gen/blocks.js` | blocker | Buildings standing in the middle of an intersection. |
| 9 | Building `ry` is only ever `0` or `π/2`, so lots facing a road from the far side have their stoop and shopfront on the back | `gen/blocks.js` | visible | Stoops and awnings facing away from the street. |
| 10 | Street furniture placed at every road node inside a district's bounds duplicates on shared district borders | `gen/props.js` `placeStreetFurniture` | visible | Two streetlights in exactly the same spot, z-fighting. |
| 11 | `findOpenSpots` rejects on lot AABB only, not on prop colliders, so scatter props spawn inside streetlights | `gen/blocks.js` | charm | A bin inside a lamp post. |
| 12 | Triangle budget blown in Downtown: 4-shell towers × ~30 lots × all 4 walls | `gen/buildings.js` | blocker | `?debug=1` readout shows `tris` over 60000 with `!!`. |
| 13 | Parked cars spawn half-inside kerbs — `curbOffset` assumes the segment half-width is the kerb line, which is true only for 2-lane roads | `engine/main.js` `spawnParkedCars` | visible | Cars embedded in the sidewalk on 3-lane roads. |
| 14 | The stadium ring is built from 22 boxes around a circle; at `seg=22` the corners will visibly gap on the outer radius | `gen/world.js` | charm | Sawtooth silhouette. Very PS2. Probably keep. |
| 15 | Suspension bridge cable segments use `d: abs(z1-z0)` for a box that also needs to span the height change — the sag will look like a staircase | `gen/world.js` | charm | Stepped cables. Era-appropriate; leave unless it reads as broken. |

## Standing risks not tied to a phase

- **Draw calls**: the design is 3 merged meshes per district × 5 districts = 15,
  plus water, fog cards, player, and one per spawned car. Cars are the risk:
  each `makeVehicle` builds ~15 separate meshes with cloned materials, so 35
  parked cars ≈ 500 draw calls on its own. **This will blow the budget and needs
  instancing or merging before Phase 3.** Highest-confidence prediction here.
- **Material clones**: `makePed` and `makeVehicle` clone a material per part.
  That is a lot of shader programs. Should be a small shared palette instead.
- **Mobile Safari**: `WebGLRenderTarget` with `colorSpace: SRGBColorSpace` plus
  a post pass is the most likely place for a silent black screen on iOS.

---

## Post-run disposition — Phase 2 audit

This section was added after rendering; the predictions above remain unchanged
as the pre-run artifact.

- Confirmed and fixed: #3 ground-contact mud, #5 fog wall/grade wash, #7 night
  corner crush, #8 post-nudge road overlaps, #9 two-direction facades, and #12
  the visible triangle breach (its worst view was a four-district seam rather
  than Downtown alone).
- The standing draw-call/material-clone prediction was correct. Vehicles and
  peds are now one merged mesh per actor; the strict sweep peaks at 17/120
  calls and 56,101/60,000 visible triangles.
- Not observed in 60 final frames: #1 atlas bleed, #2 floating/sunk buildings,
  #4 tower clipping, #10 duplicated border lights, #11 intersecting scatter,
  or #13 kerb-embedded parked cars.
- Kept as charm: #6 the uneven nearest-neighbour pixel grid and #14 the faceted
  stadium ring. #15 bridge cable stepping remains a targeted future close-up.
- The colour-space concern under Mobile Safari remains open until a real iOS
  device run; desktop Chromium renders the corrected post chain successfully.

## Next-pass predictions — Phase 3 content and mobile hardening

Written after the mobility audit but before the deferred interiors/expressway
work begins. These are predictions for the next pass, not retroactive audit
findings.

| # | Predicted issue | Where | Severity | How a human spots it |
|---|---|---|---|---|
| 16 | The always-readable player locator can show through a very tall foreground roof before the actor itself does. | `game/player.js` | charm→visible | Cyan ring appears detached from the actor during deep occlusion; keep unless it confuses navigation. |
| 17 | The fixed 205px dialogue-action shelf may crowd the caption in short landscape phone viewports. | `style.css` touch dialogue mode | visible | NEXT touches or covers the dialogue border after rotating a phone. |
| 18 | Dijkstra scans every road node when the player moves 18m; a denser Phase 3 expressway graph may make map updates spike. | `game/hud.js` route rebuild | visible | Frame-time sampler spikes while driving quickly and the route recalculates. |
| 19 | Subway mission express has one contextual destination, not an unlocked stop menu. Later missions may need data-authored destinations without turning the HUD into a spreadsheet. | `engine/main.js`, `data/world.json` | visible | Transit becomes ambiguous after more than one supported mission is active. |
| 20 | The new colour-space/render path still lacks a real Mobile Safari run. | `engine/render.js`, `engine/post.js` | blocker (release) | Black canvas, incorrect gamma, or WebGL context loss on iOS hardware. |
| 21 | Safari may cancel or retarget a long EXIT touch when the button hides on the following frame, leaving the edge-triggered input held. | `engine/input.js` `bindButton` | blocker (release) | After a long-press exit, the next EXIT tap does nothing until input state is reset. Test two full ride cycles on real iOS hardware. |
| 22 | A mission or transit marker closer than a just-dropped ride can own the shared Space/E context action. | `game/player.js` `contextAction` | visible | The prompt changes to the nearby objective instead of the expected remount action. Keep nearest-action behavior only if the visible choice remains clear. |
