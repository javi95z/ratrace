-- Weekly challenges.
--
-- One life and one rule for everyone, for a week (weeks begin on Monday, UTC). Which life and which
-- rule follow from the week alone, in the game's own code; the world and the cards follow from a
-- seed the server makes the first time the week's challenge is asked for, the same for every player
-- and readable by none. Each player has one ranked attempt a week: it is entered when it begins, and
-- an attempt given up is still the week's attempt. A practice is a casual life under the same rule.
-- What the players chose on each card is kept apart, and told only, in sums, to someone who has
-- finished the week's challenge: before that it would say which cards are coming.

-- ------------------------------------------------------------------------------------------------
-- The seed of each week. Only the server reads or writes it.
create table public.challenge_seeds (
  week text primary key check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  seed text not null check (char_length(seed) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table public.challenge_seeds enable row level security;
revoke all on public.challenge_seeds from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- Who has had their attempt of which week. Written by the server when the attempt begins; kept when
-- the game itself is cleared away to make room, so that a week's attempt cannot be had twice.
create table public.challenge_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  week text not null check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  game_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.challenge_entries enable row level security;
revoke all on public.challenge_entries from public, anon, authenticated;
grant select on public.challenge_entries to authenticated;
create policy "a player reads their own challenge entries" on public.challenge_entries
  for select to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------------------------------------------------------------------
-- The week a game and a run belong to: a ranked attempt, or a practice, which is casual.
alter table public.games add column challenge text check (challenge is null or challenge ~ '^[0-9]{4}-W[0-9]{2}$');
alter table public.runs add column challenge text check (challenge is null or challenge ~ '^[0-9]{4}-W[0-9]{2}$');
create index runs_challenge on public.runs (challenge, score desc, finished_at, id) where challenge is not null and mode = 'ranked';

-- ------------------------------------------------------------------------------------------------
-- What each attempt chose on each card, in the order it was played. Only the server writes it, and
-- nobody reads it but through `challenge_choices`.
create table public.challenge_picks (
  run_id uuid not null references public.runs (id) on delete cascade,
  week text not null check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  seq smallint not null check (seq between 0 and 400),
  card_id text not null check (char_length(card_id) between 1 and 60),
  option smallint not null check (option between 0 and 3),
  primary key (run_id, seq)
);
create index challenge_picks_week on public.challenge_picks (week, card_id, option);
alter table public.challenge_picks enable row level security;
revoke all on public.challenge_picks from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- The ranking of a week's challenge: every attempt, higher score first, the earlier of two equal
-- ones first. It answers the first so many, the asker's own place if it is further down, and how
-- many took part. It reads with the asker's own rights.
create function public.challenge_ranking(week_id text, top integer default 50)
returns table (place bigint, user_id uuid, nickname text, portrait text, score integer, finished_at timestamptz, run_id uuid, entrants bigint)
language sql
stable
set search_path = ''
as $$
  with placed as (
    select r.user_id, r.id, r.score, r.finished_at,
      row_number() over (order by r.score desc, r.finished_at asc, r.id) as place,
      count(*) over () as entrants
    from public.runs r
    where r.mode = 'ranked' and r.challenge = week_id
  )
  select p.place, p.user_id, pr.nickname, pr.portrait, p.score, p.finished_at, p.id, p.entrants
  from placed p left join public.profiles pr on pr.user_id = p.user_id
  where p.place <= least(greatest(coalesce(top, 50), 1), 100) or p.user_id = (select auth.uid())
  order by p.place;
$$;
revoke all on function public.challenge_ranking(text, integer) from public, anon, authenticated;
grant execute on function public.challenge_ranking(text, integer) to authenticated;

-- ------------------------------------------------------------------------------------------------
-- What the asker chose on each card of their attempt of a week, in order, with how many attempts
-- chose the same and how many answered that card at all. Nothing for someone who has not finished
-- that week's challenge.
create function public.challenge_choices(week_id text)
returns table (seq smallint, card_id text, option smallint, same bigint, answered bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select p.seq, p.card_id, p.option
    from public.challenge_picks p join public.runs r on r.id = p.run_id
    where r.user_id = (select auth.uid()) and r.mode = 'ranked' and r.challenge = week_id
  ), everyone as (
    select p.card_id, p.option, count(*) as n from public.challenge_picks p where p.week = week_id group by p.card_id, p.option
  ), totals as (
    select e.card_id, sum(e.n)::bigint as answered from everyone e group by e.card_id
  )
  select m.seq, m.card_id, m.option, coalesce(e.n, 0), coalesce(t.answered, 0)
  from mine m
  left join everyone e on e.card_id = m.card_id and e.option = m.option
  left join totals t on t.card_id = m.card_id
  order by m.seq;
$$;
revoke all on function public.challenge_choices(text) from public, anon, authenticated;
grant execute on function public.challenge_choices(text) to authenticated;
