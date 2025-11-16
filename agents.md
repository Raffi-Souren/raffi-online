# Project Diagnostic and Resolution Plan

## Project Overview
Windows XP-themed portfolio website for Raffi Souren Khatchadourian
- **Working Version**: v237 (last known stable production deployment)
- **Current Version**: v273+ (broken in production, works in preview)
- **Critical Requirement**: Professional presentation at ACM conference in Singapore

## Windows XP Design Principles (Day 1 Aesthetic)

### Core Visual Elements
1. **Luna Theme**: Blue/green color scheme with glossy taskbar
2. **Desktop Icons**: Classic Windows XP icon layout with text labels below
3. **Windows**: Blue title bars with close/minimize/maximize buttons
4. **Taskbar**: Green "Start" button, system tray, clock at bottom
5. **Backgrounds**: Bliss wallpaper aesthetic (blue sky with clouds)

### Key Components That Must Preserve XP Feel
- `components/ui/DesktopIcon.tsx` - Desktop icon styling
- `components/ui/WindowShell.tsx` - Window chrome and title bars
- `components/ui/Taskbar.tsx` - Bottom taskbar with Start button
- `components/easter/QuestionBlock.tsx` - Easter egg element
- `app/globals.css` - Windows XP theme colors and fonts

## Current State Analysis

### What Works (Preview Environment)
- All desktop icons visible (About, Blogroll, Games, Notes, Pitch Startup)
- Taskbar displays correctly at bottom
- Windows open/close properly
- Question mark easter egg visible
- Responsive interactions

### What's Broken (Production Environment)
1. **Desktop icons disappear**: Icons appear as text briefly, then vanish
2. **Colored rectangles**: Orange and green overlays covering screen
3. **Missing taskbar**: Bottom bar not rendering
4. **Only 2 elements show**: Question mark box and Windows logo

## Root Cause Investigation

### Phase 1: Identify What Changed from v237 to v238+

#### Changes Requested
1. Update AboutWindow with "Field CTO and Technology Leader at IBM" title
2. Add ACM ICAIF keynote video to AboutWindow
3. Add new LinkedIn articles to NotesWindow (v9, v10)
4. Add LLM Output Drift paper to research papers
5. Move "Building Gen AI for Capital Markets" to previous events

#### Changes Made That Broke Production
1. **Cheerio dependency issue**: Import of cheerio in lib/soundcloud.ts
   - Cheerio 1.1.2 depends on undici with private class fields
   - Next.js 14.0.0 webpack cannot compile private class fields
   - **Fix Applied**: Removed cheerio, replaced with fetch + regex

2. **Invalid WindowShell props**: EasterEgg component passing `isOpen` prop
   - WindowShell interface doesn't accept `isOpen` prop
   - Caused React errors in production
   - **Fix Applied**: Changed to conditional render pattern

3. **Duplicate WindowShell components**: Two versions existed
   - `app/components/WindowShell.tsx` (dark theme, z-1000)
   - `components/ui/WindowShell.tsx` (blue theme, z-50)
   - Caused confusion and rendering conflicts
   - **Fix Applied**: Deleted duplicate, consolidated to one version

4. **Z-index layering issues**: Complex stacking contexts
   - Desktop icons at z-10
   - Windows at z-50, then z-100, then z-1000 (changed multiple times)
   - Taskbar at z-50, then z-200
   - Inconsistent use of Tailwind classes vs inline styles
   - **Fix Applied**: Standardized to inline styles with clear hierarchy

5. **Cache-busting attempts**: Added version metadata, build IDs, cache headers
   - Added complexity without solving core issue
   - Version overlays, test banners cluttering UI
   - **Fix Applied**: Removed all cache-busting code

6. **Debug console.log statements**: Embedded in JSX
   - Console.log in JSX returns undefined
   - React evaluates these on every render
   - In production mode, triggers infinite re-render loops
   - **Fix Applied**: Removed all debug statements

### Phase 2: Preview vs Production Differences

#### Build Environment Differences
- **Preview**: Development mode, faster refresh, looser optimizations
- **Production**: Minified, optimized, stricter error handling, React StrictMode

#### React Hydration Mismatches
- Server renders HTML on first load
- Client JavaScript "hydrates" the HTML to make it interactive
- If server HTML ≠ client HTML, React throws hydration error
- In production, hydration errors can cause silent failures

#### Common Causes of Preview/Production Discrepancies
1. **Environment variables**: Different values or missing in production
2. **Timing issues**: useEffect hooks, async operations
3. **Browser APIs**: window, document, localStorage only available client-side
4. **CSS conflicts**: Tailwind purging, CSS-in-JS, specificity wars
5. **Dependency versions**: Different resolution between environments
6. **Error boundaries**: Production swallows errors that preview shows

### Phase 3: Current Production Failure Pattern

#### Observable Symptoms
1. **Initial render**: Desktop icons appear as text ("ABOUT", "GAMES", etc.)
2. **Immediate disappearance**: Icons vanish within milliseconds
3. **Colored overlays**: Large rectangular blocks (orange, green) cover screen
4. **Persistent elements**: Only QuestionBlock and Windows logo remain

#### Likely Root Causes

**Theory 1: React Error Boundary Catching Render Errors**
- An error occurs during icon rendering
- Production error boundary catches it silently
- Preview shows the error, production hides it
- Colored rectangles are error fallback UI or broken window backdrops

**Theory 2: CSS Specificity / Z-Index War**
- Desktop icons render but are immediately covered by higher z-index elements
- Window backdrops rendering even when windows are closed
- Pointer events blocking interaction
- CSS gets applied differently in production (minification, order)

**Theory 3: Hydration Mismatch**
- Server renders icons one way
- Client expects different structure
- React discards client render and keeps server HTML
- But server HTML has no JavaScript event handlers attached
- Icons become non-functional ghost elements

**Theory 4: WindowShell Backdrop Rendering Bug**
- WindowShell component has `fixed inset-0 bg-black bg-opacity-50` backdrop
- Even with conditional `{openWindows.xxx && <Window>}`, backdrop might render
- If window components initialize before being hidden, backdrop flashes
- Colored rectangles are window backgrounds without content

## Resolution Strategy

### Step 1: Validate Current Code State (DONE)
✅ Removed cheerio dependency
✅ Fixed EasterEgg WindowShell invalid prop
✅ Deleted duplicate WindowShell
✅ Removed cache-busting code
✅ Removed debug console.log statements
✅ Standardized z-index layering

### Step 2: Add Production Error Logging
Add error boundary to catch React errors in production and log them:

\`\`\`tsx
// components/ErrorBoundary.tsx
'use client'
import { Component, ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[v0 ERROR BOUNDARY]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: 'red', color: 'white' }}>
          <h1>Error: {this.state.error?.message}</h1>
          <pre>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
\`\`\`

### Step 3: Simplify Desktop Icon Rendering
Remove all complexity, use absolute basics:

\`\`\`tsx
// Minimal desktop icon - no Tailwind, pure inline styles
<button
  onClick={onClick}
  style={{
    position: 'absolute',
    left: '50px',
    top: '100px',
    width: '80px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    zIndex: 10
  }}
>
  <div style={{ fontSize: '48px' }}>{emoji}</div>
  <div style={{ color: 'white', textShadow: '1px 1px 2px black' }}>
    {label}
  </div>
</button>
\`\`\`

### Step 4: Ensure Conditional Rendering Works
All window components must follow this exact pattern:

\`\`\`tsx
export function SomeWindow({ isOpen, onClose }: Props) {
  if (!isOpen) return null // Early return BEFORE any hooks or rendering
  
  return (
    <WindowShell title="..." onClose={onClose}>
      {/* content */}
    </WindowShell>
  )
}
\`\`\`

### Step 5: Verify WindowShell Backdrop Isolation
Ensure backdrop only renders when window is open:

\`\`\`tsx
export function WindowShell({ title, onClose, children }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 100 
      }} />
      
      {/* Window */}
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 101
      }}>
        {/* window content */}
      </div>
    </>
  )
}
\`\`\`

### Step 6: Test Z-Index Hierarchy
Final z-index values (inline styles only):

- Background image: `-10`
- Desktop icons container: `10`
- Desktop icons: `10`
- Question mark easter egg: `20`
- Taskbar: `50`
- Window backdrop: `100`
- Window content: `101`
- Start menu (when open): `200`

## Production Deployment Checklist

### Before Deployment
- [ ] Remove ALL console.log statements
- [ ] Remove ALL debug/test UI elements
- [ ] Verify no duplicate components exist
- [ ] Check all imports resolve correctly
- [ ] Ensure no invalid props passed to components
- [ ] Validate z-index hierarchy is consistent
- [ ] Test conditional rendering works (if/else, early returns)
- [ ] Check for hydration mismatch sources (window, localStorage, Date.now)

### During Deployment
- [ ] Monitor build logs for warnings/errors
- [ ] Check bundle size hasn't exploded
- [ ] Verify no dependency resolution conflicts
- [ ] Confirm environment variables are set

### After Deployment
- [ ] Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- [ ] Test in incognito/private window
- [ ] Open browser console and check for errors
- [ ] Inspect element to verify HTML structure
- [ ] Check z-index values in DevTools
- [ ] Verify all desktop icons are present
- [ ] Test clicking each icon opens correct window
- [ ] Verify taskbar appears at bottom
- [ ] Test Start menu opens/closes

## Known Working Configuration (v237)

### Key Files from v237 (Reference Only)
- `app/page.tsx`: Desktop layout with icons and windows
- `components/ui/DesktopIcon.tsx`: Simple div with emoji and text
- `components/ui/WindowShell.tsx`: Blue title bar, backdrop, draggable
- `components/ui/Taskbar.tsx`: Green Start button, time display
- `lib/soundcloud.ts`: Fetch-based, no cheerio
- `next.config.mjs`: Minimal config, no cache headers
- `app/layout.tsx`: Standard Next.js layout, no metadata manipulation

### What v237 Did Right
1. **Simplicity**: No over-engineering, straightforward React patterns
2. **Consistent imports**: Single source of truth for each component
3. **Clean z-index**: No conflicts, clear hierarchy
4. **No debug code**: Production-ready without test artifacts
5. **Proper conditionals**: Windows only render when `isOpen === true`
6. **Inline styles where needed**: Specificity when Tailwind conflicts

## Recommended Next Steps

### Immediate Actions (Critical for ACM Conference)
1. Deploy current codebase (v273+) which has all fixes applied
2. Test in production with hard refresh
3. If still broken, add ErrorBoundary to catch and display React errors
4. If still broken, revert ALL desktop icon styling to pure inline styles
5. If still broken, create minimal reproduction and rebuild from scratch

### Post-Conference Actions (Stability)
1. Add comprehensive error logging and monitoring
2. Set up visual regression testing (Percy, Chromatic)
3. Create staging environment that mirrors production exactly
4. Document component API contracts
5. Add TypeScript strict mode
6. Set up E2E tests for critical user flows
7. Pin all dependency versions (no ^ or ~)

## Lessons Learned

### What Went Wrong
1. **Changed too many things at once**: Text updates became full refactor
2. **Fixed symptoms, not root cause**: Added complexity instead of simplifying
3. **Didn't verify in production**: Assumed preview === production
4. **Debug statements in production**: Console.log causing infinite loops
5. **Z-index whack-a-mole**: Kept changing values without understanding issue
6. **Cache-busting rabbit hole**: Added metadata that made things worse

### What to Do Differently Next Time
1. **Make minimal changes**: Update text, deploy, verify. Then move on.
2. **Test in production immediately**: Don't wait for 40 versions
3. **Keep debug code separate**: Use environment flags, remove before merge
4. **Understand before changing**: If preview works, study the difference
5. **Revert quickly**: If something breaks, revert immediately
6. **Document working state**: Take snapshots of stable versions

## Technical Debt

### High Priority
- [ ] Consolidate duplicate components (WindowShell was duplicated)
- [ ] Remove unused API routes (startup-pitch was causing builds to fail)
- [ ] Standardize z-index system (create CSS custom properties)
- [ ] Add error boundaries around major UI sections
- [ ] Set up proper logging (Sentry, LogRocket)

### Medium Priority
- [ ] Migrate from Tailwind z-index classes to systematic inline styles
- [ ] Create component library with documented props and examples
- [ ] Add Storybook for component development
- [ ] Set up visual regression testing
- [ ] Improve mobile responsiveness

### Low Priority
- [ ] Refactor globals.css for better organization
- [ ] Add animations and transitions
- [ ] Optimize bundle size
- [ ] Improve accessibility (ARIA labels, keyboard nav)

## Contact & Escalation

If this plan doesn't resolve the production issues:
1. User is at ACM conference in Singapore (time-sensitive)
2. Website is critical for career and professional presentations
3. Last working version was v237 (September 2024?)
4. Current broken state spans v238-v273+ (40+ versions)
5. Preview environment works perfectly, production consistently fails

**Priority**: CRITICAL - Career-impacting, conference presentation
**Timeline**: IMMEDIATE - User needs this working NOW
**Fallback**: Revert to v237 via git, manually apply text updates only

---

Last Updated: November 16, 2025
Status: Production broken, diagnosis in progress
Next Review: After v274+ deployment
