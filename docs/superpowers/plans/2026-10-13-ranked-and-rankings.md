# Ranked Lives and Rankings: Build Plan

Date: 2026-10-13
Spec: `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (sections 2, 3, 6, 7 "Ranked solo", 8, 9, phase 3 of section 10, decisions 2 and 3)
Builds on: cloud saves (roadmap step 12).
Branch: `ranked`, cut from `dev`. It lands on `dev`, and on `main` only when the owner says so.

This is roadmap step 13. It records decisions and tasks, not code.

## What this step gives

A life can be played as a **ranked** life: the server holds the seed, plays every card and every round itself, and writes the result. The player cannot see the future or change their own state, so the result can be compared with everyone else's. There are rankings of all time, of this week and among friends, and a player has a name to appear under.

Before any of that, four things the spec lists as owed before strangers play: a seed that cannot be searched, a limit on how often the functions can be called, a CAPTCHA in front of guest sign-in, and a bound on finished casual lives.

Not here: the daily challenge (14), rooms (15).

## Decisions

### A seed that cannot be searched

- Today every random stream of a game starts from one 32-bit number derived from the seed. Whoever sees a few rounds of one asset's prices can try all four thousand million starts in seconds and read that asset's future, stream by stream, without ever knowing the seed.
- Each stream now starts from the first 128 bits of SHA-256 of `seed::stream`. SHA-256 is written out in the engine, which stays pure TypeScript with no platform API. The generator that follows (sfc32) is unchanged.
- This changes what every seed produces, so it is a new engine version. Lives saved on older versions are "played under older rules", as with any change of rules.
- **Ranked lives exist only on versions with the wide seed.** The server refuses to start one on a bundle that does not say it can be ranked.
- A ranked seed is 32 random bytes made by the server. It never leaves the server, and no hash of the hidden state does either.

### A ranked life is a seed the server keeps and a log it adds to

- The spec planned to keep the whole state on the server. As built, the server keeps the **seed** (`game_secrets`) and the **log** (`games.log`), and plays the log again from the seed at every step. That is a few milliseconds, it is the code that already finishes casual lives, and there is no second copy of the state to drift from the first.
- One function, `ranked`, with five things it can be asked:

| Asked | Does | Answers |
|---|---|---|
| `start` (life, versions) | gives up any ranked life in progress, makes the game and its seed | the view at round 0, the record |
| `view` (game) | nothing | the whole view, the record, how many steps have been played |
| `card` (game, step, option) | answers the next card | what changed |
| `round` (game, step, orders) | plays the round | what changed; the run, if the life ended |
| `abandon` (game) | gives the life up | nothing |

- **A step is numbered.** The client says which step it is taking (how many have been taken so far). If the server has already taken that step with that very choice, it answers what it answered then: a reply lost on the way can be asked for again. If it has taken it with another choice, or is anywhere else, it says where it stands (`out-of-step`), and the client opens the life as it now is.
- Two requests at once cannot both be taken: the log is written only if the row is as it was read.
- What a step answers is small: the player as they now stand, what happened, and the one new world if the round turned. The timeline already held by the client is not sent again.
- The client works out previews itself, from the view, as it does in a casual life.
- When the last round is played the server writes the run (`mode = 'ranked'`, `verified = true`) and closes the game.
- A player has one ranked life in progress. Starting another gives the first up.
- Locked lives: the server reads what the player has unlocked and refuses a life they have not. (Unlocks are written by the device, so this keeps the game's own rule, not a secret.)

### Playing a ranked life

- `GameSession` is what the screens already talk to. A ranked life is one more kind of it; no screen changes how it plays.
- A new life is ranked when the player is signed in, there is a connection, and they have not turned it off on the chooser. Otherwise it is casual, and the chooser says so before the life begins. If the server cannot be reached at the moment of starting, the life starts as a casual one and says so.
- The device remembers a ranked life in progress with the last view it was given, so the front door can show it, and so it can be looked at with no connection. It cannot be played without one: a step that does not get through says so and can be tried again.
- A ranked life in progress waits on any device: a device with no life takes it when it meets the account.
- The cloud mirror of step 12 leaves a ranked life alone: it is not uploaded (the server already has it), not replaced by a casual life from the account, and not offered in exchange for one.
- A finished ranked life goes into the records of the device like any other, marked as ranked.

### Rankings

- A ranking is the best ranked life of each player: of all time, or finished this week (weeks begin on Monday, UTC), optionally of one starting life, optionally among friends only. Higher score first; of two equal scores, the earlier.
- One database function answers all of them: the first fifty, and the asker's own place if it is further down.
- **Names.** A player appears under their nickname: 3 to 16 letters, digits or underscores, unique whatever the capitals. Without one they appear as "Rat" and four characters of their id. Names are checked in the database, where a client cannot skip the check: a list of words that are not accepted, read through the usual disguises (digits for letters, underscores, repeated letters), and a list of names that are not anyone's to take.
- **Friends** are people a player follows. Each player has a short code; entering someone's code follows them. Following is one-way and needs no answer: it only decides whose lives a player sees in their friends ranking. A player can stop following anyone. A link that follows on opening is left for later: a page that changes whom a player follows because it was opened is not something to build in passing.

### Limits

- **Calls.** Each function counts calls per player in a window and refuses beyond it (`429`): the engine and finish functions 30 a minute; ranked steps 240 a minute; new ranked lives 20 an hour. The counter is one row per player and bucket.
- **Finished casual lives.** A player keeps at most 500; the oldest make room. Rankings read ranked lives only, and the index that served "every verified run" is replaced by one over ranked runs.
- **CAPTCHA.** The game asks Cloudflare Turnstile for a token before it signs a guest in, when a site key is set in the build. It is off until the owner makes the keys and turns it on in Supabase; with no key nothing is loaded and nothing changes.

### What is deployed, and when

- There is one Supabase project. The database changes of this step are all additions, and the functions keep answering the game on `main` as before, so they are applied from this branch: the security tests and the live check need them there. The game on `main` does not use any of it until this branch is merged.

### Tests

- The engine's SHA-256 against known answers and against Node's own; the streams against the definition.
- The ranked logic without a server, as `finish-run` is: every action, every refusal, the retry of a lost reply, two requests at once.
- The database: every new rule in the SQL security tests.
- The ranked session against a fake server: the same life played ranked and casual ends the same; a lost reply; a server that moved on; no connection.
- The live check plays a whole ranked life against the real project and finds it in the ranking.
- The end-to-end suite, which has no cloud, is unchanged.

## Tasks

- [ ] 1. Engine: SHA-256 seeded streams, new version, snapshots
- [ ] 2. Database: ranked games, rate counters, casual bound, names, friends, the ranking function; SQL tests
- [ ] 3. Server: the ranked logic and function, rate limits on all three functions; deployed
- [ ] 4. Client: the ranked session, the chooser between ranked and casual, the device's record, the mirror leaving it alone
- [ ] 5. Screens: the chooser's line, the ranked mark, a step that did not get through, the records
- [ ] 6. Names, friends and rankings: the port, the verbs, the screens
- [ ] 7. CAPTCHA before guest sign-in, off without a key
- [ ] 8. The live check extended; spec and roadmap brought up to date
- [ ] 9. Fresh review and one fix pass
