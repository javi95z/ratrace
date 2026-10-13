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
  code_a text;
  code_b text;
  yes1 boolean;
  yes2 boolean;
  yes3 boolean;
  who uuid[];
  scores int[];
  nm text;
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
  -- A visitor with no account can call nothing. A player can call two things: the ranking, and following someone by their code.
  select count(*) into n from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and has_function_privilege('anon', p.oid, 'execute');
  if n = 0 then passed := passed + 1; else failed := array_append(failed, format('%s functions of the game can be called with no account', n)); end if;
  if (select array_agg(p.proname::text order by p.proname::text) from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and has_function_privilege('authenticated', p.oid, 'execute')) = array['add_friend', 'ranking']
    then passed := passed + 1; else failed := array_append(failed, 'the functions a player can call are not exactly the ranking and following by code'); end if;

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

  -- ---------------------------------------------------------------- an account deleted takes its rows with it
  reset role;
  delete from auth.users where id = a;
  select (select count(*) from public.profiles where user_id = a) + (select count(*) from public.player_progress where user_id = a) + (select count(*) from public.games where user_id = a)
       + (select count(*) from public.game_secrets where game_id = ranked_a) + (select count(*) from public.runs where user_id = a)
       + (select count(*) from public.friendships where a in (follower, followed)) + (select count(*) from private.rate_use where user_id = a) into n;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, (format('%s rows of a deleted account were left behind', n))::text); end if;

  -- The outcome travels as hex, so no quote in a message can be mistaken for the end of it.
  raise exception 'SECURITY_TESTS %', encode(convert_to(json_build_object('passed', passed, 'failed', to_json(failed))::text, 'UTF8'), 'hex');
end $$;
