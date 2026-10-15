# The Rat Race: Online Design

Date: 2026-10-13
Status: phases 1 (foundation), 2 (cloud saves) and 3 (ranked solo and rankings) built on 2026-10-13; see `docs/superpowers/plans/2026-10-13-online-foundation.md`, `2026-10-13-cloud-saves.md` and `2026-10-13-ranked-and-rankings.md`. Phase 5 (rooms) built on 2026-10-16; see `2026-10-16-rooms.md`. Where what was built differs from what was designed, this document says what was built. The later phases are still design. Each phase gets its own detailed plan before it is built. Supabase features named here were checked against the current docs; exact APIs are checked again at build time.

## 1. Goal

Everything a player has lives online: their account, saved games, history, unlocks, rankings, daily challenges and rooms with friends. Solo play still works with no connection and syncs when one returns.

Its first purpose was to make sure v1 was built in a way that needs no rewrite. From phase 1 on it is also the record of what is built.

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
| Engine runs | On the device | On the server, one call per card and per round |
| Future rounds | On the device, so a player could peek | Never leave the server |
| Saves | Local, synced to the cloud | The server's record is the save |
| Counts for | Personal bests, unlocks, achievements | Global, weekly, daily and room rankings |
| Works offline | Yes | No |

Default: a signed-in player who is online plays ranked, and can turn that off for the life they are about to start. With no connection the game falls back to casual and says so, before the life begins; a server that cannot be reached at that very moment does the same, and the life says so once it has begun.

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
| Auth | Anonymous sign-in on first launch, with no form. Later the player links Google to keep progress across devices |
| Postgres | Every table below, with row-level security on all of them |
| Edge Functions | Run the engine and the content packs on the server |
| Realtime | One private channel per room: who is present, and each round's results |
| Cron | Create each day's challenge, roll weekly rankings, resolve abandoned rooms |

The web app stays on Vercel. The browser is given two public values, the project address and the publishable key; locally they are in `apps/web/.env.local`, which is never committed. The secret key is used only inside Edge Functions, where the platform provides it, and never reaches the browser or this repository. With the two values missing the game has no cloud and plays exactly as it does offline.

As built in phase 1:

- The project is "RatRace", in Tokyo. There is no local Supabase: the project is the development database, migrations in `supabase/migrations` are pushed with the CLI, and the security rules are tried by `supabase/tests/security.sql` as two players, a visitor and the server.
- A new table is not reachable through the Data API until it is granted. Every table has row-level security; `authenticated` is granted only the verbs a table needs; nothing is granted to a visitor with no account. A guest is `authenticated`.
- The engine reaches the functions as one bundled file per pair of engine and content versions, kept in `supabase/functions/_shared/game`. A test fails if the bundle of the current versions is stale, and the function refuses a pair it does not hold.
- Screens learn who is playing through an `Account` and nothing else. The Supabase client is loaded in one file, only when an account starts.

As built in phase 3:

- One function, `ranked`, plays ranked lives. It can be asked to start one, to show one, to answer a card, to play a round and to give one up.
- Every function counts its calls per player in a window and answers `429` beyond it: `engine` 30 a minute, `finish-run` 60 a minute (a first sync sends one finished life a second), ranked steps 240 a minute, new ranked lives 20 an hour. A call is counted before anything is looked up.
- With `NEXT_PUBLIC_SUPABASE_REGION` in the build, a ranked life asks for its function in the region of the database, where each of its steps is one long hop instead of several. The region is named in the address (`forceFunctionRegion`), not in the header the client library would add: the functions' gateway does not let a browser send that header.
- With `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in the build, the game asks Cloudflare Turnstile for a token before it signs a guest in, and hands it to Supabase. Its script is loaded only then. It is off until the owner makes the keys and turns on "Enable CAPTCHA protection" in Supabase with the same widget's secret: one without the other signs no new guest in.

## 6. Data

| Table | Holds | Who can read | Who can write |
|---|---|---|---|
| `profiles` | Nickname (optional, unique whatever its capitals, checked by the database), portrait, language, and a friend code the database makes | Everyone signed in | Owner: nickname, portrait and language only |
| `player_progress` | Unlocked lives, achievements, collection, totals | Owner | Owner for casual progress; server for ranked |
| `games` | Mode, life, versions, start, round, status, choice log, state hash | Owner | Owner for casual, until the server finishes the life; server for ranked. Never deleted by a player; fifty a player at most |
| `game_secrets` | Seed of ranked games. The state is not kept: it is played again from the seed and the log at every step | Nobody | Server |
| `runs` | One row per finished life: mode, score, net worth, escape round, verified flag. A player keeps 500 casual ones at most: the oldest make room | Everyone signed in | Server |
| `daily_challenges` | Day, scenario, content version | Everyone signed in | Server |
| `daily_secrets` | Day, seed | Nobody | Server |
| `daily_entries` | Day, player, game, score. One per player per day | Everyone signed in | Server |
| `rooms` | Code, host, life, versions, seconds a round, status, round, deadline | Members | Server |
| `room_players` | Seat, the member's game, the round they are ready in, when they left, their standing as of the last round played (net worth, status, score at the end) | Members of the same room | Server |
| `room_orders` | A member's orders for a round, once they have played it, kept after the round turns | Nobody | Server |
| `friendships` | Who follows whom. Following is one-way and needs no answer | Both sides | The follower: follows through a database function that takes a friend code, and stops by deleting the row. 200 at most |

Rankings are views over `runs` and `daily_entries`: all-time best per player, this week, per starting life, today's challenge, and each of those filtered to friends.

As built in phase 3, the rankings of `runs` are one database function, `ranking`, not views. It reads ranked lives only, takes the best of each player, and answers the first fifty and the asker's own place if it is further down. A week begins on Monday, UTC. Of two equal scores the earlier is ahead. It runs with the asker's own rights. A second private table counts each player's calls for the rate limit, and a third holds the words a name may not contain.

"Nobody" means the table has no policies at all, so only server code can touch it.

## 7. Flows

**Casual sync.** The device plays, and writes to itself first; the account follows. After each card and each round the device saves the seed, the choice log, the round and the state hash to its own row in `games`. When the life ends, the `finish-run` function plays the log again with the engine of the game's versions and writes the row in `runs` itself: no figure of a run comes from a device.

When a device meets its account (the page opens, the connection returns, someone signs in) the two are brought together. What is unlocked is joined, and nothing is ever taken away. Finished lives are joined by id. Of a life in progress one copy is taken whole: the account's if the device has none; the one with more of it played if both have the same life; and if they have different lives the device keeps its own and the account's is offered, never imposed. A life given up is marked `abandoned`, which means it is offered to nobody; a device still playing it takes it up again. Only a life the server has finished is closed.

Two rules of the `games` table hold this together whatever a device does. The account's copy of a life never goes backwards: a save with less of the life played than the account holds is refused under a code of its own, and the device that sent it reads the account. And an id belongs to whoever saved it first: a device that has changed accounts (a guest who signed in as someone who already had one) is told the id is taken, gives its life a new one, and sends it under that.

**Ranked solo.** `start-game` creates the seed, stores it in `game_secrets` and returns the view at round 0. Each round the client calls `submit-round` with its choices; the server runs `applyRound`, stores the result and returns the events and the next view. A repeated call for the same round returns the stored result. The preview needs no server call, because it reads only the current world.

As built: the `ranked` function makes a seed of 32 random bytes, keeps it in `game_secrets`, and keeps the life's log in `games`. At each step it plays the log again from the seed, takes the one new step, and writes the longer log. Nothing else of the state is stored, so there is no second copy to drift from the first. A step is numbered: the client says which step it is taking. If the server has already taken that step with that very choice, it answers what it answered then, so a reply lost on the way can be asked for again; if it stands anywhere else, it says where, and the client opens the life as it now is. The log is written only if the row is as it was read, so two requests at once cannot both be taken. A step answers what changed: the player as they now stand, what happened, and the one new world if the round turned. When the last round is played the server writes the run with `mode = 'ranked'` and closes the game.

A player has one ranked life in progress, and it is never ended unasked. Asked to start another, the server says which one is in the way and changes nothing; it gives that one up only when the request names it. The game names the life the device itself is living, which the player has just agreed to end; for one on another device it asks: go on with that life here, end it and start this one, or leave things as they are. A life whose last round was played and whose run was never written is not in the way: it is settled, there and when it is given up. A ranked life begins only under the rules the game plays now (the bundler names them), whatever older ones the server still holds to finish lives. The server refuses a life the player has not unlocked; if the device unlocked it a moment ago and the account has not heard, the life begins as a casual one. The device keeps a note of the ranked life with the last view it was given, so the front door can show it and it can be looked at with no connection. It cannot be played without one: a step that does not get through says so and can be tried again. A device with no life takes the account's ranked life in progress when it meets the account. The mirror of cloud saves does not send or replace a ranked life. It does remember one given up with no connection, tells the server when it can, and does not take that life back meanwhile. A ranked life begun under other versions than the page's cannot be continued there: a page that meets one of newer rules leaves it alone, and one that meets one of older rules drops its own note of it. Neither gives it up, because another device may still be living it under the rules it began with.

**Rankings, names and friends.** The rankings page shows the best ranked life of each player, of all time, of this week, or among the people the player follows, of any starting life or of one. A player appears under their nickname: 3 to 16 letters, digits or underscores. The database checks it where a client cannot skip the check: how it is written, that nobody has it, that it holds no word from a list read through the usual disguises (digits for letters, underscores), and that it is not a name that is nobody's to take, with or without digits after it. Words that sit inside names real people have (Yamashita, Nazir) are refused only as the whole name. Without one a player appears as "Rat" and four characters of their id. Each player has a code of eight characters; entering someone's code follows them. A player can stop following anyone.

**Daily challenge.** Cron creates tomorrow's scenario and seed. `daily-start` creates the player's one game for today. It then plays as ranked solo, with a shorter scenario set in content. A streak is a run of consecutive days in `daily_entries`. Days are UTC.

**Rooms.** Two to six friends live the same life in the same world at the same time, a round at a time, and see who does best with it. This is the design of phase 5; see decisions 22 to 31.

- *Making and joining.* A signed-in player opens a room: they choose its life, from the lives they have unlocked, and how long a round may take: 90 seconds, 3 minutes (the default) or 5 minutes. The room gets a code of six characters from an alphabet with no letters that read as others (no 0, O, 1, I, L), and a link that carries the code. Anyone signed in who has the code joins while the room is still in its lobby and has fewer than six members. A player is in one room at a time that is not over. A room is opened and joined only on the rules the server plays now, and a page on other rules is told to reload.
- *Starting.* The host starts the room once two or more are in it. The server then makes one seed for the room and one ranked-style game for each member (mode `room`), every one of them with that seed and the room's life. So every member begins exactly alike, the world of every round (prices, news, crises, taxes) is the same for all of them, and two members who chose the same would live the same life. What tells them apart is what they choose. Nobody can join a room that has started.
- *A round.* The room is in one round at a time, with a deadline. Each member reads the news and answers their cards at their own pace; the server plays each card at once, as for a ranked life. When a member plays the round, their orders are kept and not played: they are ready, and wait. The round turns when every member still in the room is ready, or when the deadline has passed by five seconds of grace. Then the server plays the round for every member at once: cards a member left unanswered take their first open option, and a member who sent no orders plays the round with none. The new standing of every member is written, the room moves to the next round, and its deadline is set from that moment. So nobody sees how the round turned out before everyone has chosen: the world is the same for all, and seeing it first would be seeing the future.
- *The clock.* The deadline is the server's. A page counts down to it from the server's time and, a second before it, plays the round as it stands for a member who has not: the orders in the basket if they reached their finances, none otherwise. A round is turned by whichever call reaches the server first once it is due, whoever's it is; the database lets one turn through and the others find the room already on.
- *What members see of each other.* Who is in the room and who is ready, at once. How each stands only as of the last round played: the score their life would have if it ended there, and whether they are out of the rat race. Never anyone's cards, orders or cash before a round turns. At the end, each member's score, and the room's order by score.
- *Leaving and coming back.* Everything is on the server, so a member who closes the page, loses the connection or changes device finds the room as it stands, with every round the clock played for them, and is told so. A member may leave. In the lobby that takes them out; the host leaving closes the room for everyone. Once it has started, their life is given up, the room stops waiting for them, and their last standing stays on the board marked as left. A room in which nothing has happened for a day is closed when it is next looked at, and its lives are given up: nobody is held in a room their friends have abandoned.
- *The end.* After the last round every life is over: the server writes each member's run (mode `room`, played by the server, not in the global rankings), and the room is over. Each member's page shows the room's final order, and the end of their own life as for any other.
- *Live.* A page in a room hears of every change to its room and its members through Realtime (Postgres changes, which the database's own row rules filter to members) and then asks the server how the room stands. It also asks every fifteen seconds while it is shown, when it is shown again, when the connection returns, and when the deadline is due. No cron and no broadcast are needed: the server turns a round when it is asked after the deadline, and a room nobody looks at is a room nobody is waiting in.
- *On the device.* A room's life is not the device's life in progress: a casual or ranked life being played on the device stays exactly where it is while its player is in a room, and the front door shows both. The room's life is played on the same screens as any other, with the room's clock and members above them, and it counts as any other for the records, badges, collection and unlocks of the device.

As built in phase 5:

- One function, `rooms`, holds every room: it opens, joins, starts, shows and leaves a room, and plays a member's cards and orders. Its logic is in `_shared/rooms.ts`, tested over a database kept in memory that keeps the rules of the real one; the real one's rules are eight database functions, each holding the room's row while it works, run with the server's key only.
- A turn reads every member's game, answers their cards left with the first option and plays their kept orders, and writes every game, every standing and the room in one database function: all of it or none. Something that moved under it (a card that landed, a member who came or went) has it read again; a round turned by another call meanwhile is left as that call left it.
- Calls are counted: `room-make` 20 an hour (opening and joining), `room-step` 240 a minute (everything else, a page's own looks included).
- A page hears of its room through Realtime Postgres changes, filtered by the rows' rules, and asks the function how the room stands; it asks once more when Realtime says it listens to the database, since what changed before that is not told.
- A round the clock played while the page was not waiting for it (a tab in the background, whose timers the browser holds back, or a page opened again after playing) is shown as a played round is, with its ledger, and the player is told how many rounds the clock played for them; more than one, and the life is opened where it stands.
- A room closed under a player (its host left the lobby, or nobody moved it for a day) says so once.
- `pnpm online:deploy` deploys `rooms` with the other three functions, so a new version of the rules reaches rooms too.
- A turn names, for every member, whether it played orders they kept for the round, and the database refuses it if that is no longer so: orders kept while a turn was being worked out are played, not lost. A round's orders weigh 16 KB at most; a member whose log could not hold a round's orders plays that round without them; a turn the database cannot hold is played with no orders at all rather than not at all; and a round that cannot be turned stops nobody from looking at the room or leaving it.
- A host whose account is deleted takes only their own rows: the room plays on with no host, and a lobby with no host cannot be started and closes after a day.
- A page whose rules differ from its room's does not open the room's life: it says to reload, and offers to leave.
- A page that woke rounds after the one it played and waited for shows no ledger of the wrong round: it opens the life as it stands and says how many rounds the clock played.

## 8. Integrity

- Ranked play: the client cannot see the future or alter its state.
- Casual play: a player can peek on their own device, so casual results stay off global rankings.
- A casual run is `verified` in one sense only: the server played its log itself, so its figures are the engine's. Whether the future was secret is what `mode` says.
- What a player can store is bounded in the database: fifty games, a log of 128 KB, progress of 64 KB, 500 finished casual lives, 200 people followed. The engine caps orders per round and rejects malformed ones.
- Nicknames are unique and short, and filtered in the database.
- Deleting an account deletes its rows.

Built by phase 3, having been owed before strangers play:

- **A rate limit on the functions.** Each function counts calls per player and refuses beyond its limit.
- **A wider seed.** Every random stream of a game used to start from one 32-bit number derived from the seed: whoever saw a few rounds of one asset's prices could try every start in seconds and read that asset's future. Each stream now starts from the first 128 bits of SHA-256 of the seed and the stream's name, from engine 0.12.0 on. SHA-256 is written out in the engine, which stays pure TypeScript. The server starts a ranked life only on a version whose bundle says its seed is that wide, and a ranked seed never leaves the server, nor does any hash of the hidden state.
- **A bound on finished lives, and rankings that know what they rank.** A player keeps 500 runs of each kind at most; of ranked ones the best is never among those that make room. The rankings read `mode = 'ranked'` only, through an index by player, best life first.
- **A CAPTCHA on guest sign-in.** Built, and off until the owner sets its two keys.

Still to build:

- **Removing abandoned guests.** A guest who never comes back leaves an account and its rows. So does the guest a device was before its player signed in as someone else.
- **A way for the live check past the CAPTCHA.** `pnpm online:live-check` signs two guests in from a terminal, with no browser to answer Turnstile. Once CAPTCHA protection is on in Supabase it cannot make them, and says so.
- `finished_at` is when the server wrote the run, not when the life ended on its device. For a ranked life the two are the same moment.

## 9. Versions

Every game records the engine and content versions it started with and finishes on them. Functions bundle every version still in play. Once a version is retired, its finished games can be viewed but not replayed.

The server's copy of the game is one file for each pair of versions (`pnpm online:bundle`). A pair that has shipped is noted with the fingerprint of its file, and a test holds the file to it: a change to the rules needs a new version, not a new bundle, or the server would play players' saved lives to another end than the device that lived them. A life on versions the server does not hold is refused, not guessed at; it stays on its device.

The server's copy holds the rules and nothing of how the game looks: no art, no names, no text. A new drawing or a reworded card changes no bundle. A change to the engine, to the numbers of the content, or to how a badge is judged does, and needs a new version.

To put a new version on the server, from a checkout linked to the project: `pnpm online:deploy` (bundle, deploy the three functions, note the bundle as shipped), then `pnpm online:live-check`.

A ranked life is played by the server under the versions it began with, but shown and previewed by the page under the page's own. So a ranked life in progress cannot be continued on a page of another version. A page of newer rules says the life was played under older ones and forgets its note of it; the life itself stays on the server until its player ends it, because a device still on the older page can go on with it.

## 10. Phases

Each phase is its own plan and can ship alone.

1. **Foundation:** project, auth, profiles, schema, security policies, the engine running in a function, version handling.
2. **Cloud saves:** casual sync, run history, progress across devices.
3. **Ranked solo and rankings:** server-run games, global, weekly and friends rankings.
4. **Daily challenge:** scenario, one entry per day, streaks.
5. **Rooms:** create, join, simultaneous rounds, timers, reconnect, live ranking. See `docs/superpowers/plans/2026-10-16-rooms.md`.

## 11. Decisions

Settled on 2026-10-13:

1. Sign-in: anonymous on first launch, then Google to keep progress across devices.
2. Solo is ranked by default when the player is online, and casual when offline.
3. Friends are added with a shareable code or link.
4. The database region is the one nearest most players, chosen when the project is created.

Settled when phase 1 was built:

5. Only `profiles`, `player_progress`, `games`, `game_secrets` and `runs` exist so far. The other tables arrive with the phase that uses them.
6. A player's profile row is made by the player's own first write, not by a trigger on the users table: a trigger that fails would stop sign-ups.
7. If the Google account a guest chooses already belongs to another player, the game says so and changes nothing. Which progress wins is phase 2's question.
8. A CAPTCHA in front of guest sign-in waits for the step that puts the game in front of strangers. Until then Supabase's limit applies: 30 guest sign-ins an hour per address.

Still open: free-tier limits. A free Supabase project pauses after a week without use.

Settled when phase 2 was built:

9. Decision 7 has its answer: on a second device the notice offers "Use that account on this device". The player signs in as the account their Google already has, and what the guest had on the device joins it: what is unlocked is joined, finished lives go up, and a life in progress is kept beside the account's.
10. A different life in the account is offered on the front door, never imposed. The player can continue it, which asks before it ends the one on the device, or end it.
11. A game is given up, never deleted, and a life that was given up can be taken up again by a device still playing it. Only a life the server has finished is closed.
12. Settings such as less motion belong to the device, not the account.
13. Every finished life in an account was finished by the server from its log. A device cannot write a run.

Settled when phase 3 was built:

14. The server keeps a ranked life as its seed and its log, and plays the log again at every step, in place of the stored state this document first planned. It is the code that already finishes casual lives, and a few milliseconds.
15. A player has one ranked life in progress. It ends when its player says so, on the device that is living it or in answer to a question on another; never because another life was started somewhere.
16. Decision 2 stands, with a switch: the chooser offers "Ranked life", on by default, to a player who is signed in and online. The choice is made for each life and not remembered.
17. Decision 3 is built as a code only. Following is one-way and needs no answer: it decides whose lives a player sees in their friends ranking, and nothing else. A link that follows on opening is not built.
18. A ranking is the best ranked life of each player, not every life. One function answers all of them.
19. Decision 8 has its answer: the CAPTCHA is Cloudflare Turnstile, built and off. It is turned on by naming its site key in the build and its secret in Supabase, together.
20. A friend code can be read by anyone signed in, like the rest of a profile. Whoever has it can follow its player and see nothing they could not see already.
21. The database changes of phase 3 are not all additions: a player's write to `profiles` is cut down to four columns, an index is replaced, the functions answer `429` beyond their limits, finished lives beyond five hundred are removed, and names are checked. Each was tried against the game then on `main` before it was applied.

Settled when phase 5 was designed (2026-10-16):

22. Every member of a room lives the same life on the same seed: the life the host chose, whether or not each member has unlocked it, as in a weekly challenge. The same deal for everyone is what makes a room a contest of choices.
23. Cards are played the moment they are answered; a round's orders are kept until the round turns for everyone. A card says nothing of how the world turns; a round's result says all of it.
24. A round turns when everyone still in the room is ready, or five seconds after its deadline. A member who has not chosen plays the first open option of each card left and no orders. The page plays the round as it stands a second before the deadline, so a member who is there loses nothing they had chosen.
25. The server turns a round when it is first asked after it is due. There is no cron sweep: a room whose members are all away waits for them, and one untouched for a day is closed when next looked at.
26. The tables `room_secrets` and `room_choices` of the first design are not made. The seed is kept per game in `game_secrets`, as for every game the server plays; orders waiting for a round to turn are in `room_orders`, which no client can read.
27. A turn of the round, a member's card and a member's orders each happen inside one database function that holds the room's row: a turn writes every member's game, their standings and the room together or not at all, and a card or orders that arrive while a round is turning wait for it and are then refused if the round has moved.
28. A room's run is mode `room`: played by the server with the future kept from its player, and still not in the global rankings, which hold lives played alone.
29. Members are told of changes through Realtime Postgres changes on `rooms` and `room_players`. Presence (who has the page open) is not built: it needs private channels, which need the project's Realtime settings changed, and the room's clock already deals with a member who is away.
30. A player is in one room at a time that is not over, and a room holds six at most. Rooms are opened on the rules the server plays now, and joined only from a page on the same rules.
31. The room's lives are played by the server under one version. A page whose rules differ from its room's cannot play it, and says to reload.

Settled when phase 5 was built:

32. The standings a room shows are each member's score so far and whether they are out of the rat race, not net worth, status and bankruptcies beside it: the score is what the room is won on, and a net worth in start-of-game money beside the HUD's own would read as a contradiction. The other figures are kept with the standing on the server.
