-- The days each player played: what the usage numbers count (`pnpm online:stats`).
--
-- A game's row keeps only when it was last touched, so whether a player came back the day after
-- they began, or a week after, could not be told. This keeps one row a day a player played: their
-- id and the day, in Spain's time, and nothing else. It is written by the database itself whenever a
-- life of theirs is saved, made or played on the server, so the page sends nothing for it. A rat
-- plays no days. An account deleted takes its days with it. Nobody but the server reads it.

create table private.player_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table private.player_days enable row level security;
revoke all on private.player_days from public, anon, authenticated;

-- The day as the game's players mostly live it.
create function private.today() returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;
revoke all on function private.today() from public, anon, authenticated;

-- Notes that the player of a life played today, once a day.
create function private.note_player_day() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.room_bots where user_id = new.user_id) then
    insert into private.player_days (user_id, day) values (new.user_id, private.today()) on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function private.note_player_day() from public, anon, authenticated;

create trigger games_player_day after insert or update on public.games for each row execute function private.note_player_day();

-- The days already known from what was kept: when each life began, when it was last played, when each ended.
insert into private.player_days (user_id, day)
  select user_id, (created_at at time zone 'Europe/Madrid')::date from public.games
  union select user_id, (updated_at at time zone 'Europe/Madrid')::date from public.games
  union select user_id, (finished_at at time zone 'Europe/Madrid')::date from public.runs
on conflict do nothing;
delete from private.player_days where user_id in (select user_id from public.room_bots);
