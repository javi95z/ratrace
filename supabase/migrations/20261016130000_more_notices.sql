-- More notices: the place a player came in last week's challenge, told with the new one; a life
-- left halfway for a week; and a cap of one notice a day for everything the clock sends. The
-- notices of a game with friends are urgent and are not capped: they are sent by the rooms function.

-- The day of each player's last notice from the clock. Read and written only by the functions.
create table public.notice_days (
  user_id uuid primary key references auth.users (id) on delete cascade,
  day date not null
);
alter table public.notice_days enable row level security;
revoke all on public.notice_days from public, anon, authenticated;

-- Takes a player's notice of the day: true if they had none yet that day, and it is now taken.
create function public.notice_claim(p_user uuid, p_day date)
returns boolean
language sql
volatile
set search_path = ''
as $$
  with taken as (
    insert into public.notice_days as d (user_id, day) values (p_user, p_day)
    on conflict (user_id) do update set day = excluded.day where d.day < excluded.day
    returning 1
  )
  select exists (select 1 from taken);
$$;
revoke all on function public.notice_claim(uuid, date) from public, anon, authenticated;
grant execute on function public.notice_claim(uuid, date) to service_role;

-- Every browser that asked for notices, with the place its player came in a week's challenge, if
-- they played it, and how many did. In the order of their players, so that a player's browsers
-- come together.
create function public.notice_week(week_id text)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid, place bigint, entrants bigint)
language sql
stable
set search_path = ''
as $$
  with placed as (
    select r.user_id,
      row_number() over (order by r.score desc, r.finished_at asc, r.id) as place,
      count(*) over () as entrants
    from public.runs r
    where r.mode = 'ranked' and r.challenge = week_id
  )
  select s.endpoint, s.p256dh, s.auth, s.locale, s.user_id, p.place, p.entrants
  from public.push_subscriptions s
  left join placed p on p.user_id = s.user_id
  order by s.user_id, s.endpoint;
$$;
revoke all on function public.notice_week(text) from public, anon, authenticated;
grant execute on function public.notice_week(text) to service_role;

-- The browsers of players with a life of their own left untouched between seven and eight days
-- ago, and none played since: called once a day, each such life is told of once.
create function public.notice_idle(p_now timestamptz)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid)
language sql
stable
set search_path = ''
as $$
  select s.endpoint, s.p256dh, s.auth, s.locale, s.user_id
  from public.push_subscriptions s
  where exists (
      select 1 from public.games g
      where g.user_id = s.user_id and g.status = 'playing' and g.mode in ('casual', 'ranked')
        and g.updated_at >= p_now - interval '8 days' and g.updated_at < p_now - interval '7 days'
    )
    and not exists (
      select 1 from public.games g
      where g.user_id = s.user_id and g.updated_at >= p_now - interval '7 days'
    )
  order by s.user_id, s.endpoint;
$$;
revoke all on function public.notice_idle(timestamptz) from public, anon, authenticated;
grant execute on function public.notice_idle(timestamptz) to service_role;

-- The evening job for lives left halfway. The Monday job of the weekly challenge stays as it is.
select cron.schedule(
  'idle-notice',
  -- Every day at 17:00 UTC: after work in Europe, before it in America.
  '0 17 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-notice',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    ),
    body := '{"kind":"idle"}'::jsonb
  );
  $$
);
