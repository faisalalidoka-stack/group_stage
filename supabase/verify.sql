-- =====================================================================
-- Group Stage: database verification (READ-ONLY)
--
-- Run this whole script in the Supabase SQL Editor and send me the result
-- table. It changes NOTHING: it only creates a temporary function that
-- disappears when the session ends, then reads catalog tables and counts.
--
-- Status meanings
--   OK       present and as expected
--   MISSING  a migration has not been applied yet (safe to apply)
--   WARN     works, but needs attention
--   FAIL     a security or data problem; fix before going further
--   INFO     information only
-- =====================================================================

create or replace function pg_temp.gs_verify()
returns table (section text, check_name text, status text, detail text)
language plpgsql
as $fn$
declare
  expected jsonb := '{
    "tournaments": ["id","admin_id","name","format","public_slug","created_at","archived_at","match_size"],
    "teams": ["id","tournament_id","name","logo_url","primary_color","secondary_color"],
    "players": ["id","team_id","name","number","photo_url","preferred_position"],
    "matches": ["id","tournament_id","home_team_id","away_team_id","home_score","away_score","status","stage","round_number","scheduled_at","location","referee_name","mvp_player_id"],
    "goals": ["id","match_id","player_id","minute"],
    "gallery_images": ["id","tournament_id","image_url","caption","created_at"],
    "team_registration_links": ["id","tournament_id","team_id","token","expires_at","max_submissions","revoked_at","created_at"],
    "player_registration_submissions": ["id","link_id","tournament_id","team_id","name","number","photo_url","submitted_by","status","submitted_at","reviewed_at"],
    "lineups": ["id","tournament_id","match_id","team_id","formation","status","published_at","created_at","updated_at"],
    "lineup_players": ["id","lineup_id","player_id","role","slot","position","sort_order"]
  }';
  fns text[][] := array[
    ['create_tournament','phase1.sql'],
    ['save_match_result','phase1.sql'],
    ['delete_tournament','phase1.sql'],
    ['link_is_open','phase3.sql'],
    ['owns_link_token','phase3.sql'],
    ['get_registration_link','phase3.sql'],
    ['submit_registration','phase3.sql'],
    ['create_registration_link','phase3.sql'],
    ['review_submission','phase3.sql'],
    ['set_match_size','phase4.sql'],
    ['save_lineup','phase4.sql']
  ];
  t text; c text; missing text[]; n bigint; txt text;
  rls boolean; pol_count int; pol_names text;
  i int; rec record;
begin
  -- 1. Tables, columns, RLS, policies -------------------------------
  for t in select jsonb_object_keys(expected) loop
    if to_regclass('public.' || t) is null then
      return query select 'tables', t, 'MISSING',
        case when t like '%registration%' then 'run phase3.sql'
             when t like 'lineup%' then 'run phase4.sql'
             else 'table not found - unexpected, tell me' end;
      continue;
    end if;

    missing := '{}';
    for c in select jsonb_array_elements_text(expected -> t) loop
      if not exists (select 1 from information_schema.columns
                     where table_schema = 'public'
                       and table_name = t and column_name = c) then
        missing := missing || c;
      end if;
    end loop;

    if array_length(missing, 1) is null then
      return query select 'columns', t, 'OK', 'all expected columns present';
    else
      return query select 'columns', t, 'MISSING',
        'missing: ' || array_to_string(missing, ', ') ||
        case
          when 'archived_at' = any(missing) then ' (run phase1.sql)'
          when 'photo_url' = any(missing) and t = 'players' then ' (run phase2.sql)'
          when missing && array['match_size','primary_color','secondary_color','preferred_position']
            then ' (run phase4.sql)'
          else ' (check against your schema)'
        end;
    end if;

    select relrowsecurity into rls from pg_class
      where oid = to_regclass('public.' || t);
    select count(*), coalesce(string_agg(policyname, '; '), '')
      into pol_count, pol_names
      from pg_policies where schemaname = 'public' and tablename = t;

    if not rls then
      return query select 'rls', t, 'FAIL',
        'Row Level Security is OFF: anyone with the public key could write to this table';
    elsif pol_count = 0 then
      return query select 'rls', t, 'WARN',
        'RLS is on but there are no policies (table is locked for everyone)';
    else
      return query select 'rls', t, 'OK', pol_count || ' policies: ' || pol_names;
    end if;
  end loop;

  -- 2. Functions ------------------------------------------------------
  for i in 1 .. array_length(fns, 1) loop
    if exists (select 1 from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = fns[i][1]) then
      return query select 'functions', fns[i][1], 'OK', 'present';
    else
      return query select 'functions', fns[i][1], 'MISSING', 'run ' || fns[i][2];
    end if;
  end loop;

  -- 3. Indexes --------------------------------------------------------
  if exists (select 1 from pg_indexes
             where schemaname = 'public'
               and indexname = 'players_team_number_unique') then
    return query select 'indexes', 'players_team_number_unique', 'OK',
      'one shirt number per team is enforced';
  else
    return query select 'indexes', 'players_team_number_unique', 'MISSING',
      'run phase2.sql (it skips itself with a notice if duplicates exist)';
  end if;

  -- 4. Storage ---------------------------------------------------------
  if to_regclass('storage.buckets') is not null then
    for t in select unnest(array['league-gallery','registration-photos']) loop
      select * into rec from storage.buckets where id = t;
      if not found then
        return query select 'storage', 'bucket ' || t, 'MISSING',
          case when t = 'league-gallery' then 'run policies.sql (bucket part)'
               else 'run phase3.sql' end;
      else
        return query select 'storage', 'bucket ' || t,
          case when rec.public then 'OK' else 'WARN' end,
          'public=' || rec.public::text;
      end if;
    end loop;

    for t in select unnest(array[
      'public can view league gallery','admins can upload league gallery',
      'admins can update league gallery','admins can delete league gallery',
      'open links accept photo uploads','owners read registration photos',
      'owners remove registration photos']) loop
      if exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = t) then
        return query select 'storage policies', t, 'OK', 'present';
      else
        return query select 'storage policies', t, 'MISSING',
          case when t like '%registration%' or t like '%open links%'
               then 'run phase3.sql' else 'run policies.sql' end;
      end if;
    end loop;

    -- the original gallery policies compared the wrong "name" column
    if exists (select 1 from pg_policies
               where schemaname = 'storage' and tablename = 'objects'
                 and policyname like 'admins % league gallery'
                 and coalesce(qual, '') || coalesce(with_check, '') like '%::uuid%') then
      return query select 'storage policies', 'gallery policy bug', 'WARN',
        'old version found (compares the tournament name, not the file path). Run phase3.sql to replace it';
    end if;
  else
    return query select 'storage', 'storage schema', 'INFO', 'not available here';
  end if;

  -- 5. Existing data (counts and ownership) ----------------------------
  begin
    for t in select unnest(array['tournaments','teams','players','matches','goals','gallery_images','lineups','lineup_players']) loop
      if to_regclass('public.' || t) is not null then
        execute format('select count(*) from public.%I', t) into n;
        return query select 'data', 'rows in ' || t, 'INFO', n::text;
      end if;
    end loop;

    if to_regclass('public.tournaments') is not null
       and to_regclass('auth.users') is not null then

      for rec in
        select tt.public_slug, tt.name, u.email,
               (select count(*) from public.teams x where x.tournament_id = tt.id) as team_n,
               (select count(*) from public.matches m where m.tournament_id = tt.id) as match_n
        from public.tournaments tt
        left join auth.users u on u.id = tt.admin_id
        order by tt.created_at
      loop
        return query select 'tournaments', rec.public_slug,
          case when rec.email is null then 'FAIL' else 'INFO' end,
          format('"%s" | owner: %s | %s teams | %s matches',
                 rec.name, coalesce(rec.email, 'NO OWNER ACCOUNT FOUND'),
                 rec.team_n, rec.match_n);
      end loop;

      select count(*) into n from public.tournaments tt
        where not exists (select 1 from auth.users u where u.id = tt.admin_id);
      return query select 'ownership', 'tournaments without a valid owner',
        case when n = 0 then 'OK' else 'FAIL' end,
        case when n = 0 then 'every tournament belongs to an existing account'
             else n || ' tournament(s) cannot be managed by anyone' end;

      select count(distinct admin_id) into n from public.tournaments;
      return query select 'ownership', 'distinct owner accounts', 'INFO', n::text;

      select count(*) into n from public.tournaments
        where public_slug = 'block-c-campus-cup-test';
      return query select 'data', 'Block C Campus Cup test tournament',
        case when n = 1 then 'OK' else 'WARN' end,
        case when n = 1 then 'found by slug block-c-campus-cup-test'
             else 'not found by that slug' end;
    end if;

    if to_regclass('public.players') is not null then
      select count(*) into n from (
        select 1 from public.players where number is not null
        group by team_id, number having count(*) > 1) d;
      return query select 'data', 'duplicate shirt numbers',
        case when n = 0 then 'OK' else 'WARN' end,
        case when n = 0 then 'none'
             else n || ' team/number combination(s) are duplicated - fix before the unique index can be created' end;
    end if;

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'tournaments'
                 and column_name = 'match_size') then
      for rec in select match_size, count(*) as n from public.tournaments
                 group by match_size order by match_size loop
        return query select 'data', 'tournaments set to ' || rec.match_size || '-a-side',
          'INFO', rec.n::text;
      end loop;
    end if;

    select data_type || ' / ' || udt_name into txt
      from information_schema.columns
      where table_schema = 'public' and table_name = 'matches' and column_name = 'status';
    return query select 'data', 'matches.status type', 'INFO', coalesce(txt, 'n/a');
  exception when others then
    return query select 'data', 'data checks', 'WARN', 'could not finish: ' || sqlerrm;
  end;

  return query select 'summary', 'done', 'INFO',
    'send me every row that is not OK or INFO, plus the tournaments section';
end;
$fn$;

select * from pg_temp.gs_verify();
