-- The events the game counts, kept in its own project: the eight the web counts with Vercel
-- (`apps/web/src/pwa/events.ts`), from the app as well as the web.
--
-- One row a day, event, props and platform, with how many times it happened. Nothing of who: no
-- id, no user, no address, no score. Only the server writes, through `count_event`, called by the
-- function `track`; nobody but the server reads. What an event may carry is held here as well as
-- in the function, so not even the server can keep a prop the game does not count.
--
-- A caller is held to a limit by a hash of their address and the day, made by the function with a
-- secret: the address itself never reaches the database, and the hash of a day is of no use the
-- next, so it is cleared after two.

-- True for an event the game counts, with exactly its props, each with a value it may take.
create function private.app_event_known(p_name text, p_props jsonb) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case p_name
    when 'life_start' then p_props in (select jsonb_build_object('mode', m) from unnest(array['solo', 'ranked', 'challenge', 'practice']) m)
    when 'life_end' then p_props in (select jsonb_build_object('mode', m, 'escaped', e) from unnest(array['solo', 'ranked', 'challenge', 'practice']) m, unnest(array[true, false]) e)
    when 'challenge_attempt' then p_props = '{}'::jsonb
    when 'game_start' then p_props in (select jsonb_build_object('kind', k) from unnest(array['friends', 'public']) k)
    when 'game_join' then p_props in (select jsonb_build_object('via', v) from unnest(array['code', 'link', 'quick']) v)
    when 'account_kept' then p_props = '{}'::jsonb
    when 'app_installed' then p_props = '{}'::jsonb
    when 'share' then p_props in (select jsonb_build_object('what', w) from unnest(array['card', 'invite']) w)
  end, false);
$$;
revoke all on function private.app_event_known(text, jsonb) from public, anon, authenticated;

create table private.app_events (
  -- Spain's day, as `private.today()` counts it, like the other usage numbers.
  day date not null,
  name text not null check (name in ('life_start', 'life_end', 'challenge_attempt', 'game_start', 'game_join', 'account_kept', 'app_installed', 'share')),
  props jsonb not null default '{}' check (private.app_event_known(name, props)),
  platform text not null check (platform in ('ios', 'android', 'web')),
  count int not null default 1 check (count >= 1),
  constraint app_events_one_row unique (day, name, props, platform)
);
alter table private.app_events enable row level security;
revoke all on private.app_events from public, anon, authenticated;

-- Counts one event today.
create function public.count_event(p_name text, p_props jsonb, p_platform text) returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.app_events as e (day, name, props, platform) values (private.today(), p_name, p_props, p_platform)
  on conflict (day, name, props, platform) do update set count = e.count + 1;
$$;
revoke all on function public.count_event(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.count_event(text, jsonb, text) to service_role;

-- Calls counted by a caller's hash, as `private.rate_use` counts them by player, for callers who
-- need not have an account. A hash only: never an address.
create table private.rate_by_hash (
  hash text not null check (hash ~ '^[0-9a-f]{32}$'),
  bucket text not null check (char_length(bucket) between 1 and 40),
  window_start timestamptz not null,
  used integer not null,
  primary key (hash, bucket)
);
create index rate_by_hash_window on private.rate_by_hash (window_start);
alter table private.rate_by_hash enable row level security;
revoke all on private.rate_by_hash from public, anon, authenticated;

-- True if this call is within what is allowed, false if it is one too many. It counts either way,
-- and clears the counts of days ago.
create function public.take_rate_by_hash(who text, what text, at_most integer, per_seconds integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken integer;
begin
  delete from private.rate_by_hash where window_start < clock_timestamp() - interval '2 days';
  insert into private.rate_by_hash as r (hash, bucket, window_start, used)
    values (who, what, clock_timestamp(), 1)
  on conflict (hash, bucket) do update set
    used = case when r.window_start + make_interval(secs => per_seconds) <= clock_timestamp() then 1 else r.used + 1 end,
    window_start = case when r.window_start + make_interval(secs => per_seconds) <= clock_timestamp() then clock_timestamp() else r.window_start end
  returning r.used into taken;
  return taken <= at_most;
end;
$$;
revoke all on function public.take_rate_by_hash(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate_by_hash(text, text, integer, integer) to service_role;
