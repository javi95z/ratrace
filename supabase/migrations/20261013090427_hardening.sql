-- Hardening after the review of the foundation, and what cloud saves need of the database.
--
--   * What is made in `public` from now on starts with nothing granted to clients.
--   * The dates of a row are the server's.
--   * A game is abandoned, never deleted, and a life that is over is closed to its owner.
--   * A player holds fifty games at most.

-- ------------------------------------------------------------------------------------------------
-- Future tables, sequences and functions. Supabase's own defaults hand all three to `anon` and
-- `authenticated` the moment they are created. The five tables were safe only because their
-- migration revoked by hand; the first function that forgot to would have been callable by anyone.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- Postgres lets everyone execute a new function unless told otherwise, in every schema.
alter default privileges for role postgres revoke execute on functions from public;

-- ------------------------------------------------------------------------------------------------
-- Dates. `created_at` is the moment a row was made and never changes; `updated_at` is the moment
-- of its last change. Neither is taken from the client, on the way in or after.
create function private.stamp_row() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.stamp_row() from public, anon, authenticated;

drop trigger profiles_touch on public.profiles;
drop trigger player_progress_touch on public.player_progress;
drop trigger games_touch on public.games;
drop trigger game_secrets_touch on public.game_secrets;
create trigger profiles_stamp before insert or update on public.profiles for each row execute function private.stamp_row();
create trigger player_progress_stamp before insert or update on public.player_progress for each row execute function private.stamp_row();
create trigger games_stamp before insert or update on public.games for each row execute function private.stamp_row();
create trigger game_secrets_stamp before insert or update on public.game_secrets for each row execute function private.stamp_row();
drop function private.touch_updated_at();

-- ------------------------------------------------------------------------------------------------
-- profiles: a portrait is the name of a starting life, and nothing that could be read as markup.
alter table public.profiles drop constraint profiles_portrait_check;
alter table public.profiles add constraint profiles_portrait_check check (portrait is null or portrait ~ '^[a-z0-9_]{1,40}$');

-- ------------------------------------------------------------------------------------------------
-- games.

-- The longest life the game can produce is under 100 KB of choices.
alter table public.games drop constraint games_log_check;
alter table public.games add constraint games_log_check check (jsonb_typeof(log) = 'array' and pg_column_size(log) <= 131072);

-- A game keeps its id. Its run takes the same one.
create function private.keep_game_id() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'a game keeps its id' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_game_id() from public, anon, authenticated;
create trigger games_keep_id before update on public.games for each row execute function private.keep_game_id();

-- Fifty games a player. Lives that are over make room for a new one, the oldest first; lives
-- still being played do not, so a player cannot be made to lose one by saving another.
-- It runs with the rights of its owner: a player may not delete a game, and this may.
create function private.make_room_for_game() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  held int;
begin
  select count(*) into held from public.games where user_id = new.user_id;
  if held >= 50 then
    delete from public.games where id in (
      select id from public.games where user_id = new.user_id and status <> 'playing' order by updated_at asc limit held - 49
    );
    select count(*) into held from public.games where user_id = new.user_id;
    if held >= 50 then
      raise exception 'a player holds fifty games at most' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.make_room_for_game() from public, anon, authenticated;
create trigger games_make_room before insert on public.games for each row execute function private.make_room_for_game();

-- A player saves a life while it is being played, and may abandon it. Finishing a life is the
-- server's: it plays the log again and writes the run. What is abandoned or finished is closed.
revoke delete on public.games from authenticated;
drop policy "a player deletes their own casual games" on public.games;
drop policy "a player saves their own casual games" on public.games;
drop policy "a player changes their own casual games" on public.games;
create policy "a player saves their own casual games" on public.games
  for insert to authenticated with check ((select auth.uid()) = user_id and mode = 'casual' and status = 'playing');
create policy "a player changes their own casual games while they are played" on public.games
  for update to authenticated
  using ((select auth.uid()) = user_id and mode = 'casual' and status = 'playing')
  with check ((select auth.uid()) = user_id and mode = 'casual' and status in ('playing', 'abandoned'));

-- ------------------------------------------------------------------------------------------------
-- runs.
comment on column public.runs.verified is 'True when the server played the log again itself and every figure in the row is the engine''s. Whether the future was secret while it was played is what `mode` says.';
