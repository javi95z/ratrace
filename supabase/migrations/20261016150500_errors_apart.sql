-- Errors, kept apart by where they come from.
--
-- A page's report is sent by a player, and any player could make them up: a flood of made-up kinds
-- must not silence the alerts of the functions, nor push their kinds out. So the pages and the
-- functions have ten alerts an hour each, and a thousand kinds each. A kind that came when there was
-- no alert left is alerted the next time it comes and there is one, rather than a day later. Two
-- notes at once never wait on, or remove, each other's rows.

create or replace function public.note_error(p_fingerprint text, p_source text, p_place text, p_message text, p_stack text, p_build text, p_browser text, p_now timestamptz)
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
  worth := not found or was.alerted_at is null or was.last_seen < p_now - interval '1 day';
  if worth then
    -- Ten alerts in an hour at most for each source, whatever comes.
    select count(*) into alerted from public.error_kinds where source = p_source and alerted_at > p_now - interval '1 hour';
    worth := alerted < 10;
  end if;
  insert into public.error_kinds as e (fingerprint, source, place, message, stack, build, browser, seen, first_seen, last_seen, alerted_at)
    values (p_fingerprint, p_source, p_place, p_message, p_stack, p_build, p_browser, 1, p_now, p_now, case when worth then p_now end)
    on conflict (fingerprint) do update
      set seen = e.seen + 1, last_seen = greatest(e.last_seen, p_now), message = excluded.message, stack = excluded.stack, build = excluded.build, browser = excluded.browser, place = excluded.place,
          alerted_at = case when worth then p_now else e.alerted_at end
    returning e.seen into times;
  -- A thousand kinds of each source at most: the ones of that source seen longest ago make room. Never the kind
  -- just noted, and never a row another note holds.
  delete from public.error_kinds where fingerprint in (
    select fingerprint from public.error_kinds
    where source = p_source and fingerprint <> p_fingerprint
    order by last_seen asc
    limit greatest(0, (select count(*) from public.error_kinds where source = p_source) - 1000)
    for update skip locked
  );
  return jsonb_build_object('seen', times, 'alert', worth);
end;
$$;
revoke all on function public.note_error(text, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.note_error(text, text, text, text, text, text, text, timestamptz) to service_role;

create index error_kinds_by_source on public.error_kinds (source, last_seen);
