-- Public games, the second part: names strangers see, the lobbies waiting now, and the players met.
--
-- 1. A player is seated only in a public lobby whose time has not come, and of the pace they asked
--    for: a game played together, or one played a round a day. One past its time was left by
--    whoever opened it: nobody looked when it was due, so nobody is there to play with.
-- 2. How many public lobbies wait for players now, on some rules and at some pace: what the front
--    door says.
-- 3. Names. More words are refused (Russian ones too, as they are written in Latin letters), the
--    names already kept that the longer list refuses are taken away, and a player of a public game
--    may report another's name: the one who reports no longer sees it, and two players who report
--    it take it away. A new name starts with no reports.
-- 4. A player may follow anyone they have played a game with, without their code.

-- ------------------------------------------------------------------------------------------------
-- 1. Seated only in a lobby still waiting for its time, at the pace asked for.
create or replace function public.room_quick(p_room uuid, p_member uuid, p_life text, p_engine text, p_content text, p_seconds integer, p_starts_at timestamptz) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  other uuid;
  made jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('room-member:' || p_member::text, 0));
  other := private.active_room(p_member);
  if other is not null then
    return jsonb_build_object('error', 'in-a-room', 'room', other);
  end if;
  select * into r from public.rooms q
    where q.public and q.status = 'open' and q.engine_version = p_engine and q.content_version = p_content and q.seconds = p_seconds and q.starts_at > now()
      and (select count(*) from public.room_players p where p.room_id = q.id and p.left_at is null) < 6
      and not exists (select 1 from public.room_players p where p.room_id = q.id and p.user_id = p_member)
    order by q.created_at
    limit 1
    for update skip locked;
  -- Counted again now that it is held: someone may have taken the last seat meanwhile.
  if found and (select count(*) from public.room_players where room_id = r.id and left_at is null) < 6 then
    insert into public.room_players (room_id, user_id) values (r.id, p_member);
    return jsonb_build_object('room', r.id, 'code', r.code);
  end if;
  made := public.room_open(p_room, p_member, p_life, p_engine, p_content, p_seconds);
  if made ? 'error' then
    return made;
  end if;
  update public.rooms set public = true, starts_at = p_starts_at where id = p_room;
  return made;
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- 2. The public lobbies a player asking for one at this pace could be seated in now.
create function public.room_open_count(p_engine text, p_content text, p_seconds integer) returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.rooms q
  where q.public and q.status = 'open' and q.engine_version = p_engine and q.content_version = p_content and q.seconds = p_seconds and q.starts_at > now()
    and (select count(*) from public.room_players p where p.room_id = q.id and p.left_at is null) < 6;
$$;

-- ------------------------------------------------------------------------------------------------
-- 3. Names.
insert into private.unwelcome_names (word, whole) values
  -- Spanish, and the Spanish of the Americas.
  ('chupapollas', false), ('malparido', false), ('malparida', false), ('hijueputa', false), ('gonorrea', false), ('putero', false),
  ('cabrona', false), ('follador', false), ('chocho', true), ('mamon', true),
  -- Russian, as it is written in Latin letters.
  ('blyat', false), ('blyad', false), ('pizda', false), ('pizdec', false), ('khuy', false), ('mudak', false), ('pidor', false),
  ('pidar', false), ('gandon', true), ('yebat', false), ('zalupa', false), ('suka', true), ('ebat', true),
  -- And what no name is.
  ('siegheil', false), ('heil', true)
on conflict (word) do nothing;

-- Whether a name is refused: a word of the list as the whole name, or one refused wherever it appears.
create function private.name_unwelcome(name text) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from private.unwelcome_names u
    where (u.whole and (private.plain_name(name) = u.word or private.bare_name(name) = u.word))
       or (not u.whole and position(u.word in private.plain_name(name)) > 0)
  );
$$;
revoke all on function private.name_unwelcome(text) from public, anon, authenticated;

-- Reports of a player's name: one per player who reported it, kept a month.
create table public.name_reports (
  reporter uuid not null references auth.users (id) on delete cascade,
  reported uuid not null references auth.users (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (reporter, reported),
  constraint name_reports_not_oneself check (reporter <> reported)
);
create index name_reports_reported on public.name_reports (reported, created_at);
alter table public.name_reports enable row level security;
revoke all on public.name_reports from public, anon, authenticated;

-- The same check as before, by the function above; and a new name is a new start, with no reports.
create or replace function private.check_nickname() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nickname is null or (tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname) then
    return new;
  end if;
  if private.name_unwelcome(new.nickname) then
    raise exception 'that name is not accepted' using errcode = 'RR002';
  end if;
  if tg_op = 'UPDATE' then
    delete from public.name_reports where reported = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function private.check_nickname() from public, anon, authenticated;

-- The names already kept that the longer list refuses go. Their players are seen by the four
-- characters of their id, and may choose another name.
update public.profiles set nickname = null where nickname is not null and private.name_unwelcome(nickname);

-- One player of a public game reports another's name. 'closed' for a game that is not public, a
-- player not in it, oneself or a rat; 'nameless' for a player with no name; 'cleared' when it was
-- the second report this month, and the name is gone.
create function public.room_report_name(p_room uuid, p_reporter uuid, p_reported uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  reports integer;
begin
  if not exists (select 1 from public.rooms where id = p_room and public)
     or p_reporter = p_reported
     or exists (select 1 from public.room_bots where user_id = p_reported)
     or (select count(*) from public.room_players where room_id = p_room and user_id in (p_reporter, p_reported)) <> 2 then
    return 'closed';
  end if;
  if (select nickname from public.profiles where user_id = p_reported) is null then
    return 'nameless';
  end if;
  insert into public.name_reports (reporter, reported, room_id) values (p_reporter, p_reported, p_room)
    on conflict (reporter, reported) do update set created_at = now(), room_id = excluded.room_id;
  select count(*) into reports from public.name_reports where reported = p_reported and created_at > now() - interval '30 days';
  if reports >= 2 then
    update public.profiles set nickname = null where user_id = p_reported;
    delete from public.name_reports where reported = p_reported;
    return 'cleared';
  end if;
  return 'ok';
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- 4. Following someone met in a game. 'closed' for oneself, a rat, or a player the follower never
-- shared that game with; 'full' at the most one may follow.
create function public.room_follow(p_room uuid, p_follower uuid, p_followed uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_follower = p_followed
     or exists (select 1 from public.room_bots where user_id = p_followed)
     or (select count(*) from public.room_players where room_id = p_room and user_id in (p_follower, p_followed)) <> 2 then
    return 'closed';
  end if;
  if exists (select 1 from public.friendships where follower = p_follower and followed = p_followed) then
    return 'ok';
  end if;
  if (select count(*) from public.friendships where follower = p_follower) >= 200 then
    return 'full';
  end if;
  insert into public.friendships (follower, followed) values (p_follower, p_followed) on conflict do nothing;
  return 'ok';
end;
$$;

revoke all on function public.room_quick(uuid, uuid, text, text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.room_open_count(text, text, integer) from public, anon, authenticated;
revoke all on function public.room_report_name(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.room_follow(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.room_quick(uuid, uuid, text, text, text, integer, timestamptz) to service_role;
grant execute on function public.room_open_count(text, text, integer) to service_role;
grant execute on function public.room_report_name(uuid, uuid, uuid) to service_role;
grant execute on function public.room_follow(uuid, uuid, uuid) to service_role;
