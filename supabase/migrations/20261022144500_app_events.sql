-- The events the game counts, kept in its own project: the eight the web counts with Vercel
-- (`apps/web/src/pwa/events.ts`), from the app as well as the web.
--
-- One row a day, event, props and platform, with how many times it happened. Nothing of who: no
-- id, no user, no address, no score, and nothing kept about callers, not even to hold them to a
-- limit. Only the server writes, through `count_event`, called by the function `track`; nobody but
-- the server reads. What an event may carry is held here as well as in the function, so not even
-- the server can keep a prop the game does not count.
--
-- Anyone may call `track`, so a day's counts have a ceiling instead: so many of one event on one
-- platform, and no more (`count_event`). That bounds both what a script could add and how much is
-- kept, with no row about any caller.

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

-- Counts one event today, and answers true; or answers false, counting nothing, once the day's
-- ceiling of that event on that platform is reached.
create function public.count_event(p_name text, p_props jsonb, p_platform text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The day's ceiling of one event on one platform, its props together. A guess until there are
  -- numbers: revisit it after a week of `pnpm online:stats`, at about ten times the busiest day seen.
  ceiling constant integer := 20000;
  today constant date := private.today();
  counted integer;
begin
  -- A call over the ceiling is answered at once, without waiting its turn behind the others.
  select coalesce(sum(e.count), 0) into counted from private.app_events e where e.day = today and e.name = p_name and e.platform = p_platform;
  if counted >= ceiling then
    return false;
  end if;
  -- One call at a time for an event and platform of the day, so two at once cannot both pass the ceiling.
  perform pg_advisory_xact_lock(hashtextextended(format('app-event:%s:%s:%s', today, p_name, p_platform), 0));
  select coalesce(sum(e.count), 0) into counted from private.app_events e where e.day = today and e.name = p_name and e.platform = p_platform;
  if counted >= ceiling then
    return false;
  end if;
  insert into private.app_events as e (day, name, props, platform) values (today, p_name, p_props, p_platform)
  on conflict (day, name, props, platform) do update set count = e.count + 1;
  return true;
end;
$$;
revoke all on function public.count_event(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.count_event(text, jsonb, text) to service_role;
