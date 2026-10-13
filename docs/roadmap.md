# The Rat Race: Roadmap

Updated: 2026-10-13

Effort is in working sessions, where one session is a sitting like the engine build including its review: S is under one, M is one to two, L is three to five, XL is six or more. These are estimates, not promises.

Priority: P0 is needed for the first playable game. P1 is needed before friends play. P2 is the online game. P3 comes after.

| # | Step | What you get | Status | Effort | Priority |
|---|---|---|---|---|---|
| 1–4 | Foundations | The design spec, 21 art sheets, the engine core, and the view of a game a client may hold | Done, reviewed | | |
| 5 | Art cleanup tool | The 21 sheets become 203 final game sprites, with contact sheets to approve | Built; your approval of the contact sheets in `art/contact/` pending | | P0 |
| 6–7 | Life and first play | Cards, careers, family, insurance, status items, news and tax reforms, with all content in English and Spanish; the terminal game (`pnpm play`) and the balance bots (`pnpm balance`) | Done, reviewed | | |
| 8 | Web game, solo | The real game on phone and desktop, in English and Spanish, with final art and local saves: `pnpm dev` | Built, reviewed; your play-test pending | | P0 |
| 9–10 | Replay and polish | Three unlockable lives, thirty badges, a collection of everything ever owned, personal bests and past lives, a share card; a guided first life, an accessibility pass checked by an audit on every screen, a text pass in both languages | Done, reviewed | | |
| 10b | Look and legibility | A richer look on every screen, and amounts in a typeface that reads at a glance | Three directions drawn (`docs/design/2026-10-13-visual-directions.png`); your pick pending | M | P0 |
| 11 | Online foundation | Supabase: sign-in, profiles, database, security rules, engine on the server | Planned | L | P1 |
| 12 | Cloud saves | Saved games, history and unlocks on every device | Planned | M | P1 |
| 13 | Ranked solo and rankings | Server-run games; global, weekly and friends rankings | Planned | M | P2 |
| 14 | Daily challenge | One shared short game a day, streaks | Planned | M | P2 |
| 15 | Online rooms | 2 to 6 friends in one live game, timers, reconnect | Planned | L | P2 |
| 16 | More content | 7 more cities, 40 more assets and tools, 35 more items, 50 more cards, 8 more lives | Planned | L | P3 |
| 17 | App and operations | Installable app, reminders, monitoring, backups | Planned | M | P3 |

Design documents: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (solo game) and `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (online).
