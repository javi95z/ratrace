# Art prompt pack: v5

Four new cities: Tokyo, Moscow, Mexico City and Zurich. Each needs what the six cities before them
have: a skyline by night, by day, in a boom and in a crisis; a landmark icon; a crest; eleven homes
and a "for sale" sign; and a season seat that only that city sells.

Eleven sheets in all. Use the same ChatGPT project and the same **style block** (in
`v1-prompt-pack.md`). Attach the sheet named in each section as the style reference, and start each
message with `Match the attached sheet's style exactly.` The checks before saving are the same as in v1.

Save each sheet under the exact path given.

## Skylines

Four square sheets, one city to a strip, in the same order every time: Tokyo, Moscow, Mexico City,
Zurich. For the first one attach `art/raw/skylines/skylines-02.png`; for the other three attach the
first one as well, and ask for the same buildings in the same places.

The landmarks, used in all four:

```text
1. Tokyo: Tokyo Tower in red and white, the Tokyo Skytree needle, a cluster of Shinjuku skyscrapers, the Rainbow Bridge over the bay.
2. Moscow: the onion domes of St Basil's Cathedral, the red Kremlin wall and Spasskaya clock tower, one of the Seven Sisters wedding-cake towers, the glass towers of Moscow City.
3. Mexico City: the golden Angel of Independence on its column, the Torre Latinoamericana, the orange dome of the Palacio de Bellas Artes, the Torre Reforma, volcanoes faint on the horizon.
4. Zurich: the twin towers of the Grossmünster, the green spire of the Fraumünster, old houses along the Limmat river, the lake with snowy Alps behind.
```

### 69. Skylines by night

Save as `art/raw/skylines/skylines-09.png`

```text
Square image. Scene sheet: 1 column by 4 rows, 4 very wide panoramic panels. Each panel is a city skyline at night seen from across the water or a park, with gold lit windows, a deep navy sky with a few stars, and buildings fading to solid dark navy #141b33 along the bottom edge. Top to bottom:
1. Tokyo: Tokyo Tower in red and white, the Tokyo Skytree needle, a cluster of Shinjuku skyscrapers, the Rainbow Bridge over the bay.
2. Moscow: the onion domes of St Basil's Cathedral, the red Kremlin wall and Spasskaya clock tower, one of the Seven Sisters wedding-cake towers, the glass towers of Moscow City.
3. Mexico City: the golden Angel of Independence on its column, the Torre Latinoamericana, the orange dome of the Palacio de Bellas Artes, the Torre Reforma, volcanoes faint on the horizon.
4. Zurich: the twin towers of the Grossmünster, the green spire of the Fraumünster, old houses along the Limmat river, the lake with snowy Alps behind.
```

### 70. Skylines by day

Save as `art/raw/skylines/skylines-10.png`

```text
Square image. Scene sheet: 1 column by 4 rows, 4 very wide panoramic panels. Each panel is a city skyline in the golden hour just after sunrise, seen from across the water or a park: a pale gold and peach sky with a few flat cream clouds, buildings in warm cream, terracotta and grey with glass blue windows, long navy shadows, and buildings fading to solid dark navy #141b33 along the bottom edge. Same buildings, same order and same framing as the attached night skylines. Top to bottom: Tokyo, Moscow, Mexico City, Zurich.
```

### 71. Skylines in a boom

Save as `art/raw/skylines/skylines-11.png`

```text
Square image. Scene sheet: 1 column by 4 rows, 4 very wide panoramic panels. Each panel is a city skyline seen from across the water or a park, with buildings fading to solid dark navy #141b33 along the bottom edge. Match the attached skylines building for building. Boom: every window lit gold, construction cranes with red lights among the towers, fireworks small in a clear sky. Top to bottom: Tokyo, Moscow, Mexico City, Zurich.
```

### 72. Skylines in a crisis

Save as `art/raw/skylines/skylines-12.png`

```text
Square image. Scene sheet: 1 column by 4 rows, 4 very wide panoramic panels. Each panel is a city skyline seen from across the water or a park, with buildings fading to solid dark navy #141b33 along the bottom edge. Match the attached skylines building for building. Crisis: heavy rain in slanted lines, low grey cloud, two windows in three dark, one crane standing idle with no lights. Top to bottom: Tokyo, Moscow, Mexico City, Zurich.
```

## Homes

Four sheets, as `homes-bangkok` was drawn. Attach `art/raw/homes/homes-bangkok.png`. In every
sheet, cells 1 to 11 are `home.<city>.studio`, `.flat`, `.loft`, `.townhouse`, `.house`, `.duplex`,
`.chalet`, `.penthouse`, `.estate`, `.villa`, `.mansion`, and cell 12 is `home.<city>.sign`.

### 73. Homes of Tokyo

Save as `art/raw/homes/homes-tokyo.png`

```text
Square image. Object sheet: 4 columns by 3 rows, 12 buildings. Every building is a three-quarter exterior view at night with warm lit windows, standing alone with no street around it. Tokyo architecture throughout: narrow lots, tidy concrete, vending machines, paper lanterns, overhead wires and small neat gardens. Left to right, top to bottom:
1. A tiny studio in a two-storey "apaato" block in Koenji: an outdoor metal staircase, a row of identical doors, one window lit.
2. A flat in a white "mansion" block in Nakameguro, small balconies with futons airing and a cherry tree in front.
3. A loft in a converted Kuramae warehouse: dark timber, big steel windows, a small coffee bar on the ground floor with a blank sign.
4. A slim three-storey townhouse in Shimokitazawa, squeezed between neighbours, a bicycle by the door and potted plants on the steps.
5. A modern family house in Setagaya: white walls, a flat roof, a carport and a small maple in the garden.
6. A duplex at the top of a sleek Ebisu building with a roof terrace and a little bamboo screen.
7. A traditional wooden machiya-style retreat in the Hakone hills: dark timber, tiled roof, a steaming outdoor hot-spring bath.
8. A penthouse at the top of a Roppongi glass tower, Tokyo Tower glowing red in the distance.
9. A country estate in Karuizawa: a large timber lodge among tall larches, mist around it.
10. A villa in Hayama by the sea: low and modern, a pool facing the water and Mount Fuji faint behind.
11. A grand mansion in Den-en-chofu: a huge walled house with a tiled gate, pine trees shaped like clouds and stone lanterns.
12. A neat Japanese real-estate "FOR SALE" board on a stand, lettering shown only as blank shapes.
```

### 74. Homes of Moscow

Save as `art/raw/homes/homes-moscow.png`

```text
Square image. Object sheet: 4 columns by 3 rows, 12 buildings. Every building is a three-quarter exterior view at night with warm lit windows, standing alone with no street around it. Moscow architecture throughout: snow on the roofs, birch trees, Soviet blocks, Stalinist grandeur and new glass towers. Left to right, top to bottom:
1. A small studio in a five-storey "khrushchyovka" block in Biryulyovo: grey panels, one lit window, snow on the ledges.
2. A flat in a tall Soviet panel block in Maryino, glazed-in balconies each a different colour.
3. A loft in a converted red-brick factory at Krasny Oktyabr, tall arched windows and a chimney.
4. A townhouse in a new gated row in Kommunarka, identical beige houses with small fenced yards.
5. A wooden dacha-style house in Peredelkino with carved window frames, a birch grove and a vegetable patch under snow.
6. A duplex at the top of a pre-revolution building on the Patriarch's Ponds, ornate stucco and tall windows.
7. A log cabin in the forest by the Volga, smoke from the chimney and a banya hut beside it.
8. A penthouse at the top of a glass tower in Moscow City, the river far below.
9. A country estate in Barvikha: a large neoclassical house with columns behind high fir trees and a gatehouse.
10. A villa on the Rublyovka road: a modern glass-and-stone house, a heated pool steaming in the snow.
11. A grand mansion on the Ostozhenka: a restored 19th-century merchant's palace with yellow walls, white columns and wrought-iron gates.
12. A Moscow real-estate "FOR SALE" banner hung across a balcony rail, lettering shown only as blank shapes.
```

### 75. Homes of Mexico City

Save as `art/raw/homes/homes-mexico_city.png`

```text
Square image. Object sheet: 4 columns by 3 rows, 12 buildings. Every building is a three-quarter exterior view at night with warm lit windows, standing alone with no street around it. Mexico City architecture throughout: bright painted walls, bougainvillea, jacarandas, flat roofs with water tanks and colonial stone. Left to right, top to bottom:
1. A small studio on the roof of an Iztapalapa house: a single room beside the black water tanks, a string of bulbs.
2. A flat in a mid-century block in Narvarte, little balconies with plants and a jacaranda in purple bloom outside.
3. A loft in a converted art-deco building in La Roma, tall windows and a mural on the side wall.
4. A narrow colonial townhouse in Coyoacán painted cobalt blue, a heavy wooden door and bougainvillea spilling over the wall.
5. A family house in Ciudad Satélite with a red-tile roof, a car port and a small lawn.
6. A duplex at the top of a stylish Condesa building with a roof garden overlooking a park.
7. A weekend house in Valle de Bravo: white walls, a red-tile roof and a terrace over the lake.
8. A penthouse at the top of a Polanco tower, the Angel of Independence glowing far off.
9. A hacienda estate in Morelos: thick ochre walls, an arched portico, a fountain and palm trees.
10. A villa in Lomas de Chapultepec: a modernist house with a pink wall, a pool and tall cypress trees.
11. A grand mansion in San Ángel: a volcanic-stone colonial mansion with a courtyard, a fountain and a carved gate.
12. A bright Mexican "SE VENDE" style sign hand-painted on a board, lettering shown only as blank shapes.
```

### 76. Homes of Zurich

Save as `art/raw/homes/homes-zurich.png`

```text
Square image. Object sheet: 4 columns by 3 rows, 12 buildings. Every building is a three-quarter exterior view at night with warm lit windows, standing alone with no street around it. Zurich architecture throughout: clean modern lines, green shutters, steep roofs, flower boxes, the lake and the Alps. Left to right, top to bottom:
1. A small studio in a plain apartment block in Schwamendingen, bicycles neatly parked outside.
2. A flat in a turn-of-the-century block in Wiedikon with green shutters and window boxes of red geraniums.
3. A loft in a converted industrial hall in Zürich-West, a tram line in front and a large glass front.
4. A narrow townhouse in the old town, half-timbered, with a painted sign shape over the door and a lantern.
5. A family house in Küsnacht with a pitched roof, a neat lawn and a view of the lake.
6. A duplex at the top of a sleek Seefeld building with a terrace facing the lake.
7. A wooden chalet in the Alps above the city, snow on the roof, a balcony of carved timber and a stack of logs.
8. A penthouse at the top of a glass tower by the Prime Tower, the city lights below.
9. A lakeside estate on the Gold Coast: a large cream villa with a boathouse and its own jetty.
10. A modern villa on the Zürichberg: concrete and glass, a pool and the lake and Alps behind.
11. A grand mansion on the lake: a 19th-century patrician house with a slate roof, a park of old trees and an iron gate.
12. A tidy Swiss real-estate "FOR SALE" board on two posts, lettering shown only as blank shapes.
```

## Icons, crests and seats

### 77. A landmark for each city

Save as `art/raw/icons/icons-10.png` — `icon.city_tokyo`, `icon.city_moscow`, `icon.city_mexico_city`, `icon.city_zurich`

Attach `art/raw/icons/icons-05.png`.

```text
Square image. Object sheet: 2 columns by 2 rows, 4 small icons. Each is one bold simple landmark with a dark outline, readable at very small size. No letters or words anywhere. Left to right, top to bottom:
1. Tokyo Tower in red and white lattice.
2. St Basil's Cathedral: three colourful onion domes.
3. The golden Angel of Independence on top of its column.
4. The twin towers of the Grossmünster with a small snowy mountain behind.
```

### 78. A crest for each city

Save as `art/raw/badges/badges-05.png` — `crest.tokyo`, `crest.moscow`, `crest.mexico_city`, `crest.zurich`

Attach `art/raw/badges/badges-03.png`.

```text
Square image. Object sheet: 2 columns by 2 rows, 4 crests. Each is a heraldic shield in the same shape and gold rim as the attached crests, with one simple emblem inside. No letters or words. Left to right, top to bottom:
1. Tokyo: a pink cherry blossom over a red rising sun on white.
2. Moscow: a gold onion dome over a red field with a small white star.
3. Mexico City: an eagle on a cactus over a blue lake, on green.
4. Zurich: the city's diagonal blue-and-white split shield with a small gold key.
```

### 79. A season seat for each city

Save as `art/raw/items/items-07.png` — `item.member_sumo_tokyo`, `item.member_bolshoi_moscow`, `item.member_palco_mexico_city`, `item.member_golf_zurich`

Attach `art/raw/items/items-03.png`.

```text
Square image. Object sheet: 2 columns by 2 rows, 4 objects, each shown front-on. Left to right, top to bottom:
1. A box seat at the sumo: a square red floor cushion with a small low tray holding a teacup and a folded fan.
2. A season pass to the Bolshoi: a red velvet theatre box seat with gold trim and a small pair of opera glasses on it.
3. A private box at a football stadium: a padded leather seat behind a glass front, a pennant in green, white and red, and a small key on a ring.
4. A golf club membership: a white golf bag with clubs, a small Swiss-red tag hanging from it and a club badge shape.
```

## Where each goes

| # | File | What | Size |
|---|---|---|---|
| 69 to 72 | `skylines/skylines-09.png` to `-12.png` | The 4 skylines by night, by day, in a boom and in a crisis | 312×66 |
| 73 to 76 | `homes/homes-tokyo.png`, `-moscow`, `-mexico_city`, `-zurich` | 11 homes and a sign each | 128×128 |
| 77 | `icons/icons-10.png` | 4 city landmarks | 32×32 |
| 78 | `badges/badges-05.png` | 4 city crests | 64×64 |
| 79 | `items/items-07.png` | 4 season seats | 64×64 |

## Brand marks

### 80. Sign-in and company logos

Save as `art/raw/icons/logos-01.png`

Attach `art/raw/icons/icons-05.png`.

```text
Square image. Object sheet: 4 columns by 4 rows, 16 small logos. Each is the real brand mark redrawn as clean pixel art, flat colours, a dark outline only where the mark needs one to stand on a dark navy background, readable at very small size. Only the mark itself, never the company name written out, except where the mark is a single letter. Left to right, top to bottom:
1. Google: the four-colour "G" (red, yellow, green, blue).
2. Apple: the bitten apple in white.
3. Microsoft: the four coloured squares.
4. NVIDIA: the green eye swirl.
5. Amazon: the orange smile arrow.
6. Tesla: the red "T".
7. Inditex: the black "Z" of Zara on a cream square.
8. LVMH: the gold interlocked "LV" monogram.
9. Ferrari: the black prancing horse on a yellow shield.
10. Santander: the red flame.
11. Coca-Cola: a red disc with the white wave ribbon.
12. Bitcoin: the orange coin with the white "₿".
13. Ethereum: the grey-violet diamond, kept bluish grey (no purple).
14. Dogecoin: the gold coin with the shiba dog's face.
15. Toyota: the three silver ovals.
16. Nestlé: the nest with the bird and two chicks, in grey.
```

Where each goes: `logo.google`, `logo.apple`, `logo.microsoft`, `logo.nvidia`, `logo.amazon`, `logo.tesla`, `logo.inditex`, `logo.lvmh`, `logo.ferrari`, `logo.santander`, `logo.coca_cola`, `logo.bitcoin`, `logo.ethereum`, `logo.dogecoin`, `logo.toyota`, `logo.nestle`, 32×32. The Google mark replaces the one drawn in code on the sign-in button; the others go on the ticker badges of their assets, and the last two wait for those shares.
