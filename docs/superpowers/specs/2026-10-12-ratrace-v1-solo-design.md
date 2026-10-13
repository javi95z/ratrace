# The Rat Race: v1 Solo Design

Date: 2026-10-12
Status: awaiting review

## 1. Summary

A web life-simulation game about money. The player lives one life from age 22 to 62, makes career, lifestyle and investment decisions each round, and tries to finish with the highest score. Score comes from wealth and status, multiplied by a bonus for escaping the rat race (passive income covers expenses).

The game uses real brands, real companies, real coins and real cities, with simulated (not historical) markets. Visuals are detailed pixel art on a night-city palette. It is a personal project for the author and friends.

This document covers **v1: the solo game**. Multiplayer and daily challenges are later phases, but the engine is designed for them now.

### Goals for v1

- A full solo life is playable start to finish in 20 to 30 minutes on a phone.
- Finance is deep: stocks, funds, bonds, crypto, gold, property, debt, pensions and per-city taxes.
- The player wants to start another life after finishing one.
- Mobile-first, clean on desktop.
- Spanish and English from day one.

### Non-goals for v1

- Accounts, backend, leaderboards, rooms, daily sprint.
- Monetization, analytics, push notifications.
- Margin, short selling, options, staking.
- Hand touch-up of sprites.

## 2. Decisions

| Area | Decision |
|---|---|
| Purpose | Personal and friends project |
| Core loop | Life-sim. Simultaneous rounds: swipe life cards, then manage finances |
| Life length | Age 22 to 62, 20 rounds of 2 years |
| Win rule | Fixed length. Score = (wealth + status) × escape multiplier |
| Tone | Realistic, with luxury flavour |
| World | Real brands, companies, coins and cities. No real people |
| Markets | Simulated from a seed. No historical replay |
| Name | The Rat Race, in English in every language |
| Currency | US dollars everywhere, shown with the plain `$` sign |
| Languages | Spanish and English |
| Visual style | Pixel art, fine scale, night palette, moody city look |
| Art source | Author generates drafts in ChatGPT; automated cleanup; no manual touch-up |
| Asset icons | Code-drawn ticker badges, not logos |
| Architecture | Pure deterministic engine, local-first web client, no backend in v1 |
| Later multiplayer | Private rooms (2 to 6, live) and an async daily sprint (5 to 10 min) |

## 3. Game design

### 3.1 Round flow

Each round covers two years and has four steps.

1. **News.** Three headlines and three gauges (interest rate, inflation, market mood). Each headline hints at what happens next round and is true 70% of the time.
2. **Life cards.** Three personal cards drawn from the deck, plus at most one world event shared by all players. Each card has two or three options. Effects are shown before the player commits. Cards are answered one at a time: each is settled, dice included, before the next is shown, so every option is judged as the player then stands and an option shown as open is open.
3. **Finance.** The player trades, borrows, repays, shops for status items, changes lifestyle tier, or moves city.
4. **Resolve.** The engine applies everything and shows an animated ledger.

Solo play is untimed. Rooms (later) use a 90-second round timer that ends early when all players are ready.

### 3.2 Resolve order

Order is fixed, because determinism depends on it.

1. Apply card choices, one card at a time, in the order of the hand. A shortfall a card leaves is covered at once by the rule of step 7, so the game is sound between one card and the next. A card left unanswered takes its first option.
2. Execute finance orders at the prices shown this round.
3. Work out income, expenses and tax from what the player now holds, at the rates and prices shown this round. Income: salary for two years, dividends, coupons, deposit interest, rent, business profit. Expenses: living costs, item upkeep, debt service, insurance, family. Because all three use only this round's figures, the preview the player sees before confirming is exact.
4. Advance the world: regime, rates, inflation, price level, asset prices, property indexes. Holdings change value.
5. Pay the income and charge the expenses.
6. Charge the tax from step 3: income tax on salary and business profit, tax on realised gains, dividends, interest and rent, and the yearly property tax. Property purchase tax was already paid in step 2.
7. Cover any cash shortfall from the savings deposit first, then with credit card debt. Spare cash pays the card down.
8. Update skills, status, item values, family timers and age.
9. Check escape (won or lost, see 3.13) and bankruptcy. Add this round's status to the running total the score averages. Compute score. Achievements are not part of the round: they are judged after it, outside the engine, from what the round did (section 4).
10. Draw next round's cards and news.

### 3.3 Player state

- **Money:** cash, holdings, properties, debts. Net worth = assets − debts.
- **Income:** salary plus passive income.
- **Expenses:** city living cost × lifestyle tier, plus upkeep, debt service, insurance and family. Living in a property you own removes the housing share of living cost (35%).
- **Career:** track, level, employer. Salary = track base × level × city multiplier.
- **Skills:** career skill and finance skill. Skills are a means and are not scored.
- **Status:** points from items, home, job title and city.
- **Focus:** 3 points per round by default. Overtime, a course, a side business, job hunting and moving city cost 1 point each; a master's degree or MBA costs 2. This stops "do everything" from being optimal.
- **Family:** partner, children, dependants. Family changes expenses and housing needs.
- **Insurance:** health, home, life, liability. Each softens or blocks specific event cards.
- **Flags:** facts that cards read and write, used for card chains.

### 3.4 The core tension

Status items raise status but cost cash and upkeep. Assets raise passive income but give no status. Some items sit in between: certain watches, bags and art hold or gain value. Deciding when to buy status, and which status, is the heart of the game.

### 3.5 Finance tools in v1

| Tool | Behaviour |
|---|---|
| Current account | No interest |
| Savings deposit | Rate follows the policy rate minus a spread |
| Government bonds | US Treasury short, US Treasury long, German Bund. Coupon income; price falls when rates rise |
| Index funds | S&P 500, MSCI World |
| Stocks | Apple, Microsoft, Nvidia, Amazon, Tesla, Inditex, Santander, LVMH, Ferrari, Coca-Cola |
| Crypto | Bitcoin, Ethereum, Dogecoin |
| Gold | Inflation hedge |
| Property | Studio, flat, family house, penthouse and villa in each city. Price = type base × city property index. Live in it or rent it out |
| Pension plan | Contributions reduce taxable income and are capped at 20% of the round's salary. Follows MSCI World and reinvests its dividends untaxed. Locked until the final round |
| Own business | Started through cards. Costs focus and cash; risky; large upside |
| Debt | Fixed mortgage, variable mortgage, personal loan, credit card |

Each stock has an archetype that sets its behaviour: growth, dividend, cyclical, defensive or meme.

### 3.6 Finance skill

Tools unlock as finance skill grows. This keeps early rounds simple and doubles as onboarding.

| Level | Unlocks |
|---|---|
| 0 | Current account, savings deposit, index funds, mortgage on own home, pension plan, personal loan, credit card |
| 1 | Government bonds, gold, individual stocks |
| 2 | Crypto, buy-to-let property, own business |

Skill rises through course and book cards, and once, by one level, after three rounds of holding any investment. Level 2 is the maximum in v1. Cards can still offer a locked asset directly ("your cousin has a hot tip"), which lets a player gamble without understanding.

### 3.7 Market model

World state: regime, policy rate, inflation, crypto cycle, a price per asset and a property index per city.

- **Regime** is a Markov chain over expansion, boom, slowdown, recession and recovery.
- **Asset return** per round = class mean for the regime + beta × class shock + asset shock + the asset's own drift + rare event shock. Beta scales the shock only; the drift is what lets a growth stock and a dividend stock differ in average return.
- **Bonds:** return = coupon − duration × change in rate.
- **Property:** base growth + momentum from last round − rate sensitivity × change in rate + city shock. Rent yield is per city.
- **Crypto** has its own cycle (accumulation, bull, mania, winter). It is tied to the economy in one way: each recession round has a set chance (40% in the test data) of forcing a crypto winter. Dogecoin has a high beta and a small chance of losing 90% in a round.
- **Price level:** an index that grows by inflation each round. Wages, living costs and other recurring flows follow it (see 3.14).
- **Price indexes** start at 100,000,000, so an asset that falls 95% several times still shows a moving price.
- **Random streams:** one for the economy, one per asset and one per city. Adding an asset later does not change the others for any seed, so stored seeds stay valid.
- **Dividends** are paid per asset at resolve.

Parameter tables live in `packages/content` and are tuned with the balance harness. Acceptance bands, measured over the three starting lives:

- An index-fund-only bot escapes the rat race in 25% to 45% of lives. Escaped means still out of it at the end (3.13).
- No single bot strategy has the top score in more than 40% of lives.
- The crypto-gambler bot is ruined in 30% to 60% of lives, and is the richest of all bots in at least 10%. Ruined means it ends with less than half the net worth the saver bot reached on the same life and seed.

The third band first counted bankruptcies. It was changed during milestone 1, as this section allowed: since a solvent player is never liquidated (3.12), a gambler who sells coins to clear the credit card is seldom formally bankrupt, so bankruptcy stopped measuring the risk of crypto. Ending far behind someone who merely saved does measure it.

What the gambler is matters as much as the band. It is the index bot's twin: it lives as cheaply, works as hard, keeps the same cushion, never borrows and never sells a coin. The one difference is what it holds: half bitcoin, a quarter each of ethereum and dogecoin, from the day its finance skill allows, and the index fund until then. So the band measures what holding crypto does and nothing else, and it is held by the crypto parameters alone: a winter takes three quarters, as the real ones did, which makes coins held blindly through the cycle lose more often than they win and win enormously when they do.

An earlier gambler also borrowed to its limit and raised its lifestyle as it grew rich on paper. The first independent review showed that the band then measured those habits rather than crypto, and that an earlier version of this paragraph, which said no number in a bot was chosen to hit a band, was not true of it. That bot was replaced by the twin.

The bots are defined in `tools/balance`. Each is a few plain rules. A bot is handed a view of the game (8.9), never the game, so it cannot use the seed, the dice or a future world even by mistake. When the game leaves a band, the content is tuned, not the bots.

### 3.8 Taxes

Each city has a tax profile. Bracket thresholds scale with the city's median salary (0.5×, 1.5× and 4×). These are game values, deliberately simplified, and are not real tax rates.

| City | Income tax by bracket | Capital gains | Dividends and rent | Special rule |
|---|---|---|---|---|
| Madrid | 19% / 30% / 45% | 21% | 21% | Pension deduction |
| London | 20% / 40% / 45% | 20% | 20% | The first slice of gains and dividends each round is tax-free |
| New York | 25% / 38% / 50% | 25% | 25% | Pension deduction |
| Dubai | 0% | 0% | 0% | None |
| Singapore | 5% / 15% / 22% | 0% | Dividends 0%; rent taxed as income | None |
| Bangkok | 5% / 20% / 35% | 10% | 10% | None |

Other rules:

- Capital gains are taxed on realised profit. Losses offset gains in the same round only.
- Buying property costs a purchase tax, paid from cash at the moment of purchase. A player who cannot pay the price and the tax cannot buy. Owning property costs a small yearly tax.
- Business profit and other non-investment passive income is taxed as income, through the brackets.
- Bracket thresholds follow the price level.
- The Taxes tab shows the bill before the player confirms the round. It is exact, not an estimate.
- World events can change a city's profile mid-game.

### 3.9 Cities

| City | Role | Salary | Living cost | Property | Prestige |
|---|---|---|---|---|---|
| Madrid | Balanced start | 2 | 2 | 3 | 2 |
| London | Finance careers | 4 | 5 | 5 | 4 |
| New York | Highest pay, highest tax | 5 | 5 | 5 | 5 |
| Dubai | Zero-tax luxury | 4 | 4 | 3 | 5 |
| Singapore | Low tax, expensive | 4 | 5 | 5 | 4 |
| Bangkok | Low-cost base | 1 | 1 | 1 | 2 |

Values are tiers from 1 to 5. Moving city costs cash and one focus point, and forces a home change.

### 3.10 Status

- Each item has a price, upkeep, status value and resale curve.
- Within one ladder, the best owned item counts in full and the others count 25%.
- Cars, tech and most fashion lose value. Rolex, Audemars Piguet, Patek Philippe, the Hermès Birkin and art can hold or gain.
- Nothing is worth more on the day it is bought than it cost. Resale starts at or below the price, for every item and by validation, so buying and selling in one round can never make money. The pieces that hold value start a little under their price and may drift up from there.
- Something only a card can give (a degree) cannot be sold, and is not sold in bankruptcy.
- The home ladder is where the player lives: a rented room, a rented flat, or any owned property.
- Lifestyle tier multiplies living costs: frugal 0.7, normal 1.0, comfortable 1.4, lavish 2.0. Lavish gives a little status. Some cards push the tier up.

### 3.11 Cards

A card has an ID, category, draw conditions (age, city, job, family, wealth, flags), a weight, and two or three options. An option has effects on cash, income, expenses, skills, status, focus and flags. Effects may be probabilistic, rolled from the seeded card stream. Options can set flags that make follow-up cards eligible later.

v1 ships 100 cards: Career 12, Education 6, Business 8, Investing 10, Housing 8, Lifestyle 10, Family 10, Health 5, Luck 8, World 12, Tax 6, Later life 5. The selection is the first N titles of each category in Appendix A.

Scams and collapses never name a real brand.

Cards do not create money. A property bought through a card is worth what was paid for it, whatever discount the card gave; a renovation adds a fixed amount to the home, not a share of its value; an item bought through a card is never cheaper than it could be sold on for at once. During the bankruptcy lock no card lends: an option that borrows, or buys a home on a mortgage, is closed. A card may not fill the pension of someone who owes more than they own (3.12).

### 3.12 Bankruptcy

A player goes bankrupt when both of these are true at the end of a round:

- credit card debt is above three times annual income (salary plus passive income, with one year of living cost as the floor), and
- everything they own outside the pension is worth less than everything they owe.

In bankruptcy everything outside the pension is sold at a 30% discount, status items included; every debt is cleared; memberships lapse; the lifestyle falls to the lowest tier the life allows; 25 status points are lost for good; and loans and mortgages are refused for three rounds, whether asked for in the finance phase or offered by a card. The game continues. Nobody is eliminated, which matters for rooms later.

The lasting loss of status was added while balancing: without it, buying status on credit and going bankrupt every few rounds was the strategy with the top score most often.

Three consequences are deliberate:

- **A solvent player is never liquidated.** Someone with assets and a large card balance keeps paying the card rate until they sell something.
- **The credit card keeps working during the lock.** It is how every shortfall is covered. A player who stays insolvent will go bankrupt again.
- **The pension is protected, so it is capped.** Without the cap on contributions, a player could move sale proceeds into the pension and let bankruptcy erase the tax bill. For the same reason a contribution is refused if it would leave the player owing more than they own outside the pension: borrowed money cannot be parked there and then written off.

### 3.13 Scoring

`score = (W + S) × E / 100`, using integer arithmetic.

- **W, wealth points:** linear interpolation between breakpoints, on net worth in start-of-game dollars, so that lives played through different inflation can be compared. Net worth ≤ 0 → 0; 10k → 100; 100k → 200; 1M → 300; 10M → 400; 100M → 500.
- **S, status points:** status as it was lived: the average of the status total over the rounds played. Status held only on the last day counts for one twentieth. Item values are calibrated so a life lived in high status lands between 250 and 350.
- **E, escape multiplier:** 100 if the player is not out of the rat race at the end. Otherwise 125 + 3 × rounds remaining at the moment of the escape that still holds.
- **Escape** means passive income, after the tax it would bear if the player had no salary, ≥ total expenses plus the property tax on what the player owns, at two consecutive resolves. The test asks whether the player could stop working, so it ignores the salary and the tax bracket the salary puts them in, and it is easier to pass where passive income is taxed lightly. The multiplier is fixed by the first of the two.
- **An escape can be lost.** The first resolve at which passive income no longer covers puts the player back in the rat race, and the bonus is gone. It can be won again by two more covering resolves, counted from the later date.

Two of these rules were changed after the first independent review of the life systems, which showed two ways to play the score instead of the game. Counting status as held at the end let a player turn their whole fortune into watches in the last round, which beat every other strategy. Fixing the escape for good the moment it was won let a player park money in deposits for two rounds, collect the bonus, and take it out again.

All constants are configuration and are tuned with the balance harness.

### 3.14 Inflation

Each round the price level grows by that round's inflation. The following are stored in start-of-game dollars and converted at the current price level whenever they are used:

- salary
- living cost
- other recurring expenses (upkeep, family, insurance)
- other passive income (business profit)
- the median salary that sets the tax brackets
- the personal-loan limit and the bankruptcy floor

Asset values, property prices and debts are nominal and are not converted. So inflation erodes a fixed mortgage, as it does in life, and a 40-year game does not end with one rented flat covering every living cost.

## 4. Replay hooks in v1

- **Starting lives.** Six lives with different jobs, cash, debts, perks and handicaps. Three are unlocked at first; three unlock through goals.
- **Achievements.** Thirty badges (Appendix C). Each is a small rule over one step of a life: the game before it, the orders, what happened, the game after it, and a short journal of the life (cities lived in, whether the card was ever used, kinds of asset ever held, badges already earned). The rules live with the content, not in the engine, so a life plays the same with or without them and a saved game stays valid. Whoever runs the game judges them: the device today, the server later, with the same code. A screen never does.
- **Collection.** A gallery of every status item the player has ever owned. A thing not owned yet is a silhouette with its name, and every badge says how it is earned: they are goals to aim for. Two badges count the gallery across all lives, and are credited to the life that completed them.
- **The profile is the record, and it is caught up.** Every step tells the profile all the badges of the life so far, not only the newest, and opening a life in progress does the same. A badge earned while the device could not write is recorded as soon as it can.
- **Records and history.** Personal bests and a list of past lives with net-worth graphs.
- **Share card.** An image summarising the life, generated in the browser.

| Life | Start | Perk | Handicap | Unlock |
|---|---|---|---|---|
| Nurse | Madrid | Cannot be laid off; paid night shifts | Low salary cap | Default |
| Software engineer | Madrid | Share plan at work; a head start in finance | Student loan | Default |
| Civil servant | Madrid | Job for life; cheaper mortgage | Slow raises | Default |
| Delivery rider | Madrid | 4 focus points | Unstable pay; no savings | Finish one life |
| Heir | Madrid | Starts with cash and a flat | High lifestyle baseline; low skills | Reach 1M net worth |
| Newcomer abroad | London | 4 focus points; language skill | Low cash; sends money home each round | Live in three cities in one life |

## 5. Screens

| Screen | Content |
|---|---|
| Home | Continue, new life, collection, records, settings |
| New life | Choose a starting life. Locked lives show their unlock goal |
| Round: News | Headlines and gauges |
| Round: Cards | One card at a time. Swipe, or tap buttons; each side of a card says which choice it picks. Effects visible before commit, and the result of each card is shown before the next |
| Round: Finance | Tabs: Portfolio, Market, Property, Debt, Lifestyle, Shop, Taxes. Shopping is a tab of its own because 34 items buried the lifestyle controls on a phone |
| Round: Resolve | Animated ledger; rat-race bar update |
| HUD | Age, cash, cashflow, status, rat-race bar. Tapping opens the income statement and balance sheet |
| Profile | Job, skills, family, insurance, focus |
| End of life | Net-worth graph, score breakdown, achievements, unlocks, share card |
| Collection | Items and badges |
| Records | Personal bests, then every past life with its score and its net-worth graph. Dates are the player's own, not London's |

Interaction rules:

- Primary actions sit in the bottom half of the screen for one-handed use.
- Buying and selling use a bottom sheet with an amount slider and 25%, 50% and 100% chips.
- The first life is guided. Each stage of a round shows one short tip the first time it is reached, and a few more wait for a later round. A tip is a note in the flow of the page, never a dialog: it blocks nothing. One tip a visit: reading one does not bring up the next. On a card the tip stands after the choices, so that it never pushes them off a small screen. A tip left unread is there next time; "skip the guide" ends them for good, and someone who has finished a life sees none.
- On a phone, the Back button closes the sheet on top instead of leaving the page. A sheet keeps one entry in the browser's history while it is open and takes it out when it is closed by its own button; a press of Back is never spent on a sheet that is gone. A sheet whose answer replaces the page keeps no entry.
- Why a card's choice is locked is always said, in full strength: the choice is dimmed, the reason is not.
- Swipes always have a button alternative. Tap targets are at least 44pt. A reduced-motion setting disables roll-ups and particle effects.
- A tap never does two things. The primary button sits in the same place on every screen, and a card's first choice sits where the button before it was, so for 400 ms after the screen changes a tap is taken for the tail of the last one and ignored. Without this a double tap answered a card for good, played a round, or skipped the ledger.
- Nothing that cannot be undone takes one tap from a screen the player did not mean to be on: starting a new life over one in progress asks first, and the chooser is not left behind in the browser's history.
- A list never moves under the thumb: something sold stays in its place, marked as sold, until the round is played.

Desktop (1024px and wider) uses the same components in three columns: profile and balance sheet on the left, the current step in the centre, news and this round's orders on the right. The side columns give way first on a narrow desktop. Amount and purchase sheets are centred dialogs on a wide screen: one component and one focus trap serve the phone and the desktop, and they read well at 1440px. Docked panels were considered and dropped.

## 6. Visual style

- **Scale:** one art pixel is one CSS pixel on mobile and two on desktop. Integer scaling only, `image-rendering: pixelated`.
- **Palette:** each sprite group (items, cars, homes, icons, badges, portraits, cards, skylines, brand) uses at most 64 colours: the 31 below, which are the only colours the interface uses, plus up to 33 taken from that group's own art and then frozen in `art/clean/palette.json`. One palette for everything was tried first and could not hold skin tones, car paint and night skies at once: portraits came out yellow and a green dial came out black. When a pixel is matched to the palette, hue and saturation count three times as much as lightness, for the same reason.
- **Tiles:** everything that can be bought (property, status items) sits on the same navy tile, its picture straight on the tile with nothing behind it; icons likewise sit on the surface they are on. Cream tiles were used first, because black and navy items read better on them; they made homes and items look like a different game from the screens around them, and the owner asked for one surface. A dark well behind each picture was tried next and removed at the owner's word. Only a portrait keeps a dark backdrop. Cream is kept for paper: the card being answered and the newspaper clippings.
  `#0b1022 #141b33 #1f2a4d #263566 #3b4f8a #3b6ea5 #9ad1d4 #bfe3f0 #dff3ff #5c1a2a #8f2d3f #d1495b #e8788a #7a4f12 #c8891e #f2c14e #ffe9a8 #1f6f66 #2a9d8f #7fd1b9 #c98f6b #e8b796 #2e1f1a #4a3228 #1a1c2c #2b2f44 #4b5269 #8b93a7 #c9cfdc #f4f1e4 #ffffff`
- **Theme:** night by default, in the manner of a boxed game of the nineties ("pixel de lujo", chosen from three drawn directions in `docs/design/2026-10-13-visual-directions.png`). Every surface has a lit edge and a shaded one, with the light from the top left as in the art. A panel's title hangs on a gold tab over its top edge. What can be pressed stands off the page on a hard shadow; what is only shown (a sprite, a gauge, the rat-race track) is sunk into it. The page is a weave of single pixels one shade off the night. The two pictures that say whose life it is, the city and the face, wear a double frame with gold between. The rat-race track is sixteen lamps ending at a door, which opens when the last is lit. A headline is a clipping: a block in the colour of its subject with the subject's icon, a word for the subject, and the sentence. Gold stays for the primary action.
- **Type:** Jersey 15 for titles and numbers; Inter for body text. Pixelify Sans was first, and its figures were hard to tell apart at HUD size (5 read as S, 2 as Z); Jersey 15 was chosen by the owner from eight faces set side by side. Jersey is drawn small inside its own size, so it is scaled until its small letters stand 0.56 of the font size (`font-size-adjust`), and the share card does the same sum on its canvas.
- **Chrome:** panels, buttons, bars and ticker badges are drawn in CSS with 2px stepped pixel borders. They need no sprites.
- **Reference look:** moody city pixel art, in the manner of Coffee Talk and VA-11 Hall-A.

## 7. Art pipeline

1. A prompt pack in `art/prompts/` holds one shared style block and one line per sprite, grouped into sheets.
2. The author generates each sheet in ChatGPT and saves it to `art/raw/<group>/` under the given filename.
3. `pnpm art` runs `tools/art` over every sheet: remove the key colour, find each object by its outline and assign it to the nearest grid cell (so an object that strays a few pixels over a cell line is not cut, and a neighbour's pixels are never taken), shrink it to the target size by averaging, match it to the group's palette, and clear isolated pixels.
4. The tool writes the sprites to `art/clean/<group>/<id>.png`, a manifest (`art/clean/manifest.json`) that maps every sprite id to its file and size, a contact sheet per group in `art/contact/` showing every sprite on both the navy and the cream background, and a report (`art/clean/report.md`) that flags empty cells, fragments, objects cut off by the edge of the sheet, leftover key colour and heavy stray-pixel correction.
5. The author rejects sprites by name. Prompts are adjusted and only those sprites are regenerated.
6. Sprite ids are fixed in `tools/art/src/sheets.ts` and are the ids the game content refers to. Packing the approved sprites into one atlas image is left to the web game, which is the only thing that needs it.

Generation rules:

- Sheets, not single images. Small sprites use a 4×4 grid of 16. Larger art uses smaller grids: cars 2×4, homes 3×3, card scenes 2×3, skylines 1×3. The prompt pack in `art/prompts/v1-prompt-pack.md` gives the layout of every sheet.
- Scene sheets (card art, skylines) are full-bleed panels separated by gutters. The generator drew magenta gutters on the skyline sheets and thin white lines on the card sheets (at x 765 to 770 and y 336 to 341 and 676 to 681 on every card sheet). The tool finds either kind and falls back to an even grid.
- Portraits fill their cells edge to edge, so they are cut on the fixed grid rather than by outline.
- Solid magenta (`#ff00ff`) background.
- One fixed view per ladder: cars side-on facing right, watches front-on, homes three-quarter.
- Real brand logos may appear on products. No other text in any image. Prompts name the real model and also describe its shape and colour, so a line still works if the name has to be dropped.
- The first approved sheet is attached as a style reference to every later prompt.
- Each life's portraits are one sheet: the same person at four ages.

| Sprite | Size (px) | v1 count |
|---|---|---|
| Finance tool, interface and lifestyle icons | 32×32 | 48 |
| Achievement badges | 64×64 | 30 |
| Status items (excluding cars and homes) | 64×64 | 27 |
| Homes and property types | 128×128 | 18 (2 rented homes, 11 homes to own, 5 kinds to let) |
| Cars | 96×48 | 7 |
| Portraits | 64×64 | 24 |
| Card art | 288×120 | 45 |
| City skylines | 312×66 | 6 |
| Logo, wordmark, app icon, mascot | 256×256 | 4 |

A missing sprite falls back to a placeholder and is logged. The game is fully playable on placeholders.

Expect 20% to 30% of sprites to be rejected on the first pass, and two or three rounds per group. Small flaws will remain; that is the accepted cost of no manual touch-up.

## 8. Architecture

### 8.1 Repository

A pnpm monorepo.

| Path | Purpose | Depends on |
|---|---|---|
| `packages/engine` | Game rules | Nothing |
| `packages/content` | Game data, validated with zod | Engine types |
| `apps/web` | Next.js client | Engine, content |
| `tools/balance` | Bot simulations | Engine, content |
| `tools/art` | Sprite pipeline (Node, sharp) | Nothing |

### 8.2 Engine

The engine is pure TypeScript with no DOM, network, clock or `Math.random`.

```ts
createGame(config: GameConfig, seed: string): GameState
applyRound(content: Content, state: GameState, choices: RoundChoices): { state: GameState; events: GameEvent[] }
previewRound(content: Content, state: GameState, choices: RoundChoices): RoundPreview
```

`previewRound` returns the holdings after the orders, the income, expenses and tax the round will bring, and any rejected orders. It reads only the current world, so it cannot leak next round's prices.

Content is passed in and is not stored in the state, so saved games stay small. `createGame` builds the whole 20-round world timeline from the seed.

Selectors derive net worth, cashflow and score from a state. The tax bill comes from `previewRound`, below.

Modules: `rng`, `market`, `economy`, `tax`, `cards`, `life`, `status`, `scoring`. Each has one job and is tested alone.

**Determinism rules.** The same seed and choices must produce the same state on every device and on a server, because later phases verify scores by replay.

- Money is stored as integer cents. Rates and returns are integer basis points.
- The engine uses only `+ − × ÷`, `Math.floor`, `Math.round` and `Math.sqrt`. A lint rule bans `Math.exp`, `Math.log`, `Math.pow` and trigonometry, whose results can differ between JavaScript engines.
- Random normals come from summing twelve uniforms, not Box-Muller.
- The RNG has separate named streams derived from the seed: one for the economy, one per asset, one per city, and later one each for cards and events. Drawing an extra card never shifts market prices, and adding an asset never changes another asset's prices.

**Untrusted input.** Orders will later arrive from other players' devices, so the engine treats them as untrusted:

- An order with the wrong shape (a missing type, an id that is not text, a flag that is not true or false) is rejected. Nothing is coerced and nothing throws.
- A rejected order carries a reason code such as `not-enough-cash`. The client turns the code into text in the player's language.
- At most 50 orders are executed per round; the rest are rejected.
- `applyRound` checks every invariant on the state it receives and on the state it returns. A corrupt save, or a bug in a system that writes to the player, raises an error naming the round and the state hash, in production as well as development.

**World and player are separate.** Markets and world events derive from the seed alone. A player's state derives from their own choices plus the world. A room server can later run the same engine unchanged.

### 8.3 Content

Content is data: cities, tax profiles, assets, market parameters, status items, cards, lives, achievements. It holds IDs and numbers only, never display text. The build validates every reference and fails on a broken one.

### 8.4 Web client

Next.js App Router, TypeScript strict, Tailwind, Motion for gestures and animation, Zustand for client state, next-intl for translation.

Data flow: the UI collects the round's choices, calls `applyRound`, stores the new state, animates the resolve screen from the event list, then saves.

### 8.5 Persistence

IndexedDB, with three stores:

- `currentGame`: seed, config, choice log and latest snapshot. Saved after every card answered and after every round. A finished life stays here until the next one begins, so that closing the page on the last ledger or on the score does not lose it.
- `runs`: finished lives.
- `profile`: unlocks, achievements, collection, settings.

The save format carries a version number and migrations.

### 8.6 Internationalisation

- Routes are `/es/...` and `/en/...`. The first visit picks from the browser language and falls back to English.
- UI text and content text live in `messages/{es,en}.json`. Content text is keyed by content ID.
- Real brand names live in a separate name pack per locale, so they can be swapped for a parody pack if the game is ever published.
- Numbers and currency use `Intl.NumberFormat` with `currency: 'USD'` and `currencyDisplay: 'narrowSymbol'`, so both languages show a plain `$`.
- The build fails if any key lacks a translation.

### 8.7 Failure handling

| Failure | Response |
|---|---|
| Broken content reference | Build fails |
| Missing translation | Build fails |
| Corrupt save | Rebuild the state by replaying the log from the seed; if that fails, offer a new life and keep the profile |
| The device will not save (private window, full disk) | The game plays on and says plainly that it is not saving; every later write offers the device what it refused |
| The same life open in two tabs | The tab that is behind refuses its next step, opens the life as it now stands, and says why |
| The game refuses a step, or a screen cannot be drawn | Say so, with the way to a new life and the way home; never a button that does nothing |
| Old save version | Run migrations; if one fails, treat as corrupt |
| Missing sprite | Show a placeholder and log it |
| Engine invariant broken (development) | Throw with the state hash and round number |

### 8.8 Hosting

Vercel. v1 has no server-side data.

### 8.9 Ready for online

Everything a player has will later live in an online database: saves, history, unlocks, rankings, daily challenges and rooms. The plan is in `docs/superpowers/specs/2026-10-13-ratrace-online-design.md`. v1 builds none of it, but follows six rules so that nothing has to be rewritten:

1. The interface reaches the game only through `GameSession` (start, current view, preview, submit a round) and reaches saved data only through `PlayerStore`. v1 ships local versions of both.
2. The client holds a `GameView`: a state whose timeline stops at the current round. In ranked online play the server keeps the future rounds.
3. Every saved game records its engine version and content version.
4. Games and runs get UUIDs on the device.
5. The resolve screen is drawn from the round's events only.
6. No game rules live in the interface.

## 9. Testing

- **Unit tests** (Vitest) for tax, mortgage amortisation, bond pricing, scoring, card conditions.
- **Determinism test:** the same seed and choices give the same state hash.
- **Property tests** (fast-check): no NaN, no negative holdings, net worth always equals assets minus debts.
- **Golden replays:** stored choice logs must reproduce their recorded final state.
- **Balance harness:** bots (saver, indexer, crypto gambler, status chaser, property leverager, random) play thousands of seeds. The run fails if results leave the bands in 3.7.
- **Content lint:** every ID has Spanish and English text and a sprite or placeholder.
- **End-to-end** (Playwright): a scripted full life at a phone viewport and a desktop viewport.
- **Accessibility checks:** contrast on the night palette, tap-target size, keyboard play on desktop.

## 10. Milestones

Each milestone gets its own implementation plan.

1. **Engine and balance harness.** A full life is playable in the terminal. Determinism, property and balance tests pass.
2. **UI on placeholders.** A full life is playable in the browser on phone and desktop.
3. **Content and languages.** All v1 content in Spanish and English. Content lint passes.
4. **Art.** All v1 sprites through the pipeline and into the game.
5. **Replay hooks.** Unlocks, achievements, collection, records, share card.
6. **Polish.** Guided first life, desktop layout, accessibility, animation.

The art prompt pack can be written alongside milestone 1, since generation is done by the author.

## 11. Later phases

Each will have its own design document.

- **Online.** Accounts, cloud saves, rankings, the daily challenge and private rooms, all on Supabase. See `docs/superpowers/specs/2026-10-13-ratrace-online-design.md`.
- **More content.** The rest of the catalog: seven more cities, about forty more assets and tools, thirty-five more status items, fifty more cards, eight more lives. Advanced tools (margin, short selling, options, staking) arrive here as finance skill level 3 and above.
- **Polish.** Installable app, reminders.

## 12. Risks

| Risk | Mitigation |
|---|---|
| The game is not fun | Milestone 1 is engine-only so balance is tested before any UI exists |
| One strategy dominates | Balance harness with fixed acceptance bands |
| AI sprites are inconsistent | Sheets, a style anchor, fixed views, an automated report, placeholders as fallback |
| Scope creep from the full catalog | v1 content is fixed by this document; the rest is a later phase |
| Real brands, if the game is ever published | Engine uses IDs only; names and sprites are swappable packs. Sprites may carry real logos, so a public release swaps the sprite pack as well as the name pack. No real brand is cast as a villain |
| Cross-device replay mismatch | Integer money and restricted maths, enforced by lint and the determinism test |

The mascot is the rat in a suit with a briefcase and red tie that first appeared as the stencil print on the anchor sheet.

## Appendix A: Card catalog

Titles are in priority order within each category.

- **Career:** ask for a raise, competitor offer, promotion with relocation, overtime crunch, layoff round, toxic boss, career switch, offer from Google / Inditex / Goldman Sachs, shares versus salary, remote work approved, become manager, headhunter call, sabbatical, burnout, civil-service exam.
- **Education:** master's degree, finance course, finance book, MBA, coding bootcamp, new language, CFA, mentor, industry conference, public speaking.
- **Business:** freelance gig, go self-employed, open a bar, online shop, rent spare room on Airbnb, launch an app, co-founder pitch, acquisition offer, YouTube channel, buy a franchise, partner dispute, first hire, business tax inspection, supplier fails.
- **Investing:** cousin's hot tip, employer share plan, new memecoin, friend's startup round, IPO hype, "guaranteed 20% a month" scheme, crypto exchange freezes withdrawals, off-plan flat in Dubai, trading-guru course, property crowdfunding, parking space deal, private equity invite, NFT drop, timeshare pitch, inherited rural land, gold dealer.
- **Housing:** rent hike, first flat, landlord sells, refinance fixed or variable, tenant stops paying, renovation, flood damage, move in with partner, area gentrifies, housemates, buy-to-let chance, building repair levy.
- **Lifestyle:** colleague's sports car, Ibiza trip, new iPhone, wedding abroad, Rolex waitlist call, business-class upgrade, designer sale, lease or buy a car, bottle service, Black Friday, gym upgrade, neighbours' new kitchen, influencer envy, first-class lounge.
- **Family:** start dating, wedding (three budgets), a child (the card comes again while there is one child at home, which is how a family of four happens), prenup, sibling asks for a loan, friend asks you to co-sign, support parents, grandparent inheritance, divorce, school choice, second child, pet, partner loses job, partner's career booms.
- **Health:** illness without insurance, burnout, dental emergency, sports injury, gym habit, therapy, parent needs care, health scare.
- **Luck:** El Gordo ticket, car breakdown, tax refund, stolen phone, surprise bonus, phishing scam, speeding fine, betting app, lawsuit, casino night, found wallet, laptop dies, flight cancelled, old Bitcoin wallet found.
- **World:** recession, rate hike, rate cut, inflation spike, crypto bull run, crypto winter, housing crash, tech bubble, AI boom, pandemic, election tax reform, bank failure, energy crisis, sovereign debt scare, new wealth tax, remote-work boom.
- **Tax:** hire a tax advisor, pension top-up, optimise your return, tax audit, undeclared cash temptation, change tax residency, crypto reporting rule, inheritance tax bill, holding company, golden visa.
- **Later life:** midlife-crisis Porsche, kids' university, early retirement option, downsizing, write your will, mentoring, pass on the business, big health check, grandchild.

## Appendix B: Status items in v1

- **Cars:** SEAT Ibiza, Toyota Corolla, VW Golf GTI, Tesla Model 3, BMW M3, Porsche 911, Lamborghini Aventador. (The generated top car reads as a Lamborghini; Ferrari arrives with the later supercar sheet.)
- **Watches:** Casio F-91W, Tissot PRX, Omega Speedmaster, Rolex Submariner, Audemars Piguet Royal Oak, Patek Philippe Nautilus.
- **Tech:** iPhone, MacBook Pro, PS5.
- **Fashion:** Zara, Ralph Lauren, Gucci, Louis Vuitton, Hermès Birkin.
- **Rented homes:** rented room, rented flat.
- **Homes to own, the cheapest first:** studio, flat, loft, townhouse, family house, duplex, chalet, penthouse, country estate, villa, mansion. A dearer home always gives more status.
- **Property to let only:** parking space, shop unit, office floor, warehouse, apartment block. Nobody can live in one: it is let from the day it is bought and gives no status. The four dearer kinds let for 10 to 25 percent more than a home of the same price, which is all that makes up for being of no other use. A parking space lets for 10 percent less: its small price already puts a player on borrowed property rounds before a studio could, and with a rent premium on top it was the best buy in the game. Renting out needs the same finance skill as any let. The shop shows homes and lets on two shelves. Three parking spaces do not earn the "three rentals" badge.
- **Travel:** Ryanair weekend, Ibiza summer, Emirates business class, Maldives resort.
- **Memberships:** Basic-Fit, Soho House, Amex Platinum, Bernabéu season seat.
- **Air and sea:** yacht charter week, NetJets charter.
- **Education:** MBA at IESE.
- **Art:** Banksy print, Picasso lithograph.

## Appendix C: Achievements in v1

- **Wealth:** first 100k, millionaire, millionaire by 35, ten million, debt-free at 40, never used the credit card.
- **Escape:** out of the rat race, escaped before 40, escaped before 35, passive income twice expenses.
- **Investing:** first share, five asset classes at once, bought the dip, held crypto through a winter, three rental properties, bond ladder, index funds only and escaped.
- **Status:** first luxury watch, supercar owner, penthouse, status 100, twenty items collected, every car owned.
- **Life:** three cities, moved to Dubai, family of four, MBA, sold a business, rode out a recession without selling.
- **Misfortune:** bankrupt.

Where a name leaves room: amounts are net worth in the dollars of age 22; "by 35" and "before 35" mean age 34 or younger; debt-free at 40 means owing nothing at 40 without ever having gone bankrupt; the two "held through" badges mean selling none of what was held, so selling and buying back does not count; index funds only means never having held anything else, a home included. An escape is dated to the end of the first round that covered it. The full table is in `docs/superpowers/plans/2026-10-13-replay-and-polish.md`.
