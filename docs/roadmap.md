# The Rat Race: Roadmap

Updated: 2026-10-19

Effort is in working sessions, where one session is a sitting like the engine build including its review: S is under one, M is one to two, L is three to five, XL is six or more. These are estimates, not promises.

Priority: P0 is needed for the first playable game. P1 is needed before friends play. P2 is the online game. P3 comes after.

| # | Step | What you get | Status | Effort | Priority |
|---|---|---|---|---|---|
| 1–5 | Foundations and art | The design spec, the engine core, the view of a game a client may hold, and the art tool that turns the sheets you generate into final game sprites, with contact sheets you approved | Done, reviewed | | |
| 6–7 | Life and first play | Cards, careers, family, insurance, status items, news and tax reforms, with all content in English, Spanish and Russian; the terminal game (`pnpm play`) and the balance bots (`pnpm balance`) | Done, reviewed | | |
| 8 | Web game, solo | The real game on phone and desktop, with final art and local saves: `pnpm dev` | Done, in production | | P0 |
| 9–10b | Replay, polish and look | Unlockable lives (locked ones show their goal and a hint), badges with rarity, sound and glow, a collection of everything ever owned, personal bests and past lives, a share card, a guided first life, an accessibility audit, the "pixel de lujo" look | Done, in production | | |
| 11 | Online foundation | Supabase: a guest account from the first launch and Google to keep it, the tables with their security rules, the game's engine running on the server | Done, in production; Google provider yours to set | | P1 |
| 12 | Cloud saves | The life in progress, the finished lives and everything unlocked are in the player's account and on every device; the server finishes every life itself; the game still plays with no connection; the account keeps its language | Done, in production | | P1 |
| 13 | Ranked solo and rankings | A life the server plays, card by card, with the future kept from the player; rankings of all time, of this week and among friends, with a name and a friend code | Done, in production | | P2 |
| 14 | Weekly challenge | One life and one rule for everyone each week, one attempt a day that counts (the ranking keeps each player's best; how others chose is told when the week ends) and practice as often as wanted, its own ranking and how others chose | Done, in production | | P2 |
| 15 | Online rooms | 2 to 6 friends live the same life on one seed, a round at a time, at 1:30, 3:00, 5:00, 12 h or a day a round; teasing a rival, loans between players, shouts, a rematch, the room's paper, a history of games played; lives begun on older rules finish under them | Done, in production | | P2 |
| 15b | Public games and rats | "Quick game": seated in a public lobby with whoever is looking, started by itself after two minutes, when full or when anyone says so; empty seats taken by five kinds of rat the server plays; rats keep no runs and earn nobody a badge. Then: how many games are looking for players, on the door and the front page; a quick game offered at the end of a life alone; following anyone played with, from the end of a game; reporting a name in a public game (two reports take it away) and a longer list of refused names; out of a public game after two rounds the clock played; public games at a round a day too, each pace with its own lobbies | Built, reviewed and tested (208 database checks on a local copy); on `dev`, not deployed: two migrations, the functions and content 1.45 go out together | M | P2 |
| 16 | More content | Now 10 cities, 22 assets, 67 items, 195 cards (14 of them the famous, as parodies, who also speak some of the real news), 20 lives, 11 careers with moves of their own, 63 badges; moving costs more the further it goes; status in line with what things cost | Under way | L | P3 |
| 17 | App and operations | What keeps the game installed, coming back, watched and safe, in the nine parts below | Part built | M | P3 |
| 17a | Installable app | Install from every browser, an offline page, a service worker that never keeps the cloud's answers and opens in the language last played | Done, in production | | P3 |
| 17b | Notices | Pushes for the week's challenge, a ranked market that moved, and games with friends (started, your turn, a new round, a rematch, a loan offer, a shout), each with its switch in Settings | Built and deployed; that they reach phones depends on the keys in `docs/pwa.md` | S | P3 |
| 17c | Automatic checks | Unit tests, types, lint and the end-to-end walk on every push to `dev` and `main` (GitHub Actions), and `main` refused while they are red | Not started: there is still no CI | S | P2 |
| 17d | Safe releases | `main` goes out only when the server holds the rules of its build (`shipped.json` checked before Vercel deploys) | Not started; done by hand on every release so far | S | P2 |
| 17e | Error monitoring | The errors of the page and of the functions in one place, with an alert, and nothing personal in them | Done, in production; the alert waits on its address, the secret `ALERT_URL` | S | P3 |
| 17f | Usage numbers | Lives begun and finished, players back after one day and after seven, accounts kept, games with friends played; no cookies | Built on `dev`: `pnpm online:stats [days]` from the database (the days each player played, kept by the database itself), and Vercel Web Analytics for visits and where they come from (to be turned on in the Vercel project) | S | P3 |
| 17g | Health | An hourly check that a guest can sign in, play a step and open a game with friends, with an alert; the free project kept from pausing | Built: `pnpm online:health`, hourly on GitHub Actions (`docs/backups.md`); runs once its secrets are set | S | P3 |
| 17h | Backups | A daily copy of the database kept outside Supabase, and one restore tried for real | Built: nightly, encrypted, to a bucket outside Supabase (`docs/backups.md`); a restore tried on 2026-10-20; runs once its bucket and secrets are set | S | P2 |
| 17i | Housekeeping | Guests who never came back removed after a while, old rooms and call counters cleared; the CAPTCHA on guest sign-in turned on with its keys | Not started | S | P3 |
| 18 | The player's own | A profile worth opening, a rat dressed layer by layer (fur, face, outfit, hat, eyes, backdrop, colour), rat ranks that rise with every finished life and open pieces of the rat | Done, in production | | P3 |
| 19 | Shared code for other apps | The game split into packages: `@ratrace/i18n` (words), `@ratrace/core` (the game's logic, no browser), `@ratrace/online` (the client of the servers), beside the engine and the content | Done, in production | | P3 |
| 20 | Phone apps | Android first, as the installable game wrapped for Google Play (about three weeks, most of it Google's closed test); iPhone later, with Capacitor or Expo on top of the shared packages | Planned | M | P3 |
| 21 | Express life | A quick mode of ten rounds | Parked | M | P3 |

## In the drawer

Ideas kept for later, from looking at Busybodies (playbusybodies.com, a cosy settlement game for the browser), 2026-10-19:

- Play from the front page: a newcomer answers their first card on `/`, with a life chosen for them, no menu first.
- Characters who come back: the crypto brother-in-law, the boss, the landlord, with running jokes and consequences across a life.
- Stories that remember: a rumour in the paper that comes true, or not, rounds later; a feud with a neighbour that ends well or badly.
- Paid chapters: new lives or cities bought once (an inheritance, Silicon Valley, Japan in the 80s); never an edge in ranked.
- A diorama on the front page: the pixel city alive behind it, the player's rat in it, day and night, rain in a crisis.
- A newsletter, "El Diario de la Rueda", only when there is something new.
- Pages for search: "for fans of Cashflow and BitLife", and questions answered on the front page.
- A rat financial adviser to chat with (AI): appealing, but each message costs; later.

Beside the steps: since 2026-10-13 the game is also played in Russian, a third language beside English and Spanish. Every sentence of the interface and of the content is translated, to the rules in `docs/i18n/russian.md`; whoever adds text adds it in all three.

Design documents: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (solo game) and `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (online).
