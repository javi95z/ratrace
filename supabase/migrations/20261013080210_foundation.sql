-- The Rat Race, online foundation: who a player is, what they have unlocked, the lives they are
-- living and the lives they have finished.
--
-- Rules that hold for every table here:
--   * Row-level security is on. A table a client may reach has policies; one it may not has none.
--   * Nothing is granted to `anon`: nobody reads this game's data without an account, and a
--     guest account costs the player nothing.
--   * `authenticated` is granted only the verbs a table needs. A guest is `authenticated` too.
--   * The server writes with the project's secret key, which skips both grants and policies.
--   * Deleting an account deletes its rows.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Stamps a row with the moment it was changed, whatever the client sent.
create function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- profiles: how a player is shown to others.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Optional until rankings arrive. Letters, digits and the underscore, so it cannot be dressed up as someone else's.
  nickname text check (nickname is null or nickname ~ '^[A-Za-z0-9_]{3,16}$'),
  -- The starting life whose face the player wears.
  portrait text check (portrait is null or char_length(portrait) <= 40),
  language text not null default 'en' check (language in ('en', 'es')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One nickname, however it is capitalised.
create unique index profiles_nickname_key on public.profiles (lower(nickname));
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "any signed-in player reads profiles" on public.profiles
  for select to authenticated using (true);
create policy "a player creates their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "a player changes their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------------------------
-- player_progress: what a player has unlocked and collected, as the game keeps it on the device.
create table public.player_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null default '{}' check (jsonb_typeof(progress) = 'object' and pg_column_size(progress) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger player_progress_touch before update on public.player_progress for each row execute function private.touch_updated_at();

alter table public.player_progress enable row level security;
revoke all on public.player_progress from public, anon, authenticated;
grant select, insert, update on public.player_progress to authenticated;

create policy "a player reads their own progress" on public.player_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "a player creates their own progress" on public.player_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "a player changes their own progress" on public.player_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------------------------
-- games: a life being lived. A casual one belongs to the device that plays it and is saved here;
-- a ranked one is played by the server, and its seed is not in this table.
create table public.games (
  -- Made on the device, so a game saved offline keeps its name when it is uploaded.
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('casual', 'ranked')),
  life_id text not null check (char_length(life_id) between 1 and 40),
  engine_version text not null check (char_length(engine_version) between 1 and 20),
  content_version text not null check (char_length(content_version) between 1 and 20),
  -- A casual game's seed. A ranked game's seed is in game_secrets, where no client can read it.
  seed text check (seed is null or char_length(seed) between 1 and 80),
  round smallint not null default 0 check (round between 0 and 40),
  status text not null default 'playing' check (status in ('playing', 'finished', 'abandoned')),
  -- What the player chose, round by round. With the seed it is the whole game.
  log jsonb not null default '[]' check (jsonb_typeof(log) = 'array' and pg_column_size(log) <= 262144),
  state_hash text check (state_hash is null or char_length(state_hash) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_seed_follows_mode check ((mode = 'ranked') = (seed is null))
);
create index games_owner_latest on public.games (user_id, updated_at desc);
create trigger games_touch before update on public.games for each row execute function private.touch_updated_at();

alter table public.games enable row level security;
revoke all on public.games from public, anon, authenticated;
grant select, insert, update, delete on public.games to authenticated;

create policy "a player reads their own games" on public.games
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "a player saves their own casual games" on public.games
  for insert to authenticated with check ((select auth.uid()) = user_id and mode = 'casual');
create policy "a player changes their own casual games" on public.games
  for update to authenticated using ((select auth.uid()) = user_id and mode = 'casual') with check ((select auth.uid()) = user_id and mode = 'casual');
create policy "a player deletes their own casual games" on public.games
  for delete to authenticated using ((select auth.uid()) = user_id and mode = 'casual');

-- ------------------------------------------------------------------------------------------------
-- game_secrets: the seed and the server's state of a ranked game. The future of a game follows
-- from its seed, so no client may ever read this. No grant, no policy: only the server reaches it.
create table public.game_secrets (
  game_id uuid primary key references public.games (id) on delete cascade,
  seed text not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger game_secrets_touch before update on public.game_secrets for each row execute function private.touch_updated_at();

alter table public.game_secrets enable row level security;
revoke all on public.game_secrets from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- runs: a finished life, as the server found it by playing the log again. Players read them; only
-- the server writes them, which is what makes a score worth comparing.
create table public.runs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  mode text not null check (mode in ('casual', 'ranked')),
  life_id text not null,
  engine_version text not null,
  content_version text not null,
  score integer not null,
  -- At the end, in start-of-game cents.
  net_worth bigint not null,
  status smallint not null,
  escaped_at_round smallint,
  bankruptcies smallint not null default 0,
  badges text[] not null default '{}',
  cities text[] not null default '{}',
  history bigint[] not null default '{}',
  -- True when the server played the whole game itself (ranked). A casual run was replayed from a
  -- log the device kept, and a device can peek at its own future.
  verified boolean not null default false,
  finished_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index runs_owner_latest on public.runs (user_id, finished_at desc);
create index runs_by_score on public.runs (score desc) where verified;
create index runs_game on public.runs (game_id);

alter table public.runs enable row level security;
revoke all on public.runs from public, anon, authenticated;
grant select on public.runs to authenticated;

create policy "any signed-in player reads runs" on public.runs
  for select to authenticated using (true);
