-- Run this in Supabase SQL Editor AFTER confirming your existing schema.
-- It creates the public gallery bucket and locks mutations to tournament owners.

insert into storage.buckets (id, name, public)
values ('league-gallery', 'league-gallery', true)
on conflict (id) do update set public = true;

-- ---------- RLS ----------

alter table tournaments enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table goals enable row level security;
alter table gallery_images enable row level security;

-- Public tournament data
create policy "public can read tournaments"
on tournaments for select
using (true);

create policy "admins can create tournaments"
on tournaments for insert
with check (auth.uid() = admin_id);

create policy "admins can update own tournaments"
on tournaments for update
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

create policy "admins can delete own tournaments"
on tournaments for delete
using (auth.uid() = admin_id);

-- Teams
create policy "public can read teams"
on teams for select using (true);

create policy "admins can insert own teams"
on teams for insert
with check (
  exists (
    select 1 from tournaments t
    where t.id = tournament_id and t.admin_id = auth.uid()
  )
);

create policy "admins can update own teams"
on teams for update
using (
  exists (
    select 1 from tournaments t
    where t.id = teams.tournament_id and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from tournaments t
    where t.id = teams.tournament_id and t.admin_id = auth.uid()
  )
);

create policy "admins can delete own teams"
on teams for delete
using (
  exists (
    select 1 from tournaments t
    where t.id = teams.tournament_id and t.admin_id = auth.uid()
  )
);

-- Players
create policy "public can read players"
on players for select using (true);

create policy "admins can insert own players"
on players for insert
with check (
  exists (
    select 1
    from teams tm
    join tournaments t on t.id = tm.tournament_id
    where tm.id = team_id and t.admin_id = auth.uid()
  )
);

create policy "admins can update own players"
on players for update
using (
  exists (
    select 1
    from teams tm
    join tournaments t on t.id = tm.tournament_id
    where tm.id = players.team_id and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from teams tm
    join tournaments t on t.id = tm.tournament_id
    where tm.id = players.team_id and t.admin_id = auth.uid()
  )
);

create policy "admins can delete own players"
on players for delete
using (
  exists (
    select 1
    from teams tm
    join tournaments t on t.id = tm.tournament_id
    where tm.id = players.team_id and t.admin_id = auth.uid()
  )
);

-- Matches
create policy "public can read matches"
on matches for select using (true);

create policy "admins can insert own matches"
on matches for insert
with check (
  exists (
    select 1 from tournaments t
    where t.id = tournament_id and t.admin_id = auth.uid()
  )
);

create policy "admins can update own matches"
on matches for update
using (
  exists (
    select 1 from tournaments t
    where t.id = matches.tournament_id and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from tournaments t
    where t.id = matches.tournament_id and t.admin_id = auth.uid()
  )
);

create policy "admins can delete own matches"
on matches for delete
using (
  exists (
    select 1 from tournaments t
    where t.id = matches.tournament_id and t.admin_id = auth.uid()
  )
);

-- Goals
create policy "public can read goals"
on goals for select using (true);

create policy "admins can insert own goals"
on goals for insert
with check (
  exists (
    select 1
    from matches m
    join tournaments t on t.id = m.tournament_id
    where m.id = match_id and t.admin_id = auth.uid()
  )
);

create policy "admins can update own goals"
on goals for update
using (
  exists (
    select 1
    from matches m
    join tournaments t on t.id = m.tournament_id
    where m.id = goals.match_id and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from matches m
    join tournaments t on t.id = m.tournament_id
    where m.id = goals.match_id and t.admin_id = auth.uid()
  )
);

create policy "admins can delete own goals"
on goals for delete
using (
  exists (
    select 1
    from matches m
    join tournaments t on t.id = m.tournament_id
    where m.id = goals.match_id and t.admin_id = auth.uid()
  )
);

-- Gallery records
create policy "public can read gallery"
on gallery_images for select using (true);

create policy "admins can insert own gallery"
on gallery_images for insert
with check (
  exists (
    select 1 from tournaments t
    where t.id = tournament_id and t.admin_id = auth.uid()
  )
);

create policy "admins can update own gallery"
on gallery_images for update
using (
  exists (
    select 1 from tournaments t
    where t.id = gallery_images.tournament_id and t.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from tournaments t
    where t.id = gallery_images.tournament_id and t.admin_id = auth.uid()
  )
);

create policy "admins can delete own gallery"
on gallery_images for delete
using (
  exists (
    select 1 from tournaments t
    where t.id = gallery_images.tournament_id and t.admin_id = auth.uid()
  )
);

-- ---------- Storage ----------

create policy "public can view league gallery"
on storage.objects for select
to public
using (bucket_id = 'league-gallery');

create policy "admins can upload league gallery"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'league-gallery'
  and exists (
    select 1
    from tournaments t
    where t.id = split_part(name, '/', 1)::uuid
      and t.admin_id = auth.uid()
  )
);

create policy "admins can update league gallery"
on storage.objects for update
to authenticated
using (
  bucket_id = 'league-gallery'
  and exists (
    select 1
    from tournaments t
    where t.id = split_part(name, '/', 1)::uuid
      and t.admin_id = auth.uid()
  )
)
with check (
  bucket_id = 'league-gallery'
  and exists (
    select 1
    from tournaments t
    where t.id = split_part(name, '/', 1)::uuid
      and t.admin_id = auth.uid()
  )
);

create policy "admins can delete league gallery"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'league-gallery'
  and exists (
    select 1
    from tournaments t
    where t.id = split_part(name, '/', 1)::uuid
      and t.admin_id = auth.uid()
  )
);
