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
