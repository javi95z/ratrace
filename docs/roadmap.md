# The Rat Race: Roadmap

Updated: 2026-10-16

Effort is in working sessions, where one session is a sitting like the engine build including its review: S is under one, M is one to two, L is three to five, XL is six or more. These are estimates, not promises.

Priority: P0 is needed for the first playable game. P1 is needed before friends play. P2 is the online game. P3 comes after.

| # | Step | What you get | Status | Effort | Priority |
|---|---|---|---|---|---|
| 1–5 | Foundations and art | The design spec, the engine core, the view of a game a client may hold, and the art tool that turns the sheets you generate into final game sprites (244 from 24 sheets so far), with contact sheets you approved | Done, reviewed | | |
| 6–7 | Life and first play | Cards, careers, family, insurance, status items, news and tax reforms, with all content in English and Spanish; the terminal game (`pnpm play`) and the balance bots (`pnpm balance`) | Done, reviewed | | |
| 8 | Web game, solo | The real game on phone and desktop, in English and Spanish, with final art and local saves: `pnpm dev` | Built, reviewed; your play-test under way, fine so far | | P0 |
| 9–10b | Replay, polish and look | Unlockable lives, thirty badges, a collection of everything ever owned, personal bests and past lives, a share card; a guided first life, an accessibility audit on every screen, a text pass in both languages; the "pixel de lujo" look with Jersey 15 for titles and amounts and Chakra Petch for reading, sixteen kinds of property, icons on every choice | Done, reviewed | | |
| 11 | Online foundation | Supabase: a guest account from the first launch and Google to keep it, the first five tables with their security rules, the game's engine running on the server | Built, reviewed, and checked against the live project; Google provider yours to set | | P1 |
| 12 | Cloud saves | The life in progress, the finished lives and everything unlocked are in the player's account, and on a second device they are there; the server finishes every life itself; the game still plays with no connection | Built, reviewed, and checked against the live project (two devices of one player, through the game's own code); your own play with the account on is the last check | | P1 |
| 13 | Ranked solo and rankings | A life the server plays, card by card, with the future kept from the player; rankings of all time, of this week and among friends, with a name to appear under and a code to be followed by. Under it: a seed that cannot be searched (engine 0.12.0), a limit on how often each function is called, a bound on finished casual lives, a filter on names, and a CAPTCHA on guest sign-in that is off until its keys are set | Built, reviewed, and checked against the live project (a whole ranked life, found in the ranking); on `dev`, not on `main` until you say so | | P2 |
| 14 | Weekly challenge | One life and one rule for everyone each week on a seed only the server holds, one attempt that counts and practice as often as wanted, its own ranking and how others chose; it took the place of a daily challenge | Built, deployed (engine 0.24.0) | | P2 |
| 15 | Online rooms | 2 to 6 friends live the same life on one seed, a round at a time: a host opens a room for a life and a round of 1:30, 3:00 or 5:00 and shares its code or link; cards are played at once and orders kept until everyone is ready or the deadline passes; the room's clock and who has played above the round, the wait, the room's order after each round and at the end; everything kept on the server, so a page that comes back finds the room as it stands and is told how many rounds the clock played | Built, reviewed, and checked against the live project (two guests through a whole room, a round turned by a member leaving, a change heard through Realtime); on `dev` | L | P2 |
| 16 | More content | 7 more cities, 40 more assets and tools, 35 more items, 50 more cards, 8 more lives | Planned | L | P3 |
| 17 | App and operations | What keeps the game installed, coming back, watched and safe, in the nine parts below | Part built | M | P3 |
| 17a | Installable app | Install from every browser (the native prompt, or the steps on an iPhone), an offline page, and a service worker that never keeps the cloud's answers | Built, with an end-to-end test | | P3 |
| 17b | Notices | A push when the week's challenge begins, in the player's language, with a switch in Settings; next, "your turn" in a game with friends | Weekly notice built, waiting on its keys and secrets (`docs/pwa.md`); the friends' notice under way | S | P3 |
| 17c | Automatic checks | Unit tests, types, lint and the end-to-end walk on every push to `dev` and `main` (GitHub Actions), and `main` refused while they are red | Not started: there is no CI, which is how 21 end-to-end tests fell behind unnoticed | S | P2 |
| 17d | Safe releases | `main` goes out only when the server holds the rules of its build (`shipped.json` checked before Vercel deploys) | Not started | S | P2 |
| 17e | Error monitoring | The errors of the page and of the functions in one place, with an alert, and nothing personal in them | Built, deployed and checked against the live project (a page's error sent by a guest, kept by kind and cleaned); `pnpm online:errors` lists them (`docs/errors.md`). The alert waits on its address, the secret `ALERT_URL`; the `rooms` function joins the watch once the work on it now in progress lands | S | P3 |
| 17f | Usage numbers | Lives begun and finished, players back after one day and after seven, accounts kept, games with friends played; no cookies | Not started | S | P3 |
| 17g | Health | An hourly check that a guest can sign in, play a step and open a game with friends, with an alert; the free project kept from pausing after a week with no use | Not started | S | P3 |
| 17h | Backups | A daily copy of the database kept outside Supabase, and one restore tried for real | Not started | S | P2 |
| 17i | Housekeeping | Guests who never came back removed after a while, old rooms and call counters cleared; the CAPTCHA on guest sign-in turned on with its keys | Not started | S | P3 |

Beside the steps: since 2026-10-13 the game is also played in Russian, a third language beside English and Spanish. Every sentence of the interface and of the content is translated, to the rules in `docs/i18n/russian.md`; whoever adds text adds it in all three.

Design documents: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (solo game) and `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (online).
