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
  t timestamptz;
  big jsonb;
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
  if (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'profiles') = array['INSERT', 'SELECT', 'UPDATE']
    then passed := passed + 1; else failed := array_append(failed, ('the grants on profiles are not read, create, change')::text); end if;
  if (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'player_progress') = array['INSERT', 'SELECT', 'UPDATE']
    then passed := passed + 1; else failed := array_append(failed, ('the grants on player_progress are not read, create, change')::text); end if;
  if (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name = 'games') = array['DELETE', 'INSERT', 'SELECT', 'UPDATE']
    then passed := passed + 1; else failed := array_append(failed, ('the grants on games are not read, create, change, delete')::text); end if;

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
    select jsonb_agg(jsonb_build_object('picks', '[0]'::jsonb, 'orders', jsonb_build_array(repeat(md5(random()::text), 400)))) into big from generate_series(1, 40);
    update public.games set log = big where id = game_a;
    failed := array_append(failed, ('a log of over 256 KB was accepted')::text);
  exception when check_violation then passed := passed + 1;
  end;

  begin
    select count(*) into n from public.game_secrets;
    failed := array_append(failed, ('A read game_secrets')::text);
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
  delete from public.games where id = ranked_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('A deleted a ranked game')::text); end if;

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
  select count(*) into n from public.profiles;
  if n = 2 then passed := passed + 1; else failed := array_append(failed, (format('B sees %s profiles, not 2', n))::text); end if;
  select count(*) into n from public.runs where id = run_a;
  if n = 1 then passed := passed + 1; else failed := array_append(failed, ('B cannot see A''s finished run')::text); end if;
  select count(*) into n from public.games;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, (format('B sees %s games that are not theirs', n))::text); end if;
  select count(*) into n from public.player_progress;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('B sees A''s progress')::text); end if;
  update public.games set round = 1 where id = game_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('B changed A''s game')::text); end if;
  delete from public.games where id = game_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, ('B deleted A''s game')::text); end if;
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

  -- ---------------------------------------------------------------- an account deleted takes its rows with it
  reset role;
  delete from auth.users where id = a;
  select (select count(*) from public.profiles where user_id = a) + (select count(*) from public.player_progress where user_id = a) + (select count(*) from public.games where user_id = a)
       + (select count(*) from public.game_secrets where game_id = ranked_a) + (select count(*) from public.runs where user_id = a) into n;
  if n = 0 then passed := passed + 1; else failed := array_append(failed, (format('%s rows of a deleted account were left behind', n))::text); end if;

  raise exception 'SECURITY_TESTS %', json_build_object('passed', passed, 'failed', to_json(failed));
end $$;
