# v25 prompt pack: three cards for each of the eleven older careers

Content 1.52 gave the eleven careers before the four newest three cards of their own (healthcare, tech, the civil service, delivery, finance,
medicine, law, teaching, influencers, hospitality and sales). They stand in with each career's workplace until drawn. Six standard sheets, two
careers to a sheet, wired in `tools/art/src/sheets.ts`: saving each file replaces its stand-ins.

| # | Save as | The six cards, in order |
|---|---|---|
| 1 | `art/raw/cards/cards-58.png` | Healthcare ×3, tech ×3 |
| 2 | `art/raw/cards/cards-59.png` | Civil service ×3, delivery ×3 |
| 3 | `art/raw/cards/cards-60.png` | Finance ×3, medicine ×3 |
| 4 | `art/raw/cards/cards-61.png` | Law ×3, teaching ×3 |
| 5 | `art/raw/cards/cards-62.png` | Influencer ×3, hospitality ×3 |
| 6 | `art/raw/cards/cards-63.png` | Sales ×3, and three career moves kept for later |

Every sheet: exactly 1586×992, 6 panels 2×3, each cut to a 288×120 card. Attach `art/raw/cards/cards-47.png` and `art/raw/cards/cards-48.png` (the
style, palette and line to match). Every prompt starts with this block:

```text
Landscape image, exactly 1586×992 pixels (8:5), made of 6 wide panels: 2 columns by 3 rows, each panel 12:5, all six the same size, edge to edge with no gutter, border or frame. Scene sheet in exactly the painted pixel-art style, palette and line of the attached sheets: night-blue shadows, warm gold light, small rounded figures, the player the same small figure as on the attached cards. Each panel is one full illustrated scene that reads at a small size: one clear subject, a simple background. No text anywhere: any sign, screen, letter, banner, logo or paper shows blank shapes. Left to right, top to bottom:
```

## cards-58: healthcare and tech

`card.healthcare_assault`, `card.healthcare_post_away`, `card.healthcare_icu`, `card.tech_stock_options`, `card.tech_layoffs`, `card.tech_new_york`

```text
[the block above]
1. Attacked in A&E: a busy emergency department at night under harsh lights, the player in nurse's scrubs pressed back against a curtained bay, an angry man in a jacket being held back by a security guard, a dropped clipboard on the floor.
2. A post for good: the player at a kitchen table at night holding two blank letters, one in each hand, a laptop open showing two blank hospital buildings side by side, a cup of tea going cold.
3. The ICU needs people: an intensive care unit at night, rows of beds with monitors glowing green, the player in scrubs and a mask checking a drip by a bed, tired eyes, the rest of the ward dark and quiet.
4. Your stock options: the player at a desk in a modern open-plan office, looking at a screen with a blank line chart going up steeply, a small rocket model and a branded mug beside the keyboard, colleagues cheering in the background.
5. Mass layoffs: a glass meeting room in a tech office, a row of people carrying cardboard boxes with plants and monitors out of the door, the player at their desk watching through the glass, a blank all-staff email on the screen.
6. A call from New York: the player on a phone at night by a window in a small flat, and through the window, as if dreamt, the skyline of Manhattan glowing with the Empire State Building, a packed suitcase half-open on the bed.
```

## cards-59: the civil service and delivery

`card.public_exam`, `card.public_pay_cut`, `card.public_abroad`, `card.service_app_cut`, `card.service_strike`, `card.service_on_call`

```text
[the block above]
1. The senior corps exam: the player at a desk late at night buried under thick law books and highlighted blank pages, a calendar with crossed-out days on the wall, a cold coffee and a desk lamp.
2. A pay cut for the civil service: a crowd of civil servants with blank placards and whistles in front of a stately government building with columns, the player among them holding a banner, police vans in the distance.
3. An international post: the player in a suit on the steps of a modern international organisation's glass headquarters, a row of plain coloured flags on poles behind (no emblems), a lanyard with a blank badge round their neck.
4. The app cuts its rates: a rider on a bike at a rainy street corner looking at a phone that shows a blank screen with a down arrow, a delivery backpack on their back, other riders grumbling in the background under a streetlight.
5. The riders' strike: a city square filled with parked delivery bikes and riders with blank placards, and the player alone riding past them with a delivery backpack, glancing back guiltily.
6. Always on call: the player in bed at 3 a.m. lit by a ringing phone on the nightstand, an alarm clock showing blank digits, their partner's shape asleep beside them, a manager's lanyard hanging on the bedpost.
```

## cards-60: finance and medicine

`card.finance_bonus`, `card.finance_insider`, `card.finance_merger`, `card.medicine_negligence`, `card.medicine_specialty`, `card.medicine_private_clinic`

```text
[the block above]
1. The year's bonus: a banker's glass office at night, the player opening a blank envelope with a big smile, on the desk two choices laid side by side: a stack of cash and a framed certificate of shares.
2. Inside information: a dim private members' club, a client in a sharp suit leaning in to whisper to the player, both holding whisky glasses, the player's phone on the table showing a blank stock app.
3. The bank merges: two bank towers in the night side by side, a giant crane lifting a new blank sign onto the smaller one, and the player on the pavement below holding a cardboard box, looking up.
4. A negligence claim: a quiet hospital meeting room, the player in a white coat sitting opposite two serious lawyers in suits with a thick blank file between them, a grieving family's photo on the wall.
5. A specialty: the player in a doctor's white coat in a lecture theatre late at night, a heart diagram on a screen as blank lines, an enormous textbook open, a stethoscope round their neck.
6. The private clinic: a gleaming private clinic's lobby with marble and plants, a smiling director in a suit offering the player a blank contract, while through the window a crowded public hospital's entrance is seen across the street.
```

## cards-61: law and teaching

`card.law_big_case`, `card.law_cash_client`, `card.law_own_firm`, `card.education_summer`, `card.education_old_pupil`, `card.education_new_law`

```text
[the block above]
1. The case on every front page: the steps of a courthouse at night, a crowd of reporters with cameras and flashes, the player in a lawyer's suit beside a famous client in sunglasses, both walking through the crowd.
2. A client who pays in cash: the player at a desk in a small law office, a man in a flashy suit with gold rings opening a briefcase full of banknotes, a neon nightclub sign glowing through the rain-streaked window.
3. A firm of your own: the player unlocking the glass door of a small empty office with a blank brass plate beside it, boxes of files on the floor, two clients waiting with folders, the city at dusk behind.
4. The long summer: a split scene: on the left the player at a kitchen table tutoring a bored teenager with a textbook, on the right an empty sunlit beach with a towel and a parasol waiting.
5. A former pupil: the player at home in front of a television showing a young celebrity being interviewed on a bright studio set, the player holding a remote with a proud, teary smile, school photos on the wall.
6. A new education law: a school staffroom, the player and two colleagues staring at a tower of new blank textbooks and forms that reaches the ceiling, an old stack of last year's books being carried out.
```

## cards-62: influencers and hospitality

`card.influencer_dodgy_brand`, `card.influencer_shadowban`, `card.influencer_viral`, `card.hospitality_star`, `card.hospitality_inspection`, `card.hospitality_next_door`

```text
[the block above]
1. A brand that pays too well: the player holding up a suspicious green bottle of slimming tea to a ring light and a phone on a tripod, a forced smile, a pile of identical boxes behind, a stack of cash on the table.
2. The shadowban: the player in a dark bedroom lit by a phone, staring at a blank social media screen with an empty heart count, the ring light switched off behind them, a small ghost icon drifting over the phone.
3. A week of going viral: the player on a city street surrounded by people pointing phones at them, a giant billboard behind showing a blank frame of their face, notifications bursting like confetti in the air.
4. A shot at a star: a restaurant kitchen at night, the player as head chef plating a tiny perfect dish with tweezers, the brigade watching in silence, a mysterious diner in a long coat seen through the pass at a corner table.
5. The health inspection: a walk-in cold room with frost on the walls and a broken thermostat dial, an inspector in a white coat with a blank clipboard, and the player wincing beside a puddle on the floor.
6. The bar next door: a narrow street at night, an empty bar with chairs stacked on tables and a blank lease sign in the window, the player in an apron standing outside it with keys in hand, their own busy restaurant lit next door.
```

## cards-63: sales, and three career moves for later

`card.sales_giant_client`, `card.sales_quota`, `card.sales_poached`. Panels 4 to 6 are not wired yet: the influencer going viral, the lawyer's bid for
partner and the doctor's private practice, kept for the career moves' scenes.

```text
[the block above]
1. The giant client: a glass boardroom high above the city, a very long table, the player in a suit presenting a blank chart to a row of stern executives at the far end, a colleague at their side holding a laptop.
2. An impossible quota: a sales floor at night, a big screen on the wall showing a blank bar chart with one bar towering far above the rest, the player at their desk with a headset, rubbing their eyes.
3. The competitor calls: a quiet café, a rival's manager in a smart suit sliding a blank business card across the table, and the player clutching a fat contacts book to their chest, tempted.
4. Going viral: a creator filming themselves with a phone on a gimbal in a busy street, a crowd gathering round, a rocket of hearts rising from the phone.
5. The bid for partner: a law firm's wood-panelled boardroom, the player standing alone before a row of senior partners in a semicircle, one of them holding a blank envelope.
6. A private practice: a small, warm private consulting room in the evening, the player in a white coat greeting a patient at the door, a brass plate as a blank shape on the wall outside.
```
