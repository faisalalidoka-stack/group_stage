-- Phase 2: Squad Manager. Run once in the Supabase SQL Editor (after phase1.sql).

-- 1. Optional player photo. Team crests already use teams.logo_url.
alter table players
  add column if not exists photo_url text;

-- 2. One shirt number per team. Players without a number are unaffected.
--    If duplicates already exist the index is skipped with a notice;
--    fix them (query below), then run this block again.
--
--    select team_id, number, count(*) from players
--    where number is not null group by team_id, number having count(*) > 1;
do $$
begin
  if exists (
    select 1 from players
    where number is not null
    group by team_id, number
    having count(*) > 1
  ) then
    raise notice 'Duplicate shirt numbers exist - fix them, then re-run this block.';
  else
    create unique index if not exists players_team_number_unique
      on players (team_id, number)
      where number is not null;
  end if;
end $$;
