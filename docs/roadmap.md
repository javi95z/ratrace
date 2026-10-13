# The Rat Race: Roadmap

Updated: 2026-10-13

Effort is in working sessions, where one session is a sitting like the engine build including its review: S is under one, M is one to two, L is three to five, XL is six or more. These are estimates, not promises.

Priority: P0 is needed for the first playable game. P1 is needed before friends play. P2 is the online game. P3 comes after.

| # | Step | What you get | Status | Effort | Priority |
|---|---|---|---|---|---|
| 1–5 | Foundations and art | The design spec, the engine core, the view of a game a client may hold, and the art tool that turns the sheets you generate into final game sprites (244 from 24 sheets so far), with contact sheets you approved | Done, reviewed | | |
| 6–7 | Life and first play | Cards, careers, family, insurance, status items, news and tax reforms, with all content in English and Spanish; the terminal game (`pnpm play`) and the balance bots (`pnpm balance`) | Done, reviewed | | |
| 8 | Web game, solo | The real game on phone and desktop, in English and Spanish, with final art and local saves: `pnpm dev` | Built, reviewed; your play-test under way, fine so far | | P0 |
| 9–10b | Replay, polish and look | Unlockable lives, thirty badges, a collection of everything ever owned, personal bests and past lives, a share card; a guided first life, an accessibility audit on every screen, a text pass in both languages; the "pixel de lujo" look with Jersey 15 for titles and amounts and Chakra Petch for reading, sixteen kinds of property, icons on every choice | Done, reviewed | | |
| 11 | Online foundation | Supabase: a guest account from the first launch and Google to keep it, the first five tables with their security rules, the game's engine running on the server | Built; live check waiting for your `apps/web/.env.local`; independent review pending | L | P1 |
| 12 | Cloud saves | Saved games, history and unlocks on every device | Planned | M | P1 |
| 13 | Ranked solo and rankings | Server-run games; global, weekly and friends rankings | Planned | M | P2 |
| 14 | Daily challenge | One shared short game a day, streaks | Planned | M | P2 |
| 15 | Online rooms | 2 to 6 friends in one live game, timers, reconnect | Planned | L | P2 |
| 16 | More content | 7 more cities, 40 more assets and tools, 35 more items, 50 more cards, 8 more lives | Planned | L | P3 |
| 17 | App and operations | Installable app, reminders, monitoring, backups | Planned | M | P3 |

Design documents: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (solo game) and `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (online).
