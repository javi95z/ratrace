-- Web push for the weekly challenge: where each player's browser can be reached, and a job that
-- calls the weekly-notice function every Monday morning, when a new challenge begins.

create table public.push_subscriptions (
  -- A browser's push endpoint is unique to it: one row a browser, whoever is signed in there.
  endpoint text primary key check (char_length(endpoint) between 1 and 1000 and endpoint like 'https://%'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  locale text not null default 'en' check (locale in ('en', 'es', 'ru')),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- A player sees, adds, changes and removes only the rows of their own browsers.
create policy "own subscriptions are read" on public.push_subscriptions for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "own subscriptions are added" on public.push_subscriptions for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "own subscriptions are changed" on public.push_subscriptions for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own subscriptions are removed" on public.push_subscriptions for delete
  to authenticated using ((select auth.uid()) = user_id);

-- The job. The project's address and its secret key are read from Vault, where they are put by hand
-- once (see docs/pwa.md): neither is written into this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'weekly-notice',
  -- Mondays at 08:00 UTC: the challenge of the week has begun.
  '0 8 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-notice',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
