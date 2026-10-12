# Life Systems and Content: Build Plan

Date: 2026-10-13
Spec: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (sections 3.1 to 3.11, 4)
Builds on: the engine core in `packages/engine`.

Unlike the engine-core plan, this plan records decisions and tasks but not the code. The engine-core plan showed that writing the code twice moves mistakes into the plan without removing them. Here each task is built test-first, and a fresh reviewer checks the result.

## What this adds

The engine core knows money. This adds the life that produces it: cards, career, skills, focus, family, insurance, status items, moving city, news, and the real v1 data in Spanish and English.

## Decisions

### A round now has two calls

1. `applyCards(content, state, picks)` resolves the player's answers to the cards in their hand, including any dice rolls, and moves the game to the finance phase.
2. `applyRound(content, state, { orders })` then runs as before.

Reason: the player should see what a card did before deciding their finances, and `previewRound` stays exact because nothing random is left to happen after the orders. If `applyRound` is called while cards are unanswered, every card takes its first option, which is always the "do nothing" option. That is also what an absent player in a room gets.

### State

- `GameState` gains `phase` (`cards` or `finance`), `hand` (ids of the cards drawn this round) and `rng.cards` (the saved position of the player's own random stream).
- `PlayerState` gains `life`:
  - `lifeId`
  - `career` (`{ id, level }` or null when unemployed), `salaryModPct`, `salaryBoostPct` (this round only), `careerSkill`
  - `financeSkill` (0 to 2), `investedRounds`
  - `focusBase`, `focusUsed`
  - `partner`, `partnerSalaryPct`, `children` (rounds of dependence left for each)
  - `insurance` (health, home, life, liability)
  - `rentTier` (0 room, 1 flat), `minLifestyleTier`
  - `items` (`{ itemId, value, roundsLeft }`), `collection` (every item ever owned)
  - `recurring` (`{ tag, kind, annual, roundsLeft }`)
  - `flags` (name to the round it was set), `seen` (card id to the round it was last drawn)
  - `bonusStatus`, `movingTo`
- The engine core's `salaryAnnual`, `extraExpensesAnnual`, `extraPassiveAnnual` and `statusPoints` become derived values. `refreshDerived` recomputes them from `life` and the content after cards and orders and before the round's flows.

### Derived values

- **Salary** = city median × the career level's percentage × (100 + `salaryModPct` + `salaryBoostPct`) / 100, plus the partner's salary (city median × `partnerSalaryPct`). Unemployed means no own salary.
- **Other expenses** = recurring expenses + item upkeep + children (a share of city living cost each) + partner (a share of city living cost) + insurance premiums.
- **Other passive income** = recurring passive entries (a business is one of these).
- **Status** = for each item ladder the best owned item in full and the rest at 25%, plus temporary boosts from experiences, plus home, job level, city prestige, a small bonus for the lavish lifestyle tier, plus permanent bonuses from cards.

### New orders

All go through `executeOrder` and can be rejected with a reason code.

| Order | Effect |
|---|---|
| `focus` (`overtime`, `studyCareer`, `jobHunt`) | Costs 1 focus. Overtime raises this round's salary. Study adds career skill. Job hunt may raise the salary modifier |
| `buyItem`, `sellItem` | Durables are owned and can be resold at their current value. Memberships charge upkeep until cancelled. Experiences are consumed and boost status for a few rounds |
| `setLifestyle` | Not below the life's minimum tier |
| `setRentTier` | Room or flat, when not living in an owned home |
| `setInsurance` | Turns one kind on or off |
| `moveCity` | Costs cash and 1 focus. Takes effect after the round resolves, so this round's income and tax belong to the old city |

Finance orders are gated by finance skill: each asset has a minimum level, and renting out a property needs level 2. A card can still put money into a locked asset.

### Cards

- A card has an id, category, art id, weight, an optional `when` condition, an optional `once` or `cooldown`, and two or three options. The first option is always the default.
- An option has optional requirements (cash, focus), fixed effects, and optionally weighted outcomes rolled from the player's stream.
- Effects are one small record: cash, a share of salary or net worth as cash, salary modifier, skills, permanent status, focus cost, a recurring entry, flags, job change, family change, a granted item, a forced investment, and an insurance kind that covers most of a cash loss.
- Amounts are in start-of-game dollars and are converted at the current price level.
- Each round the hand is three personal cards drawn by weight from those whose condition holds and that are not on cooldown, plus at most one world card. A world card becomes eligible when its trigger is true in the current world (a regime or crypto phase just began, rates jumped, inflation is high, the player's city property fell).

### World additions

- **News:** each world state carries three headlines about the next one. Each is true 70% of the time. Topics: regime, rates, inflation, crypto, property.
- **Tax shifts:** at most two reforms per game, each moving one city's income and gains rates by a few points. Taxes are computed from the profile plus the shift.
- Both come from their own random streams, so they do not disturb prices.

### End of round

After the money settles: career skill grows with experience and study, promotion happens when skill reaches the next level's threshold, item values drift, experience boosts and recurring entries count down, children grow up, finance skill gains its one experience level after three invested rounds, a pending move happens, then the next hand is drawn.

Bankruptcy also sells status items at the fire-sale discount and counts their value toward solvency.

### Starting lives

`StartConfig` grows into a `LifeDef`: city, career and level, cash, debts, owned properties, focus, lifestyle floor, skills, recurring entries and perk flags. Perks used in v1: `layoff_proof`, `unstable_pay`, `cheap_mortgage`.

### Content package

`packages/content` holds the v1 data as typed objects: 6 cities with tax profiles, 21 assets with market parameters, 5 careers, 41 status items, 100 cards, 6 lives, and the text for all of it in English and Spanish. A lint test fails if any id lacks text in either language, any card references something that does not exist, or any art id is missing from `art/clean/manifest.json`.

## Tasks

- [ ] 1. Types, life state, starting lives, derived values, invariants
- [ ] 2. Life orders and finance-skill gating
- [ ] 3. Cards: conditions, effects, outcomes, hand, `applyCards`, the two-phase round
- [ ] 4. End-of-round life updates; bankruptcy with items
- [ ] 5. World news and tax shifts
- [ ] 6. Content: cities, assets, market, careers, items, lives
- [ ] 7. Content: 100 cards
- [ ] 8. Text in English and Spanish, with the lint test
- [ ] 9. Whole-life tests on the real content: invariants, determinism, accounting identity
- [ ] 10. Fresh review and one fix pass
