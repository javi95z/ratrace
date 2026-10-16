-- The security rules of the Rat Race database, tried as two players, as a visitor with no
-- account, and as the server. It is one block and it always ends by raising, so nothing it
-- creates is kept: the result travels in the message. Run it with `pnpm online:test-db`.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  game_a uuid := gen_random_uuid();
  ranked_a uuid := gen_random_uuid();
  run_a uuid := gen_random_uuid();
  passed int := 0;
  failed text[] := '{}';
  n int;
  held int;
  t timestamptz;
  big jsonb;
  made uuid;
  first_of_many uuid;
  ranked_b uuid := gen_random_uuid();
  challenge_b uuid := gen_random_uuid();
  code_a text;
  code_b text;
  yes1 boolean;
  yes2 boolean;
  yes3 boolean;
  who uuid[];
  scores int[];
  nm text;
  c uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  room_r uuid := gen_random_uuid();
  room_s uuid := gen_random_uuid();
  code_r text;
  ga uuid := gen_random_uuid();
  gb uuid := gen_random_uuid();
  gc uuid := gen_random_uuid();
  j jsonb;
  t2 timestamptz;
  log0 jsonb;
  e uuid := gen_random_uuid();
  room_t uuid := gen_random_uuid();
  ge uuid := gen_random_uuid();
  gd uuid := gen_random_uuid();
  fp text := 'test-' || replace(gen_random_uuid()::text, '-', '');
  far timestamptz := '2099-06-01 12:00:00+00';
  pages integer;
  functions integer;
begin
  -- Two guests, as the sign-in service would have made them.
  insert into auth.users (id, aud, role, is_anonymous) values (a, 'authenticated', 'authenticated', true), (b, 'authenticated', 'authenticated', true);

  -- ---------------------------------------------------------------- what the tables are, before anyone acts
  select count(*) into n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, (format('%s public tables have no row-level security', n))::text); end if;

  select count(*) into n from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';
  if n = 0 then passed := passed + 1; else failed := array_append(failed, (format('a visitor with no account holds %s privileges on public tables', n))::text); end if;

  select count(*) into n from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'game_secrets';
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('a player holds a privilege on game_secrets')::text); end if;

  if (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'runs') = array['SELECT']
    then passed := passed + 1; else failed := array_append(failed, ('a player may do more than read runs')::text); end if;
  -- A player reads profiles, and writes four columns of their own. The friend code is the server's to give.
  if (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'profiles') = array['SELECT']
    then passed := passed + 1; else failed := array_append(failed, ('a player holds more than reading on the whole of profiles')::text); end if;
  if (select array_agg(column_name::text order by column_name::text) from information_schema.role_column_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'profiles' and privilege_type = 'INSERT') = array['language', 'nickname', 'portrait', 'user_id']
     and (select array_agg(column_name::text order by column_name::text) from information_schema.role_column_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'profiles' and privilege_type = 'UPDATE') = array['language', 'nickname', 'portrait', 'user_id']
    then passed := passed + 1; else failed := array_append(failed, ('the columns of profiles a player may write are not their name, portrait and language')::text); end if;
  if (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'player_progress') = array['INSERT', 'SELECT', 'UPDATE']
    then passed := passed + 1; else failed := array_append(failed, ('the grants on player_progress are not read, create, change')::text); end if;
  if (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'games') = array['INSERT', 'SELECT', 'UPDATE']
    then passed := passed + 1; else failed := array_append(failed, ('the grants on games are not read, create, change')::text); end if;

  -- What is made in this schema from now on starts with nothing granted: a table or a function is
  -- reachable only once a migration says so.
  select count(*) into n from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and a.grantee in ('anon'::regrole, 'authenticated'::regrole);
  if n = 0 then passed := passed + 1; else failed := array_append(failed, format('%s default privileges still hand future objects in public to clients', n)); end if;
  create table public.probe_table (id int);
  create function public.probe_function() returns int language sql as 'select 1';
  if not has_table_privilege('anon', 'public.probe_table', 'select') and not has_table_privilege('authenticated', 'public.probe_table', 'select,insert,update,delete')
    then passed := passed + 1; else failed := array_append(failed, 'a table made without a grant is reachable by clients'); end if;
  if not has_function_privilege('anon', 'public.probe_function()', 'execute') and not has_function_privilege('authenticated', 'public.probe_function()', 'execute')
    then passed := passed + 1; else failed := array_append(failed, 'a function made without a grant can be called by clients'); end if;
  drop function public.probe_function();
  drop table public.probe_table;
  -- A visitor with no account can call nothing. A player can call five things: the ranking, following someone by their
  -- code, the ranking and the sums of choices of a week's challenge, and the question of whether they are in a room.
  select count(*) into n from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and has_function_privilege('anon', p.oid, 'execute');
  if n = 0 then passed := passed + 1; else failed := array_append(failed, format('%s functions of the game can be called with no account', n)); end if;
  if (select array_agg(p.proname::text order by p.proname::text) from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and has_function_privilege('authenticated', p.oid, 'execute')) = array['add_friend', 'challenge_choices', 'challenge_ranking', 'in_room', 'ranking']
    then passed := passed + 1; else failed := array_append(failed, 'the functions a player can call are not exactly the rankings, the choices of a challenge, following by code, and being in a room'); end if;

  -- ---------------------------------------------------------------- player A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;

  begin
    insert into public.profiles (user_id, nickname, language) values (a, 'rata_uno', 'es');
    passed := passed + 1;
  exception when others then failed := array_append(failed, (('A could not create their own profile: ' || sqlerrm))::text);
  end;
  begin
    insert into public.profiles (user_id) values (b);
    failed := array_append(failed, ('A created a profile for B')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.profiles set nickname = 'ab' where user_id = a;
    failed := array_append(failed, ('a nickname of two letters was accepted')::text);
  exception when check_violation then passed := passed + 1;
  end;
  begin
    update public.profiles set nickname = 'rata uno!' where user_id = a;
    failed := array_append(failed, ('a nickname with a space and a sign was accepted')::text);
  exception when check_violation then passed := passed + 1;
  end;
  begin
    update public.profiles set portrait = '<b>nurse</b>' where user_id = a;
    failed := array_append(failed, 'a portrait that is not the name of a life was accepted');
  exception when check_violation then passed := passed + 1;
  end;
  update public.profiles set portrait = 'civil_servant' where user_id = a;
  if (select portrait from public.profiles where user_id = a) = 'civil_servant' then passed := passed + 1; else failed := array_append(failed, 'the name of a life was refused as a portrait'); end if;
  begin
    update public.profiles set language = 'fr' where user_id = a;
    failed := array_append(failed, ('a language the game does not speak was accepted')::text);
  exception when check_violation then passed := passed + 1;
  end;
  begin
    delete from public.profiles where user_id = a;
    failed := array_append(failed, ('A deleted a profile')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    insert into public.player_progress (user_id, progress) values (a, '{"badges":{}}');
    passed := passed + 1;
  exception when others then failed := array_append(failed, (('A could not save their own progress: ' || sqlerrm))::text);
  end;
  begin
    insert into public.player_progress (user_id, progress) values (b, '{}');
    failed := array_append(failed, ('A saved progress for B')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    select jsonb_build_object('pad', repeat(md5(random()::text), 4000)) into big;
    update public.player_progress set progress = big where user_id = a;
    failed := array_append(failed, ('progress of over 64 KB was accepted')::text);
  exception when check_violation then passed := passed + 1;
  end;

  begin
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version, seed) values (game_a, a, 'casual', 'nurse', '0.4.0', '1.3.0', 'seed-a');
    passed := passed + 1;
  exception when others then failed := array_append(failed, (('A could not save their own casual game: ' || sqlerrm))::text);
  end;
  begin
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version) values (gen_random_uuid(), a, 'ranked', 'nurse', '0.4.0', '1.3.0');
    failed := array_append(failed, ('A created a ranked game without the server')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version, seed) values (gen_random_uuid(), b, 'casual', 'nurse', '0.4.0', '1.3.0', 's');
    failed := array_append(failed, ('A created a game owned by B')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    insert into public.games (id, mode, life_id, engine_version, content_version, seed) values (gen_random_uuid(), 'casual', 'nurse', '0.4.0', '1.3.0', 's');
    select count(*) into n from public.games where user_id = a;
    if n = 2 then passed := passed + 1; else failed := array_append(failed, ('a game saved without naming its owner is not the player''s own')::text); end if;
  exception when others then failed := array_append(failed, (('a game saved without naming its owner was refused: ' || sqlerrm))::text);
  end;
  begin
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version, seed, status) values (gen_random_uuid(), a, 'casual', 'nurse', '0.4.0', '1.3.0', 's', 'finished');
    failed := array_append(failed, 'A saved a game as already finished: only the server finishes a life');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version, seed) values (game_a, a, 'casual', 'nurse', '0.4.0', '1.3.0', 'seed-a')
      on conflict (id) do update set mode = 'ranked', seed = null;
    failed := array_append(failed, 'A turned a casual game into a ranked one by saving over it');
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- The dates of a row are the server's, whatever the client sends.
  made := gen_random_uuid();
  insert into public.games (id, mode, life_id, engine_version, content_version, seed, created_at, updated_at) values (made, 'casual', 'nurse', '0.4.0', '1.3.0', 's', '2001-01-01', '2099-01-01');
  if (select created_at > now() - interval '5 minutes' and updated_at < now() + interval '5 minutes' from public.games where id = made)
    then passed := passed + 1; else failed := array_append(failed, 'a client dated its own row on the way in'); end if;
  update public.games set created_at = '2001-01-01' where id = made;
  if (select created_at > now() - interval '5 minutes' from public.games where id = made)
    then passed := passed + 1; else failed := array_append(failed, 'a client changed the day a row was made'); end if;
  begin
    update public.games set id = gen_random_uuid() where id = made;
    failed := array_append(failed, 'a game was given another id');
  exception when check_violation then passed := passed + 1;
  end;
  begin
    delete from public.games where id = made;
    failed := array_append(failed, 'A deleted a game: games are abandoned, not deleted');
  exception when insufficient_privilege then passed := passed + 1;
  end;

  select updated_at into t from public.games where id = game_a;
  update public.games set round = 3, log = '[{"picks":[0],"orders":[]}]', state_hash = 'abc' where id = game_a;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, ('A could not update their own casual game')::text); end if;
  if (select updated_at from public.games where id = game_a) > t then passed := passed + 1; else failed := array_append(failed, ('a change did not move updated_at')::text); end if;

  begin
    update public.games set user_id = b where id = game_a;
    failed := array_append(failed, ('A gave their game to B')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.games set mode = 'ranked', seed = null where id = game_a;
    failed := array_append(failed, ('A turned a casual game into a ranked one')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.games set round = 99 where id = game_a;
    failed := array_append(failed, ('a round past the end of a life was accepted')::text);
  exception when check_violation then passed := passed + 1;
  end;
  begin
    -- Twelve rounds of 12.8 KB each: about 150 KB, where the longest life the game can produce is under 100.
    select jsonb_agg(jsonb_build_object('picks', '[0]'::jsonb, 'orders', jsonb_build_array(repeat(md5(random()::text), 400)))) into big from generate_series(1, 12);
    update public.games set log = big where id = game_a;
    failed := array_append(failed, ('a log of over 128 KB was accepted')::text);
  exception when check_violation then passed := passed + 1;
  end;
  begin
    update public.games set status = 'finished' where id = game_a;
    failed := array_append(failed, 'A marked their own game as finished: only the server finishes a life');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  update public.games set status = 'abandoned' where id = made;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, 'A could not abandon their own game'); end if;
  -- A life one device gave up is taken up again by the device that is still playing it.
  update public.games set round = 1, status = 'playing' where id = made;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, 'a game that was given up could not be taken up again by its owner'); end if;
  update public.games set status = 'abandoned' where id = made;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  update public.games set status = 'playing' where id = made;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, 'B took up a game that A had given up'); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);

  -- The account's copy of a life never goes backwards. A device that has not looked at the account
  -- since another one played further is refused aloud, under a code of its own, and learns to look.
  made := gen_random_uuid();
  insert into public.games (id, mode, life_id, engine_version, content_version, seed, round, log) values (made, 'casual', 'nurse', '0.4.0', '1.3.0', 's', 1, '[{"picks":[0,1],"orders":[]},{"picks":[0],"orders":null}]');
  begin
    update public.games set round = 1, log = '[{"picks":[0,1],"orders":[]}]' where id = made;
    failed := array_append(failed, 'a save with less of the life played went over a further one');
  exception when sqlstate 'RR001' then passed := passed + 1;
  end;
  begin
    insert into public.games (id, mode, life_id, engine_version, content_version, seed, round, status, log) values (made, 'casual', 'nurse', '0.4.0', '1.3.0', 's', 0, 'playing', '[{"picks":[0],"orders":null}]')
      on conflict (id) do update set round = excluded.round, status = excluded.status, log = excluded.log;
    failed := array_append(failed, 'the way a device saves put an older copy over a further one');
  exception when sqlstate 'RR001' then passed := passed + 1;
  end;
  update public.games set log = '[{"picks":[1,1],"orders":[]},{"picks":[1],"orders":null}]' where id = made;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, 'a copy as far along as the account''s could not be saved'); end if;
  update public.games set round = 2, log = '[{"picks":[1,1],"orders":[]},{"picks":[1],"orders":[]}]' where id = made;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, 'a copy further along could not be saved'); end if;
  update public.games set status = 'abandoned' where id = made;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, 'a life could not be given up once it had a log'); end if;

  begin
    select count(*) into n from public.game_secrets;
    failed := array_append(failed, ('A read game_secrets')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    insert into public.game_secrets (game_id, seed, state) values (game_a, 'x', '{}');
    failed := array_append(failed, 'A wrote game_secrets');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.game_secrets set seed = 'x';
    failed := array_append(failed, 'A changed game_secrets');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    delete from public.game_secrets;
    failed := array_append(failed, 'A deleted from game_secrets');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    insert into public.runs (id, user_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, finished_at) values (gen_random_uuid(), a, 'casual', 'nurse', '0.4.0', '1.3.0', 999999, 1, 1, 0, now());
    failed := array_append(failed, ('A wrote their own run')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- ---------------------------------------------------------------- the server
  reset role;
  insert into public.games (id, user_id, mode, life_id, engine_version, content_version) values (ranked_a, a, 'ranked', 'nurse', '0.4.0', '1.3.0');
  insert into public.game_secrets (game_id, seed, state) values (ranked_a, 'the-secret-seed', '{}');
  insert into public.runs (id, user_id, game_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, verified, finished_at) values (run_a, a, ranked_a, 'ranked', 'nurse', '0.4.0', '1.3.0', 321, 100, 20, 0, true, now());
  begin
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version, seed) values (gen_random_uuid(), a, 'ranked', 'nurse', '0.4.0', '1.3.0', 'leaked');
    failed := array_append(failed, ('a ranked game was stored with its seed in the readable table')::text);
  exception when check_violation then passed := passed + 1;
  end;

  -- ---------------------------------------------------------------- A again, with a ranked game the server made
  set local role authenticated;
  select count(*) into n from public.games where id = ranked_a;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, ('A cannot see their own ranked game')::text); end if;
  update public.games set round = 5 where id = ranked_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('A changed a ranked game')::text); end if;

  -- A life the server has finished is closed: its owner can read it and nothing else.
  reset role;
  update public.games set status = 'finished', round = 20 where id = game_a;
  set local role authenticated;
  update public.games set seed = 'another-seed', log = '[]' where id = game_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, 'A rewrote a finished game'); end if;
  update public.games set status = 'playing' where id = game_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, 'A took up again a game the server had finished'); end if;
  -- The way a device saves: insert, or update if it is there. On a finished game it is refused aloud,
  -- which is how the device learns that the life is over.
  begin
    insert into public.games (id, mode, life_id, engine_version, content_version, seed, round, status) values (game_a, 'casual', 'nurse', '0.4.0', '1.3.0', 's', 3, 'playing')
      on conflict (id) do update set round = excluded.round, status = excluded.status;
    failed := array_append(failed, 'A saved over a finished game');
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- A player holds fifty games at most. Lives that are over make room; lives still being played do not.
  first_of_many := gen_random_uuid();
  insert into public.games (id, mode, life_id, engine_version, content_version, seed) values (first_of_many, 'casual', 'nurse', '0.4.0', '1.3.0', 's');
  update public.games set status = 'abandoned' where id = first_of_many;
  for i in 1..60 loop
    made := gen_random_uuid();
    insert into public.games (id, mode, life_id, engine_version, content_version, seed) values (made, 'casual', 'nurse', '0.4.0', '1.3.0', 's');
    update public.games set status = 'abandoned' where id = made;
  end loop;
  select count(*) into n from public.games where user_id = a;
  if n <= 50 then passed := passed + 1; else failed := array_append(failed, format('A holds %s games, more than fifty', n)); end if;
  select count(*) into n from public.games where id in (first_of_many, made);
  if n = 1 and exists (select 1 from public.games where id = made) then passed := passed + 1; else failed := array_append(failed, 'the oldest game that was over did not make room for the newest'); end if;
  -- Saving a game that is already held needs no room: nothing is deleted for it, and it is taken up again.
  select count(*) into held from public.games where user_id = a;
  insert into public.games (id, mode, life_id, engine_version, content_version, seed, round, status) values (made, 'casual', 'nurse', '0.4.0', '1.3.0', 's', 2, 'playing')
    on conflict (id) do update set round = excluded.round, status = excluded.status;
  select count(*) into n from public.games where user_id = a;
  if n = held and exists (select 1 from public.games where id = made and round = 2 and status = 'playing') then passed := passed + 1; else failed := array_append(failed, format('saving a game already held changed how many A holds, from %s to %s', held, n)); end if;

  -- ---------------------------------------------------------------- player B
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;

  insert into public.profiles (user_id) values (b);
  begin
    update public.profiles set nickname = 'RATA_UNO' where user_id = b;
    failed := array_append(failed, ('B took A''s nickname in capitals')::text);
  exception when unique_violation then passed := passed + 1;
  end;
  -- The project has real players now: what is counted is what these two made, never the whole of a table.
  select count(*) into n from public.profiles where user_id in (a, b);
  if n = 2 then passed := passed + 1; else failed := array_append(failed, (format('B sees %s of the two profiles', n))::text); end if;
  select count(*) into n from public.runs where id = run_a;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, ('B cannot see A''s finished run')::text); end if;
  select count(*) into n from public.games;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, (format('B sees %s games that are not theirs', n))::text); end if;
  select count(*) into n from public.player_progress;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('B sees A''s progress')::text); end if;
  update public.games set round = 1 where id = game_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('B changed A''s game')::text); end if;
  -- An id belongs to whoever saved it first. Another player who saves under it is refused aloud:
  -- that is how a device that has changed accounts learns to give its life a new id.
  begin
    insert into public.games (id, mode, life_id, engine_version, content_version, seed, round, status) values (made, 'casual', 'nurse', '0.4.0', '1.3.0', 's', 9, 'playing')
      on conflict (id) do update set round = excluded.round, status = excluded.status;
    failed := array_append(failed, 'B saved under the id of a game of A');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    for i in 1..51 loop
      insert into public.games (id, mode, life_id, engine_version, content_version, seed) values (gen_random_uuid(), 'casual', 'nurse', '0.4.0', '1.3.0', 's');
    end loop;
    failed := array_append(failed, 'B holds fifty-one lives in progress');
  exception when check_violation then passed := passed + 1;
  end;
  update public.profiles set language = 'en' where user_id = a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('B changed A''s profile')::text); end if;
  update public.player_progress set progress = '{}' where user_id = a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('B changed A''s progress')::text); end if;

  -- ---------------------------------------------------------------- a visitor with no account
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    select count(*) into n from public.profiles;
    failed := array_append(failed, ('a visitor with no account read profiles')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    select count(*) into n from public.runs;
    failed := array_append(failed, ('a visitor with no account read runs')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    insert into public.games (id, mode, life_id, engine_version, content_version, seed) values (gen_random_uuid(), 'casual', 'nurse', '0.4.0', '1.3.0', 's');
    failed := array_append(failed, ('a visitor with no account saved a game')::text);
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    select count(*) into n from public.player_progress;
    failed := array_append(failed, 'a visitor with no account read progress');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    select count(*) into n from public.game_secrets;
    failed := array_append(failed, 'a visitor with no account read game_secrets');
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- A token that names nobody is nobody.
  reset role;
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;
  begin
    insert into public.games (id, mode, life_id, engine_version, content_version, seed) values (gen_random_uuid(), 'casual', 'nurse', '0.4.0', '1.3.0', 's');
    failed := array_append(failed, 'a token with no player in it saved a game');
  exception when insufficient_privilege or not_null_violation then passed := passed + 1;
  end;
  select count(*) into n from public.games;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, format('a token with no player in it reads %s games', n)); end if;

  -- ---------------------------------------------------------------- ranked lives
  reset role;
  -- The server keeps the seed of a ranked life, and plays its log again from it: there is no state to keep.
  insert into public.games (id, user_id, mode, life_id, engine_version, content_version) values (ranked_b, b, 'ranked', 'nurse', '0.10.0', '1.9.0');
  insert into public.game_secrets (game_id, seed) values (ranked_b, 'only-the-seed');
  if exists (select 1 from public.game_secrets where game_id = ranked_b and state is null) then passed := passed + 1; else failed := array_append(failed, 'a ranked game could not be kept as a seed alone'); end if;
  -- One ranked life in progress a player.
  begin
    insert into public.games (id, user_id, mode, life_id, engine_version, content_version) values (gen_random_uuid(), b, 'ranked', 'nurse', '0.10.0', '1.9.0');
    failed := array_append(failed, 'B holds two ranked lives in progress');
  exception when unique_violation then passed := passed + 1;
  end;
  -- Given up, it makes way for the next.
  update public.games set status = 'abandoned' where id = ranked_b;
  insert into public.games (id, user_id, mode, life_id, engine_version, content_version) values (gen_random_uuid(), b, 'ranked', 'nurse', '0.10.0', '1.9.0');
  select count(*) into n from public.games where user_id = b and mode = 'ranked';
  if n = 2 then passed := passed + 1; else failed := array_append(failed, 'a ranked life given up did not make way for a new one'); end if;

  -- ---------------------------------------------------------------- calls are counted
  -- For each player and each kind of call, in a window. Only the server counts.
  yes1 := public.take_rate(b, 'probe', 2, 60);
  yes2 := public.take_rate(b, 'probe', 2, 60);
  yes3 := public.take_rate(b, 'probe', 2, 60);
  if yes1 and yes2 and not yes3 then passed := passed + 1; else failed := array_append(failed, 'the third of two calls allowed was not refused'); end if;
  yes1 := public.take_rate(b, 'another-kind', 2, 60);
  yes2 := public.take_rate(a, 'probe', 2, 60);
  if yes1 and yes2 then passed := passed + 1; else failed := array_append(failed, 'calls of another kind, or of another player, were counted with the first'); end if;
  update private.rate_use set window_start = window_start - interval '61 seconds' where user_id = b and bucket = 'probe';
  yes1 := public.take_rate(b, 'probe', 2, 60);
  yes2 := public.take_rate(b, 'probe', 2, 60);
  yes3 := public.take_rate(b, 'probe', 2, 60);
  if yes1 and yes2 and not yes3 then passed := passed + 1; else failed := array_append(failed, 'a new window did not start, or did not count from one'); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  begin
    perform public.take_rate(b, 'probe', 1000000, 1);
    failed := array_append(failed, 'a player counted their own calls');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    select count(*) into n from private.rate_use;
    failed := array_append(failed, 'a player read the counters');
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- ---------------------------------------------------------------- finished casual lives are bounded
  reset role;
  for i in 1..505 loop
    insert into public.runs (id, user_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, verified, finished_at)
      values (gen_random_uuid(), b, 'casual', 'nurse', '0.10.0', '1.9.0', i, 1, 1, 0, true, now() - make_interval(mins => 1000 - i));
  end loop;
  select count(*), min(score) into n, held from public.runs where user_id = b and mode = 'casual';
  if n = 500 and held = 6 then passed := passed + 1; else failed := array_append(failed, format('B keeps %s finished casual lives, the oldest of score %s: not the latest five hundred', n, held)); end if;
  -- A ranked life is not one of the five hundred, and makes no casual one go.
  insert into public.runs (id, user_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, verified, finished_at)
    values (ranked_b, b, 'ranked', 'engineer', '0.10.0', '1.9.0', 500, 1, 1, 0, true, now());
  select count(*) into n from public.runs where user_id = b;
  if n = 501 then passed := passed + 1; else failed := array_append(failed, format('with a ranked life B holds %s finished lives, not 501', n)); end if;
  -- Writing a life that is already written makes no room for it.
  insert into public.runs (id, user_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, verified, finished_at)
    select id, user_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, verified, finished_at from public.runs where user_id = b and mode = 'casual' order by finished_at desc limit 1
    on conflict (id) do nothing;
  select count(*) into n from public.runs where user_id = b and mode = 'casual';
  if n = 500 then passed := passed + 1; else failed := array_append(failed, format('writing a finished life again left %s casual lives, not 500', n)); end if;
  -- Ranked lives are bounded too. The oldest make room, but never the player's best: that one is their place in the ranking.
  -- B's best, of 500, is the oldest of them all here.
  for i in 1..502 loop
    insert into public.runs (id, user_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, verified, finished_at)
      values (gen_random_uuid(), b, 'ranked', 'nurse', '0.10.0', '1.9.0', i % 7, 1, 1, 0, true, now() + make_interval(secs => i));
  end loop;
  select count(*), max(score) into n, held from public.runs where user_id = b and mode = 'ranked';
  if n = 500 and held = 500 and (select count(*) from public.runs where user_id = b and mode = 'casual') = 500
    then passed := passed + 1; else failed := array_append(failed, format('B keeps %s ranked lives, the best of score %s: not five hundred with the best among them', n, held)); end if;
  -- The ranking is read player by player, best life first: there is an index that hands it over that way.
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'runs_ranked_best') and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'runs_ranked_by_score')
    then passed := passed + 1; else failed := array_append(failed, 'the ranked runs are not indexed player by player, best first'); end if;

  -- ---------------------------------------------------------------- names
  select friend_code into code_a from public.profiles where user_id = a;
  select friend_code into code_b from public.profiles where user_id = b;
  if code_a ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' and code_b ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' and code_a <> code_b
    then passed := passed + 1; else failed := array_append(failed, 'a player was not given a friend code of their own'); end if;
  set local role authenticated;
  begin
    update public.profiles set friend_code = 'AAAAAAAA' where user_id = b;
    failed := array_append(failed, 'B chose their own friend code');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    insert into public.profiles (user_id, friend_code) values (b, 'AAAAAAAA') on conflict (user_id) do update set friend_code = excluded.friend_code;
    failed := array_append(failed, 'B wrote a friend code while making a profile');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  -- The way the game writes a profile on every launch still works.
  insert into public.profiles (user_id, language) values (b, 'es') on conflict (user_id) do update set user_id = excluded.user_id, language = excluded.language;
  if (select language from public.profiles where user_id = b) = 'es' then passed := passed + 1; else failed := array_append(failed, 'the game could not write the language of a profile'); end if;
  -- The game speaks three languages, and a profile may say any of them. (One it does not speak is refused: see A's, above.)
  begin
    update public.profiles set language = 'ru' where user_id = b;
    if (select language from public.profiles where user_id = b) = 'ru' then passed := passed + 1; else failed := array_append(failed, 'a profile written in Russian did not keep it'); end if;
  exception when check_violation then failed := array_append(failed, 'a profile could not be written in Russian');
  end;
  -- A name is refused for what it says, however it is spelled, and for whose it is.
  begin
    update public.profiles set nickname = 'Sh1t_head' where user_id = b;
    failed := array_append(failed, 'a name with a word that is not accepted, in digits, was taken');
  exception when sqlstate 'RR002' then passed := passed + 1;
  end;
  begin
    update public.profiles set nickname = 'F_u_C_k_E_r' where user_id = b;
    failed := array_append(failed, 'a name with a word that is not accepted, spaced out, was taken');
  exception when sqlstate 'RR002' then passed := passed + 1;
  end;
  begin
    update public.profiles set nickname = 'Adm1n' where user_id = b;
    failed := array_append(failed, 'a name that is not anyone''s to take was taken');
  exception when sqlstate 'RR002' then passed := passed + 1;
  end;
  begin
    update public.profiles set nickname = 'hijo_de_puta' where user_id = b;
    failed := array_append(failed, 'a name that is not accepted in Spanish was taken');
  exception when sqlstate 'RR002' then passed := passed + 1;
  end;
  update public.profiles set nickname = 'Admiral_Nigeria' where user_id = b;
  update public.profiles set nickname = 'Computadora9' where user_id = b;
  -- Names that real people have are not refused for a word that happens to be inside them.
  foreach nm in array array['Yamashita', 'Ishita_K', 'Nazir', 'Siriporn', 'Atwater', 'Torpedo', 'Therapist', 'Zorraquin'] loop
    begin
      update public.profiles set nickname = nm where user_id = b;
      passed := passed + 1;
    exception when sqlstate 'RR002' then failed := array_append(failed, format('the name %s was refused', nm));
    end;
  end loop;
  -- A name that is nobody's to take is not taken with a number after it, or inside a longer one; nor is a word that is not accepted.
  foreach nm in array array['Admin1', 'Admin_2', 'Moderator9', 'RatRace_Staff', 'x_Official_x', 'Rat_7', 'shit99', 'Bullsh1t'] loop
    begin
      update public.profiles set nickname = nm where user_id = b;
      failed := array_append(failed, format('the name %s was taken', nm));
    exception when sqlstate 'RR002' then passed := passed + 1;
    end;
  end loop;
  update public.profiles set nickname = 'Rata_Dos' where user_id = b;
  if (select nickname from public.profiles where user_id = b) = 'Rata_Dos' then passed := passed + 1; else failed := array_append(failed, 'an innocent name was refused'); end if;

  -- ---------------------------------------------------------------- friends
  -- B follows A by A's code, however it is typed, as often as they like. Nobody is made to follow anyone.
  if public.add_friend(code_a) = 'ok' and public.add_friend(' ' || lower(code_a) || ' ') = 'ok' then passed := passed + 1; else failed := array_append(failed, 'B could not follow A by their code'); end if;
  if public.add_friend(code_b) = 'self' and public.add_friend('ZZZZZZZZ') = 'unknown' and public.add_friend('') = 'unknown' then passed := passed + 1; else failed := array_append(failed, 'following oneself, or nobody, was not told apart'); end if;
  select count(*) into n from public.friendships where follower = b and followed = a;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, format('B follows A %s times', n)); end if;
  begin
    insert into public.friendships (follower, followed) values (a, b);
    failed := array_append(failed, 'B made A follow them');
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- ---------------------------------------------------------------- rankings
  reset role;
  insert into public.runs (id, user_id, mode, life_id, engine_version, content_version, score, net_worth, status, bankruptcies, verified, finished_at)
    values (gen_random_uuid(), a, 'ranked', 'nurse', '0.10.0', '1.9.0', 900, 1, 1, 0, true, now() - interval '10 days'),
           (gen_random_uuid(), a, 'casual', 'nurse', '0.10.0', '1.9.0', 99999, 1, 1, 0, true, now());
  set local role authenticated;
  -- The best ranked life of each player, the highest first. A casual life is in no ranking, whatever its score.
  -- (Among the two players of this test: the ranking has real players in it.)
  select array_agg(r.user_id order by r.place), array_agg(r.score order by r.place) into who, scores from public.ranking('all', null, false, 100) r where r.user_id in (a, b);
  if who = array[a, b] and scores = array[900, 500] then passed := passed + 1; else failed := array_append(failed, format('the ranking of all time is %s with %s', who, scores)); end if;
  -- This week: only lives finished since Monday.
  select array_agg(r.user_id order by r.place), array_agg(r.score order by r.place) into who, scores from public.ranking('week', null, false, 100) r where r.user_id in (a, b);
  if who = array[b, a] and scores = array[500, 321] then passed := passed + 1; else failed := array_append(failed, format('the ranking of the week is %s with %s', who, scores)); end if;
  -- Of one starting life.
  select array_agg(r.user_id order by r.place) into who from public.ranking('all', 'engineer', false, 100) r where r.user_id in (a, b);
  if who = array[b] then passed := passed + 1; else failed := array_append(failed, format('the ranking of one life is %s', who)); end if;
  -- Among friends: the asker and whom they follow. B follows A; A follows nobody.
  select array_agg(r.user_id order by r.place) into who from public.ranking('all', null, true) r;
  if who = array[a, b] then passed := passed + 1; else failed := array_append(failed, format('B''s ranking among friends is %s', who)); end if;
  -- The first so many, and the asker's own place if it is further down. Each with the name they chose.
  select array_agg(r.user_id order by r.place), array_agg(r.place::int order by r.place) into who, scores from public.ranking('all', null, true, 1) r;
  if who = array[a, b] and scores = array[1, 2] and (select r.nickname from public.ranking('all', null, true) r where r.user_id = b) = 'Rata_Dos'
     and (select count(*) from public.ranking('all', null, false, 1) r) <= 2 and exists (select 1 from public.ranking('all', null, false, 1) r where r.user_id = b)
    then passed := passed + 1; else failed := array_append(failed, format('the first one and the asker are %s at %s', who, scores)); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select array_agg(r.user_id order by r.place) into who from public.ranking('all', null, true) r;
  if who = array[a] then passed := passed + 1; else failed := array_append(failed, format('A''s ranking among friends is %s', who)); end if;
  -- A sees who follows them, and cannot undo it for them. B can.
  select count(*) into n from public.friendships;
  delete from public.friendships where follower = b;
  get diagnostics held = row_count;
  if n = 1 and held = 0 then passed := passed + 1; else failed := array_append(failed, format('A sees %s follows and undid %s that are not theirs', n, held)); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  delete from public.friendships where follower = b and followed = a;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, 'B could not stop following A'); end if;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform public.ranking();
    failed := array_append(failed, 'a visitor with no account read the ranking');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform public.add_friend('ZZZZZZZZ');
    failed := array_append(failed, 'a visitor with no account followed someone');
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- ---------------------------------------------------------------- weekly challenges
  reset role;
  -- The server makes a week's seed, enters B's attempt and writes it as finished, with what it chose.
  insert into public.challenge_seeds (week, seed) values ('1999-W01', 'week-seed');
  insert into public.games (id, user_id, mode, life_id, engine_version, content_version, status, challenge) values (challenge_b, b, 'ranked', 'nurse', '0.1.0', '1.0.0', 'finished', '1999-W01');
  insert into public.challenge_entries (user_id, week, game_id) values (b, '1999-W01', challenge_b);
  insert into public.runs (id, user_id, game_id, mode, life_id, engine_version, content_version, score, net_worth, status, finished_at, challenge)
    values (challenge_b, b, challenge_b, 'ranked', 'nurse', '0.1.0', '1.0.0', 500, 0, 0, now(), '1999-W01');
  insert into public.challenge_picks (run_id, week, seq, card_id, option) values (challenge_b, '1999-W01', 0, 'tax_advisor', 1), (challenge_b, '1999-W01', 1, 'health_illness', 0);
  -- A cannot read the seeds, the picks, or B's entry; A finds no choices before finishing; A reads the week's ranking.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  begin
    perform 1 from public.challenge_seeds;
    failed := array_append(failed, 'a player read the seeds of the challenges');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform 1 from public.challenge_picks;
    failed := array_append(failed, 'a player read the choices of every attempt');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  select count(*) into n from public.challenge_entries;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, format('A sees %s challenge entries that are not theirs', n)); end if;
  begin
    insert into public.challenge_entries (user_id, week, game_id) values (a, '1999-W01', gen_random_uuid());
    failed := array_append(failed, 'a player entered a challenge without the server');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  select count(*) into n from public.challenge_choices('1999-W01');
  if n = 0 then passed := passed + 1; else failed := array_append(failed, format('A, who has not finished the week, was told %s choices', n)); end if;
  select array_agg(r.user_id order by r.place) into who from public.challenge_ranking('1999-W01') r;
  if who = array[b] and (select r.entrants from public.challenge_ranking('1999-W01') r limit 1) = 1
    then passed := passed + 1; else failed := array_append(failed, format('the week''s ranking is %s', who)); end if;
  -- B, who has finished, is told their own choices beside everyone's, in order.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  if (select array_agg(c.card_id || ':' || c.option || ':' || c.same || '/' || c.answered order by c.seq) from public.challenge_choices('1999-W01') c) = array['tax_advisor:1:1/1', 'health_illness:0:1/1']
    then passed := passed + 1; else failed := array_append(failed, 'B was not told their own choices beside everyone''s'); end if;
  select count(*) into n from public.challenge_entries;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, format('B sees %s of their own challenge entries', n)); end if;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform public.challenge_ranking('1999-W01');
    failed := array_append(failed, 'a visitor with no account read the ranking of a challenge');
  exception when insufficient_privilege then passed := passed + 1;
  end;


  -- ---------------------------------------------------------------- rooms
  reset role;
  insert into auth.users (id, aud, role, is_anonymous) values (c, 'authenticated', 'authenticated', true), (d, 'authenticated', 'authenticated', true);
  -- Nobody but the server reads or writes a room's orders; a player reads rooms and their members, and writes nothing.
  if (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'room_orders') = 0
     and (select array_agg(privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'rooms') = array['SELECT']
     and (select array_agg(privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'room_players') = array['SELECT']
    then passed := passed + 1; else failed := array_append(failed, 'the grants on the rooms are not reading rooms and members, and nothing of orders'); end if;

  -- The server opens a room for A, with a code of six characters that cannot be mistaken.
  j := public.room_open(room_r, a, 'nurse', '0.1.0', '1.0.0', 180);
  code_r := j ->> 'code';
  if code_r ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' and (j ->> 'room')::uuid = room_r then passed := passed + 1; else failed := array_append(failed, format('opening a room answered %s', j)); end if;
  -- A is in one room at a time that is not over.
  j := public.room_open(gen_random_uuid(), a, 'nurse', '0.1.0', '1.0.0', 180);
  if j ->> 'error' = 'in-a-room' and (j ->> 'room')::uuid = room_r then passed := passed + 1; else failed := array_append(failed, format('a second room for A answered %s', j)); end if;
  begin
    perform public.room_open(gen_random_uuid(), d, 'nurse', '0.1.0', '1.0.0', 60);
    failed := array_append(failed, 'a room was opened with a round of a minute');
  exception when check_violation then passed := passed + 1;
  end;
  -- B joins by the code however it is typed, and joining again changes nothing. Pages on other rules and unknown codes are turned away.
  -- (Every call that changes something is made on its own line: the parts of one condition may be taken in any order.)
  j := public.room_join(' ' || lower(code_r) || ' ', b, '0.1.0', '1.0.0');
  nm := public.room_join(code_r, b, '0.1.0', '1.0.0') ->> 'room';
  if j ->> 'room' = room_r::text and nm = room_r::text and (select count(*) from public.room_players where room_id = room_r) = 2
    then passed := passed + 1; else failed := array_append(failed, format('B could not join by the code, or joined twice: %s', j)); end if;
  if (public.room_join(code_r, c, '0.2.0', '1.0.0')) ->> 'error' = 'other-version' and (public.room_join('ZZZZZZ', c, '0.1.0', '1.0.0')) ->> 'error' = 'unknown-room'
    then passed := passed + 1; else failed := array_append(failed, 'another version or an unknown code was not refused'); end if;
  -- C joins and leaves the lobby: the row stays, marked, so that nothing is ever deleted under the eyes of Realtime.
  perform public.room_join(code_r, c, '0.1.0', '1.0.0');
  j := public.room_leave(room_r, c);
  if j ->> 'status' = 'open' and (select left_at is not null from public.room_players where room_id = room_r and user_id = c)
    then passed := passed + 1; else failed := array_append(failed, format('C leaving the lobby answered %s', j)); end if;
  -- Only the host starts it, with a game for exactly each member still in it.
  if (public.room_start(room_r, b, 'room-seed', jsonb_build_object(a::text, ga, b::text, gb), now() + interval '3 minutes')) ->> 'error' = 'not-host'
     and (public.room_start(room_r, a, 'room-seed', jsonb_build_object(a::text, ga, c::text, gc), now() + interval '3 minutes')) ->> 'error' = 'moved'
     and (select status from public.rooms where id = room_r) = 'open'
    then passed := passed + 1; else failed := array_append(failed, 'a room was started by a guest, or with the wrong members'); end if;
  j := public.room_start(room_r, a, 'room-seed', jsonb_build_object(a::text, ga, b::text, gb), now() + interval '3 minutes');
  if (j ->> 'ok')::boolean and (select status from public.rooms where id = room_r) = 'playing'
     and (select count(*) from public.games where room = room_r and mode = 'room' and status = 'playing' and life_id = 'nurse' and seed is null and id in (ga, gb)) = 2
     and (select array_agg(distinct seed) from public.game_secrets where game_id in (ga, gb)) = array['room-seed']
     and (select array_agg(game_id order by game_id) from public.room_players where room_id = room_r and left_at is null) = (select array_agg(x order by x) from unnest(array[ga, gb]) x)
    then passed := passed + 1; else failed := array_append(failed, format('starting the room answered %s', j)); end if;
  if (public.room_join(code_r, d, '0.1.0', '1.0.0')) ->> 'error' = 'started' then passed := passed + 1; else failed := array_append(failed, 'D joined a room that had started'); end if;

  -- A card is written while the room is in its round and the game is as it was read.
  select updated_at, log into t, log0 from public.games where id = ga;
  nm := public.room_step(room_r, 0, a, ga, t, '[{"picks":[0],"orders":null}]', 0);
  nm := nm || ' ' || public.room_step(room_r, 0, a, ga, t, '[{"picks":[0,1],"orders":null}]', 0);
  nm := nm || ' ' || public.room_step(room_r, 1, a, ga, now(), '[{"picks":[0,1],"orders":null}]', 0);
  nm := nm || ' ' || public.room_step(room_r, 0, b, ga, now(), '[]', 0);
  if nm = 'ok moved moved closed' and (select log from public.games where id = ga) = '[{"picks":[0],"orders":null}]'
    then passed := passed + 1; else failed := array_append(failed, format('a card was written out of turn, or not written in turn: %s', nm)); end if;
  -- Orders wait: A is ready, the same orders again change nothing, other orders are refused, and a card is no longer taken.
  j := public.room_submit(room_r, 0, a, '[]');
  nm := (public.room_submit(room_r, 0, a, '[]')) ->> 'kept';
  nm := nm || ' ' || ((public.room_submit(room_r, 0, a, '[{"type":"x"}]')) ->> 'kept');
  if j ->> 'kept' = 'new' and not (j ->> 'all')::boolean and nm = 'same other'
     and (select ready_round from public.room_players where room_id = room_r and user_id = a) = 0
    then passed := passed + 1; else failed := array_append(failed, format('A''s orders answered %s', j)); end if;
  select updated_at into t from public.games where id = ga;
  if public.room_step(room_r, 0, a, ga, t, '[{"picks":[0,0],"orders":null}]', 0) = 'ready' then passed := passed + 1; else failed := array_append(failed, 'A answered a card after playing the round'); end if;
  j := public.room_submit(room_r, 0, b, '[]');
  if j ->> 'kept' = 'new' and (j ->> 'all')::boolean then passed := passed + 1; else failed := array_append(failed, format('B playing last answered %s', j)); end if;

  -- What members read: their room and everyone in it, B's readiness, and no standing before the round turns. Nobody reads the orders.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  if (select count(*) from public.rooms where id = room_r) = 1 and (select count(*) from public.room_players where room_id = room_r) = 3
     and (select ready_round from public.room_players where room_id = room_r and user_id = b) = 0 and (select count(*) from public.room_players where room_id = room_r and standing is not null) = 0
    then passed := passed + 1; else failed := array_append(failed, 'A does not read their room as it stands'); end if;
  if (select count(*) from public.games where id = gb) = 0 then passed := passed + 1; else failed := array_append(failed, 'A read B''s life in the room'); end if;
  begin
    perform 1 from public.room_orders;
    failed := array_append(failed, 'a member read the orders of the room');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.rooms set round = 5 where id = room_r;
    failed := array_append(failed, 'a member moved the room on');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.room_players set ready_round = 0 where room_id = room_r;
    failed := array_append(failed, 'a member changed who is ready');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform public.room_turn(room_r, 0, now(), '[]');
    failed := array_append(failed, 'a member turned the round');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform public.room_join(code_r, a, '0.1.0', '1.0.0');
    failed := array_append(failed, 'a player called the server''s joining of a room');
  exception when insufficient_privilege then passed := passed + 1;
  end;
  -- C, who left the lobby, still reads it; D, who was never in it, reads nothing of it.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  if (select count(*) from public.rooms where id = room_r) = 1 then passed := passed + 1; else failed := array_append(failed, 'C no longer reads the room they left'); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  if (select count(*) from public.rooms where id = room_r) = 0 and (select count(*) from public.room_players where room_id = room_r) = 0
     and not public.in_room(room_r)
    then passed := passed + 1; else failed := array_append(failed, 'D read a room they are not in'); end if;
  reset role;

  -- A turn writes every game, every standing and the room, or nothing: a game no longer as it was read stops all of it.
  select updated_at, log into t, log0 from public.games where id = ga;
  select updated_at into t2 from public.games where id = gb;
  nm := public.room_turn(room_r, 0, now() + interval '3 minutes', jsonb_build_array(
       jsonb_build_object('user', a, 'game', ga, 'as_read', t, 'log', '[{"picks":[0,0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{"score":1}'::jsonb),
       jsonb_build_object('user', b, 'game', gb, 'as_read', t2 - interval '1 second', 'log', '[{"picks":[0,0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{"score":2}'::jsonb)));
  if nm = 'moved'
     and (select round from public.rooms where id = room_r) = 0 and (select log from public.games where id = ga) = log0
     and (select count(*) from public.room_players where room_id = room_r and standing is not null) = 0
    then passed := passed + 1; else failed := array_append(failed, 'half a turn was written'); end if;
  -- Every member named, each as read: it turns once, and only once.
  nm := public.room_turn(room_r, 0, now() + interval '3 minutes', jsonb_build_array(
       jsonb_build_object('user', a, 'game', ga, 'as_read', t, 'log', '[{"picks":[0,0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{"score":1}'::jsonb)));
  nm := nm || ' ' || public.room_turn(room_r, 0, now() + interval '3 minutes', jsonb_build_array(
       jsonb_build_object('user', a, 'game', ga, 'as_read', t, 'log', '[{"picks":[0,0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{"score":1}'::jsonb),
       jsonb_build_object('user', b, 'game', gb, 'as_read', t2, 'log', '[{"picks":[0,0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{"score":2}'::jsonb)));
  if nm = 'moved ok'
     and (select round from public.rooms where id = room_r) = 1 and (select count(*) from public.games where id in (ga, gb) and round = 1) = 2
     and (select standing ->> 'score' from public.room_players where room_id = room_r and user_id = b) = '2'
    then passed := passed + 1; else failed := array_append(failed, format('a whole turn was not written: %s', nm)); end if;
  select updated_at into t from public.games where id = ga;
  select updated_at into t2 from public.games where id = gb;
  if public.room_turn(room_r, 0, now(), jsonb_build_array(
       jsonb_build_object('user', a, 'game', ga, 'as_read', t, 'log', '[]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{}'::jsonb),
       jsonb_build_object('user', b, 'game', gb, 'as_read', t2, 'log', '[]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{}'::jsonb))) = 'moved'
    then passed := passed + 1; else failed := array_append(failed, 'a round was turned twice'); end if;

  -- Leaving in play gives the life up and the room goes on for whoever is left; the last to leave closes it.
  j := public.room_leave(room_r, b);
  if j ->> 'status' = 'playing' and (select status from public.games where id = gb) = 'abandoned' and (select status from public.rooms where id = room_r) = 'playing'
    then passed := passed + 1; else failed := array_append(failed, format('B leaving the room in play answered %s', j)); end if;
  -- The last round turned with no deadline: the room is over, and A's life with it.
  select updated_at into t from public.games where id = ga;
  nm := public.room_turn(room_r, 1, null, jsonb_build_array(
       jsonb_build_object('user', a, 'game', ga, 'as_read', t, 'log', '[{"picks":[0,0],"orders":[]},{"picks":[],"orders":[]}]'::jsonb, 'round', 2, 'finished', true, 'standing', '{"score":3}'::jsonb)));
  if nm = 'ok'
     and (select status from public.rooms where id = room_r) = 'finished' and (select deadline from public.rooms where id = room_r) is null
     and (select status from public.games where id = ga) = 'finished'
    then passed := passed + 1; else failed := array_append(failed, format('the last round did not end the room: %s', nm)); end if;
  -- A leaves the room that is over; it stays over. A may open another.
  nm := (public.room_leave(room_r, a)) ->> 'status';
  j := public.room_open(room_s, a, 'nurse', '0.1.0', '1.0.0', 90);
  if nm = 'finished' and (select status from public.rooms where id = room_r) = 'finished' and j ->> 'room' = room_s::text
    then passed := passed + 1; else failed := array_append(failed, 'A could not leave a room that was over and open another'); end if;
  -- A day-old lobby is closed when the server next looks at it, and not before. The host leaving a lobby closes it for everyone.
  perform public.room_join((select code from public.rooms where id = room_s), d, '0.1.0', '1.0.0');
  yes1 := public.room_close(room_s, now() + interval '23 hours');
  yes2 := public.room_close(room_s, now() + interval '25 hours');
  if not yes1 and yes2
     and (select status from public.rooms where id = room_s) = 'closed'
    then passed := passed + 1; else failed := array_append(failed, 'a lobby was not closed after a day, or was closed before'); end if;
  room_s := gen_random_uuid();
  perform public.room_open(room_s, d, 'nurse', '0.1.0', '1.0.0', 300);
  perform public.room_join((select code from public.rooms where id = room_s), c, '0.1.0', '1.0.0');
  j := public.room_leave(room_s, d);
  if j ->> 'status' = 'closed' and (select count(*) from public.room_players where room_id = room_s and left_at is null) = 0
    then passed := passed + 1; else failed := array_append(failed, format('the host leaving the lobby answered %s', j)); end if;

  -- ---------------------------------------------------------------- rooms, after review
  reset role;
  begin
  insert into auth.users (id, aud, role, is_anonymous) values (e, 'authenticated', 'authenticated', true);
  perform public.room_open(room_t, e, 'nurse', '0.1.0', '1.0.0', 90);
  perform public.room_join((select code from public.rooms where id = room_t), d, '0.1.0', '1.0.0');
  perform public.room_start(room_t, e, 'seed-t', jsonb_build_object(e::text, ge, d::text, gd), now() + interval '90 seconds');
  -- A turn worked out before a member's orders were kept is refused: it would play them with none, and keep the orders unplayed.
  perform public.room_submit(room_t, 0, d, '[]');
  select updated_at into t from public.games where id = ge;
  select updated_at into t2 from public.games where id = gd;
  nm := public.room_turn(room_t, 0, now() + interval '90 seconds', jsonb_build_array(
       jsonb_build_object('user', e, 'game', ge, 'as_read', t, 'log', '[{"picks":[0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', false, 'standing', '{}'::jsonb),
       jsonb_build_object('user', d, 'game', gd, 'as_read', t2, 'log', '[{"picks":[0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', false, 'standing', '{}'::jsonb)));
  if nm = 'moved' and (select round from public.rooms where id = room_t) = 0
    then passed := passed + 1; else failed := array_append(failed, format('a turn that missed a member''s orders answered %s', nm)); end if;
  -- And a turn that says a member is ready who is not is refused too.
  nm := public.room_turn(room_t, 0, now() + interval '90 seconds', jsonb_build_array(
       jsonb_build_object('user', e, 'game', ge, 'as_read', t, 'log', '[{"picks":[0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{}'::jsonb),
       jsonb_build_object('user', d, 'game', gd, 'as_read', t2, 'log', '[{"picks":[0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{}'::jsonb)));
  if nm = 'moved' then passed := passed + 1; else failed := array_append(failed, format('a turn that made a member ready answered %s', nm)); end if;
  -- A log too large for its game is not a failure of the room: the turn answers so, writes nothing, and can be tried with less.
  big := (select jsonb_agg(jsonb_build_object('picks', '[0]'::jsonb, 'orders', (select jsonb_agg(jsonb_build_object('type', 'buy', 'pad', repeat('x', 1000))) from generate_series(1, 50)))) from generate_series(1, 3));
  nm := public.room_turn(room_t, 0, now() + interval '90 seconds', jsonb_build_array(
       jsonb_build_object('user', e, 'game', ge, 'as_read', t, 'log', big, 'round', 1, 'finished', false, 'ready', false, 'standing', '{}'::jsonb),
       jsonb_build_object('user', d, 'game', gd, 'as_read', t2, 'log', '[{"picks":[0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{}'::jsonb)));
  if nm = 'invalid' and (select round from public.rooms where id = room_t) = 0 and (select log from public.games where id = gd) = '[]'
    then passed := passed + 1; else failed := array_append(failed, format('a turn too large for a log answered %s', nm)); end if;
  nm := public.room_turn(room_t, 0, now() + interval '90 seconds', jsonb_build_array(
       jsonb_build_object('user', e, 'game', ge, 'as_read', t, 'log', '[{"picks":[0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', false, 'standing', '{}'::jsonb),
       jsonb_build_object('user', d, 'game', gd, 'as_read', t2, 'log', '[{"picks":[0],"orders":[]}]'::jsonb, 'round', 1, 'finished', false, 'ready', true, 'standing', '{}'::jsonb)));
  if nm = 'ok' and (select round from public.rooms where id = room_t) = 1 then passed := passed + 1; else failed := array_append(failed, format('the right turn answered %s', nm)); end if;
  -- A host whose account goes takes only their own rows: the room plays on, with no host, for whoever is left.
  delete from auth.users where id = e;
  if (select status from public.rooms where id = room_t) = 'playing' and (select host from public.rooms where id = room_t) is null
     and (select count(*) from public.room_players where room_id = room_t) = 1 and (select status from public.games where id = gd) = 'playing'
    then passed := passed + 1; else failed := array_append(failed, 'a host''s account took the room with it'); end if;
  -- A lobby left with no host can be started by nobody: the day closes it.
  room_t := gen_random_uuid();
  insert into auth.users (id, aud, role, is_anonymous) values (e, 'authenticated', 'authenticated', true);
  perform public.room_leave((select room_id from public.room_players where user_id = d and left_at is null limit 1), d);
  perform public.room_open(room_t, e, 'nurse', '0.1.0', '1.0.0', 90);
  perform public.room_join((select code from public.rooms where id = room_t), d, '0.1.0', '1.0.0');
  perform public.room_join((select code from public.rooms where id = room_t), c, '0.1.0', '1.0.0');
  delete from auth.users where id = e;
  j := public.room_start(room_t, d, 'seed', jsonb_build_object(d::text, gen_random_uuid(), c::text, gen_random_uuid()), now() + interval '90 seconds');
  if j ->> 'error' = 'not-host' and (select status from public.rooms where id = room_t) = 'open'
    then passed := passed + 1; else failed := array_append(failed, format('a member started a lobby with no host: %s', j)); end if;
  exception when others then
    failed := array_append(failed, format('the rooms after review stopped on: %s (%s)', sqlerrm, sqlstate));
  end;

  -- ---------------------------------------------------------------- errors
  reset role;
  -- Nobody but the server reads or writes the errors, or notes one.
  if (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'error_kinds' and grantee in ('anon', 'authenticated')) = 0
     and not has_function_privilege('authenticated', 'public.note_error(text, text, text, text, text, text, text, timestamptz)', 'execute')
     and not has_function_privilege('anon', 'public.note_error(text, text, text, text, text, text, text, timestamptz)', 'execute')
    then passed := passed + 1; else failed := array_append(failed, 'a player or a visitor can reach the errors'); end if;
  -- (Every test row is dated far ahead, where no real error is, and the whole block is undone at the end.)
  -- A kind seen for the first time is kept, and says it is worth an alert; seen again at once, it is counted and not alerted again.
  j := public.note_error(fp, 'page', '/play', 'boom', 'at play (app.js)', '0.1.0/1.0.0', 'Chrome 140', far);
  if (j ->> 'alert')::boolean and (j ->> 'seen')::int = 1 then passed := passed + 1; else failed := array_append(failed, format('a new kind of error answered %s', j)); end if;
  j := public.note_error(fp, 'page', '/play', 'boom again', 'at play (app.js)', '0.1.1/1.0.0', 'Firefox 131', far + interval '1 minute');
  if not (j ->> 'alert')::boolean and (j ->> 'seen')::int = 2
     and (select message || ' ' || build || ' ' || browser from public.error_kinds where fingerprint = fp) = 'boom again 0.1.1/1.0.0 Firefox 131'
     and (select first_seen from public.error_kinds where fingerprint = fp) = far
    then passed := passed + 1; else failed := array_append(failed, format('a kind seen again answered %s', j)); end if;
  -- Back after a quiet day, it is worth an alert again.
  j := public.note_error(fp, 'page', '/play', 'boom', null, null, null, far + interval '25 hours');
  if (j ->> 'alert')::boolean and (j ->> 'seen')::int = 3 then passed := passed + 1; else failed := array_append(failed, format('a kind back after a day answered %s', j)); end if;
  -- No more than ten alerts in an hour, whatever comes: the eleventh new kind is kept, and not alerted.
  for n in 1..10 loop
    perform public.note_error(fp || '-' || n, 'function', 'ranked', 'kind ' || n, null, null, null, far + interval '3 days' + n * interval '1 second');
  end loop;
  j := public.note_error(fp || '-11', 'function', 'ranked', 'kind 11', null, null, null, far + interval '3 days' + interval '20 seconds');
  if not (j ->> 'alert')::boolean and exists (select 1 from public.error_kinds where fingerprint = fp || '-11')
    then passed := passed + 1; else failed := array_append(failed, format('the eleventh alert of an hour answered %s', j)); end if;
  -- The pages and the functions have ten each: a flood of one never silences the other.
  j := public.note_error(fp || '-page', 'page', '/play', 'a page kind in a busy hour', null, null, null, far + interval '3 days' + interval '30 seconds');
  if (j ->> 'alert')::boolean then passed := passed + 1; else failed := array_append(failed, format('a page kind in an hour of function alerts answered %s', j)); end if;
  -- A kind that found no alert left is alerted when it comes again and there is one, not a day later.
  j := public.note_error(fp || '-11', 'function', 'ranked', 'kind 11', null, null, null, far + interval '3 days' + interval '2 hours');
  if (j ->> 'alert')::boolean and (j ->> 'seen')::int = 2 then passed := passed + 1; else failed := array_append(failed, format('a kind that missed its alert answered %s', j)); end if;
  -- What is not one of the two sources, or too long to be an error, is refused.
  begin
    perform public.note_error(fp || '-x', 'mail', '/play', 'boom', null, null, null, far);
    failed := array_append(failed, 'an error of an unknown source was kept');
  exception when check_violation then passed := passed + 1;
  end;
  -- A thousand kinds of each source at most: the ones seen longest ago make room, and pages make room only among pages.
  -- An old function kind, older than any page's, is not what a flood of pages pushes out.
  perform public.note_error(fp || '-old-function', 'function', 'engine', 'old', null, null, null, timestamptz '1999-01-01 00:00:00+00');
  select count(*) into functions from public.error_kinds where source = 'function';
  select count(*) into pages from public.error_kinds where source = 'page';
  -- Enough old pages to go one over a thousand, whatever the project already holds.
  pages := 1001 - least(pages, 999);
  for n in 1..pages loop
    perform public.note_error(fp || '-old-' || n, 'page', '/', 'old ' || n, null, null, null, timestamptz '2000-01-01 00:00:00+00' + n * interval '1 second');
  end loop;
  if not exists (select 1 from public.error_kinds where fingerprint = fp || '-old-1') and exists (select 1 from public.error_kinds where fingerprint = fp || '-old-' || pages)
     and (select count(*) from public.error_kinds where source = 'page') = 1000
     and (select count(*) from public.error_kinds where source = 'function') = functions
    then passed := passed + 1; else failed := array_append(failed, 'the kinds seen longest ago did not make room, or a page pushed out a function'); end if;

  -- ---------------------------------------------------------------- an account deleted takes its rows with it
  reset role;
  delete from auth.users where id = a;
  select (select count(*) from public.profiles where user_id = a) + (select count(*) from public.player_progress where user_id = a) + (select count(*) from public.games where user_id = a)
       + (select count(*) from public.game_secrets where game_id = ranked_a) + (select count(*) from public.runs where user_id = a)
       + (select count(*) from public.friendships where a in (follower, followed)) + (select count(*) from private.rate_use where user_id = a)
       + (select count(*) from public.rooms where host = a) + (select count(*) from public.room_players where user_id = a) + (select count(*) from public.room_orders where user_id = a) into n;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, (format('%s rows of a deleted account were left behind', n))::text); end if;

  -- The outcome travels as hex, so no quote in a message can be mistaken for the end of it.
  raise exception 'SECURITY_TESTS %', encode(convert_to(json_build_object('passed', passed, 'failed', to_json(failed))::text, 'UTF8'), 'hex');
end $$;
