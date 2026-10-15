-- Rooms, after review.
--
-- 1. A turn is written only if every member is as ready as the turn was worked out for: orders kept
--    between the reading and the writing of a turn would otherwise be stored and never played. The
--    turn names, for each member, whether it played their kept orders, and is refused otherwise.
-- 2. A turn that a member's log cannot hold answers 'invalid' and writes nothing, so that the server
--    plays the round without that member's orders and the room is never stuck on it.
-- 3. A host whose account is deleted no longer takes the room and everyone in it: the room stays,
--    with no host. A lobby with no host cannot be started, and closes after a day.

create or replace function public.room_turn(p_room uuid, p_round integer, p_deadline timestamptz, p_lives jsonb) returns text
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
      -- The turn was worked out with the member's orders, or with none: they must still be ready, or still not.
      update public.room_players set standing = life -> 'standing'
        where room_id = p_room and user_id = (life ->> 'user')::uuid and game_id = (life ->> 'game')::uuid and left_at is null
          and (ready_round is not distinct from p_round) = coalesce((life ->> 'ready')::boolean, false);
      if not found then
        raise exception 'a member moved' using errcode = 'RR010';
      end if;
    end loop;
    if p_deadline is null then
      update public.rooms set status = 'finished', round = p_round + 1, deadline = null where id = p_room;
    else
      update public.rooms set round = p_round + 1, deadline = p_deadline where id = p_room;
    end if;
  exception
    when sqlstate 'RR010' then
      return 'moved';
    -- A log its game cannot hold: nothing is written, and the caller plays the round with less.
    when check_violation then
      return 'invalid';
  end;
  return 'ok';
end;
$$;

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
  -- A lobby whose host is gone has none, and nobody else may start it.
  if r.host is distinct from p_host then
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

alter table public.rooms alter column host drop not null;
alter table public.rooms drop constraint rooms_host_fkey;
alter table public.rooms add constraint rooms_host_fkey foreign key (host) references auth.users (id) on delete set null;

revoke all on function public.room_turn(uuid, integer, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.room_start(uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.room_turn(uuid, integer, timestamptz, jsonb) to service_role;
grant execute on function public.room_start(uuid, uuid, text, jsonb, timestamptz) to service_role;
