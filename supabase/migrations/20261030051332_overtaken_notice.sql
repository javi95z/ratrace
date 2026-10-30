-- "A friend passed you": when a ranked life ends as its player's best of the week, each friend it
-- puts them above in this week's ranking among friends is told, once a day at most. Sent by the
-- ranked function (`_shared/overtaken.ts`), after the run is written.

-- The day each player was last told a friend passed them. Read and written only by the functions.
create table public.overtaken_days (
  user_id uuid primary key references auth.users (id) on delete cascade,
  day date not null
);
alter table public.overtaken_days enable row level security;
revoke all on public.overtaken_days from public, anon, authenticated;

-- Takes a player's notice of being passed for the day: true if they had none yet that day, and it is now taken.
create function public.overtaken_claim(p_user uuid, p_day date)
returns boolean
language sql
volatile
set search_path = ''
as $$
  with taken as (
    insert into public.overtaken_days as d (user_id, day) values (p_user, p_day)
    on conflict (user_id) do update set day = excluded.day where d.day < excluded.day
    returning 1
  )
  select exists (select 1 from taken);
$$;
revoke all on function public.overtaken_claim(uuid, date) from public, anon, authenticated;
grant execute on function public.overtaken_claim(uuid, date) to service_role;

-- The best ranked score of each of some players among the lives they finished from a moment on (the
-- week's start, as `ranking` counts weeks), leaving one run out: the one just written. A player with
-- none is not in the answer. Read on `runs_ranked_best`.
create function public.overtaken_bests(p_users uuid[], p_since timestamptz, p_except uuid)
returns table (user_id uuid, score integer)
language sql
stable
set search_path = ''
as $$
  select r.user_id, max(r.score)::integer
  from public.runs r
  where r.mode = 'ranked'
    and r.user_id = any (p_users)
    and r.finished_at >= p_since
    and r.id <> p_except
  group by r.user_id;
$$;
revoke all on function public.overtaken_bests(uuid[], timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.overtaken_bests(uuid[], timestamptz, uuid) to service_role;
