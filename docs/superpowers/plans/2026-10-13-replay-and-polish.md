# Replay Hooks and Polish: Build Plan

Date: 2026-10-13
Spec: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (sections 4, 5, 8.5, 9, Appendix B and C)
Also binding: section 4 of `docs/superpowers/specs/2026-10-13-ratrace-online-design.md`.
Builds on: the web game of roadmap step 8, on branch `web`.

These are roadmap steps 9 and 10, built in that order. Like the last three plans this records decisions and tasks, not code. Each task is built test-first, and the whole is reviewed by a fresh reviewer at the end.

## What this adds

Step 9, the reasons to play again: three lives to unlock, thirty badges, a gallery of everything ever owned, personal bests and the history of past lives, and a picture of a life to share.

Step 10, the polish: a first life that explains itself, an accessibility pass checked by a tool and by hand, a pass over every sentence in both languages, and the small things the step 8 review left open.

Not here: anything online (steps 11 to 15).

## Decisions

### Badges are judged from the record of a life, outside the round

- A badge is a small pure function over what one round did: the game before it, the orders, the events, the game after it, and a short journal of the life so far. The thirty functions and their text live in `packages/content`, next to the cards, because they name its items, assets and cities. The engine is not changed: a life plays the same with or without badges, and its saved games stay valid.
- The journal holds the few facts a single round cannot show: the cities lived in, whether the credit card was ever used, which kinds of asset were ever held, and the badges already earned in this life. It is derived from the events, so replaying a saved game rebuilds it.
- Whoever runs the game judges the badges: the local session today, the server later, with the same code. A screen never does.
- Two badges are about everything ever owned, across lives ("twenty items", "every car"). They are judged against the gallery, after a round's items join it.

What each badge means, where the spec's one-line name left room:

| Badge | Earned when |
|---|---|
| First 100k, Millionaire, Ten million | Net worth in start-of-game dollars reaches it at the end of a round |
| Millionaire by 35 | The same, at age 34 or younger |
| Debt-free at 40 | Owes nothing at age 40 |
| Never used the credit card | A whole life ends without a shortfall ever going on the card |
| Out of the rat race, before 40, before 35 | The escape is won; by the age of its first covering round |
| Passive income twice expenses | Passive income after tax is at least twice what a round costs |
| First share | Holds any single stock |
| Five asset classes at once | Holds five of: index funds, bonds, stocks, crypto, gold, property |
| Bought the dip | Buys an index fund or a stock in a recession |
| Held crypto through a winter | Holds coins at the start of a winter round, sells none, still holds them after |
| Three rental properties | Three properties rented out at once |
| Bond ladder | Holds all three bonds at once |
| Index funds only and escaped | Wins the escape having never held anything but index funds, and no property |
| First luxury watch | Owns an Omega, Rolex, Audemars Piguet or Patek Philippe |
| Supercar owner | Owns the Lamborghini |
| Penthouse | Owns a penthouse |
| Status 100 | Status reaches 100 |
| Twenty items collected, Every car owned | The gallery, across all lives |
| Three cities | Has lived in three cities in one life |
| Moved to Dubai | Moves to Dubai |
| Family of four | A partner and two children at home |
| MBA | Holds the degree |
| Sold a business | A card sells the business |
| Rode out a recession without selling | Holds investments through a recession round and sells none |
| Bankrupt | Goes bankrupt |

### Unlocks follow from badges and finished lives

- Delivery rider: one finished life. Heir: the Millionaire badge. Newcomer abroad: the Three cities badge. So nothing is judged twice.
- The profile keeps the list of unlocked lives. The chooser reads it; it never works it out.

### The profile grows, and is never overwritten whole

- The profile gains: badges with the date and the life each was first earned in, the gallery, the unlocked lives, and which tips of the guide were seen. A profile from before this plan opens with all of them empty.
- Every change to the profile is read, changed and written back as one step, so that a setting changed in one place cannot erase a badge earned in another.
- A finished run also records the badges earned in it.

### What a step gives back

`GameSession.answerCard` and `playRound` also return the badges this step earned for the first time and the lives it unlocked. The ledger shows the badges; the end of a life shows them all, the lives unlocked, and any personal best.

### Records

Personal bests are worked out from the finished runs by one pure function: best score, greatest net worth in start-of-game dollars, youngest escape, most status, lives lived, lives escaped. The history lists every past life with its score and its net-worth graph.

### Share card

- A picture, 1080 by 1350, drawn in the browser on a canvas from a 270 by 337 pixel grid scaled four times with no smoothing, so it is pixel art like the rest.
- What goes where is decided by a pure function that returns a list of things to draw; the canvas only draws them. So the layout is tested without a canvas.
- It shows the logo, the life and its city, the portrait at 58, the score and its three parts, net worth, the graph, and up to eight badges. It is shared through the device's share sheet where there is one, and saved as a file where there is not.

### New screens

| Screen | Content |
|---|---|
| Collection | Two tabs. Items: every status item, in colour once owned, a silhouette until then, grouped as the shop groups them. Badges: all thirty, with how each is earned; earned ones in colour with the date |
| Records | Personal bests, then every past life, the latest first |
| Home | Gains the way to both |

A silhouette is the sprite used as a mask over a palette colour, so no colour outside the palette appears.

### Guided first life

- Until a first life is finished, each stage of a round shows one short tip the first time it is reached: the news, a card, a result, the finances, the ledger, and a few that wait for their moment (the first refusal, the first round with money to invest, the first escape progress).
- A tip is a panel in the flow of the page, not a dialog: it blocks nothing, can be closed, and "skip the guide" closes them all for good. Which tip is due is decided by one pure function.

### Accessibility

- An automated audit (axe) runs in the end-to-end tests on every screen at phone and desktop sizes, and must find nothing serious.
- By hand, from the step 8 review: the focus moves to the new stage and the stage is announced; the tab list and tab panels are named; every page has one top heading and its own title; the two text colours that fell short of 4.5 to 1 are replaced; a locked card option says why it is locked.
- The engine gains the reason a card option is locked, since only it knows.
- A sheet closes on the phone's Back button.
- Amount and purchase sheets stay centred dialogs on a wide screen. The spec said "docked panels"; a dialog keeps one component and one focus trap, and reads well at 1440px. The spec is changed to say so.

### Text pass

- A lint over every sentence of the game in both languages: no double spaces, no trailing space, matching quotes and brackets, Spanish opening marks where a closing one stands, typographic apostrophes and quotes used one way, a length limit on labels that must fit a button.
- Interface keys that nothing uses are removed, and a test keeps it so.
- Every interface string is read once more in both languages for tone and for the same word meaning the same thing everywhere.

### Left open by the step 8 review, closed here

The profile is merged, not overwritten (M4). The round on screen survives a change of language (M5). A boot that lands after a start is ignored (M6). A save from a newer version says so (M8). A sprite whose file fails to load shows the placeholder (M11). Removing an order says when others went with it. The architecture test also covers the presenters and the round store, and the sheets get component tests (M14). Unused text keys are removed (M15). The terminal game reads `sí`.

Still deferred, with reasons, in the final report: always replaying a save on open (M3), a view that shows only the card being answered (M12, needed before ranked play), quotes that restate a rule (M13), snapping pixel-font sizes to the font's grid.

## Tasks

- [ ] 1. Badges in `packages/content`: the journal, the thirty rules, their text and art, the unlock rules
- [ ] 2. Profile and session: the grown profile, merged writes, the life record in the save and in replay, what a step gives back, runs with badges
- [ ] 3. Round store and context: badges and unlocks on screen state, the profile for the screens, the round surviving a change of language
- [ ] 4. Ledger and end of life: badges earned, lives unlocked, personal bests
- [ ] 5. Collection and records screens, and the way to them from home; the chooser reads the unlocks
- [ ] 6. Share card
- [ ] 7. Guided first life
- [ ] 8. Accessibility: lock reasons from the engine, focus and announcements, names and headings, contrast, the Back button, the axe audit
- [ ] 9. Text pass: the lint, unused keys, the read-through
- [ ] 10. The open minors of step 8
- [ ] 11. End-to-end for all of it, at the three sizes
- [ ] 12. Fresh review and one fix pass
