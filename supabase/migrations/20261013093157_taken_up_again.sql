-- What cloud saves found once two devices shared an account.
--
--   * A life that was given up can be taken up again by its owner.
--   * Saving a game the player already holds does not make room for it.

-- ------------------------------------------------------------------------------------------------
-- One device gives a life up for another while a second device is still playing it. The second
-- one's next save must not be refused for ever: it says the life is being played, and it is.
-- "Abandoned" therefore means "nobody is offered this", not "closed". What the server has
-- finished stays closed: the rule below does not let its owner see it as a row to change.
drop policy "a player changes their own casual games while they are played" on public.games;
create policy "a player changes their own casual games until the server finishes them" on public.games
  for update to authenticated
  using ((select auth.uid()) = user_id and mode = 'casual' and status in ('playing', 'abandoned'))
  with check ((select auth.uid()) = user_id and mode = 'casual' and status in ('playing', 'abandoned'));

-- ------------------------------------------------------------------------------------------------
-- A device saves its life with "insert, or update if it is there", and a trigger before insert
-- runs for both. A game that is already held needs no room: without this, every save of a player
-- who holds fifty games would delete one of their lives that are over.
create or replace function private.make_room_for_game() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  held int;
begin
  if exists (select 1 from public.games where id = new.id) then
    return new;
  end if;
  select count(*) into held from public.games where user_id = new.user_id;
  if held >= 50 then
    delete from public.games where id in (
      select id from public.games where user_id = new.user_id and status <> 'playing' order by updated_at asc limit held - 49
    );
    select count(*) into held from public.games where user_id = new.user_id;
    if held >= 50 then
      raise exception 'a player holds fifty games at most' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.make_room_for_game() from public, anon, authenticated;
