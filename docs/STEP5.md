# Step 5: Sharing and tournament branding

## Database (additive, safe to re-run)
Run `supabase/phase5.sql` in the Supabase SQL Editor (after phase4.sql), then
`supabase/verify.sql` again. It only adds optional columns to `tournaments`:
`logo_url`, `cover_url`, `venue`, `starts_on`, `ends_on`. Nothing existing changes.

## Environment (.env.local)
Optional, add when ready (never put keys in the zip):
- `NEXT_PUBLIC_SITE_URL`: your production address, e.g. `https://yourdomain`.
  Until the domain is connected leave it empty. On Vercel the deployment
  address is used automatically; locally it is `http://localhost:3000`.
  Set it on Vercel too (Project Settings > Environment Variables) once the
  domain is live, so link previews use the final address.
- `TOURNAMENT_TIMEZONE`: defaults to `Africa/Kampala`.

## What was added
- Three share cards, each in three sizes (link preview 1200x630, post 1080x1080,
  story 1080x1920): tournament, match and lineup. They use team kit colours
  and crests and only public data.
- Link previews: pasting a tournament or match link in WhatsApp, Facebook, X or
  Telegram shows the card, title and description.
- Public match page `/t/<slug>/m/<matchId>` (score, goals, player of the match,
  lineups, share buttons). Add `?card=lineup` to make the pasted link preview
  show the lineup image.
- Share buttons: WhatsApp, copy link, the phone's native share sheet, and
  image downloads.
- Admin Share tab (Share Centre) with live previews; admin Settings tab for name,
  venue, dates, logo and cover. Public header shows them when set.
- Team crests and branding images are stored as small JPEGs so cards can always
  embed them.

## New files
- app/api/card/[kind]/[id]/route.tsx
- app/t/[slug]/TournamentClient.tsx (the old public page, unchanged except the header and a match link)
- app/t/[slug]/m/[matchId]/page.tsx
- lib/cards/{data,render,fonts,types}.ts(x), lib/supabase-server.ts
- components/share/{ShareBar,ShareDialog,ShareCentre}.tsx
- components/admin/TournamentSettings.tsx
- assets/fonts/ (Inter, SIL Open Font License)
- supabase/phase5.sql

## Changed files
- app/t/[slug]/page.tsx (now a server page that supplies the link-preview tags)
- app/admin/[slug]/page.tsx (Share and Settings tabs)
- app/layout.tsx (metadataBase), next.config.ts (bundles the fonts with the card route)
- components/squad/TeamsPanel.tsx, lib/storage.ts, lib/site.ts, lib/formations.ts, types/index.ts
- components/lineup/LineupView.tsx (shared slot placement), .env.example, README.md

## Run and check
```
npm install
npx tsc --noEmit
npm run lint
npm run build
npm run dev
```

## Manual test
1. Settings tab: add a venue, dates, a logo and a cover. Open the public page.
2. Teams tab: upload a crest for one team and set kit colours.
3. Share tab: preview Tournament, Match and Lineup in each size. Download one.
4. Public page: press Share. Open a match: "Match page & share".
5. Paste a public link into WhatsApp (needs the deployed address; localhost
   links cannot be previewed by WhatsApp).
