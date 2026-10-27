# Characters who come back: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six people who come back in a life (the in-law, the boss, the landlord, the founder, the adviser, the parents), the player's three people as cards, three cards for art still to come (the lodger's party and departure, the fake masterpiece), each person's portrait on their cards, a line for each at a life's end, and "People" in the collection.

**Architecture:** An arc is content: cards that set and need flags (`<who>_met`, `_warm`, `_cold` and the arc's own), dealt by `once`, `notRecentFlag` and weight. The one thing content cannot say, "declined twice", is a small effect of the engine (`onceMore`) under the unshipped 0.45.0. Which card is whose, the moods and the endings are content (`packages/content/src/people.ts`); the people's names are the name pack's (`{person:<who>}`), what they are to the player and their endings the content text's (`text.people`). Core reads the flags (`packages/core/src/game/people.ts`): who was met, how each story ended, and what the profile keeps (`Profile.people`, joined like the gallery across devices). The app shows the portrait on the card, the endings in the epilogue panel, and a People tab in the collection.

**Tech Stack:** TypeScript, vitest, Expo/React Native (react-native-web for the site).

**Spec:** `docs/superpowers/specs/2026-10-27-recurring-characters-design.md`

## Global Constraints

- Content stays 1.50.0 and the engine 0.45.0 (both unshipped on this branch): no bump; nothing an older life does changes. `pnpm online:bundle` rewrites only `v0.45.0-1.50.0`.
- Every card leaves two options open where it is dealt (`dealOnlyChoices`, `tools/balance/src/choices.test.ts`); the first option never has a condition and never buys.
- Words in en, es (Spain, "tú"), ru (gender-neutral towards the player, `docs/i18n/russian.md`); every i18n key used; titles ≤ 45, bodies ≤ 140, labels ≤ 60, outcome lines ≤ 90 characters, names written out.
- Every card has its own scene (`cardArt` one-to-one); the art ids drawn are the design's.
- The bands of `tools/balance/src/bands.test.ts` hold; `pnpm balance` before and after.
- The first page of the web (`/en`) takes no new UI code; `web:size` green (gate 800 KiB gzip; before: 796,355 bytes with its words, 22,845 to spare).
- UI: the simplest that works; details in a modal Sheet; no framed box in another; screen readers hear the person's line, not the portrait.

## Rulings (what the spec leaves open)

1. **Names** live in the name pack (`names.ts`, `people`), placeholders `{person:<who>}` filled with the rest: en Toni, Margaret, Mr Ferris, Bea, Brandon, Mum and Dad; es Toni, Mercedes, don Julián, Bea, Borja, mamá y papá; ru Тони, Маргарита, Пётр Ильич, Ника, Стас, мама и папа. What each is to the player ("your brother-in-law"), their introduction and endings are content text (`text.people`).
2. **The player's people** are named in a card's body only, by `{rival:classmate|cousin|ex}`, which the app fills with the paper's own words for them (`useRivals().who`, e.g. "Emily, your cousin"); each sentence is written so the name in that form reads (in Russian, in the nominative). No portrait: they have none.
3. **Engine gaps:** buying the rented flat is the existing `property` effect (80 % of the price, `rented: false`); stakes and payoffs are fixed amounts by option; "declined twice" needs `Effects.onceMore` (a flag already set sets another), the only engine change, under 0.45.0.
4. **Boss:** her own three cards; `card.boss_leaves` (`career_boss_leaves`) stays as it is. The layoffs come in a recession (a crisis forces one), never to someone who cannot be laid off (`layoff_proof`).
5. **The coin's headline** ("$RATA plunges") needs the news to read a life's flags: left for later.
6. **Mood** is the card's (content), not the outcome's. A person's first card says "Meet …" when its `<who>_met` flag is not yet set; later ones say who they are.
7. **Epilogue:** one line per person met, in the epilogue panel above the obituary, each with the portrait of its mood; not in the share card (it would not fit the card's fixed layout).
8. **People in the collection:** a third tab, a tile per person: portrait and words once met (a silhouette before), and "n of m endings". No sheet: there is nothing more to read. The profile keeps `people: string[]` (`<who>` met, `<who>.<ending>` seen), joined across devices like the gallery; an older build that writes progress back without it can drop it (said in the report).
9. **Parents in every life:** the help with a deposit is dealt to a tenant up to round 5 at a weight that makes it near-certain; the care from round 9 to 14 and the inheritance from 15 are likewise near-certain, so every life meets them once at least.
10. **Stand-ins** for `lodger_party`, `lodger_leaves` and `rich_fake_art`: a sheet of their own, `cards/stand-ins-v22` (3 by 1), cut from older scenes; the sheets 26/30/33/34/36/39/49 untouched.

## Review Focus

1. A follow-up that can never come: its flag set by no option, or set the round it is needed (the hand is drawn before the cards are answered): a test plays every arc to its end on purpose.
2. A card dealt with one option open (rent arc to an owner, the move to the city one lives in, the layoffs to a civil servant): the choices test over every life and the challenge limits.
3. A placeholder left on screen: `{person:…}` unfilled, `{rival:…}` outside a body or unfilled where no rivals are known.
4. A profile from before People, or a cloud copy without it, opening with none and never losing what the device has.
5. An ending told for a person never met, or a person met with no ending.

---

### Task 1: The engine's `onceMore`

**Files:** Modify `packages/engine/src/types.ts` (`Effects`), `packages/engine/src/life/effects.ts`; Test `packages/engine/src/life/moreEffects.test.ts`.

- [ ] Test `sets the second flag when the first was already set`: effects `{ setFlags: ['boss_declined'], onceMore: { boss_declined: 'boss_cold' } }` applied twice: after the first, `boss_cold` unset; after the second, set (round of the second).
- [ ] Run it: FAIL.
- [ ] `onceMore?: Record<string, string>` on `Effects`, applied before `setFlags` in `applyEffects`.
- [ ] Run: PASS. Commit `feat(engine): a flag set a second time can set another (onceMore), for content 1.50`.

### Task 2: The people in content

**Files:** Create `packages/content/src/people.ts`, `packages/content/src/cards/people.ts`; modify `cards/index.ts`, `cards/home.ts` (two lodger cards), `cards/rich.ts` (`rich_fake_art`), `names.ts` (`people`), `text/types.ts`, `text/fill.ts` (`person` placeholder), `text/{en,es,ru}.ts` (`people`), `text/{en,es,ru}.cards.ts`, `text/{en,es,ru}.after.ts`, `art.ts`, `index.ts`; tests `content.test.ts` (counts), `text.test.ts` (placeholders), a new `people.test.ts`.

**Interfaces (produces):**
- `type PersonId = 'inlaw' | 'boss' | 'landlord' | 'founder' | 'advisor' | 'parents'`; `PEOPLE: readonly PersonId[]`; `type Mood = 'pleased' | 'upset'`.
- `cardPeople: Record<string, { who: PersonId; mood: Mood }>`; `personArt(who, mood) = 'person.<who>.<mood>'`; `metFlag(who) = '<who>_met'`.
- `personEndings: Record<PersonId, ReadonlyArray<{ id: string; mood: Mood; flags?: string[]; notFlags?: string[] }>>`, the last of each with no condition.
- `text.people[who]: { who: string; meet: string; endings: Record<string, string> }`.

The cards (amounts in start-of-game dollars; `F` = a follow-up's weight, `I` = an introduction's, both tuned in Task 6; every option of a person's card sets `<who>_met`; warm sets `_warm` and clears `_cold`, cold the other way):

| card | category | when | options |
|---|---|---|---|
| inlaw_coin | investing | once, I, rounds 1–12 | no (`inlaw_out`); $2,000 in (`inlaw_in`, warm); finance ≥ 1: ask what it does (`inlaw_out`, cold) |
| inlaw_moon | investing | once, F, `inlaw_in` a round ago | hold: 85 % `inlaw_held`+`inlaw_bubble`, 15 % +$40,000 `inlaw_jackpot`; sell (+$10,000, `inlaw_sold`+`inlaw_bubble`); sell half (+$5,000, then 85/15 as hold at half) |
| inlaw_dinner | family | once, F, `inlaw_out` a round ago | pass (`inlaw_bubble`); buy in now (−$3,000; 80 % lost, 20 % +$9,000; `inlaw_bubble`); call it a bubble (`inlaw_bubble`, cold) |
| inlaw_rug | investing | once, F, `inlaw_bubble` a round ago | let him be (`inlaw_broke`); sit with him (focus 1, `inlaw_broke`, warm) |
| inlaw_loan | family | once, F, `inlaw_broke` a round ago | no (cold); lend $5,000 (`inlaw_owes`, warm); give $1,000 (warm) |
| inlaw_repay | family | once, F, `inlaw_owes` two rounds ago | take it: 60 % +$5,000 `inlaw_repaid`, 40 % +$2,000 `inlaw_half`; let him keep it (status +1, `inlaw_forgiven`) |
| boss_weekend | career | soon, cooldown 3, I, employed, not `boss_covered`/`boss_cold` | plans (`boss_declined`, `onceMore` → `boss_cold`); cover it (focus 1, career skill +1, `boss_covered`, warm) |
| boss_offer | career | once, F, employed, `boss_covered` two rounds ago | stay; outside Singapore: go there (rung up, move, +$4,000, `boss_moved`); in Singapore: London, the same |
| boss_layoffs | career | once, F/2, employed, `boss_met`, recession, not `layoff_proof` | wait for the list (50/50 as `career_layoff`); warm: ask her (status +1, `boss_protected`); voluntary package |
| landlord_damp | housing | once, I, tenant | put up with it (status −1, warm); complain (focus 1, cold; 60 % fixed); fix it yourself (−$1,500, warm) |
| landlord_raise | housing | soon, cooldown 3, F/4, tenant, `landlord_met` two rounds ago, not `landlord_left` | pay (−$1,800, warm); negotiate (focus 1; 60 % −$600, 40 % −$1,800 cold); move out (−$1,200, `landlord_left`) |
| landlord_sale | housing | once, F, tenant, warm, `landlord_met` three rounds ago, not left, not Singapore | keep renting; buy at 80 % with a mortgage (`landlord_sold`); buy at 80 % outright |
| founder_pitch | investing | once, I, rounds 2–14 | wish her luck; $5,000 (`founder_in`, warm); weekends (focus 1, network +1, warm) |
| founder_more | investing | once, F, `founder_in` a round ago | no more (`founder_closed`); another $5,000 (`founder_more`) |
| founder_exit | investing | once, F, `founder_more` two rounds ago | hear it: 62 % `founder_closed`, 28 % +$20,000 `founder_sold`, 10 % +$100,000 `founder_rich`; sell to a fund (+$5,000, `founder_out`) |
| founder_second | investing | once, F, `founder_closed` two rounds ago | luck; $3,000 (70 % lost, 30 % +$15,000 `founder_won`); introductions (focus 1, network +1, warm) |
| advisor_fund | investing | once, I, net worth ≥ $15,000, round ≥ 2 | no (cold); $10,000 in the two-year bonds and $400 a year for good (`advisor_fund`, warm); finance ≥ 2: the index fund instead (cold) |
| advisor_insurance | housing | once, I, a mortgage | as it is (cold); the bank's, $900 a year for ten rounds (`advisor_insurance`, warm); elsewhere, $350 a year (cold) |
| parents_help | family | once, high, tenant, rounds ≤ 5 | you'll manage (status +1, `parents_proud`); $10,000 (`parents_helped`) |
| parents_care | family | once, high, rounds 9–14 | a home, $6,000 a year for four rounds (`parents_home`); yourself (focus 1, $1,500 a year, `parents_cared`, warm) |
| parents_inheritance | laterLife | once, high, round ≥ 15 | renounce; accept (70 % +$40,000, 30 % −$8,000 `parents_debts`); warm: accept knowing their papers (+$40,000) |
| cousin_wedding | family | once, 8, rounds 2–10 | something small (status −1); fair (−$400); lavish (−$2,500, status +3) |
| ex_new_car | lifestyle | once, 8, rounds 3–12 | wave; a Tesla to match (buy); hire one for a weekend (−$600, status +1) |
| classmate_job | career | once, 8, employed, rounds 3–14 | stay; take it (pay +12 %, status +1); negotiation 2: at your price (+18 %) |
| lodger_party | lifestyle | 6, cooldown 6, a lodger | let it go (−$900); make the lodger pay (60 % nothing, 40 % the lodger leaves) |
| lodger_leaves | lifestyle | 4, cooldown 6, a lodger | keep the deposit for the paint (+$600, leaves); give it back (network +1, leaves) |
| rich_fake_art | lifestyle | once, 15, a million, owns art | keep quiet (70 % nothing, 30 % status −4); sue (−1 %; 50 % +2 % status +1, 50 % status −2); give it to a museum as a fake (status +2) |

Endings (first that holds; mood): inlaw jackpot, repaid, forgiven, unpaid (`inlaw_owes`, not repaid or forgiven), estranged (`inlaw_cold`), coin; boss protected, moved, covered, cold, gone; landlord sold, left, cold, warm, rent; founder rich, won, sold, out, closed, passed; advisor both, fund, insurance, cold, none; parents debts, cared, home, helped, fine.

- [ ] Tests: counts by category (career +3, investing +8, housing +4, family +7, lifestyle +4, laterLife +1); each card's text, art and portrait ids exist; every follow-up's flags are set by some option of an earlier card; `cardPeople` covers exactly the six's cards; each person's endings end with one with no condition and have text in every language; `{rival:…}` only in bodies of the three; `{person:…}` filled.
- [ ] Run: FAIL. Write the content and words. Run: PASS. Commit `feat(content): the people who come back: six characters' arcs, the player's people as cards, and three cards awaiting their art`.

### Task 3: The art

**Files:** `tools/art/src/sheets.ts` (`cards/stand-ins-v22`), `art/raw/cards/stand-ins-v22.png`, regenerated `art/clean`, manifests and sprite sources (web and mobile).

- [ ] Cut the three stand-ins from older scenes (a party, moving boxes, an auction) into a 3×1 sheet at 2.5×; `pnpm -s art`, the web's `sprites.ts`, `pnpm --filter @ratrace/mobile sprites`; `text.test.ts` "points only at sprites that exist" passes. Commit `art: stand-ins for the lodger's party and leaving and the fake masterpiece`.

### Task 4: Core reads the people

**Files:** Create `packages/core/src/game/people.ts` + test; modify `session/types.ts` (`Profile.people`), `session/profile.ts` (`readProfile`, `tellProfile`'s `flags`, `profileAfter`), `session/local.ts`, `ranked.ts`, `room.ts`, `legacy.ts` (pass flags), `packages/online/src/merge.ts` (+ tests).

**Interfaces (produces):**
- `peopleMet(flags): PersonId[]` in `PEOPLE` order.
- `endingOf(who, flags): { id: string; mood: Mood }`.
- `peopleEpilogue(flags): Array<{ who: PersonId; ending: string; mood: Mood }>`.
- `peopleSeen(flags, over: boolean): string[]`: `<who>` for each met, and `<who>.<ending>` once over.
- `Profile.people: string[]`; `LifeStep.people`; `Progress.people`, joined by `mergeProgress`.

- [ ] Tests: a life with `inlaw_met` + `inlaw_repaid` tells `inlaw` and `inlaw.repaid` once over, only `inlaw` before; none met tells nothing; an old profile reads with `people: []`; two progresses join their people.
- [ ] Implement; run core and online tests. Commit `feat(core): who a life met and how each story ended, kept in the profile and joined across devices`.

### Task 5: The app

**Files:** `apps/mobile/src/game/screens/Cards.tsx` (+ `PersonLine.tsx`), `End.tsx`, `Collection.tsx`; `packages/i18n/messages/{en,es,ru}.json`; tests beside each.

- [ ] Tests: the card of a person shows "Meet Toni, your brother-in-law" before `inlaw_met` and "Toni, your brother-in-law" after, its portrait hidden from screen readers; a cousin's card shows the cousin's name; the end of a life with `inlaw_met` reads the in-law's ending; the collection's People tab counts the people met and the endings seen.
- [ ] Implement; `phone` and `phone-web` projects pass. Commit `feat(mobile): a person's face on their cards, what became of each at a life's end, and People in the collection`.

### Task 6: Balance and frequency

**Files:** Create `tools/balance/src/people.ts` (the report) and `people.test.ts`; tune weights in `cards/people.ts`.

- [ ] `pnpm balance` before (saved), the report: per person the share of lives that meet them, characters met per life (mean and spread), each arc's follow-ups reached.
- [ ] Tune `I`/`F` until a life meets two or three on average, parents nearly always, and arcs reach their middle in most lives that start them; the bands hold.
- [ ] Test the targets (mean met between 2 and 3.5; parents ≥ 90 %; each follow-up reached in ≥ 50 % of lives that could reach it). Commit `test(balance): the people a life meets, measured, and their weights tuned`.

### Task 7: Bundle, checks, look

- [ ] `pnpm online:bundle` (only `v0.45.0-1.50.0` changes); commit `chore: the unshipped bundle with the people`.
- [ ] `pnpm -s test`, `pnpm -s typecheck && pnpm -s lint`, `web:size` (with the exact weight).
- [ ] Scenes or the dev route on 8096: a person's card, a follow-up, the epilogue, People; screenshots at 393 wide; stop the server.
