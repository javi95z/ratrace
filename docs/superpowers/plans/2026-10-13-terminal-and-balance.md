# Terminal Game and Balance Bots: Build Plan

Date: 2026-10-13
Spec: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (sections 3.7, 9 and milestone 1 in section 10)
Builds on: `packages/engine` and `packages/content`.

Like the life-systems plan, this records decisions and tasks, not code.

## What this adds

- `tools/balance`: six bots that play whole lives, a report, and a test that fails when the game leaves the acceptance bands of spec 3.7.
- `tools/play`: the game in a terminal, in English or Spanish. It is the first playable version, and where the fun test starts.

Neither is shipped to players. Both read the game only through the engine's public API and the content package, as the web client will.

## Decisions

### Bots

A bot is two pure functions: one answers a hand of cards, one writes the orders of a round. Both see only what a player sees: the state up to the current round, never a future world.

| Bot | Plays like |
|---|---|
| Saver | Lives cheaply, studies, keeps everything in the savings deposit |
| Indexer | Lives cheaply, studies, puts every spare dollar in an index fund and never sells |
| Crypto gambler | The indexer's twin: as thrifty and as hard-working, with no loans, but everything goes into coins from the day its finance skill allows, and it never sells one |
| Status chaser | Lives lavishly and buys the best thing it can afford every round, on credit if it must |
| Property leverager | Saves a down payment, buys with the largest mortgage, rents out, repeats |
| Random | Random answers and random orders |

Every bot plays the three default lives over the same seeds.

### Acceptance bands (spec 3.7)

- The indexer escapes the rat race in 25% to 45% of lives.
- No bot has the top score in more than 40% of lives.
- The crypto gambler is ruined in 30% to 60% of lives and the richest of all bots in at least 10%. Ruined means ending with less than half the saver's net worth on the same life and seed.

The test runs a fixed set of seeds, so its result never changes between runs or machines. `pnpm balance` runs a larger set and prints the full table. When the game leaves a band, numbers in `packages/content` are tuned, not the bots.

That sentence first read "never the bots and never the band", and both halves were broken while building: the third band was changed from bankruptcies to ruin (spec 3.7 says why), and the gambler was reshaped several times. The review of this step showed that the band then measured the gambler's habits, not crypto. The gambler is now the plain twin described above, every bot is handed a view of the game instead of the game, and the band is held by one crypto parameter.

### Terminal game

- One loop, written against two functions it is given: `ask` a question and `print` a line. The real program wires them to the terminal; the tests wire them to a script. So a whole scripted life is a test.
- A round is: news and gauges, the hand of cards (each option with its cost, whether it is open, and its odds), then a prompt for orders with a live preview, then the ledger.
- Orders are typed as short commands (`buy msci 5000`, `study`, `home flat 20 fixed`). A command that cannot be parsed changes nothing and says why.
- All game text comes from the content package. The terminal adds only its own labels and prompts, in both languages.
- The seed is random unless given, and is printed, so a life can be replayed.

## Tasks

- [x] 1. Bots and the simulator
- [x] 2. Report, bands test, and tuning the content until the bands hold
- [x] 3. Terminal: formatting, command parser, screens
- [x] 4. Terminal: the game loop, the program, a scripted whole-life test
- [ ] 5. Fresh review of steps 6 and 7 together, and one fix pass
