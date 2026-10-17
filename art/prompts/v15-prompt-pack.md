# Art prompt pack: v15

A player's rat, built from layers: eight sheets that stack into one avatar. Back to front:
**backdrop → body (fur) → face → outfit → eyewear → headwear.** Every layer is drawn on the same
square, at the same size and in the same place, so that any piece fits any other. This replaces
sheet 104 of v14 (heads with their hats drawn in): skip it if it is not drawn yet.

Use the same ChatGPT project and the same **style block** (in `v1-prompt-pack.md`). Start every
message with `Match the attached sheet's style and level of detail exactly.` The checks before
saving are the same as in v1, plus the two below.

## How the layers line up

- **Sheet 105 is the template.** Draw it first. Every later sheet attaches it, and is drawn on its
  exact grid: 4 columns by 2 rows of square cells, the rat in the same place in every cell.
- **The guide.** On sheets 106 to 110, each cell shows the rat as a flat, pale lavender silhouette
  (`#D9C2F0`, no shading, no outline) in the very pose of sheet 105, and the piece drawn on it in
  full colour. The silhouette only shows where the piece sits: the art pipeline keys out that
  lavender and the background, and keeps the piece where it was drawn.
- **Cut by cell, not by object.** These sheets are cut into their 8 cells as they are (64×64 each),
  not trimmed to what is in them, so a hat stays where the head is. Their lines in
  `tools/art/src/sheets.ts` use the grid cut and the `#D9C2F0` key as well as the background one.

Extra checks before saving: the silhouette is the same in all 8 cells and matches sheet 105; no
piece crosses into another cell.

## 105. The rat, in eight furs (the template)

Save as `art/raw/brand/rat-body-01.png` — `rat.body.grey`, `rat.body.brown`, `rat.body.white`, `rat.body.black`, `rat.body.ginger`, `rat.body.golden`, `rat.body.slate`, `rat.body.spotted`

Attach `art/raw/brand/brand-01.webp` (the mascot is its fourth object): the same character.

```text
Landscape image, 2:1. Object sheet: 4 columns by 2 rows, 8 square cells. In every cell the very same cartoon rat as the mascot in the attached sheet, shown from the chest up, facing a little to the right, centred, its head filling the upper two thirds of the cell, in exactly the same pose, size and place in all 8 cells. No clothes at all: bare fur on the shoulders. A calm, friendly face with the eyes open and the mouth closed, the same in every cell. Pink ears, pink nose, whiskers. Only the colour of the fur changes. Left to right, top to bottom:
1. Grey, as the mascot.
2. Warm brown.
3. White, with pink-rimmed ears.
4. Black, with a dark grey muzzle.
5. Ginger orange.
6. Golden yellow.
7. Blue-grey slate.
8. White with brown patches, like a pet rat.
```

## 106. Faces

Save as `art/raw/brand/rat-face-01.png` — `rat.face.calm`, `rat.face.grin`, `rat.face.smug`, `rat.face.wink`, `rat.face.shock`, `rat.face.sleepy`, `rat.face.fierce`, `rat.face.tears`

Attach `art/raw/brand/rat-body-01.png`.

```text
Landscape image, 2:1. Object sheet on the exact grid of the attached sheet: 4 columns by 2 rows of square cells. In every cell, the rat of the attached sheet's first cell as a flat pale lavender silhouette (#D9C2F0, no shading, no outline), in the same pose, size and place. On each silhouette, only the eyes, eyebrows and mouth of the rat are drawn, in full colour, where they sit on its face; nothing else. Left to right, top to bottom:
1. Calm: open eyes, small closed smile.
2. A wide grin showing its two front teeth.
3. Smug: half-closed eyes, one corner of the mouth up.
4. A wink and a sly smile.
5. Shocked: round eyes, mouth wide open.
6. Sleepy: eyes shut in curves, a tiny yawn.
7. Fierce: frowning brows, a determined straight mouth.
8. Laughing with happy tears at the corners of the eyes.
```

## 107. Outfits, everyday

Save as `art/raw/brand/rat-outfit-01.png` — `rat.outfit.suit`, `rat.outfit.tracksuit`, `rat.outfit.tuxedo`, `rat.outfit.hoodie`, `rat.outfit.scrubs`, `rat.outfit.hivis`, `rat.outfit.chef`, `rat.outfit.leather`

Attach `art/raw/brand/rat-body-01.png`.

```text
Landscape image, 2:1. Object sheet on the exact grid of the attached sheet: 4 columns by 2 rows of square cells. In every cell, the rat of the attached sheet's first cell as a flat pale lavender silhouette (#D9C2F0, no shading, no outline), in the same pose, size and place. On each silhouette only the clothes are drawn, in full colour, worn on its shoulders and chest as far as the cell shows: collar, lapels and shoulders. Nothing on the head. Left to right, top to bottom:
1. The mascot's navy business suit, white shirt and gold tie.
2. A red tracksuit top, zipped up, with white stripes on the shoulders.
3. A black tuxedo with a white shirt and a black bow tie.
4. A grey hoodie with the hood down behind the neck.
5. Teal hospital scrubs with a stethoscope round the neck.
6. A fluorescent yellow high-visibility vest over a navy T-shirt.
7. A white double-breasted chef's jacket.
8. A black leather jacket over a white T-shirt.
```

## 108. Outfits, for a life well lived

Save as `art/raw/brand/rat-outfit-02.png` — `rat.outfit.lab`, `rat.outfit.sweater`, `rat.outfit.hawaiian`, `rat.outfit.varsity`, `rat.outfit.robe`, `rat.outfit.kimono`, `rat.outfit.fur`, `rat.outfit.gold`

Attach `art/raw/brand/rat-body-01.png`.

```text
Landscape image, 2:1. Object sheet on the exact grid of the attached sheet: 4 columns by 2 rows of square cells. In every cell, the rat of the attached sheet's first cell as a flat pale lavender silhouette (#D9C2F0, no shading, no outline), in the same pose, size and place. On each silhouette only the clothes are drawn, in full colour, worn on its shoulders and chest as far as the cell shows. Nothing on the head. Left to right, top to bottom:
1. A white lab coat over a blue shirt, pens in the pocket.
2. A cosy cream knitted sweater with a cable pattern.
3. A loud Hawaiian shirt, red with yellow flowers.
4. A navy varsity jacket with cream sleeves.
5. A plush white hotel bathrobe.
6. A dark blue kimono with a white wave pattern.
7. A long fur coat with a wide collar, like a film star's.
8. A gold lamé jacket that shines: the outfit of someone who escaped the rat race.
```

## 109. Headwear, everyday

Save as `art/raw/brand/rat-hat-01.png` — `rat.hat.cap`, `rat.hat.beanie`, `rat.hat.beret`, `rat.hat.hardhat`, `rat.hat.cowboy`, `rat.hat.headphones`, `rat.hat.bandana`, `rat.hat.chef`

Attach `art/raw/brand/rat-body-01.png`.

```text
Landscape image, 2:1. Object sheet on the exact grid of the attached sheet: 4 columns by 2 rows of square cells. In every cell, the rat of the attached sheet's first cell as a flat pale lavender silhouette (#D9C2F0, no shading, no outline), in the same pose, size and place. On each silhouette only what it wears on its head is drawn, in full colour, sitting on the head between its ears as it would be worn, never covering the eyes. Left to right, top to bottom:
1. A red baseball cap, worn backwards.
2. A knitted emerald beanie with a cream pom-pom.
3. A black beret, tilted.
4. A yellow construction hard hat.
5. A brown cowboy hat.
6. Big navy headphones over its ears.
7. A red bandana tied round the head.
8. A tall white chef's hat.
```

## 110. Headwear, earned

Save as `art/raw/brand/rat-hat-02.png` — `rat.hat.tophat`, `rat.hat.crown`, `rat.hat.graduate`, `rat.hat.party`, `rat.hat.viking`, `rat.hat.flowers`, `rat.hat.wizard`, `rat.hat.halo`

Attach `art/raw/brand/rat-body-01.png`.

```text
Landscape image, 2:1. Object sheet on the exact grid of the attached sheet: 4 columns by 2 rows of square cells. In every cell, the rat of the attached sheet's first cell as a flat pale lavender silhouette (#D9C2F0, no shading, no outline), in the same pose, size and place. On each silhouette only what it wears on its head is drawn, in full colour, sitting on the head as it would be worn, never covering the eyes. Left to right, top to bottom:
1. A tall black top hat with a gold band.
2. A small gold crown with red gems, tilted on one ear.
3. A black graduation cap with a gold tassel.
4. A striped party hat with a pom-pom.
5. A horned viking helmet.
6. A crown of small spring flowers.
7. A pointed navy wizard hat with gold stars.
8. A glowing gold halo floating above the head.
```

## 111. Eyewear and the rest of the face

Save as `art/raw/brand/rat-eyes-01.png` — `rat.eyes.sunglasses`, `rat.eyes.round`, `rat.eyes.aviators`, `rat.eyes.monocle`, `rat.eyes.patch`, `rat.eyes.visor`, `rat.eyes.moustache`, `rat.eyes.heart`

Attach `art/raw/brand/rat-body-01.png`.

```text
Landscape image, 2:1. Object sheet on the exact grid of the attached sheet: 4 columns by 2 rows of square cells. In every cell, the rat of the attached sheet's first cell as a flat pale lavender silhouette (#D9C2F0, no shading, no outline), in the same pose, size and place. On each silhouette only the piece is drawn, in full colour, worn on its face where it would sit. Left to right, top to bottom:
1. Black sunglasses.
2. Thin round gold-rimmed glasses.
3. Mirrored aviator sunglasses.
4. A gold monocle on a chain.
5. A black eye patch.
6. A sleek futuristic visor across the eyes, glowing teal.
7. A curly black moustache under the nose.
8. Heart-shaped pink sunglasses.
```

## 112. Backdrops

Save as `art/raw/brand/rat-backdrop-01.png` — `rat.backdrop.stars`, `rat.backdrop.city`, `rat.backdrop.coins`, `rat.backdrop.chart`, `rat.backdrop.cheese`, `rat.backdrop.confetti`, `rat.backdrop.wheel`, `rat.backdrop.beach`

Attach `art/raw/brand/rat-body-01.png` for the grid only: nothing of the rat is drawn on this sheet.

```text
Landscape image, 2:1. Scene sheet on the exact grid of the attached sheet: 4 columns by 2 rows of square panels, separated by magenta gutters. Each panel is a calm square backdrop for a portrait: busy only at its edges and corners, quiet in the centre, where a rat will stand. No characters. Left to right, top to bottom:
1. A deep navy night sky with small gold stars.
2. A purple dusk with a row of lit city windows along the bottom.
3. Gold coins falling on dark green.
4. A rising stock chart line in teal on dark navy, with a faint grid.
5. A wedge of cheese pattern, tiled, on warm yellow.
6. Confetti in many colours on deep red.
7. A huge golden hamster wheel seen from the side, behind.
8. A sunny beach with palm leaves at the edges: life after the rat race.
```

## Where each goes

| # | File | What | Size |
|---|---|---|---|
| 105 | `brand/rat-body-01.png` | Body: 8 furs (the template) | 64×64 |
| 106 | `brand/rat-face-01.png` | Faces: calm, grin, smug, wink, shock, sleepy, fierce, tears | 64×64 |
| 107 | `brand/rat-outfit-01.png` | Outfits: suit, tracksuit, tuxedo, hoodie, scrubs, hi-vis, chef, leather | 64×64 |
| 108 | `brand/rat-outfit-02.png` | Outfits: lab, sweater, Hawaiian, varsity, robe, kimono, fur, gold | 64×64 |
| 109 | `brand/rat-hat-01.png` | Hats: cap, beanie, beret, hard hat, cowboy, headphones, bandana, chef | 64×64 |
| 110 | `brand/rat-hat-02.png` | Hats: top hat, crown, graduate, party, viking, flowers, wizard, halo | 64×64 |
| 111 | `brand/rat-eyes-01.png` | Eyewear: sunglasses, round, aviators, monocle, patch, visor, moustache, heart | 64×64 |
| 112 | `brand/rat-backdrop-01.png` | Backdrops: stars, city, coins, chart, cheese, confetti, wheel, beach | 64×64 |

Once a sheet is in, add its line to `tools/art/src/sheets.ts` (grid cut, `#D9C2F0` key for 106–111),
cut it with `pnpm -s art`, then `pnpm --filter @ratrace/web exec tsx scripts/sprites.ts`.
