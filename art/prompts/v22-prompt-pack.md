# v22 prompt pack: every card sheet the standard size

The rule from now on: **a card sheet is 6 panels, 2 columns by 3 rows, each panel 12:5, the whole image exactly 1586×992 pixels** (8:5). The art tool cuts each panel to a 288×120 card. Older sheets of 1, 2, 4 or 10 panels, or of another size (cards-26, 30, 33, 34, 36, 39 and the stand-in cards-49), are redrawn here in five standard sheets, and their cards regrouped so that none has an empty cell:

| Sheet | The six cards, in order | Was |
|---|---|---|
| `cards-30` | Zurich's numbered account, Zurich's referendum, laundering, the office in the east, the office in the west, the cold call | cards-30 (2), cards-33 (1), cards-26 (2), cards-39 (1) |
| `cards-33` | The rich: lawsuit, scandal, tax squad, partner who swindles, divorce, charity gala | cards-49 (stand-in) |
| `cards-34` | The lodger: perfect, does not pay, a friend, tension at home, **the party (new)**, **moving out (new)** | cards-34 (4 and 2 unused) |
| `cards-36` | A life's moments: home, wedding, child, business sold, retired, promotion | cards-36 (wrong size) |
| `cards-39` | The rich: great-uncle's castle, yacht on the rocks, threatening letter, hostile bid, **the fake masterpiece (new)**; the shop across the street | cards-49 (stand-in), cards-39 (1) |

`cards-26` and `cards-49` are no longer used. Three panels are for cards still to be written (marked new): `card.lodger_party`, `card.lodger_leaves`, `card.rich_fake_art`.

For every sheet: attach `art/raw/cards/cards-47.png` and `art/raw/cards/cards-48.png` (the style, palette and line to match), plus what each sheet names. Every prompt starts with the same block:

```text
Landscape image, exactly 1586×992 pixels (8:5), made of 6 wide panels: 2 columns by 3 rows, each panel 12:5, all six the same size, edge to edge with no gutter, border or frame. Scene sheet in exactly the painted pixel-art style, palette and line of the attached sheets: night-blue shadows, warm gold light, small rounded figures, the player the same small figure as on the attached cards. Each panel is one full illustrated scene that reads at a small size: one clear subject, a simple background. No text anywhere: any sign, screen, letter, banner or paper shows blank shapes. Left to right, top to bottom:
```

## cards-30: Zurich, the offices abroad, the cold call

Save as `art/raw/cards/cards-30.png`: `card.city_zurich_numbered_account`, `card.city_zurich_referendum`, `card.crime_laundering`, `card.office_east`, `card.office_west`, `card.celeb_bellfort`

Also attach `art/raw/portraits/celebs-02.png` (the stockbroker of panel 6).

```text
[the block above]
1. Zurich's numbered account: a discreet private bank office with wood panelling, a banker in a dark suit sliding a small card with only dots on it across the desk to the player, a round vault door ajar behind, snowy rooftops in the window.
2. Zurich's referendum: a clean town square by the lake, a citizen handing the player a leaflet beside a wooden voting booth, a red flag with a white cross and the twin towers of the Grossmünster behind, the Alps far away.
3. Laundering: a small bar after closing time, the owner feeding banknotes into an actual washing machine behind the counter, foam spilling out, a friend in a suit holding a ledger and giving a thumbs up, the till open and empty.
4. The office in the east: the player with a rolling suitcase in a glass meeting room at night, a manager handing over a boarding pass; through the window a split view of Tokyo Tower in red neon and the onion domes of Moscow under snow.
5. The office in the west: the player at a desk opening an envelope with two plane tickets fanned out, smiling; through the window a split view of the golden Angel of Independence in Mexico City under a warm sky and the towers of Zurich by a lake with the Alps.
6. The cold call: the slick stockbroker of the attached portraits in a 90s trading floor full of shouting brokers, phone to his ear, grinning; in a round inset the player at home on the phone, about to say yes.
```

## cards-33: the troubles of a fortune, one

Save as `art/raw/cards/cards-33.png`: `card.rich_lawsuit`, `card.rich_scandal`, `card.rich_tax_squad`, `card.rich_partner_swindle`, `card.rich_divorce`, `card.rich_gala`

```text
[the block above]
The world of the very rich, drawn with the game's satirical eye; the player is the rich one, in a good suit.
1. A lawsuit: the player on a courthouse's stone steps, surrounded by press cameras and flashes, as a stranger's lawyer waves a thick file at them.
2. A scandal: a mansion's breakfast table, a newspaper and a phone both showing the same blurry party photo of the player, who has spilt their coffee.
3. The tax squad: three grey inspectors with cardboard boxes and lanyards marching into a marble study full of filing cabinets, the player holding the door open with a stiff smile.
4. A partner who swindles you: a back office at night under a desk lamp, the player's smiling business partner stuffing a second fat envelope into his jacket, the player's photo on the wall behind.
5. An expensive divorce: a long glass table split down the middle by tape, the player and their ex at either end each flanked by two lawyers, a wedding photo torn in two between them, paparazzi at the window.
6. The charity gala: a chandeliered ballroom, the player standing with a raised bidding paddle while an auctioneer points at a blank banner over a drawing of a hospital, guests in evening dress applauding.
```

## cards-34: the lodger

Save as `art/raw/cards/cards-34.png`: `card.lodger_good`, `card.lodger_unpaid`, `card.lodger_friend`, `card.lodger_tension`, `card.lodger_party`, `card.lodger_leaves`

The same lodger in all six, as drawn: a young man in a hoodie.

```text
[the block above]
1. The perfect lodger: the tidy lodger handing the player an envelope of rent in a hallway, a spotless shared kitchen behind them, a little potted plant on the shelf.
2. The lodger who does not pay: the player knocking on a closed bedroom door holding an empty envelope, loud music notes coming from under the door, a pile of unwashed dishes in the sink.
3. A lodger who becomes a friend: the player and the lodger laughing at a kitchen table late at night, the lodger introducing the player to a well-dressed guest holding out a business card.
4. Tension at home: the player's partner with arms crossed in a doorway glaring at the lodger, who eats cereal in pyjamas on the sofa, the player caught in the middle with a nervous smile.
5. The party (new): the player coming home with a suitcase to a living room full of the lodger's friends dancing, a disco ball, cups everywhere, the lodger waving sheepishly from on top of the sofa.
6. Moving out (new): the lodger at the front door with a backpack and a box of plants, handing back the keys and a small wrapped present, the empty spare room behind with its bed made.
```

## cards-36: a life's moments

Save as `art/raw/cards/cards-36.png`: `card.moment_home`, `card.moment_wedding`, `card.moment_child`, `card.moment_business_sold`, `card.moment_retired`, `card.moment_promotion`

```text
[the block above]
Each a night-time scene in a warm, celebratory mood, gold light against night blue.
1. The first home: the player in front of their first own home, a gold key held up, warm light in every window.
2. The wedding: the player and their partner under a string of warm lights at a simple outdoor wedding, petals in the air, a few guests clapping.
3. A child: the player holding a newborn wrapped in a cream blanket by a window, the city's lights outside.
4. The business sold: a handshake across the counter of a small shop at closing time, a blank tag hanging on the door handle, a box of coins on the counter.
5. Retired: the player, grey-haired, on a quiet seaside bench as the sunset turns to night, a dog beside them, a cup of tea.
6. A promotion: the player carrying a box into a bigger, brighter office with a city view, colleagues clapping.
```

## cards-39: the troubles of a fortune, two, and the shop across the street

Save as `art/raw/cards/cards-39.png`: `card.rich_uncle_castle`, `card.rich_yacht_rocks`, `card.rich_threat`, `card.rich_hostile_bid`, `card.rich_fake_art`, `card.celeb_ortiga`

Also attach `art/raw/portraits/celebs-02.png` (the fashion magnate of panel 6).

```text
[the block above]
The world of the very rich, drawn with the game's satirical eye; the player is the rich one, in a good suit.
1. A great-uncle's castle: a crumbling hilltop castle in the rain, a notary at the gate handing the player a big old key while a long scroll of debts trails on the ground.
2. The yacht on the rocks: the player's white yacht tilted on rocks at dusk, party lights still on, guests in evening wear wading ashore and a sheepish skipper.
3. A threatening letter: a letter made of cut-out shapes on the doormat of a grand marble hallway, the player picking it up, two bodyguards in dark suits behind.
4. A hostile bid: a giant glossy corporate tower casting its shadow over the player's own smaller company building, a suited executive holding out a contract to the player.
5. The fake masterpiece (new): an art expert with a magnifying glass and a lamp in the player's gallery-like living room, pointing at a tiny wrong detail of a huge gilt-framed painting, the player pale beside it.
6. The shop across the street: the player's small clothes shop on one side of a street, and opposite a big bright new fashion store opening with balloons, the quiet magnate of the attached portraits cutting its ribbon with tailor's scissors.
```

## cards-54: the people, deeper

Save as `art/raw/cards/cards-54.png`: `card.ex_new_car_man`, `card.classmate_housewarming`, `card.cousin_yacht`, `card.parents_visit`, `card.founder_bell`, `card.boss_retire`

Attach `art/raw/cards/cards-53.png` (the style, the parents, the cousin and the ex's scene) and `art/raw/portraits/people-01.png` (the faces of the founder, the boss and the parents). Who is who: the classmate a man of the player's age with short hair; the cousin the woman of cards-53's panel 4, in the same style; Bea, the founder, curly-haired with glasses, as on cards-52; Margaret, the boss, with a grey bob and glasses, as on cards-51; the parents as on cards-53.

```text
[the block above]
1. The ex in the convertible: at night in the rain, the player at a bus stop with a backpack and scarf; a gleaming red convertible stops in front; at the wheel a young man in sunglasses and an expensive jacket waves with a satisfied smile; city lights reflected on the wet road.
2. The classmate's housewarming: a small new flat full of guests holding glasses, the classmate proudly showing the player a gleaming boiler in a cupboard as if it were a baby; the player holding a potted fern, unopened moving boxes stacked in a corner.
3. The cousin's yacht: a white chartered yacht at sunset with string lights, the cousin in sunglasses raising a glass of champagne on deck; in the foreground the player at a little table on the deck, staring at a long blank bill unrolled to the floor, a waiter holding a card machine.
4. The parents' visit: the player's small living room, the mother running a finger along a shelf and inspecting it, the father on a stepladder fixing a dripping tap in the open kitchen with a toolbox, their two suitcases by the door, the player watching from the sofa with a weak smile.
5. The founder's bell: a stock exchange's balcony above a crowded trading floor, the founder ringing a big brass bell with both hands, confetti falling, a screen with a blank rising line behind her; the player in the crowd below, cheering.
6. The boss retires: an office farewell at dusk, a cake and a few colleagues, the boss in a cardigan holding a box with a potted tomato plant on top, handing the player a thick old address book with both hands.
```

## Where each goes

| Sheet | Save as | Size |
|---|---|---|
| Zurich, offices, the cold call | `art/raw/cards/cards-30.png` | 1586×992, 6 cards of 288×120 |
| The rich, one | `art/raw/cards/cards-33.png` | 1586×992, 6 cards of 288×120 |
| The lodger | `art/raw/cards/cards-34.png` | 1586×992, 6 cards of 288×120 |
| A life's moments | `art/raw/cards/cards-36.png` | 1586×992, 6 cards of 288×120 |
| The rich, two, and the shop | `art/raw/cards/cards-39.png` | 1586×992, 6 cards of 288×120 |
| The people, deeper | `art/raw/cards/cards-54.png` | 1586×992, 6 cards of 288×120 |
