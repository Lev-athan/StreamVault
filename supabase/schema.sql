-- ============================================================================
-- StreamVault database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES
-- One row per auth.users row. Holds plan + role. Created automatically
-- by a trigger when a new user signs up.
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('viewer', 'admin');
create type public.plan_tier as enum ('free', 'premium');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.app_role not null default 'viewer',
  plan public.plan_tier not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_subscription_status text, -- active, trialing, past_due, canceled, ...
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select
  using (auth.uid() = id);

create policy "admins can read all profiles"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles are self-updatable (limited)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- TITLES  (a "title" is a movie or a series; category is genre, e.g. "Drama")
-- ---------------------------------------------------------------------------
create type public.title_kind as enum ('movie', 'series');

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  kind public.title_kind not null,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  poster_path text, -- path inside the public "posters" bucket
  -- for movies only: video file storage path(s) + duration.
  -- video_path = highest quality (1080p) master. video_path_480 is an
  -- optional separately-encoded low-res rendition; if omitted the app
  -- falls back to serving the same file for free-tier playback (see
  -- README "Quality enforcement" for how to add real transcoding).
  video_path text,
  video_path_480 text,
  duration_seconds int,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.titles enable row level security;

create policy "titles are publicly readable (metadata only)"
  on public.titles for select
  using (true);

create policy "only admins can write titles"
  on public.titles for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "only admins can update titles"
  on public.titles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "only admins can delete titles"
  on public.titles for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- EPISODES  (only for titles with kind = 'series')
-- ---------------------------------------------------------------------------
create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  season int not null default 1,
  episode_number int not null,
  name text not null,
  video_path text not null, -- 1080p master, path inside the private "videos" bucket
  video_path_480 text, -- optional low-res rendition, see note on titles.video_path_480
  duration_seconds int,
  created_at timestamptz not null default now(),
  unique (title_id, season, episode_number)
);

alter table public.episodes enable row level security;

create policy "episodes are publicly readable (metadata only)"
  on public.episodes for select
  using (true);

create policy "only admins can write episodes"
  on public.episodes for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "only admins can update episodes"
  on public.episodes for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "only admins can delete episodes"
  on public.episodes for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- WATCH PROGRESS / ENTITLEMENT TRACKING
-- Used to enforce: free/guest = 2 episodes per series, 20 min per movie.
-- One row per (user, title, episode?) combination.
-- ---------------------------------------------------------------------------
create table public.watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade, -- null for movies
  seconds_watched int not null default 0,
  last_watched_at timestamptz not null default now()
);

-- Two partial unique indexes instead of a single `unique(...)` constraint:
-- Postgres treats NULL as distinct from NULL, so a plain unique constraint
-- would let a movie (episode_id is null) insert duplicate rows per user.
create unique index watch_events_episode_unique
  on public.watch_events (user_id, title_id, episode_id)
  where episode_id is not null;

create unique index watch_events_movie_unique
  on public.watch_events (user_id, title_id)
  where episode_id is null;

alter table public.watch_events enable row level security;

create policy "users can read their own watch events"
  on public.watch_events for select
  using (auth.uid() = user_id);

create policy "users can upsert their own watch events"
  on public.watch_events for insert
  with check (auth.uid() = user_id);

create policy "users can update their own watch events"
  on public.watch_events for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- COMMENTS / REVIEWS  (premium users only, enforced in policy + app layer)
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "comments are publicly readable"
  on public.comments for select
  using (true);

create policy "only premium users can post comments"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.plan = 'premium'
    )
  );

create policy "users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Convenience view: average rating + comment count per title
-- ---------------------------------------------------------------------------
create view public.title_ratings as
  select
    title_id,
    round(avg(rating)::numeric, 1) as average_rating,
    count(*) filter (where rating is not null) as rating_count,
    count(*) as comment_count
  from public.comments
  group by title_id;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- Run once (or create via Dashboard > Storage):
--   videos  -> PRIVATE  (streamed only via short-lived signed URLs)
--   posters -> PUBLIC   (poster art, safe to serve directly)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

-- Only admins may upload/modify files in the videos & posters buckets.
create policy "admins can upload videos"
  on storage.objects for insert
  with check (
    bucket_id = 'videos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "admins can upload posters"
  on storage.objects for insert
  with check (
    bucket_id = 'posters'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "posters are publicly readable"
  on storage.objects for select
  using (bucket_id = 'posters');

-- No public/select policy is created for the "videos" bucket on purpose:
-- all playback goes through signed URLs minted server-side in
-- /api/watch-progress after the access-control checks pass.

-- ---------------------------------------------------------------------------
-- To make the first admin: sign up normally, then run:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------------
