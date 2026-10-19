-- Friends, both ways. A player no longer follows another: they ask to be friends, and the other
-- says yes or no. Once they are friends each sees the other's lives among their friends, and either
-- may end it, for both.
--
-- A friendship is kept as before, as two rows of `friendships`, one each way, so that whatever reads
-- whom a player is friends with (the ranking among friends, a game's end) reads it unchanged. Only
-- the server writes them, and only the functions below: a player can no longer delete a row of
-- their own, which would leave the other still a friend of theirs.
--
-- What was kept is kept as it was meant: two who followed each other are friends; a one-way follow
-- becomes a request from the follower, for the other to answer.
--
-- `add_friend` and `room_follow` keep their signatures and their words for the pages and the
-- functions deployed before this one: both now ask, and say 'ok' as before.

-- ------------------------------------------------------------------------------------------------
-- Requests: one from a player to another, until it is answered.
create table public.friend_requests (
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  constraint friend_requests_not_oneself check (from_user <> to_user)
);
create index friend_requests_to on public.friend_requests (to_user, created_at);
alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from public, anon, authenticated;
grant select on public.friend_requests to authenticated;
create policy "a player sees the requests they sent and those sent to them" on public.friend_requests
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));

-- A friendship is ended for both, by the server: no player deletes a row of it.
drop policy "a player stops following whom they chose to follow" on public.friendships;
revoke delete on public.friendships from authenticated;

-- What was kept: a follow the other did not return becomes a request, and the one-way row goes.
insert into public.friend_requests (from_user, to_user, created_at)
  select f.follower, f.followed, f.created_at from public.friendships f
  where not exists (select 1 from public.friendships g where g.follower = f.followed and g.followed = f.follower)
on conflict do nothing;
delete from public.friendships f
  where not exists (select 1 from public.friendships g where g.follower = f.followed and g.followed = f.follower);

-- ------------------------------------------------------------------------------------------------
-- The one way two players become friends: one asks, and the other asking back is a yes. In a word:
-- 'self'; 'friends', already; 'accepted', the other had asked, and now they are friends; 'pending',
-- asked already; 'sent', asked now; 'full', two hundred friends, or fifty requests waiting, at most.
create function private.befriend(p_from uuid, p_to uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_from = p_to then
    return 'self';
  end if;
  -- One answer at a time for a pair: two asking each other at once would both find no request.
  perform pg_advisory_xact_lock(hashtextextended('friends:' || least(p_from, p_to)::text || ':' || greatest(p_from, p_to)::text, 0));
  if exists (select 1 from public.friendships where follower = p_from and followed = p_to) then
    return 'friends';
  end if;
  if exists (select 1 from public.friend_requests where from_user = p_to and to_user = p_from) then
    if (select count(*) from public.friendships where follower = p_from) >= 200 or (select count(*) from public.friendships where follower = p_to) >= 200 then
      return 'full';
    end if;
    insert into public.friendships (follower, followed) values (p_from, p_to), (p_to, p_from) on conflict do nothing;
    delete from public.friend_requests where (from_user = p_from and to_user = p_to) or (from_user = p_to and to_user = p_from);
    return 'accepted';
  end if;
  if exists (select 1 from public.friend_requests where from_user = p_from and to_user = p_to) then
    return 'pending';
  end if;
  if (select count(*) from public.friendships where follower = p_from) >= 200 or (select count(*) from public.friend_requests where from_user = p_from) >= 50 then
    return 'full';
  end if;
  insert into public.friend_requests (from_user, to_user) values (p_from, p_to);
  return 'sent';
end;
$$;
revoke all on function private.befriend(uuid, uuid) from public, anon, authenticated;

-- Asks the player a friend code belongs to, for the server: the answer, and whom it was asked of.
create function public.friend_request(p_from uuid, p_code text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  them uuid;
begin
  select p.user_id into them from public.profiles p where p.friend_code = upper(btrim(coalesce(p_code, '')));
  if them is null then
    return jsonb_build_object('answer', 'unknown');
  end if;
  return jsonb_build_object('answer', private.befriend(p_from, them), 'to', them);
end;
$$;

-- Answers a request: yes makes them friends ('accepted', or 'full'), no forgets it ('declined').
-- 'gone' for a request that is not there any more.
create function public.friend_answer(p_me uuid, p_from uuid, p_yes boolean) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.friend_requests where from_user = p_from and to_user = p_me) then
    return 'gone';
  end if;
  if p_yes then
    return private.befriend(p_me, p_from);
  end if;
  delete from public.friend_requests where from_user = p_from and to_user = p_me;
  return 'declined';
end;
$$;

-- Ends a friendship for both, and takes back a request either way: whatever there was between them.
create function public.friend_remove(p_me uuid, p_other uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships where (follower = p_me and followed = p_other) or (follower = p_other and followed = p_me);
  delete from public.friend_requests where (from_user = p_me and to_user = p_other) or (from_user = p_other and to_user = p_me);
  return 'ok';
end;
$$;

-- Asks a player met in a game: as `befriend`, or 'closed' for oneself, a rat, or a player the asker
-- never shared that game with.
create function public.room_befriend(p_room uuid, p_from uuid, p_to uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_from = p_to
     or exists (select 1 from public.room_bots where user_id = p_to)
     or (select count(*) from public.room_players where room_id = p_room and user_id in (p_from, p_to)) <> 2 then
    return 'closed';
  end if;
  return private.befriend(p_from, p_to);
end;
$$;

-- The functions deployed before this one, with the words they knew: asking is their 'ok'.
create or replace function public.room_follow(p_room uuid, p_follower uuid, p_followed uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  said text := public.room_befriend(p_room, p_follower, p_followed);
begin
  return case when said in ('sent', 'pending', 'accepted', 'friends') then 'ok' else said end;
end;
$$;

create or replace function public.add_friend(code text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  them uuid;
  said text;
begin
  if me is null then
    raise exception 'nobody is signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.user_id into them from public.profiles p where p.friend_code = upper(btrim(coalesce(code, '')));
  if them is null then
    return 'unknown';
  end if;
  said := private.befriend(me, them);
  return case when said in ('sent', 'pending', 'accepted', 'friends') then 'ok' else said end;
end;
$$;

revoke all on function public.friend_request(uuid, text) from public, anon, authenticated;
revoke all on function public.friend_answer(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.friend_remove(uuid, uuid) from public, anon, authenticated;
revoke all on function public.room_befriend(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.room_follow(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_friend(text) from public, anon, authenticated;
grant execute on function public.friend_request(uuid, text) to service_role;
grant execute on function public.friend_answer(uuid, uuid, boolean) to service_role;
grant execute on function public.friend_remove(uuid, uuid) to service_role;
grant execute on function public.room_befriend(uuid, uuid, uuid) to service_role;
grant execute on function public.room_follow(uuid, uuid, uuid) to service_role;
grant execute on function public.add_friend(text) to authenticated;
