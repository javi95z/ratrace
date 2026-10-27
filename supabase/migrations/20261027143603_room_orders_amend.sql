-- A member who has played the round may change their orders until it turns: what they buy or sell while the others
-- still choose counts. Other orders now replace the kept ones ('changed'); the same orders again change nothing ('same').
-- The member stays ready. Held on the room's row as before, so a change never crosses the turn: once the round has
-- turned, the round asked for is no longer the room's ('moved').
create or replace function public.room_submit(p_room uuid, p_round integer, p_member uuid, p_orders jsonb) returns jsonb
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
      update public.room_orders set orders = p_orders where room_id = p_room and user_id = p_member and round = p_round;
      said := 'changed';
    else
      said := 'same';
    end if;
  else
    insert into public.room_orders (room_id, user_id, round, orders) values (p_room, p_member, p_round, p_orders);
  end if;
  update public.room_players set ready_round = p_round where room_id = p_room and user_id = p_member;
  return jsonb_build_object('kept', said, 'all', not exists (
    select 1 from public.room_players where room_id = p_room and left_at is null and ready_round is distinct from p_round
  ));
end;
$$;
