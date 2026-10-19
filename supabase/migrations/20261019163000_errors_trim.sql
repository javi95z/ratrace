-- Errors: the trimming to a thousand kinds of each source removes the excess, and no more.
--
-- The kinds that made room were picked by a subquery whose limit was itself a count of the table,
-- inside the delete that changed it. On the live project, noting the thousandth kind of a source
-- took away nearly all of them instead of the one seen longest ago. The excess is counted first,
-- the kinds that make room are picked once, and only then are they removed.

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
  excess integer;
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
  -- just noted, and never a row another note holds. How many is counted before any is picked, and they are
  -- picked once, before any is removed.
  select count(*) - 1000 into excess from public.error_kinds where source = p_source;
  if excess > 0 then
    delete from public.error_kinds where fingerprint = any (array(
      select fingerprint from public.error_kinds
      where source = p_source and fingerprint <> p_fingerprint
      order by last_seen asc
      limit excess
      for update skip locked
    ));
  end if;
  return jsonb_build_object('seen', times, 'alert', worth);
end;
$$;
revoke all on function public.note_error(text, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.note_error(text, text, text, text, text, text, text, timestamptz) to service_role;
