# Art prompt pack: v1

Thirty-eight sheets cover every v1 sprite: the first twenty-one, and seventeen added since (02b city seats, 04b homes, 06b, 06c and 06d icons, 10b portraits, 20b and 20c skylines by day, 22 to 30 more card scenes). The game is called The Rat Race.

## How to use

1. In ChatGPT, create a Project called "Rat Race art". Paste the **style block** below into the project instructions. If you prefer a plain chat, paste the style block before every prompt instead.
2. Generate **sheet 01 only**. Save it, then stop and have it reviewed. It becomes the style anchor.
3. For every later sheet, attach the approved sheet 01 image and start the message with: `Match the attached sheet's style exactly.` Then paste the sheet prompt.
4. Hand over each sheet in one of two ways: paste the image into the Claude chat and say which sheet it is (it gets filed for you as `.webp`), or download the original and save it under the exact path given. Do not screenshot, upscale, crop or edit it.
5. For a regeneration, hand over the new image and say which sheet it replaces.

### Check before saving

- Background is flat magenta with no shading.
- The number of objects or panels is right, and they are in the listed order.
- Nothing touches or crosses into a neighbouring cell.
- No stray text or numbers. Brand logos on products are fine.
- Pixels look the same size across the whole image.

If a sheet fails a check, reply in the same chat with what is wrong ("object 7 crosses into cell 8, redo the sheet") rather than starting over.

## Style block

```text
You are generating sprite sheets for a pixel-art video game. Follow these rules in every image.

STYLE
- Detailed modern pixel art, like a high-quality 32-bit era game. Mood: a city at night, cool navy shadows, warm golden light.
- Crisp, hard-edged square pixels of one consistent size across the whole image. No anti-aliasing, no blur, no soft gradients, no glow effects, no film grain, no 3D render look.
- Shading in flat bands of colour, 3 to 4 tones per material. Light comes from the top left.
- Every object has a dark outline in near-black navy (#1a1c2c).
- Limited palette of about 32 colours. Main colours: deep navy #141b33 #1f2a4d #263566, cream #f4f1e4, gold #f2c14e #c8891e #ffe9a8, red #d1495b #8f2d3f, emerald #2a9d8f #1f6f66, glass blue #9ad1d4 #3b6ea5, greys #4b5269 #8b93a7 #c9cfdc, skin #e8b796 #c98f6b, brown #4a3228.

OBJECT SHEETS
- Background is flat solid pure magenta #FF00FF with no shading, no texture, no floor and no cast shadows.
- Objects sit in an invisible grid of equal cells. Do not draw grid lines, borders or frames.
- Each object is centred in its cell, fills about 70% of the cell, and never touches or crosses into a neighbouring cell.
- Any water, ground or backdrop that belongs to an object is a small patch with a clean hard edge: no fading, no scattered pixels.

SCENE SHEETS
- Each panel is a full illustrated night-time scene with its own background.
- Panels are equal rectangles, separated from each other and from the image edge by solid magenta #FF00FF gutters about 24 pixels wide.
- Keep the main subject in the centre of each panel. Any people are small generic figures.
- Screens, signs and papers show abstract shapes only.

ALWAYS
- Never use magenta, fuchsia, hot pink or purple inside any object or panel.
- Real brand logos and brand marks are allowed where they belong on a product. Apart from those: no text, letters, numbers, watermarks, signatures, labels or captions. Watch dials, bezels, screens and gauges use plain tick marks, dots and bars only.
- All artwork shown inside frames or on screens is an original design, never a copy of an existing artwork.
```

## Object sheets

### 01. Status items A (style anchor)

Save as `art/raw/items/items-01.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 objects, each shown front-on. Left to right, top to bottom:
1. Retro rectangular digital wristwatch in black resin with a small blank grey screen showing two plain dark bars.
2. Steel sports watch with a round-cornered barrel-shaped case, integrated bracelet and dark green waffle-textured dial. Clearly simpler than objects 5 and 6.
3. Steel chronograph watch, black dial with three small subdials, black bezel with plain tick marks, steel bracelet.
4. Steel dive watch, black dial with round hour markers, black rotating bezel with plain tick marks and dots, three-link steel bracelet.
5. Steel luxury watch with an octagonal bezel held by eight small screws, blue checkered dial, integrated bracelet.
6. Rose-gold luxury watch with a rounded-octagon porthole-shaped case, chocolate-brown dial with horizontal grooves, integrated rose-gold bracelet.
7. Modern smartphone seen from the back, titanium grey, three camera lenses in a square cluster.
8. Thin aluminium laptop, open, dark screen with a soft reflection.
9. Tall white game console with a black centre and curved side fins, with a white controller beside it.
10. Plain black blazer on a wooden hanger.
11. Navy polo shirt on a wooden hanger.
12. Pair of black leather loafers with a gold horse-bit buckle.
13. Brown duffel travel bag in a two-tone checkerboard pattern with tan leather handles.
14. Structured trapezoid leather handbag in orange-tan, flap closure, two rolled handles, small gold padlock on the front strap.
15. Street-art stencil print in a thin black frame, an original design: a rat in a suit carrying a briefcase, black stencil on white, with a red tie as the only colour.
16. Cubist line-drawing portrait in a wooden frame: an abstract face in bold black lines with a few flat colour blocks on cream paper.
```

### 02. Status items B

Save as `art/raw/items/items-02.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 objects. Left to right, top to bottom:
1. Small blue and yellow cabin suitcase with a boarding pass tucked in the handle.
2. Beach club vignette: white sunbed under a straw parasol with a cocktail, orange sunset disc and a small hard-edged strip of sea behind.
3. Business-class airline seat pod, cream leather with gold trim, lie-flat, champagne glass on the side table.
4. Overwater bungalow on wooden stilts with a thatched roof over a small hard-edged patch of turquoise lagoon.
5. Orange dumbbell with a small key fob.
6. Green velvet armchair beside a brass floor lamp and a small table with a cocktail.
7. Brushed platinum-coloured payment card with a gold chip, tilted, with a glint of light.
8. White stadium seat with a white and gold scarf draped over it and a football beside it.
9. White motor yacht, about 25 metres, side view, on a small hard-edged patch of dark water.
10. Small white private jet, side view, with its stairs lowered.
11. Black graduation mortarboard with a gold tassel resting on a rolled diploma tied with red ribbon.
12. Rangefinder-style camera in black and silver.
13. White virtual-reality headset with a dark curved visor.
14. Pair of high-top basketball sneakers in red, black and white.
15. Leather golf bag with club heads showing.
16. Wooden crate holding three dark wine bottles with cream labels.
```

### 02b. City seats

Save as `art/raw/items/items-03.png`

```text
Landscape 3:2 image. Object sheet: 3 columns by 2 rows, 6 objects, each shown front-on. Each is a small still life that says "a regular's seat" in one city. Left to right, top to bottom:
1. London football: a red stadium seat with a red and white knitted scarf draped over it and a classic football resting against its leg.
2. New York basketball: two courtside folding chairs in royal blue with orange trim, an orange basketball on one of them.
3. Dubai beach club: a white sun lounger with a striped gold and white towel, under a cream parasol, a small patch of pale sand with a hard edge beneath it.
4. Singapore grand prix: a red and white racing helmet resting on a folded chequered flag, with a gold lanyard pass beside it.
5. Bangkok muay thai: a pair of red boxing gloves hanging by their laces from a corner post of a ring, with a braided blue and gold headband on top of the post.
6. Opera house: a red velvet theatre armchair with a gold frame, a pair of small brass opera glasses on its seat.
```

### 03. Cars

Save as `art/raw/cars/cars-01.png`

```text
Square image. Object sheet: 2 columns by 4 rows, 8 cars. Every car is an exact side view facing right, wheels on the same baseline within its cell, no ground and no shadow. Left to right, top to bottom:
1. SEAT Ibiza in red: small five-door supermini hatchback.
2. Toyota Corolla in white: compact family hatchback.
3. Volkswagen Golf GTI in grey: hot hatch with red brake calipers and a thin red line across the grille.
4. Tesla Model 3 in pearl white: electric saloon with a smooth nose and a dark glass roof.
5. BMW M3 in deep green: muscular sports saloon with flared wheel arches and four exhaust tips.
6. Porsche 911 in silver: rear-engined coupé with a sloping fastback roofline and round headlights.
7. Lamborghini Aventador in bright red: very low, sharp wedge-shaped supercar with large side air intakes.
8. Mercedes G-Class in matte black: boxy luxury off-roader with a spare wheel on the back.
```

If ChatGPT declines a line because of the brand name, delete the name from that line and keep the description.

### 04. Homes

Save as `art/raw/homes/homes-01.png`

```text
Square image. Object sheet: 3 columns by 3 rows, 9 buildings. Every building is a three-quarter exterior view at night with warm lit windows, standing alone with no street around it. Left to right, top to bottom:
1. Shabby narrow three-storey shared house, peeling paint, one small lit window, bins by the door.
2. Plain five-storey 1970s apartment block, laundry on one balcony, a single flat lit.
3. Small modern apartment building with one compact glass-fronted flat lit, tidy entrance.
4. Handsome classic European city apartment building, stone facade, wrought-iron balconies, several warm windows.
5. Detached two-storey family house with a pitched roof, small garden, garage and warm windows.
6. Top section of a sleek glass tower: a duplex penthouse with a terrace and a glowing rooftop pool.
7. Sprawling modern luxury villa in white cubic volumes with an infinity pool, palm trees and uplighting.
8. Single underground parking space with yellow floor lines and a roller door.
9. Small ground-floor shop unit with a striped awning and a lit display window.
```

### 04b. Homes B

Save as `art/raw/homes/homes-02.png`

```text
Square image. Object sheet: 3 columns by 3 rows, 9 buildings. Every building is a three-quarter exterior view at night with warm lit windows, standing alone with no street around it. Left to right, top to bottom:
1. Converted brick warehouse loft: two tall storeys, huge black-framed factory windows glowing warm, a round water tank on the roof.
2. Narrow three-storey terraced townhouse: brick front, a bay window, front steps with an iron railing, a lit lantern by the door.
3. Modern duplex: two stacked glass-fronted floors with a wide terrace, potted olive trees and warm light inside.
4. Mountain chalet with a steep dark roof, a stone base, a timber balcony, a small lit pool and two pine trees.
5. Country estate: a long stone farmhouse with a clay-tile roof, a gravel drive lined with cypress trees, a small vineyard patch and a lit porch.
6. Grand mansion: a symmetrical three-storey palace front with columns, tall arched windows all lit, a round fountain and clipped hedges.
7. One floor of a glass office building, shown as a single cut slab: rows of desks and glowing screens with abstract shapes behind the glass.
8. Industrial warehouse unit: a wide corrugated-metal shed with two roller doors, one open and lit, a forklift and stacked pallets.
9. Whole five-storey apartment block: a modern brick building with twelve small balconies, most windows lit, a glass entrance.
```

### 05. Finance icons

Save as `art/raw/icons/icons-01.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 icons. These must stay readable when shrunk to 32 by 32 pixels: very simple, bold, chunky shapes, thick outlines, 3 to 4 colours each, no fine detail. Left to right, top to bottom:
1. Brown leather wallet.
2. Piggy bank with a coin dropping in.
3. Rolled certificate scroll with a red wax seal and ribbon.
4. Pie chart in four coloured segments.
5. Rising zigzag line chart with an upward arrow.
6. Gold coin stamped with a hexagon circuit pattern.
7. Gold bar.
8. Small house with a key in front.
9. Hourglass with gold sand.
10. Shopfront with a striped awning.
11. House chained to an iron ball.
12. Hand holding out a banknote.
13. Credit card with a gold chip.
14. Government building with columns and a pediment.
15. Shield with a heart in the centre.
16. Yellow lightning bolt.
```

### 06. Interface icons

Save as `art/raw/icons/icons-02.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 icons. These must stay readable when shrunk to 32 by 32 pixels: very simple, bold, chunky shapes, thick outlines, 3 to 4 colours each, no fine detail. Left to right, top to bottom:
1. Gold coin with a plain raised rim.
2. Green arrow pointing up.
3. Gold crown with red jewels.
4. Open book.
5. Brown briefcase.
6. Two adults and a child as simple figures.
7. Globe with a red map pin.
8. Folded newspaper.
9. Speedometer gauge with the needle to the right.
10. Thermometer with red liquid.
11. Bank building with a clock face showing only hands.
12. Calendar page with a red top band and blank squares.
13. Grey padlock, closed.
14. Gold star.
15. Grey cog wheel.
16. Gold trophy cup.
```

### 06b. Lifestyle icons

Save as `art/raw/icons/icons-03.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 icons. These must stay readable when shrunk to 32 by 32 pixels: very simple, bold, chunky shapes, thick outlines, 3 to 4 colours each, no fine detail. Left to right, top to bottom:
1. Steaming bowl of noodles with two chopsticks.
2. Brown paper grocery bag with a baguette and green leaves sticking out.
3. Glass of red wine beside a silver serving dome.
4. Champagne bottle with the gold cork flying off.
5. Single bed with a blue blanket and a white pillow.
6. Green sofa with a tall floor lamp beside it.
7. Red heart with a white medical cross in the centre.
8. Small house under an open red umbrella.
9. Red and white lifebuoy ring.
10. Gold balance scales, level.
11. Alarm clock with a yellow crescent moon behind it.
12. Black graduation cap resting on a closed blue book.
13. Magnifying glass over a sheet of paper with plain lines.
14. Factory with one chimney and a green arrow rising beside it.
15. Moving van seen from the side, cream body, navy cab.
16. Open door in a dark wall with warm gold light pouring out.
```

### 06c. Family icons

Save as `art/raw/icons/icons-04.png`

```text
Landscape 2:1 image. Object sheet: 4 columns by 2 rows, 8 icons. These must stay readable when shrunk to 32 by 32 pixels: very simple, bold, chunky shapes, thick outlines, 3 to 4 colours each, no fine detail. People are shown as plain bust silhouettes with a round head and shoulders, no faces. Left to right, top to bottom:
1. One bust in navy with a cream collar, alone.
2. Two busts side by side, one navy and one emerald, with a small red heart between their heads.
3. Two busts side by side, one navy and one emerald, shoulders overlapping, no heart.
4. Two interlocked gold wedding rings, one with a small white gem.
5. A baby's feeding bottle in cream and glass blue with a gold teat cap.
6. A small child's bust in gold with a red school backpack strap over one shoulder.
7. A taller, thin bust in emerald wearing grey headphones.
8. Four busts in a row, two tall at the sides and two small between them, in navy, emerald, gold and red.
```

### 06d. City icons

Save as `art/raw/icons/icons-05.png`

```text
Landscape 3:2 image. Object sheet: 3 columns by 2 rows, 6 icons. These must stay readable when shrunk to 32 by 32 pixels: very simple, bold, chunky shapes, thick outlines, 3 to 4 colours each, no fine detail. Each icon is one landmark, seen front-on, with gold lit windows where it has any. Left to right, top to bottom:
1. Madrid: the Puerta de Alcalá, a cream stone gate with three round arches and two square side openings.
2. London: the Elizabeth Tower clock tower, cream stone with a gold clock face showing plain tick marks.
3. New York: the Statue of Liberty from the waist up, pale emerald, torch raised with a gold flame.
4. Dubai: the Burj Al Arab hotel, a white sail-shaped tower with a glass blue edge.
5. Singapore: the three Marina Bay Sands towers in grey joined by a long navy deck across the top.
6. Bangkok: the Wat Arun temple spire, cream with red and gold bands, stepped and pointed.
```

### 07. Achievement badges A

Save as `art/raw/badges/badges-01.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 badges. Every badge is a round medallion of identical size with a dark navy enamel centre, a gold rim unless stated, and one simple bold symbol in the centre. Left to right, top to bottom:
1. Bronze rim. Small stack of coins.
2. Stack of gold bars with a sparkle.
3. Stack of gold bars beside a stopwatch.
4. Large cut diamond on a gold base.
5. Broken chain, two links snapped apart.
6. Credit card cut in half by scissors.
7. Hamster wheel with a small rat stepping out of it.
8. Silver rim. Hamster wheel with silver wings.
9. Hamster wheel with gold wings and a lightning bolt.
10. Hammock between two palm trees with coins falling.
11. Single paper certificate with a green sprout growing from it.
12. Pie chart in five differently coloured segments.
13. Line chart that dips and recovers in a V shape, with a green arrow.
14. Two hands holding a diamond, with a snowflake above.
15. Three small houses in a row, each with a key.
16. Ladder whose rungs are rolled scrolls.
```

### 08. Achievement badges B

Save as `art/raw/badges/badges-02.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 badges. Every badge is a round medallion of identical size with a dark navy enamel centre, a gold rim unless stated, and one simple bold symbol in the centre. Left to right, top to bottom:
1. Globe with a halo above it.
2. Wristwatch resting on a small cushion.
3. Red supercar seen from the front inside a laurel wreath.
4. Top of a glass tower with a star above.
5. Crown inside a laurel wreath.
6. Open treasure chest overflowing with objects.
7. Garage with three closed doors.
8. Globe with three red map pins.
9. Palm tree, a very tall needle-shaped tower and a sun.
10. House with four simple figures in front.
11. Graduation mortarboard inside a laurel wreath.
12. Handshake above a small shopfront with a coin.
13. Umbrella under a storm cloud with a small line chart beneath.
14. Bronze rim, cracked. Empty open wallet with a moth flying out.
15. Grey rim. Grey closed padlock.
16. Gold star with rays.
```

### 09. Portraits A

Save as `art/raw/portraits/portraits-01.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 bust portraits (head and shoulders), each turned slightly to the right with a calm, friendly expression. Each ROW is one person shown at four ages, left to right: about 22, 32, 45 and 58. Along a row, face shape, skin tone and key features stay identical; only signs of age, hairstyle and clothes change.
Row 1: a nurse. Woman with light-brown skin and dark hair in a bun, teal scrubs, stethoscope around her neck. By 58: grey streaks, a cardigan over the scrubs.
Row 2: a software engineer. Man with pale skin, messy dark hair and glasses, grey hoodie, headphones around his neck. By 58: short beard, greying hair, blazer over a t-shirt.
Row 3: a civil servant. Woman with olive skin and a brown bob haircut, cream blouse, plain lanyard. By 58: reading glasses, grey bob, tailored jacket.
Row 4: a delivery rider. Young man with brown skin, cycling helmet, orange windbreaker, straps of an insulated backpack. By 58: no helmet, short grey hair, smart casual jacket.
```

### 10. Portraits B

Save as `art/raw/portraits/portraits-02.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 bust portraits (head and shoulders), each turned slightly to the right with a calm, friendly expression. Each ROW is one person shown at four ages, left to right: about 22, 32, 45 and 58. Along a row, face shape, skin tone and key features stay identical; only signs of age, hairstyle and clothes change.
Row 1: an heir. Man with fair skin and slicked-back blond hair, pastel sweater draped over his shoulders, white shirt. By 58: silver hair, navy blazer, silk scarf.
Row 2: a newcomer from abroad. Woman with dark skin and long braids, denim jacket, backpack strap on one shoulder. By 58: short natural hair with grey, confident look, elegant blazer.
Row 3: a junior banker. Man with East Asian features and neat black hair, white shirt, dark tie, tired eyes. By 58: grey temples, three-piece suit.
Row 4: a doctor. Woman with medium-brown skin and wavy black hair tied back, white coat over blue shirt. By 58: grey-streaked hair, glasses, white coat.
```

### 10b. Portraits C

Save as `art/raw/portraits/portraits-03.png`

```text
Square image. Object sheet: 4 columns by 4 rows, 16 bust portraits (head and shoulders), each turned slightly to the right with a calm, friendly expression. Each ROW is one person shown at four ages, left to right: about 22, 32, 45 and 58. Along a row, face shape, skin tone and key features stay identical; only signs of age, hairstyle and clothes change.
Row 1: a man starting over after going broke. Man with tan skin, short brown curly hair and light stubble, worn olive work jacket over a plain grey t-shirt, tired but determined eyes. By 58: grey curls, trimmed grey beard, clean navy overshirt, relaxed smile.
Row 2: a startup founder. Woman with warm brown skin and a short black pixie cut, mustard turtleneck, small gold hoop earrings, a laptop sticker pin on her collar. By 58: silver pixie cut, round glasses, black blazer over the turtleneck.
Row 3: a crypto trader kid. Young man with South-East Asian features, bleached blond undercut, black oversized hoodie with a small orange coin logo, thin chain necklace, wireless earbuds. By 58: natural black hair greying at the sides, no earbuds, dark bomber jacket over a white t-shirt.
Row 4: a digital nomad. Woman with freckled fair skin and long auburn hair in a loose ponytail, linen shirt with rolled sleeves, sunglasses pushed up on her head, light tan. By 58: grey-streaked auburn hair cut to the shoulders, light scarf, linen blazer.
```

## Scene sheets

Card scenes use a landscape image with 2 columns and 3 rows. Each panel is roughly 2.4 times wider than tall.

### 11. Card scenes 1

Save as `art/raw/cards/cards-01.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Office desk beside a floor-to-ceiling window at night, monitor glowing, city lights beyond.
2. Two people shaking hands across a desk, one holding a sealed envelope, warm lamp light.
3. Cardboard box of personal belongings and a pot plant on an empty desk in a dark open-plan office.
4. Airport departure hall at night, a traveller with a suitcase under a large departures board.
5. Library desk with stacked books, a green banker's lamp and an open notebook.
6. Graduation caps thrown into the air in front of a university building at dusk.
```

### 12. Card scenes 2

Save as `art/raw/cards/cards-02.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Kitchen table at night with a laptop showing a video lesson, a mug and handwritten notes.
2. Small shopfront at night with a striped awning and a warm lit window.
3. Cosy bar interior: wooden counter, beer taps, stools, a glowing shelf of bottles.
4. Garage start-up: two desks with laptops, a whiteboard covered in diagrams, a bicycle on the wall.
5. Room stacked with cardboard parcels, a tape gun, a label printer and a laptop.
6. Dark bedroom, a hand holding a phone that shows a glowing green line chart.
```

### 13. Card scenes 3

Save as `art/raw/cards/cards-03.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Trading desk with four monitors of green and red candlestick charts and a coffee cup.
2. Giant gold coin with a dog's face rocketing upward over a crowd of tiny cheering figures at night.
3. Man in a sharp suit in a dim alley opening a briefcase that glows gold, his face in shadow.
4. Bank vault door frozen in ice with icicles, a phone on the floor showing a padlock.
5. Hand holding keys in front of an apartment door in a warm-lit hallway.
6. Empty room with moving boxes, a rolled rug, a bare bulb and a city window.
```

### 14. Card scenes 4

Save as `art/raw/cards/cards-04.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Living room flooded ankle-deep, sofa and standing lamp, light reflecting on the water.
2. Apartment building facade covered in scaffolding and tarpaulins, lit by work lamps.
3. Low red sports car parked under a streetlight on a wet street, city behind.
4. Beach club at sunset: white sunbeds, straw parasols, a DJ booth, orange sky over the sea.
5. Shop window at night with one glowing smartphone on a pedestal and a queue of silhouettes outside.
6. Luxury boutique window with a single wristwatch on a velvet stand under a spotlight.
```

### 15. Card scenes 5

Save as `art/raw/cards/cards-05.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Nightclub booth: table with a champagne bottle and sparklers behind a velvet rope.
2. Candlelit restaurant table for two by a window, two wine glasses, city lights outside.
3. Wedding arch of flowers and string lights in a garden at dusk, two small figures beneath.
4. Nursery with a crib, a hanging star mobile, a night light and the moon through the window.
5. Framed family photo torn in half on a table beside two separate sets of keys.
6. Family dinner table seen from above, many plates and hands, one warm lamp.
```

### 16. Card scenes 6

Save as `art/raw/cards/cards-06.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Hospital corridor at night with a wheeled bed and a glowing nurses' station.
2. Gym at night: rack of dumbbells, a bench, a mirror, a city window.
3. Office worker asleep head-down on a desk surrounded by coffee cups, dawn light through blinds.
4. Lottery drum full of plain white balls with a ticket and falling confetti.
5. Car broken down on a roadside at night, bonnet open, steam rising, warning triangle behind.
6. Open envelope with banknotes fanning out on a doormat in a warm hallway.
```

### 17. Card scenes 7

Save as `art/raw/cards/cards-07.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Casino roulette table with stacks of chips on green felt under a low lamp.
2. Electronics shop window full of screens all showing a plunging red chart, one passer-by watching.
3. Grand central bank building with columns and flags at night, wide steps in front.
4. Empty city street with shuttered shops and a single streetlight, one small figure wearing a face mask.
5. Server room corridor with blue-lit racks and a glowing computer chip on a pedestal.
6. Queue of anxious people outside a bank branch at night, shutters half down.
```

### 18. Card scenes 8

Save as `art/raw/cards/cards-08.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. Desk piled with receipts and folders, a calculator, a pen and a desk lamp.
2. Inspector in a trench coat holding a folder, seen as a silhouette through a frosted glass office door.
3. Older couple on a bench on a hill overlooking the city at sunset.
4. Newsroom wall of screens showing abstract charts and maps.
5. Balcony at sunrise over the city, a coffee cup on the railing.
6. Young adult with a backpack seen from behind, facing a glittering city skyline at dusk.
```

### 22. Card scenes 9: work

Save as `art/raw/cards/cards-09.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A dark office corridor at night, a frosted glass door with warm light behind it, a lone figure with a raised hand about to knock.
2. A glass meeting room at night: one figure standing at a whiteboard of abstract charts, five seated figures around the table looking up.
3. A laptop glowing on a kitchen table at night beside a coffee mug and a sleeping cat, a city window behind.
4. The grand marble lobby of a famous company's tower, a huge abstract emblem on the wall, one small figure walking to the reception desk.
5. An open-plan office at night, a tall figure with crossed arms looming over one desk, a small storm cloud above their head, colleagues ducking behind monitors.
6. A figure on a rooftop terrace at night taking a phone call, turned away from the office party behind the glass, the skyline beyond.
```

### 23. Card scenes 10: deals and careers

Save as `art/raw/cards/cards-10.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A long boardroom table with a thick contract and a gold pen, an open briefcase beside it, two chairs pushed back, the skyline in the window.
2. A bank desk: two figures side by side signing the same sheet of paper, a banker opposite sliding a second form across.
3. A crossroads on a night street with a signpost of two blank arrows: one way to glass bank towers, the other to a low brick office; a figure with a bag deciding.
4. An office desk with a framed certificate with an ornate abstract border and a gold seal, an employee lanyard draped over its corner.
5. A desk with two offer letters side by side: a stack of gold coins on one, a small rising line chart on the other, a pen lying between them.
6. An aircraft business-class cabin at night: a wide reclined seat with a blanket and a glass of champagne, stars in the oval window.
```

### 24. Card scenes 11: money and tax

Save as `art/raw/cards/cards-11.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A lawyer's desk with a legal document, two fountain pens and two wedding rings resting on the paper, a green lamp.
2. A front door at night with an open letterbox, a bright cream envelope sticking out and a few gold coins spilling onto the doormat.
3. A supermarket shelf at night, a hand sticking a taller red price tag over an older one, a nearly empty shopping basket on the floor.
4. A small accountant's office: an adviser in glasses behind a desk of tall folder stacks and a calculator, an empty client's chair.
5. A large ceramic piggy bank on a desk with a gold coin dropping in, an hourglass and a wall calendar of plain squares beside it.
6. A roadside speed camera flashing white at a car passing at night, motion streaks on the wet road.
```

### 25. Card scenes 12: investing

Save as `art/raw/cards/cards-12.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A giant soap bubble floating over a tech campus at night with tiny glowing gadgets inside it, a crowd of small figures looking up.
2. An apartment block cut into coloured jigsaw pieces, many small figures on the street each holding up one piece.
3. A flashy presenter in sunglasses on a small stage under a ring light, a rented sports car behind him and screens of rising arrows.
4. A rocket shaped like a gold coin lifting off from a city rooftop at night, a crowd below holding up glowing phones.
5. A snow-covered city street, a giant gold coin frozen in a block of ice in a snowdrift, icicles hanging from a shuttered kiosk.
6. A phone glowing on a bedside table in a dark room, a message bubble on its screen with a fish hook in it, a bank card lying next to the phone.
```

### 26. Card scenes 13: housing

Save as `art/raw/cards/cards-13.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A tidy spare bedroom with a made bed, folded towels, a small welcome card on the pillow and a suitcase by the door.
2. A letter pinned to an apartment door with a large red upward arrow drawn on it, hallway light, a doormat.
3. The open door of an emptied flat, a mailbox stuffed with unopened envelopes, a set of keys left on the bare floor.
4. A row of terraced houses at night, each with a blank sale board and a red downward arrow on it, dark windows, one cracked wall.
5. An estate agent hammering a blank board with a red diagonal band into the ground outside an apartment building, a tenant watching from a lit window.
6. A bank desk with brass scales: a padlock on one pan and a wavy arrow on the other, a small model house and papers beside them.
```

### 27. Card scenes 14: homes and cars

Save as `art/raw/cards/cards-14.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. An older couple in front of a small cosy cottage with a lit window, a large family house and a removal van behind them.
2. A sales suite with a glossy architectural model of a tower on a table, a brochure, and cranes over the desert through the window.
3. A car showroom at night, a modest hatchback under spotlights, a salesperson with a clipboard, price cards showing plain bars.
4. A grey-haired figure lifting a home garage door to reveal a silver sports coupe under a single hanging bulb.
5. Giant gold scissors cutting a long paper ribbon in front of the columns of a central bank, confetti in the air.
6. A shop entrance with its shutter half up, a crowd of small figures rushing in with trolleys, red banners with plain stripes.
```

### 28. Card scenes 15: learning and business

Save as `art/raw/cards/cards-15.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A tiered business-school lecture theatre, a lecturer beside a screen with an abstract bar chart, students with open laptops.
2. A family car with its boot open and full of boxes in front of a university residence, a teenager carrying a desk lamp.
3. An evening classroom: a small group at desks wearing headphones, a teacher pointing at a board of plain colour-band flags.
4. A converted loft classroom late at night, rows of laptops showing coloured bars, tired students, pizza boxes on a table.
5. A phone standing upright on a desk showing a plain square app tile, a small rocket trail rising out of the screen, sticky notes on the wall.
6. A café table at night with a napkin covered in an abstract diagram, two coffee cups, one figure leaning in and gesturing.
```

### 29. Card scenes 16: family and health

Save as `art/raw/cards/cards-16.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A notary's office: an old wooden chest, a framed portrait with a black ribbon across one corner, a sealed document on the desk.
2. An office desk with a payslip marked by a big gold star, confetti falling, silhouettes of colleagues clapping.
3. A writing desk with a fountain pen, a sealed envelope with red wax, family photo frames and a warm lamp.
4. A dentist's chair under a bright round lamp, a tray of instruments and a large model tooth on the counter.
5. A five-a-side pitch under floodlights, a player sitting on the turf holding an ankle, a ball nearby, a teammate kneeling.
6. A child with a backpack between two parents at a fork in the path: an ornate school with a crest on one side, a plain modern school on the other.
```

### 30. Card scenes 17: life, and two for later

Save as `art/raw/cards/cards-17.png`

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. Left to right, top to bottom:
1. A sibling on a doorstep in the rain with a duffel bag and an awkward smile, warm hall light spilling from the open door.
2. A wedding arch of flowers on a tropical beach at dusk, rows of white chairs, string lights, suitcases to one side.
3. The back room of a boutique behind a velvet rope: racks of clothes, handbags on lit shelves, a host holding the curtain open.
4. A crowded metro platform at night, a hooded figure slipping away with a glowing phone, the owner looking at an empty hand.
5. A wood-panelled courtroom at night, an empty judge's bench with a gavel, two tables facing it, one lamp lit.
6. A night street market with striped awnings, strings of bulbs, crates of fruit and a few small figures browsing.
```

### Which card each new scene is for

None of these is wired yet: a card keeps the scene it shares until its own is drawn. When a sheet lands, point the card at its scene in `cardArt`.

| Scene | Card | Sheet |
|---|---|---|
| `card.boss_door` | `career_raise` | cards-09 |
| `card.meeting_room` | `career_become_manager` | cards-09 |
| `card.kitchen_laptop` | `biz_freelance_gig` | cards-09 |
| `card.tower_lobby` | `career_big_offer` | cards-09 |
| `card.angry_boss` | `career_toxic_boss` | cards-09 |
| `card.headhunter_call` | `career_headhunter` | cards-09 |
| `card.contract_signing` | `biz_acquisition` | cards-10 |
| `card.bank_cosign` | `fam_cosign` | cards-10 |
| `card.two_ladders` | `career_switch` | cards-10 |
| `card.share_certificate` | `inv_share_plan` | cards-10 |
| `card.shares_or_salary` | `career_shares_vs_salary` | cards-10 |
| `card.business_cabin` | `life_upgrade` | cards-10 |
| `card.prenup` | `fam_prenup` | cards-11 |
| `card.tax_refund` | `luck_tax_refund` | cards-11 |
| `card.price_tags` | `world_inflation` | cards-11 |
| `card.advisor_office` | `tax_advisor` | cards-11 |
| `card.piggy_bank` | `tax_pension_topup` | cards-11 |
| `card.speed_camera` | `luck_speeding_fine` | cards-11 |
| `card.tech_bubble` | `world_tech_bubble` | cards-12 |
| `card.crowd_building` | `inv_crowdfunding` | cards-12 |
| `card.trading_guru` | `inv_guru_course` | cards-12 |
| `card.crypto_rocket` | `world_crypto_bull` | cards-12 |
| `card.crypto_winter` | `world_crypto_winter` | cards-12 |
| `card.phishing` | `luck_phishing` | cards-12 |
| `card.spare_room` | `biz_airbnb` | cards-13 |
| `card.rent_letter` | `house_rent_hike` | cards-13 |
| `card.unpaid_rent` | `house_tenant_default` | cards-13 |
| `card.for_sale_signs` | `world_housing_crash` | cards-13 |
| `card.sold_board` | `house_landlord_sells` | cards-13 |
| `card.mortgage_scales` | `house_refinance` | cards-13 |
| `card.small_house` | `late_downsizing` | cards-14 |
| `card.offplan_model` | `inv_offplan_dubai` | cards-14 |
| `card.car_dealer` | `life_car_finance` | cards-14 |
| `card.coupe_garage` | `late_porsche` | cards-14 |
| `card.rate_scissors` | `world_rate_cut` | cards-14 |
| `card.sale_crowd` | `life_black_friday` | cards-14 |
| `card.lecture_hall` | `edu_mba` | cards-15 |
| `card.campus_dropoff` | `late_university` | cards-15 |
| `card.language_class` | `edu_language` | cards-15 |
| `card.bootcamp` | `edu_bootcamp` | cards-15 |
| `card.app_launch` | `biz_app` | cards-15 |
| `card.pitch_napkin` | `biz_cofounder` | cards-15 |
| `card.will_reading` | `fam_inheritance` | cards-16 |
| `card.bonus_confetti` | `luck_bonus` | cards-16 |
| `card.will_desk` | `late_will` | cards-16 |
| `card.dentist_chair` | `health_dental` | cards-16 |
| `card.pitch_injury` | `health_injury` | cards-16 |
| `card.school_gate` | `fam_school` | cards-16 |
| `card.sibling_doorstep` | `fam_sibling_loan` | cards-17 |
| `card.beach_wedding` | `life_wedding_abroad` | cards-17 |
| `card.private_sale` | `life_designer_sale` | cards-17 |
| `card.pickpocket` | `luck_stolen_phone` | cards-17 |
| `card.courtroom` | a later card | cards-17 |
| `card.street_market` | a later card | cards-17 |

### 19. Skylines A

Save as `art/raw/skylines/skylines-01.png`

```text
Landscape 3:2 image. Scene sheet: 1 column by 3 rows, 3 very wide panoramic panels. Each panel is a city skyline at night seen from across the water or a park, with gold lit windows, a deep navy sky with a few stars, and buildings fading to solid dark navy #141b33 along the bottom edge. Top to bottom:
1. Madrid: the domed Metropolis building, the four tall towers of the business district, the Cibeles palace, terracotta rooftops.
2. London: the Elizabeth Tower clock tower, the London Eye wheel, the Shard, Tower Bridge, the Gherkin.
3. New York: the Empire State Building, the Chrysler Building, One World Trade Center, the Brooklyn Bridge.
```

### 20. Skylines B

Save as `art/raw/skylines/skylines-02.png`

```text
Landscape 3:2 image. Scene sheet: 1 column by 3 rows, 3 very wide panoramic panels. Each panel is a city skyline at night seen from across the water or a park, with gold lit windows, a deep navy sky with a few stars, and buildings fading to solid dark navy #141b33 along the bottom edge. Top to bottom:
1. Dubai: the Burj Khalifa needle tower, the sail-shaped Burj Al Arab hotel, the Dubai Frame, a cluster of marina towers.
2. Singapore: the three Marina Bay Sands towers joined by a ship-shaped deck, the Supertree Grove, the lotus-shaped museum, the Singapore Flyer wheel.
3. Bangkok: the Wat Arun temple spire, the pixel-notched MahaNakhon tower, the Baiyoke tower, a long-tail boat on the river.
```

If the three strips come out uneven or merged, generate one city per image with the same wording and save them as `skylines-01a.png`, `skylines-01b.png` and so on.

### 20b. Skylines by day A

Save as `art/raw/skylines/skylines-03.png`

```text
Landscape 3:2 image. Scene sheet: 1 column by 3 rows, 3 very wide panoramic panels. Each panel is a city skyline in the golden hour just after sunrise, seen from across the water or a park: a pale gold and peach sky with a few flat cream clouds, buildings in warm cream, terracotta and grey with glass blue windows, long navy shadows, and buildings fading to solid dark navy #141b33 along the bottom edge. Same buildings, same order and same framing as the night skylines. Top to bottom:
1. Madrid: the domed Metropolis building, the four tall towers of the business district, the Cibeles palace, terracotta rooftops.
2. London: the Elizabeth Tower clock tower, the London Eye wheel, the Shard, Tower Bridge, the Gherkin.
3. New York: the Empire State Building, the Chrysler Building, One World Trade Center, the Brooklyn Bridge.
```

### 20c. Skylines by day B

Save as `art/raw/skylines/skylines-04.png`

```text
Landscape 3:2 image. Scene sheet: 1 column by 3 rows, 3 very wide panoramic panels. Each panel is a city skyline in the golden hour just after sunrise, seen from across the water or a park: a pale gold and peach sky with a few flat cream clouds, buildings in warm cream, terracotta and grey with glass blue windows, long navy shadows, and buildings fading to solid dark navy #141b33 along the bottom edge. Same buildings, same order and same framing as the night skylines. Top to bottom:
1. Dubai: the Burj Khalifa needle tower, the sail-shaped Burj Al Arab hotel, the Dubai Frame, a cluster of marina towers.
2. Singapore: the three Marina Bay Sands towers joined by a ship-shaped deck, the Supertree Grove, the lotus-shaped museum, the Singapore Flyer wheel.
3. Bangkok: the Wat Arun temple spire, the pixel-notched MahaNakhon tower, the Baiyoke tower, a long-tail boat on the river.
```

## Brand sheet

### 21. Logo, wordmark, app icon, mascot

Save as `art/raw/brand/brand-01.png`. Attach sheet 01 as usual; its stencil print (object 15) is the mascot.

```text
Square image. Object sheet: 2 columns by 2 rows, 4 objects. This sheet is the one exception to the no-text rule: objects 1 and 2 contain the exact words THE RAT RACE and no other text anywhere. The rat is the stencil rat from the attached sheet, now in full colour: grey-brown fur, navy suit, white shirt, red tie, brown briefcase. Left to right, top to bottom:
1. Game logo: the rat walking upright with his briefcase, above the words "THE RAT RACE" in bold gold pixel lettering with a dark navy outline. "THE" is small and sits above "RAT RACE".
2. Wordmark only: "THE RAT RACE" in the same bold gold pixel lettering with a dark navy outline, "THE" small above "RAT RACE", no rat.
3. App icon: a square tile with rounded corners, deep navy with a thick gold border, showing the rat's head and shoulders in suit and red tie, turned slightly to the right.
4. Mascot: the rat running inside a golden hamster wheel, briefcase in hand, tie flying behind him.
```

Check the spelling of THE RAT RACE letter by letter before handing it over.

## Sheet list

| # | File | Contents | Target size per sprite |
|---|---|---|---|
| 01 | `items/items-01.png` | Watches, tech, fashion, art | 64×64 |
| 02 | `items/items-02.png` | Travel, memberships, air and sea, education, 5 later items | 64×64 |
| 02b | `items/items-03.png` | A seat for each city besides Madrid, 1 later item | 64×64 |
| 03 | `cars/cars-01.png` | 7 cars + 1 later | 96×48 |
| 04 | `homes/homes-01.png` | 7 homes + 2 later property types | 128×128 |
| 04b | `homes/homes-02.png` | 9 more kinds of property: 6 homes, 3 to let | 128×128 |
| 05 | `icons/icons-01.png` | Finance tool icons | 32×32 |
| 06 | `icons/icons-02.png` | Interface icons | 32×32 |
| 06b | `icons/icons-03.png` | Lifestyle, rent, insurance and focus icons, the economy, a moving van, the way out | 32×32 |
| 06c | `icons/icons-04.png` | Family: single, dating, partner, married, baby, child, teenager, family | 32×32 |
| 06d | `icons/icons-05.png` | A landmark for each city | 32×32 |
| 07 | `badges/badges-01.png` | Achievements 1 to 16 | 64×64 |
| 08 | `badges/badges-02.png` | Achievements 17 to 30, locked badge, generic star | 64×64 |
| 09 | `portraits/portraits-01.png` | Nurse, engineer, civil servant, rider | 64×64 |
| 10 | `portraits/portraits-02.png` | Heir, newcomer, banker, doctor | 64×64 |
| 10b | `portraits/portraits-03.png` | Second chance, founder, crypto kid, 1 later life | 64×64 |
| 11 to 18 | `cards/cards-01.png` to `cards-08.png` | 48 card scenes | 288×120 |
| 22 to 30 | `cards/cards-09.png` to `cards-17.png` | 52 more card scenes, so that no two cards share one, and 2 for later | 288×120 |
| 19 to 20 | `skylines/skylines-01.png`, `-02.png` | 6 city skylines | 312×66 |
| 20b to 20c | `skylines/skylines-03.png`, `-04.png` | The 6 skylines by day | 312×66 |
| 21 | `brand/brand-01.png` | Logo, wordmark, app icon, mascot | varies |

The share card needs no sheet. It is composed in code from a skyline, the logo and the player's numbers.
