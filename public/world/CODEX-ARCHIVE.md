# RAFFI WORLD — Codex Archive / Pickup Notes

**Worktree:** `/Users/rsk/GIT/raffi-online-grok-pursuit`  
**Branch:** `grok/camera-modes`  
**HEAD (at archive time):** `44a3734` — `feat: InfiniTown-style building massing grammar`  
**Remote:** branch may be ahead of `origin/grok/camera-modes` (push when ready).  
**Primary site repo:** `/Users/rsk/GIT/raffi-online` (`main`) — world lives under `public/world/` when merged.

**How to run locally:**
```bash
cd /Users/rsk/GIT/raffi-online-grok-pursuit
# any static server that serves ES modules
npx serve public/world -p 3000
# open http://localhost:3000
```
Hard-refresh after gen/data changes (city rebuilds at load from JSON + generators).

**Do not** reintroduce multi-tap post smear / film-grain “softness” — user rejected it as muddy, not PS2/GTA.

---

## 1. Intent of this arc (owner feedback)

| Owner ask | Direction taken |
|---|---|
| Camera / “Kimi 3D open world” feel | Multi-mode cameras + natural camera-relative move |
| Drive / reverse / exit issues | Tank car controls, wall reverse, smarter exit |
| Ped through buildings | `depthTest: false` on player ped + locator |
| Moving L/R funky then quieter | Fixed `movementBasis` handedness from camera look |
| Skateboard kickflip | F / FLIP secondary |
| “Feels like Minecraft” | Tried soft post → **rejected** (blurry, still square) |
| Want Spidey PS2 / GTA clarity | Sharp post, higher internal res, form lighting |
| **InfiniTown vibe for buildings (choice A)** | Building massing grammar (this is the visual lever) |
| Overdrive aspects cool, character Minecraft-y | Steal Overdrive *systems* later; not ped style |

**Open-source inspo (reference only — do not wholesale import engines):**
- [InfiniTownTS](https://github.com/osoker/InfiniTownTS) / [original InfiniTown](https://demos.littleworkshop.fr/infinitown) → **visual massing vibe** (implemented in `gen/buildings.js`)
- [OVERDRIVE CITY](https://github.com/appleweiping/overdrive-city) → later: merge/instance draw calls, day/night emissive dial, tile LOS heat (not character mesh style)
- [dgreenheck/simcity-threejs-clone](https://github.com/dgreenheck/simcity-threejs-clone) → floor/roof vocabulary reference

---

## 2. Commit stack on `grok/camera-modes` (newest first)

```
44a3734 feat: InfiniTown-style building massing grammar
f4ea85c fix: sharp PS2 city look, kill smear blur
215fa49 feat: soft Spider-Man PS2 city presentation   ← partially superseded by f4ea85c
7c4a7b3 feat: skateboard kickflip on F / FLIP button
0545921 fix: natural camera-relative move and car tank controls
e5d0f9a feat: add multi-mode camera and mission beacon
faaf7cf feat: add compliance pursuit and calendar catch
… (repaint, vertical slice, etc.)
```

**Note on 215fa49 → f4ea85c:**  
`215fa49` added softness/smear/bloom/grain. Owner said it made the game blurrier and still square. `f4ea85c` **killed smear/grain**, raised res, kept mild bloom for hot pixels only, strengthened form lighting. Prefer `f4ea85c` semantics if reconciling conflicts.

---

## 3. File map — where code went

### 3.1 Building grammar (InfiniTown massing) — **primary visual work**

| File | Role |
|---|---|
| `public/world/gen/buildings.js` | **Rewritten.** Shape grammar: `planShells` → base/shaft/crown, storey belts, pilasters, window recesses, storefronts, layered caps. Entry: `buildBuilding`, `buildDistrictBuildings`, `lotPoint`, `lotAxes`. |
| `public/world/data/blocks.json` | Per-archetype `massing: { ... }` blocks + raised `triBudget`. Vertex lighting contrast for form. |
| `public/world/gen/builder.js` | Mesh accumulator; **`heightAmb(y)`** soft vertical wash on walls (Gouraud-ish). `box` / `quad` / `wedge` primitives. |

**Massing keys** (`blocks.json` → `archetypes.*.massing`):

| Key | Meaning |
|---|---|
| `baseFloors` | Plinth storeys (`0` = no plinth) |
| `baseOutset` | Plinth wider than shaft (world units) |
| `baseHeightScale` | Plinth taller than normal floor height |
| `baseColor` / `ledgeColor` / `frameColor` | Vertex tint hints (atlas still paints walls) |
| `pilasters` | Corner + mid-face posts |
| `belts` | Storey ledges (`false` for warehouses) |
| `windowStyle` | `recessed` \| `curtain` \| `none` |

**Setback** (existing, still honored on upper mass only):  
`none` | `single` `{ atFraction, inset }` | `stepped` `{ steps, inset }`

**Caps:** `cornice` (double layer), `parapet`, `mech-box`, `crown`, `sawtooth`, `gable`, `open-deck`.

**Important:** City geometry is generated **at boot** from JSON + seed. No separate bake step. Changing `blocks.json` / `buildings.js` requires reload.

---

### 3.2 Presentation / “not Minecraft pixels”

| File | Role |
|---|---|
| `public/world/engine/post.js` | Composite blit: **sharp single-sample**, optional tiny bloom, grade, light quantize+Bayer, vignette. **No smear.** APIs: `setGrade`, `setPresentation`. |
| `public/world/engine/render.js` | RT uses **LinearFilter**; fog defaults distance-only; calls `post.setPresentation(data.world.render)`. |
| `public/world/data/world.json` | `grades.*` fog distances + post params; `render.internalWidth/Height` **960×540** (mobile 640×360); `quantize`/`dither`/`bloom` globals. |
| `public/world/gen/atlas.js` | Atlas **LinearFilter** mag (not Nearest); larger UV cell inset for bilinear bleed safety. |

**User rule:** clarity > period mush. Do not re-enable `uSoftness` multi-tap blur.

---

### 3.3 Player / kickflip / movement / vehicles

| File | Role |
|---|---|
| `public/world/game/player.js` | Walk + drive; **`tryKickflip()`**, **`isBoardTrickActive()`**, trick hop/spin on board mesh; exit blocked mid-trick; cars = tank steer; micro-rides = soft aim. Uses `movementBasis()` from camera. |
| `public/world/engine/main.js` | Boot + loop: cam cycle toast; **`consume('second')` → `tryKickflip()`**; exit gated on `!isBoardTrickActive()`. |
| `public/world/engine/input.js` | F = `second`; skateboard: second is **not** continuous brake (stick/S still brakes). `updateInput(mode, vehicleKind)`. |
| `public/world/data/vehicles.json` | Skateboard `controls.second`: **`"FLIP"`** (scooter still BRAKE). |
| `public/world/data/dialogue.json` | `ride-board` line mentions F kickflips. |
| `public/world/engine/physics.js` | Vehicle step, reverse/wall escape (earlier work). |
| `public/world/engine/camera.js` | Modes: classic / birds / chase / free; **`movementBasis()`** from camera look (RH screen-right). |

**Kickflip controls:** mount board → roll above `minSpeed` (~1.2) → **F** or touch **FLIP**. Toast via `bus.emit('toast', 'KICKFLIP!')` (HUD listens).

---

### 3.4 Camera modes + mission beacon (earlier on branch)

| File | Role |
|---|---|
| `public/world/engine/camera.js` | `cycleCameraMode`, chase/free yaw follow, ortho birds. |
| `public/world/game/missions.js` | Tall mission marker + X-ray beacon (`depthTest: false`). |
| `public/world/engine/main.js` | CAM / C / V cycle; toast mode label. |

---

### 3.5 Compliance / pursuit (earlier on branch, still present)

| File | Role |
|---|---|
| `public/world/game/compliance-core.js` + `compliance.js` | Heat, Reply All Repaint clear, authored `world.repaint` contract. |
| `public/world/game/pursuit-core.js` + `pursuit.js` | Tier rosters, spawn/chase, calendar-invite catch. |
| `public/world/tools/*-core.test.mjs` | Pure contract tests. |
| `public/world/tools/onboarding-smoke.mjs` | Browser smoke for onboarding / pursuit / repaint. |

See also `public/world/HANDOFF.md` entries for repaint + pursuit details.

---

### 3.6 Architecture layout (unchanged spine)

```
public/world/
  index.html          entry
  engine/             boot, render, camera, input, physics, state, post
  game/               player, missions, hud, dialogue, compliance, pursuit
  gen/                atlas, blocks, buildings, roads, props, peds, vehicles, world
  data/               *.json — city/content/source of truth
  tools/              node tests + smoke
  vendor/             three.module.js (vendored)
  WORLD-BIBLE.md      design bible
  HANDOFF.md          rolling agent notes
  CODEX-ARCHIVE.md    this file
```

**Pattern:** JSON authors content; generators emit merged BufferGeometry with **baked vertex colors**; runtime has **no** Three.js lights. Materials are `MeshBasicMaterial` + atlas + vertexColors.

---

## 4. Controls cheat-sheet (current)

| Input | Foot | Car | Skateboard | Scooter |
|---|---|---|---|---|
| WASD / stick | Move (camera-relative) | Tank steer + gas/brake | Soft aim + kick | Soft aim |
| Shift / second | Run | — | — | — |
| F / secondary | — | Brake | **Kickflip** | Brake |
| E / primary / Enter | Interact | Exit | Exit | Exit |
| Space | — | Handbrake | Exit | Exit |
| C / V / CAM | Cycle camera mode | same | same | same |
| Q / X | Snap 90° (iso) or orbit (chase/free) | same | same | same |
| R | Radio | | | |
| Esc / Tab | Pause | | | |

---

## 5. Explicit non-goals / deferred

- Do **not** swap to PlayCanvas / R3F / full Overdrive codebase.
- Do **not** re-add post smear “for PS2 vibe.”
- Overdrive **next levers** (not done): citymesh merge/instance (~10 draw calls), day/night emissive opacity dial, tile DDA LOS for heat.
- Character/ped redesign (stop “Minecraft person”) — not done; Overdrive peds are boxy too; better path is more ped detail in `gen/peds.js` later.
- True intersection pathfinding for pursuit — still simplified ring approach (see JANK).
- Mouse free-look FPS — out of scope.

---

## 6. How to extend buildings safely

1. Edit archetype in `data/blocks.json` (`massing`, `setback`, `cap`, `floors`).
2. Or add geometry helpers in `gen/buildings.js` (keep budgets in mind — `triBudget` is advisory; real cost is quads in MeshBuilder).
3. Reload world; use `?debug=1` if collision/wire tools needed (`engine/debug.js`).
4. Prefer **massing variety** over post effects for “less square.”

**Budget:** `world.json` → `render.budget` currently elevated (`triangles` ~90k, `drawCalls` ~140) after massing. If mobile chokes, reduce window `maxPlaced` in `addWindowGrid` or lower tower floors.

---

## 7. Tests / smoke

```bash
cd public/world
node tools/compliance-core.test.mjs
node tools/pursuit-core.test.mjs
node tools/mission-core.test.mjs
node tools/lot-placement.test.mjs
# browser smoke (needs server + env as script expects):
# node tools/onboarding-smoke.mjs
```

Building grammar has **no** dedicated unit test yet — visual reload is the check. Optional: seed-stable lot snapshot test later.

---

## 8. Merge / push notes for Codex

1. Work is in **worktree** `raffi-online-grok-pursuit`, not necessarily main checkout.
2. Push: `git push -u origin grok/camera-modes` (confirm with owner).
3. PR into site `main` should only touch `public/world/**` (+ any shell link if needed).
4. After merge, Vercel serves `public/world` as static under the Next app (existing pattern).
5. **Do not** commit secrets; none added in this arc.

---

## 9. Suggested next tickets (priority order)

1. **Perf pass (Overdrive citymesh ideas):** merge static opaque city; instance props — keep draw calls near budget after massing.
2. **Ped readability:** slightly less blocky player/NPC silhouette (`gen/peds.js`) without Minecraft nearest aesthetic.
3. **Night window dial:** single nightFactor lerping lit-window emissive opacity (Overdrive `setNight`) wired to grades.
4. **Building grammar tests:** seed → shell count / height for one archetype.
5. **Push + PR** `grok/camera-modes` when owner confirms look.

---

## 10. Quick “where is X?” index

| Feature | Start here |
|---|---|
| Building cubes → city | `gen/buildings.js`, `data/blocks.json` |
| Kickflip | `game/player.js` (`tryKickflip`), `engine/main.js` |
| Camera modes | `engine/camera.js`, `engine/main.js` |
| Movement axes | `camera.movementBasis`, `player.updateWalking/Driving` |
| Post / fog / res | `engine/post.js`, `engine/render.js`, `data/world.json` → `render` + `grades` |
| Atlas filter | `gen/atlas.js` |
| Pursuit / repaint | `game/pursuit*.js`, `game/compliance*.js` |
| Agent history | `HANDOFF.md`, this file |

---

*Archived for Codex continuity. Prefer editing generators + JSON over inventing a new renderer. When in doubt: InfiniTown massing + sharp post + camera-relative move is the locked aesthetic direction.*
