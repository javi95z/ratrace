-- Public games, and the rats that fill them.
--
-- A public game is found rather than shared: a player asks for one and is seated in the oldest
-- public lobby on their rules with a seat left, or in a new one of their own. It starts by itself a
-- little after it was opened (the server starts it the first time it is looked at after that), at
-- once when it is full, or when anyone in it says so: whoever is in a public lobby may start it, not
-- only whoever opened it. When it starts with fewer than four players, rats the server plays take
-- the empty seats.
--
-- The rats are accounts of their own, one for each kind of player, that never sign in. They sit in
-- a game as any member does, so a turn, a standing and a tease treat them as anyone else; the server
-- plays each of their rounds the moment it begins, and keeps no finished life of theirs. A rat may
-- sit in many games at once, and in no game is it the only one left: the last player to leave a
-- game in play closes it, and the rats' lives in it end with it.
--
-- Every function keeps its signature: the functions deployed before this one go on calling them,
-- unchanged in what they do for a game that is not public, until the new ones replace them.

-- ------------------------------------------------------------------------------------------------
-- A public game, and when its lobby starts by itself.
alter table public.rooms add column public boolean not null default false;
alter table public.rooms add column starts_at timestamptz;
alter table public.rooms add constraint rooms_starts_at_is_public check (starts_at is null or public);
-- The lobbies a player asking for a public game may be seated in: on their rules, the oldest first.
create index rooms_public_open on public.rooms (engine_version, content_version, created_at) where public and status = 'open';

-- ------------------------------------------------------------------------------------------------
-- The rats: an account each, and the kind of player it plays as. Only the server reads this.
create table public.room_bots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  persona text not null unique check (persona ~ '^[a-z]{1,20}$')
);
alter table public.room_bots enable row level security;
revoke all on public.room_bots from public, anon, authenticated;

insert into auth.users (id, aud, role, is_anonymous) values
  ('b0700000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', false),
  ('b0700000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', false),
  ('b0700000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', false),
  ('b0700000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', false),
  ('b0700000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', false)
on conflict (id) do nothing;
insert into public.room_bots (user_id, persona) values
  ('b0700000-0000-4000-8000-000000000001', 'saver'),
  ('b0700000-0000-4000-8000-000000000002', 'indexer'),
  ('b0700000-0000-4000-8000-000000000003', 'gambler'),
  ('b0700000-0000-4000-8000-000000000004', 'chaser'),
  ('b0700000-0000-4000-8000-000000000005', 'landlord')
on conflict do nothing;

-- ------------------------------------------------------------------------------------------------
-- Seats a player in a public game: the oldest public lobby on their rules with a seat left, that
-- they have not left before, or a new one with them in it, which starts by itself at `p_starts_at`.
-- A lobby another call holds is passed over, not waited for. A player is in one game at a time.
create function public.room_quick(p_room uuid, p_member uuid, p_life text, p_engine text, p_content text, p_seconds integer, p_starts_at timestamptz) returns jsonb
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
    where q.public and q.status = 'open' and q.engine_version = p_engine and q.content_version = p_content
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

-- Seats rats in a public lobby, in the order named, while there are seats: only the rats, each once.
-- 'closed' for a game that is not a public lobby any more.
create function public.room_add_bots(p_room uuid, p_bots uuid[]) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  bot uuid;
  seats int;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.status <> 'open' or not r.public then
    return 'closed';
  end if;
  select count(*) into seats from public.room_players where room_id = p_room and left_at is null;
  foreach bot in array coalesce(p_bots, '{}'::uuid[]) loop
    exit when seats >= 6;
    if exists (select 1 from public.room_bots where user_id = bot) and not exists (select 1 from public.room_players where room_id = p_room and user_id = bot) then
      -- Each a moment after the last, so that they keep the order they were named in.
      insert into public.room_players (room_id, user_id, joined_at) values (p_room, bot, clock_timestamp());
      seats := seats + 1;
    end if;
  end loop;
  return 'ok';
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- Starting a game: its host's to do, or, in a public one, anyone's in it.
create or replace function public.room_start(p_room uuid, p_host uuid, p_seed text, p_games jsonb, p_deadline timestamptz) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  m record;
  members int;
  game uuid;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.status <> 'open' then
    return jsonb_build_object('error', 'started');
  end if;
  -- A lobby whose host is gone has none, and nobody else may start it, unless it is public.
  if r.host is distinct from p_host
     and not (r.public and exists (select 1 from public.room_players where room_id = p_room and user_id = p_host and left_at is null)) then
    return jsonb_build_object('error', 'not-host');
  end if;
  select count(*) into members from public.room_players where room_id = p_room and left_at is null;
  if members < 2 then
    return jsonb_build_object('error', 'alone');
  end if;
  -- Every member named, and nobody else, before anything is written: someone may have come or gone since the names were read.
  if jsonb_typeof(p_games) <> 'object' or (select count(*) from jsonb_object_keys(p_games)) <> members
     or exists (select 1 from public.room_players where room_id = p_room and left_at is null and not (p_games ? user_id::text)) then
    return jsonb_build_object('error', 'moved');
  end if;
  for m in select user_id from public.room_players where room_id = p_room and left_at is null loop
    game := (p_games ->> m.user_id::text)::uuid;
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version, room, status, round, log)
      values (game, m.user_id, 'room', r.life_id, r.engine_version, r.content_version, p_room, 'playing', 0, '[]');
    insert into public.game_secrets (game_id, seed) values (game, p_seed);
    update public.room_players set game_id = game, ready_round = null where room_id = p_room and user_id = m.user_id;
  end loop;
  update public.rooms set status = 'playing', round = 0, deadline = p_deadline, starts_at = null where id = p_room;
  return jsonb_build_object('ok', true);
end;
$$;

-- Leaving. A host who leaves a lobby closes it for everyone, unless it is public: then it goes on
-- without them, and closes when nobody is left. In play the life is given up, and the last player to
-- go closes the game, the rats' lives in it with it. A game that is over is left to say the player
-- has seen how it ended.
create or replace function public.room_leave(p_room uuid, p_member uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  m public.room_players;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then
    return jsonb_build_object('error', 'not-in-room');
  end if;
  select * into m from public.room_players where room_id = p_room and user_id = p_member;
  if not found or m.left_at is not null then
    return jsonb_build_object('error', 'not-in-room');
  end if;
  update public.room_players set left_at = now() where room_id = p_room and user_id = p_member;
  if r.status = 'open' and (
    (r.host = p_member and not r.public)
    or (r.public and not exists (
      select 1 from public.room_players p
      where p.room_id = p_room and p.left_at is null and not exists (select 1 from public.room_bots b where b.user_id = p.user_id)
    ))
  ) then
    update public.rooms set status = 'closed', starts_at = null where id = p_room;
    update public.room_players set left_at = now() where room_id = p_room and left_at is null;
    return jsonb_build_object('status', 'closed');
  end if;
  if r.status = 'playing' then
    update public.games set status = 'abandoned' where id = m.game_id and status = 'playing';
    if not exists (
      select 1 from public.room_players p
      where p.room_id = p_room and p.left_at is null and not exists (select 1 from public.room_bots b where b.user_id = p.user_id)
    ) then
      update public.rooms set status = 'closed', deadline = null where id = p_room;
      update public.games set status = 'abandoned' where room = p_room and status = 'playing';
      return jsonb_build_object('status', 'closed');
    end if;
  end if;
  return jsonb_build_object('status', r.status);
end;
$$;

revoke all on function public.room_quick(uuid, uuid, text, text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.room_add_bots(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.room_start(uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.room_leave(uuid, uuid) from public, anon, authenticated;
grant execute on function public.room_quick(uuid, uuid, text, text, text, integer, timestamptz) to service_role;
grant execute on function public.room_add_bots(uuid, uuid[]) to service_role;
grant execute on function public.room_start(uuid, uuid, text, jsonb, timestamptz) to service_role;
grant execute on function public.room_leave(uuid, uuid) to service_role;
