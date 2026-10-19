# Art prompt pack: v17

Fourteen famous people, as parodies: a portrait each (for their cards and the headlines they make),
a card scene each, and a badge each. Their names in the game are parodies too (Elon Mosk, Ronald
Grump, Vladimir Poutine...), and nothing in these prompts names a real person: each is drawn from
the public image everyone knows, as a friendly cartoon caricature. Big heads, one or two features
pushed far, never cruel, no real logos or text.

Use the same ChatGPT project and the same **style block** (in `v1-prompt-pack.md`). Start every
message with `Match the attached sheet's style and level of detail exactly.` The checks before
saving are the same as in v1, plus: nobody's face is a photo-real likeness; it reads as a cartoon.

| Id | Parody | Who it plays on |
|---|---|---|
| `mosk` | Elon Mosk | The tech and rockets billionaire who posts too much |
| `grump` | Ronald Grump | The tower-building tycoon of "You're fired!" |
| `poutine` | Vladimir Poutine | The stern Moscow strongman of long tables and oligarchs |
| `bufe` | Warren Bufé | The patient old investor |
| `bozos` | Jeff Bozos | The parcels and yachts billionaire |
| `zuckerbot` | Mark Zuckerbot | The social network founder of the metaverse |
| `puertas` | Bill Puertas | The software billionaire turned philanthropist |
| `nakamoro` | Satoshi Nakamoro | The faceless creator of the first coin |
| `kardashion` | Kim Kardashion | The famous-for-being-famous star of brands and selfies |
| `mrfeast` | MrFeast | The video star of huge money challenges |
| `ronalgo` | Cristiano Ronalgo | The footballer with the famous celebration |
| `swiftly` | Taylor Swiftly | The pop star whose tour moves whole economies |
| `bellfort` | Jordan Bellfort | The slick 90s stockbroker of cold calls |
| `ortiga` | Amancio Ortiga | The quiet Spanish fashion magnate |

## 117. Portraits, one

Save as `art/raw/portraits/celebs-01.png` — `celeb.mosk`, `celeb.grump`, `celeb.poutine`, `celeb.bufe`, `celeb.bozos`, `celeb.zuckerbot`, `celeb.puertas`, `celeb.nakamoro`

Attach `art/raw/portraits/portraits-05.png` as the style reference.

```text
Landscape image, 2:1. Object sheet: 4 columns by 2 rows, 8 bust portraits (head and shoulders), each turned slightly to the right, as friendly cartoon caricatures: big heads, one or two features exaggerated, no text and no real logos. Left to right, top to bottom:
1. A tech billionaire: tousled dark hair, a smug half smile, a plain black t-shirt with a tiny white rocket on it, holding up a phone as if about to post something.
2. A tycoon: huge swept-back golden-blond hair, a deep orange tan, pursed lips, an oversized navy suit with a very long red tie, one finger pointing at the viewer.
3. A stern strongman: short receding light hair, cold blue eyes, a thin unreadable smile, a dark suit, holding a small bowl of chips covered in gravy and cheese curds as if it were a medal.
4. A cheerful old investor: white hair, big black-rimmed glasses, a beige jumper, holding a folded newspaper and a can of cherry cola.
5. A shiny-headed billionaire: completely bald and gleaming, a booming laugh, a puffer vest over a polo shirt, a cardboard parcel under one arm.
6. A social network founder: short curly hair, pale skin, a plain grey t-shirt, a stiff robotic smile, a virtual reality headset pushed up on his forehead.
7. A kindly software billionaire: neatly side-parted hair, round glasses, a soft pullover over a shirt, holding a glass donation jar with a heart on it.
8. A faceless coin creator: a dark hooded figure whose face is hidden in shadow except for a faint smile, holding up a glowing gold coin with a simple stylised letter B.
```

## 118. Portraits, two

Save as `art/raw/portraits/celebs-02.png` — `celeb.kardashion`, `celeb.mrfeast`, `celeb.ronalgo`, `celeb.swiftly`, `celeb.bellfort`, `celeb.ortiga`

Attach `art/raw/portraits/celebs-01.png`.

```text
Landscape image, 3:2. Object sheet: 3 columns by 2 rows, 6 bust portraits in exactly the style of the attached sheet, each turned slightly to the right, friendly cartoon caricatures, no text and no real logos. Left to right, top to bottom:
1. A celebrity of brands and selfies: long sleek black hair, sharp contoured make-up, glossy lips, holding a phone up for a selfie.
2. A video challenge star: a young man with a huge grin and short brown hair, a bright blue hoodie, holding a giant novelty cheque with a long row of zeros.
3. A star footballer: slicked dark hair, a chiselled jaw, a white football shirt, arms flung wide and down in a famous goal celebration.
4. A pop star: blonde hair with a straight fringe, red lipstick, a sparkly sequinned stage outfit, a microphone, colourful beaded bracelets up her arm.
5. A slick 90s stockbroker: gelled hair, a wide sharky grin, a pinstripe suit with braces, a telephone headset, a fan of banknotes in one hand.
6. A quiet fashion magnate: an older man with white hair, a plain light blue shirt with the sleeves rolled up, a tailor's measuring tape round his neck, a modest kind smile.
```

## 119. Their cards, one

Save as `art/raw/cards/cards-37.png` — `card.celeb_mosk`, `card.celeb_grump`, `card.celeb_poutine`, `card.celeb_bufe`, `card.celeb_bozos`, `card.celeb_zuckerbot`

Attach `art/raw/cards/cards-35.png` as the style reference, and `art/raw/portraits/celebs-01.png` so each one is the same character.

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels. In each, the attached character as a full cartoon figure. No readable text. Left to right, top to bottom:
1. The buy-out by post: the tech billionaire leaning on the counter of the player's small business, phone in hand, a cartoon thought bubble with a big money bag, the player behind the counter wide-eyed.
2. The tower: the tycoon in front of a glittering gold skyscraper, arms spread like a salesman, handing the player a gold key, the building's name above the door as a blank gold plate.
3. The yacht of an oligarch: a huge white yacht at a Moscow river quay in snow, a nervous businessman handing the player its keys at a bargain, the stern strongman watching from the far end of an absurdly long white table set up on the quay.
4. Lunch with the investor: the cheerful old investor and the player sharing burgers and cherry colas at a plain diner booth, a stock chart going up on a small TV behind them.
5. The parcel empire: the shiny-headed billionaire standing on a mountain of cardboard boxes in a vast warehouse, pointing at the player's small shop sign as a blank shape, a conveyor belt behind.
6. Land in the metaverse: the player wearing a VR headset, standing in an empty glowing grid world on a tiny square of virtual grass, the social network founder floating as a stiff avatar selling a deed.
```

## 120. Their cards, two

Save as `art/raw/cards/cards-38.png` — `card.celeb_puertas`, `card.celeb_nakamoro`, `card.celeb_kardashion`, `card.celeb_mrfeast`, `card.celeb_ronalgo`, `card.celeb_swiftly`

Attach `art/raw/cards/cards-37.png`, and `art/raw/portraits/celebs-01.png` and `celebs-02.png`.

```text
Landscape 3:2 image. Scene sheet: 2 columns by 3 rows, 6 panels, exactly the style of the attached sheet, the attached characters as full cartoon figures. No readable text. Left to right, top to bottom:
1. The donation: the kindly software billionaire on a charity gala stage holding out his heart-shaped donation jar towards the player in the audience, everyone turning to look.
2. The old wallet: the player in a dusty attic opening an old laptop that glows gold, the hooded coin creator's shadowy face faintly reflected on its screen.
3. The sponsored post: the selfie celebrity and the player posing together with a product as a blank bottle, a ring light and a phone on a tripod, likes floating as hearts.
4. The challenge: the video star in a studio set holding the giant cheque, the player standing in a ring of bright lights, a huge countdown clock as blank digits behind.
5. The underwear line: the footballer posing on a billboard in a white underwear advert as a blank brand area, the player below handing over money to a manager with a clipboard.
6. The tour: a packed stadium at night lit up in pink and purple, the pop star on stage, the player in the crowd holding a pricey ticket and wearing beaded bracelets.
```

## 121. Their cards, three

Save as `art/raw/cards/cards-39.png` — `card.celeb_bellfort`, `card.celeb_ortiga`

Attach `art/raw/cards/cards-38.png` and `art/raw/portraits/celebs-02.png`.

```text
Landscape 2.4:1 image. Scene sheet: 2 columns by 1 row, 2 panels, exactly the style of the attached sheet. No readable text. Left to right:
1. The cold call: the slick stockbroker in a 90s office full of shouting brokers, phone to his ear, grinning, and in a split frame the player at home on the phone, about to say yes.
2. The shop across the street: the player's small clothes shop on one side of a street, and opposite a big bright new fashion store opening with balloons, the quiet magnate cutting its ribbon with tailor's scissors.
```

## 122. Their badges, one

Save as `art/raw/badges/badges-11.png` — `badge.celeb_mosk`, `badge.celeb_grump`, `badge.celeb_poutine`, `badge.celeb_bufe`, `badge.celeb_bozos`, `badge.celeb_zuckerbot`, `badge.celeb_puertas`, `badge.celeb_nakamoro`

Attach `art/raw/badges/badges-10.png` as the style reference.

```text
Landscape image, 2:1. Object sheet: 4 columns by 2 rows, 8 badges. Every badge is a round medallion of identical size with a gold rim, a dark enamel centre and one simple bold symbol, no text. Left to right, top to bottom:
1. Fired by post: a phone with a speech bubble and a small cardboard box of office things.
2. Tariffed: a shipping container stamped with a big red cross and a gold tower behind it.
3. Sanctioned: a white yacht wrapped in a thick chain with a padlock.
4. Lunch with the investor: a burger and a can of cherry cola side by side.
5. Prime for ever: a cardboard parcel with a little smile drawn on it and a crown.
6. Virtual neighbour: a tiny house on a glowing grid tile floating in space.
7. Philanthropist: a heart dropping into a glass jar full of coins.
8. Lost keys: an old laptop with a broken padlock and a single gold coin.
```

## 123. Their badges, two

Save as `art/raw/badges/badges-12.png` — `badge.celeb_kardashion`, `badge.celeb_mrfeast`, `badge.celeb_ronalgo`, `badge.celeb_swiftly`, `badge.celeb_bellfort`, `badge.celeb_ortiga`

Attach `art/raw/badges/badges-11.png`.

```text
Landscape image, 3:2. Object sheet: 3 columns by 2 rows, 6 badges in exactly the style of the attached sheet. Left to right, top to bottom:
1. Sponsored: a phone showing a heart, with a ring light behind it.
2. Viral by mistake: a big red play button with a cracked egg on it.
3. The celebration: a football with two little arms flung wide and down.
4. Fan: a beaded friendship bracelet around a concert ticket.
5. Cousin of Wall Street: an old telephone with a dollar sign on its dial.
6. Stung by nettles: a clothes hanger tangled in a stinging nettle plant.
```

## Where each goes

| # | File | What | Size |
|---|---|---|---|
| 117 | `portraits/celebs-01.png` | Portraits: Mosk, Grump, Poutine, Bufé, Bozos, Zuckerbot, Puertas, Nakamoro | 64×64 |
| 118 | `portraits/celebs-02.png` | Portraits: Kardashion, MrFeast, Ronalgo, Swiftly, Bellfort, Ortiga | 64×64 |
| 119 | `cards/cards-37.png` | Cards: buy-out, tower, oligarch's yacht, investor's lunch, parcels, metaverse | 288×120 |
| 120 | `cards/cards-38.png` | Cards: donation, old wallet, sponsored post, challenge, underwear line, tour | 288×120 |
| 121 | `cards/cards-39.png` | Cards: cold call, the shop across the street | 288×120 |
| 122 | `badges/badges-11.png` | Badges of the first eight | 64×64 |
| 123 | `badges/badges-12.png` | Badges of the last six | 64×64 |
