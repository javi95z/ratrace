-- Multiplayer, more of it: a rematch with the same people, and a reaction to each round. The history
-- of a player's games needs nothing new: it is read from the rooms they were in.

-- ------------------------------------------------------------------------------------------------
-- A rematch: a room opened from one that is over, by one of its members. The room that is over
-- points to it, so that everyone still looking at it hears of it through Realtime and can join with
-- one press; the new room knows where it came from. One rematch a room.
alter table public.rooms add column rematch uuid references public.rooms (id) on delete set null;
alter table public.rooms add column rematch_of uuid references public.rooms (id) on delete set null;
create unique index rooms_one_rematch on public.rooms (rematch_of) where rematch_of is not null;

-- Opens the rematch of a room that is over, with its member as the host, on the room's own pace.
-- If another member opened it first, says which room it is, to be joined instead.
create function public.room_rematch(p_old uuid, p_room uuid, p_host uuid, p_life text, p_engine text, p_content text, p_seconds integer) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.rooms;
  r public.rooms;
  made jsonb;
begin
  select * into o from public.rooms where id = p_old for update;
  if not found or not exists (select 1 from public.room_players where room_id = p_old and user_id = p_host) then
    return jsonb_build_object('error', 'unknown-room');
  end if;
  if o.status <> 'finished' then
    return jsonb_build_object('error', 'not-over');
  end if;
  if o.rematch is not null then
    select * into r from public.rooms where id = o.rematch;
    if found and r.status = 'open' then
      return jsonb_build_object('error', 'rematch-open', 'room', r.id, 'code', r.code);
    end if;
    return jsonb_build_object('error', 'started');
  end if;
  made := public.room_open(p_room, p_host, p_life, p_engine, p_content, p_seconds);
  if made ? 'error' then
    return made;
  end if;
  update public.rooms set rematch_of = p_old where id = p_room;
  update public.rooms set rematch = p_room where id = p_old;
  return made;
end;
$$;
revoke all on function public.room_rematch(uuid, uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.room_rematch(uuid, uuid, uuid, text, text, text, integer) to service_role;

-- ------------------------------------------------------------------------------------------------
-- A reaction: one of a few faces a member puts on the round that has just turned, seen by everyone
-- in the room until the next one turns. Kept on the member's row, so Realtime tells it as it tells
-- everything else of a room.
alter table public.room_players add column reaction smallint check (reaction between 0 and 4);
alter table public.room_players add column reaction_round smallint check (reaction_round between 0 and 40);

-- Puts a member's face on the round that has turned last, or takes it off with null. Only while
-- the room is in play or over, and only for a member still in it.
create function public.room_react(p_room uuid, p_member uuid, p_reaction integer) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room;
  if not found or r.status not in ('playing', 'finished') or r.round < 1 then
    return 'closed';
  end if;
  update public.room_players set reaction = p_reaction, reaction_round = case when p_reaction is null then null else r.round end
    where room_id = p_room and user_id = p_member and left_at is null;
  if not found then
    return 'closed';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.room_react(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.room_react(uuid, uuid, integer) to service_role;
