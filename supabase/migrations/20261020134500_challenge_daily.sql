-- The weekly challenge, one attempt a day.
--
-- The life, the rule and the world stay the week's, the same for everyone. What changes is how often
-- an attempt counts: once a day (UTC) instead of once a week. The ranking keeps each player's best
-- attempt of the week, and counts players, not attempts. What everyone chose on each card is told
-- only once the week is over: told sooner, the next day's attempt would be played knowing it.

-- An entry is a player's attempt of a day. The rows from before were each the attempt of the day it began.
alter table public.challenge_entries add column day date;
update public.challenge_entries set day = (created_at at time zone 'utc')::date;
alter table public.challenge_entries
  alter column day set not null,
  alter column day set default ((now() at time zone 'utc')::date);
alter table public.challenge_entries drop constraint challenge_entries_pkey;
alter table public.challenge_entries add primary key (user_id, day);
create index challenge_entries_week on public.challenge_entries (user_id, week);

-- ------------------------------------------------------------------------------------------------
-- The ranking of a week's challenge: each player's best attempt, higher score first, the earlier of
-- two equal ones first. It answers the first so many, the asker's own place if it is further down,
-- and how many players took part. It reads with the asker's own rights.
create or replace function public.challenge_ranking(week_id text, top integer default 50)
returns table (place bigint, user_id uuid, nickname text, portrait text, score integer, finished_at timestamptz, run_id uuid, entrants bigint)
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
    select b.user_id, b.id, b.score, b.finished_at,
      row_number() over (order by b.score desc, b.finished_at asc, b.id) as place,
      count(*) over () as entrants
    from best b
  )
  select p.place, p.user_id, pr.nickname, pr.portrait, p.score, p.finished_at, p.id, p.entrants
  from placed p left join public.profiles pr on pr.user_id = p.user_id
  where p.place <= least(greatest(coalesce(top, 50), 1), 100) or p.user_id = (select auth.uid())
  order by p.place;
$$;

-- ------------------------------------------------------------------------------------------------
-- What the asker chose on each card of their best attempt of a week, in order. Once the week is over,
-- with how many players' best attempts chose the same and how many answered that card at all; until
-- then those two are nothing, and the page says nothing of them.
create or replace function public.challenge_choices(week_id text)
returns table (seq smallint, card_id text, option smallint, same bigint, answered bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.id
    from public.runs r
    where r.mode = 'ranked' and r.challenge = week_id
    order by r.user_id, r.score desc, r.finished_at asc, r.id
  ), mine as (
    select p.seq, p.card_id, p.option
    from public.challenge_picks p join best b on b.id = p.run_id
    where b.user_id = (select auth.uid())
  ), everyone as (
    select p.card_id, p.option, count(*) as n
    from public.challenge_picks p join best b on b.id = p.run_id
    -- Weeks are written "2026-W42": an earlier week is an earlier text.
    where week_id < to_char((now() at time zone 'utc')::date, 'IYYY-"W"IW')
    group by p.card_id, p.option
  ), totals as (
    select e.card_id, sum(e.n)::bigint as answered from everyone e group by e.card_id
  )
  select m.seq, m.card_id, m.option, coalesce(e.n, 0), coalesce(t.answered, 0)
  from mine m
  left join everyone e on e.card_id = m.card_id and e.option = m.option
  left join totals t on t.card_id = m.card_id
  order by m.seq;
$$;

-- ------------------------------------------------------------------------------------------------
-- Every browser that asked for notices, with the place its player came in a week's challenge by
-- their best attempt, if they played it, and how many players did.
create or replace function public.notice_week(week_id text)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid, place bigint, entrants bigint)
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
  )
  select s.endpoint, s.p256dh, s.auth, s.locale, s.user_id, p.place, p.entrants
  from public.push_subscriptions s
  left join placed p on p.user_id = s.user_id
  order by s.user_id, s.endpoint;
$$;
