# Raffisourenkhatchadourian clone

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/raffi-notgoodcompas-projects/v0-raffisourenkhatchadourian-clone)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/W42KiCd7JOu)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/raffi-notgoodcompas-projects/v0-raffisourenkhatchadourian-clone](https://vercel.com/raffi-notgoodcompas-projects/v0-raffisourenkhatchadourian-clone)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/W42KiCd7JOu](https://v0.app/chat/projects/W42KiCd7JOu)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## SoundCloud Collection Management

### Refreshing the SoundCloud Tracks

The Discovery Mode Easter egg uses a pre-validated collection of SoundCloud tracks. To refresh this collection:

\`\`\`bash
# Validate and update the SoundCloud collection
npm run validate:soundcloud

# Or run it as part of the build process (happens automatically)
npm run build
\`\`\`

### How It Works

1. **Validation Script** (`scripts/validate-soundcloud.ts`):
   - Processes 200+ SoundCloud URLs from djsweeterman's collection
   - Deduplicates URLs and validates each one using SoundCloud's oEmbed API
   - Handles rate limiting with 5 concurrent requests and retry logic
   - Generates `app/data/soundcloud.json` with only working, embeddable tracks

2. **Discovery Mode** (`app/components/EasterEgg.tsx`):
   - Imports the pre-validated JSON file (no runtime API calls)
   - Shuffles through verified tracks instantly
   - Shows track count and collection info
   - Graceful fallback if no tracks are available

3. **Build Integration**:
   - `prebuild` script automatically validates tracks before deployment
   - Ensures only working embeds make it to production
   - No client-side oEmbed calls (faster, more reliable)

### Collection Stats

After running validation, you'll see:
- Total URLs processed: ~200+
- Success rate: Typically 70-85% (varies by track availability)
- Final collection: 100-170 verified, embeddable tracks
- Includes: Amapiano remixes, Baile Funk edits, underground hip-hop, house music, and more

The collection includes tracks from artists like:
- **Your own mixes**: Habibi Funk series, Andromeda, Kim K
- **Remixes & Edits**: Sade Amapiano, Beyoncé Baile Funk, Kanye edits
- **Underground gems**: Sango, GORDO, Pierre Bourne, 454, Blaccmass
- **Classic tracks**: Four Tet, Jamie XX, Disclosure, Flume, Odesza
