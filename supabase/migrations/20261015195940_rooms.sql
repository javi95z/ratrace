-- Rooms: two to six friends live the same life in the same world at the same time, a round at a
-- time, each round with a deadline.
--
-- A room is opened by its host and joined with its code while it is in its lobby. When the host
-- starts it, every member gets a game of mode `room`, all of them with one seed, kept apart like
-- every seed the server plays. A member's cards are played the moment they are answered; their
-- orders for a round wait in `room_orders` until the round turns for everyone, when every member
-- still in the room is ready or the deadline has passed. A turn, a card and a member's orders are
-- each one function below that holds the room's row, so a round is never turned twice, never
-- half, and nothing reaches a round that has already turned.
--
-- Members read their room and who is in it, and hear of every change through Realtime. They read
-- nothing of another member's round before it turns: not their orders, which nobody reads, and not
-- their standing, which the server writes only when the round turns. Only the server writes.
--
-- No row of `room_players` is ever deleted while its room stands: Realtime tells a delete to
-- everyone who listens to the table, whatever its row rules say, so a member who leaves is marked.

-- ------------------------------------------------------------------------------------------------
-- rooms
create table public.rooms (
  id uuid primary key,
  -- Six characters that cannot be mistaken for one another, unique among the rooms that are not over.
  code text not null check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  host uuid not null references auth.users (id) on delete cascade,
  life_id text not null check (char_length(life_id) between 1 and 40),
  engine_version text not null check (char_length(engine_version) between 1 and 20),
  content_version text not null check (char_length(content_version) between 1 and 20),
  seconds smallint not null check (seconds in (90, 180, 300)),
  status text not null default 'open' check (status in ('open', 'playing', 'finished', 'closed')),
  -- The round the room is in. Past the last one once the room is over.
  round smallint not null default 0 check (round between 0 and 40),
  -- When the round in play is due. Only a room in play has one.
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_deadline_follows_status check ((status = 'playing') = (deadline is not null))
);
create unique index rooms_code_in_use on public.rooms (code) where status in ('open', 'playing');
create trigger rooms_stamp before insert or update on public.rooms for each row execute function private.stamp_row();

-- ------------------------------------------------------------------------------------------------
-- room_players: who is in a room, in the order they joined.
create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The member's life in the room, from the moment it starts.
  game_id uuid references public.games (id) on delete set null,
  -- The round in which the member has played their orders and waits for the others.
  ready_round smallint check (ready_round between 0 and 40),
  -- When the member left. A member who left is no longer waited for, and their standing stays.
  left_at timestamptz,
  -- How the member stood when the last round turned. Written by the server at the turn, never before.
  standing jsonb check (standing is null or (jsonb_typeof(standing) = 'object' and pg_column_size(standing) <= 2048)),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_players_mine on public.room_players (user_id, joined_at desc);
create unique index room_players_game on public.room_players (game_id) where game_id is not null;

-- ------------------------------------------------------------------------------------------------
-- room_orders: a member's orders for a round, from the moment they play it. Nobody but the server
-- reads them: before the round turns they are the member's own business, and after it the round's
-- result says what they did. Kept after the turn, so a turn can always be told again.
create table public.room_orders (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  round smallint not null check (round between 0 and 40),
  orders jsonb not null check (jsonb_typeof(orders) = 'array' and pg_column_size(orders) <= 65536),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id, round)
);

-- ------------------------------------------------------------------------------------------------
-- A room's life is a game, and its run a run, of a mode of their own. Like a ranked game, its seed
-- is not in `games`.
alter table public.games drop constraint games_mode_check;
alter table public.games add constraint games_mode_check check (mode in ('casual', 'ranked', 'room'));
alter table public.games drop constraint games_seed_follows_mode;
alter table public.games add constraint games_seed_follows_mode check ((mode = 'casual') = (seed is not null));
alter table public.games add column room uuid references public.rooms (id) on delete set null;
alter table public.runs drop constraint runs_mode_check;
alter table public.runs add constraint runs_mode_check check (mode in ('casual', 'ranked', 'room'));

-- ------------------------------------------------------------------------------------------------
-- Who reads what. A member reads their room and everyone in it, and goes on reading it once they
-- have left, to see how it ended. Nobody else reads anything of it.
create function public.in_room(room uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.room_players p where p.room_id = room and p.user_id = (select auth.uid()));
$$;
revoke all on function public.in_room(uuid) from public, anon, authenticated;
grant execute on function public.in_room(uuid) to authenticated;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_orders enable row level security;
revoke all on public.rooms, public.room_players, public.room_orders from public, anon, authenticated;
grant select on public.rooms, public.room_players to authenticated;
create policy "a member reads their room" on public.rooms
  for select to authenticated using (public.in_room(id));
create policy "a member reads who is in their room" on public.room_players
  for select to authenticated using (public.in_room(room_id));

-- Every change to a room and its members reaches the pages that listen, each one filtered by the
-- rules above for whoever is listening.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms, public.room_players;
  end if;
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- What the server does to rooms. Each holds what it changes, so that two at once cannot both be
-- taken; each answers in words the function turns into answers of its own.

-- Six characters from the letters of the friend codes.
create function private.new_room_code() returns text
language plpgsql
set search_path = ''
as $$
declare
  letters constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
begin
  -- Bytes 6 and 8 of a random id are not all random; these six are.
  for i in 0..5 loop
    code := code || substr(letters, 1 + (get_byte(bytes, i) % 31), 1);
  end loop;
  return code;
end;
$$;
revoke all on function private.new_room_code() from public, anon, authenticated;

-- The room a player is in that is not over, if they are in one.
create function private.active_room(member uuid) returns uuid
language sql
stable
set search_path = ''
as $$
  select p.room_id from public.room_players p join public.rooms r on r.id = p.room_id
  where p.user_id = member and p.left_at is null and r.status in ('open', 'playing')
  order by p.joined_at desc limit 1;
$$;
revoke all on function private.active_room(uuid) from public, anon, authenticated;

-- Opens a room with its host in it. A player is in one room at a time that is not over.
create function public.room_open(p_room uuid, p_host uuid, p_life text, p_engine text, p_content text, p_seconds integer) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  other uuid;
  made text;
  tries int := 0;
begin
  -- One player's calls one after another: two rooms opened at once would both find the player in none.
  perform pg_advisory_xact_lock(hashtextextended('room-member:' || p_host::text, 0));
  other := private.active_room(p_host);
  if other is not null then
    return jsonb_build_object('error', 'in-a-room', 'room', other);
  end if;
  loop
    made := private.new_room_code();
    begin
      insert into public.rooms (id, code, host, life_id, engine_version, content_version, seconds) values (p_room, made, p_host, p_life, p_engine, p_content, p_seconds);
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 20 then
        raise;
      end if;
    end;
  end loop;
  insert into public.room_players (room_id, user_id) values (p_room, p_host);
  return jsonb_build_object('room', p_room, 'code', made);
end;
$$;

-- Joins a room by its code while it is in its lobby: on the room's rules, with a seat left, and
-- while not in another room. Joining a room one is already in answers it again.
create function public.room_join(p_code text, p_member uuid, p_engine text, p_content text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  was public.room_players;
  other uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('room-member:' || p_member::text, 0));
  select * into r from public.rooms where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) and status in ('open', 'playing') for update;
  if not found then
    return jsonb_build_object('error', 'unknown-room');
  end if;
  select * into was from public.room_players where room_id = r.id and user_id = p_member;
  if found and was.left_at is null then
    return jsonb_build_object('room', r.id);
  end if;
  if r.status <> 'open' then
    return jsonb_build_object('error', 'started');
  end if;
  if r.engine_version <> p_engine or r.content_version <> p_content then
    return jsonb_build_object('error', 'other-version', 'engineVersion', r.engine_version, 'contentVersion', r.content_version);
  end if;
  other := private.active_room(p_member);
  if other is not null then
    return jsonb_build_object('error', 'in-a-room', 'room', other);
  end if;
  if (select count(*) from public.room_players where room_id = r.id and left_at is null) >= 6 then
    return jsonb_build_object('error', 'full');
  end if;
  if was.user_id is not null then
    -- Back in a lobby they had left: at the end of the line again.
    update public.room_players set left_at = null, joined_at = now() where room_id = r.id and user_id = p_member;
  else
    insert into public.room_players (room_id, user_id) values (r.id, p_member);
  end if;
  return jsonb_build_object('room', r.id);
end;
$$;

-- Starts a room: one game for every member, all on one seed, and the first round's deadline.
-- `p_games` names a new game id for each member, by user id; it must name exactly the members.
create function public.room_start(p_room uuid, p_host uuid, p_seed text, p_games jsonb, p_deadline timestamptz) returns jsonb
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
  if r.host <> p_host then
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
  update public.rooms set status = 'playing', round = 0, deadline = p_deadline where id = p_room;
  return jsonb_build_object('ok', true);
end;
$$;

-- Writes one card of a member's life: only while the room is in the round the card was played in,
-- the member has not played their orders for it, and the game is as it was read.
create function public.room_step(p_room uuid, p_round integer, p_member uuid, p_game uuid, p_as_read timestamptz, p_log jsonb, p_game_round integer) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  m public.room_players;
begin
  -- Shared: cards of different members go side by side, and all of them wait for a turn.
  select * into r from public.rooms where id = p_room for share;
  if not found or r.status <> 'playing' then
    return 'closed';
  end if;
  if r.round <> p_round then
    return 'moved';
  end if;
  select * into m from public.room_players where room_id = p_room and user_id = p_member;
  if not found or m.left_at is not null or m.game_id is distinct from p_game then
    return 'closed';
  end if;
  if m.ready_round = p_round then
    return 'ready';
  end if;
  update public.games set log = p_log, round = p_game_round
    where id = p_game and user_id = p_member and updated_at = p_as_read and status = 'playing';
  if not found then
    return 'moved';
  end if;
  return 'ok';
end;
$$;

-- Keeps a member's orders for the round they played, and marks them ready. The same orders again
-- change nothing; others are refused. Says whether everyone still in the room is now ready.
create function public.room_submit(p_room uuid, p_round integer, p_member uuid, p_orders jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  m public.room_players;
  kept jsonb;
  said text := 'new';
begin
  -- Held whole: of two members who play last at once, one finds the other ready.
  select * into r from public.rooms where id = p_room for update;
  if not found or r.status <> 'playing' then
    return jsonb_build_object('kept', 'closed', 'all', false);
  end if;
  if r.round <> p_round then
    return jsonb_build_object('kept', 'moved', 'all', false);
  end if;
  select * into m from public.room_players where room_id = p_room and user_id = p_member;
  if not found or m.left_at is not null then
    return jsonb_build_object('kept', 'closed', 'all', false);
  end if;
  select orders into kept from public.room_orders where room_id = p_room and user_id = p_member and round = p_round;
  if found then
    if kept is distinct from p_orders then
      return jsonb_build_object('kept', 'other', 'all', false);
    end if;
    said := 'same';
  else
    insert into public.room_orders (room_id, user_id, round, orders) values (p_room, p_member, p_round, p_orders);
  end if;
  update public.room_players set ready_round = p_round where room_id = p_room and user_id = p_member;
  return jsonb_build_object('kept', said, 'all', not exists (
    select 1 from public.room_players where room_id = p_room and left_at is null and ready_round is distinct from p_round
  ));
end;
$$;

-- Turns the round: every member's game, every standing and the room, together or not at all.
-- `p_lives` is every member still in the room: { user, game, as_read, log, round, finished, standing }.
-- With no deadline the room is over. 'moved' if the round has turned already, if a member came or
-- went, or if a game is no longer as it was read: the caller reads again and tries again.
create function public.room_turn(p_room uuid, p_round integer, p_deadline timestamptz, p_lives jsonb) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  life jsonb;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.status <> 'playing' then
    return 'closed';
  end if;
  if r.round <> p_round or jsonb_typeof(p_lives) <> 'array'
     or (select count(*) from public.room_players where room_id = p_room and left_at is null) <> jsonb_array_length(p_lives) then
    return 'moved';
  end if;
  begin
    for life in select value from jsonb_array_elements(p_lives) loop
      update public.games
        set log = life -> 'log', round = (life ->> 'round')::smallint, status = case when (life ->> 'finished')::boolean then 'finished' else 'playing' end
        where id = (life ->> 'game')::uuid and user_id = (life ->> 'user')::uuid and updated_at = (life ->> 'as_read')::timestamptz and status = 'playing' and room = p_room;
      if not found then
        raise exception 'a life moved' using errcode = 'RR010';
      end if;
      update public.room_players set standing = life -> 'standing'
        where room_id = p_room and user_id = (life ->> 'user')::uuid and game_id = (life ->> 'game')::uuid and left_at is null;
      if not found then
        raise exception 'a member moved' using errcode = 'RR010';
      end if;
    end loop;
    if p_deadline is null then
      update public.rooms set status = 'finished', round = p_round + 1, deadline = null where id = p_room;
    else
      update public.rooms set round = p_round + 1, deadline = p_deadline where id = p_room;
    end if;
  exception when sqlstate 'RR010' then
    return 'moved';
  end;
  return 'ok';
end;
$$;

-- A member leaves. In the lobby that takes them out, and the host leaving closes the room for
-- everyone. In play their life is given up, and the last to go closes the room. A room that is over
-- is left to say the player has seen how it ended.
create function public.room_leave(p_room uuid, p_member uuid) returns jsonb
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
  if r.status = 'open' and r.host = p_member then
    update public.rooms set status = 'closed' where id = p_room;
    update public.room_players set left_at = now() where room_id = p_room and left_at is null;
    return jsonb_build_object('status', 'closed');
  end if;
  if r.status = 'playing' then
    update public.games set status = 'abandoned' where id = m.game_id and status = 'playing';
    if not exists (select 1 from public.room_players where room_id = p_room and left_at is null) then
      update public.rooms set status = 'closed', deadline = null where id = p_room;
      return jsonb_build_object('status', 'closed');
    end if;
  end if;
  return jsonb_build_object('status', r.status);
end;
$$;

-- Closes a room nobody has moved for a day, by the server's clock: a lobby opened a day ago, or a
-- round whose deadline passed a day ago. Its lives are given up. True if it was closed now.
create function public.room_close(p_room uuid, p_now timestamptz) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rooms set status = 'closed', deadline = null
    where id = p_room and ((status = 'open' and created_at < p_now - interval '1 day') or (status = 'playing' and deadline < p_now - interval '1 day'));
  if not found then
    return false;
  end if;
  update public.games set status = 'abandoned' where room = p_room and status = 'playing';
  return true;
end;
$$;

revoke all on function public.room_open(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.room_join(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.room_start(uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.room_step(uuid, integer, uuid, uuid, timestamptz, jsonb, integer) from public, anon, authenticated;
revoke all on function public.room_submit(uuid, integer, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.room_turn(uuid, integer, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.room_leave(uuid, uuid) from public, anon, authenticated;
revoke all on function public.room_close(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.room_open(uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.room_join(text, uuid, text, text) to service_role;
grant execute on function public.room_start(uuid, uuid, text, jsonb, timestamptz) to service_role;
grant execute on function public.room_step(uuid, integer, uuid, uuid, timestamptz, jsonb, integer) to service_role;
grant execute on function public.room_submit(uuid, integer, uuid, jsonb) to service_role;
grant execute on function public.room_turn(uuid, integer, timestamptz, jsonb) to service_role;
grant execute on function public.room_leave(uuid, uuid) to service_role;
grant execute on function public.room_close(uuid, timestamptz) to service_role;
