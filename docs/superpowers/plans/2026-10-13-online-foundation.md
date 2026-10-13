# Online Foundation: Build Plan

Date: 2026-10-13
Spec: `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (sections 2, 4, 5, 6, 8, 9 and phase 1 of section 10)
Builds on: branch `web` at 96c46d5, on its own branch `online`.

This is roadmap step 11. It records decisions and tasks, not code. Nothing here is built until the owner has read it.

## What this step gives

A player has an account from the first launch without filling in anything, the database and its security rules exist, and the game's own engine runs on the server and gives the same answers as in the browser. No game is saved to the cloud yet: that is step 12, and it stands on this.

Not here: cloud saves and history (12), ranked games and rankings (13), the daily challenge (14), rooms (15), deployment to Vercel.

## Checked against Supabase's current documentation (2026-10-13)

- **New tables are no longer reachable through the Data API by default** (new projects since 2026-05-30). Every table a client may touch needs an explicit `grant`, and row-level security on top. A table with neither is unreachable, which is what the secret tables want.
- **Anonymous sign-in** makes a real user with the `authenticated` role and an `is_anonymous` claim in the token. Turning one into a permanent account is `linkIdentity({ provider: 'google' })`, and needs "manual linking" switched on in the project.
- Anonymous sign-ins are limited to 30 an hour per address, and Supabase recommends a CAPTCHA in front of them.
- The Realtime schema is locked against changes; this matters from step 15.
- Exact command flags and function bundling are checked again as each task is built.

## Decisions

### The game never needs the network

- With no Supabase address configured the game is exactly what it is today. The repository builds and every test runs with no keys and no connection.
- Being online is one more thing behind an interface, as sessions and stores already are. Screens learn of it through an `Account`: whether there is one, whether it is a guest, and how to keep it with Google. The architecture test is extended to hold screens to it.

### Accounts

- On first launch the game signs in anonymously, in the background. Failing to (no network, limit reached) is not an error the player sees: the game plays on, offline, and tries again next launch.
- The settings sheet says "Playing as a guest: your progress lives on this device" and offers "Keep my progress with Google". Linking keeps the same user, so nothing has to be moved.
- If the Google account already belongs to another player of this game, the game says so and changes nothing. Choosing which progress wins is step 12's business, where there is progress in the cloud to choose between.
- The session is kept by the Supabase client in the browser. The game is drawn in the browser, so no server-side session or cookie is needed.
- A CAPTCHA in front of anonymous sign-in is left for the step that puts the game in front of strangers. It needs an account with a CAPTCHA provider.

### Tables in this step

Only the tables this step and the next one use. The others arrive with the step that needs them, with their own tests.

| Table | Holds | A player may | Server only |
|---|---|---|---|
| `profiles` | nickname (optional, unique), portrait, language | read any; insert and change their own | |
| `player_progress` | unlocked lives, badges, gallery, guide, totals | read and write their own | |
| `games` | a life in progress: mode, life, versions, round, choice log, state hash | read and write their own casual games | ranked games |
| `game_secrets` | seed and server state of ranked games | nothing | everything |
| `runs` | one row per finished life, with a verified flag | read any | write |

- Row-level security on every table, policies written `to authenticated` with `(select auth.uid())` against the owner column, and `with check` on every update.
- Grants to `authenticated` only, and only the verbs each table needs. Nothing is granted to `anon`: nobody reads this game's data without an account, and an anonymous account is free.
- `game_secrets` has no grant and no policy. Functions reach it with the project's secret key, which the platform gives them and which never enters this repository.
- No trigger on the users table and no `security definer` function: a player's profile row is created by the player's own first write, which the insert policy allows. A trigger that fails would stop sign-ups; this cannot.
- Deleting a user deletes their rows (foreign keys with cascade).

### The engine on the server

- Edge Functions run on Deno, which wants import paths the packages do not use. So the engine and one version of the content are bundled into a single file per version pair, and a test fails if a bundle is stale against its source.
- One function, `engine`, with one job in this step: given a seed, a starting life and a choice log, replay it and return the score and the state hash. It requires a signed-in player and writes nothing.
- Versions: the function holds a table of the version pairs it can run. A pair it does not know gets a clear refusal. (As built: the game does not say "update the game"; a life on versions the server does not hold simply stays on its device.)
- Parity is proved, not assumed: lives recorded by the browser engine are replayed by the deployed function and must give the same hash at the end.

### Working without a local Supabase

- This machine has the Supabase CLI and no Docker, so there is no local database. The new project is empty and has no players: it is the development database. Migrations are files in `supabase/migrations`, pushed with the CLI.
- Security rules are tested in two ways: SQL tests run against the linked database, and a script that signs in two guests and checks that neither can read or change what is the other's, that a secret table cannot be reached, and that nothing can be read without an account.
- Tests that need the network are opt-in and are not part of `pnpm test`.
- The database advisors are run after every schema change and must come back clean.

### Secrets

- The browser gets the project address and the publishable key, from `apps/web/.env.local`, which is not committed. `.env.example` names the two values.
- The secret key is never written down here, never asked for and never pasted in a chat.

## Needs from the owner

1. Access to the new project for the CLI or the connector, and its ref and region.
2. In the dashboard: anonymous sign-ins on; manual linking on; site and redirect addresses for `localhost:3000`; the Google provider (can follow later, the rest does not wait for it).
3. The two public values in `apps/web/.env.local`.
4. A yes to using the new project as the development database, or Docker installed instead.

## Tasks

- [x] 1. Project wiring: `supabase/` config, link, `.env.example`, the `Account` interface with its offline form, the architecture test extended
- [x] 2. Schema: the five tables, policies, grants, indexes; SQL tests (45 checks, `pnpm online:test-db`); advisors: only the four notices that guests are let in, which is the design
- [x] 3. The engine bundle (`pnpm online:bundle`), the `engine` function (deployed), the version table, parity proved on three whole lives
- [x] 4. The game signs in as a guest; the profile row; the account block in settings; keeping it with Google; text in both languages
- [x] 5. The game with no Supabase configured: unchanged, proved by the existing end-to-end suite (35 passed)
- [x] 6. Spec and roadmap brought up to date
- [x] 6b. The live check (`pnpm online:live-check`): two real guests through the public API, and a whole life replayed by the deployed function. 17 checks held on 2026-10-13, and the two guests were removed afterwards
- [x] 7. Fresh review and one fix pass. The review found the page breaking once the project's values were set, a stored guest that a failed renewal could replace, no way back into a kept account from a second device, and that Supabase grants new tables and functions to every client by default; all fixed, with what cloud saves needed of the database, in the commits of step 12
