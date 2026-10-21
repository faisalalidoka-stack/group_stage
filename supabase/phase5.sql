-- Phase 5: tournament branding (logo, cover, venue, dates) for share cards.
-- ADDITIVE and safe to run more than once. Existing tournaments are untouched:
-- every new column is optional and starts empty.
-- Run after phase4.sql.

alter table tournaments
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists venue text,
  add column if not exists starts_on date,
  add column if not exists ends_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournaments_dates_check') then
    alter table tournaments
      add constraint tournaments_dates_check
      check (starts_on is null or ends_on is null or ends_on >= starts_on);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tournaments_venue_length_check') then
    alter table tournaments
      add constraint tournaments_venue_length_check
      check (venue is null or char_length(venue) <= 120);
  end if;
end $$;
