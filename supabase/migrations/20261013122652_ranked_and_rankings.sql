-- Ranked lives and rankings (roadmap step 13).
--
--   * A ranked life: the server keeps its seed, and one is in progress a player.
--   * Calls to the functions are counted, for each player.
--   * Finished casual lives are bounded; rankings read ranked lives only.
--   * A player has a friend code, and a name that is checked here, where a client cannot skip it.
--   * Friends are people a player follows, by code.
--   * One function answers every ranking.
--
-- Everything here is an addition: the game as it was keeps working against this database.

-- ------------------------------------------------------------------------------------------------
-- Ranked games. The server keeps the seed and plays the log again from it at every step, so there
-- is no state to keep beside it.
alter table public.game_secrets alter column state drop not null;
comment on column public.game_secrets.state is 'Not used: a ranked life is played again from its seed and its log at every step.';

-- One ranked life in progress a player. Starting another gives the first up, and the server does that first.
create unique index games_one_ranked_in_progress on public.games (user_id) where mode = 'ranked' and status = 'playing';

-- ------------------------------------------------------------------------------------------------
-- Calls are counted for each player and each kind of call, in a window of so many seconds. One
-- row a player and kind. Only the server counts: the functions ask before they do any work.
create table private.rate_use (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 40),
  window_start timestamptz not null,
  used integer not null,
  primary key (user_id, bucket)
);
alter table private.rate_use enable row level security;
revoke all on private.rate_use from public, anon, authenticated;

-- True if this call is within what is allowed, false if it is one too many. It counts either way.
create function public.take_rate(who uuid, what text, at_most integer, per_seconds integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken integer;
begin
  insert into private.rate_use as r (user_id, bucket, window_start, used)
    values (who, what, clock_timestamp(), 1)
  on conflict (user_id, bucket) do update set
    used = case when r.window_start + make_interval(secs => per_seconds) <= clock_timestamp() then 1 else r.used + 1 end,
    window_start = case when r.window_start + make_interval(secs => per_seconds) <= clock_timestamp() then clock_timestamp() else r.window_start end
  returning r.used into taken;
  return taken <= at_most;
end;
$$;
revoke all on function public.take_rate(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate(uuid, text, integer, integer) to service_role;

-- ------------------------------------------------------------------------------------------------
-- Finished lives. A casual life is an honest replay, but a player could finish as many as they
-- liked: five hundred are kept, and the oldest make room. Ranked lives are not counted among them.
create function private.make_room_for_run() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  held integer;
begin
  if new.mode <> 'casual' or exists (select 1 from public.runs where id = new.id) then
    return new;
  end if;
  select count(*) into held from public.runs where user_id = new.user_id and mode = 'casual';
  if held >= 500 then
    delete from public.runs where id in (
      select id from public.runs where user_id = new.user_id and mode = 'casual' order by finished_at asc, id limit held - 499
    );
  end if;
  return new;
end;
$$;
revoke all on function private.make_room_for_run() from public, anon, authenticated;
create trigger runs_make_room before insert on public.runs for each row execute function private.make_room_for_run();

-- Rankings read ranked lives. The index over "every verified run" served a ranking that would have
-- mixed the two kinds.
drop index public.runs_by_score;
create index runs_ranked_by_score on public.runs (score desc, finished_at) where mode = 'ranked';

-- ------------------------------------------------------------------------------------------------
-- Profiles: a friend code, given by the server, and a name that is checked.

-- Eight characters that cannot be mistaken for one another when read aloud or copied by hand.
create function private.new_friend_code() returns text
language plpgsql
set search_path = ''
as $$
declare
  letters constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    -- Bytes 6 and 8 of a random id are not all random; these eight are.
    for i in 0..5 loop
      code := code || substr(letters, 1 + (get_byte(bytes, i) % 31), 1);
    end loop;
    code := code || substr(letters, 1 + (get_byte(bytes, 10) % 31), 1) || substr(letters, 1 + (get_byte(bytes, 11) % 31), 1);
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;
revoke all on function private.new_friend_code() from public, anon, authenticated;

alter table public.profiles add column friend_code text;
update public.profiles set friend_code = private.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;
alter table public.profiles add constraint profiles_friend_code_check check (friend_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$');
create unique index profiles_friend_code_key on public.profiles (friend_code);

-- A player writes their name, portrait and language, and nothing else of their profile. The code
-- is not theirs to choose: with the whole table open to them it could be made to say anything.
revoke insert, update on public.profiles from authenticated;
grant insert (user_id, nickname, portrait, language) on public.profiles to authenticated;
grant update (user_id, nickname, portrait, language) on public.profiles to authenticated;

-- Names that are not accepted. `whole` ones are refused only as the whole name (they are, or look
-- like, somebody the player is not, or are a short word inside many innocent ones); the others
-- wherever they appear. It is a list, and a list is never complete: it stops the casual, not the
-- determined, and a ranking has a person behind it who can remove a name.
create table private.unwelcome_names (
  word text primary key check (word = lower(word) and word ~ '^[a-z]+$'),
  whole boolean not null default false
);
alter table private.unwelcome_names enable row level security;
revoke all on private.unwelcome_names from public, anon, authenticated;
insert into private.unwelcome_names (word, whole) values
  ('admin', true), ('administrator', true), ('moderator', true), ('mod', true), ('support', true), ('staff', true), ('system', true), ('server', true),
  ('official', true), ('ratrace', true), ('theratrace', true), ('anthropic', true), ('claude', true), ('supabase', true), ('null', true), ('undefined', true),
  ('anonymous', true), ('guest', true), ('rat', true), ('root', true), ('owner', true),
  ('puta', true), ('puto', true), ('polla', true), ('culo', true), ('verga', true), ('joder', true), ('cono', true), ('dick', true), ('cock', true), ('rape', true), ('ass', true),
  ('fuck', false), ('shit', false), ('bitch', false), ('cunt', false), ('nigger', false), ('nigga', false), ('faggot', false), ('retard', false), ('whore', false),
  ('slut', false), ('rapist', false), ('nazi', false), ('hitler', false), ('porn', false), ('penis', false), ('vagina', false), ('pussy', false), ('asshole', false),
  ('bastard', false), ('wanker', false), ('twat', false), ('pedo', false), ('paedo', false), ('kkk', false),
  ('hijodeputa', false), ('hijoputa', false), ('putamadre', false), ('putita', false), ('putas', false), ('putos', false), ('mierda', false), ('cabron', false),
  ('gilipollas', false), ('maricon', false), ('pendejo', false), ('subnormal', false), ('negrata', false), ('sudaca', false), ('zorra', false);

-- A name as it reads: small letters, the digits that stand for letters turned back into them, and
-- nothing between the letters.
create function private.plain_name(name text) returns text
language sql
immutable
set search_path = ''
as $$
  select replace(translate(lower(name), '013457', 'oieast'), '_', '');
$$;
revoke all on function private.plain_name(text) from public, anon, authenticated;

create function private.check_nickname() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plain text;
begin
  if new.nickname is null or (tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname) then
    return new;
  end if;
  plain := private.plain_name(new.nickname);
  if exists (select 1 from private.unwelcome_names u where (u.whole and plain = u.word) or (not u.whole and position(u.word in plain) > 0)) then
    raise exception 'that name is not accepted' using errcode = 'RR002';
  end if;
  return new;
end;
$$;
revoke all on function private.check_nickname() from public, anon, authenticated;

create function private.give_friend_code() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.friend_code := private.new_friend_code();
  return new;
end;
$$;
revoke all on function private.give_friend_code() from public, anon, authenticated;

create trigger profiles_friend_code before insert on public.profiles for each row execute function private.give_friend_code();
create trigger profiles_nickname before insert or update on public.profiles for each row execute function private.check_nickname();

-- ------------------------------------------------------------------------------------------------
-- Friends: whom a player follows. One-way, and it needs no answer: it only decides whose lives a
-- player sees in their ranking among friends, and those lives can be read by every player anyway.
create table public.friendships (
  follower uuid not null references auth.users (id) on delete cascade,
  followed uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followed),
  constraint friendships_not_oneself check (follower <> followed)
);
create index friendships_followed on public.friendships (followed);
alter table public.friendships enable row level security;
revoke all on public.friendships from public, anon, authenticated;
grant select, delete on public.friendships to authenticated;

create policy "a player sees whom they follow and who follows them" on public.friendships
  for select to authenticated using ((select auth.uid()) in (follower, followed));
create policy "a player stops following whom they chose to follow" on public.friendships
  for delete to authenticated using ((select auth.uid()) = follower);

-- Follows the player a friend code belongs to. It runs with the rights of its owner because a
-- player cannot write `friendships`: the only way in is to know a code. It answers in a word.
create function public.add_friend(code text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  them uuid;
begin
  if me is null then
    raise exception 'nobody is signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.user_id into them from public.profiles p where p.friend_code = upper(btrim(coalesce(code, '')));
  if them is null then
    return 'unknown';
  end if;
  if them = me then
    return 'self';
  end if;
  if exists (select 1 from public.friendships f where f.follower = me and f.followed = them) then
    return 'ok';
  end if;
  if (select count(*) from public.friendships f where f.follower = me) >= 200 then
    return 'full';
  end if;
  insert into public.friendships (follower, followed) values (me, them) on conflict do nothing;
  return 'ok';
end;
$$;
revoke all on function public.add_friend(text) from public, anon, authenticated;
grant execute on function public.add_friend(text) to authenticated;

-- ------------------------------------------------------------------------------------------------
-- Rankings. The best ranked life of each player: of all time, or finished this week (weeks begin
-- on Monday, UTC); of one starting life or of any; among everyone, or among the asker and whom
-- they follow. Higher score first; of two equal scores, the earlier. It answers the first so many,
-- and the asker's own place if it is further down. It reads with the asker's own rights.
create function public.ranking(period text default 'all', life text default null, friends boolean default false, top integer default 50)
returns table (place bigint, user_id uuid, nickname text, portrait text, score integer, life_id text, finished_at timestamptz, run_id uuid)
language sql
stable
set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.id, r.score, r.life_id, r.finished_at
    from public.runs r
    where r.mode = 'ranked'
      and (period is distinct from 'week' or r.finished_at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc')
      and (life is null or r.life_id = life)
      and (friends is not true or r.user_id = (select auth.uid()) or r.user_id in (select f.followed from public.friendships f where f.follower = (select auth.uid())))
    order by r.user_id, r.score desc, r.finished_at asc, r.id
  ), placed as (
    select b.*, row_number() over (order by b.score desc, b.finished_at asc, b.id) as place from best b
  )
  select p.place, p.user_id, pr.nickname, pr.portrait, p.score, p.life_id, p.finished_at, p.id
  from placed p left join public.profiles pr on pr.user_id = p.user_id
  where p.place <= least(greatest(coalesce(top, 50), 1), 100) or p.user_id = (select auth.uid())
  order by p.place;
$$;
revoke all on function public.ranking(text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.ranking(text, text, boolean, integer) to authenticated;
