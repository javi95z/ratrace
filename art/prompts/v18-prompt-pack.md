# Art prompt pack: v18

What each city sells to let, as it builds it. Until now a parking space, a shop, an office, a
warehouse and a block of flats looked the same in every city; and each city now sells one thing to
let that only it has. Ten sheets, one per city.

Use the same ChatGPT project and the same **style block** (in `v1-prompt-pack.md`). Start every
message with `Match the attached sheet's style and level of detail exactly.` and attach that city's
homes sheet (`art/raw/homes/homes-<city>.png`), so the two sheets read as one city. The checks before
saving are the same as in v1.

Same rules as the homes sheets: three-quarter exterior view at night, warm lit windows, each object
standing alone with no street around it, nothing cut off at the edges, one night sky tone and light
direction across the sheet. No readable text anywhere: signs, billboards and shop fronts carry
shapes and colour only. Every sheet is **3 columns by 2 rows**, and the game relies on the order:
parking, shop, office, warehouse, block of flats, the city's own.

Singapore and Zurich sell no whole block of flats: their fifth cell is left **empty** (plain
background, nothing drawn).

Once a sheet is saved as `art/raw/homes/rentals-<city>.png` and cut (`pnpm -s art`), add the city to
`CITY_RENTALS_DRAWN` and its own kind to `LOCAL_RENTALS_DRAWN` in `packages/content/src/art.ts`.

| Sheet | City | Its own kind | Sprite |
| --- | --- | --- | --- |
| 120 | Madrid | Holiday let | `home.tourist_flat` |
| 121 | London | Student house | `home.student_house` |
| 122 | New York | Billboard on Times Square | `home.billboard` |
| 123 | Dubai | Berth at the Marina | `home.yacht_berth` |
| 124 | Singapore | Hawker centre stall | `home.hawker_stall` |
| 125 | Bangkok | Floating market stall | `home.market_stall` |
| 126 | Tokyo | Capsule hotel | `home.capsule_hotel` |
| 127 | Moscow | Kiosk by the metro | `home.kiosk` |
| 128 | Mexico City | Rooftop for antennas | `home.rooftop` |
| 129 | Zurich | Bank vault | `home.vault` |

## 120. To let in Madrid

Save as `art/raw/homes/rentals-madrid.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. Madrid architecture throughout: ochre and cream plaster, wrought-iron balconies, terracotta tiles, green shutters. Left to right, top to bottom:
1. Underground parking entrance in Chamberí: a ramp going down under a cream stone building, a striped barrier arm, a round blue parking sign with no letters, a small car nose visible below.
2. Old shop on Calle Fuencarral: a ground-floor shopfront with a carved wooden frame, a striped awning, a lit window display of shoes, the flat above dark.
3. Glass office tower on the Paseo de la Castellana: slim blue-glass tower with a few floors lit, a small fountain at its foot.
4. Industrial warehouse in Coslada: corrugated metal shed with a loading dock, a yellow forklift, pallets stacked, one big door open and lit.
5. Traditional corrala in Lavapiés: a four-storey block around an inner courtyard, iron walkways on every floor, laundry lines, many small lit windows.
6. Holiday flat in the old centre: a narrow balcony flat above a tapas bar, a key lockbox by the door, a wheeled suitcase on the step, fairy lights on the balcony.
```

## 121. To let in London

Save as `art/raw/homes/rentals-london.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. London architecture throughout: London stock brick, white stucco, sash windows, black railings. Left to right, top to bottom:
1. Mews garage in Chelsea: a cobbled mews house with a pastel facade and a wide wooden garage door, a carriage lamp lit above it.
2. Shop on Oxford Street: a grand stone-fronted ground-floor shop with big lit windows and a red bus stop sign shape beside it, no letters.
3. Office in the City: a curved glass skyscraper in the style of the Gherkin, a few floors lit, a black cab outside.
4. Warehouse in Park Royal: a long low brick-and-metal industrial unit, roller shutters, a white van parked at the dock.
5. Victorian block in Hackney: a four-storey red-brick mansion block with bay windows on every floor, a communal front door, many lit windows.
6. Student house: a tired Victorian terraced house with a bicycle chained to the railings, a traffic cone on the wall, mismatched curtains, every window lit.
```

## 122. To let in New York

Save as `art/raw/homes/rentals-new-york.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. New York architecture throughout: brownstone, red brick, black fire escapes, cast-iron facades. Left to right, top to bottom:
1. Parking garage in Midtown: a multi-storey concrete garage with a car lift, a yellow cab on the top level, a lit "P" shape sign with no letters.
2. Storefront in SoHo: a cast-iron building with a tall lit ground-floor shop window, fire escape above.
3. Office on Wall Street: a stone Art Deco tower with a lit lobby and a flag over the door.
4. Warehouse in Red Hook: a waterfront brick warehouse with big arched doors, a crane arm and stacked shipping containers.
5. Walk-up block in the Bronx: a five-storey red-brick tenement with zigzag fire escapes, a water tower on the roof, many lit windows.
6. Billboard on Times Square: a huge glowing billboard on a steel frame on top of a small building, bright pink and blue light, abstract shapes only, no text.
```

## 123. To let in Dubai

Save as `art/raw/homes/rentals-dubai.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. Dubai architecture throughout: sand-coloured stone, mirrored glass, palm trees, gold accents. Left to right, top to bottom:
1. Parking bay in Downtown: a sleek covered parking deck under a mirrored tower, a white luxury SUV in a lit bay.
2. Shop in the Deira souk: a wooden-shuttered stall in a covered souk arcade, lanterns, rolls of fabric and spice sacks.
3. Office in DIFC: a tall mirrored glass tower with a gate-shaped top, a few floors lit gold.
4. Warehouse in Jebel Ali: a huge pale logistics shed by the port, shipping containers in many colours, a crane.
5. Apartment tower in JVC: a mid-rise beige residential tower with many balconies and a rooftop pool glowing blue.
6. Yacht berth at the Marina: a wooden pontoon with a white motor yacht moored, mooring posts with small lights, dark water with reflections.
```

## 124. To let in Singapore

Save as `art/raw/homes/rentals-singapore.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 5 objects and one empty cell. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. Singapore architecture throughout: white tropical modernism, pastel shophouses, lush greenery. Left to right, top to bottom:
1. HDB car park lot: a multi-storey open car park with green-painted levels, plants trailing from the edges, one small car in a lit bay.
2. Shophouse in Joo Chiat: a two-storey Peranakan shophouse with pastel tiles, ornate shutters and a lit five-foot way arcade.
3. Office at Raffles Place: a sleek glass skyscraper with greenery on its terraces, a few floors lit.
4. Warehouse in Tuas: a clean white industrial building with a loading bay, a forklift and neat rows of pallets.
5. Leave this cell empty: plain background, nothing drawn.
6. Hawker centre stall: a single food stall under a ceiling fan, a steaming wok, plastic stools, a lit stall sign panel with no letters.
```

## 125. To let in Bangkok

Save as `art/raw/homes/rentals-bangkok.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. Bangkok architecture throughout: concrete shophouses, tangled power lines, golden temple trim, tropical plants. Left to right, top to bottom:
1. Parking space in Silom: an open-air parking lot under a concrete overpass, a tuk-tuk and a scooter in lit bays.
2. Shophouse in Yaowarat: a narrow Chinatown shophouse with a red and gold sign panel with no letters, lanterns and a lit shopfront.
3. Office in Sathorn: a modern glass tower with a few floors lit, a small spirit house at its foot.
4. Warehouse in Lat Krabang: a blue metal-roofed shed with stacked boxes, a small pickup truck at the door.
5. Apartment block in Huai Khwang: an eight-storey concrete block with balconies full of plants and air conditioners, many lit windows.
6. Floating market stall: a long wooden boat loaded with fruit and flowers, a paper lantern and a straw hat, on dark water by a wooden pier.
```

## 126. To let in Tokyo

Save as `art/raw/homes/rentals-tokyo.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. Tokyo architecture throughout: compact concrete and tile, vending machines, neat signage panels with no letters. Left to right, top to bottom:
1. Robot car park in Shibuya: a narrow tower car park with a rotating lift and cars stacked on trays behind glass.
2. Shop in Harajuku: a tiny two-storey boutique with a pastel facade, a lit window and a paper lantern.
3. Office in Marunouchi: a tall glass and granite tower with a few floors lit, a line of clipped trees at its foot.
4. Warehouse in Ota: a grey logistics building with a loading bay, a small white kei truck and stacked cardboard boxes.
5. Apartment block in Nakano: a five-storey white apartment block with outdoor walkways on every floor, laundry poles and lit doors.
6. Capsule hotel in Shinjuku: a narrow building with its front cut away to show two rows of glowing capsule pods stacked like drawers.
```

## 127. To let in Moscow

Save as `art/raw/homes/rentals-moscow.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, in light snow, standing alone with no street around it. Moscow architecture throughout: Soviet concrete, Stalinist stone, birch trees. Left to right, top to bottom:
1. Space in a Soviet garage: a row of rusty metal garage boxes with green doors, one open and lit with a small old Lada inside.
2. Shop under a Khrushchyovka: the ground floor of a five-storey grey panel block turned into a small lit shop with a metal awning.
3. Office in Moscow City: a twisting glass skyscraper with a few floors lit blue.
4. Warehouse in Lyubertsy: a long corrugated metal shed with a truck at the dock and snow on the roof.
5. Stalin-era block: a heavy cream stone apartment building with a spire, columns, ornate balconies and many lit windows.
6. Kiosk by the metro: a small glass and metal street kiosk with lit shelves of snacks, a red metro "M" shape beside it.
```

## 128. To let in Mexico City

Save as `art/raw/homes/rentals-mexico-city.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 6 objects. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. Mexico City architecture throughout: bright painted stucco, volcanic stone, jacaranda trees, papel picado. Left to right, top to bottom:
1. Parking space in Polanco: a gated parking lot behind a pink wall, a valet podium and a dark sedan in a lit bay.
2. Shop in Roma: an Art Nouveau ground-floor shop with a curved lit window and a jacaranda tree beside it.
3. Office on Reforma: a modern glass tower with a few floors lit, a palm tree at its foot.
4. Warehouse in Iztapalapa: a painted cinderblock bodega with a roll-up door, crates of produce and a small truck.
5. Apartment building in Narvarte: a five-storey building painted in bright colours with balconies, plants and many lit windows.
6. Rooftop for antennas: a flat concrete rooftop with a tall telecom mast, satellite dishes, water tanks and a blinking red light.
```

## 129. To let in Zurich

Save as `art/raw/homes/rentals-zurich.png`

```text
Image 3:2. Object sheet: 3 columns by 2 rows, 5 objects and one empty cell. Every object is a three-quarter exterior view at night with warm light, standing alone with no street around it. Zurich architecture throughout: neat stone, green copper roofs, flower boxes, very clean. Left to right, top to bottom:
1. Underground parking space: a spotless concrete ramp going down under a tidy building, a lit sign panel with no letters and a small electric car.
2. Shop on Bahnhofstrasse: an elegant stone shopfront with a lit window full of watches and a linden tree beside it.
3. Office in Zurich West: a converted industrial building with a modern glass extension, a few floors lit.
4. Warehouse in Dietikon: a clean grey industrial hall with a loading dock and a small red train wagon on a siding.
5. Leave this cell empty: plain background, nothing drawn.
6. Bank vault on Paradeplatz: a round steel vault door standing open in a stone wall, a glimpse of gold bars and safe deposit boxes inside, a warm light.
```
