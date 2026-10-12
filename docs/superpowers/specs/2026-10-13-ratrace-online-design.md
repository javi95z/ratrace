# The Rat Race: Online Design

Date: 2026-10-13
Status: draft for review. Each phase below gets its own detailed plan before it is built. Supabase features named here were checked against the current docs; exact APIs are checked again at build time.

## 1. Goal

Everything a player has lives online: their account, saved games, history, unlocks, rankings, daily challenges and rooms with friends. Solo play still works with no connection and syncs when one returns.

Nothing in this document is built in v1. Its purpose is to make sure v1 is built in a way that needs no rewrite.

## 2. Principles

- **One engine, two places.** The same `@ratrace/engine` package runs in the browser and in Supabase Edge Functions. It is already pure TypeScript with no Node or browser APIs, and its results are identical on every JavaScript engine.
- **The server decides anything that is ranked.**
- **In ranked play the future is secret.** The whole world of a game derives from its seed. So the server keeps the seed, and the client only ever receives worlds up to the current round.
- **Solo play never waits for the network.** The device plays; the cloud is where it syncs to.
- **A stored game is a seed and a list of choices,** not a blob of state. That is small, can be verified by replaying it, and can be replayed for the player later.

## 3. Two kinds of game

| | Casual | Ranked |
|---|---|---|
| Seed | Made on the device | Made and kept by the server |
| Engine runs | On the device | On the server, one call per round |
| Future rounds | On the device, so a player could peek | Never leave the server |
| Saves | Local, synced to the cloud | The server's record is the save |
| Counts for | Personal bests, unlocks, achievements | Global, weekly, daily and room rankings |
| Works offline | Yes | No |

Default: a signed-in player who is online plays ranked. With no connection the game falls back to casual and says so.

## 4. What v1 must do now

These are constraints on the milestones that come before any backend exists.

1. **The interface talks to two interfaces and nothing else.**
   - `GameSession`: start a game, read the current view, preview a round, submit a round.
   - `PlayerStore`: unlocks, achievements, collection, finished runs, settings.
   - v1 ships `LocalSession` (engine in the browser) and `LocalStore` (IndexedDB). Later come `RemoteSession` (calls the server) and `CloudStore`. No screen changes when they are swapped.
2. **The client holds a `GameView`, not a `GameState`.** A view is a state whose timeline stops at the current round. The local session derives it; the remote session receives it. The engine needs one small addition: `viewOf(state)`, and `previewRound` accepting a view. `previewRound` already reads only the current world.
3. **Every saved game records its engine version and content version.**
4. **Games and runs get their identifiers on the device** (UUIDs), so local records upload without renumbering.
5. **The resolve screen is drawn from the round's events only.** Events have the same shape whether they come from the device or the server.
6. **No game rules in the interface.** If a number is computed, the engine computes it.

## 5. Supabase components

| Component | Use |
|---|---|
| Auth | Anonymous sign-in on first launch, with no form. Later the player links email, Google or Apple to keep progress across devices |
| Postgres | Every table below, with row-level security on all of them |
| Edge Functions | Run the engine and the content packs on the server |
| Realtime | One private channel per room: who is present, and each round's results |
| Cron | Create each day's challenge, roll weekly rankings, resolve abandoned rooms |

The web app stays on Vercel. Supabase is added through the Vercel Marketplace integration so its keys arrive as environment variables. The service key is used only inside Edge Functions and never reaches the browser.

## 6. Data

| Table | Holds | Who can read | Who can write |
|---|---|---|---|
| `profiles` | Nickname, portrait, language | Everyone signed in | Owner |
| `player_progress` | Unlocked lives, achievements, collection, totals | Owner | Owner for casual progress; server for ranked |
| `games` | Mode, life, versions, start, round, status, choice log, state hash | Owner | Owner for casual; server for ranked |
| `game_secrets` | Seed and full server state of ranked games | Nobody | Server |
| `runs` | One row per finished life: score, net worth, escape round, verified flag | Everyone signed in | Server |
| `daily_challenges` | Day, scenario, content version | Everyone signed in | Server |
| `daily_secrets` | Day, seed | Nobody | Server |
| `daily_entries` | Day, player, game, score. One per player per day | Everyone signed in | Server |
| `rooms` | Code, host, status, round, deadline, settings | Members | Server |
| `room_secrets` | Seed and each member's full state | Nobody | Server |
| `room_players` | Seat, ready flag, public summary (net worth, status, score) | Members | Server; member sets own ready flag |
| `room_choices` | A member's choices for the current round | Owner only, until the round resolves | Owner, once per round |
| `friendships` | Who follows whom | Both sides | Either side |

Rankings are views over `runs` and `daily_entries`: all-time best per player, this week, per starting life, today's challenge, and each of those filtered to friends.

"Nobody" means the table has no policies at all, so only server code can touch it.

## 7. Flows

**Casual sync.** The device plays. After each round it saves the choice log, round number and state hash to `games`. When the life ends, a function replays the log and writes a verified row to `runs`. If two devices have the same game, the one with more rounds wins; games are never merged.

**Ranked solo.** `start-game` creates the seed, stores it in `game_secrets` and returns the view at round 0. Each round the client calls `submit-round` with its choices; the server runs `applyRound`, stores the result and returns the events and the next view. A repeated call for the same round returns the stored result. The preview needs no server call, because it reads only the current world.

**Daily challenge.** Cron creates tomorrow's scenario and seed. `daily-start` creates the player's one game for today. It then plays as ranked solo, with a shorter scenario set in content. A streak is a run of consecutive days in `daily_entries`. Days are UTC.

**Rooms.** The host creates a room and shares its code. Each round, members submit choices, which others cannot read. When everyone is ready or the deadline passes, any member's client calls `room-resolve`. A row lock makes it run once. It runs `applyRound` for every member against the shared world, stores the results and broadcasts them. A cron sweep resolves rooms nobody resolved. A member who reconnects fetches their view. A member who sends nothing plays an empty round.

## 8. Integrity

- Ranked play: the client cannot see the future or alter its state.
- Casual play: a player can peek on their own device, so casual results stay off global rankings.
- Functions are rate-limited. The engine already caps orders per round and rejects malformed ones.
- Nicknames are unique, short and filtered.
- Deleting an account deletes its rows.

## 9. Versions

Every game records the engine and content versions it started with and finishes on them. Functions bundle every version still in play. Once a version is retired, its finished games can be viewed but not replayed.

## 10. Phases

Each phase is its own plan and can ship alone.

1. **Foundation:** project, auth, profiles, schema, security policies, the engine running in a function, version handling.
2. **Cloud saves:** casual sync, run history, progress across devices.
3. **Ranked solo and rankings:** server-run games, global, weekly and friends rankings.
4. **Daily challenge:** scenario, one entry per day, streaks.
5. **Rooms:** create, join, simultaneous rounds, timers, reconnect, live ranking.

## 11. Decisions still open

1. Sign-in methods beyond anonymous: email link, Google, Apple.
2. Whether solo is ranked by default when online, as proposed in section 3.
3. How friends are added: a shareable code or link.
4. Database region.
5. Free-tier limits. A free Supabase project may pause when idle; confirm before friends rely on it.
