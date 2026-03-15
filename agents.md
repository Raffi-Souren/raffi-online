# agents.md

> Guidelines for AI coding agents working on this project (Claude Code, Cursor, v0.app, Copilot, etc.)

## Project Overview

Windows XP-themed personal portfolio site for Raffi Khatchadourian — Field CTO, DJ, and entrepreneur based in Brooklyn, NY. Live at [raffi.computer](https://raffi.computer).

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict — checked during builds)
- **Styling:** Tailwind CSS + inline styles
- **Hosting:** Vercel (auto-deploys from `main`)
- **Package manager:** npm

## Build and Test Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server at localhost:3000
npm run build        # production build — runs TypeScript + ESLint checks
npm run lint         # lint only
```

**Always run `npm run build` before pushing.** The build will catch type errors, missing imports, and lint issues. If the build fails, do not push.

## Code Style Guidelines

- No `console.log` in production code
- No `"latest"` in package.json — always pin dependencies with `^x.y.z`
- Use `lucide-react` for icons (already installed)
- Prefer editing existing files over creating new ones
- Do not create documentation files unless explicitly asked

### Styling Conventions

This project uses **both inline styles and Tailwind CSS**. They serve different purposes:

- **Inline styles** = source of truth for layout-critical properties (position, z-index, dimensions, colors). These were verified working in production.
- **Tailwind classes** = interactive states only (hover, focus, transitions, animations, responsive). Inline styles can't handle pseudo-classes.

**Rules:**
- Do not duplicate the same property in both inline style and className
- When adding new elements, pick one approach and be consistent
- If unsure, use inline styles — they're what's been verified working
- Never remove inline styles in favor of Tailwind without testing

## Architecture

```
app/
  page.tsx                — Main desktop, manages all window open/close state
  layout.tsx              — Root layout, AudioProvider, metadata (domain: raffi.computer)
  context/AudioContext.tsx — Global audio state for SoundCloud playback
  components/             — All feature components (windows, taskbar, games, etc.)
  api/scores/             — Game leaderboard API (Neon Postgres)
  api/soundcloud/         — SoundCloud API proxy
components/
  ui/                     — Shared UI primitives (WindowShell, DesktopIcon, StartMenu, Button, etc.)
  easter/                 — QuestionBlock easter egg
data/
  articles.json           — Notes window article content
  crates-tracks.ts        — 233 SoundCloud tracks for DiggingInTheCrates
```

### Key Components

| Component | File | Notes |
|---|---|---|
| WindowShell | `components/ui/WindowShell.tsx` | **Canonical** window wrapper. Blue title bar, ESC-to-close, focus trap, scroll lock. All windows use this. |
| Taskbar | `app/components/Taskbar.tsx` | Fixed bottom bar. Start button, quick launch, window list, clock. |
| DesktopIcon | `components/ui/DesktopIcon.tsx` | Desktop shortcut buttons. Pure inline styles. |
| StartMenu | `components/ui/StartMenu.tsx` | Start menu overlay. Pure inline styles. |
| DiggingInTheCrates | `app/components/DiggingInTheCrates.tsx` | SoundCloud player. Track data lives in `data/crates-tracks.ts`. |
| GameSelector | `app/components/GameSelector.tsx` | Game launcher hub. |
| AboutWindow | `app/components/AboutWindow.tsx` | Bio + Vimeo keynote embeds. |
| BlogrollWindow | `app/components/BlogrollWindow.tsx` | Curated links with search/filter. |
| NotesWindow | `app/components/NotesWindow.tsx` | Articles from `data/articles.json`. |
| IPodWindow | `app/components/IPodWindow.tsx` | iPod-style music player. |
| ProjectsWindow | `app/components/ProjectsWindow.tsx` | Portfolio project cards. |
| QuestionBlock | `components/easter/QuestionBlock.tsx` | Mario easter egg — opens DiggingInTheCrates. |
| NowPlaying | `app/components/NowPlaying.tsx` | Floating "now playing" widget. |

## Security Considerations

- Do not commit `.env` files or credentials
- The Neon database connection string is in Vercel environment variables, not in code
- CSP headers are configured in `next.config.mjs` — update them if adding new iframe sources

## Things That Will Break If You Delete Them

These components look unused at first glance but **are imported by game components**:

- `app/components/GameControls.tsx` — used by Brickbreaker
- `app/components/GameOverScreen.tsx` — used by Brickbreaker and ParachuteGame
- `app/components/LevelSelector.tsx` — used by Brickbreaker
- `app/components/Leaderboard.tsx` — used by Brickbreaker and ParachuteGame
- `app/components/RetroEmulator.tsx` — used by `app/games/emulator/page.tsx`

**Do not delete these.** Run `npm run build` to verify before removing any component.

## Adding Content

### New blogroll entry
Add to `blogrollItems` array in `app/components/BlogrollWindow.tsx` with the next sequential `id`.

### New article/note
Add to `data/articles.json`.

### New SoundCloud track
Add to `SOUNDCLOUD_TRACKS` array in `data/crates-tracks.ts` with `{ id, title, artist, url }`.

### New desktop icon + window
1. Create window component in `app/components/`
2. Add to `openWindows` state in `app/page.tsx`
3. Add `<DesktopIcon>` in the desktop grid
4. Add the window render block in `app/page.tsx`

## PR and Commit Guidelines

- Commit messages: lowercase, imperative (`feat: add X`, `fix: resolve Y`, `chore: clean up Z`)
- For content-only changes (blogroll, articles, tracks): commit directly to `main`
- For feature changes: use a short-lived branch, merge within 1-2 days
- Always verify `npm run build` passes before merging

## Dependencies

| Package | Purpose | Notes |
|---|---|---|
| `three` | 3D rendering for MinecraftGame | Types in `@types/three`. Import OrbitControls with `.js` extension. |
| `@neondatabase/serverless` | Game leaderboard database | Connection string in Vercel env vars |
| `react-player` | Video playback | Used in IPodWindow |
| `lucide-react` | Icons | Used throughout all components |
| `@radix-ui/react-slot` | Slot primitive | Used by shadcn Button component |
| `@vercel/analytics` | Web analytics | Auto-loaded in layout.tsx |

## v0.app-Specific Notes

If using v0.app to make changes:

- v0 may auto-commit "cleanup" or "refactor" changes alongside your actual change. **Review every file in the diff** before merging — v0 has previously tried to delete components that are actually in use.
- v0 PRs that touch more files than expected should be closed. Cherry-pick only the content change into `main`.
- After merging a v0 PR, always run `npm run build` locally to verify nothing broke.
