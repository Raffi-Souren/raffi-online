# RAFFI WORLD — Grok gameplay journey audit

**Date:** 2026-08-02  
**Branch / worktree:** `grok/world-gameplay-audit`  
**URL:** `/world/index.html?debug=1&auto=1&seed=FIXED`  
**Viewports:** desktop 1280×720 · touch 390×844 (`hasTouch` + `isMobile`)  
**Constraints honored:** no game code changes · fixed isometric camera left alone · no downloaded assets · no root audio / portfolio UI edits  

**Evidence method:** Chromium (Playwright) player-journey probe + existing `tools/onboarding-smoke.mjs` + visual review of captured frames. Screenshots retained under `/tmp/grok-world-audit/` for this session (not committed).

**Automated guards (this worktree):**

| Suite | Result |
|---|---|
| `node --test public/world/tools/lot-placement.test.mjs public/world/tools/mission-core.test.mjs` | **15/15 pass** |
| `RAFFI_WORLD_URL=…:3011/world/index.html node public/world/tools/onboarding-smoke.mjs` | **pass** (garage → board exit/remount → subway → DEAL CLOCK → mobile GAS/EXIT/HUD) |

---

## 1. Executive summary

The mobility + DEAL CLOCK vertical slice is **playable end-to-end** on desktop keyboard and on a 390×844 touch viewport. Spawn → walk → skateboard mount/exit/remount → scooter → car (when on foot) → Vantage Express → mission briefing → loaner → four unique stops → complete → timeout retry all succeed under `seed=FIXED`.

The biggest player-facing holes are not in vehicle physics; they are **dead pause-menu buttons**, **content still deferred by HANDOFF** (interiors, expressway, remaining missions, compliance clear, replay ghosts), and **district/night identity** that still reads more “empty PS2 plaza” than Vice City wet-neon in several grades.

**Severity counts in this audit:** 2 blocker · 8 visible · 5 charm · (plus deferred content notes).

---

## 2. Journey results (what works)

### 2.1 Desktop (1280×720)

| Step | Result | Notes |
|---|---|---|
| Boot `?debug=1&auto=1&seed=FIXED` | Pass | ~1.7s to first frame with draw calls; no page/console errors |
| Spawn position | Pass | Heights apartment spawn `(-450, -151)`; objective `CHOOSE A RIDE OR TAKE THE SUBWAY`; minimap **THE CRIB GARAGE · 14 M** |
| Walk (W) | Pass | ~2.9 m in 1.2 s |
| Run (Shift+W) | Pass | Faster than walk (~3.7 m / 0.7 s) |
| Camera Q / X | Pass | 90° yaw snaps (camera law intact) |
| Radio R | Pass | Station cycles; HUD radio unhides (`TLKR` observed) |
| Skateboard Space mount | Pass | Prompt `SPACE · RIDE SKATEBOARD` |
| Skateboard Space exit → remount | Pass | First press exits; second remounts same board |
| Skateboard W move | Pass | ~8 m / 1.5 s |
| Scooter Space mount / exit / remount | Pass | Prompt `SPACE · RIDE SCOOTER` |
| Grand tourer E mount / exit / remount | Pass* | *Confirmed on clean on-foot approach (onboarding smoke + mobile). Contaminated sequential run while still mounted on scooter produced false “car fail” — see G-08 |
| Car W drive | Pass | ~8 m / 1.5 s when correctly mounted |
| Space in car | Pass (smoke) | Handbrake path; does **not** eject (smoke asserts this) |
| Vantage Express (E at transit) | Pass | `#travel` overlay → land ≤8 m of DEAL CLOCK marker (`dist=7`) · destination copy `MISSION EXPRESS · DEAL CLOCK` |
| Mission start Space | Pass | Status `briefing` |
| Briefing two-press (E, E) | Pass | First E remains `briefing`; second → `active` · MANAGER / INCOMING CALL |
| Waypoint legibility | Pass | Minimap `DEAL CLOCK · STOP 1` … `STOP 4`; objective `DRIVE TO THE MARKER (n/4) · mm:ss` |
| Loaner mount GPS retention | Pass | Label unchanged across enter (`compact`) |
| Four unique vehicle stops | Pass | Completes; unlocks `crate-dig`; compliance tier **4** |
| Timeout → RETRY | Pass | Objective `RETRY · DEAL CLOCK`; re-brief works |
| Perf sample (spawn / garage) | Pass | ~15–16 draws, ~37–44k tris (under 120 / 60k) |

### 2.2 Touch (390×844)

| Step | Result | Notes |
|---|---|---|
| Touch chrome visible | Pass | `#touch` not hidden; stick + RUN / RADIO / CAM |
| HUD in bounds | Pass | Minimap, objective, compliance, dialogue, buttons stay inside 390×844 |
| Prompt vs primary overlap | Pass | No rect overlap at skateboard |
| Board tap mount / EXIT / remount | Pass | EXIT visible while mounted; primary becomes **KICK** |
| Hold KICK throttle | Pass | ~5 m / 1 s; stays mounted |
| Scooter / grand-tourer tap | Pass | Car shows **GAS / BRAKE / DRIFT / EXIT** |
| Nonblocking mentor caption while mounted | Pass | Does not force dialogue mode; GAS remains |
| Blocking briefing | Pass | `#touch.dialogue`, single **NEXT**, caption above button |
| Subway tap | Pass | Travel + arrive dist 7 m |
| Mission activate via NEXT | Pass | `STOP 1` label |
| CAM / RADIO | Pass | Radio unhides after RADIO tap |

---

## 3. Control matrix (observed)

### Desktop keyboard

| Input | Affordance | Live? |
|---|---|---|
| WASD / arrows | Move on foot; steer / throttle when mounted | Yes |
| Shift | Run on foot | Yes |
| Space | Enter/exit skateboard & scooter; handbrake in car; also fires on-foot context (transit/mission/enter if Space-mapped) | Yes |
| E / Enter | Enter/exit cars; transit; mission start; dialogue advance | Yes |
| R | Cycle radio | Yes |
| Q / X | Snap camera ±90° | Yes |
| Tab / Esc | Toggle pause overlay | Yes (toggle only) |
| F | Secondary mapping | Present in `input.js` |
| M | Map key mapping | Present; no full map UI |
| Debug F/G/C/V (`?debug=1`) | Fly / wire / collide / grade via debug panel | Yes |

### Touch (390×844)

| Control | Affordance | Live? |
|---|---|---|
| Virtual stick | Move / steer | Yes |
| Primary (`#btn-action`) | Context: RIDE / ENTER / KICK / GAS / SUBWAY / NEXT | Yes |
| RUN (`#btn-second`) | Run on foot; BRAKE when mounted | Yes |
| RADIO | Cycle station | Yes |
| CAM | Rotate view on foot; DRIFT label when mounted | Yes |
| EXIT | Dismount | Yes (hidden on foot) |

### Pause panel (`#pause`)

| Button | Live? |
|---|---|
| RESUME | **No click handler** — only Tab/Esc toggles `state.paused` |
| REWIND — last 90s with ghosts | **Dead** (no `game/replay.js`) |
| COLOUR GRADE: AUTO | **Dead** |
| MAP | **Dead** |
| QUIT TO DESKTOP | **Dead** (no navigation / postMessage) |

Owning fact: `engine/main.js` only toggles pause on `consume('pause')`. There is **no** `data-pause` listener anywhere under `public/world/`.

---

## 4. Issues

Severity: `blocker` must fix · `visible` should fix · `charm` can ship.

### G-01 — Pause menu buttons are completely inert

| Field | Detail |
|---|---|
| **Reproduction** | Open `?debug=1&auto=1&seed=FIXED`. Press **Tab**. Click RESUME, REWIND, COLOUR GRADE, MAP, or QUIT. |
| **Expected** | RESUME unpauses; other items either work or show an honest “coming soon” state. |
| **Actual** | Clicks do nothing. Only Tab/Esc toggles pause. Players who click RESUME stay paused forever. |
| **Severity** | **blocker** (trap for anyone who uses the visible UI) |
| **Likely owner** | `engine/main.js` (wire `click` on `#pause [data-pause]`), stubs in future `game/replay.js` |
| **Smallest safe fix** | On boot, delegate clicks: `resume` → `state.paused=false` + hide panel; `grade` → cycle `requestGrade`; `rewind`/`map`/`quit` → `toast('Coming soon')` until implemented. Do **not** invent replay math. |

### G-02 — REWIND / MAP / QUIT are authored chrome for unimplemented systems

| Field | Detail |
|---|---|
| **Reproduction** | Pause menu (G-01). Read button labels vs WORLD-BIBLE §§7–8. |
| **Expected** | Either working systems or labeled unavailable. |
| **Actual** | Labels promise ghosts, map, desktop quit; none exist. |
| **Severity** | **visible** (honesty / trust) |
| **Likely owner** | `index.html` pause markup + `engine/main.js` |
| **Smallest safe fix** | Rename to `REWIND (SOON)` / disable buttons via `disabled` + opacity until Phase 4/5, or route to toast. |

### G-03 — COMPLIANCE rises to tier 4 with no clear path

| Field | Detail |
|---|---|
| **Reproduction** | Complete DEAL CLOCK (four stops). Observe top-right COMPLIANCE pips. |
| **Expected** | Bible: clear at **Reply All Repaint** by parking; pursuers / comedy loop. |
| **Actual** | Tier jumps to 4 on success; no repaint shop interaction, no pursuers, no clear affordance. Feels like a stuck wanted meter. |
| **Severity** | **visible** |
| **Likely owner** | `game/missions.js` reward compliance; missing `game/compliance.js` / landmark interact |
| **Smallest safe fix** | After mission win, either don’t raise tier until pursuers exist, **or** spawn a single “Reply All Repaint” marker that sets tier 0 on enter-radius + E/tap. |

### G-04 — District / night identity still under-authored (Vice City readability)

| Field | Detail |
|---|---|
| **Reproduction** | `setGrade('night'|'haze'|'dusk')` at garage, downtown campus, strip record-store approaches. Compare to bible grades. |
| **Expected** | Night = wet asphalt + neon; Strip storefronts read without relying on one camera snap; Downtown plaza has entrance language. |
| **Actual** | Roads/fog can read well (teal night asphalt in places) but large beige plazas, sparse props, and weak storefront silhouette remain — consistent with `JANK.md` Phase 2/3 deferrals. Player cyan ring helps, but the **city** still under-sells PS2 crime-city energy. |
| **Severity** | **visible** |
| **Likely owner** | `gen/world.js`, `gen/props.js`, `data/blocks.json` / landmarks — **not** camera |
| **Smallest safe fix** | Content pass only: Strip neon signs + lot stripes; Downtown plaza bands/planters; keep faceted stadium as charm. No camera changes. |

### G-05 — `?auto=1` skips the desktop control toast

| Field | Detail |
|---|---|
| **Reproduction** | Compare boot with and without `auto=1`. |
| **Expected** | First-run hint `WASD / stick to move · E to interact` (or debug equivalent). |
| **Actual** | `startGame()` only toasts when `!query.auto`. Automation/debug URL never teaches controls. |
| **Severity** | **visible** (for reviewers using the audit URL; milder for production START button) |
| **Likely owner** | `engine/main.js` `startGame` |
| **Smallest safe fix** | Always toast once, or toast when `debug=1` even if `auto=1`. |

### G-06 — Mobile primary button is unlabeled when context is `none`

| Field | Detail |
|---|---|
| **Reproduction** | 390×844 spawn away from rides. Inspect primary control. |
| **Expected** | Hidden primary, or clear disabled state. |
| **Actual** | Large primary circle remains; label can read as empty/`—` while RUN/RADIO/CAM stay labeled. Looks like a dead GAS pedal. |
| **Severity** | **visible** |
| **Likely owner** | `engine/main.js` `setActionLabel` / `style.css` `#btn-action` |
| **Smallest safe fix** | When `ctx.kind === 'none'` and on foot, hide primary or set label `·` with reduced opacity (keep layout stable). |

### G-07 — Clock shows `--:--` until the first 30-frame HUD tick

| Field | Detail |
|---|---|
| **Reproduction** | Capture first mobile frame after ready. |
| **Expected** | Immediate system time. |
| **Actual** | `#clock` is `--:--` until `state.frame % 30 === 0` in `game/hud.js`. |
| **Severity** | **charm** |
| **Likely owner** | `game/hud.js` `updateHud` |
| **Smallest safe fix** | Set clock once in `initHud` / first `updateHud` without modulo gate. |

### G-08 — Teleport-while-mounted confuses ride context (audit + edge case)

| Field | Detail |
|---|---|
| **Reproduction** | Mount scooter, then `RAFFI_WORLD.teleport` to grand-tourer coords without exiting. |
| **Expected** | Debug teleport either exits first or moves the active vehicle. |
| **Actual** | Player state coords jump; still “on scooter”; prompts show EXIT SCOOTER on the car pad → false car-mount failures in naive audits. |
| **Severity** | **charm** for players (rare without debug); **visible** for harness authors |
| **Likely owner** | `engine/debug.js` `teleport` + `game/player.js` |
| **Smallest safe fix** | `teleport()` calls `exitVehicle()` when mounted, then moves on foot. |

### G-09 — Long open-world GPS after leaving the crib lesson

| Field | Detail |
|---|---|
| **Reproduction** | Mount crib car after onboarding objective flips to `GO TO · DEAL CLOCK` without subway. Minimap distance ~900 m+. |
| **Expected** | Still fine if subway is taught; risky if player never sees Express. |
| **Actual** | Waypoint is correct but the surface drive is long; subway remains the intended fast path (smoke teaches it). |
| **Severity** | **charm** (design), watch for soft-lock confusion |
| **Likely owner** | Onboarding copy in `data/dialogue.json` / objective strings |
| **Smallest safe fix** | Keep objective text mentioning subway until first Express ride completes (`TAKE VANTAGE EXPRESS · DEAL CLOCK`). |

### G-10 — Remaining seven missions are data-only

| Field | Detail |
|---|---|
| **Reproduction** | Complete DEAL CLOCK; note unlock `crate-dig`. Attempt CRATE DIG / SET TIME / etc. |
| **Expected** | Next mission playable or clearly gated. |
| **Actual** | HANDOFF: only DEAL CLOCK mechanics are real; other objective kinds incomplete. |
| **Severity** | **visible** (content gap, expected) |
| **Likely owner** | `game/missions.js`, `game/mission-core.js`, interiors |
| **Smallest safe fix** | Implement CRATE DIG `collect` only (data already authored) before marketing multi-mission progress. |

### G-11 — Pause freezes simulation but not all HUD/debug layers

| Field | Detail |
|---|---|
| **Reproduction** | Pause with Tab; observe debug readout / radio toast still updating in places; world movement stops. |
| **Expected** | Clear frozen world; resume path obvious. |
| **Actual** | Movement/interact stop (good) but RESUME click dead (G-01) makes freeze feel like a hang. |
| **Severity** | **visible** (compound of G-01) |
| **Likely owner** | `engine/main.js` loop structure |
| **Smallest safe fix** | Fix G-01; optionally dim canvas via CSS when paused. |

### G-12 — No NPCs / traffic / radio audio (bible systems missing)

| Field | Detail |
|---|---|
| **Reproduction** | Drive Heights → Downtown; listen; watch sidewalks. |
| **Expected** | Ped density, parked+moving traffic budget, music-reactive city. |
| **Actual** | City mostly empty; radio is station metadata/BPM only (by design of `radio.json`). |
| **Severity** | **charm** for v1 slice; **visible** vs full bible pitch |
| **Likely owner** | `gen/peds.js` spawn, `engine/main.js` traffic, future `engine/audio.js` |
| **Smallest safe fix** | Low ped budget near Downtown only; no new assets. |

### G-13 — Interiors and expressway still absent

| Field | Detail |
|---|---|
| **Reproduction** | Walk campus lobby door / club door / stadium pitch roles. |
| **Expected** | Enterable mainframe / club / pitch; elevated expressway ring. |
| **Actual** | Declared in `data/world.json`; no scene. Matches HANDOFF deferred list. |
| **Severity** | **visible** (content) |
| **Likely owner** | `gen/world.js` interiors, expressway mesher |
| **Smallest safe fix** | One interior (campus lobby → stub mainframe) before more exterior districts. |

### G-14 — Blocking dialogue typewriter can look “stuck” for one frame

| Field | Detail |
|---|---|
| **Reproduction** | Start DEAL CLOCK; screenshot mid-typewriter (`Four lo…`). |
| **Expected** | Players understand text is animating; NEXT advances/reveals. |
| **Actual** | Works, but first-time players may tap NEXT too early; desktop needs **two** E presses. Mobile NEXT is clearer. |
| **Severity** | **charm** |
| **Likely owner** | `game/dialogue.js` |
| **Smallest safe fix** | Keep two-press desktop contract; ensure NEXT label stays until line complete (already mostly true). |

### G-15 — Strip / hero landmarks still camera-snap sensitive

| Field | Detail |
|---|---|
| **Reproduction** | Approach record store / club; rotate Q through four yaws. |
| **Expected** | Entrance readable on at least two snaps without roof domination. |
| **Actual** | Matches prior `JANK.md` (roofs dominate some approaches). Not re-broken by mobility. |
| **Severity** | **visible** |
| **Likely owner** | Landmark mesh props / signage height in `gen/world.js` |
| **Smallest safe fix** | Permanent vertical neon blade signs on Strip heroes (still generated geometry). |

---

## 5. Visual hierarchy notes (PS2 / Vice City)

| Element | Readability | Comment |
|---|---|---|
| Player ped + cyan locator | Strong | Locator solves lost-player; slightly “UI in world” (PREDICTED-JANK #16 charm) |
| Objective / district backplates | Strong | Translucent plates hold contrast over pale roofs |
| COMPLIANCE pips | Strong when filled; empty pips quiet | Tier 4 after mission is alarming without clear (G-03) |
| Minimap ring + route | Strong | Round map, N marker, distance, stop labels legible on mobile |
| Interaction prompt | Strong on desktop | Key chip + label |
| Touch stack | Good when labeled | Weak when primary is empty (G-06) |
| Dusk grade | Good magenta/amber mood | Garage bay lines readable after Phase 3 pad fix |
| Haze grade | Dusty, slightly washed plazas | Acceptable midday |
| Night grade | Mixed | Good teal roads in places; large sand plazas lack neon density |
| Fog / dither / 512×288 | On-brief | PS2 nearest upscale + Bayer; keep |

---

## 6. Collision / stuck / obstruction

| Probe | Result |
|---|---|
| Spawn walk all four directions | Free |
| Garage pad rides | Enter radii OK; no permanent trap observed when on foot |
| Yards / strip / bowl / bridge teleports on **foot** | Free movement when not left mounted in a vehicle (G-08 false stucks discarded) |
| Camera obstruction | Fixed iso still hides some facades on one yaw (G-15); not a new regression |
| Budget traps | No draw/triangle budget breach in journey samples |

No collision soft-lock found on the crib → Express → DEAL CLOCK happy path.

---

## 7. Suggested fix order (smallest leverage first)

1. **G-01 / G-02** — Wire pause button clicks + honest “soon” labels (hour).  
2. **G-05 / G-06 / G-07** — Toast, empty primary, clock init (hour).  
3. **G-03** — Don’t strand COMPLIANCE at 4 without a clear (half day).  
4. **G-08** — `teleport` exits vehicle (minutes; helps all future audits).  
5. **G-04 / G-15** — Strip/Downtown identity content pass (multi-day, no camera law change).  
6. **G-10** — CRATE DIG collect loop as second mission.  
7. **G-13 / G-12** — Interiors / peds as Phase 3–4 resume per HANDOFF.

---

## 8. Explicit non-goals (per instructions)

- Did **not** change fixed isometric camera pitch/yaw/orbit rules.  
- Did **not** add downloaded meshes, textures, or audio.  
- Did **not** touch root `data/audio-library.ts`, crates, or portfolio XP shell.  
- Did **not** implement fixes in this pass — documentation only.

---

## 9. Appendix — reproduction commands

```bash
# from repo (world served as static files by Next)
npm run dev -- -p 3011
open 'http://127.0.0.1:3011/world/index.html?debug=1&auto=1&seed=FIXED'

# unit guards
node --test public/world/tools/lot-placement.test.mjs public/world/tools/mission-core.test.mjs

# browser smoke (requires Playwright browsers)
RAFFI_WORLD_URL=http://127.0.0.1:3011/world/index.html \
  node public/world/tools/onboarding-smoke.mjs
```

**Debug API used:** `window.RAFFI_WORLD.ready`, `.teleport`, `.getState`, `.stats`, `.missionSnapshot`, `.getWaypoint`, `.setGrade`, `.dismissDialogue`.

---

*End of audit.*
