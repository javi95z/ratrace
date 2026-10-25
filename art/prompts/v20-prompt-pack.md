# v20 prompt pack: four new cards

Content 1.48 adds new cards. `cards-40` to `cards-47` are drawn.

Save as `art/raw/cards/cards-40.png` — `card.retreat`, `card.trendy_area`, `card.boss_leaves`, `card.tax_letter`

Attach one or two earlier card sheets (for example `cards-35.png`) so the style matches.

```text
Landscape image, 12:5 panels, 2 columns by 2 rows, 4 wide panels. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign or paper is a blank shape. Left to right, top to bottom:
1. The retreat: a small figure sitting cross-legged on a yoga mat on a wooden deck by a turquoise sea at sunset, palm trees, a few other mats around, a phone face-down and switched off beside the mat.
2. The neighbourhood of the moment: a narrow street of renovated old buildings with plant-filled balconies, a speciality coffee shop with people on stools outside, a small art gallery window, a small figure carrying a cardboard box towards a doorway, looking up at the building.
3. Your boss is leaving: an office at evening, a boss in a coat holding a box of personal things, leaning over the player's desk and pointing towards the exit with a confident smile, colleagues glancing from their screens.
4. A letter from the tax office: the player at a kitchen table under a lamp, holding an official envelope with a stamp as a blank shape, a calculator and a stack of receipts, a cold cup of coffee, a window with night outside.
```

Save as `art/raw/cards/cards-48.png` — `card.transfer_asia`, `card.digital_nomad`, `card.offer_madrid`, `card.tokyo_lifetime`, `card.zurich_savings`, `card.london_flatshare`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. The office in Asia: the player with a suitcase on a skyscraper terrace at night in Singapore, the lit Marina Bay towers and the boat-shaped hotel behind, a colleague handing over an access card.
2. Digital nomad: the player working on a laptop in a beach hut in Thailand at sunset, flip-flops, a coconut drink, long-tail boats on the water.
3. An offer in Madrid: the player shaking hands with a smiling manager on a sunny café terrace in a Madrid square, old balconies with flowers above.
4. A job for life in Tokyo: a Tokyo office late at night with rows of desks still lit, the boss at the far end, the player signing a contract with a pen, neon outside.
5. The Swiss bank's plan: a quiet wood-panelled bank office in Zurich, a banker sliding a folder across, a heavy vault door half open behind, snowy rooftops in the window.
6. The flatshare in London: a small shared flat with an empty room and a single mattress, a flatmate leaving with a suitcase, the player holding a rent bill by the rainy window.
```

Then `pnpm -s art && pnpm --filter @ratrace/web exec tsx scripts/sprites.ts`. Nothing in the code changes: the four sprites keep their names.

## Where each goes

| # | File | What | Size |
|---|---|---|---|
| 1 | `cards/cards-40.png` | Retreat, trendy neighbourhood, boss leaving, tax letter | 288×120 |

## Six sheets of six

Attach one or two earlier card sheets (for example `cards-40.png`) so the style matches. Save each in `art/raw/cards/` with the name given.

Save as `art/raw/cards/cards-41.png` — `card.barn_car`, `card.mlm`, `card.squatters`, `card.solar`, `card.village_house`, `card.company_ipo`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. A classic in the barn: a dusty red seventies sports car half under a tarp in an old wooden barn, light coming through the planks, the player pulling the tarp back in surprise.
2. The shakes business: the player at a kitchen table with a stack of shake tubs and a starter kit box, a friend smiling too widely on a video call on a phone.
3. Squatters: a city flat door with a new shiny lock, the player outside with keys that do not fit, a curtain twitching in the window above.
4. Solar panels: a family house roof covered in solar panels in bright sun, a technician on a ladder giving a thumbs up, the player below holding a coffee.
5. The house in the village: an old stone house in a small village with a leaking tiled roof and a big fig tree in the yard, the player at the gate holding an old key.
6. The company goes public: a trading floor screen wall showing a green rising line, colleagues cheering around a bell on a stand, the player looking at their phone.
```

Save as `art/raw/cards/cards-42.png` — `card.metro_works`, `card.strike`, `card.school_reunion`, `card.child_streamer`, `card.linkedin_post`, `card.podcast`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. Works outside the business: a small shop front behind a deep trench, fences and diggers, a lonely shopkeeper in the doorway, dust in the air.
2. A strike at work: workers with blank placards outside an office building, a boss watching from a window above, the player hesitating at the door.
3. The school reunion: a restaurant table with former classmates, one showing off car keys, another a watch, the player laughing honestly at the end of the table.
4. The child who streams: a teenager's bedroom with a gaming chair, ring light, microphone and two screens, a parent in the doorway holding a receipt.
5. The LinkedIn post: the player at a laptop late at night, a thumb hovering over a big publish button shape, a coffee, notification bubbles floating above.
6. The podcast: two people in a small studio with big microphones and headphones, a plain red light on the wall, the player gesturing confidently.
```

Save as `art/raw/cards/cards-43.png` — `card.ai_agent`, `card.gig_apps`, `card.copy_trading`, `card.hacked`, `card.signal_group`, `card.remote_outskirts`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. An AI for the job: an office desk where a glowing friendly robot outline on the monitor types on its own, the player beside it with arms crossed, colleagues peeking over the partition.
2. Weekends with an app: a delivery rider on a bike with a big square backpack in a rainy city street at night, a ride-app car waiting at a light.
3. Copy trading: a phone in the player's hand showing a trader's profile with a rocket and a chart, a stack of coins on the table slowly shrinking.
4. You have been hacked: a laptop screen with a red lock and skull shape, the player with hands on head in a dark room, a phone buzzing.
5. The in-law's group: a family lunch table, an older man showing his phone excitedly to the player, chat bubbles above, the partner rolling their eyes.
6. A house an hour out: a small house with a garden at the edge of a village, green hills, a fibre box on the wall, the player working on a laptop in the garden.
```

Save as `art/raw/cards/cards-44.png` — `card.back_home`, `card.midlife`, `card.grandchild`, `card.black_card`, `card.child_piggy`, `card.lift_levy`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. Back to your parents' place: an adult carrying moving boxes into a childhood bedroom with old posters, a smiling mother in the doorway holding a plate of food.
2. The midlife crisis: a person in their forties beside a shiny new motorbike, a fresh tattoo on the arm, a travel backpack, a slightly guilty grin.
3. Your first grandchild: a grandparent gently holding a newborn by a window, tired young parents asleep on the sofa behind.
4. The black card: a heavy black metal card on the marble counter of a luxury shop, a golden airport lounge glimpsed through glass.
5. The piggy bank: a child at a kitchen table with a broken pig-shaped piggy bank and coins, a parent drawing a growing line on a napkin.
6. The residents vote: a building hallway with neighbours raising hands at a meeting, a new lift door being fitted behind them.
```

Save as `art/raw/cards/cards-45.png` — `card.street_contest`, `card.xmas_dinner`, `card.sabbatical`, `card.credit_stolen`, `card.office_pool`, `card.cooking_show`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. The neighbourhood contest: a café terrace decorated with flowers and string lights, a judge with a clipboard, a ribbon rosette.
2. The Christmas dinner: a long restaurant table with paper hats and wine glasses, the player at the bar talking animatedly to a surprised boss.
3. A sabbatical year: the player with a backpack on a mountain path at sunrise, an office tower small and far away in the valley.
4. They take your credit: a meeting room, a colleague presenting the player's slides to executives, the player at the back clenching a folder.
5. The office pool: colleagues crowded round a desk staring at a ticket, the player holding it, eyes wide.
6. A TV cooking contest: a television kitchen set with bright lights and cameras, the player flipping an omelette in a pan, a judge leaning in.
```

Save as `art/raw/cards/cards-46.png` — `card.stag_party`, `card.viral_bad`, `card.influencer_review`, `card.smartwatch`, `card.festival_rental`, `card.school_treasurer`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. The stag party: a group of friends in matching silly T-shirts under the neon lights of a Las Vegas street at night, the player holding a clipboard and a bundle of tickets, looking slightly worried.
2. Viral, the wrong way: the player frozen in a bar mid-argument, several phones raised and filming, a giant thumbs-up and heart shapes floating above.
3. An influencer wants free meals: a stylish young person photographing a plate in a small restaurant with a ring light, the owner behind the counter forcing a smile.
4. Your watch warns you: a close view of a wrist with a smartwatch showing a jagged red heartbeat line, the player on a sofa looking at it worried, a phone beside them.
5. The festival comes to town: a home's front door handed over to a group of festival-goers with tents and glitter, fireworks over the city behind.
6. The parents' group: a school hall after hours, parents on small chairs, the player at a table with a cash box, receipts and a laptop.
```

Save as `art/raw/cards/cards-47.png` — `card.drone_crash`, `card.concert`, `card.police_auction`, `card.protected_flat`, `card.startup_advisor`, `card.upstairs_leak`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign, screen or paper shows blank shapes. Left to right, top to bottom:
1. A drone on your terrace: a city apartment terrace at dusk with a crashed drone among broken plant pots, its embarrassed owner at the door holding an envelope.
2. Your favourite band: a packed concert from the front row, stage lights and confetti, the player singing with arms up.
3. The police auction: a warehouse with seized cars, watches in a glass case and a jet ski, an auctioneer at a lectern, the player raising a numbered paddle.
4. A protected flat: a modest new apartment block, the player receiving keys from an official at a desk with a stamped paper, a big smile.
5. Adviser for shares: a tiny startup office in a garage at the weekend, young founders around a whiteboard, the player explaining a chart.
6. The neighbour upstairs floods you: a ceiling with a spreading damp stain and dripping water into buckets, the player on a ladder looking up, a neighbour apologising from the doorway.
```

Then `pnpm -s art && pnpm --filter @ratrace/web exec tsx scripts/sprites.ts`. The sprites keep their names.

| File | What | Size |
|---|---|---|
| `cards/cards-40.png` | Retreat, trendy neighbourhood, boss leaving, tax letter (drawn) | 288×120 |
| `cards/cards-41.png` | Barn car, shakes, squatters, solar, village house, IPO | 288×120 |
| `cards/cards-42.png` | Metro works, strike, reunion, streamer, LinkedIn, podcast | 288×120 |
| `cards/cards-43.png` | AI, apps, copy trading, hacked, signal group, house out of town | 288×120 |
| `cards/cards-44.png` | Back home, midlife, grandchild, black card, piggy bank, lift | 288×120 |
| `cards/cards-45.png` | Street contest, Christmas dinner, sabbatical, credit taken, office pool, cooking show | 288×120 |
| `cards/cards-46.png` | Stag party, viral, influencer, smartwatch, festival, parents' group | 288×120 |
| `cards/cards-47.png` | Drone, concert, police auction, protected flat, startup adviser, leak | 288×120 |
| `cards/cards-48.png` | Office in Asia, digital nomad, Madrid offer, job for life, Swiss plan, flatshare | 288×120 |
