# The Rat Race

A life-sim about money. pnpm monorepo, Node ≥ 22 (`source ~/.nvm/nvm.sh && nvm use`).

## Layout

Dependencies only point down this list:

| Where | What |
|---|---|
| `packages/engine` | The rules: pure state machine (`createGame`, `applyRound`, quotes, score). `ENGINE_VERSION` in `src/version.ts`. |
| `packages/content` | Data the engine runs on: cards, cities, careers, items, badges, headlines, and the bots (`bots.ts`: the balance tool's players, and the rats the server seats in public games; they go into each rules bundle). `CONTENT_VERSION` in `src/content.ts`. |
| `packages/i18n` | The interface's words: `messages/{en,es,ru}.json`, `LOCALES`, `messagesFor`. |
| `packages/core` | The game's logic, no UI and no browser: `session/*` (local, memory, resilient, rooms, ranked, saves, profile, rank), `game/*` (round store, present, records, guide, rivals, avatar, rules registry…), `lib/format`, `lib/mask`. Import as `@ratrace/core/<dir>/<name>`. |
| `packages/online` | The client of the servers, on top of core: account (`supabase`, `types`, `offline`), cloud saves (`mirror`, `merge`, `follow`), ranked and rooms APIs, `connect` (the only file that names `@supabase/supabase-js`), error reports. Import as `@ratrace/online/<name>`. |
| `apps/web` | Next.js + next-intl. Screens, UI kit, `game/context.tsx` (the one place that wires session, store and cloud), browser-only pieces (`session/indexeddb`, `game/browserBasket`, `session/rulesFromSite`, `online/index` (browser wiring), `online/captcha` (Turnstile), `online/language` (locale in the URL)), `testing/*` (ranked and room servers for tests, built on the real edge-function code). |
| `apps/mobile` | The Expo app (React Native, Hermes), on branch `expo` until phase 5 (`docs/superpowers/specs/2026-10-20-expo-app-design.md`). Mirrors `apps/web/src`: `game/screens/*` (each web screen's name, exports and props), `game/context.tsx` (wires the session, the round store and the phone's store), `kvStore.ts` (the phone's store, on `expo-sqlite/kv-store`, one key per finished life), `rules/` and `game/olderRules.ts` (the older rules a life in progress finishes under; the `v*.js` are copied by `pnpm rules` from `apps/web/public/rules`, not committed), `game/offline.ts` (the online hooks' stand-ins: "no account"), `ui/` (the pixel kit on Skia and Reanimated), `app/` (expo-router routes; `/scene`, `/kit`, `/dev` development only, `/perf` the probe's build only), `scripts/` (shots, sprites, rules, the timing collector), `testing/` (scenes, stand-ins). Parity with the web is shot scene by scene: `docs/superpowers/reports/2026-10-21-phase-2-parity.md` (phase 1's beside it). |
| `supabase/` | Edge functions (they run bundled rules from `functions/_shared/game/v<engine>-<content>.js`) and migrations. Rooms: `_shared/rooms.ts` (friends' games by code, public games via `quick` that start by themselves and fill empty seats with server-played rats from `room_bots`). Friends: `_shared/friends.ts` (both ways: a request, a yes or no, ended for both; the other is told by push; only the server writes `friendships`/`friend_requests`). |
| `tools/` | `art` (sprites), `balance` (simulated lives), `play` (CLI, `catalog`), `online` (bundle, deploy checks). |

Rules that guard this:
- `packages/core` and `packages/online` compile without DOM; eslint forbids `react`, `next`, `next-intl`, `@/*` and `window`/`localStorage`/`indexedDB` in them, and anything online or Supabase in core. A browser need goes in the web, behind a type the package exports.
- `apps/web/src/architecture.test.ts`: screens reach the game only through `GameSession`, never the engine's moves, the device or the cloud. It reads web, core and online as one tree (`@ratrace/core/x` = `@/x`, `@ratrace/online/x` = `@/online/x`).
- `apps/mobile/src/architecture.test.ts`: the same wall on the phone (no engine moves, device store or cloud in a screen; the device's storage named only in `kvStore.ts`, `game/context.tsx` and `testing/setup.ts`; no `hitSlop`; nothing sent, but a development scene's "ready" to the shots' driver and the probe's lines to its collector, both on this machine; no `@/ui/sound`), read with core as one tree.
- `apps/mobile/src/ui/devRoutes.test.ts`: test and development code (`testing/*`, `ui/kitMotion`) is named only by `/scene`, `/dev`, `/kit` and `/perf`, each `require`d behind `__DEV__` (`/perf`: `EXPO_PUBLIC_PERF`), so a release bundle holds none of it.
- Every i18n key must be used somewhere in web, core or apps/mobile; `phone.*` keys only by the app, never the web (both in `apps/web/src/i18n/messages.test.ts`). Russian addresses the player gender-neutrally.

## Commands

```
pnpm dev            # web on port 3010
pnpm -s test        # vitest, whole repo (run it all before every commit)
pnpm -s typecheck && pnpm -s lint
pnpm build          # web production build
pnpm balance        # simulated lives; check balance changes with it
pnpm -s art && pnpm --filter @ratrace/web exec tsx scripts/sprites.ts   # art/raw → sprites
pnpm online:stats [days]   # usage numbers from the live project, read-only (days played: private.player_days; events: private.app_events)
pnpm online:health         # is the live game up: site, guest, engine, a game with friends (hourly on GitHub, docs/backups.md)
```

The app (`apps/mobile`, branch `expo`): its tests run inside `pnpm -s test`: the vitest `phone` project (`src/{game,app,testing}`, on the native modules' stand-ins in `src/testing/setup.ts`) and the rest in `repo`; `pnpm install` runs its `postinstall` (`pnpm sprites && pnpm rules`: the sprites and the older rules it carries).
```
cd apps/mobile && npx expo start --port 8090          # Metro, for Expo Go on the booted iOS simulator
pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts web app compare [--only=a,b]   # scenes beside the web's (own next dev on 3021)
pnpm --filter @ratrace/web exec tsx ../mobile/scripts/kit-shots.ts                                  # the kit beside the web's
npx expo prebuild --platform ios --clean && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CI=1 npx expo run:ios --configuration Release --device <udid> --no-bundler
# ^ release build, in apps/mobile; with EXPO_PUBLIC_PERF=1 it carries the timing probe
pnpm --filter @ratrace/mobile exec tsx scripts/perf.ts --launches=5   # the probe's collector (127.0.0.1:8095), after 5 cold starts
```

Visits and where they come from: Vercel Web Analytics (no cookies), in the Vercel project's Analytics tab. Custom events (lives begun and ended by mode, challenge attempts, games with others begun and joined, accounts kept, installs, shares) are typed in `apps/web/src/pwa/events.ts`: never an id, a name or a score, production only; screens count through `useTrack()`. The same eight can be counted in the game's own project through the function `track` (`_shared/events.ts`; `private.app_events`, by day and platform, nothing of who sent them; any caller with the publishable key, and a ceiling of 20,000 a day for each event and platform), and `pnpm online:stats` prints them.

## Versions and games in progress

A life started under older rules keeps them until it ends: never interrupt a game.
- Bump `ENGINE_VERSION`/`CONTENT_VERSION` when rules or content change what a life does.
- `pnpm online:bundle` writes the bundle for the current versions and mirrors the older ones to `apps/web/public/rules`; `shipped.json` locks bundles already deployed.
- A new order (action) is listed in `ORDERS_SINCE` in `packages/core/src/game/rules.ts` (a test checks it against the bundles), so an older life never offers it.
- The app carries the older bundles too (`pnpm rules` copies `apps/web/public/rules` into `apps/mobile/src/rules`): a life under a version the app lacks waits for an update that carries it, never lost.

## Shipping

Work on `dev` and push `dev`. `main` is production: touch it only when asked.
The app (`apps/mobile`) is the exception until phase 5: work and push on `expo` (worktree `.worktrees/expo`), `git fetch && git rebase origin/dev` regularly, never merge it into `dev` or change the web for it unless asked.
Another session shares this repo and the Supabase project: `git fetch && git rebase origin/dev` before pushing or deploying.
Deploy order, only when asked: migration (`supabase db push --linked`) → `pnpm online:deploy` → `pnpm -s online:live-check` → `git push origin dev:main` (fast-forward) or a merge.
Never run `online:deploy`, `online:live-check`, `online:test-db` or `supabase config push` unasked. The local dev browser is a guest on the live Supabase: don't test saves by editing IndexedDB.

## UI conventions

Simplest UI that works; hide what can't be used. Details open in a dimmed modal `Sheet`, never inline. No framed box inside another. Spanish says "partidas", not "salas".
