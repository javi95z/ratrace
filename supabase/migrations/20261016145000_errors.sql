-- Errors: the errors of the page and of the functions, kept in one place, one row a kind.
--
-- Only the server writes here, through `note_error`, and nobody but the server reads it: a row is a
-- kind of error (its fingerprint, made by the server from the cleaned message, the place and the
-- first frame of the stack), when it was first and last seen, how often, and its last example.
-- Nothing of who met it is kept. A kind seen for the first time, or again after a day without it, is
-- worth an alert, ten an hour at most: `note_error` says so, and the function that called it sends it.

create table public.error_kinds (
  fingerprint text primary key check (char_length(fingerprint) between 1 and 80),
  source text not null check (source in ('page', 'function')),
  -- A page's path, with no query, no hash and no language; or a function's name.
  place text not null check (char_length(place) between 1 and 200),
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  -- The version of the game that met it, as "engine/content", with the commit where the build names it.
  build text check (build is null or char_length(build) <= 80),
  -- A browser's name and major version.
  browser text check (browser is null or char_length(browser) <= 80),
  seen integer not null default 1 check (seen >= 1),
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  alerted_at timestamptz
);
create index error_kinds_latest on public.error_kinds (last_seen);
create index error_kinds_alerted on public.error_kinds (alerted_at) where alerted_at is not null;
alter table public.error_kinds enable row level security;
revoke all on public.error_kinds from public, anon, authenticated;

-- Notes one error of a kind at `p_now`, by the server's clock. Answers how many times the kind has
-- been seen, and whether this one is worth an alert.
create function public.note_error(p_fingerprint text, p_source text, p_place text, p_message text, p_stack text, p_build text, p_browser text, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.error_kinds;
  times integer;
  worth boolean;
  alerted integer;
begin
  -- One kind at a time: two reports of a new kind at once would both find it new.
  perform pg_advisory_xact_lock(hashtextextended('error-kind:' || p_fingerprint, 0));
  select * into was from public.error_kinds where fingerprint = p_fingerprint;
  worth := not found or was.last_seen < p_now - interval '1 day';
  if worth then
    -- Ten alerts in an hour at most, whatever comes.
    select count(*) into alerted from public.error_kinds where alerted_at > p_now - interval '1 hour';
    worth := alerted < 10;
  end if;
  insert into public.error_kinds as e (fingerprint, source, place, message, stack, build, browser, seen, first_seen, last_seen, alerted_at)
    values (p_fingerprint, p_source, p_place, p_message, p_stack, p_build, p_browser, 1, p_now, p_now, case when worth then p_now end)
    on conflict (fingerprint) do update
      set seen = e.seen + 1, last_seen = greatest(e.last_seen, p_now), message = excluded.message, stack = excluded.stack, build = excluded.build, browser = excluded.browser, place = excluded.place,
          alerted_at = case when worth then p_now else e.alerted_at end
    returning e.seen into times;
  -- A thousand kinds at most: the ones seen longest ago make room.
  delete from public.error_kinds where fingerprint in (
    select fingerprint from public.error_kinds order by last_seen asc
    limit greatest(0, (select count(*) from public.error_kinds) - 1000)
  );
  return jsonb_build_object('seen', times, 'alert', worth);
end;
$$;
revoke all on function public.note_error(text, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.note_error(text, text, text, text, text, text, text, timestamptz) to service_role;
