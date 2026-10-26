# Characters who come back

Status: design, approved in principle by the owner on 2026-10-27 (from `docs/roadmap.md`, "In the drawer": characters who come back, stories that remember). To be planned once this document is approved.

## Why

A life is a run of cards that do not know each other. The owner wants the game to feel more complete: people who come back, who remember what the player did, and whose stories end well or badly because of it. Each of them also carries one lesson about money, which is what the game is for.

## Goals

- Six new characters, each with a face, a name and a voice, met in some lives and not in others, each with an arc of two to six cards over several rounds.
- Their cards remember: what the player chose in one card opens, closes or changes a later one.
- The player's three people already in the paper ("Tu gente": a classmate, a cousin, an ex, the rivals of `packages/core/src/game/rivals`) step into the life through cards too.
- At the end of a life, an epilogue says what became of each character met.

## Non-goals

- No chat with characters, no relationship screen to manage, no new stage of the round.
- No new kind of order (action) in the finance screen.
- Not every life: a life meets two or three of the six, so lives differ.

## Anti-goals

- A character who only costs money. Each arc has a way to come out ahead.
- Real people or brands (the celebrities already in the game are caricatures; these are ordinary people).
- A lesson that preaches. The card says what happens; the epilogue may say what it cost.

## The cast

Names are per language (`packages/content/src/names.ts` is where names live; check its pattern), a portrait each at 64×64 in two moods (pleased, upset), shown on their cards.

| id | Who | Arc, in short | What it teaches |
|---|---|---|---|
| `inlaw` | The crypto brother-in-law | Offers his coin. If in: it goes ×5, sell or hold; held, it vanishes (most often) or goes ×20 (rarely). If out: he boasts at dinner; later, ruined, he asks for a loan, which he repays or not | Speculation, FOMO, lending to family |
| `boss` | Your boss | Asks you to cover a weekend project. Covered: she offers a promotion with a move; declined twice, she stops offering. In a crisis' layoffs, she protects whoever covered for her | A career as an investment |
| `landlord` | The landlord (only while renting) | Damp in the flat: complain, put up with it, or fix it yourself. Raises the rent every few rounds: accept, negotiate, leave. A tenant he likes is offered the flat at a friend's price | Renting versus buying |
| `founder` | A friend with a startup | Asks you to invest. Needs more a round later. Two rounds on: most often it closes; sometimes a small exit; rarely bought out at ten times. If it closed, she comes back with a second idea | Risk and diversification |
| `advisor` | The bank's adviser | Sells a "guaranteed" fund with high fees, and insurance tied to the mortgage. Yes: a yearly cost that runs on quietly; the epilogue adds it up | Fees and compound interest |
| `parents` | Your parents (every life) | Young: they offer help with a deposit. In middle age: care (a home, which costs, or you, which costs focus). Late: an inheritance, or debts | Planning the long term |

And the player's people, already in the game, as cards: the cousin's wedding (a gift: cheap, fair, lavish; status), the ex with a new car (a temptation to spend for status), the classmate who offers a job at their firm.

## How it works (the engine as it is)

The engine already has what an arc needs:
- A card option sets flags (`setFlags`, `clearFlags`), and the life keeps the round each flag was set (`flags: Record<string, number>`).
- A card's `when` can need flags (`flags`), their absence (`notFlags`), and `notRecentFlag` (not set less than N rounds ago). Together, "this flag set at least N rounds ago" is a later card in an arc.
- `once`, `cooldown`, `weight` and the other conditions (renting, `hasMortgage`, `minAge`-like conditions, regimes for crises) cover the rest. Outcomes with chances cover the rolls.

So an arc is content: an introduction card (`once`, a moderate weight, its conditions), and later cards that need the flags the earlier ones set, with a high weight so that once due they come within a round or two. The relationship is flags too: `<character>_warm` and `<character>_cold`, set and cleared by choices (three states: cold, none, warm; simpler than a scale, enough for the arcs above).

Which characters a life meets comes from the draw: the introduction cards compete with the rest. The weights are tuned with `pnpm balance` (and a new report in `tools/balance` of characters met per life) so that a life meets two or three on average, and the parents' cards come in every life by age.

What the content does not have yet, to be checked while planning (add to the engine only if missing, with a version bump):
1. Buying the rented flat from the landlord at a discount from a card (an effect that buys a property at a percent of its price, as `buyItem` does for items).
2. A card's text naming one of the player's people (the classmate, the cousin, the ex), whose names come from the life's rivals.
3. A stake whose payoff is a multiple of what was put in (the coin, the startup): either an effect that remembers an amount, or fixed amounts by option (cash in, cash out), which the content can do today.

## The interface

- A character's card shows their portrait (its mood by the card: pleased when warm or good news, upset otherwise) and their name above the text. The first card of a character introduces them ("Meet Toni, your brother-in-law").
- Which card belongs to which character is content (`packages/content`: a map from card id to character), read by the app; no engine field.
- The end of a life gains an epilogue: one line for each character met, chosen by the flags the life ended with (content: per character, a few lines each needing flags). Shown in the end screen, and in the share card if it fits.
- The collection gains "People": the characters ever met, their portraits, and how many of their endings the player has seen (a reason to play again).
- Words in en, es, ru; Russian gender-neutral towards the player (`docs/i18n/russian.md`).

## Versions

New cards change what a life does: `CONTENT_VERSION` goes up (and `ENGINE_VERSION` only if one of the three engine points above is needed). Lives in progress keep their rules. The rule that a card is dealt only with two options open (`dealOnlyChoices`, guarded by `tools/balance/src/choices.test.ts`) holds for every new card.

## Size

About 24 cards: brother-in-law 6, boss 3, landlord 3, startup friend 4, adviser 2, parents 3, the player's people 3. Each with its art (288×120 scenes, sheets of six) and words in three languages. Twelve portraits (six characters, two moods). Epilogue lines, about four per character.

## Left to the builder

- The exact amounts, chances, weights and rounds of each card, tuned with the balance tool against the bands of spec 3.7.
- Names in each language.
- Whether the boss's arc reuses the existing `card.boss_leaves`.
- The headline in the paper the year the coin collapses ("$RATA plunges") is welcome if the news can carry it without an engine change; otherwise later.

## Art

Prompts for the portraits and the card scenes: `art/prompts/v21-prompt-pack.md`.
