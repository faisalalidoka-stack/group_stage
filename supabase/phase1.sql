-- Phase 1. Run once in the Supabase SQL Editor.
-- Run supabase/policies.sql first if you have not already (RLS + storage).

-- 1. Archiving
alter table tournaments
  add column if not exists archived_at timestamptz;

-- 2. Create a tournament, its teams and its fixtures in ONE transaction.
create or replace function public.create_tournament(
  p_name text,
  p_slug text,
  p_venue text,
  p_teams text[],
  p_fixtures jsonb
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid;
  v_team_id uuid;
  v_ids uuid[] := '{}';
  v_name text;
  f jsonb;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  if coalesce(array_length(p_teams, 1), 0) < 3 then
    raise exception 'At least 3 teams are required.';
  end if;

  insert into tournaments (admin_id, name, format, public_slug)
  values (v_uid, trim(p_name), 'ROUND_ROBIN', p_slug)
  returning id into v_tid;

  foreach v_name in array p_teams loop
    insert into teams (tournament_id, name)
    values (v_tid, v_name)
    returning id into v_team_id;

    v_ids := v_ids || v_team_id;
  end loop;

  for f in select * from jsonb_array_elements(coalesce(p_fixtures, '[]'::jsonb)) loop
    insert into matches (
      tournament_id, home_team_id, away_team_id,
      home_score, away_score, status, stage, round_number, location
    ) values (
      v_tid,
      v_ids[(f->>'home')::int + 1],
      v_ids[(f->>'away')::int + 1],
      0, 0, 'SCHEDULED', 'GROUP',
      (f->>'round')::int,
      nullif(trim(coalesce(p_venue, '')), '')
    );
  end loop;

  return p_slug;
end;
$$;

-- 3. Save a match result and its goals atomically.
create or replace function public.save_match_result(
  p_match_id uuid,
  p_home int,
  p_away int,
  p_status text,
  p_location text,
  p_referee text,
  p_scheduled timestamptz,
  p_mvp uuid,
  p_goals jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_home uuid;
  v_away uuid;
begin
  select home_team_id, away_team_id
    into v_home, v_away
  from matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found or you do not have access to it.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_goals, '[]'::jsonb))
         as g(player_id uuid, minute int)
    left join players p on p.id = g.player_id
    where p.team_id is distinct from v_home
      and p.team_id is distinct from v_away
  ) then
    raise exception 'Every goal scorer must belong to one of the teams in this match.';
  end if;

  update matches set
    home_score    = p_home,
    away_score    = p_away,
    -- populate_record keeps this working whether status is text or an enum
    status        = (jsonb_populate_record(null::matches,
                       jsonb_build_object('status', p_status))).status,
    location      = nullif(trim(coalesce(p_location, '')), ''),
    referee_name  = nullif(trim(coalesce(p_referee, '')), ''),
    scheduled_at  = p_scheduled,
    mvp_player_id = p_mvp
  where id = p_match_id;

  if not found then
    raise exception 'You do not have permission to update this match.';
  end if;

  delete from goals where match_id = p_match_id;

  insert into goals (match_id, player_id, minute)
  select p_match_id, g.player_id, g.minute
  from jsonb_to_recordset(coalesce(p_goals, '[]'::jsonb))
       as g(player_id uuid, minute int);
end;
$$;

-- 4. Delete a tournament and everything under it, in one transaction.
create or replace function public.delete_tournament(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from tournaments
    where id = p_id and admin_id = auth.uid()
  ) then
    raise exception 'Tournament not found or you do not own it.';
  end if;

  delete from goals
    where match_id in (select id from matches where tournament_id = p_id);
  delete from gallery_images where tournament_id = p_id;
  delete from matches where tournament_id = p_id;
  delete from players
    where team_id in (select id from teams where tournament_id = p_id);
  delete from teams where tournament_id = p_id;
  delete from tournaments where id = p_id;
end;
$$;

grant execute on function public.create_tournament(text, text, text, text[], jsonb) to authenticated;
grant execute on function public.save_match_result(uuid, int, int, text, text, text, timestamptz, uuid, jsonb) to authenticated;
grant execute on function public.delete_tournament(uuid) to authenticated;
