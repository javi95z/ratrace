-- Ranked lives and rankings, after their review.
--
-- Three things. The ranking is read player by player, best life first, and gets the index that
-- hands it over that way. Ranked lives are bounded as casual ones are, so that the table a ranking
-- reads cannot be grown without end by one player. And the check on names stops refusing names
-- real people have, and stops letting through the plainest disguises of a name that is nobody's.

-- ------------------------------------------------------------------------------------------------
-- The ranking takes the best ranked life of each player. An index by score alone cannot give it
-- that; one by player, best first, can.
drop index public.runs_ranked_by_score;
create index runs_ranked_best on public.runs (user_id, score desc, finished_at, id) where mode = 'ranked';

-- ------------------------------------------------------------------------------------------------
-- Finished lives of every kind are bounded: five hundred of each, and the oldest make room. Of
-- ranked lives the player's best is never one of those that go: it is their place in the ranking
-- of all time. (The best of a week is among the latest five hundred, or the week was a busy one.)
create or replace function private.make_room_for_run() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  held integer;
begin
  if exists (select 1 from public.runs where id = new.id) then
    return new;
  end if;
  select count(*) into held from public.runs where user_id = new.user_id and mode = new.mode;
  if held >= 500 then
    delete from public.runs where id in (
      select r.id from public.runs r
      where r.user_id = new.user_id and r.mode = new.mode
        and (new.mode = 'casual' or r.id <> (
          select best.id from public.runs best
          where best.user_id = new.user_id and best.mode = new.mode
          order by best.score desc, best.finished_at asc, best.id limit 1
        ))
      order by r.finished_at asc, r.id limit held - 499
    );
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- Names.
--
-- A word refused wherever it appears also refuses every name that happens to hold it: Yamashita,
-- Nazir, Siriporn, Atwater, Torpedo, a therapist. Those words are now refused as the whole name,
-- and their commonest compounds wherever they appear.
update private.unwelcome_names set whole = true where word in ('shit', 'nazi', 'porn', 'twat', 'pedo', 'paedo', 'rapist', 'zorra');
insert into private.unwelcome_names (word, whole) values
  ('shithead', false), ('bullshit', false), ('dipshit', false), ('shitty', false), ('neonazi', false), ('pornhub', false), ('pedofil', false), ('pedophil', false), ('paedophil', false)
on conflict (word) do nothing;
-- A name that is the game's own, or its keepers', is refused wherever it appears: nobody is "RatRace_Staff".
update private.unwelcome_names set whole = false where word in ('admin', 'administrator', 'moderator', 'official', 'ratrace', 'theratrace', 'anthropic', 'supabase');

-- A name as it reads when it is checked whole: with whatever digits and underscores end it taken
-- off first, so that "Admin1" and "Admin_2" are "admin".
create function private.bare_name(name text) returns text
language sql
immutable
set search_path = ''
as $$
  select private.plain_name(regexp_replace(name, '[0-9_]+$', ''));
$$;
revoke all on function private.bare_name(text) from public, anon, authenticated;

create or replace function private.check_nickname() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plain text;
  bare text;
begin
  if new.nickname is null or (tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname) then
    return new;
  end if;
  plain := private.plain_name(new.nickname);
  bare := private.bare_name(new.nickname);
  if exists (
    select 1 from private.unwelcome_names u
    where (u.whole and (plain = u.word or bare = u.word)) or (not u.whole and position(u.word in plain) > 0)
  ) then
    raise exception 'that name is not accepted' using errcode = 'RR002';
  end if;
  return new;
end;
$$;
