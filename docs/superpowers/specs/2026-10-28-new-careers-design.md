# Four new careers: pilot, architect, estate agent, soldier

Each career is a ladder (`careers.ts`), a life that starts on it (`lives.ts`), its moves (a point of focus, judged at the round's end), the names of
its three job uses of focus (overtime, study, job hunt), three or four cards of its own (`careers: ['<id>']`), and its pictures. Nothing here needs
the engine to change: every effect is one a card or a move already has (`job`, `recurring`, `pension`, `property` at a price, `moveCity`,
`cyclePct` by the economy's state: expansion, boom, slowdown, recession). Content goes to the next version; the bundle and the server ship with it.

Salaries are a percent of the city's median (Madrid 32k, London 58k, New York 75k). For scale: tech goes 105 → 205 %, finance 130 → 350 %, medicine
110 → 260 %.

## ✈️ Pilot (`aviation`, icon drawn)

**The lesson:** an expensive start bought on debt, a great salary afterwards, and a job the economy can ground.

| Rung | Title | Salary | Skill | Status |
|---|---|---|---|---|
| 0 | Second officer | 90 % | 0 | 4 |
| 1 | First officer | 150 % | 6 | 9 |
| 2 | Captain | 230 % | 16 | 16 |
| 3 | Senior captain | 280 % | 28 | 22 |

- **The economy:** `cyclePct: { boom: 5, slowdown: -10, recession: -30 }`. Planes are grounded in a recession.
- **Overtime:** 6 %, "Extra rotations". **Study:** "Type rating". **Job hunt:** "Apply to another airline".
- **Moves:**
  - *Long-haul* (rung 1–2): the pay goes up 8 %, and health takes a hit 30 % of the time.
  - *The flag carrier* (rung 2–3, helped by languages): a rung up and +3 status, or nothing.
- **The life, "Pilot cadet":** Madrid, $2k cash, a $70k training loan at 6 % over 8 rounds, Frugal, a room, languages +2.
- **Cards:**
  1. *The medical:* a heart murmur at the yearly check. Pay for a specialist (cash) to keep the licence, or be grounded for a round (a rung down).
  2. *The strike:* join it (a round of less pay, then +4 % for good, 60 %) or fly (status −2 among colleagues, pay kept).
  3. *A base abroad:* the airline offers Dubai or Singapore. Move with the job (`moveCity`, pay +10 %), or stay.
  4. *Grounded* (in a recession only): leave on half pay for a round, or take a cargo job (pay −20 % for good, safe).

## 🏗️ Architect (`construction`, icon drawn)

**The lesson:** pay that follows the property cycle, and the chance to build for oneself.

| Rung | Title | Salary | Skill | Status |
|---|---|---|---|---|
| 0 | Junior architect | 80 % | 0 | 4 |
| 1 | Project architect | 110 % | 5 | 8 |
| 2 | Lead architect | 150 % | 13 | 13 |
| 3 | Studio partner | 210 % | 24 | 20 |

- **The economy:** `cyclePct: { boom: 15, expansion: 5, slowdown: -10, recession: -25 }`. It moves with the housing market.
- **Overtime:** 5 %, "Competition nights". **Study:** "Master's in structures". **Job hunt:** "Move to a bigger studio". Can be remote.
- **Moves:**
  - *Enter a competition* (rung 1–3, helped by network): 25 % a prize (+5 status, +$15k cash), else nothing.
  - *Your own studio* (rung 3): $10k of passive income a year and +2 status, or −3 status if it fails (45 %).
- **The life, "Architecture graduate":** Madrid, $3k, Frugal, a room, a $25k loan, management +1.
- **Cards:**
  1. *Design your own house:* buy a home at 80 % of its price (`property`, `pricePct: 80`), the architect's discount.
  2. *The developer who does not pay:* sue (cash and a round, 60 % you are paid with interest) or let it go (lose the invoice).
  3. *The collapse:* a balcony you signed cracks. Insurance pays if you hold it, else cash; status −3 either way.
  4. *The famous client:* a celebrity's villa. +6 status and a fee, or turn it down to keep a round's focus.

## 🏠 Estate agent (`realestate`, icon to draw)

**The lesson:** commission is feast or famine, and knowing the market is worth money of your own.

| Rung | Title | Salary | Skill | Status |
|---|---|---|---|---|
| 0 | Trainee agent | 60 % | 0 | 2 |
| 1 | Agent | 95 % | 4 | 5 |
| 2 | Senior agent | 140 % | 10 | 9 |
| 3 | Branch director | 200 % | 20 | 15 |
| 4 | Agency owner | 260 % | 32 | 20 |

- **The economy:** `cyclePct: { boom: 30, expansion: 10, slowdown: -15, recession: -35 }`, the widest swing of any career.
- **Overtime:** 10 %, "Open houses at weekends". **Study:** "Property law course". **Job hunt:** "Move to a luxury agency".
- **Moves:**
  - *The luxury portfolio* (rung 1–3, helped by negotiation): +10 % pay for good (55 %), or nothing.
  - *Open your own agency* (rung 3): a rung up and $12k a year passive (50 %), or −$10k cash.
- **The life, "Estate agent":** New York, $2.5k, Frugal, a room, negotiation +2, network +1. No debt, low pay.
- **Cards:**
  1. *The off-market flat:* buy a rental before it is listed, at 85 % of its price (`property`, `rented: true`).
  2. *A seller in a hurry:* tell your investor client (+$5k commission) or buy it yourself at 80 % (a mortgage).
  3. *The bubble talk* (boom only): sell your own flat now at the top, or hold on.
  4. *The double commission:* take a fee from both sides (cash +, 30 % a fine and −4 status) or play it straight.

## 🎖️ Soldier (`military`, icon to draw)

**The lesson:** a modest, safe pay, little to spend it on, and a pension that comes early.

| Rung | Title | Salary | Skill | Status |
|---|---|---|---|---|
| 0 | Private | 70 % | 0 | 4 |
| 1 | Sergeant | 90 % | 5 | 7 |
| 2 | Lieutenant | 115 % | 12 | 11 |
| 3 | Captain | 145 % | 20 | 15 |
| 4 | Colonel | 185 % | 32 | 21 |

- **The economy:** no cycle at all; the pay never falls.
- **Overtime:** 8 %, "Volunteer for a mission". **Study:** "Officer academy". **Job hunt:** "Transfer to another unit". +1 focus a round (life on base is cheap in time).
- **Moves:**
  - *Special forces selection* (rung 0–2, helped by health): a rung up and +4 status (35 %), else health −1.
- **The life, "Recruit":** Madrid, $1.5k, Frugal, a room, health +3.
- **Cards:**
  1. *A mission abroad:* six months away. +$12k bonus and +3 status, with 20 % an injury (health −2). Or refuse (status −2).
  2. *Twenty years of service* (from round 10): leave with a pension for life (`pension`, `recurring` passive income worth about half the pay) and a civilian job a rung down, or stay on.
  3. *The posting:* moved to another city with the army (`moveCity`), no cost, or ask to stay (a round without promotion).
  4. *The contractor's offer* (rung 2+): private security abroad, pay +60 % for good, health −1 and status −3.

## Pictures

- **Icons:** `icon.career_realestate` and `icon.career_military`, the size and style of the 16 that exist.
- **Portraits:** one for each new life, at the four ages (22, 32, 45, 58), as the others.
- **Cards:** 15 cards, three standard sheets of 6 panels (2×3, 1586×992): `cards-55` pilot and architect, `cards-56` estate agent and soldier,
  `cards-57` the three left over and a career-move scene. Prompts in the v24 pack.
- **Focus uses:** the three job uses reuse the existing focus icons.

## How it is checked

- `pnpm balance` on each new life: escape 15–45 %, no bot on top in more than 40 % of its lives, and the best bot's median within the band of
  the other lives (330–470 at the last measure).
- The content tests (every card dealt somewhere, every move reachable, words in three languages), the scenes, and the full suite.
- How the lives are unlocked: open from the start, or by a milestone (to choose: the pilot at the first $100k, the soldier after a bankruptcy?).
