# Art prompt pack: v16

Four sheets for what still borrows a drawing, or was drawn in a way that does not work:

- **Multiplayer** has no icons of its own: the front door's button wears the network skill's icon,
  and teasing a rival wears the mood icon. Sheet 113 gives the game with friends eight icons.
- **Rat ranks** are only a name and a bar. Sheet 114 gives each of the six ranks an emblem.
- **The rat's faces** (sheet 106) cannot be worn: the bodies of sheet 105 were drawn with eyes and a
  smile, and a face over them doubles both. Sheet 115 is the same bodies with the face left blank.
- **Two icons**: the retirement icon is drawn to the very edges of its square and looks cramped
  beside the others, and the new status line for grand homes has none. Sheet 116.

Use the same ChatGPT project and the same **style block** (in `v1-prompt-pack.md`). Start every
message with `Match the attached sheet's style and level of detail exactly.` The checks before
saving are the same as in v1.

## 113. Playing with friends

Save as `art/raw/icons/multiplayer-01.png` — `icon.multiplayer`, `icon.room_lobby`, `icon.room_ready`, `icon.room_rematch`, `icon.room_shout`, `icon.room_loan`, `icon.room_tease`, `icon.room_podium`

Attach `art/raw/icons/rules-02.png` as the style reference: icons of the same size and weight.

```text
Landscape image, 2:1. Object sheet: 4 columns by 2 rows, 8 icons, each a single bold object centred in its cell with clear space all round it, the same size and weight as the attached icons. Left to right, top to bottom:
1. Three small cartoon rats side by side, each in a different colour (gold, teal, coral), the middle one a little in front, all facing the viewer: a game with friends.
2. An open door with a warm light inside and two empty chairs waiting beside it: a game waiting to start.
3. A small grey rat giving a thumbs up, with a green tick in a circle beside it: ready.
4. Two curved arrows chasing each other in a circle around a single die: a rematch.
5. A red megaphone with three short sound lines coming out of it: a shout to the others.
6. Two paws shaking hands over a single gold coin: a loan between players.
7. A grey rat pulling a cheeky face, tongue out, one paw pointing to the side: teasing a rival.
8. A three-step winners' podium in gold, silver and bronze, a small star above the top step: the result.
```

## 114. Rat ranks

Save as `art/raw/badges/rat-ranks-01.png` — `rank.sewer`, `rank.office`, `rank.stock`, `rank.wall_street`, `rank.tycoon`, `rank.king`

Attach `art/raw/badges/badges-10.png` as the style reference: medallions of the same make.

```text
Landscape image, 3:2. Object sheet: 3 columns by 2 rows, 6 badges. Every badge is a round medallion of identical size with a gold rim and an enamel centre, one simple bold symbol in the middle, and the medallions grow grander from first to last: plain iron at first, then bronze, silver and gold, the last with small gems in its rim. Left to right, top to bottom:
1. Iron rim, dark green centre: a round sewer grate with a little rat tail curling out of it.
2. Bronze rim, grey centre: an office desk lamp over a small stack of papers.
3. Silver rim, navy centre: a candlestick chart climbing to the right.
4. Silver rim, deep blue centre: the bronze charging bull of Wall Street.
5. Gold rim, wine red centre: a black top hat with a gold band and a cane leaning on it.
6. Gold rim set with small red gems, royal purple centre: a gold crown with a tiny rat tail curling from under it.
```

## 115. The rat, with its face left blank

Save as `art/raw/brand/rat-body-02.png` — the same ids as `rat-body-01`, which this sheet replaces

Attach `art/raw/brand/rat-body-01.png`.

```text
Landscape image, 2:1. Redraw the attached sheet exactly: the same 4 columns by 2 rows, the same eight rats in the same furs, in exactly the same pose, size and place in every cell, pixel for pixel. The only change: the eyes, eyebrows and mouth are left out, and where they were the fur simply carries on, with its usual shading. Keep the ears, the pink nose and the whiskers exactly as they are. Nothing else changes.
```

Extra checks before saving: lay it over `rat-body-01` — nothing has moved; the face is bare fur.

Once it is in, the faces of sheet 106 become a layer of their own in the editor, and `rat-body-02`
takes the place of `rat-body-01` in `tools/art/src/sheets.ts`.

## 116. Two icons

Save as `art/raw/icons/icons-11.png` — `icon.retired`, `icon.estates`

Attach `art/raw/icons/rules-02.png` as the style reference.

```text
Landscape image, 2:1. Object sheet: 2 columns by 1 row, 2 icons, each a single bold object centred in its cell, smaller than its cell, with clear space all round it, the same size and weight as the attached icons. Left to right:
1. A green watering can tipped forward over a small potted seedling, a few drops falling: a life after work.
2. A big old-fashioned gold key on a ring with two smaller keys, a tiny villa roof engraved on its head: grand homes owned.
```

## Where each goes

| # | File | What | Size |
|---|---|---|---|
| 113 | `icons/multiplayer-01.png` | Game with friends, lobby, ready, rematch, shout, loan, tease, podium | 32×32 |
| 114 | `badges/rat-ranks-01.png` | Emblems of the six rat ranks | 64×64 |
| 115 | `brand/rat-body-02.png` | The eight furs without a face, replacing `rat-body-01` | 128×128 layers |
| 116 | `icons/icons-11.png` | Retirement (with room round it), grand homes | 32×32 |
