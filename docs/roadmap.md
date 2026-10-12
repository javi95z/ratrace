# The Rat Race: Roadmap

Updated: 2026-10-13

Effort is in working sessions, where one session is a sitting like the engine build including its review: S is under one, M is one to two, L is three to five, XL is six or more. These are estimates, not promises.

Priority: P0 is needed for the first playable game. P1 is needed before friends play. P2 is the online game. P3 comes after.

| # | Step | What you get | Status | Effort | Priority |
|---|---|---|---|---|---|
| 1 | Design | Spec for the solo game | Done | | |
| 2 | Art sheets | 21 sheets: items, cars, homes, icons, badges, portraits, card scenes, skylines, logo | Done | | |
| 3 | Engine core | Markets, trades, debt, property, tax, inflation, bankruptcy, score | Done, reviewed twice | | |
| 4 | Engine view for online | The client holds a game without the seed, the dice or the future rounds | Done, as the first task of step 8 | | P0 |
| 5 | Art cleanup tool | The 21 sheets become 203 final game sprites, with contact sheets to approve | Built; your approval of the contact sheets in `art/contact/` pending | | P0 |
| 6 | Life systems and content | Cards, careers, family, insurance, status items, news and tax reforms; 6 cities, 19 assets, 34 items, 100 cards, 6 lives; all text in English and Spanish | Done, reviewed; five rules changed by the review | | P0 |
| 7 | Terminal game and balance bots | First playable life: `pnpm play`. Six bots hold the game inside its balance bands: `pnpm balance` | Done, reviewed | | P0 |
| 8 | Web game, solo | The real game on phone and desktop, in English and Spanish, with final art and local saves: `pnpm dev` | Built, reviewed; your play-test pending | | P0 |
| 9 | Replay hooks | Unlockable lives, achievements, collection, records, share card | Next; unblocked | M | P1 |
| 10 | Polish | Guided first life, accessibility pass, text pass in both languages. The desktop layout came with step 8 | Planned; unblocked | S | P1 |
| 11 | Online foundation | Supabase: sign-in, profiles, database, security rules, engine on the server | Planned | L | P1 |
| 12 | Cloud saves | Saved games, history and unlocks on every device | Planned | M | P1 |
| 13 | Ranked solo and rankings | Server-run games; global, weekly and friends rankings | Planned | M | P2 |
| 14 | Daily challenge | One shared short game a day, streaks | Planned | M | P2 |
| 15 | Online rooms | 2 to 6 friends in one live game, timers, reconnect | Planned | L | P2 |
| 16 | More content | 7 more cities, 40 more assets and tools, 35 more items, 50 more cards, 8 more lives | Planned | L | P3 |
| 17 | App and operations | Installable app, reminders, monitoring, backups | Planned | M | P3 |

Design documents: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (solo game) and `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (online).
