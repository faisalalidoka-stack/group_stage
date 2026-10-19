-- Phase 3: registration links + player submissions.
-- Run once in the Supabase SQL Editor (after phase1.sql and phase2.sql).
--
-- Security model:
--  * Captains are anonymous. They never touch the tables directly. They can
--    only call get_registration_link() and submit_registration(), which
--    validate the token, expiry, revocation and limit on the server.
--  * Tournament owners manage links and submissions through RLS.

-- ---------- Tables ----------

create table if not exists team_registration_links (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  max_submissions int check (max_submissions is null or max_submissions between 1 and 100),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists player_registration_submissions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references team_registration_links(id) on delete set null,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  number int not null check (number between 0 and 99),
  photo_url text,
  submitted_by text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists reg_links_tournament_idx
  on team_registration_links (tournament_id);
create index if not exists reg_subs_tournament_status_idx
  on player_registration_submissions (tournament_id, status);
create index if not exists reg_subs_link_idx
  on player_registration_submissions (link_id);

-- ---------- RLS (owners only; anonymous users have no table access) ----------

alter table team_registration_links enable row level security;
alter table player_registration_submissions enable row level security;

drop policy if exists "owners manage registration links" on team_registration_links;
create policy "owners manage registration links"
on team_registration_links for all to authenticated
using (
  exists (
    select 1 from tournaments t
    where t.id = team_registration_links.tournament_id
      and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from tournaments t
    where t.id = team_registration_links.tournament_id
      and t.admin_id = auth.uid()
  )
);

drop policy if exists "owners manage submissions" on player_registration_submissions;
create policy "owners manage submissions"
on player_registration_submissions for all to authenticated
using (
  exists (
    select 1 from tournaments t
    where t.id = player_registration_submissions.tournament_id
      and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from tournaments t
    where t.id = player_registration_submissions.tournament_id
      and t.admin_id = auth.uid()
  )
);

-- ---------- Helper functions (used by storage policies) ----------

create or replace function public.link_is_open(p_token text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from team_registration_links l
    where l.token = p_token
      and l.revoked_at is null
      and l.expires_at > now()
  );
$$;

create or replace function public.owns_link_token(p_token text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from team_registration_links l
    join tournaments t on t.id = l.tournament_id
    where l.token = p_token and t.admin_id = auth.uid()
  );
$$;

-- ---------- Public: read what a link is for ----------

create or replace function public.get_registration_link(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  lk team_registration_links;
  v_used int;
  v_reason text;
  v_taken int[];
  v_tournament text;
  v_team text;
begin
  select * into lk from team_registration_links where token = p_token;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  select count(*) into v_used
  from player_registration_submissions
  where link_id = lk.id and status <> 'REJECTED';

  select name into v_tournament from tournaments where id = lk.tournament_id;
  select name into v_team from teams where id = lk.team_id;

  select coalesce(array_agg(n.number order by n.number), '{}') into v_taken
  from (
    select number from players
      where team_id = lk.team_id and number is not null
    union
    select number from player_registration_submissions
      where team_id = lk.team_id and status = 'PENDING'
  ) n;

  v_reason := case
    when lk.revoked_at is not null then 'revoked'
    when lk.expires_at <= now() then 'expired'
    when lk.max_submissions is not null and v_used >= lk.max_submissions then 'full'
    else null
  end;

  return jsonb_build_object(
    'valid', v_reason is null,
    'reason', v_reason,
    'tournament_name', v_tournament,
    'team_name', v_team,
    'expires_at', lk.expires_at,
    'remaining', case
      when lk.max_submissions is null then null
      else greatest(lk.max_submissions - v_used, 0)
    end,
    'taken_numbers', to_jsonb(v_taken)
  );
end;
$$;

-- ---------- Public: submit players (all-or-nothing) ----------

create or replace function public.submit_registration(
  p_token text,
  p_submitted_by text,
  p_players jsonb
) returns int
language plpgsql security definer
set search_path = public
as $$
declare
  lk team_registration_links;
  v_used int;
  v_count int;
  v_by text := nullif(left(trim(coalesce(p_submitted_by, '')), 80), '');
  v_item jsonb;
  v_name text;
  v_num int;
  v_photo text;
  v_seen_nums int[] := '{}';
  v_seen_names text[] := '{}';
begin
  select * into lk
  from team_registration_links
  where token = p_token
  for update;

  if not found then
    raise exception 'This registration link is not valid.';
  end if;
  if lk.revoked_at is not null then
    raise exception 'This registration link has been closed by the organiser.';
  end if;
  if lk.expires_at <= now() then
    raise exception 'This registration link has expired.';
  end if;

  if jsonb_typeof(p_players) is distinct from 'array'
     or jsonb_array_length(p_players) = 0 then
    raise exception 'Add at least one player.';
  end if;

  v_count := jsonb_array_length(p_players);

  if v_count > 30 then
    raise exception 'You can submit at most 30 players at a time.';
  end if;

  select count(*) into v_used
  from player_registration_submissions
  where link_id = lk.id and status <> 'REJECTED';

  if lk.max_submissions is not null
     and v_used + v_count > lk.max_submissions then
    raise exception 'This link only has % player slot(s) left.',
      greatest(lk.max_submissions - v_used, 0);
  end if;

  for v_item in select value from jsonb_array_elements(p_players) loop
    v_name := trim(coalesce(v_item->>'name', ''));

    if v_name = '' or char_length(v_name) > 80 then
      raise exception 'Every player needs a name (80 characters at most).';
    end if;

    begin
      v_num := (v_item->>'number')::int;
    exception when others then
      v_num := null;
    end;

    if v_num is null or v_num < 0 or v_num > 99 then
      raise exception 'Every player needs a shirt number from 0 to 99 (%).', v_name;
    end if;

    if v_num = any(v_seen_nums) then
      raise exception 'Shirt number % is used twice in this submission.', v_num;
    end if;
    if lower(v_name) = any(v_seen_names) then
      raise exception '% appears twice in this submission.', v_name;
    end if;

    if exists (select 1 from players
                 where team_id = lk.team_id and number = v_num)
       or exists (select 1 from player_registration_submissions
                    where team_id = lk.team_id
                      and status = 'PENDING' and number = v_num) then
      raise exception 'Shirt number % is already taken.', v_num;
    end if;

    if exists (select 1 from players
                 where team_id = lk.team_id and lower(name) = lower(v_name))
       or exists (select 1 from player_registration_submissions
                    where team_id = lk.team_id
                      and status = 'PENDING' and lower(name) = lower(v_name)) then
      raise exception '% is already registered for this team.', v_name;
    end if;

    -- Only accept photos uploaded through this very link.
    v_photo := nullif(v_item->>'photo_url', '');

    if v_photo is not null
       and v_photo not like '%/storage/v1/object/public/registration-photos/'
                            || p_token || '/%' then
      raise exception 'Invalid photo.';
    end if;

    v_seen_nums := v_seen_nums || v_num;
    v_seen_names := v_seen_names || lower(v_name);

    insert into player_registration_submissions
      (link_id, tournament_id, team_id, name, number, photo_url, submitted_by)
    values
      (lk.id, lk.tournament_id, lk.team_id, v_name, v_num, v_photo, v_by);
  end loop;

  return v_count;
end;
$$;

-- ---------- Owner: create a link ----------

create or replace function public.create_registration_link(
  p_tournament_id uuid,
  p_team_id uuid,
  p_expires_at timestamptz,
  p_max int
) returns team_registration_links
language plpgsql security invoker
set search_path = public
as $$
declare
  v_link team_registration_links;
begin
  if p_expires_at <= now() then
    raise exception 'The expiry must be in the future.';
  end if;

  if not exists (
    select 1 from teams
    where id = p_team_id and tournament_id = p_tournament_id
  ) then
    raise exception 'That team does not belong to this tournament.';
  end if;

  insert into team_registration_links
    (tournament_id, team_id, token, expires_at, max_submissions)
  values (
    p_tournament_id,
    p_team_id,
    replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', ''),
    p_expires_at,
    p_max
  )
  returning * into v_link;

  return v_link;
end;
$$;

-- ---------- Owner: approve or reject a submission ----------

create or replace function public.review_submission(
  p_id uuid,
  p_approve boolean,
  p_number int default null
) returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  s player_registration_submissions;
  v_player players;
  v_number int;
begin
  select * into s
  from player_registration_submissions
  where id = p_id
  for update;

  if not found then
    raise exception 'Submission not found or you do not have access to it.';
  end if;

  if s.status <> 'PENDING' then
    raise exception 'This submission has already been reviewed.';
  end if;

  if not p_approve then
    update player_registration_submissions
       set status = 'REJECTED', reviewed_at = now()
     where id = p_id;
    return null;
  end if;

  v_number := coalesce(p_number, s.number);

  if v_number < 0 or v_number > 99 then
    raise exception 'Shirt number must be from 0 to 99.';
  end if;

  -- A unique violation here means the number was taken in the meantime;
  -- the admin can change the number and approve again.
  insert into players (team_id, name, number, photo_url)
  values (s.team_id, s.name, v_number, s.photo_url)
  returning * into v_player;

  update player_registration_submissions
     set status = 'APPROVED', number = v_number, reviewed_at = now()
   where id = p_id;

  return to_jsonb(v_player);
end;
$$;

-- ---------- Photo bucket for captain uploads ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('registration-photos', 'registration-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg'];

drop policy if exists "open links accept photo uploads" on storage.objects;
create policy "open links accept photo uploads"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'registration-photos'
  and public.link_is_open(split_part(name, '/', 1))
);

drop policy if exists "owners read registration photos" on storage.objects;
create policy "owners read registration photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'registration-photos'
  and public.owns_link_token(split_part(name, '/', 1))
);

drop policy if exists "owners remove registration photos" on storage.objects;
create policy "owners remove registration photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'registration-photos'
  and public.owns_link_token(split_part(name, '/', 1))
);

-- ---------- Harden the existing gallery policies ----------
-- The originals compared an unqualified "name", which inside the
-- tournaments subquery is the TOURNAMENT's name, not the file path, and cast
-- it to uuid. Compare the real path (objects.name) as text instead.

drop policy if exists "admins can upload league gallery" on storage.objects;
drop policy if exists "admins can update league gallery" on storage.objects;
drop policy if exists "admins can delete league gallery" on storage.objects;

drop policy if exists "admins can upload league gallery" on storage.objects;
create policy "admins can upload league gallery"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'league-gallery'
  and exists (
    select 1 from tournaments t
    where t.id::text = split_part(objects.name, '/', 1)
      and t.admin_id = auth.uid()
  )
);

drop policy if exists "admins can update league gallery" on storage.objects;
create policy "admins can update league gallery"
on storage.objects for update to authenticated
using (
  bucket_id = 'league-gallery'
  and exists (
    select 1 from tournaments t
    where t.id::text = split_part(objects.name, '/', 1)
      and t.admin_id = auth.uid()
  )
)
with check (
  bucket_id = 'league-gallery'
  and exists (
    select 1 from tournaments t
    where t.id::text = split_part(objects.name, '/', 1)
      and t.admin_id = auth.uid()
  )
);

drop policy if exists "admins can delete league gallery" on storage.objects;
create policy "admins can delete league gallery"
on storage.objects for delete to authenticated
using (
  bucket_id = 'league-gallery'
  and exists (
    select 1 from tournaments t
    where t.id::text = split_part(objects.name, '/', 1)
      and t.admin_id = auth.uid()
  )
);

-- ---------- Grants ----------

grant execute on function public.link_is_open(text) to anon, authenticated;
grant execute on function public.owns_link_token(text) to authenticated;
grant execute on function public.get_registration_link(text) to anon, authenticated;
grant execute on function public.submit_registration(text, text, jsonb) to anon, authenticated;
grant execute on function public.create_registration_link(uuid, uuid, timestamptz, int) to authenticated;
grant execute on function public.review_submission(uuid, boolean, int) to authenticated;
