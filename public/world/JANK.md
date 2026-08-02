# RAFFI WORLD — Jank Log

Severity: `blocker` must be fixed · `visible` should be fixed · `charm` ships.

## Phase 2 — first rendered audit

The baseline and final audits each reviewed 60 deterministic frames: four
positions in every district across dusk, haze, and night. The final report is
`audit/phase2-final/report.json`: 60/60 captures, 0 errors, 0 budget violations,
maximum 14 draw calls and 47,557 visible triangles.

| Screenshot | Issue | Severity | Fixed |
|---|---|---|---|
| `phase2/01–20` (all dusk) | Fog began in front of the orthographic focus plane, collapsing the city into one rose value. | visible | Yes — fixed fog distances, selective tint masks, and the output colour-space pipeline. |
| `phase2/21–40` (all haze) | Raw sRGB vertex colours and a missing final sRGB conversion made textured surfaces muddy while the player looked comparatively correct. | blocker | Yes — vertex colours are linearized and the post pass performs the final display conversion. |
| `phase2/41–60` (all night) | Cobalt fog and global tinting erased facade, road, vegetation, and vehicle colour identity. | visible | Yes — fog is depth-aware from the fixed camera and tinting is restricted to actual shadows/highlights. |
| `phase2/22–60` | Debug fly teleport moved state/camera but left the visible player mesh at the first capture. | blocker | Yes — audit teleports now synchronize the actor transform. |
| `phase2/23`, `26`, `29`, `30`, `38` | One camera yaw hid the bridge, lobby, record store, club, and ramp behind foreground roofs. | blocker (audit) | Yes — the four inspection positions now exercise all four legal 90° camera snaps. |
| `phase2/39`, `59` | The exterior audit treated the future stadium-pitch interior coordinate as a Phase 2 view. | visible (audit) | Yes — interior-role spawns are excluded until the interior exists. |
| `phase2/contact-sheet.png` | A transient district toast covered the focal point in every capture. | visible (audit) | Yes — transient toast/subtitle layers are suppressed only in the audit harness. |
| `phase2/report.json` | Browser requested a missing favicon. | visible | Yes — the static game now declares its generated SVG icon. |
| `phase2-final/05`, `06`, `08` | Downtown campus/lobby plazas are structurally clean but broad and under-authored. | visible | No — defer paving bands, planters, and entrance identity to the Phase 3 content pass. |
| `phase2-final/09`, `10` | Strip hero storefronts still depend on camera snap for their entrances to read; roofs dominate two approaches. | visible | No — strengthen permanent facade/sign cues without breaking the fixed camera. |
| `phase2-final/11` | The major Strip vehicle lot lacks an unmistakable parking surface/stripe language. | visible | No — Phase 3 content pass. |
| `phase2-final/13`, `16` | The Yards gate and outer lot are correctly open but need stronger crane/container/rail silhouettes. | visible | No — Phase 3 district-identity pass. |
| `phase2-final/17–20` | Bowl exterior has little tailgate identity; ramp and future interior are not yet readable as destinations. | visible | No — Phase 3 stadium/interior work. |
| `phase2-final/18`, `20` | The stadium’s 22-box ring has a faceted outer seam. Collision remains continuous. | charm | Intentionally kept; clean PS2 geometry, not a gap blocker. |
| `phase2-final/contact-sheet.png` | Ground texture remains visibly coarse and patterned in the widest empty lots. | charm→visible | Keep for now; reassess after props/traffic give the spaces scale. |

No reviewed Phase 2 frame showed a building in a road, backward facade,
floating building, broken intersection, duplicate border streetlight, or HUD
outside the viewport. Vehicle enter → drive → exit also passed in the Yards.

## Phase 3 — mobility and first mission slice

The final mobility audit reviewed another 60 deterministic district/grade
frames at `audit/phase3-final/`: 60/60 captures, 0 browser errors, maximum 16
draw calls and 47,737 visible triangles. A separate desktop/mobile onboarding
smoke drove the crib garage, skateboard, subway, dialogue, DEAL CLOCK, and
touch-only vehicle controls.

| Screenshot | Issue | Severity | Fixed |
|---|---|---|---|
| `phase3-mobility/01`, `21`, `41` | The garage pad multiplied a dark vertex tint by the blue-slate road texture, crushing the three vehicle bays nearly to black. | visible | Yes — the pad now preserves the authored asphalt colour and neon bay lines. |
| `phase3-mobility/contact-sheet.png` | Dark facade faces lost their palette identity while pale roofs dominated the frame. | visible | Yes — lifted the baked fill/AO floor without adding realtime lights or a global colour wash. |
| `onboarding-smoke/mobile` | The player remained only a few pixels tall and competed with the garage lane paint. | blocker (readability) | Yes — a small cyan world-space locator follows foot, board, scooter, and car, including through foreground occlusion. |
| `onboarding-smoke/mobile` | RUN/RADIO/CAM remained visible around a blocking caption and NEXT looked like throttle. | visible | Yes — dialogue mode exposes one smaller cyan NEXT control; a permanent bounds/visibility smoke guards it. |
| Mobile ride caption | Treating every visible caption as blocking briefly changed KICK/GAS to NEXT and hid driving controls while the mission timer continued. | blocker | Yes — only blocking dialogue owns input; the smoke holds throttle and proves the board moves during a live manager caption. |
| `onboarding-smoke/mobile` | The interaction prompt and touch action occupied the same screen lane. | visible | Yes — the browser guard now checks actual rectangle intersection rather than assuming one fixed ordering. |
| `onboarding-smoke/desktop` | A reward-unlock toast and the manager call appeared simultaneously. | visible | Yes — HUD toasts queue until the active conversation closes. |
| `onboarding-smoke/mobile` | COMPLIANCE and the current objective lost contrast over pale roofs. | visible | Yes — compact translucent HUD backplates retain the district accents. |
| DEAL CLOCK loaner entry | Entering the mission car reset the GPS from STOP 1 back to the start marker while leaving the active objective text in place. | blocker | Yes — active missions retain their current waypoint; the browser smoke asserts the label before and after mounting. |
| Immediate ride exit/remount | EXIT appeared as soon as a ride mounted, but a 400ms transition lock consumed and discarded the first exit press and then the first remount press. | blocker | Yes — context inputs are already edge-triggered, so the obsolete lock is removed and the complete board/car/touch cycle is browser-guarded. |
| Mounted desktop car | The car supported E-to-exit but hid every mounted keyboard prompt; Space remained the handbrake, making the car appear inescapable. | blocker (affordance) | Yes — cars keep `E · EXIT` visible; skateboard/scooter show `SPACE / E · EXIT`. |
| Moving ride exit | On-foot state inherited vehicle velocity, and the fixed exit side could place the player into nearby static geometry, carrying or ejecting them beyond remount range. | blocker | Yes — dismount clears motion and picks the less-obstructed collision-resolved side. Moving board and car remounts are browser-guarded. |
| Pause overlay | All five visible pause buttons accepted focus/clicks but had no handlers; RESUME left the game silently trapped in paused state. | blocker | Yes — RESUME and Escape share one state transition; keyboard focus stays inside the live controls. |
| Pause promises | REWIND, MAP, and QUIT advertised systems whose replay math, full map, and XP shell contract do not exist yet. | visible (trust) | Yes — unavailable actions are disabled and honestly labeled COMING SOON; no fake replay percentages or guessed navigation were added. |
| Touch pause | The mobile-first build had no touch affordance capable of opening pause. | blocker | Yes — a safe-area-aware PAUSE control opens the same bounded modal; the 390×844 browser guard taps PAUSE and RESUME through live state. |
| Fresh mobile boot | The previous mission dot was over 500m from the crib with no transport lesson. | blocker | Yes — the opening route is now 14m to a garage with skateboard, scooter, grand tourer, and mission-express subway. |
| `phase3-final/01`, `21`, `41` | The subway stair mouth is deliberately much darker than the surrounding pavement. | charm | Kept — the bright VANTAGE EXPRESS sign and interaction prompt make the entrance legible. |
| `phase3-final/05–20` | Downtown, Strip, Yards, and Bowl identity gaps from Phase 2 remain visible. | visible | Deferred to the original Phase 3 district/interior content work; mobility did not paper over them. |

No reviewed Phase 3 frame showed an off-screen HUD, unreadable route, hidden
controlled actor, broken garage spawn, or budget breach. The first playable
mission also mutation-failed by name when its on-foot, unique-stop, and
briefing-timer guards were deliberately removed, then passed after restoration.
The ride-cycle guard likewise failed by name when a dropped board was
deliberately left occupied, then passed after the production state was restored.

## Phase 3b — Reply All Repaint compliance clear

Browser smoke screenshots (not committed): `/tmp/raffi-world-repaint/raffi-world-repaint-{desktop,mobile}-{dusk,night}.png`
at the Heights shop (`repaint-heights`, seed=FIXED). Budgets on those frames:
12–14 draw calls, ~29–30k visible triangles.

| Screenshot | Issue | Severity | Fixed |
|---|---|---|---|
| `repaint-desktop-dusk/night` | Dark asphalt bay pad + cyan player locator read clearly; `REPLY ALL REPAINT` minimap label routes heat without mission waypoint stomps. | — | Yes (behavior) |
| `repaint-desktop-dusk/night` | The generated `repaint-sign` is a thin pole + board that is easy to miss under fixed iso when a mentor caption covers the lower third; bay pad colour is the stronger landmark. | visible | No — content: raise sign, add bay stripes, or ground decal text without new assets |
| `repaint-mobile-dusk/night` | After clear, minimap returns to FREE ROAM; COMPLIANCE pips empty. Touch GAS/BRAKE/EXIT remain usable. Shop sign often off-frame on 390×844 because the camera follows the car on the pad. | charm→visible | No — optional slight look-ahead toward shop sign while latched; camera law unchanged |
| `repaint-desktop-*` | Mentor ride caption can still cover the bay while parked (nonblocking). | charm | Kept — does not steal throttle or block clear |
| Compliance clear SFX | `radio.json` defines `compliance-clear` metadata but no audio engine plays it yet. | charm | Deferred with radio/audio phase |
| G-03 (gameplay audit) | COMPLIANCE could stick at tier 4 with no clear path. | visible | Yes — Reply All Repaint loop ships |

No repaint frame breached the 120 draw-call / 60k triangle budgets. On-foot and
high-speed negatives are browser-guarded; mounted-only and tier-reset rules are
mutation-tested in `compliance-core.test.mjs`.
