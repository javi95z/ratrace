# PWA

The web game is installable from its Home screen and keeps the static game shell on the device.
Offline lives can open without a network connection after the app has completed one online load;
ranked play and account synchronisation still require the network.

## Player experience

- Chromium browsers receive their native installation prompt from the **Install** button.
- Safari on iPhone and iPad receives a three-step **Share → Add to Home Screen → Add** guide.
- Other browsers receive equivalent menu instructions instead of a button that silently does nothing.
- The control disappears in standalone mode and after the browser reports a successful installation.
- If an uncached screen is requested offline, a small multilingual recovery page links to the
  cached English, Spanish and Russian homes.

## Build contract

`apps/web/scripts/pwa.ts` generates all app icons and `public/sw.js`. `predev` creates a development
asset set, while `postbuild` adds the current hashed Next.js chunks and fonts. The worker filename is
stable but its cache key includes the engine version, content version and asset list. Old Rat Race
caches are removed only after the replacement worker activates.

The worker caches same-origin pages and static assets. It deliberately bypasses:

- non-GET requests;
- cross-origin traffic, including Supabase;
- `/api/`;
- navigations with OAuth or other query strings.

Run `pnpm build` after changing routes, public assets, engine or content. The generated worker is
ignored by Git and must not be edited or committed. The icon files are committed so metadata remains
valid before the first local command runs.

## Verification

`pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` cover the manifest, icon dimensions,
install state, translated fallback instructions and worker generation. Playwright additionally opens
a route, takes the browser offline and reloads that route through the service worker.

For a manual check, use `pnpm build && pnpm --filter @ratrace/web start --port 3010`, open
`http://localhost:3010`, install from Home, then disable the network and relaunch the app. Service
workers work on localhost and HTTPS; they intentionally do not register under `next dev`.

## Notifications

A player with an account can turn notifications on in Settings. The switch only shows where the
browser can receive a push and the build has a VAPID public key. On iPhone and iPad it needs the game
installed to the Home screen (iOS 16.4 or later).

| Notice | When | Sent by | Capped |
|---|---|---|---|
| New weekly challenge, with last week's place | Mondays 08:00 UTC | `weekly-notice` (job `weekly-notice`) | yes |
| A life left halfway | daily 17:00 UTC, for a life untouched 7 to 8 days, none played since | `weekly-notice` with `{"kind":"idle"}` (job `idle-notice`) | yes |
| A game with friends has started | when the host starts it, to everyone else | `rooms` | no |
| Everyone else has played the round | when one member is left to play, with 20 s or more left | `rooms` | no |

- Capped notices take the player's one notice of the day (`notice_claim`, table `notice_days`, by UTC
  day). The notices of a game with friends are urgent and never capped.
- The browser subscription lives in `public.push_subscriptions`, one row per browser, owned by the
  player through RLS. A notice is written in the language the player had when subscribing.
- Browsers the push service reports gone (404/410) are deleted when a notice to them fails.
- A tap opens the notice's page, in an open window of the game if there is one.

### Setup, once

1. Generate the keys: `npx web-push generate-vapid-keys`. Keep the private one out of the repository.
2. Edge Function secrets:
   `supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<contact>`
3. Vault values the cron job reads, in the SQL editor:
   `select vault.create_secret('https://<ref>.supabase.co', 'project_url');`
   `select vault.create_secret('<secret key>', 'secret_key');`
4. In Vercel, `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>` for the web build.
5. `supabase db push`, then `pnpm online:deploy` (it deploys `weekly-notice` too).

To try it without waiting for Monday, call the function with the secret key:
`curl -X POST https://<ref>.supabase.co/functions/v1/weekly-notice -H "apikey: <secret key>"`.
