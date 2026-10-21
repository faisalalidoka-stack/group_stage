-- Phase 4: lineups, kit colours, player positions, match format.
-- ADDITIVE and safe to run more than once. Nothing is dropped or rewritten:
-- existing tournaments, teams, players and matches are left exactly as they are.
-- Run after phase1.sql, phase2.sql and phase3.sql.

-- ---------- 1. New optional columns on existing tables ----------

-- Players per side. Existing tournaments default to 11-a-side and can be
-- changed from the Lineups tab until the first lineup is saved.
alter table tournaments
  add column if not exists match_size int not null default 11;

alter table teams
  add column if not exists primary_color text,
  add column if not exists secondary_color text;

alter table players
  add column if not exists preferred_position text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournaments_match_size_check') then
    alter table tournaments
      add constraint tournaments_match_size_check check (match_size in (5, 7, 11));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'teams_primary_color_check') then
    alter table teams
      add constraint teams_primary_color_check
      check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'teams_secondary_color_check') then
    alter table teams
      add constraint teams_secondary_color_check
      check (secondary_color is null or secondary_color ~ '^#[0-9a-fA-F]{6}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'players_preferred_position_check') then
    alter table players
      add constraint players_preferred_position_check
      check (preferred_position is null
             or preferred_position in ('GK', 'DEF', 'MID', 'FWD'));
  end if;
end $$;

-- ---------- 2. Lineup tables ----------
-- One lineup per team per match, so changing a lineup for one match never
-- touches another match.

create table if not exists lineups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  formation text not null check (formation ~ '^[1-5](-[1-5]){1,3}$'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, team_id)
);

-- A player who appears in a lineup cannot be deleted (on delete restrict),
-- which protects match records.
create table if not exists lineup_players (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references lineups(id) on delete cascade,
  player_id uuid not null references players(id) on delete restrict,
  role text not null check (role in ('STARTER', 'SUB')),
  slot int check (slot between 0 and 10),
  position text check (position in ('GK', 'DEF', 'MID', 'FWD')),
  sort_order int not null default 0,
  unique (lineup_id, player_id),
  constraint lineup_players_shape check (
    (role = 'STARTER' and slot is not null and position is not null)
    or (role = 'SUB' and slot is null)
  )
);

create unique index if not exists lineup_players_slot_unique
  on lineup_players (lineup_id, slot) where role = 'STARTER';
create index if not exists lineups_tournament_idx on lineups (tournament_id);
create index if not exists lineup_players_lineup_idx on lineup_players (lineup_id);
create index if not exists lineup_players_player_idx on lineup_players (player_id);

-- ---------- 3. RLS ----------
-- Owners manage everything for their tournaments. The public (no sign-in)
-- can only read lineups that have been published.

alter table lineups enable row level security;
alter table lineup_players enable row level security;

drop policy if exists "owners manage lineups" on lineups;
create policy "owners manage lineups"
on lineups for all to authenticated
using (
  exists (
    select 1 from tournaments t
    where t.id = lineups.tournament_id and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from tournaments t
    where t.id = lineups.tournament_id and t.admin_id = auth.uid()
  )
);

drop policy if exists "public reads published lineups" on lineups;
create policy "public reads published lineups"
on lineups for select to anon, authenticated
using (status = 'PUBLISHED');

drop policy if exists "owners manage lineup players" on lineup_players;
create policy "owners manage lineup players"
on lineup_players for all to authenticated
using (
  exists (
    select 1 from lineups l
    join tournaments t on t.id = l.tournament_id
    where l.id = lineup_players.lineup_id and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from lineups l
    join tournaments t on t.id = l.tournament_id
    where l.id = lineup_players.lineup_id and t.admin_id = auth.uid()
  )
);

drop policy if exists "public reads published lineup players" on lineup_players;
create policy "public reads published lineup players"
on lineup_players for select to anon, authenticated
using (
  exists (
    select 1 from lineups l
    where l.id = lineup_players.lineup_id and l.status = 'PUBLISHED'
  )
);

-- ---------- 4. Functions ----------

-- Change a tournament's match format. Refused once any lineup exists, because
-- existing lineups would no longer fit.
create or replace function public.set_match_size(
  p_tournament_id uuid,
  p_size int
) returns int
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_size not in (5, 7, 11) then
    raise exception 'Match format must be 5, 7 or 11 a side.';
  end if;

  if exists (select 1 from lineups where tournament_id = p_tournament_id) then
    raise exception 'Delete this tournament''s lineups before changing the match format.';
  end if;

  update tournaments set match_size = p_size where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found or you do not own it.';
  end if;

  return p_size;
end;
$$;

-- Save (and optionally publish) one team's lineup for one match, atomically.
--   p_starters: [{"player_id": uuid, "slot": int, "position": "GK|DEF|MID|FWD"}]
--   p_subs:     [{"player_id": uuid}]   (array order = bench order, max 7)
create or replace function public.save_lineup(
  p_match_id uuid,
  p_team_id uuid,
  p_formation text,
  p_starters jsonb,
  p_subs jsonb,
  p_publish boolean
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  m matches;
  v_size int;
  v_digits int;
  v_lineup lineups;
  v_item jsonb;
  v_pid uuid;
  v_slot int;
  v_pos text;
  v_i int := 0;
  v_n_starters int;
  v_n_subs int;
  v_seen_players uuid[] := '{}';
  v_seen_slots int[] := '{}';
  v_starters jsonb := coalesce(p_starters, '[]'::jsonb);
  v_subs jsonb := coalesce(p_subs, '[]'::jsonb);
begin
  select * into m from matches where id = p_match_id;

  if not found then
    raise exception 'Match not found or you do not have access to it.';
  end if;

  if p_team_id is distinct from m.home_team_id
     and p_team_id is distinct from m.away_team_id then
    raise exception 'That team is not playing in this match.';
  end if;

  select match_size into v_size from tournaments where id = m.tournament_id;

  if p_formation is null or p_formation !~ '^[1-5](-[1-5]){1,3}$' then
    raise exception 'Invalid formation.';
  end if;

  select coalesce(sum(x::int), 0) into v_digits
  from unnest(string_to_array(p_formation, '-')) as x;

  if v_digits <> v_size - 1 then
    raise exception 'Formation % does not fit a % a side match.', p_formation, v_size;
  end if;

  if jsonb_typeof(v_starters) <> 'array' or jsonb_typeof(v_subs) <> 'array' then
    raise exception 'Invalid lineup data.';
  end if;

  v_n_starters := jsonb_array_length(v_starters);
  v_n_subs := jsonb_array_length(v_subs);

  if v_n_starters > v_size then
    raise exception 'A % a side lineup has at most % starters.', v_size, v_size;
  end if;

  if v_n_subs > 7 then
    raise exception 'A lineup can have at most 7 substitutes.';
  end if;

  if p_publish and v_n_starters <> v_size then
    raise exception 'Publishing needs a full starting % (this lineup has %).',
      v_size, v_n_starters;
  end if;

  insert into lineups (tournament_id, match_id, team_id, formation, status, published_at)
  values (
    m.tournament_id, p_match_id, p_team_id, p_formation,
    case when p_publish then 'PUBLISHED' else 'DRAFT' end,
    case when p_publish then now() else null end
  )
  on conflict (match_id, team_id) do update
    set formation = excluded.formation,
        status = excluded.status,
        published_at = case
          when excluded.status = 'PUBLISHED'
            then coalesce(lineups.published_at, now())
          else null
        end
  returning * into v_lineup;

  delete from lineup_players where lineup_id = v_lineup.id;

  for v_item in select value from jsonb_array_elements(v_starters) loop
    begin
      v_pid := (v_item->>'player_id')::uuid;
      v_slot := (v_item->>'slot')::int;
    exception when others then
      raise exception 'Invalid starter.';
    end;

    v_pos := v_item->>'position';

    if v_slot is null or v_slot < 0 or v_slot >= v_size then
      raise exception 'Invalid position slot %.', v_slot;
    end if;

    if v_pos is null or v_pos not in ('GK', 'DEF', 'MID', 'FWD') then
      raise exception 'Invalid player position.';
    end if;

    if (v_slot = 0) <> (v_pos = 'GK') then
      raise exception 'The goalkeeper must be the first slot, and only that slot.';
    end if;

    if v_pid = any(v_seen_players) then
      raise exception 'A player appears twice in this lineup.';
    end if;

    if v_slot = any(v_seen_slots) then
      raise exception 'Two players share the same position.';
    end if;

    if not exists (select 1 from players where id = v_pid and team_id = p_team_id) then
      raise exception 'Every player must belong to the selected team.';
    end if;

    v_seen_players := v_seen_players || v_pid;
    v_seen_slots := v_seen_slots || v_slot;

    insert into lineup_players (lineup_id, player_id, role, slot, position, sort_order)
    values (v_lineup.id, v_pid, 'STARTER', v_slot, v_pos, v_slot);
  end loop;

  v_i := 0;

  for v_item in select value from jsonb_array_elements(v_subs) loop
    begin
      v_pid := (v_item->>'player_id')::uuid;
    exception when others then
      raise exception 'Invalid substitute.';
    end;

    if v_pid = any(v_seen_players) then
      raise exception 'A player appears twice in this lineup.';
    end if;

    if not exists (select 1 from players where id = v_pid and team_id = p_team_id) then
      raise exception 'Every player must belong to the selected team.';
    end if;

    v_seen_players := v_seen_players || v_pid;

    insert into lineup_players (lineup_id, player_id, role, slot, position, sort_order)
    values (v_lineup.id, v_pid, 'SUB', null, null, v_i);

    v_i := v_i + 1;
  end loop;

  -- Touch the lineup last so live listeners refresh after all rows exist.
  update lineups set updated_at = now()
  where id = v_lineup.id
  returning * into v_lineup;

  return jsonb_build_object(
    'lineup', to_jsonb(v_lineup),
    'players', coalesce((
      select jsonb_agg(to_jsonb(lp) order by (lp.role = 'SUB'), lp.slot, lp.sort_order)
      from lineup_players lp
      where lp.lineup_id = v_lineup.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.set_match_size(uuid, int) to authenticated;
grant execute on function public.save_lineup(uuid, uuid, text, jsonb, jsonb, boolean) to authenticated;
