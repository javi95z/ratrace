# v24 prompt pack: four new careers, and faces that are the person's

What content 1.52 still draws with stand-ins: the cards of the pilot, the architect, the estate agent and the soldier; their workplaces; two career
icons; the portraits of the three new lives; and the portraits of seven lives drawn again without the clothes of a job, since a life may change
careers halfway and the face must still fit.

| # | Save as | What | Size |
|---|---|---|---|
| 1 | `art/raw/cards/cards-55.png` | The pilot's four cards, the architect's first two | 1586×992, 6 panels 2×3 |
| 2 | `art/raw/cards/cards-56.png` | The architect's last two, the estate agent's four | 1586×992, 6 panels 2×3 |
| 3 | `art/raw/cards/cards-57.png` | The soldier's four, and two career moves | 1586×992, 6 panels 2×3 |
| 4 | `art/raw/cards/work-07.png` | Workplaces: aviation and construction, three stages each | 1536×1024, 3×2 |
| 5 | `art/raw/cards/work-08.png` | Workplaces: real estate and the armed forces | 1536×1024, 3×2 |
| 6 | `art/raw/portraits/portraits-07.png` | Mateo, Charlotte and Ravi at 22, 32, 45 and 58 | 4×3, square cells |
| 7 | `art/raw/portraits/portraits-08.png` | Lucía, Somchai, Nina and Arthit again, in their own clothes | 4×4, square cells |
| 8 | `art/raw/portraits/portraits-09.png` | Noor, Kenji and Diego again, in their own clothes | 4×3, square cells |
| 9 | `art/raw/icons/icons-14.png` | The estate agent's and the soldier's career icons | 2×1, square |

Sheets 7 and 8 replace those lives' cells in `portraits-01`, `-02`, `-04`, `-05` and `-06`: `tools/art/src/sheets.ts` is pointed at them once they
are drawn (until then the old faces stay). Sheets 1 to 6 and 9 are already wired and replace stand-ins as soon as they are saved.

## 1–3. The cards

For every card sheet attach `art/raw/cards/cards-47.png` and `art/raw/cards/cards-48.png` (the style, palette and line to match). Every prompt starts
with this block:

```text
Landscape image, exactly 1586×992 pixels (8:5), made of 6 wide panels: 2 columns by 3 rows, each panel 12:5, all six the same size, edge to edge with no gutter, border or frame. Scene sheet in exactly the painted pixel-art style, palette and line of the attached sheets: night-blue shadows, warm gold light, small rounded figures, the player the same small figure as on the attached cards. Each panel is one full illustrated scene that reads at a small size: one clear subject, a simple background. No text anywhere: any sign, screen, letter, banner, logo or paper shows blank shapes. Left to right, top to bottom:
```

### cards-55: the pilot, and the architect's first two

`card.aviation_medical`, `card.aviation_strike`, `card.aviation_base_abroad`, `card.aviation_grounded`, `card.construction_own_house`, `card.construction_unpaid`

```text
[the block above]
1. The yearly medical: an airline doctor's small white office, the player in a pilot's shirt sitting on the examination bed, the doctor listening to their chest with a stethoscope and frowning, a pilot's cap resting on a chair, a chart of a heart on the wall as blank lines.
2. The pilots strike: an airport terminal at dawn, a line of pilots in uniform holding blank placards by the check-in desks, and the player alone in uniform pulling a small suitcase past them towards the gate, looking back uneasily.
3. A base abroad: the player in uniform at an airport window at night with a rolling suitcase, beyond the glass a wide-body plane at the gate, and behind it a split skyline: the Burj Khalifa on one side, Singapore's Marina Bay Sands on the other.
4. The fleet is grounded: rows of white airliners parked wingtip to wingtip in a desert under a full moon, engines covered, and the player in uniform standing small among them with hands in pockets.
5. A house of your own design: the player on a sunny empty plot holding up their own blueprint against the sky, a builder in a hard hat shaking their hand, a few stakes and string marking the walls on the ground.
6. The developer will not pay: a half-finished modern building at dusk, cranes still, the player at its fence holding a phone to their ear with a blank invoice in the other hand, the phone screen showing only a ringing shape.
```

### cards-56: the architect's last two, the estate agent

`card.construction_collapse`, `card.construction_famous_client`, `card.realestate_off_market`, `card.realestate_hurried_seller`, `card.realestate_bubble`, `card.realestate_double_fee`

```text
[the block above]
1. A crack in the balcony: a modern block of flats at night, one balcony with a long jagged crack and a strip of warning tape, a press photographer's flash going off below, and the player in a hard hat looking up with a hand on their forehead.
2. A famous client: a dramatic all-glass villa sketched on a cliff above the sea at sunset, a pop star in big sunglasses and a fur coat pointing at it, and the player beside them at a drawing board, delighted and nervous.
3. Off the market: a quiet corner of a café, an elderly landlord sliding a key with a blank tag across the table to the player, who wears a smart estate agent's blazer, a small folder between them, a let flat's windows lit across the street.
4. A seller in a hurry: a flat full of half-packed moving boxes, a stressed seller holding a set of keys out at arm's length, the player at the door in a blazer with a blank clipboard, a removal van waiting outside the window.
5. Talk of a bubble: an estate agency's window at night covered in blank property cards, each with a price tag shape pointing up, and above the street a large soap bubble with a skyline reflected in it, the player and two colleagues looking up at it.
6. Two fees for one sale: the player standing between a buyer and a seller who face away from each other, each secretly handing the player an envelope behind their back, the player sweating, a sold sign as a blank board on a house behind.
```

### cards-57: the soldier, and two career moves

`card.military_mission`, `card.military_twenty_years`, `card.military_posting`, `card.military_contractor`. Panels 5 and 6 are not wired yet: the pilot's
long-haul and the estate agent's own agency, kept for the career moves' scenes.

```text
[the block above]
1. A mission abroad: a military transport plane's open ramp at night on a dusty airfield, soldiers in desert uniform with heavy packs walking up into it, the player among them turning back to look at the lights of home on the horizon.
2. Twenty years of service: a small ceremony in a barracks courtyard under evening lights, an officer pinning a medal on the player, who is greying at the temples, a folded uniform and a blank certificate on a table beside them, and a plain office desk with a lamp waiting in the corner.
3. A new posting: a barracks at dawn, the player in uniform loading a kit bag into the back of an army truck, their small family with a dog watching from the doorway, a road sign with blank arrows pointing far away.
4. The contractor's offer: a hotel bar in a hot foreign city, a man in sunglasses and a khaki shirt sliding a thick blank contract and a pen across the table to the player in civilian clothes, a desert skyline beyond the window.
5. Long-haul: a cockpit at night over the ocean, two pilots in the glow of the instruments, one of them the player sipping coffee, the moon over the clouds through the windscreen.
6. Your own agency: the player in a smart suit on the pavement cutting a ribbon across the door of a small new estate agency with a blank sign, a few clapping people and a bottle of fizz.
```

## 4–5. The workplaces

Attach `art/raw/cards/work-06.png` as the style and layout reference. Each sheet is two careers in two rows, three stages left to right: the first
rung, the middle of the career, the top.

```text
Landscape image, exactly 1536×1024 pixels (3:2), made of 6 panels: 3 columns by 2 rows, each nearly square, separated by thin magenta (#FF00FF) gutters exactly as in the attached sheet. Scene sheet in exactly the painted pixel-art style, palette and line of the attached sheet: night-blue shadows, warm gold light, a city at night through windows. Each panel is one workplace, seen as the attached sheet sees them, with at most one small person at work. No text anywhere: any sign, screen or logo shows blank shapes. Left to right, top to bottom:
```

### work-07: aviation and construction

`work.aviation.0`, `work.aviation.1`, `work.aviation.2`, `work.construction.0`, `work.construction.1`, `work.construction.2`

```text
[the block above]
1. Aviation, the first rung: a flight simulator room, a cockpit mock-up lit blue with a trainee pilot at the controls and an empty instructor's seat behind.
2. Aviation, the middle: a regional jet's cockpit at night on the ground, the pilot running a checklist on a clipboard, airport lights outside.
3. Aviation, the top: the flight deck of a long-haul airliner above the clouds at dusk, a captain in a cap with four stripes, the vast lit cockpit around them.
4. Construction, the first rung: a cramped architecture studio at night, a junior drafting on a laptop beside a small foam model, rolls of plans in a bin.
5. Construction, the middle: a building site at night under floodlights, a project architect in a hard hat checking a blank tablet beside a half-built concrete frame and a crane.
6. Construction, the top: an airy studio with a large white model of a tower on a table, glass walls over the city, a partner in a black turtleneck looking at it.
```

### work-08: real estate and the armed forces

`work.realestate.0`, `work.realestate.1`, `work.realestate.2`, `work.military.0`, `work.military.1`, `work.military.2`

```text
[the block above]
1. Real estate, the first rung: a small high-street agency at night, a trainee at a desk with a phone and a wall of blank property cards in the window.
2. Real estate, the middle: an empty bright flat being shown, an agent in a blazer opening the curtains on a city view, a buyer couple's shadows in the doorway.
3. Real estate, the top: a smart corner office of a luxury agency, a director at a glass desk with a scale model of a penthouse and a city skyline behind.
4. The armed forces, the first rung: a barracks dormitory at night, rows of bunks with folded blankets, a young private polishing boots on the edge of one.
5. The armed forces, the middle: an operations room with a large lit map table, a lieutenant leaning over it with blank markers.
6. The armed forces, the top: a colonel's office, a desk with a flag on a stand (plain colours, no emblem), a framed blank map on the wall and a window over a parade ground.
```

## 6–8. Portraits

People, not jobs: everyday clothes that say who they are, the same at every age, getting older. Nothing that names a trade (no uniforms, stethoscopes,
helmets, chef's whites or name badges).

Attach `art/raw/portraits/portraits-05.png` and `art/raw/portraits/portraits-06.png` as the style reference, and for sheets 7 and 8 also the sheets that
hold each person's face (named below): the same face, skin, hair and features, only their clothes change.

```text
Square-celled object sheet, [4 columns by N rows], in exactly the painted pixel-art style of the attached portrait sheets: bust portraits (head and shoulders), each turned slightly to the right, on a plain flat magenta (#FF00FF) background, friendly cartoon people (not caricatures of anyone real), no text and no logos. Each row is one person at four ages, left to right: 22, 32, 45 and 58, the same face growing older (lines, grey hair coming in by 45, mostly grey at 58), dressed in their own everyday clothes, which grow a little smarter with the years. Rows, top to bottom:
```

### portraits-07: the three new lives (4×3)

`portrait.architect.*`, `portrait.estate_agent.*`, `portrait.recruit.*`

```text
[the block above, 4 columns by 3 rows]
1. Mateo, from Mexico City: a man with light brown skin, thick wavy black hair swept back, a neat short beard from 32, round tortoiseshell glasses; a linen shirt with rolled sleeves and a pencil behind his ear at 22, a dark knit polo at 32 and 45, a soft charcoal jacket over a black t-shirt at 58.
2. Charlotte, from London: a woman with fair freckled skin, straight copper-red hair in a sleek bob, small pearl earrings; a striped Breton top under a camel coat at 22 and 32, a cream blouse under a navy blazer at 45, a silk scarf and a grey cashmere jumper at 58.
3. Ravi, from Singapore: a man with brown skin, close-cropped black hair, a strong jaw and a warm wide smile; a plain olive t-shirt at 22, a grey hoodie at 32, a navy polo at 45, a checked shirt with a moustache and short grey hair at 58.
```

### portraits-08: four lives again, out of uniform (4×4)

Also attach `art/raw/portraits/portraits-01.png` (Lucía, Somchai), `portraits-02.png` (Nina) and `portraits-04.png` (Arthit).

```text
[the block above, 4 columns by 4 rows]
1. Lucía (the nurse of the attached sheet: her face and dark hair in a bun): a soft blue cardigan over a white tee at 22 and 32, a green knit jumper at 45, a beige trench coat and reading glasses on a chain at 58.
2. Somchai (the rider of the attached sheet: his face; show his hair, short black and spiky, no helmet): an orange zip hoodie at 22, a denim jacket at 32, a dark bomber jacket at 45, a grey sweater with short grey hair and stubble at 58.
3. Nina (the doctor of the attached sheet: her face and dark curly hair in a bun, glasses at 58): a mustard turtleneck at 22, a teal blouse at 32, a cream jumper with a long necklace at 45, a burgundy cardigan at 58.
4. Arthit (the waiter of the attached sheet: his face and short dark hair): a white linen shirt open at the neck at 22, a navy bomber at 32, a light grey jacket over a black tee at 45, a dark polo with a short grey beard at 58.
```

### portraits-09: three lives again, out of uniform (4×3)

Also attach `art/raw/portraits/portraits-05.png` (Noor) and `portraits-06.png` (Kenji, Diego).

```text
[the block above, 4 columns by 3 rows]
1. Noor (the pilot of the attached sheet: her face and long dark hair in a ponytail): a white shirt and a light denim jacket at 22, a black leather jacket at 32, a camel coat at 45, a silver-grey ponytail and a dark green scarf at 58.
2. Kenji (the robotics engineer of the attached sheet: his face, black hair and glasses): a black hoodie at 22, a grey crew-neck sweater over a collared shirt at 32, a navy zip jacket at 45, a dark cardigan with grey hair at 58.
3. Diego (the chef of the attached sheet: his face, curly black hair and moustache): a red checked flannel shirt at 22, a white tee under an olive overshirt at 32, a brown suede jacket at 45, a dark blue jumper with a grey moustache and curls at 58.
```

## 9. Icons

`icon.career_realestate`, `icon.career_military`. Attach `art/raw/icons/icons-13.png` and a sheet with the career icons (the 16 in `art/clean/icons`) as
the style reference.

```text
Wide image, 2:1. Object sheet: 2 columns by 1 row, 2 icons on a plain flat magenta (#FF00FF) background, in exactly the pixel-art style, outline and palette of the attached career icons, each centred with room around it. No text and no letters. Left to right:
1. Real estate: a small house with a red roof and a big brass key leaning against it, a blank sold tag hanging from the key.
2. The armed forces: a dark green military cap with a gold band and a plain gold star badge, resting on a folded olive jacket.
```
