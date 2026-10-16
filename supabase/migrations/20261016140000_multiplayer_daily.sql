-- Multiplayer at a slower pace: a round may also take a day, for friends who play when they can.
-- A day does not fit the small integer the seconds were kept in, and a room that waits a day for
-- each round must not be closed as forgotten after one day of quiet.

alter table public.rooms drop constraint rooms_seconds_check;
alter table public.rooms alter column seconds type integer;
alter table public.rooms add constraint rooms_seconds_check check (seconds in (90, 180, 300, 86400));

-- A room is forgotten when nobody has moved it for a day, or for three of its rounds if a round
-- takes longer: a lobby since it was opened, a room in play since its round was due.
create or replace function public.room_close(p_room uuid, p_now timestamptz) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rooms set status = 'closed', deadline = null
    where id = p_room and (
      (status = 'open' and created_at < p_now - greatest(interval '1 day', 3 * seconds * interval '1 second'))
      or (status = 'playing' and deadline < p_now - greatest(interval '1 day', 3 * seconds * interval '1 second'))
    );
  if not found then
    return false;
  end if;
  update public.games set status = 'abandoned' where room = p_room and status = 'playing';
  return true;
end;
$$;
