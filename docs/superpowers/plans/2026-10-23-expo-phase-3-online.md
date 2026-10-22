# Expo app, phase 3: online — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything online the web has, in the app, with the web's look and behaviour:
- the guest account and keeping it with Google;
- cloud saves;
- ranked lives;
- the week's challenge with its attempts and boards;
- rankings;
- friends;
- games with others;
- push;
- the eight events;
- error reports.

**Architecture:** `@ratrace/online` is wired on the phone by one module, `apps/mobile/src/online/`, the twin of the web's `apps/web/src/online/index.ts`. The context's stand-ins (`game/offline.ts`) give way to the real hooks with the web's names. Online screens are ported as phase 2 ported the rest. The server's additions (Expo push tokens, the events table, the app's error pages) land on `dev` as small additive commits, deployed only with the user's go-ahead.

**Tech Stack:** what phase 2 used, plus `@supabase/supabase-js` (already a dependency of `@ratrace/online`), `expo-web-browser`, `expo-network`, `expo-clipboard`, `expo-notifications`, `react-native-webview` (captcha only), and Deno edge functions with Postgres migrations (server lane).

**Spec:** `docs/superpowers/specs/2026-10-20-expo-app-design.md`. Read its sections "Phase 3 design" and "Phases" (3).

## Global Constraints

Everything in phase 2's Global Constraints still holds (`docs/superpowers/plans/2026-10-21-expo-phase-2-solo-game.md`): the kit rules, parity, performance budgets and the method. These are added:

- **Lanes.**
  - The app lane works on branch `expo` (worktree `.worktrees/expo`).
  - The server lane works on a branch `mobile-server` cut from `origin/dev`, in its own worktree `.worktrees/mobile-server`. Its commits reach `dev` by fast-forward after review: `git fetch && git rebase origin/dev`, then `git push origin mobile-server:dev`. Stage by path; another session shares `dev`.
  - The server lane never runs `supabase db push`, `online:deploy`, `online:live-check`, `online:test-db` or `supabase config push`. Deploying waits for the user.
- **Changes made for the app must not change the web.**
  - Server lane: only additive SQL and additive function branches. The web's push, events and errors keep working unchanged, and the web's tests stay green.
  - `packages/online` changes are additive and the web's calls are untouched.
- **No live project in tests.** Tests use the web's in-memory servers (`apps/web/src/testing/rankedServer.ts`, `roomServer.ts`) and fakes. The simulator never signs in to the live project, except in Task 15, with the user's go-ahead.
- **Secrets.** No key, token or secret in the repo. The publishable Supabase URL and key come from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (as the web's `NEXT_PUBLIC_*`). With them unset, the app is the phase 2 app ("no account"). Never read `apps/web/.env.local`.
- **What a player is told.** The legal notice still says nothing is sent. Until the user settles the words, the app shows the web's online notice (`legal.*`). The phone-only words of phase 2 that become false online (`phone.legal.*`) are retired.
- **The wall.** `apps/mobile/src/architecture.test.ts` learns the new rules:
  - only `src/online/*` and `game/context.tsx` name `@ratrace/online` beyond types;
  - the senders allowed are the Supabase client, the dev scene channel and the probe;
  - the session's storage lives in `kvStore.ts`.

## Review Focus

- **The app opened with no network.** It is the phase 2 game, unchanged. When the network returns, the account and the cloud follow by themselves (`follow`), with no reload. Pinned in Tasks 2 and 3.
- **A cold start with a guest made on an earlier start.** The same guest comes back (the session is kept), never a new guest each launch. Pinned in Task 2.
- **Coming back from Google** in each case:
  - linked;
  - the account already exists (`identity_already_exists`), so the app takes the existing account and its saves are offered;
  - the player cancels;
  - the browser is killed.

  Each ends on the web's words for it, and none leaves the app half signed in. Pinned in Task 4.
- **A life begun on the web, open in the app** (and the reverse): the newer device's life is offered, never overwritten silently. Rules are kept, and a life under newer rules waits. Pinned in Task 3, and checked live in Task 15.
- **A push tapped with the app closed** opens the screen it names (`theratrace://<page>`), in the account's language. Pinned in Task 11.

---

## Server lane (branch `mobile-server`, worktree `.worktrees/mobile-server`)

### Task S1: Expo push tokens beside web push

**Files:**
- Create: `supabase/migrations/<stamp>_expo_push.sql`. Pick a stamp between the other session's hourly ones (see memory `shared-supabase-with-other-session`).
- Modify:
  - `supabase/functions/_deno/push.ts`: a second sender for Expo tokens.
  - `supabase/functions/_shared/notice.ts`: deep links for the app.
  - The SQL notice functions that join `push_subscriptions`: `notice_week`, `notice_idle`, the market notice and the challenge daily. Each also selects app tokens.
  - `packages/online/src/types.ts`, `packages/online/src/connect.ts`: `Community.notifyMe` accepts an app token. This is additive.
- Tests: next to the existing push and notice tests (`tools/online/src/notice.test.ts` and the function tests). Mirror them.

**Interfaces:**
- **Produces the table** `push_tokens`:
  - `token text primary key check (token like 'ExponentPushToken[%]')`
  - `user_id uuid not null references auth.users on delete cascade`
  - `locale text check (locale in ('en','es','ru'))`
  - `platform text check (platform in ('ios','android'))`
  - `market_moved boolean not null default false`
  - `created_at timestamptz default now()`
  - RLS: own rows only (select, insert, update, delete), as `push_subscriptions`.
- **Produces `Community.notifyMe`:** it takes `keys: PushKeys | { expo: string; platform: 'ios'|'android' }`, plus `locale`. `stopNotifying`, `marketNotice` and `setMarketNotice` follow the same two-kind shape.
- **Produces the sender:**
  - `deliverExpo(tokens, message)` POSTs to `https://exp.host/--/api/v2/push/send` in batches of 100.
  - A `DeviceNotRegistered` receipt or error deletes the token, as 404/410 deletes a web subscription.
  - The tap target is `theratrace://<page>` for app tokens, and `/<lang>/<page>` for the web as today.
- **Produces the cap:** the one-notice-a-day cap (`claimDay`) counts both kinds per player.

- [ ] **Step 1: Write the failing tests.**
  - A notice to a player with one web subscription and one app token sends one of each.
  - An app token answered `DeviceNotRegistered` is deleted.
  - The tap URL is the deep link for the app.
  - A player with only an app token gets the weekly, idle and market notices.
  - The web-only paths give byte-identical payloads to today's.
- [ ] **Step 2:** Implement. **Step 3:** Run all the repo's tests: green.
- [ ] **Step 4: Commit** `feat(online): push to the app beside the web, through Expo's service`.

### Task S2: The eight events, kept by the game's own project

**Files:**
- Create:
  - `supabase/migrations/<stamp>_app_events.sql`
  - `supabase/functions/track/index.ts`
  - `supabase/functions/_shared/events.ts`
- Modify:
  - `package.json`: the deploy list gains `track`.
  - `supabase/config.toml`: `[functions.track] verify_jwt = false`, because a guest who never signed in still counts.
  - `supabase/functions/_shared/rate.ts`: an `events` limit of 200 a day per IP hash.
  - `tools/online`: `online:stats` reads the events.
- Tests: `_shared/events.test.ts`, mirroring how `_shared/errors` is tested.

**Interfaces:**
- **Produces the table** `private.app_events`:
  - `day date not null`
  - `name text not null check (name in ('life_start','life_end','challenge_attempt','game_start','game_join','account_kept','app_installed','share'))`
  - `props jsonb not null default '{}'`
  - `platform text not null check (platform in ('ios','android','web'))`
  - `count int not null default 1`
  - A unique key on `(day, name, props, platform)`.
  - Writes go only through the function, which upserts `count = count + 1`.
  - No id, user, IP or score is stored. Props are validated against the web's `Counted` types (`apps/web/src/pwa/events.ts`), and any unknown key or value is refused.
- **Produces `POST /functions/v1/track`** taking `{ name, props, platform }`: 204, 400 when invalid, 429 when over the limit.

- [ ] **Step 1: Write the failing tests:**
  - each of the 8 events with its allowed props is kept and counted;
  - an unknown event, an unknown prop or a value that is not allowed is refused;
  - a prop that looks like an id is refused;
  - the rate limit holds.
- [ ] **Step 2:** Implement. **Step 3:** Run the repo's tests: green.
- [ ] **Step 4: Commit** `feat(online): the game counts its eight events in its own project, with nothing that names a player`.

### Task S3: The app's pages in error reports, and its redirect

**Files:**
- Modify:
  - `supabase/functions/_shared/errors.ts`: `placeOf` keeps the app's routes (`/`, `/new`, `/play`, `/challenge`, `/collection`, `/records`, `/rankings`, `/room`, `/player`, `/legal`, `/settings`) under an `app:` prefix, and `/other` otherwise.
  - `supabase/config.toml`: add `theratrace://**` to `additional_redirect_urls`.
  - `docs/backups.md` or the deploy notes: the redirect URL the user adds in the hosted dashboard.

- [ ] **Step 1: Test** `placeOf('app:/play')` → `app:/play` and `placeOf('app:/x/y')` → `/other`. The web's places are unchanged.
- [ ] **Step 2:** Implement. **Step 3:** Green.
- [ ] **Step 4: Commit** `feat(online): error reports know the app's screens, and the app's address comes back from Google`.

---

## App lane (branch `expo`)

### Task 1: `@ratrace/online` for a phone, without changing the web

**Files:**
- Modify:
  - `packages/online/src/connect.ts`: `CloudOptions` gains `storage?: SupportedStorage` and `autoRefresh?: boolean`. Google calls gain `{ returnTo, open?: (url: string) => Promise<string | null> }`. With `open` given, the call asks Supabase for the URL (`skipBrowserRedirect: true`), opens it, and exchanges the code it comes back with (`exchangeCodeForSession`).
  - `packages/online/src/supabase.ts`: `SupabaseAccount` takes the returned URL through `noticeIn`, the same as an address, and `begin()` keeps working with an address of `null`.
- Tests: `packages/online/src/{connect,account}.test.ts`.

**Interfaces:**
- **Produces:** `connectSupabase(url, key, { region, captcha, storage, autoRefresh })`, and the account's Google calls returning `Promise<boolean>` as today. With `open`, the call resolves once the browser comes back: linked, failed with its notice, or cancelled (`false`, no notice).
- **The web:** passes nothing new, and gets byte-identical calls. A test pins the web's `linkIdentity`/`signInWithOAuth` arguments.

- [ ] **Step 1: Write the failing tests:**
  - the storage is handed to `createClient`;
  - an `open` that returns `theratrace://auth?code=X` exchanges `X`;
  - one that returns `…?error=…&error_code=identity_already_exists` gives the web's `taken` path;
  - one that returns `null` (cancelled) gives `false` and no notice;
  - the web's arguments are unchanged.
- [ ] **Step 2:** Implement. **Step 3:** Green, with all of `packages/online`'s tests.
- [ ] **Step 4: Commit** `feat(online): the account and the cloud, ready for a phone's storage and a browser that comes back`.

### Task 2: The phone's online wiring

**Files:**
- Create:
  - `apps/mobile/src/online/index.ts`: the twin of `apps/web/src/online/index.ts`.
  - `apps/mobile/src/online/page.ts`: AppState and `expo-network` as `Page`.
  - `apps/mobile/src/online/errors.ts`: `ErrorUtils.setGlobalHandler` and unhandled rejections into `errorWatch`.
  - `apps/mobile/src/online/browser.ts`: `expo-web-browser`'s `openAuthSessionAsync`.
  - tests beside each.
- Modify:
  - `apps/mobile/src/kvStore.ts`: a `SupportedStorage` over the KV store for the session, plus the `given-up` and `refused` lists.
  - `apps/mobile/src/polyfills.ts`: `crypto.subtle.digest('SHA-256')` from `expo-crypto`.
  - `apps/mobile/src/architecture.test.ts`: the new rules from Global Constraints.
  - `apps/mobile/app.json`, `package.json`: the new Expo modules.
  - `vitest.config.ts`: the phone project covers `src/online/**`.

**Interfaces:**
- **Produces:** `phoneOnline(kept: PlayerStore): Online`. It has the web's `Online` shape: `account`, `saves`, `store` (mirrored), `ranked()`, `rooms()`, `community()`, `reportErrors`, `follow`. It answers offline when `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is unset.
- **Produces:** `phonePage: Page`, with `onOnline`, `onShown` and `now`.
- **Produces:** token refresh that starts when the app is active and stops in the background.

- [ ] **Step 1: Write the failing tests:**
  - a session written by one `phoneOnline` is read back by the next one, on the same fake KV, with no new guest;
  - the network coming back fires `onOnline`;
  - foreground fires `onShown` after 60 s away;
  - an uncaught error reaches `reportErrors` scrubbed;
  - with no env, the app is offline;
  - the wall's new rules pass, and a screen naming `@ratrace/online/connect` fails.
- [ ] **Step 2:** Implement. **Step 3:** Green.
- [ ] **Step 4: Commit** `feat(mobile): the phone reaches the game's servers, its session kept, its pages and errors watched`.

### Task 3: The context online — real hooks for the stand-ins

**Files:**
- Modify:
  - `apps/mobile/src/game/context.tsx`: wire it as the web's `game/context.tsx` does:
    - `GameSessions(store, LocalSessions, RankedSessions(...), versions)`;
    - `createRoomStore({ link, schedule, page })`;
    - `countingStarts`;
    - the `account_kept` note;
    - `saves.onDeviceChanged`;
    - re-boot on account change;
    - following the account's language (through `setLocale`, not the URL).
  - `apps/mobile/src/game/offline.ts`: delete it. Each hook moves into `context.tsx` with the web's name.
- Create:
  - `apps/mobile/src/game/events.ts`: a copy of the pure parts of `apps/web/src/pwa/events.ts` (`modeOf`, `countingStarts`, `lifeEnded`, `gameBegan`, the `Counted` types), held to the web's by a test as `cues.ts` is.
- Tests: the web's `context` cases for the cloud.

**Interfaces:**
- **Produces these hooks,** exported from `game/context.tsx` with the web's signatures:
  - `useAccount`, `useAccountSettled`, `useCommunity`, `useRanking` (online from `expo-network`), `useAccountSaves`;
  - `useRooms`, `useRoom`, `useInRoom`, `GameScope`;
  - `useTrack`, `useCanSignIn` (true when online is configured).
- **Produces sign-out:** it clears the device and remounts the provider, the phone's `location.reload()`.

- [ ] **Step 1: Write the failing tests,** with `memoryServices` plus fake account, saves, community and rooms, as the web's tests do:
  - a guest from the first launch;
  - the account's life offered on a new device;
  - taking it;
  - declining it;
  - the device's life kept when newer;
  - re-boot on account change;
  - the language following the account;
  - `useRanking` `'offline'` when the network is down;
  - ranked starts reaching `RankedSessions`.
- [ ] **Step 2:** Implement. **Step 3:** Green. Every phase 2 screen test still passes, because the stand-ins answered what a guest with no network gets, and that is still the answer with no services.
- [ ] **Step 4: Commit** `feat(mobile): the game's context online, the web's hooks in place of the stand-ins`.

### Task 4: Keeping the account with Google, the account in Settings, and the cloud-saves offer

**Files:**
- Modify:
  - `apps/mobile/src/game/screens/Settings.tsx`: `AccountBlock`, with `GoogleMark`.
  - `apps/mobile/src/game/screens/Home.tsx`: the account's offer button and Sheet, and the asks, as on the web.
- Create:
  - `apps/mobile/src/ui/GoogleMark.tsx`, through the kit Canvas.
  - The cloud-saves offer: whatever the web's `CloudSaves` pieces are, at the web's place and name.
- Tests: the web's `Account.test.tsx` and `CloudSaves.test.tsx`, ported.

- [ ] Use the screen method of phase 2. The scenes are registered and shot in Task 14.
  - `settings-account-guest`
  - `settings-account-member`
  - `home-offer` (sheet)
  - `home-account-taken`
- [ ] **Commit** `feat(mobile): the account kept with Google, its life offered on another phone`.

### Task 5: Kit pieces for online screens

**Files:**
- Create:
  - `apps/mobile/src/ui/TextField.tsx`: the web's text inputs in the game's look (frames, fonts, 44 pt). It covers nickname, friend code and room code: max length, upper-case codes, return key, `autoCorrect` off, `accessibilityLabel`.
  - `apps/mobile/src/ui/copy.ts`: `expo-clipboard`, with the web's "copied" toast.
- Modify: the kit page on both sides gains a `forms` section.

- [ ] **Step 1: Write the failing tests:**
  - the field's frame and focus look matches the web's classes;
  - the length limit holds;
  - codes are upper-cased;
  - copy writes the clipboard and tells.
- [ ] **Step 2:** Implement. **Step 3:** Green. Shoot `forms` with `kit-shots.ts --only=forms`.
- [ ] **Step 4: Commit** `feat(mobile): a text field and a copy in the game's look`.

### Task 6: The online parts of Home, Challenge, End, NewLife and Records

**Files:**
- Modify:
  - `Home.tsx`: `FriendRequests`, `ProfileLink`, the rankings link.
  - `Challenge.tsx`:
    - the attempt (ranked when `useRanking() === 'yes'`);
    - `ChallengeBoard`;
    - `ChallengeResult`;
    - the sign-in hint (`useCanSignIn`).
  - `End.tsx`: `useStanding`, the rankings link, `ChallengeResult`, `VersusOthers` (rooms quick game; it needs Task 9's quick-game call, so wire it then).
  - `NewLife.tsx`: the ranked Segmented, the offline note, the `elsewhere` Sheet.
  - `Records.tsx`: `RoomHistory`, a thin port. The full `RoomHistory` comes in Task 10.
- Tests: the web's online cases of `Home`, `Challenge`, `NewLife`, `End` and `Records`, ported.

- [ ] Screen method. Scenes:
  - `home-member`
  - `challenge-attempt`
  - `challenge-board`
  - `end-standing`
  - `new-ranked`
- [ ] **Commit** `feat(mobile): the online parts of the front door, the week's challenge, a life's end and a new life`.

### Task 7: Rankings

**Files:**
- Create:
  - `apps/mobile/src/game/screens/Rankings.tsx`: the web's 484 lines.
  - Its tests: the web's `Rankings.test.tsx`.
- Modify: `apps/mobile/src/app/rankings.tsx`, the real screen. `?tab=challenge` and `#friends` become route params.

- [ ] Screen method. The rows use `FlatList`, under the 30-row rule. Scenes:
  - `rankings-all`
  - `rankings-week`
  - `rankings-friends`
  - `rankings-challenge`
  - `rankings-nickname` (sheet)
- [ ] **Commit** `feat(mobile): the rankings, of all time, of the week, among friends and of the challenge`.

### Task 8: The player's own profile and their rat

**Files:**
- Create: `PlayerProfile.tsx` and `RatEditor.tsx`, with their tests ported.
- Modify: `apps/mobile/src/app/player.tsx`.

- [ ] Screen method. Scenes:
  - `player-member`
  - `player-editor` (each layer tab)
  - `player-friend-code`
- [ ] **Commit** `feat(mobile): the player's profile and their rat, dressed layer by layer`.

### Task 9: Games with others, part 1: the door, the lobby, a code and an invite

**Files:**
- Create: `Room.tsx` (the lobby, make or join by code, the public quick game, the invite), with tests ported from `Room.test.tsx`.
- Modify:
  - `apps/mobile/src/app/room.tsx`, which takes the route's `code` param.
  - `app.json` deep links (`theratrace://room?code=`).
  - `Home.tsx`: `RoomCard`.
  - `End.tsx`: `VersusOthers`.

**Interfaces:**
- **Invites:** use `Share` with the web's words and the web's link (`${SITE_URL}/${locale}/room?code=`). The deep link `theratrace://room?code=X` opens the room on a phone that has the app.
- **Tests:** use the web's in-memory `roomServer.ts`, by relative import.

- [ ] Screen method. Scenes:
  - `room-door`
  - `room-lobby-friends`
  - `room-lobby-public` (with the clock)
  - `room-join-code`
- [ ] **Commit** `feat(mobile): games with others, from the door to the lobby`.

### Task 10: Games with others, part 2: playing, loans, shouts, the end, the history

**Files:**
- Modify: `Room.tsx`, for the rest:
  - the room's Play through `GameScope`;
  - the room bar, actions, resolved and end slots (`Play` `RoomSlots`);
  - rematch and shouts.
- Create: `RoomLoans.tsx` and `RoomHistory.tsx`, with tests.
- Modify:
  - `Play.tsx`: the `room` slots.
  - `News.tsx`: the room's paper (`roomStory`, `useRoomPaper`).
  - `Resolve.tsx` and `Work.tsx`: the room's names.

- [ ] Screen method. Realtime goes through the room store's `watch`, with the in-memory server's watch in tests. Scenes:
  - `room-playing`
  - `room-loans`
  - `room-resolved`
  - `room-end`
  - `room-history`
- [ ] **Commit** `feat(mobile): playing with others, loans, shouts and a game's history`.

### Task 11: Push on the phone

**Files:**
- Create: `apps/mobile/src/online/push.ts`:
  - `expo-notifications` permission;
  - `getExpoPushTokenAsync({ projectId })` from `EXPO_PUBLIC_EAS_PROJECT_ID`;
  - registration through `Community.notifyMe({ expo, platform }, locale)` (Task S1's contract);
  - a tap's deep link handed to the router.
- Modify: `Settings.tsx`: `WeeklyNotice` and `MarketNotice` with their switches; `app.json`: the notifications plugin.

**Interfaces:**
- **Produces:** `pushOn(): Promise<'on'|'refused'|'unavailable'>`.
  - It returns `'unavailable'` when no EAS project id is set (Expo Go before the user's account exists) or on a simulator.
  - It never crashes and never asks twice.

- [ ] **Step 1: Write the failing tests:**
  - the switch asks permission once;
  - a refusal leaves the switch off with the web's words;
  - a token is registered with the locale;
  - turning the switch off calls `stopNotifying`;
  - a tap on `theratrace://room?code=X` opens the room;
  - `'unavailable'` hides the switches, following the "hide what can't be used" rule.
- [ ] **Step 2:** Implement. **Step 3:** Green.
- [ ] **Step 4: Commit** `feat(mobile): notices on the phone, asked once, opening what they name`.

### Task 12: The eight events, to the game's own project

**Files:**
- Create: `apps/mobile/src/online/track.ts`. It POSTs to `/functions/v1/track` (Task S2's contract) and counts only in a release build, as the web counts only in production.
  - The calls are fire-and-forget, never awaited by a screen.
  - Calls made while offline are dropped, never queued with anything personal.
- Modify:
  - `game/context.tsx`: `track` is wired to it.
  - `app_installed` is sent once, on the first launch after install.

- [ ] **Step 1: Write the failing tests:**
  - each of the 8 events goes out with the web's props and the platform;
  - nothing is sent in development;
  - a refused or failed send is silent;
  - `app_installed` is sent once.
- [ ] **Step 2:** Implement. **Step 3:** Green.
- [ ] **Step 4: Commit** `feat(mobile): the eight events counted in the game's own project`.

### Task 13: The guest sign-in's captcha, when the project asks for one

**Files:**
- Create: `apps/mobile/src/online/captcha.tsx`: Turnstile in a `react-native-webview` Sheet, interaction-only, returning the token to `@ratrace/online`'s `Captcha`.

- [ ] **Step 1: Write the failing tests:**
  - with `EXPO_PUBLIC_TURNSTILE_SITE_KEY` set, a guest sign-in waits for the token;
  - with it unset, no captcha is asked for, the same as the web;
  - a timeout of 120 s gives the web's failure.
- [ ] **Step 2:** Implement. **Step 3:** Green.
- [ ] **Step 4: Commit** `feat(mobile): the guest sign-in's captcha, in a sheet, when the project asks for one`.

### Task 14: Batch pass: the online scenes beside the web, device checks, performance

- [ ] Shoot every scene added in Tasks 4–10, plus `forms`. The scenes run on fake cloud services, the same on both clients, never the live project. Judge them by phase 2's tolerances and fix the differences. Two full runs must exit 0.
- [ ] Device checks on the simulator, run against the fakes only:
  - the Google flow, with a fake auth page served from 127.0.0.1;
  - a deep link into a room;
  - Realtime with the in-memory server;
  - push permission (`'unavailable'` in Expo Go).
- [ ] Performance on the release build:
  - cold start with a signed-in guest stays within 2 s;
  - Home → Play stays within 300 ms;
  - opening the rankings within 150 ms;
  - opening a room within 300 ms.

### Task 15: Phase exit: one life on two clients, live (with the user's go-ahead)

- [ ] Before anything, ask the user for:
  - the server lane's deploy (migration → `online:deploy` → `online:live-check`);
  - `theratrace://**` in the hosted redirect URLs;
  - the live run below.
- [ ] Live run, as a guest on the live project:
  1. Begin a life on the web (`pnpm dev`, port 3010).
  2. Keep the account with Google. The user does this step: it signs in to Google with their own account.
  3. Open it in the app and finish it.
  4. Do the reverse.

  Clean only this run's rows. Record each step.
- [ ] Update the parity report, the spec's "Phases" (phase 3 done; what phase 4 starts from), `CLAUDE.md` and the memory.
- [ ] Final whole-branch review on the most capable model, with one fix wave.
