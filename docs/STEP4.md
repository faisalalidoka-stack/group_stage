# Step 4: Lineup Studio, kit colours, positions, match format

## Database (additive, safe to re-run, nothing dropped or rewritten)

Run in the Supabase SQL Editor, in this order, skipping any you have already run:

1. `supabase/verify.sql`  (read-only health check; send me the non-OK rows)
2. `supabase/phase1.sql`, `phase2.sql`, `phase3.sql` if verify.sql says MISSING
3. `supabase/phase4.sql`
4. `supabase/verify.sql` again; everything should now be OK or INFO

What `phase4.sql` adds:
- `tournaments.match_size` (5, 7 or 11; existing tournaments default to 11)
- `teams.primary_color`, `teams.secondary_color`
- `players.preferred_position` (GK, DEF, MID, FWD)
- tables `lineups` and `lineup_players`, with RLS: owners manage their own,
  the public can read only PUBLISHED lineups
- functions `set_match_size` and `save_lineup` (atomic, validated on the server)

Existing records, including Block C Campus Cup, are not modified except for the
new `match_size` column taking its default of 11.

## New files
- components/lineup/Pitch.tsx, LineupView.tsx, LineupEditor.tsx, LineupStudio.tsx
- lib/formations.ts, lib/lineups.ts, lib/site.ts
- supabase/phase4.sql, supabase/verify.sql
- .env.example (adds optional NEXT_PUBLIC_SITE_URL)

## Changed files
- app/admin/[slug]/page.tsx      Lineups tab, match_size on the tournament, configurable site URL
- app/t/[slug]/page.tsx          Lineups tab, kit colours, live refresh of lineups
- app/dashboard/new/page.tsx     match format choice when creating a tournament
- app/dashboard/page.tsx         configurable site URL for the copy-link button
- components/squad/TeamsPanel.tsx     kit colour pickers
- components/squad/PlayersPanel.tsx   preferred position; players in a lineup cannot be deleted or moved
- components/squad/RegistrationManager.tsx  configurable site URL
- lib/squad.ts, types/index.ts   optional new fields
- README.md

## Removed
- app/admin/[slug]/manage/   (old standalone page; the Teams tab replaced it and it no longer compiles)

## Run and check
```
npm install
npx tsc --noEmit
npm run lint
npm run build
npm run dev
```

## Manual test of Step 4
1. Teams tab: set kit colours on two teams.
2. Players: give a few players a preferred position.
3. Lineups tab: choose the match format (locked once a lineup exists).
4. Pick a match, a formation, then tap a spot and a player. Try Auto-fill.
5. Save draft: the public page must NOT show it.
6. Fill every starting spot and Publish: it appears under Lineups on `/t/<slug>`
   (open it in a private window while signed out).
7. Try to delete a player who is in a lineup: it must be refused.
8. Unpublish: it disappears from the public page.
