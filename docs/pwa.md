# PWA

The web game is installable from its Home screen and keeps the static game shell on the device.
Free lives can open without a network connection after the app has completed one online load;
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
