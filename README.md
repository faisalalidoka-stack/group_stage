# Group Stage

Create. Compete. Share. Tournament management for football leagues.

Next.js 16 · React 19 · Supabase · Tailwind 4

## Setup

1. `npm install`
2. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
3. In the Supabase SQL Editor run, in order: `supabase/policies.sql` (skip if already applied), `supabase/phase1.sql`, `supabase/phase2.sql`, `supabase/phase3.sql`, `supabase/phase4.sql` (all additive and safe to re-run). `supabase/verify.sql` is a read-only health check you can run at any time.
4. Supabase > Authentication > URL Configuration: add `http://localhost:3000/auth/callback`
   (and your production URL) to Redirect URLs.
5. `npm run dev`

## Routes

- `/` sign in, create account, forgot password
- `/dashboard` My Tournaments
- `/dashboard/new` create a tournament
- `/admin/[slug]` tournament dashboard (owner only); the Teams tab is the Squad Manager (teams, crests, players, photos, bulk add); the Lineups tab is the Lineup Studio; the Registration tab manages registration links and the approval queue
- `/register/[token]` public team-captain registration page (no account needed)
- `/t/[slug]` public tournament page (standings, fixtures, lineups, leaders, gallery)
