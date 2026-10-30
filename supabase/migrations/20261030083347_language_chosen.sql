-- A profile always says a language: the one it was first opened in (`ensureProfile`), or one the
-- retired web let a player pick. Neither says the player uses it now, and no client since has been able
-- to change it. From here on a language counts only where the player chose it: `language_chosen_at`
-- is null for every profile there is, so stale values stop overriding anything, and no data is rewritten.
-- Clients that read `language` and ignore this column go on as they were.
alter table public.profiles add column language_chosen_at timestamptz;

-- The player's own to write, as their language is: by the column grants, under the same row rules.
grant insert (language_chosen_at) on public.profiles to authenticated;
grant update (language_chosen_at) on public.profiles to authenticated;

-- The market notice was the one notice that read the profile's language, and the column is never null,
-- so the device's language never had a say. It speaks the player's choice, else the device's (which
-- follows the language the game is played in), as every other notice does.
create or replace function public.notice_market(p_now timestamptz)
returns table (endpoint text, p256dh text, auth text, locale text, user_id uuid, game_id uuid, life_id text, engine_version text, content_version text, challenge text, log jsonb, token text)
language sql
stable
set search_path = ''
as $$
  with devices as (
    select s.endpoint, s.p256dh, s.auth, s.locale, s.user_id, null::text as token from public.push_subscriptions s where s.market_moved
    union all
    select null, null, null, coalesce(t.locale, 'en'), t.user_id, t.token from public.push_tokens t where t.market_moved
  )
  select d.endpoint, d.p256dh, d.auth, case when p.language_chosen_at is not null then p.language else d.locale end, d.user_id,
    g.id, g.life_id, g.engine_version, g.content_version, g.challenge, g.log, d.token
  from devices d
  join public.games g on g.user_id = d.user_id and g.mode = 'ranked' and g.status = 'playing'
    and g.updated_at <= p_now - interval '20 hours' and g.updated_at > p_now - interval '6 days'
  left join public.profiles p on p.user_id = d.user_id
  order by d.user_id, coalesce(d.endpoint, d.token);
$$;
revoke all on function public.notice_market(timestamptz) from public, anon, authenticated;
grant execute on function public.notice_market(timestamptz) to service_role;
