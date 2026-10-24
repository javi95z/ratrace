# v20 prompt pack: four new cards

Content 1.48 adds four cards. Until they are drawn, each shows a stand-in cut from an older scene.

Save as `art/raw/cards/cards-40.png` — `card.retreat`, `card.trendy_area`, `card.boss_leaves`, `card.tax_letter`

Attach one or two earlier card sheets (for example `cards-35.png`) so the style matches.

```text
Landscape image, 12:5 panels, 2 columns by 2 rows, 4 wide panels. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign or paper is a blank shape. Left to right, top to bottom:
1. The retreat: a small figure sitting cross-legged on a yoga mat on a wooden deck by a turquoise sea at sunset, palm trees, a few other mats around, a phone face-down and switched off beside the mat.
2. The neighbourhood of the moment: a narrow street of renovated old buildings with plant-filled balconies, a speciality coffee shop with people on stools outside, a small art gallery window, a small figure carrying a cardboard box towards a doorway, looking up at the building.
3. Your boss is leaving: an office at evening, a boss in a coat holding a box of personal things, leaning over the player's desk and pointing towards the exit with a confident smile, colleagues glancing from their screens.
4. A letter from the tax office: the player at a kitchen table under a lamp, holding an official envelope with a stamp as a blank shape, a calculator and a stack of receipts, a cold cup of coffee, a window with night outside.
```

Then `pnpm -s art && pnpm --filter @ratrace/web exec tsx scripts/sprites.ts`. Nothing in the code changes: the four sprites keep their names.

## Where each goes

| # | File | What | Size |
|---|---|---|---|
| 1 | `cards/cards-40.png` | Retreat, trendy neighbourhood, boss leaving, tax letter | 288×120 |

## Eleven more cards

Save as `art/raw/cards/cards-41.png` — `card.barn_car`, `card.mlm`, `card.squatters`, `card.solar`, `card.village_house`, `card.company_ipo`

```text
Landscape image, 2:3 overall, made of 6 wide panels: 2 columns by 3 rows, each panel 12:5. Scene sheet in the same painted pixel-art style as the attached sheets. No text anywhere: any sign or paper is a blank shape. Left to right, top to bottom:
1. A classic in the barn: a dusty red seventies sports car half under a tarp in an old wooden barn, light coming through the planks, the player pulling the tarp back in surprise.
2. The shakes business: the player at a kitchen table with a stack of shake tubs and a starter kit box, a phone showing a cheerful message as a blank bubble, a friend smiling too widely on a video call.
3. Squatters: a city flat door with a new shiny lock, the player outside with keys that do not fit, a curtain twitching in the window above.
4. Solar panels: a family house roof covered in solar panels in bright sun, a technician on a ladder giving a thumbs up, the player below holding a coffee.
5. The house in the village: an old stone house in a small village with a leaking tiled roof and a big fig tree in the yard, the player at the gate holding an old key.
6. The company goes public: a trading floor screen wall showing a green rising line, colleagues cheering, a bell on a stand, the player holding a phone looking at a number as a blank shape.
```

Save as `art/raw/cards/cards-42.png` — `card.metro_works`, `card.strike`, `card.school_reunion`, `card.child_streamer`

```text
Landscape image, 12:5 panels, 2 columns by 2 rows, 4 wide panels. Same style. No text. Left to right, top to bottom:
1. Works outside the business: a small shop front behind a deep trench, fences and diggers, a lonely shopkeeper in the doorway, dust in the air.
2. A strike at work: a group of workers with blank placards outside an office building, a boss watching from a window above, the player hesitating at the door.
3. The school reunion: a restaurant table with former classmates, one showing off car keys, another a watch, the player laughing honestly at the end of the table.
4. The child who streams: a teenager's bedroom with a gaming chair, ring light, microphone and two screens, the parent standing in the doorway holding a receipt.
```

Save as `art/raw/cards/cards-43.png` — `card.stag_party`

```text
One wide panel, 12:5. Same style. No text. The stag party: a group of friends in matching silly T-shirts under the neon lights of a Las Vegas street at night, the player holding a clipboard and a bundle of tickets, looking slightly worried.
```

| # | File | What | Size |
|---|---|---|---|
| 2 | `cards/cards-41.png` | Barn car, shakes, squatters, solar, village house, IPO | 288×120 |
| 3 | `cards/cards-42.png` | Metro works, strike, reunion, streamer | 288×120 |
| 4 | `cards/cards-43.png` | Stag party | 288×120 |
