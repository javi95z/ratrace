# v21 prompt pack: characters who come back, a life's milestones, the guide

Four pieces of work need new art: the cards dealt only to the rich (content 1.50), the recurring characters (`docs/superpowers/specs/2026-10-27-recurring-characters-design.md`), the celebration of a life's milestones, and the guide's "How to play" and glossary. Every size below is the size of a sprite in the game, the same as the art already there: portraits 64×64, card scenes 288×120, icons 32×32, animation frames 48×48. Draw each sheet as one image in the proportions given; the art tool cuts and scales it (`tools/art/src/sheets.ts` gets one entry per sheet when the work that uses it is built).

Always attach the reference sheets named, so the style, the palette and the line match. No text anywhere in any image: a sign, a screen, a paper or a coin shows blank shapes.

The card ids are provisional: they are the design's, and may be renamed when the cards are written. The order of the panels is what matters.

## 0. The cards of the rich

Content 1.50 deals ten cards only to players worth a million or more. They play now with stand-ins cut from older scenes (`art/raw/cards/cards-49.png`, already listed in `tools/art/src/sheets.ts` as 2 columns by 5 rows): draw the sheet and save it over the stand-in.

Save as `art/raw/cards/cards-49.png`: `card.rich_lawsuit`, `card.rich_scandal`, `card.rich_tax_squad`, `card.rich_partner_swindle`, `card.rich_divorce`, `card.rich_gala`, `card.rich_uncle_castle`, `card.rich_yacht_rocks`, `card.rich_threat`, `card.rich_hostile_bid`

Attach `art/raw/cards/cards-47.png` and `art/raw/cards/cards-48.png` so the style matches.

```text
Portrait image, 24:25 overall, made of 10 wide panels: 2 columns by 5 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets, the world of the very rich drawn with the game's satirical eye. No text anywhere: any sign, banner, screen, letter or paper shows blank shapes. Left to right, top to bottom:
1. A lawsuit: a rich person in a suit on a courthouse's stone steps, surrounded by press cameras, as a stranger's lawyer waves a thick file at them.
2. A scandal: a mansion's breakfast table with a newspaper and a phone, both showing the same blurry party photo of the owner, who has spilt their coffee.
3. The tax squad: three grey inspectors with boxes and lanyards marching into a marble study full of filing cabinets, the owner holding the door open.
4. A partner who swindles you: a back office at night, a smiling business partner stuffing a second pay envelope into his jacket under a desk lamp.
5. An expensive divorce: a long glass table split down the middle by tape, two lawyers on each side, a wedding photo torn in two between them, paparazzi at the window.
6. The charity gala: a chandeliered ballroom, a guest standing with a raised bidding paddle while an auctioneer points at a blank banner over a hospital drawing.
7. A great-uncle's castle: a crumbling hilltop castle in the rain, a notary at the gate holding a big old key and a long scroll of debts trailing on the ground.
8. The yacht on the rocks: a white sailing yacht tilted on rocks at dusk, party lights still on, guests in evening wear wading ashore and a sheepish skipper.
9. A threatening letter: a letter made of cut-out shapes lying on the doormat of a grand hallway, two bodyguards in dark suits standing behind it.
10. A hostile bid: a giant glossy corporate tower casting its shadow over a small family business, a suited executive holding out a contract to the owner.
```

## 1. The characters' portraits

Save as `art/raw/portraits/people-01.png`: `person.inlaw.pleased`, `person.inlaw.upset`, `person.boss.pleased`, `person.boss.upset`, `person.landlord.pleased`, `person.landlord.upset`, `person.founder.pleased`, `person.founder.upset`, `person.advisor.pleased`, `person.advisor.upset`, `person.parents.pleased`, `person.parents.upset`

Attach `art/raw/portraits/portraits-05.png` and `art/raw/portraits/celebs-01.png` as the style reference.

```text
Landscape image, 4:3. Object sheet: 4 columns by 3 rows, 12 bust portraits (head and shoulders) in exactly the painted pixel-art style of the attached sheets, each turned slightly to the right, on a plain flat background, ordinary people drawn as friendly cartoons (not caricatures of anyone real), no text and no logos. Six people, each twice side by side: first pleased, then upset, the same person, clothes and lighting in both. Left to right, top to bottom:
1. The brother-in-law, pleased: a man in his thirties, gelled hair with a quiff, a thin trimmed beard, a cheap shiny bomber jacket over a hoodie, a gold chain, holding up a phone with a green arrow going up on it, a big confident grin.
2. The brother-in-law, upset: the same man, hair flattened, the phone screen cracked showing a red arrow down, eyebrows up, a forced embarrassed smile, a bead of sweat.
3. The boss, pleased: a woman in her late forties, short silver bob, black rectangular glasses, a navy blazer over a white shirt, a lanyard, arms crossed, a small approving smile and a nod.
4. The boss, upset: the same woman, glasses pushed up on her forehead, pinching the bridge of her nose, a stack of folders under one arm, a tight mouth.
5. The landlord, pleased: a man in his sixties, bald on top with white hair at the sides and a big white moustache, a brown cardigan over a checked shirt, a large ring of keys held up, a warm grandfatherly smile.
6. The landlord, upset: the same man, frowning under bushy brows, holding a folded paper (a blank rent letter) and the ring of keys tight, lips pressed under the moustache.
7. The friend with a startup, pleased: a woman around thirty, curly dark hair in a high bun, round glasses, a mustard turtleneck, a laptop covered in round stickers under her arm, beaming with excitement, one fist up.
8. The friend with a startup, upset: the same woman, bun coming loose, glasses crooked, hugging the laptop to her chest, a brave sad half smile.
9. The bank's adviser, pleased: a man in his early thirties, slicked side parting, a slim grey suit, a pale blue tie, a bank name badge as a blank shape, holding out a glossy brochure, a wide salesman's smile.
10. The bank's adviser, upset: the same man, smile gone stiff, tugging at his collar, the brochure held behind his back.
11. The parents, pleased: an older couple in their sixties side by side, the mother with short grey curls and a cardigan, the father with thinning hair and a knitted vest, both smiling warmly, her hand on his shoulder.
12. The parents, upset: the same couple, worried, the father holding a blank official letter, the mother's hand over her mouth.
```

## 2. The characters' cards

Attach `art/raw/cards/cards-47.png` and `art/raw/cards/cards-48.png` so the style matches, and `art/raw/portraits/people-01.png` so the people are the same (once it is drawn). Every panel shows the player as the small figure of the earlier card sheets.

Save as `art/raw/cards/cards-50.png`: `card.inlaw_coin`, `card.inlaw_moon`, `card.inlaw_rug`, `card.inlaw_dinner`, `card.inlaw_loan`, `card.inlaw_repay`

```text
Landscape image, 8:5 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets, the brother-in-law of the attached portraits in every panel. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. His coin: a family living room, the brother-in-law leaning in close to the player on a sofa, showing a phone with a cartoon coin with a rat's face on it, a rocket drawing on a napkin on the coffee table.
2. It went up five times: the player alone at night in bed lit by a phone showing a steep green line, eyes wide, the brother-in-law's face in a small video-call bubble cheering.
3. The coin vanishes: the brother-in-law on a park bench at grey dawn holding his head, his phone showing a flat red line, a pigeon at his feet, the player standing beside him with two coffees.
4. The family dinner: a long dinner table with relatives, the brother-in-law standing and boasting with his phone held up, the player at the end of the table rolling their eyes, a roast chicken in the middle.
5. He asks for a loan: the brother-in-law at the player's front door in the rain, no jacket, hands together pleading, a big forced smile.
6. He pays you back, or not: the brother-in-law at a café table sliding a thin envelope across to the player, a sheepish smile, and in the window behind, a second smaller scene of him running away with an empty wallet.
```

Save as `art/raw/cards/cards-51.png`: `card.boss_weekend`, `card.boss_offer`, `card.boss_layoffs`, `card.landlord_damp`, `card.landlord_raise`, `card.landlord_sale`

```text
Landscape image, 8:5 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets, the boss and the landlord of the attached portraits. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. The weekend project: an empty office on a sunny Saturday, the boss at the player's desk dropping a thick folder on it, the player in weekend clothes with a beach bag on one shoulder.
2. The promotion abroad: the boss in a glass meeting room holding out a plane ticket and a blank contract to the player, a world map on the wall with a dotted line to another city.
3. The layoffs: an open-plan office with colleagues carrying boxes towards the lift, the boss standing in front of the player's desk like a shield, a stern manager with a clipboard behind her.
4. The damp: a small rented bedroom with a big dark patch of damp on the ceiling corner, a bucket under a drip, the landlord at the door shrugging, the player holding a phone with a photo of the wall.
5. The rent goes up: the landlord at the player's door handing over a blank letter with a big up arrow stamped on it, the player in slippers behind the chain of the half-open door.
6. He offers you the flat: the landlord and the player shaking hands at a kitchen table over a blank contract, a ring of keys between them, a pot of coffee, the landlord smiling under his moustache.
```

Save as `art/raw/cards/cards-52.png`: `card.founder_pitch`, `card.founder_more`, `card.founder_exit`, `card.founder_second`, `card.advisor_fund`, `card.advisor_insurance`

```text
Landscape image, 8:5 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets, the friend with a startup and the bank's adviser of the attached portraits. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. Her pitch: a tiny co-working space with beanbags, the friend presenting to the player on a laptop screen showing a blank slide with a rising line, sticky notes all over the wall behind.
2. She needs more: the friend and the player on a bench outside the co-working at night, the friend holding a blank spreadsheet on her laptop with a red box, a pleading look.
3. How it ends: a split panel: on the left, the friend boxing up the office with an empty co-working behind; on the right, the friend popping a bottle of cava with a sharp-suited buyer, confetti.
4. Her second idea: the friend at the player's door again, a new laptop with new stickers under her arm and a cardboard prototype in her hands, a hopeful grin.
5. The guaranteed fund: a bank branch desk, the adviser sliding a glossy brochure with a shield shape on it towards the player, a pen ready, a small print column on the brochure as tiny grey lines.
6. Insurance with the mortgage: the same bank desk, the adviser stacking three blank folders on top of a mortgage contract in front of the player, a smile too wide.
```

Save as `art/raw/cards/cards-53.png`: `card.parents_help`, `card.parents_care`, `card.parents_inheritance`, `card.cousin_wedding`, `card.ex_new_car`, `card.classmate_job`

```text
Landscape image, 8:5 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets, the parents of the attached portraits. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. Help with the deposit: the parents at their kitchen table handing the player an envelope, a plate of biscuits, a photo of the player as a child on the fridge.
2. Caring for them: the father in an armchair with a blanket and a walking stick, the player crouched beside him helping with pills from a weekly box, the mother watching from the doorway, a brochure of a care home on the side table.
3. The inheritance: a notary's wood-panelled office, the player sitting alone before a desk with a blank will and an old ring of house keys, an old family photograph on the desk.
4. Your cousin's wedding: a garden wedding under string lights, the cousin in a wedding dress hugging the player, a gift table piled with wrapped presents, the player holding a small envelope.
5. Your ex's new car: a street at evening, a shiny red convertible pulling up beside the player at a bus stop, a stylish person at the wheel waving with sunglasses on, the player clutching a bus pass.
6. A job at your classmate's firm: a bright modern office lobby, a smiling old classmate in a smart casual jacket shaking the player's hand, a lanyard ready in the other hand, a glass meeting room behind.
```

## 3. A life's milestones

The big moment of a milestone (the first time ever, getting out of the rat race, a new record) fills the screen: a scene across the top, as a card's, and the player's portrait jumping over confetti below it.

Save as `art/raw/cards/milestones-01.png`: `milestone.worth_100k`, `milestone.worth_1m`, `milestone.worth_10m`, `milestone.debt_free`

```text
Landscape image, 12:5 panels, 2 columns by 2 rows, 4 wide panels. Scene sheet in the same painted pixel-art style as the attached sheets, bright and celebratory, warm golden light. No text anywhere: any number, sign or screen shows blank shapes. Left to right, top to bottom:
1. The first hundred thousand: a small figure on a modest apartment balcony at sunset, arms up, a short stack of gold coins on the table beside them, a few coins bouncing in the air.
2. A millionaire: a small figure standing on a tall neat tower of gold coins above a city at golden hour, arms spread wide, confetti in the sky.
3. Ten million: a small figure diving into a swimming pool full of gold coins in a villa garden, palm trees, fireworks in the evening sky.
4. Free of debt: a small figure cutting a credit card in two with big scissors, a chain falling off their ankle, broken paper bills of debt flying away like birds into a clear blue sky.
```

Save as `art/raw/cards/milestones-02.png`: `milestone.first_home`, `milestone.first_business`, `milestone.halfway`, `milestone.escaped`

```text
Landscape image, 12:5 panels, 2 columns by 2 rows, 4 wide panels. Scene sheet in the same painted pixel-art style as the attached sheets, bright and celebratory. No text anywhere: any sign shows a blank shape. Left to right, top to bottom:
1. Your own home: a small figure at the front door of a little house with a garden, holding up a ring of keys that catches the light, a cardboard box at their feet, a sold sign as a blank board in the lawn.
2. Your own business: a small figure flipping a blank shop sign to open on the glass door of a little shop with an awning, a first customer waiting, the light inside warm.
3. Halfway out: a small figure running inside a big hamster wheel, the wheel's door half open with sunlight pouring through the gap, the figure looking at the light.
4. Out of the rat race: a small figure leaping out of an open hamster wheel into a green meadow at sunrise, arms up, the empty wheel behind still turning slowly, birds in the sky.
```

Attach `art/raw/cards/cards-40.png` as the style reference for both.

Save as `art/raw/icons/anim-03.png`: `anim.cheer.0` to `anim.cheer.3`, `anim.burst.0` to `anim.burst.3`

Attach `art/raw/icons/anim-01.png` as the style reference.

```text
Landscape image, 2:1. Object sheet: 4 columns by 2 rows, 8 small frames of animation on a plain flat background, in exactly the pixel-art style and line of the attached sheet, each frame centred in its cell with room around it. No text. Top row, a loop of four frames: a small cheering rat (the game's grey rat mascot) jumping, 1 crouched ready, 2 in the air with arms up, 3 at the top with arms wide and mouth open, 4 landing. Bottom row, a loop of four frames: a firework burst in gold and teal, 1 a small spark rising, 2 a small star of sparks, 3 a full round burst, 4 the sparks fading and falling.
```

## 4. The guide: how to play and the glossary

Save as `art/raw/icons/icons-13.png`: `icon.howto`, `icon.glossary`, `icon.inflation`, `icon.burnout`

Attach `art/raw/icons/icons-12.png` as the style reference.

```text
Square image, 1:1. Object sheet: 2 columns by 2 rows, 4 icons on a plain flat background, in exactly the pixel-art style, outline and palette of the attached icons, each centred with room around it. No text and no letters. Left to right, top to bottom:
1. How to play: an open book with a big round question mark shape floating above its pages.
2. The glossary: a thick closed dictionary standing upright with a bookmark ribbon and a small magnifying glass leaning on it.
3. Inflation: a banknote shrinking, drawn as a large faded note behind a smaller bright one, with a small downward arrow.
4. Burnout: a phone-style battery with one red bar left and a small flame above it.
```

## Where each goes

| # | File | What | Sprite size |
|---|---|---|---|
| 0 | `cards/cards-49.png` | The ten cards of the rich (over the stand-in) | 288×120 |
| 1 | `portraits/people-01.png` | Six characters, pleased and upset | 64×64 |
| 2 | `cards/cards-50.png` | The brother-in-law's cards | 288×120 |
| 3 | `cards/cards-51.png` | The boss's and the landlord's cards | 288×120 |
| 4 | `cards/cards-52.png` | The startup friend's and the adviser's cards | 288×120 |
| 5 | `cards/cards-53.png` | The parents' cards and the player's people | 288×120 |
| 6 | `cards/milestones-01.png` | Milestones: 100k, 1M, 10M, debt free | 288×120 |
| 7 | `cards/milestones-02.png` | Milestones: home, business, halfway, out | 288×120 |
| 8 | `icons/anim-03.png` | A cheering rat and a firework, four frames each | 48×48 |
| 9 | `icons/icons-13.png` | How to play, glossary, inflation, burnout | 32×32 |

Draw 1 first and attach it to 2 to 5. Then `pnpm -s art && pnpm --filter @ratrace/web exec tsx scripts/sprites.ts` once the sheets are listed in `tools/art/src/sheets.ts`.
