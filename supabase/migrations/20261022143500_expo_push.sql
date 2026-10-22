-- Push to the app, beside the web's: where each phone with the app can be told, by the token Expo's
-- push service gave it, and the clock's notices reading phones as well as browsers.
--
-- Additive: `push_subscriptions` and what the web does with it stay as they are. The clock's
-- notice functions answer each browser's row as before, with one column more, `token`, null for a
-- browser; a phone's row has only its token, its language and its player, and nulls for the keys
-- of a browser. A player's browsers and phones come together, so that the day's one notice is
-- claimed once for all of them.

create table public.push_tokens (
  -- Expo's token is unique to a phone's app: one row a phone, whoever is signed in there.
  token text primary key check (token like 'ExponentPushToken[%]' and char_length(token) <= 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  locale text check (locale in ('en', 'es', 'ru')),
  platform text check (platform in ('ios', 'android')),
  -- "Your market moved", apart from the other notices: off until the player turns it on.
  market_moved boolean not null default false,
  created_at timestamptz not null default now()
);

create index push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
grant select, insert, update, delete on public.push_tokens to authenticated;

-- A player sees, adds, changes and removes only the rows of their own phones.
create policy "own phones are read" on public.push_tokens for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "own phones are added" on public.push_tokens for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "own phones are changed" on public.push_tokens for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own phones are removed" on public.push_tokens for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------------------------
-- The clock's notices, with the phones. Their answers gain a column, so each is made again.

-- Every browser and phone that asked for notices, with the place its player came in a week's
-- challenge by their best attempt, if they played it, and how many players did.
drop function public.notice_week(text);
create function public.notice_week(week_id text)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid, place bigint, entrants bigint, token text)
language sql
stable
set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.id, r.score, r.finished_at
    from public.runs r
    where r.mode = 'ranked' and r.challenge = week_id
    order by r.user_id, r.score desc, r.finished_at asc, r.id
  ), placed as (
    select b.user_id,
      row_number() over (order by b.score desc, b.finished_at asc, b.id) as place,
      count(*) over () as entrants
    from best b
  ), devices as (
    select s.endpoint, s.p256dh, s.auth, s.locale, s.user_id, null::text as token from public.push_subscriptions s
    union all
    select null, null, null, coalesce(t.locale, 'en'), t.user_id, t.token from public.push_tokens t
  )
  select d.endpoint, d.p256dh, d.auth, d.locale, d.user_id, p.place, p.entrants, d.token
  from devices d
  left join placed p on p.user_id = d.user_id
  order by d.user_id, coalesce(d.endpoint, d.token);
$$;
revoke all on function public.notice_week(text) from public, anon, authenticated;
grant execute on function public.notice_week(text) to service_role;

-- The browsers and phones of players with a life of their own left untouched between seven and
-- eight days ago, and none played since: called once a day, each such life is told of once.
drop function public.notice_idle(timestamptz);
create function public.notice_idle(p_now timestamptz)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid, token text)
language sql
stable
set search_path = ''
as $$
  with devices as (
    select s.endpoint, s.p256dh, s.auth, s.locale, s.user_id, null::text as token from public.push_subscriptions s
    union all
    select null, null, null, coalesce(t.locale, 'en'), t.user_id, t.token from public.push_tokens t
  )
  select d.endpoint, d.p256dh, d.auth, d.locale, d.user_id, d.token
  from devices d
  where exists (
      select 1 from public.games g
      where g.user_id = d.user_id and g.status = 'playing' and g.mode in ('casual', 'ranked')
        and g.updated_at >= p_now - interval '8 days' and g.updated_at < p_now - interval '7 days'
    )
    and not exists (
      select 1 from public.games g
      where g.user_id = d.user_id and g.updated_at >= p_now - interval '7 days'
    )
  order by d.user_id, coalesce(d.endpoint, d.token);
$$;
revoke all on function public.notice_idle(timestamptz) from public, anon, authenticated;
grant execute on function public.notice_idle(timestamptz) to service_role;

-- The browsers and phones that want "your market moved", with the ranked life of each one's
-- player, as before: the language the player keeps in their account first, then the device's.
drop function public.notice_market(timestamptz);
create function public.notice_market(p_now timestamptz)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid, game_id uuid, life_id text, engine_version text, content_version text, challenge text, log jsonb, token text)
language sql
stable
set search_path = ''
as $$
  with devices as (
    select s.endpoint, s.p256dh, s.auth, s.locale, s.user_id, null::text as token from public.push_subscriptions s where s.market_moved
    union all
    select null, null, null, coalesce(t.locale, 'en'), t.user_id, t.token from public.push_tokens t where t.market_moved
  )
  select d.endpoint, d.p256dh, d.auth, coalesce(p.language, d.locale), d.user_id,
    g.id, g.life_id, g.engine_version, g.content_version, g.challenge, g.log, d.token
  from devices d
  join public.games g on g.user_id = d.user_id and g.mode = 'ranked' and g.status = 'playing'
    and g.updated_at <= p_now - interval '20 hours' and g.updated_at > p_now - interval '6 days'
  left join public.profiles p on p.user_id = d.user_id
  order by d.user_id, coalesce(d.endpoint, d.token);
$$;
revoke all on function public.notice_market(timestamptz) from public, anon, authenticated;
grant execute on function public.notice_market(timestamptz) to service_role;
