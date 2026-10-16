-- Shouts: an emoji or a short phrase a member sends to everyone in their game, shown to the others
-- for a moment. Only from a fixed list, so there is nothing to moderate, and one every ten seconds
-- at most, so that nobody floods the others. Kept on the member's row, so Realtime tells it.
alter table public.room_players add column shout smallint check (shout between 0 and 31);
alter table public.room_players add column shout_at timestamptz;

-- Sends a member's shout, unless they sent one less than ten seconds ago: 'soon' then. 'closed' for
-- a game that is closed, or a member no longer in it.
create function public.room_shout(p_room uuid, p_member uuid, p_shout integer, p_now timestamptz) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  m public.room_players;
begin
  select * into r from public.rooms where id = p_room;
  if not found or r.status not in ('open', 'playing', 'finished') then
    return 'closed';
  end if;
  select * into m from public.room_players where room_id = p_room and user_id = p_member and left_at is null for update;
  if not found then
    return 'closed';
  end if;
  if m.shout_at is not null and m.shout_at > p_now - interval '10 seconds' then
    return 'soon';
  end if;
  update public.room_players set shout = p_shout, shout_at = p_now where room_id = p_room and user_id = p_member;
  return 'ok';
end;
$$;
revoke all on function public.room_shout(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.room_shout(uuid, uuid, integer, timestamptz) to service_role;
