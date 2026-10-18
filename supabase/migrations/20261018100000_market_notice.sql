-- "Your market moved": a notice to a player with a ranked life in progress, when something they hold
-- moved 5% or more in the round they last played. Sent by the market-notice function.
--
-- Each browser says whether it wants this notice, apart from the others: a switch of its own, on
-- by default, changed by the player through the same row-level rules as the rest of the row.
alter table public.push_subscriptions add column market_moved boolean not null default true;

-- The browsers to consider, with the ranked life of each one's player, in the order of the players
-- so that a player's browsers come together. A life is considered when it has not been touched for
-- 20 hours (a life being played needs no telling) nor for 6 days (a life left that long is told of
-- by the idle notice). The language is the one the player keeps in their account, or the one the
-- browser was subscribed in. The seed is not here: the function reads it apart.
create function public.notice_market(p_now timestamptz)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid, game_id uuid, life_id text, engine_version text, content_version text, challenge text, log jsonb)
language sql
stable
set search_path = ''
as $$
  select s.endpoint, s.p256dh, s.auth, coalesce(p.language, s.locale), s.user_id,
    g.id, g.life_id, g.engine_version, g.content_version, g.challenge, g.log
  from public.push_subscriptions s
  join public.games g on g.user_id = s.user_id and g.mode = 'ranked' and g.status = 'playing'
    and g.updated_at <= p_now - interval '20 hours' and g.updated_at > p_now - interval '6 days'
  left join public.profiles p on p.user_id = s.user_id
  where s.market_moved
  order by s.user_id, s.endpoint;
$$;
revoke all on function public.notice_market(timestamptz) from public, anon, authenticated;
grant execute on function public.notice_market(timestamptz) to service_role;

-- The evening job. Every day at 17:30 UTC, after the idle notice's 17:00; a player is told at most
-- one of the two, since both take the player's one notice of the day.
select cron.schedule(
  'market-notice',
  '30 17 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/market-notice',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
