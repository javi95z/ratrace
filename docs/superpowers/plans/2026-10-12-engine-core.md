# Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic money engine: a seeded world of markets, rates and property, and a player whose trades, debts, income, expenses and taxes resolve round by round into a score.

**Architecture:** A pure TypeScript package, `packages/engine`, with no dependencies. `createGame` builds the whole 20-round world timeline from the seed alone, so the world never depends on a player. `applyRound` clones the state, executes the player's orders, and resolves the round in a fixed order. Game data is passed in as a `Content` value; this plan uses a small test fixture, and the real content arrives in plan 2.

**Tech Stack:** Node 22 or newer, pnpm workspaces, TypeScript (strict), Vitest, fast-check, ESLint with typescript-eslint.

**Spec:** `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md`

**Status: executed, then corrected.** All ten tasks were built as written. The final review then found defects in this plan's design (not in the transcription), and one fix pass corrected them: commits after `95cc4a7`. Where this plan's code blocks and the repository differ, the repository and the spec are right. The main changes are listed in the spec under 3.2, 3.7, 3.8, 3.12, 3.14 and 8.2.

**Plan series for milestone 1:**

1. **Engine core** (this plan): money, RNG, world, tax, portfolio, debt, property, scoring, round resolution.
2. Life systems and content: cards, career, focus, family, insurance, status items, finance-skill gating, moving city, news, and the v1 data package.
3. Terminal game and balance harness: a playable CLI and the bot simulations with acceptance bands.

## Global Constraints

- Money is integer cents. Rates and returns are integer basis points (1 bp = 0.01%).
- Engine code may use only `+ - * /`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.sqrt`, `Math.min`, `Math.max`, `Math.abs` and `Math.imul`.
- Engine code must not use `Math.exp`, `Math.log`, `Math.pow`, the `**` operator, trigonometry, `Math.random` or `Date`. ESLint enforces this.
- No value stored in state may be negative zero. Use `round()` from `money.ts`, never bare `Math.round`, for any value that is stored.
- `packages/engine` has no runtime dependencies and imports nothing outside itself.
- The world (regime, rates, inflation, asset returns, property indexes) derives from the seed alone.
- Round resolution follows the order in spec section 3.2.
- `applyRound` never mutates the state it is given.
- All state is plain JSON: no classes, `undefined`, `Map`, `Set` or `Date` inside `GameState`.
- A round is 2 years. A game is 20 rounds.
- Test files end in `.test.ts` and sit beside the code they test.
- Commit after every task with the message given in the task.

## Review Focus

1. **Malformed amounts.** A UI slider or a bad save sends `12.5`, `0`, `-5`, `NaN`, `Infinity` or a number past the safe-integer range. Expected: the order is rejected with a reason and nothing changes. Pinned in Task 6 and Task 7.
2. **Stale or hostile IDs.** An order names a position that was already sold, an unknown debt or property, or a key such as `__proto__`. Expected: rejected, no crash, no prototype damage. Pinned in Task 6 and Task 7.
3. **A life with no income.** Salary is zero for many rounds. Expected: shortfalls land on the credit card, bankruptcy triggers once, credit is locked for three rounds, and the game still reaches the final round. Pinned in Task 9.
4. **Selling a property that is worth less than its mortgage.** Expected: the sale goes through, the mortgage is cleared, and the shortfall becomes credit card debt; cash is never negative after the round. Pinned in Task 9.
5. **Saved and reloaded games.** State passes through `JSON.stringify` and `JSON.parse` between rounds, or a finished game is passed to `applyRound`. Expected: identical results after a round trip; a clear error for a finished game. Pinned in Task 9 and Task 10.

## File Structure

```
package.json                     root scripts and dev dependencies
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts
eslint.config.js                 bans non-deterministic maths in the engine
.gitignore
packages/engine/
  package.json
  tsconfig.json
  src/
    index.ts                     public exports
    money.ts                     cents and basis-point arithmetic
    rng.ts                       seeded random streams
    types.ts                     every shared type
    lookup.ts                    find a city by id
    player.ts                    create a player, mint ids
    validate.ts                  check a Content value
    world.ts                     build the world timeline
    tax.ts                       tax bill for a round
    portfolio.ts                 buy, sell, deposit, pension, price growth
    debt.ts                      loans, credit card, bankruptcy
    property.ts                  buy, sell, rent, price growth
    economy.ts                   income and expenses for a round
    scoring.ts                   wealth points and escape multiplier
    orders.ts                    route an order to its module
    game.ts                      createGame and applyRound
    selectors.ts                 net worth, cashflow, final score
    hash.ts                      stable hash of a state
    lint-guard.test.ts
    determinism.test.ts
    properties.test.ts
    replay.test.ts
    testing/
      fixture.ts                 small Content used by tests
      play.ts                    play a whole game from a strategy
```

---

### Task 1: Workspace and lint guard

**Files:**
- Create: `.nvmrc`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts`
- Test: `packages/engine/src/lint-guard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: commands `pnpm test`, `pnpm lint`, `pnpm typecheck`. A single test file runs with `pnpm vitest run <path>`.

- [ ] **Step 1: Check the tools**

Run: `nvm use 22 && node -v && pnpm -v`
Expected: Node `v22.22.2` and pnpm `9.1.3`. Both are already installed on this machine. The default shell Node is v18, which is too old, so every command in this plan assumes Node 22 is active. In a shell without nvm loaded, prefix each command with `PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`.

- [ ] **Step 2: Create the root files**

`.nvmrc`:

```
22
```

`package.json`:

```json
{
  "name": "ratrace",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p packages/engine"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["node"]
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'tools/*/src/**/*.test.ts'],
  },
});
```

`.gitignore`:

```
node_modules
dist
.DS_Store
*.tsbuildinfo
```

`eslint.config.js`:

```js
import tseslint from 'typescript-eslint';

const bannedMath = [
  'exp', 'expm1', 'log', 'log2', 'log10', 'log1p', 'pow',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'cbrt', 'hypot', 'random',
];

export default [
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...bannedMath.map((property) => ({
          object: 'Math',
          property,
          message: 'Not identical across JavaScript engines. Use + - * /, Math.floor, Math.round or Math.sqrt.',
        })),
      ],
      'no-restricted-globals': ['error', { name: 'Date', message: 'The engine has no clock.' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: 'Exponentiation is not identical across JavaScript engines. Multiply instead.',
        },
      ],
    },
  },
];
```

- [ ] **Step 3: Create the engine package**

`packages/engine/package.json`:

```json
{
  "name": "@ratrace/engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" }
}
```

`packages/engine/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/engine/src/index.ts`:

```ts
export {};
```

- [ ] **Step 4: Install dev dependencies**

Run: `pnpm add -Dw typescript vitest fast-check eslint typescript-eslint @types/node`
Expected: a `pnpm-lock.yaml` is written and the command exits 0.

- [ ] **Step 5: Write the failing lint-guard test**

`packages/engine/src/lint-guard.test.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function lint(code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, 'packages/engine/src/sample.ts'),
  });
  return result.messages.map((m) => m.ruleId ?? 'fatal');
}

describe('engine lint guard', () => {
  it('rejects non-deterministic maths, the clock and Math.random', async () => {
    expect(await lint('export const a = Math.exp(1);\n')).toContain('no-restricted-properties');
    expect(await lint('export const a = Math.random();\n')).toContain('no-restricted-properties');
    expect(await lint('export const a = 2 ** 10;\n')).toContain('no-restricted-syntax');
    expect(await lint('export const a = Date.now();\n')).toContain('no-restricted-globals');
  });

  it('accepts exact maths', async () => {
    expect(await lint('export const a = Math.floor(Math.sqrt(2) * 3) + Math.round(1.5);\n')).toEqual([]);
  });
});
```

- [ ] **Step 6: Run the checks**

Run: `pnpm vitest run packages/engine/src/lint-guard.test.ts`
Expected: 2 tests pass. To see the guard fail first, temporarily delete the `no-restricted-properties` rule from `eslint.config.js`, run again and watch the first test fail, then restore the rule.

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: workspace, engine package and determinism lint guard"
```

This first commit also records the spec, this plan and the art prompt pack.

---

### Task 2: Money arithmetic and seeded RNG

**Files:**
- Create: `packages/engine/src/money.ts`, `packages/engine/src/rng.ts`
- Test: `packages/engine/src/money.test.ts`, `packages/engine/src/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Cents = number`, `type Bp = number`, `const BP = 10_000`
  - `round(x: number): number`
  - `applyBp(amount: Cents, bp: Bp): Cents`
  - `mulDiv(a: number, b: number, c: number): number`
  - `clamp(x: number, lo: number, hi: number): number`
  - `isAmount(x: unknown): x is Cents`
  - `type RngState = [number, number, number, number]`
  - `seedRng(seed: string, stream: string): RngState`
  - `class Rng` with `u32()`, `float()`, `int(n)`, `chance(pct)`, `normal()`, `pickWeighted(items)`, `snapshot()`

- [ ] **Step 1: Write the failing money tests**

`packages/engine/src/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyBp, clamp, isAmount, mulDiv, round } from './money';

describe('money', () => {
  it('applies basis points and rounds to the nearest cent', () => {
    expect(applyBp(10_000, 250)).toBe(250);
    expect(applyBp(333, 5_000)).toBe(167);
    expect(applyBp(1_000, -2_500)).toBe(-250);
  });

  it('never returns negative zero', () => {
    expect(Object.is(round(-0.2), 0)).toBe(true);
    expect(Object.is(applyBp(0, -500), 0)).toBe(true);
  });

  it('splits proportionally with floor', () => {
    expect(mulDiv(10, 3, 4)).toBe(7);
    expect(() => mulDiv(1, 1, 0)).toThrow('division by zero');
  });

  it('clamps to a range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('accepts only positive safe integers as amounts', () => {
    expect(isAmount(1)).toBe(true);
    expect(isAmount(50_000_000)).toBe(true);
    const bad: unknown[] = [0, -5, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2, '100', null, undefined];
    for (const value of bad) expect(isAmount(value)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/money.test.ts`
Expected: FAIL, cannot resolve `./money`.

- [ ] **Step 3: Implement money**

`packages/engine/src/money.ts`:

```ts
export type Cents = number;
export type Bp = number;

export const BP = 10_000;

/** Math.round that never returns negative zero. */
export function round(x: number): number {
  return Math.round(x) + 0;
}

/** amount × bp / 10000, rounded to the nearest cent. */
export function applyBp(amount: Cents, bp: Bp): Cents {
  return round((amount * bp) / BP);
}

/** floor(a × b / c), for proportional splits. */
export function mulDiv(a: number, b: number, c: number): number {
  if (c === 0) throw new Error('mulDiv: division by zero');
  return Math.floor((a * b) / c) + 0;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** True for a positive whole number of cents that adds and subtracts exactly. */
export function isAmount(x: unknown): x is Cents {
  return typeof x === 'number' && Number.isSafeInteger(x) && x > 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/money.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Write the failing RNG tests**

`packages/engine/src/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Rng, seedRng } from './rng';
import type { RngState } from './rng';

const take = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.u32());

describe('rng', () => {
  it('gives the same sequence for the same seed and stream', () => {
    expect(take(new Rng(seedRng('s', 'market')), 20)).toEqual(take(new Rng(seedRng('s', 'market')), 20));
  });

  it('gives different sequences for different seeds and streams', () => {
    const base = take(new Rng(seedRng('s', 'market')), 20);
    expect(take(new Rng(seedRng('s', 'cards')), 20)).not.toEqual(base);
    expect(take(new Rng(seedRng('t', 'market')), 20)).not.toEqual(base);
  });

  it('continues exactly from a snapshot, also after a JSON round trip', () => {
    const a = new Rng(seedRng('s', 'market'));
    take(a, 10);
    const saved = JSON.parse(JSON.stringify(a.snapshot())) as RngState;
    const b = new Rng(saved);
    expect(take(b, 5)).toEqual(take(a, 5));
  });

  it('keeps float in [0, 1) and int in range', () => {
    const r = new Rng(seedRng('f', 'x'));
    for (let i = 0; i < 5_000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it('normal is centred near zero and bounded', () => {
    const r = new Rng(seedRng('n', 'x'));
    let sum = 0;
    for (let i = 0; i < 20_000; i++) {
      const z = r.normal();
      expect(z).toBeGreaterThanOrEqual(-6);
      expect(z).toBeLessThanOrEqual(6);
      sum += z;
    }
    expect(Math.abs(sum / 20_000)).toBeLessThan(0.05);
  });

  it('pickWeighted respects weights', () => {
    const r = new Rng(seedRng('w', 'x'));
    let a = 0;
    for (let i = 0; i < 10_000; i++) {
      if (r.pickWeighted([['a', 90], ['b', 10]] as const) === 'a') a++;
    }
    expect(a).toBeGreaterThan(8_700);
    expect(a).toBeLessThan(9_300);
  });

  it('chance(0) never fires and chance(100) always fires', () => {
    const r = new Rng(seedRng('c', 'x'));
    for (let i = 0; i < 1_000; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(100)).toBe(true);
    }
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/rng.test.ts`
Expected: FAIL, cannot resolve `./rng`.

- [ ] **Step 7: Implement the RNG**

`packages/engine/src/rng.ts`:

```ts
export type RngState = [number, number, number, number];

/** xmur3 string hash: returns a function that yields successive 32-bit seeds. */
function hashSeed(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** Each named stream is independent, so drawing a card never shifts market prices. */
export function seedRng(seed: string, stream: string): RngState {
  const next = hashSeed(`${seed}::${stream}`);
  return [next(), next(), next(), next()];
}

/** sfc32 generator. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  u32(): number {
    this.a |= 0;
    this.b |= 0;
    this.c |= 0;
    this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  float(): number {
    return this.u32() / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** True with the given probability in percent. */
  chance(pct: number): boolean {
    return this.float() * 100 < pct;
  }

  /** Approximately standard normal: twelve uniforms summed, minus six. Range [-6, 6]. */
  normal(): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.float();
    return sum - 6;
  }

  pickWeighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    let total = 0;
    for (const [, weight] of items) total += weight;
    let r = this.float() * total;
    for (const [item, weight] of items) {
      if (r < weight) return item;
      r -= weight;
    }
    return items[items.length - 1][0];
  }

  snapshot(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/rng.test.ts && pnpm lint && pnpm typecheck`
Expected: 7 tests pass; lint and typecheck exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(engine): cents and basis-point arithmetic, seeded RNG streams"
```

---

### Task 3: Types, test fixture, player and content validation

**Files:**
- Create: `packages/engine/src/types.ts`, `packages/engine/src/lookup.ts`, `packages/engine/src/player.ts`, `packages/engine/src/validate.ts`, `packages/engine/src/testing/fixture.ts`
- Test: `packages/engine/src/validate.test.ts`, `packages/engine/src/player.test.ts`

**Interfaces:**
- Consumes: `Cents`, `Bp` from `money.ts`.
- Produces:
  - Every type in `types.ts` below. Later tasks import from it by name.
  - `cityOf(content: Content, cityId: string): CityDef` (throws `unknown city: <id>`)
  - `newId(p: PlayerState, prefix: string): string` (returns `<prefix>-<n>`, incrementing `p.nextId`)
  - `newPlayer(start: StartConfig): PlayerState`
  - `validateContent(content: Content): string[]` (empty array means valid)
  - `fixtureContent(): Content` and `fixtureStart(): StartConfig`

- [ ] **Step 1: Write the types**

`packages/engine/src/types.ts`:

```ts
import type { Bp, Cents } from './money';

export type Regime = 'expansion' | 'boom' | 'slowdown' | 'recession' | 'recovery';
export type CryptoPhase = 'accumulation' | 'bull' | 'mania' | 'winter';
export type AssetClass = 'bond' | 'equity' | 'crypto' | 'gold';
export type LifestyleTier = 0 | 1 | 2 | 3;

export interface AssetDef {
  id: string;
  class: AssetClass;
  /** Sensitivity to the class move, in percent. 100 moves with the class. */
  betaPct: number;
  /** Asset-specific volatility per round, in bp. */
  idioVolBp: Bp;
  /** Annual dividend yield in bp. Bonds use yieldSpreadBp instead. */
  yieldBp: Bp;
  /** Bonds only: price sensitivity to rate changes, in years. */
  durationYears?: number;
  /** Bonds only: annual yield above the policy rate, in bp. */
  yieldSpreadBp?: Bp;
  /** Chance per round, in percent, of a 90% crash. */
  crashChancePct?: number;
}

export interface MarketParams {
  regimeTransitions: Record<Regime, ReadonlyArray<readonly [Regime, number]>>;
  cryptoTransitions: Record<CryptoPhase, ReadonlyArray<readonly [CryptoPhase, number]>>;
  /** Mean return per round, in bp. */
  equityMeanBp: Record<Regime, Bp>;
  cryptoMeanBp: Record<CryptoPhase, Bp>;
  goldMeanBp: Record<Regime, Bp>;
  classVolBp: Record<'equity' | 'crypto' | 'gold', Bp>;
  /** Policy-rate change per round in bp, before noise. */
  rateDriftBp: Record<Regime, Bp>;
  rateNoiseBp: Bp;
  inflationTargetBp: Record<Regime, Bp>;
  inflationNoiseBp: Bp;
  /** Deposit rate = policy rate minus this spread, floored at zero. */
  depositSpreadBp: Bp;
  start: { regime: Regime; cryptoPhase: CryptoPhase; policyRateBp: Bp; inflationBp: Bp };
}

export interface TaxProfile {
  /** Marginal rates in bp for the three brackets. */
  incomeRatesBp: readonly [Bp, Bp, Bp];
  capitalGainsBp: Bp;
  dividendBp: Bp;
  /** If true, rent is added to salary and taxed through the brackets. */
  rentAsIncome: boolean;
  rentBp: Bp;
  propertyPurchaseBp: Bp;
  propertyAnnualBp: Bp;
  /** Pension contributions up to this share of salary, in bp, reduce taxable income. */
  pensionDeductionCapBp: Bp;
  /** Gains plus dividends up to this amount per round are tax-free. */
  investmentAllowance: Cents;
}

export interface CityDef {
  id: string;
  medianSalaryAnnual: Cents;
  livingCostAnnual: Cents;
  /** Price of the reference flat. Other property types scale from it. */
  flatPrice: Cents;
  /** Annual rent as a share of property value, in bp. */
  rentYieldBp: Bp;
  /** Base property growth per round, in bp. */
  propertyGrowthBp: Bp;
  /** Share of last round's return carried into this round, in percent. */
  propertyMomentumPct: number;
  /** Return in bp lost for each bp the policy rate rises. */
  propertyRateSensitivity: number;
  propertyVolBp: Bp;
  tax: TaxProfile;
}

export interface PropertyTypeDef {
  id: string;
  /** Price as a percent of the city's flat price. */
  pricePct: number;
}

export interface DebtParams {
  personalLoanSpreadBp: Bp;
  mortgageSpreadBp: Bp;
  creditCardRateBp: Bp;
  mortgageTermRounds: number;
  personalLoanTermRounds: number;
  /** Largest mortgage as a share of the price, in bp. */
  mortgageMaxLtvBp: Bp;
  /** Personal loans may total this percent of annual salary. */
  personalLoanMaxIncomePct: number;
  /** Bankruptcy when credit card debt exceeds this multiple of annual income. */
  bankruptcyIncomeMultiple: number;
  bankruptcyLockRounds: number;
  /** Discount on forced sales, in bp. */
  fireSaleDiscountBp: Bp;
}

export interface ScoringParams {
  /** [net worth in cents, points], strictly increasing by net worth. */
  wealthBreakpoints: ReadonlyArray<readonly [Cents, number]>;
  escapeBase: number;
  escapePerRoundLeft: number;
}

export interface Content {
  rounds: number;
  yearsPerRound: number;
  /** Living-cost multiplier in percent for lifestyle tiers 0 to 3. */
  lifestyleMultiplierPct: readonly [number, number, number, number];
  /** Share of living cost that is housing, in percent. Waived for owner-occupiers. */
  housingSharePct: number;
  /** The pension follows this asset's return. */
  pensionAssetId: string;
  assets: ReadonlyArray<AssetDef>;
  market: MarketParams;
  cities: ReadonlyArray<CityDef>;
  propertyTypes: ReadonlyArray<PropertyTypeDef>;
  debt: DebtParams;
  scoring: ScoringParams;
}

export interface WorldState {
  round: number;
  regime: Regime;
  cryptoPhase: CryptoPhase;
  policyRateBp: Bp;
  inflationBp: Bp;
  /** Return of each asset over the round that just ended, in bp. Zero at round 0. */
  assetReturnBp: Record<string, Bp>;
  /** Price index per asset. Starts at 10000. */
  assetIndex: Record<string, number>;
  propertyReturnBp: Record<string, Bp>;
  propertyIndex: Record<string, number>;
}

export interface Position {
  value: Cents;
  /** What was paid for the part still held. */
  basis: Cents;
}

export type DebtKind = 'mortgageFixed' | 'mortgageVariable' | 'personalLoan' | 'creditCard';

export interface Debt {
  id: string;
  kind: DebtKind;
  principal: Cents;
  /** Annual rate in bp. Ignored for variable mortgages and credit cards. */
  fixedRateBp: Bp;
  roundsLeft: number;
}

export interface Property {
  id: string;
  cityId: string;
  typeId: string;
  value: Cents;
  basis: Cents;
  rented: boolean;
  mortgageId: string | null;
}

export interface PlayerState {
  cityId: string;
  cash: Cents;
  deposit: Cents;
  pension: Cents;
  positions: Record<string, Position>;
  properties: Property[];
  debts: Debt[];
  salaryAnnual: Cents;
  lifestyleTier: LifestyleTier;
  /** Upkeep, family and insurance. Set by the life systems in plan 2. */
  extraExpensesAnnual: Cents;
  /** Business profit and similar. Set by the life systems in plan 2. */
  extraPassiveAnnual: Cents;
  statusPoints: number;
  nextId: number;
  /** Consecutive rounds in which passive income covered expenses. */
  passiveStreak: number;
  escapedAtRound: number | null;
  /** Borrowing is refused while the current round is below this. */
  bankruptUntilRound: number;
}

export type Order =
  | { type: 'buy'; assetId: string; amount: Cents }
  | { type: 'sell'; assetId: string; amount: Cents }
  | { type: 'depositIn'; amount: Cents }
  | { type: 'depositOut'; amount: Cents }
  | { type: 'pensionIn'; amount: Cents }
  | { type: 'borrow'; amount: Cents }
  | { type: 'repay'; debtId: string; amount: Cents }
  | { type: 'buyProperty'; typeId: string; downPayment: Cents; mortgage: 'fixed' | 'variable' | 'none'; rented: boolean }
  | { type: 'sellProperty'; propertyId: string }
  | { type: 'setRented'; propertyId: string; rented: boolean };

export interface RoundChoices {
  orders: Order[];
}

export type LedgerLine =
  | 'salary'
  | 'dividends'
  | 'interest'
  | 'rent'
  | 'otherPassive'
  | 'living'
  | 'otherExpenses'
  | 'debtInterest'
  | 'debtPrincipal'
  | 'incomeTax'
  | 'investmentTax'
  | 'propertyTax'
  | 'creditCardDraw';

export type GameEvent =
  | { kind: 'orderRejected'; order: Order; reason: string }
  | { kind: 'ledger'; line: LedgerLine; amount: Cents }
  | { kind: 'escaped'; round: number }
  | { kind: 'bankrupt' };

export interface StartConfig {
  cityId: string;
  cash: Cents;
  salaryAnnual: Cents;
  lifestyleTier: LifestyleTier;
  debts: Array<Omit<Debt, 'id'>>;
}

export interface GameConfig {
  content: Content;
  start: StartConfig;
}

export interface GameState {
  seed: string;
  /** Rounds completed so far. */
  round: number;
  /** One world state per round boundary: length is rounds + 1. */
  timeline: WorldState[];
  player: PlayerState;
  finished: boolean;
}
```

- [ ] **Step 2: Write the fixture**

`packages/engine/src/testing/fixture.ts`:

```ts
import type { Content, StartConfig, TaxProfile } from '../types';

const USD = 100;

const homeTax: TaxProfile = {
  incomeRatesBp: [1_900, 3_000, 4_500],
  capitalGainsBp: 2_100,
  dividendBp: 2_100,
  rentAsIncome: false,
  rentBp: 2_100,
  propertyPurchaseBp: 800,
  propertyAnnualBp: 30,
  pensionDeductionCapBp: 1_000,
  investmentAllowance: 0,
};

const havenTax: TaxProfile = {
  incomeRatesBp: [0, 0, 0],
  capitalGainsBp: 0,
  dividendBp: 0,
  rentAsIncome: false,
  rentBp: 0,
  propertyPurchaseBp: 400,
  propertyAnnualBp: 0,
  pensionDeductionCapBp: 0,
  investmentAllowance: 0,
};

const base: Content = {
  rounds: 20,
  yearsPerRound: 2,
  lifestyleMultiplierPct: [70, 100, 140, 200],
  housingSharePct: 35,
  pensionAssetId: 'fund_world',
  assets: [
    { id: 'bond_long', class: 'bond', betaPct: 100, idioVolBp: 0, yieldBp: 0, durationYears: 8, yieldSpreadBp: 50 },
    { id: 'fund_world', class: 'equity', betaPct: 100, idioVolBp: 300, yieldBp: 180 },
    { id: 'stock_growth', class: 'equity', betaPct: 140, idioVolBp: 1_800, yieldBp: 0 },
    { id: 'stock_dividend', class: 'equity', betaPct: 70, idioVolBp: 900, yieldBp: 320 },
    { id: 'coin_major', class: 'crypto', betaPct: 100, idioVolBp: 2_500, yieldBp: 0 },
    { id: 'coin_meme', class: 'crypto', betaPct: 180, idioVolBp: 6_000, yieldBp: 0, crashChancePct: 8 },
    { id: 'gold', class: 'gold', betaPct: 100, idioVolBp: 600, yieldBp: 0 },
  ],
  market: {
    regimeTransitions: {
      expansion: [['expansion', 45], ['boom', 25], ['slowdown', 25], ['recession', 5]],
      boom: [['boom', 25], ['slowdown', 45], ['recession', 25], ['expansion', 5]],
      slowdown: [['recession', 40], ['expansion', 35], ['slowdown', 25]],
      recession: [['recovery', 65], ['recession', 35]],
      recovery: [['expansion', 65], ['boom', 15], ['recovery', 20]],
    },
    cryptoTransitions: {
      accumulation: [['accumulation', 40], ['bull', 55], ['winter', 5]],
      bull: [['mania', 45], ['bull', 30], ['winter', 25]],
      mania: [['winter', 75], ['mania', 15], ['bull', 10]],
      winter: [['accumulation', 60], ['winter', 40]],
    },
    equityMeanBp: { expansion: 1_400, boom: 2_400, slowdown: 300, recession: -2_200, recovery: 1_800 },
    cryptoMeanBp: { accumulation: 1_000, bull: 9_000, mania: 20_000, winter: -6_000 },
    goldMeanBp: { expansion: 300, boom: 0, slowdown: 600, recession: 1_400, recovery: 200 },
    classVolBp: { equity: 1_400, crypto: 5_000, gold: 900 },
    rateDriftBp: { expansion: 50, boom: 100, slowdown: -25, recession: -150, recovery: -25 },
    rateNoiseBp: 40,
    inflationTargetBp: { expansion: 220, boom: 380, slowdown: 250, recession: 80, recovery: 180 },
    inflationNoiseBp: 80,
    depositSpreadBp: 100,
    start: { regime: 'expansion', cryptoPhase: 'accumulation', policyRateBp: 250, inflationBp: 220 },
  },
  cities: [
    {
      id: 'home',
      medianSalaryAnnual: 30_000 * USD,
      livingCostAnnual: 18_000 * USD,
      flatPrice: 250_000 * USD,
      rentYieldBp: 450,
      propertyGrowthBp: 600,
      propertyMomentumPct: 30,
      propertyRateSensitivity: 4,
      propertyVolBp: 700,
      tax: homeTax,
    },
    {
      id: 'haven',
      medianSalaryAnnual: 60_000 * USD,
      livingCostAnnual: 40_000 * USD,
      flatPrice: 400_000 * USD,
      rentYieldBp: 600,
      propertyGrowthBp: 500,
      propertyMomentumPct: 30,
      propertyRateSensitivity: 3,
      propertyVolBp: 900,
      tax: havenTax,
    },
  ],
  propertyTypes: [
    { id: 'studio', pricePct: 60 },
    { id: 'flat', pricePct: 100 },
    { id: 'house', pricePct: 180 },
    { id: 'penthouse', pricePct: 400 },
    { id: 'villa', pricePct: 800 },
  ],
  debt: {
    personalLoanSpreadBp: 500,
    mortgageSpreadBp: 150,
    creditCardRateBp: 2_200,
    mortgageTermRounds: 12,
    personalLoanTermRounds: 3,
    mortgageMaxLtvBp: 8_000,
    personalLoanMaxIncomePct: 100,
    bankruptcyIncomeMultiple: 3,
    bankruptcyLockRounds: 3,
    fireSaleDiscountBp: 3_000,
  },
  scoring: {
    wealthBreakpoints: [
      [0, 0],
      [10_000 * USD, 100],
      [100_000 * USD, 200],
      [1_000_000 * USD, 300],
      [10_000_000 * USD, 400],
      [100_000_000 * USD, 500],
    ],
    escapeBase: 125,
    escapePerRoundLeft: 3,
  },
};

/** A fresh copy each call, so a test may alter it freely. */
export function fixtureContent(): Content {
  return structuredClone(base);
}

export function fixtureStart(): StartConfig {
  return { cityId: 'home', cash: 0, salaryAnnual: 30_000 * USD, lifestyleTier: 1, debts: [] };
}
```

- [ ] **Step 3: Write the failing tests**

`packages/engine/src/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixtureContent } from './testing/fixture';
import { validateContent } from './validate';

describe('validateContent', () => {
  it('accepts the fixture', () => {
    expect(validateContent(fixtureContent())).toEqual([]);
  });

  it('reports duplicate ids', () => {
    const c = fixtureContent();
    expect(validateContent({ ...c, assets: [...c.assets, c.assets[0]] })).toContain('duplicate asset id: bond_long');
    expect(validateContent({ ...c, cities: [...c.cities, c.cities[0]] })).toContain('duplicate city id: home');
  });

  it('reports a bond without duration', () => {
    const c = fixtureContent();
    const broken = { ...c, assets: [...c.assets, { id: 'b', class: 'bond' as const, betaPct: 100, idioVolBp: 0, yieldBp: 0 }] };
    expect(validateContent(broken)).toContain('bond b needs durationYears and yieldSpreadBp');
  });

  it('reports an unknown pension asset', () => {
    expect(validateContent({ ...fixtureContent(), pensionAssetId: 'nope' })).toContain('pensionAssetId nope is not an asset');
  });

  it('reports a transition row with no weight', () => {
    const c = fixtureContent();
    const market = { ...c.market, regimeTransitions: { ...c.market.regimeTransitions, boom: [] } };
    expect(validateContent({ ...c, market })).toContain('regime transitions from boom have no weight');
  });

  it('reports wealth breakpoints that do not increase', () => {
    const c = fixtureContent();
    const scoring = { ...c.scoring, wealthBreakpoints: [[0, 0], [0, 100]] as const };
    expect(validateContent({ ...c, scoring })).toContain('wealth breakpoints must be strictly increasing');
  });

  it('reports a tax rate out of range and a game with no cities or rounds', () => {
    const c = fixtureContent();
    const city = { ...c.cities[0], tax: { ...c.cities[0].tax, capitalGainsBp: 12_000 } };
    expect(validateContent({ ...c, cities: [city] })).toContain('city home has a tax rate outside 0..10000 bp');
    expect(validateContent({ ...c, cities: [] })).toContain('at least one city is required');
    expect(validateContent({ ...c, rounds: 0 })).toContain('rounds must be a positive integer');
  });
});
```

`packages/engine/src/player.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cityOf } from './lookup';
import { newId, newPlayer } from './player';
import { fixtureContent, fixtureStart } from './testing/fixture';

describe('player', () => {
  it('starts from the start config with nothing owned', () => {
    const p = newPlayer({ ...fixtureStart(), cash: 500 });
    expect(p.cash).toBe(500);
    expect(p.cityId).toBe('home');
    expect(p.positions).toEqual({});
    expect(p.properties).toEqual([]);
    expect(p.debts).toEqual([]);
    expect(p.escapedAtRound).toBeNull();
  });

  it('gives starting debts ids', () => {
    const p = newPlayer({
      ...fixtureStart(),
      debts: [{ kind: 'personalLoan', principal: 900_000, fixedRateBp: 600, roundsLeft: 3 }],
    });
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'personalLoan', principal: 900_000, fixedRateBp: 600, roundsLeft: 3 }]);
  });

  it('mints increasing ids', () => {
    const p = newPlayer(fixtureStart());
    expect(newId(p, 'property')).toBe('property-1');
    expect(newId(p, 'debt')).toBe('debt-2');
  });

  it('finds a city and throws for an unknown one', () => {
    expect(cityOf(fixtureContent(), 'haven').id).toBe('haven');
    expect(() => cityOf(fixtureContent(), 'atlantis')).toThrow('unknown city: atlantis');
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `pnpm vitest run packages/engine/src/validate.test.ts packages/engine/src/player.test.ts`
Expected: FAIL, cannot resolve `./validate`, `./player`, `./lookup`.

- [ ] **Step 5: Implement lookup, player and validation**

`packages/engine/src/lookup.ts`:

```ts
import type { CityDef, Content } from './types';

export function cityOf(content: Content, cityId: string): CityDef {
  const city = content.cities.find((c) => c.id === cityId);
  if (!city) throw new Error(`unknown city: ${cityId}`);
  return city;
}
```

`packages/engine/src/player.ts`:

```ts
import type { PlayerState, StartConfig } from './types';

export function newId(p: PlayerState, prefix: string): string {
  p.nextId += 1;
  return `${prefix}-${p.nextId}`;
}

export function newPlayer(start: StartConfig): PlayerState {
  const p: PlayerState = {
    cityId: start.cityId,
    cash: start.cash,
    deposit: 0,
    pension: 0,
    positions: {},
    properties: [],
    debts: [],
    salaryAnnual: start.salaryAnnual,
    lifestyleTier: start.lifestyleTier,
    extraExpensesAnnual: 0,
    extraPassiveAnnual: 0,
    statusPoints: 0,
    nextId: 0,
    passiveStreak: 0,
    escapedAtRound: null,
    bankruptUntilRound: 0,
  };
  for (const debt of start.debts) p.debts.push({ id: newId(p, 'debt'), ...debt });
  return p;
}
```

`packages/engine/src/validate.ts`:

```ts
import type { Content } from './types';

type Transitions = Record<string, ReadonlyArray<readonly [string, number]>>;

/** Returns a list of problems. An empty list means the content is usable. */
export function validateContent(c: Content): string[] {
  const errors: string[] = [];

  const checkUnique = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };

  const checkTransitions = (name: string, table: Transitions) => {
    for (const from of Object.keys(table)) {
      let total = 0;
      for (const [, weight] of table[from]) total += weight;
      if (total <= 0) errors.push(`${name} transitions from ${from} have no weight`);
    }
  };

  if (!Number.isInteger(c.rounds) || c.rounds < 1) errors.push('rounds must be a positive integer');
  if (!Number.isInteger(c.yearsPerRound) || c.yearsPerRound < 1) errors.push('yearsPerRound must be a positive integer');
  if (c.cities.length === 0) errors.push('at least one city is required');

  checkUnique(c.assets.map((a) => a.id), 'asset');
  checkUnique(c.cities.map((x) => x.id), 'city');
  checkUnique(c.propertyTypes.map((x) => x.id), 'property type');

  for (const a of c.assets) {
    if (a.class === 'bond' && (a.durationYears === undefined || a.yieldSpreadBp === undefined)) {
      errors.push(`bond ${a.id} needs durationYears and yieldSpreadBp`);
    }
  }
  if (!c.assets.some((a) => a.id === c.pensionAssetId)) {
    errors.push(`pensionAssetId ${c.pensionAssetId} is not an asset`);
  }

  checkTransitions('regime', c.market.regimeTransitions);
  checkTransitions('crypto', c.market.cryptoTransitions);

  for (const city of c.cities) {
    const rates = [...city.tax.incomeRatesBp, city.tax.capitalGainsBp, city.tax.dividendBp, city.tax.rentBp];
    if (rates.some((r) => r < 0 || r > 10_000)) errors.push(`city ${city.id} has a tax rate outside 0..10000 bp`);
  }

  const points = c.scoring.wealthBreakpoints;
  if (points.length < 2) errors.push('scoring needs at least two wealth breakpoints');
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] <= points[i - 1][0]) {
      errors.push('wealth breakpoints must be strictly increasing');
      break;
    }
  }

  return errors;
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm vitest run packages/engine/src/validate.test.ts packages/engine/src/player.test.ts && pnpm lint && pnpm typecheck`
Expected: 11 tests pass; lint and typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): shared types, test fixture, player factory, content validation"
```

---

### Task 4: World timeline

**Files:**
- Create: `packages/engine/src/world.ts`
- Test: `packages/engine/src/world.test.ts`

**Interfaces:**
- Consumes: `Rng`, `seedRng` from `rng.ts`; `clamp`, `round` from `money.ts`; `Content`, `WorldState` from `types.ts`; `fixtureContent` in tests.
- Produces:
  - `const INDEX_START = 10_000`
  - `generateTimeline(seed: string, content: Content): WorldState[]` (length `content.rounds + 1`)
  - `stepWorld(prev: WorldState, content: Content, rng: Rng): WorldState`

Rules implemented here:

- The regime and the crypto phase each follow their own weighted transition table.
- Policy rate = previous + regime drift + noise, clamped to 0..800 bp.
- Inflation moves halfway to the regime's target, plus noise, clamped to -100..1200 bp.
- Bond return = -duration × rate change + own noise.
- Equity, crypto and gold return = (class mean + class shock) × beta + own noise. Gold's mean also gains `(inflation - 200) × yearsPerRound`.
- An asset with `crashChancePct` may instead return exactly -9000 bp.
- No asset returns less than -9500 bp; no property less than -5000 bp.
- Property return = base growth + momentum × last return - rate sensitivity × rate change + city noise.

- [ ] **Step 1: Write the failing tests**

`packages/engine/src/world.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixtureContent } from './testing/fixture';
import { generateTimeline } from './world';

const content = fixtureContent();

describe('world timeline', () => {
  it('has one state per round plus the start', () => {
    const t = generateTimeline('seed-a', content);
    expect(t).toHaveLength(content.rounds + 1);
    expect(t.map((w) => w.round)).toEqual(Array.from({ length: content.rounds + 1 }, (_, i) => i));
    expect(t[0].assetIndex.fund_world).toBe(10_000);
    expect(t[0].assetReturnBp.fund_world).toBe(0);
  });

  it('is identical for the same seed and different for another', () => {
    expect(generateTimeline('seed-a', content)).toEqual(generateTimeline('seed-a', content));
    expect(generateTimeline('seed-a', content)).not.toEqual(generateTimeline('seed-b', content));
  });

  it('stays inside its bounds with whole numbers across 300 seeds', () => {
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`bounds-${s}`, content)) {
        expect(w.policyRateBp).toBeGreaterThanOrEqual(0);
        expect(w.policyRateBp).toBeLessThanOrEqual(800);
        expect(w.inflationBp).toBeGreaterThanOrEqual(-100);
        expect(w.inflationBp).toBeLessThanOrEqual(1_200);
        const all = [
          w.policyRateBp,
          w.inflationBp,
          ...Object.values(w.assetReturnBp),
          ...Object.values(w.assetIndex),
          ...Object.values(w.propertyReturnBp),
          ...Object.values(w.propertyIndex),
        ];
        for (const v of all) expect(Number.isInteger(v)).toBe(true);
        for (const v of Object.values(w.assetReturnBp)) expect(v).toBeGreaterThanOrEqual(-9_500);
        for (const v of Object.values(w.propertyReturnBp)) expect(v).toBeGreaterThanOrEqual(-5_000);
        for (const v of [...Object.values(w.assetIndex), ...Object.values(w.propertyIndex)]) {
          expect(v).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('moves bond prices against rate changes', () => {
    const t = generateTimeline('bond', content);
    for (let r = 1; r < t.length; r++) {
      const rateChange = t[r].policyRateBp - t[r - 1].policyRateBp;
      expect(t[r].assetReturnBp.bond_long).toBe(-8 * rateChange + 0);
    }
  });

  it('keeps each index in step with its returns', () => {
    const t = generateTimeline('index', content);
    for (let r = 1; r < t.length; r++) {
      const expected = Math.max(1, Math.round((t[r - 1].assetIndex.gold * (10_000 + t[r].assetReturnBp.gold)) / 10_000));
      expect(t[r].assetIndex.gold).toBe(expected);
    }
  });

  it('pays more in booms than in recessions on average', () => {
    const sum = { boom: 0, recession: 0 };
    const count = { boom: 0, recession: 0 };
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`regime-${s}`, content).slice(1)) {
        if (w.regime === 'boom' || w.regime === 'recession') {
          sum[w.regime] += w.assetReturnBp.fund_world;
          count[w.regime] += 1;
        }
      }
    }
    expect(sum.boom / count.boom).toBeGreaterThan(sum.recession / count.recession + 2_000);
  });

  it('crashes the meme coin by 90% now and then', () => {
    let crashes = 0;
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`crash-${s}`, content).slice(1)) {
        if (w.assetReturnBp.coin_meme === -9_000) crashes += 1;
      }
    }
    expect(crashes).toBeGreaterThan(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/world.test.ts`
Expected: FAIL, cannot resolve `./world`.

- [ ] **Step 3: Implement the world**

`packages/engine/src/world.ts`:

```ts
import { clamp, round } from './money';
import { Rng, seedRng } from './rng';
import type { Content, WorldState } from './types';

export const INDEX_START = 10_000;

const MIN_ASSET_RETURN_BP = -9_500;
const MIN_PROPERTY_RETURN_BP = -5_000;
const CRASH_RETURN_BP = -9_000;
const MAX_RATE_BP = 800;
const MIN_INFLATION_BP = -100;
const MAX_INFLATION_BP = 1_200;
const NEUTRAL_INFLATION_BP = 200;

function nextIndex(index: number, returnBp: number): number {
  return Math.max(1, round((index * (10_000 + returnBp)) / 10_000));
}

export function stepWorld(prev: WorldState, content: Content, rng: Rng): WorldState {
  const m = content.market;

  const regime = rng.pickWeighted(m.regimeTransitions[prev.regime]);
  const cryptoPhase = rng.pickWeighted(m.cryptoTransitions[prev.cryptoPhase]);

  const policyRateBp = clamp(
    prev.policyRateBp + m.rateDriftBp[regime] + round(m.rateNoiseBp * rng.normal()),
    0,
    MAX_RATE_BP,
  );
  const inflationBp = clamp(
    round((prev.inflationBp + m.inflationTargetBp[regime]) / 2) + round(m.inflationNoiseBp * rng.normal()),
    MIN_INFLATION_BP,
    MAX_INFLATION_BP,
  );
  const rateChangeBp = policyRateBp - prev.policyRateBp;

  const classShock = {
    equity: round(m.classVolBp.equity * rng.normal()),
    crypto: round(m.classVolBp.crypto * rng.normal()),
    gold: round(m.classVolBp.gold * rng.normal()),
  };

  const assetReturnBp: Record<string, number> = {};
  const assetIndex: Record<string, number> = {};
  for (const asset of content.assets) {
    const own = round(asset.idioVolBp * rng.normal());
    let ret: number;
    if (asset.class === 'bond') {
      ret = round(-(asset.durationYears ?? 0) * rateChangeBp) + own;
    } else {
      const mean =
        asset.class === 'equity'
          ? m.equityMeanBp[regime]
          : asset.class === 'crypto'
            ? m.cryptoMeanBp[cryptoPhase]
            : m.goldMeanBp[regime] + (inflationBp - NEUTRAL_INFLATION_BP) * content.yearsPerRound;
      ret = round(((mean + classShock[asset.class]) * asset.betaPct) / 100) + own;
    }
    if (asset.crashChancePct !== undefined && rng.chance(asset.crashChancePct)) ret = CRASH_RETURN_BP;
    ret = Math.max(ret, MIN_ASSET_RETURN_BP);
    assetReturnBp[asset.id] = ret;
    assetIndex[asset.id] = nextIndex(prev.assetIndex[asset.id], ret);
  }

  const propertyReturnBp: Record<string, number> = {};
  const propertyIndex: Record<string, number> = {};
  for (const city of content.cities) {
    const shock = round(city.propertyVolBp * rng.normal());
    const momentum = round((prev.propertyReturnBp[city.id] * city.propertyMomentumPct) / 100);
    const ret = Math.max(
      MIN_PROPERTY_RETURN_BP,
      city.propertyGrowthBp + momentum - city.propertyRateSensitivity * rateChangeBp + shock,
    );
    propertyReturnBp[city.id] = ret;
    propertyIndex[city.id] = nextIndex(prev.propertyIndex[city.id], ret);
  }

  return {
    round: prev.round + 1,
    regime,
    cryptoPhase,
    policyRateBp,
    inflationBp,
    assetReturnBp,
    assetIndex,
    propertyReturnBp,
    propertyIndex,
  };
}

/** The whole world for one game. It depends on the seed and the content, never on a player. */
export function generateTimeline(seed: string, content: Content): WorldState[] {
  const rng = new Rng(seedRng(seed, 'market'));
  const m = content.market;
  const timeline: WorldState[] = [
    {
      round: 0,
      regime: m.start.regime,
      cryptoPhase: m.start.cryptoPhase,
      policyRateBp: m.start.policyRateBp,
      inflationBp: m.start.inflationBp,
      assetReturnBp: Object.fromEntries(content.assets.map((a) => [a.id, 0])),
      assetIndex: Object.fromEntries(content.assets.map((a) => [a.id, INDEX_START])),
      propertyReturnBp: Object.fromEntries(content.cities.map((c) => [c.id, 0])),
      propertyIndex: Object.fromEntries(content.cities.map((c) => [c.id, INDEX_START])),
    },
  ];
  for (let r = 1; r <= content.rounds; r++) timeline.push(stepWorld(timeline[r - 1], content, rng));
  return timeline;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/world.test.ts && pnpm lint && pnpm typecheck`
Expected: 7 tests pass; lint and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): seeded world timeline for regimes, rates, assets and property"
```

---

### Task 5: Tax

**Files:**
- Create: `packages/engine/src/tax.ts`
- Test: `packages/engine/src/tax.test.ts`

**Interfaces:**
- Consumes: `applyBp`, `Cents` from `money.ts`; `CityDef` from `types.ts`; `cityOf` and the fixture in tests.
- Produces:
  - `interface TaxInput { salary; pensionContribution; realisedGains; dividends; rent; propertyValueOwned; propertyPurchases }` (all `Cents`, all for the whole round)
  - `interface TaxBill { income: Cents; investment: Cents; property: Cents; total: Cents }`
  - `incomeTaxAnnual(annual: Cents, city: CityDef): Cents`
  - `computeTax(city: CityDef, years: number, input: TaxInput): TaxBill`

Rules implemented here:

- Bracket thresholds are 0.5×, 1.5× and 4× the city's median salary. Income below the first threshold is untaxed.
- Income tax is worked out per year and multiplied by the years in a round.
- Pension contributions reduce taxable income, up to `pensionDeductionCapBp` of salary per year.
- Only a positive net gain is taxed. The investment allowance covers gains first, then dividends.
- Rent is taxed at `rentBp`, or through the brackets when `rentAsIncome` is true.
- Property tax = annual rate on value owned × years, plus the purchase rate on purchases this round.

- [ ] **Step 1: Write the failing tests**

`packages/engine/src/tax.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cityOf } from './lookup';
import { computeTax, incomeTaxAnnual } from './tax';
import type { TaxInput } from './tax';
import { fixtureContent } from './testing/fixture';

const content = fixtureContent();
const home = cityOf(content, 'home');
const haven = cityOf(content, 'haven');

const none: TaxInput = {
  salary: 0,
  pensionContribution: 0,
  realisedGains: 0,
  dividends: 0,
  rent: 0,
  propertyValueOwned: 0,
  propertyPurchases: 0,
};

describe('income tax', () => {
  it('charges nothing below half the median salary', () => {
    expect(incomeTaxAnnual(1_400_000, home)).toBe(0);
    expect(incomeTaxAnnual(1_500_000, home)).toBe(0);
  });

  it('charges each bracket at its own rate', () => {
    expect(incomeTaxAnnual(6_000_000, home)).toBe(570_000 + 450_000);
    expect(incomeTaxAnnual(20_000_000, home)).toBe(570_000 + 2_250_000 + 3_600_000);
  });

  it('bills a whole round as years times the annual tax', () => {
    expect(computeTax(home, 2, { ...none, salary: 12_000_000 }).income).toBe(2_040_000);
  });

  it('deducts pension contributions up to the cap', () => {
    expect(computeTax(home, 2, { ...none, salary: 12_000_000, pensionContribution: 600_000 }).income).toBe(1_860_000);
    const capped = computeTax(home, 2, { ...none, salary: 12_000_000, pensionContribution: 9_000_000 });
    expect(capped.income).toBe(2 * incomeTaxAnnual(6_000_000 - 600_000, home));
  });

  it('charges nothing in a zero-tax city', () => {
    const bill = computeTax(haven, 2, { ...none, salary: 40_000_000, realisedGains: 5_000_000, dividends: 1_000_000, rent: 2_000_000 });
    expect(bill.income).toBe(0);
    expect(bill.investment).toBe(0);
  });
});

describe('investment tax', () => {
  it('taxes gains, dividends and rent', () => {
    const bill = computeTax(home, 2, { ...none, realisedGains: 1_000_000, dividends: 200_000, rent: 300_000 });
    expect(bill.investment).toBe(210_000 + 42_000 + 63_000);
  });

  it('does not tax a net loss', () => {
    const bill = computeTax(home, 2, { ...none, realisedGains: -500_000, dividends: 200_000 });
    expect(bill.investment).toBe(42_000);
  });

  it('applies the allowance to gains first, then dividends', () => {
    const city = { ...home, tax: { ...home.tax, investmentAllowance: 600_000 } };
    const bill = computeTax(city, 2, { ...none, realisedGains: 400_000, dividends: 500_000 });
    expect(bill.investment).toBe(63_000);
  });

  it('taxes rent through the brackets when the city says so', () => {
    const city = { ...home, tax: { ...home.tax, rentAsIncome: true } };
    const bill = computeTax(city, 2, { ...none, salary: 6_000_000, rent: 6_000_000 });
    expect(bill.investment).toBe(0);
    expect(bill.income).toBe(2 * incomeTaxAnnual(6_000_000, home));
  });
});

describe('property tax', () => {
  it('charges the annual rate on value owned and the purchase rate on purchases', () => {
    const bill = computeTax(home, 2, { ...none, propertyValueOwned: 25_000_000, propertyPurchases: 25_000_000 });
    expect(bill.property).toBe(150_000 + 2_000_000);
  });

  it('totals the three parts', () => {
    const bill = computeTax(home, 2, { ...none, salary: 12_000_000, dividends: 200_000, propertyValueOwned: 25_000_000 });
    expect(bill.total).toBe(bill.income + bill.investment + bill.property);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/tax.test.ts`
Expected: FAIL, cannot resolve `./tax`.

- [ ] **Step 3: Implement tax**

`packages/engine/src/tax.ts`:

```ts
import { applyBp } from './money';
import type { Cents } from './money';
import type { CityDef } from './types';

/** Amounts for one whole round. */
export interface TaxInput {
  salary: Cents;
  pensionContribution: Cents;
  /** Net realised gain. Negative for a net loss. */
  realisedGains: Cents;
  /** Dividends, bond coupons and deposit interest. */
  dividends: Cents;
  rent: Cents;
  propertyValueOwned: Cents;
  propertyPurchases: Cents;
}

export interface TaxBill {
  income: Cents;
  investment: Cents;
  property: Cents;
  total: Cents;
}

export function incomeTaxAnnual(annual: Cents, city: CityDef): Cents {
  const median = city.medianSalaryAnnual;
  const first = Math.floor(median / 2);
  const second = Math.floor((median * 3) / 2);
  const third = median * 4;
  const [low, mid, high] = city.tax.incomeRatesBp;

  let tax = 0;
  if (annual > first) tax += applyBp(Math.min(annual, second) - first, low);
  if (annual > second) tax += applyBp(Math.min(annual, third) - second, mid);
  if (annual > third) tax += applyBp(annual - third, high);
  return tax;
}

export function computeTax(city: CityDef, years: number, input: TaxInput): TaxBill {
  const t = city.tax;

  const salaryAnnual = Math.floor(input.salary / years);
  const rentAnnual = t.rentAsIncome ? Math.floor(input.rent / years) : 0;
  const deduction = Math.min(
    Math.floor(input.pensionContribution / years),
    applyBp(salaryAnnual, t.pensionDeductionCapBp),
  );
  const taxableAnnual = Math.max(0, salaryAnnual + rentAnnual - deduction);
  const income = incomeTaxAnnual(taxableAnnual, city) * years;

  const gains = Math.max(0, input.realisedGains);
  const gainsTaxable = Math.max(0, gains - t.investmentAllowance);
  const allowanceLeft = Math.max(0, t.investmentAllowance - gains);
  const dividendsTaxable = Math.max(0, input.dividends - allowanceLeft);
  const rentTax = t.rentAsIncome ? 0 : applyBp(input.rent, t.rentBp);
  const investment = applyBp(gainsTaxable, t.capitalGainsBp) + applyBp(dividendsTaxable, t.dividendBp) + rentTax;

  const property =
    applyBp(input.propertyValueOwned, t.propertyAnnualBp) * years +
    applyBp(input.propertyPurchases, t.propertyPurchaseBp);

  return { income, investment, property, total: income + investment + property };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/tax.test.ts && pnpm lint && pnpm typecheck`
Expected: 11 tests pass; lint and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): per-city income, investment and property tax"
```

---

### Task 6: Portfolio orders and price growth

**Files:**
- Create: `packages/engine/src/portfolio.ts`
- Test: `packages/engine/src/portfolio.test.ts`

**Interfaces:**
- Consumes: `applyBp`, `isAmount`, `mulDiv`, `Cents` from `money.ts`; `Content`, `Order`, `PlayerState`, `WorldState` from `types.ts`; `newPlayer`, `generateTimeline` and the fixture in tests.
- Produces:
  - `interface RoundTally { realisedGains: Cents; pensionContribution: Cents; propertyPurchases: Cents }`
  - `interface OrderContext { content: Content; world: WorldState; round: number; tally: RoundTally }`
  - `type PortfolioOrder` (the `buy`, `sell`, `depositIn`, `depositOut`, `pensionIn` members of `Order`)
  - `executePortfolioOrder(p: PlayerState, order: PortfolioOrder, ctx: OrderContext): string | null` (a string is the reason for rejection; `null` means done). It mutates `p` and `ctx.tally`.
  - `growPortfolio(p: PlayerState, content: Content, after: WorldState): void`

Every order executor in this plan follows the same contract: on rejection it returns the reason and leaves `p` and `ctx.tally` untouched.

- [ ] **Step 1: Write the failing tests**

`packages/engine/src/portfolio.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newPlayer } from './player';
import { executePortfolioOrder, growPortfolio } from './portfolio';
import type { OrderContext, PortfolioOrder } from './portfolio';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { generateTimeline } from './world';

function setup(cash = 1_000_000) {
  const content = fixtureContent();
  const timeline = generateTimeline('portfolio', content);
  const p = newPlayer({ ...fixtureStart(), cash });
  const ctx: OrderContext = {
    content,
    world: timeline[0],
    round: 0,
    tally: { realisedGains: 0, pensionContribution: 0, propertyPurchases: 0 },
  };
  return { content, timeline, p, ctx };
}

describe('portfolio orders', () => {
  it('buys: cash becomes a position with matching basis', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'buy', assetId: 'fund_world', amount: 400_000 }, ctx)).toBeNull();
    expect(p.cash).toBe(600_000);
    expect(p.positions.fund_world).toEqual({ value: 400_000, basis: 400_000 });
  });

  it('sells part: realises the gain in proportion', () => {
    const { p, ctx } = setup();
    p.positions.fund_world = { value: 600_000, basis: 400_000 };
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'fund_world', amount: 300_000 }, ctx)).toBeNull();
    expect(p.positions.fund_world).toEqual({ value: 300_000, basis: 200_000 });
    expect(p.cash).toBe(1_300_000);
    expect(ctx.tally.realisedGains).toBe(100_000);
  });

  it('sells all: removes the position and realises a loss', () => {
    const { p, ctx } = setup();
    p.positions.coin_meme = { value: 50_000, basis: 400_000 };
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'coin_meme', amount: 50_000 }, ctx)).toBeNull();
    expect(p.positions.coin_meme).toBeUndefined();
    expect(ctx.tally.realisedGains).toBe(-350_000);
  });

  it('moves money in and out of the deposit', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'depositIn', amount: 700_000 }, ctx)).toBeNull();
    expect(executePortfolioOrder(p, { type: 'depositOut', amount: 200_000 }, ctx)).toBeNull();
    expect(p.deposit).toBe(500_000);
    expect(p.cash).toBe(500_000);
  });

  it('pays into the pension and records the contribution', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 250_000 }, ctx)).toBeNull();
    expect(p.pension).toBe(250_000);
    expect(p.cash).toBe(750_000);
    expect(ctx.tally.pensionContribution).toBe(250_000);
  });

  it('refuses to overspend, oversell or overdraw', () => {
    const { p, ctx } = setup(100);
    p.positions.gold = { value: 500, basis: 500 };
    p.deposit = 300;
    expect(executePortfolioOrder(p, { type: 'buy', assetId: 'gold', amount: 101 }, ctx)).toBe('not enough cash');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'gold', amount: 501 }, ctx)).toBe('cannot sell more than you hold');
    expect(executePortfolioOrder(p, { type: 'depositIn', amount: 101 }, ctx)).toBe('not enough cash');
    expect(executePortfolioOrder(p, { type: 'depositOut', amount: 301 }, ctx)).toBe('not enough in the deposit');
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 101 }, ctx)).toBe('not enough cash');
  });

  it('rejects malformed amounts and changes nothing', () => {
    const { p, ctx } = setup();
    p.positions.gold = { value: 500_000, basis: 500_000 };
    p.deposit = 500_000;
    const before = JSON.stringify({ p, tally: ctx.tally });
    const amounts = [0, -5, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2];
    for (const amount of amounts) {
      const orders: PortfolioOrder[] = [
        { type: 'buy', assetId: 'gold', amount },
        { type: 'sell', assetId: 'gold', amount },
        { type: 'depositIn', amount },
        { type: 'depositOut', amount },
        { type: 'pensionIn', amount },
      ];
      for (const order of orders) {
        expect(executePortfolioOrder(p, order, ctx)).toBe('amount must be a positive whole number of cents');
      }
    }
    expect(JSON.stringify({ p, tally: ctx.tally })).toBe(before);
  });

  it('rejects stale and hostile asset ids without touching prototypes', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'buy', assetId: 'nope', amount: 100 }, ctx)).toBe('unknown asset: nope');
    expect(executePortfolioOrder(p, { type: 'buy', assetId: '__proto__', amount: 100 }, ctx)).toBe('unknown asset: __proto__');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'fund_world', amount: 100 }, ctx)).toBe('no position in fund_world');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: '__proto__', amount: 100 }, ctx)).toBe('no position in __proto__');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'constructor', amount: 100 }, ctx)).toBe('no position in constructor');
    expect(({} as Record<string, unknown>).value).toBeUndefined();
    expect(p.cash).toBe(1_000_000);
  });
});

describe('portfolio growth', () => {
  it('applies each asset return and follows the pension asset', () => {
    const { content, timeline, p } = setup();
    p.positions.fund_world = { value: 1_000_000, basis: 900_000 };
    p.positions.coin_meme = { value: 200_000, basis: 200_000 };
    p.pension = 500_000;
    const after = {
      ...timeline[1],
      assetReturnBp: { ...timeline[1].assetReturnBp, fund_world: 1_000, coin_meme: -9_000 },
    };
    growPortfolio(p, content, after);
    expect(p.positions.fund_world).toEqual({ value: 1_100_000, basis: 900_000 });
    expect(p.positions.coin_meme).toEqual({ value: 20_000, basis: 200_000 });
    expect(p.pension).toBe(550_000);
  });

  it('drops a position that falls to nothing', () => {
    const { content, timeline, p } = setup();
    p.positions.coin_meme = { value: 3, basis: 300 };
    const after = { ...timeline[1], assetReturnBp: { ...timeline[1].assetReturnBp, coin_meme: -9_500 } };
    growPortfolio(p, content, after);
    expect(p.positions.coin_meme).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/portfolio.test.ts`
Expected: FAIL, cannot resolve `./portfolio`.

- [ ] **Step 3: Implement the portfolio**

`packages/engine/src/portfolio.ts`:

```ts
import { applyBp, isAmount, mulDiv } from './money';
import type { Cents } from './money';
import type { Content, Order, PlayerState, WorldState } from './types';

/** Running totals for the round, read later by the tax step. */
export interface RoundTally {
  realisedGains: Cents;
  pensionContribution: Cents;
  propertyPurchases: Cents;
}

export interface OrderContext {
  content: Content;
  /** The world whose prices and rates the player saw when deciding. */
  world: WorldState;
  round: number;
  tally: RoundTally;
}

export type PortfolioOrder = Extract<Order, { type: 'buy' | 'sell' | 'depositIn' | 'depositOut' | 'pensionIn' }>;

export const BAD_AMOUNT = 'amount must be a positive whole number of cents';

/** Returns the reason for rejection, or null when the order was executed. */
export function executePortfolioOrder(p: PlayerState, order: PortfolioOrder, ctx: OrderContext): string | null {
  if (!isAmount(order.amount)) return BAD_AMOUNT;

  switch (order.type) {
    case 'buy': {
      if (!ctx.content.assets.some((a) => a.id === order.assetId)) return `unknown asset: ${order.assetId}`;
      if (order.amount > p.cash) return 'not enough cash';
      const held = Object.hasOwn(p.positions, order.assetId) ? p.positions[order.assetId] : { value: 0, basis: 0 };
      p.positions[order.assetId] = { value: held.value + order.amount, basis: held.basis + order.amount };
      p.cash -= order.amount;
      return null;
    }
    case 'sell': {
      if (!Object.hasOwn(p.positions, order.assetId)) return `no position in ${order.assetId}`;
      const held = p.positions[order.assetId];
      if (order.amount > held.value) return 'cannot sell more than you hold';
      const basisSold =
        order.amount === held.value ? held.basis : Math.min(held.basis, mulDiv(held.basis, order.amount, held.value));
      ctx.tally.realisedGains += order.amount - basisSold;
      p.cash += order.amount;
      if (order.amount === held.value) {
        delete p.positions[order.assetId];
      } else {
        p.positions[order.assetId] = { value: held.value - order.amount, basis: held.basis - basisSold };
      }
      return null;
    }
    case 'depositIn': {
      if (order.amount > p.cash) return 'not enough cash';
      p.cash -= order.amount;
      p.deposit += order.amount;
      return null;
    }
    case 'depositOut': {
      if (order.amount > p.deposit) return 'not enough in the deposit';
      p.deposit -= order.amount;
      p.cash += order.amount;
      return null;
    }
    case 'pensionIn': {
      if (order.amount > p.cash) return 'not enough cash';
      p.cash -= order.amount;
      p.pension += order.amount;
      ctx.tally.pensionContribution += order.amount;
      return null;
    }
  }
}

/** Applies one round of price moves to everything held. */
export function growPortfolio(p: PlayerState, content: Content, after: WorldState): void {
  for (const id of Object.keys(p.positions)) {
    const held = p.positions[id];
    const value = Math.max(0, held.value + applyBp(held.value, after.assetReturnBp[id] ?? 0));
    if (value === 0) delete p.positions[id];
    else p.positions[id] = { value, basis: held.basis };
  }
  p.pension = Math.max(0, p.pension + applyBp(p.pension, after.assetReturnBp[content.pensionAssetId] ?? 0));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/portfolio.test.ts && pnpm lint && pnpm typecheck`
Expected: 10 tests pass; lint and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): portfolio orders with cost basis, deposit, pension and price growth"
```

---

### Task 7: Debt and property

**Files:**
- Create: `packages/engine/src/debt.ts`, `packages/engine/src/property.ts`
- Test: `packages/engine/src/debt.test.ts`, `packages/engine/src/property.test.ts`

**Interfaces:**
- Consumes: `applyBp`, `isAmount`, `mulDiv`, `round`, `BP`, `Bp`, `Cents` from `money.ts`; `cityOf` from `lookup.ts`; `newId` from `player.ts`; `OrderContext`, `BAD_AMOUNT` from `portfolio.ts`; `INDEX_START` from `world.ts`; types from `types.ts`.
- Produces, from `debt.ts`:
  - `debtRateBp(d: Debt, content: Content, world: WorldState): Bp` (annual)
  - `interface DebtService { interest: Cents; principal: Cents; perDebt: Array<{ id: string; principal: Cents }> }`
  - `debtServiceForRound(p: PlayerState, content: Content, world: WorldState): DebtService`
  - `applyDebtPayments(p: PlayerState, service: DebtService): void`
  - `removePaidDebts(p: PlayerState): void`
  - `executeBorrow(p, order: Extract<Order, { type: 'borrow' }>, ctx: OrderContext): string | null`
  - `executeRepay(p, order: Extract<Order, { type: 'repay' }>): string | null`
  - `settleCash(p: PlayerState): Cents` (returns the amount drawn on the credit card)
  - `checkBankruptcy(p: PlayerState, content: Content, annualIncome: Cents, completedRound: number): boolean`
- Produces, from `property.ts`:
  - `propertyPrice(content: Content, world: WorldState, cityId: string, typeId: string): Cents`
  - `executeBuyProperty(p, order: Extract<Order, { type: 'buyProperty' }>, ctx: OrderContext): string | null`
  - `executeSellProperty(p, order: Extract<Order, { type: 'sellProperty' }>, ctx: OrderContext): string | null`
  - `executeSetRented(p, order: Extract<Order, { type: 'setRented' }>): string | null`
  - `growProperties(p: PlayerState, after: WorldState): void`
  - `ownsHome(p: PlayerState): boolean`

Rules implemented here:

- Interest for a round = principal × annual rate × years (simple interest).
- Loans and mortgages repay in equal principal slices: `ceil(principal / roundsLeft)` each round.
- A credit card charges interest only. It is drawn automatically when cash is negative and repaid automatically from any positive cash.
- Personal loans may total `personalLoanMaxIncomePct` of annual salary.
- A mortgage covers at most `mortgageMaxLtvBp` of the price. Property is bought in the player's current city.
- Bankruptcy triggers when credit card debt exceeds `bankruptcyIncomeMultiple` × the larger of annual income and the city's annual living cost. Everything except the pension is sold at a discount, all debts are cleared, and borrowing is locked.

- [ ] **Step 1: Write the failing debt tests**

`packages/engine/src/debt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyDebtPayments,
  checkBankruptcy,
  debtRateBp,
  debtServiceForRound,
  executeBorrow,
  executeRepay,
  settleCash,
} from './debt';
import { newPlayer } from './player';
import type { OrderContext } from './portfolio';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { Debt } from './types';
import { generateTimeline } from './world';

function setup(cash = 0) {
  const content = fixtureContent();
  const world = generateTimeline('debt', content)[0];
  const p = newPlayer({ ...fixtureStart(), cash });
  const ctx: OrderContext = {
    content,
    world,
    round: 0,
    tally: { realisedGains: 0, pensionContribution: 0, propertyPurchases: 0 },
  };
  return { content, world, p, ctx };
}

const debt = (over: Partial<Debt>): Debt => ({ id: 'd', kind: 'personalLoan', principal: 900_000, fixedRateBp: 750, roundsLeft: 3, ...over });

describe('debt rates and service', () => {
  it('uses the right rate for each kind', () => {
    const { content, world } = setup();
    expect(debtRateBp(debt({ kind: 'personalLoan' }), content, world)).toBe(750);
    expect(debtRateBp(debt({ kind: 'mortgageFixed', fixedRateBp: 400 }), content, world)).toBe(400);
    expect(debtRateBp(debt({ kind: 'mortgageVariable', fixedRateBp: 0 }), content, world)).toBe(250 + 150);
    expect(debtRateBp(debt({ kind: 'creditCard', fixedRateBp: 0 }), content, world)).toBe(2_200);
  });

  it('charges simple interest and an equal principal slice', () => {
    const { content, world, p } = setup();
    p.debts.push(debt({}));
    const service = debtServiceForRound(p, content, world);
    expect(service.interest).toBe(135_000);
    expect(service.principal).toBe(300_000);
  });

  it('pays a loan off over its term and then removes it', () => {
    const { content, world, p } = setup();
    p.debts.push(debt({}));
    for (let i = 0; i < 3; i++) applyDebtPayments(p, debtServiceForRound(p, content, world));
    expect(p.debts).toEqual([]);
  });

  it('charges a credit card interest only', () => {
    const { content, world, p } = setup();
    p.debts.push(debt({ kind: 'creditCard', principal: 1_000_000, fixedRateBp: 0, roundsLeft: 0 }));
    const service = debtServiceForRound(p, content, world);
    expect(service.interest).toBe(440_000);
    expect(service.principal).toBe(0);
    applyDebtPayments(p, service);
    expect(p.debts[0].principal).toBe(1_000_000);
  });
});

describe('borrow and repay', () => {
  it('borrows at the policy rate plus the spread', () => {
    const { p, ctx } = setup();
    expect(executeBorrow(p, { type: 'borrow', amount: 1_000_000 }, ctx)).toBeNull();
    expect(p.cash).toBe(1_000_000);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'personalLoan', principal: 1_000_000, fixedRateBp: 750, roundsLeft: 3 }]);
  });

  it('refuses a loan over the income limit or during the bankruptcy lock', () => {
    const { p, ctx } = setup();
    expect(executeBorrow(p, { type: 'borrow', amount: 3_000_001 }, ctx)).toBe('over your personal loan limit');
    p.bankruptUntilRound = 3;
    expect(executeBorrow(p, { type: 'borrow', amount: 100 }, ctx)).toBe('no credit available after bankruptcy');
    expect(p.debts).toEqual([]);
  });

  it('repays in part and in full', () => {
    const { p } = setup(1_000_000);
    p.debts.push(debt({ id: 'debt-9' }));
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 400_000 })).toBeNull();
    expect(p.debts[0].principal).toBe(500_000);
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 500_000 })).toBeNull();
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(100_000);
  });

  it('rejects malformed amounts, unknown debts and overpayment, changing nothing', () => {
    const { p, ctx } = setup(1_000_000);
    p.debts.push(debt({ id: 'debt-9' }));
    const before = JSON.stringify(p);
    for (const amount of [0, -5, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2]) {
      expect(executeBorrow(p, { type: 'borrow', amount }, ctx)).toBe('amount must be a positive whole number of cents');
      expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount })).toBe('amount must be a positive whole number of cents');
    }
    expect(executeRepay(p, { type: 'repay', debtId: 'gone', amount: 100 })).toBe('unknown debt: gone');
    expect(executeRepay(p, { type: 'repay', debtId: '__proto__', amount: 100 })).toBe('unknown debt: __proto__');
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 900_001 })).toBe('cannot repay more than you owe');
    p.cash = 50;
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 100 })).toBe('not enough cash');
    p.cash = 1_000_000;
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('cash settlement and bankruptcy', () => {
  it('puts a shortfall on the credit card', () => {
    const { p } = setup();
    p.cash = -250_000;
    expect(settleCash(p)).toBe(250_000);
    expect(p.cash).toBe(0);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'creditCard', principal: 250_000, fixedRateBp: 0, roundsLeft: 0 }]);
    p.cash = -50_000;
    expect(settleCash(p)).toBe(50_000);
    expect(p.debts[0].principal).toBe(300_000);
  });

  it('pays the card down from spare cash', () => {
    const { p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 300_000, fixedRateBp: 0, roundsLeft: 0 }));
    p.cash = 100_000;
    expect(settleCash(p)).toBe(0);
    expect(p.cash).toBe(0);
    expect(p.debts[0].principal).toBe(200_000);
    p.cash = 500_000;
    settleCash(p);
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(300_000);
  });

  it('does not bankrupt a player under the threshold', () => {
    const { content, p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 9_000_000, fixedRateBp: 0, roundsLeft: 0 }));
    expect(checkBankruptcy(p, content, 3_000_000, 5)).toBe(false);
    expect(p.debts).toHaveLength(1);
  });

  it('bankrupts over the threshold: sells at a discount, clears debts, locks credit, keeps the pension', () => {
    const { content, p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 9_000_001, fixedRateBp: 0, roundsLeft: 0 }));
    p.positions.gold = { value: 1_000_000, basis: 1_000_000 };
    p.deposit = 200_000;
    p.pension = 777;
    expect(checkBankruptcy(p, content, 3_000_000, 5)).toBe(true);
    expect(p.debts).toEqual([]);
    expect(p.positions).toEqual({});
    expect(p.properties).toEqual([]);
    expect(p.deposit).toBe(0);
    expect(p.cash).toBe(0);
    expect(p.pension).toBe(777);
    expect(p.bankruptUntilRound).toBe(8);
  });

  it('uses living cost as the floor when income is zero', () => {
    const { content, p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 5_400_000, fixedRateBp: 0, roundsLeft: 0 }));
    expect(checkBankruptcy(p, content, 0, 1)).toBe(false);
    p.debts[0].principal = 5_400_001;
    expect(checkBankruptcy(p, content, 0, 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/debt.test.ts`
Expected: FAIL, cannot resolve `./debt`.

- [ ] **Step 3: Implement debt**

`packages/engine/src/debt.ts`:

```ts
import { cityOf } from './lookup';
import { applyBp, BP, isAmount, mulDiv } from './money';
import type { Bp, Cents } from './money';
import { newId } from './player';
import { BAD_AMOUNT } from './portfolio';
import type { OrderContext } from './portfolio';
import type { Content, Debt, Order, PlayerState, WorldState } from './types';

/** Annual rate in bp. */
export function debtRateBp(d: Debt, content: Content, world: WorldState): Bp {
  if (d.kind === 'creditCard') return content.debt.creditCardRateBp;
  if (d.kind === 'mortgageVariable') return world.policyRateBp + content.debt.mortgageSpreadBp;
  return d.fixedRateBp;
}

export interface DebtService {
  interest: Cents;
  principal: Cents;
  perDebt: Array<{ id: string; principal: Cents }>;
}

/** What the player's debts cost this round: interest, plus the scheduled principal slice. */
export function debtServiceForRound(p: PlayerState, content: Content, world: WorldState): DebtService {
  const years = content.yearsPerRound;
  const service: DebtService = { interest: 0, principal: 0, perDebt: [] };
  for (const d of p.debts) {
    service.interest += applyBp(d.principal, debtRateBp(d, content, world) * years);
    let due = 0;
    if (d.kind !== 'creditCard') due = d.roundsLeft <= 1 ? d.principal : Math.ceil(d.principal / d.roundsLeft);
    service.principal += due;
    service.perDebt.push({ id: d.id, principal: due });
  }
  return service;
}

export function removePaidDebts(p: PlayerState): void {
  const paid = new Set(p.debts.filter((d) => d.principal <= 0).map((d) => d.id));
  if (paid.size === 0) return;
  p.debts = p.debts.filter((d) => !paid.has(d.id));
  for (const property of p.properties) {
    if (property.mortgageId !== null && paid.has(property.mortgageId)) property.mortgageId = null;
  }
}

export function applyDebtPayments(p: PlayerState, service: DebtService): void {
  for (const payment of service.perDebt) {
    const d = p.debts.find((x) => x.id === payment.id);
    if (!d) continue;
    d.principal -= payment.principal;
    if (d.kind !== 'creditCard') d.roundsLeft = Math.max(0, d.roundsLeft - 1);
  }
  removePaidDebts(p);
}

export function executeBorrow(p: PlayerState, order: Extract<Order, { type: 'borrow' }>, ctx: OrderContext): string | null {
  if (!isAmount(order.amount)) return BAD_AMOUNT;
  if (ctx.round < p.bankruptUntilRound) return 'no credit available after bankruptcy';
  let existing = 0;
  for (const d of p.debts) if (d.kind === 'personalLoan') existing += d.principal;
  const limit = mulDiv(p.salaryAnnual, ctx.content.debt.personalLoanMaxIncomePct, 100);
  if (existing + order.amount > limit) return 'over your personal loan limit';
  p.debts.push({
    id: newId(p, 'debt'),
    kind: 'personalLoan',
    principal: order.amount,
    fixedRateBp: ctx.world.policyRateBp + ctx.content.debt.personalLoanSpreadBp,
    roundsLeft: ctx.content.debt.personalLoanTermRounds,
  });
  p.cash += order.amount;
  return null;
}

export function executeRepay(p: PlayerState, order: Extract<Order, { type: 'repay' }>): string | null {
  if (!isAmount(order.amount)) return BAD_AMOUNT;
  const d = p.debts.find((x) => x.id === order.debtId);
  if (!d) return `unknown debt: ${order.debtId}`;
  if (order.amount > d.principal) return 'cannot repay more than you owe';
  if (order.amount > p.cash) return 'not enough cash';
  d.principal -= order.amount;
  p.cash -= order.amount;
  removePaidDebts(p);
  return null;
}

/** Negative cash becomes credit card debt; spare cash pays the card down. Returns the amount drawn. */
export function settleCash(p: PlayerState): Cents {
  let card = p.debts.find((d) => d.kind === 'creditCard');
  if (p.cash < 0) {
    const draw = -p.cash;
    if (!card) {
      card = { id: newId(p, 'debt'), kind: 'creditCard', principal: 0, fixedRateBp: 0, roundsLeft: 0 };
      p.debts.push(card);
    }
    card.principal += draw;
    p.cash = 0;
    return draw;
  }
  if (card && p.cash > 0) {
    const payment = Math.min(p.cash, card.principal);
    card.principal -= payment;
    p.cash -= payment;
    removePaidDebts(p);
  }
  return 0;
}

/** Returns true if the player went bankrupt. Everything except the pension is sold and all debts are cleared. */
export function checkBankruptcy(p: PlayerState, content: Content, annualIncome: Cents, completedRound: number): boolean {
  const card = p.debts.find((d) => d.kind === 'creditCard');
  if (!card) return false;
  const floor = cityOf(content, p.cityId).livingCostAnnual;
  const threshold = content.debt.bankruptcyIncomeMultiple * Math.max(annualIncome, floor);
  if (card.principal <= threshold) return false;

  const keep = BP - content.debt.fireSaleDiscountBp;
  let proceeds = p.cash + p.deposit;
  for (const held of Object.values(p.positions)) proceeds += applyBp(held.value, keep);
  for (const property of p.properties) proceeds += applyBp(property.value, keep);
  let owed = 0;
  for (const d of p.debts) owed += d.principal;

  p.cash = Math.max(0, proceeds - owed);
  p.deposit = 0;
  p.positions = {};
  p.properties = [];
  p.debts = [];
  p.bankruptUntilRound = completedRound + content.debt.bankruptcyLockRounds;
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/debt.test.ts`
Expected: 13 tests pass.

- [ ] **Step 5: Write the failing property tests**

`packages/engine/src/property.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newPlayer } from './player';
import type { OrderContext } from './portfolio';
import {
  executeBuyProperty,
  executeSellProperty,
  executeSetRented,
  growProperties,
  ownsHome,
  propertyPrice,
} from './property';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { generateTimeline } from './world';

function setup(cash = 0) {
  const content = fixtureContent();
  const timeline = generateTimeline('property', content);
  const p = newPlayer({ ...fixtureStart(), cash });
  const ctx: OrderContext = {
    content,
    world: timeline[0],
    round: 0,
    tally: { realisedGains: 0, pensionContribution: 0, propertyPurchases: 0 },
  };
  return { content, timeline, p, ctx };
}

describe('property prices', () => {
  it('scales the city flat price by type and index', () => {
    const { content, timeline } = setup();
    expect(propertyPrice(content, timeline[0], 'home', 'flat')).toBe(25_000_000);
    expect(propertyPrice(content, timeline[0], 'home', 'studio')).toBe(15_000_000);
    const dearer = { ...timeline[0], propertyIndex: { ...timeline[0].propertyIndex, home: 11_000 } };
    expect(propertyPrice(content, dearer, 'home', 'studio')).toBe(16_500_000);
  });
});

describe('buying property', () => {
  it('buys outright with cash', () => {
    const { p, ctx } = setup(20_000_000);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx)).toBeNull();
    expect(p.cash).toBe(5_000_000);
    expect(p.properties).toEqual([
      { id: 'property-1', cityId: 'home', typeId: 'studio', value: 15_000_000, basis: 15_000_000, rented: true, mortgageId: null },
    ]);
    expect(ctx.tally.propertyPurchases).toBe(15_000_000);
  });

  it('buys with a fixed mortgage at the policy rate plus the spread', () => {
    const { p, ctx } = setup(4_000_000);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false }, ctx)).toBeNull();
    expect(p.cash).toBe(1_000_000);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'mortgageFixed', principal: 12_000_000, fixedRateBp: 400, roundsLeft: 12 }]);
    expect(p.properties[0].mortgageId).toBe('debt-1');
    expect(ownsHome(p)).toBe(true);
  });

  it('buys with a variable mortgage that stores no rate', () => {
    const { p, ctx } = setup(4_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: true }, ctx);
    expect(p.debts[0]).toMatchObject({ kind: 'mortgageVariable', fixedRateBp: 0 });
    expect(ownsHome(p)).toBe(false);
  });

  it('rejects bad purchases and changes nothing', () => {
    const { p, ctx } = setup(4_000_000);
    const before = JSON.stringify({ p, tally: ctx.tally });
    const buy = (over: Partial<{ typeId: string; downPayment: number; mortgage: 'fixed' | 'variable' | 'none' }>) =>
      executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false, ...over }, ctx);
    expect(buy({ typeId: 'castle' })).toBe('unknown property type: castle');
    expect(buy({ mortgage: 'none' })).toBe('not enough cash');
    expect(buy({ downPayment: 2_999_999 })).toBe('down payment is below the minimum');
    expect(buy({ downPayment: 15_000_000 })).toBe('down payment covers the full price; buy without a mortgage');
    expect(buy({ downPayment: 4_000_001 })).toBe('not enough cash');
    for (const downPayment of [0, -5, 12.5, NaN, Infinity]) {
      expect(buy({ downPayment })).toBe('down payment must be a positive whole number of cents');
    }
    p.bankruptUntilRound = 2;
    expect(buy({})).toBe('no credit available after bankruptcy');
    p.bankruptUntilRound = 0;
    expect(JSON.stringify({ p, tally: ctx.tally })).toBe(before);
  });
});

describe('selling and renting property', () => {
  it('sells, repays the mortgage and realises the gain', () => {
    const { p, ctx } = setup(4_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false }, ctx);
    p.properties[0].value = 18_000_000;
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'property-2' }, ctx)).toBeNull();
    expect(p.properties).toEqual([]);
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(1_000_000 + 18_000_000 - 12_000_000);
    expect(ctx.tally.realisedGains).toBe(3_000_000);
  });

  it('lets an underwater sale leave cash negative for the round to settle', () => {
    const { p, ctx } = setup(3_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: false }, ctx);
    p.properties[0].value = 5_000_000;
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'property-2' }, ctx)).toBeNull();
    expect(p.cash).toBe(-7_000_000);
    expect(p.debts).toEqual([]);
    expect(ctx.tally.realisedGains).toBe(-10_000_000);
  });

  it('rejects unknown property ids', () => {
    const { p, ctx } = setup();
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'gone' }, ctx)).toBe('unknown property: gone');
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: '__proto__' }, ctx)).toBe('unknown property: __proto__');
    expect(executeSetRented(p, { type: 'setRented', propertyId: 'gone', rented: true })).toBe('unknown property: gone');
  });

  it('switches a property between home and rental', () => {
    const { p, ctx } = setup(20_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: false }, ctx);
    expect(ownsHome(p)).toBe(true);
    expect(executeSetRented(p, { type: 'setRented', propertyId: 'property-1', rented: true })).toBeNull();
    expect(ownsHome(p)).toBe(false);
  });

  it('grows property values with the city index', () => {
    const { timeline, p, ctx } = setup(20_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx);
    const after = { ...timeline[1], propertyReturnBp: { ...timeline[1].propertyReturnBp, home: 1_000 } };
    growProperties(p, after);
    expect(p.properties[0].value).toBe(16_500_000);
    expect(p.properties[0].basis).toBe(15_000_000);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/property.test.ts`
Expected: FAIL, cannot resolve `./property`.

- [ ] **Step 7: Implement property**

`packages/engine/src/property.ts`:

```ts
import { cityOf } from './lookup';
import { applyBp, isAmount, round } from './money';
import type { Cents } from './money';
import { newId } from './player';
import type { OrderContext } from './portfolio';
import type { Content, Debt, Order, PlayerState, WorldState } from './types';
import { INDEX_START } from './world';

export function propertyPrice(content: Content, world: WorldState, cityId: string, typeId: string): Cents {
  const city = cityOf(content, cityId);
  const type = content.propertyTypes.find((t) => t.id === typeId);
  if (!type) throw new Error(`unknown property type: ${typeId}`);
  return round((((city.flatPrice * type.pricePct) / 100) * world.propertyIndex[cityId]) / INDEX_START);
}

/** True if the player lives in a property they own in their current city. */
export function ownsHome(p: PlayerState): boolean {
  return p.properties.some((x) => x.cityId === p.cityId && !x.rented);
}

export function executeBuyProperty(
  p: PlayerState,
  order: Extract<Order, { type: 'buyProperty' }>,
  ctx: OrderContext,
): string | null {
  const { content, world } = ctx;
  if (!content.propertyTypes.some((t) => t.id === order.typeId)) return `unknown property type: ${order.typeId}`;
  if (order.mortgage !== 'fixed' && order.mortgage !== 'variable' && order.mortgage !== 'none') return 'unknown mortgage type';
  const price = propertyPrice(content, world, p.cityId, order.typeId);

  let debt: Debt | null = null;
  let cashNeeded = price;
  if (order.mortgage !== 'none') {
    if (ctx.round < p.bankruptUntilRound) return 'no credit available after bankruptcy';
    if (!isAmount(order.downPayment)) return 'down payment must be a positive whole number of cents';
    const minimum = price - applyBp(price, content.debt.mortgageMaxLtvBp);
    if (order.downPayment < minimum) return 'down payment is below the minimum';
    if (order.downPayment >= price) return 'down payment covers the full price; buy without a mortgage';
    cashNeeded = order.downPayment;
    debt = {
      id: '',
      kind: order.mortgage === 'fixed' ? 'mortgageFixed' : 'mortgageVariable',
      principal: price - order.downPayment,
      fixedRateBp: order.mortgage === 'fixed' ? world.policyRateBp + content.debt.mortgageSpreadBp : 0,
      roundsLeft: content.debt.mortgageTermRounds,
    };
  }
  if (cashNeeded > p.cash) return 'not enough cash';

  p.cash -= cashNeeded;
  if (debt) {
    debt.id = newId(p, 'debt');
    p.debts.push(debt);
  }
  p.properties.push({
    id: newId(p, 'property'),
    cityId: p.cityId,
    typeId: order.typeId,
    value: price,
    basis: price,
    rented: order.rented === true,
    mortgageId: debt ? debt.id : null,
  });
  ctx.tally.propertyPurchases += price;
  return null;
}

export function executeSellProperty(
  p: PlayerState,
  order: Extract<Order, { type: 'sellProperty' }>,
  ctx: OrderContext,
): string | null {
  const index = p.properties.findIndex((x) => x.id === order.propertyId);
  if (index < 0) return `unknown property: ${order.propertyId}`;
  const property = p.properties[index];

  let payoff = 0;
  if (property.mortgageId !== null) {
    const mortgage = p.debts.find((d) => d.id === property.mortgageId);
    if (mortgage) {
      payoff = mortgage.principal;
      p.debts = p.debts.filter((d) => d.id !== mortgage.id);
    }
  }
  ctx.tally.realisedGains += property.value - property.basis;
  p.cash += property.value - payoff;
  p.properties.splice(index, 1);
  return null;
}

export function executeSetRented(p: PlayerState, order: Extract<Order, { type: 'setRented' }>): string | null {
  const property = p.properties.find((x) => x.id === order.propertyId);
  if (!property) return `unknown property: ${order.propertyId}`;
  property.rented = order.rented === true;
  return null;
}

export function growProperties(p: PlayerState, after: WorldState): void {
  for (const property of p.properties) {
    property.value = Math.max(0, property.value + applyBp(property.value, after.propertyReturnBp[property.cityId] ?? 0));
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/debt.test.ts packages/engine/src/property.test.ts && pnpm lint && pnpm typecheck`
Expected: 23 tests pass; lint and typecheck exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(engine): loans, mortgages, credit card, bankruptcy and property"
```

---

### Task 8: Income, expenses and scoring

**Files:**
- Create: `packages/engine/src/economy.ts`, `packages/engine/src/scoring.ts`
- Test: `packages/engine/src/economy.test.ts`, `packages/engine/src/scoring.test.ts`

**Interfaces:**
- Consumes: `applyBp`, `mulDiv`, `Cents` from `money.ts`; `cityOf`; `debtServiceForRound`, `DebtService` from `debt.ts`; `ownsHome` from `property.ts`; types from `types.ts`.
- Produces, from `economy.ts`:
  - `interface RoundIncome { salary; dividends; interest; rent; otherPassive }` (all `Cents`, for the whole round)
  - `interface RoundExpenses { living: Cents; other: Cents; debtInterest: Cents; debtPrincipal: Cents; service: DebtService }`
  - `livingCostAnnual(p: PlayerState, content: Content): Cents`
  - `incomeForRound(p: PlayerState, content: Content, world: WorldState): RoundIncome`
  - `expensesForRound(p: PlayerState, content: Content, world: WorldState): RoundExpenses`
  - `passiveOf(income: RoundIncome): Cents` and `outgoingsOf(expenses: RoundExpenses): Cents`
- Produces, from `scoring.ts`:
  - `wealthPoints(netWorth: Cents, breakpoints: ReadonlyArray<readonly [Cents, number]>): number`
  - `escapeMultiplier(escapedAtRound: number | null, rounds: number, scoring: ScoringParams): number`
  - `scoreOf(netWorth: Cents, statusPoints: number, escapedAtRound: number | null, content: Content): number`

Rules implemented here:

- Living cost = city living cost × lifestyle multiplier. An owner-occupier pays it less the housing share.
- Dividends = position value × annual yield × years. A bond's yield is the policy rate plus its spread, floored at zero.
- Deposit interest = balance × (policy rate - deposit spread, floored at zero) × years.
- Rent = value of each rented property × the city's rent yield × years.
- Wealth points interpolate linearly between breakpoints and are flat outside them.
- Escape multiplier = 100 if never escaped, otherwise `escapeBase + escapePerRoundLeft × (rounds - escapedAtRound)`.
- Score = `floor((wealth points + status points) × multiplier / 100)`.

- [ ] **Step 1: Write the failing tests**

`packages/engine/src/economy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expensesForRound, incomeForRound, livingCostAnnual, outgoingsOf, passiveOf } from './economy';
import { newPlayer } from './player';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { Property } from './types';
import { generateTimeline } from './world';

const content = fixtureContent();
const world = generateTimeline('economy', content)[0];

const flat = (over: Partial<Property>): Property => ({
  id: 'property-1', cityId: 'home', typeId: 'flat', value: 25_000_000, basis: 25_000_000, rented: false, mortgageId: null, ...over,
});

describe('living cost', () => {
  it('scales with the lifestyle tier', () => {
    expect(livingCostAnnual(newPlayer({ ...fixtureStart(), lifestyleTier: 0 }), content)).toBe(1_260_000);
    expect(livingCostAnnual(newPlayer({ ...fixtureStart(), lifestyleTier: 1 }), content)).toBe(1_800_000);
    expect(livingCostAnnual(newPlayer({ ...fixtureStart(), lifestyleTier: 3 }), content)).toBe(3_600_000);
  });

  it('drops the housing share for an owner-occupier only', () => {
    const p = newPlayer(fixtureStart());
    p.properties.push(flat({}));
    expect(livingCostAnnual(p, content)).toBe(1_170_000);
    p.properties[0].rented = true;
    expect(livingCostAnnual(p, content)).toBe(1_800_000);
    p.properties[0] = flat({ cityId: 'haven' });
    expect(livingCostAnnual(p, content)).toBe(1_800_000);
  });
});

describe('income for a round', () => {
  it('pays salary, dividends, coupons, deposit interest, rent and other passive income', () => {
    const p = newPlayer(fixtureStart());
    p.positions.fund_world = { value: 1_000_000, basis: 1_000_000 };
    p.positions.bond_long = { value: 1_000_000, basis: 1_000_000 };
    p.deposit = 1_000_000;
    p.properties.push(flat({ rented: true }));
    p.extraPassiveAnnual = 100_000;
    const income = incomeForRound(p, content, world);
    expect(income).toEqual({ salary: 6_000_000, dividends: 36_000 + 60_000, interest: 30_000, rent: 2_250_000, otherPassive: 200_000 });
    expect(passiveOf(income)).toBe(96_000 + 30_000 + 2_250_000 + 200_000);
  });

  it('pays no rent on a home and no interest when the policy rate is under the spread', () => {
    const p = newPlayer(fixtureStart());
    p.deposit = 1_000_000;
    p.properties.push(flat({ rented: false }));
    const income = incomeForRound(p, content, { ...world, policyRateBp: 50 });
    expect(income.rent).toBe(0);
    expect(income.interest).toBe(0);
  });
});

describe('expenses for a round', () => {
  it('adds living cost, other expenses and debt service', () => {
    const p = newPlayer(fixtureStart());
    p.extraExpensesAnnual = 250_000;
    p.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 900_000, fixedRateBp: 750, roundsLeft: 3 });
    const expenses = expensesForRound(p, content, world);
    expect(expenses.living).toBe(3_600_000);
    expect(expenses.other).toBe(500_000);
    expect(expenses.debtInterest).toBe(135_000);
    expect(expenses.debtPrincipal).toBe(300_000);
    expect(outgoingsOf(expenses)).toBe(4_535_000);
  });
});
```

`packages/engine/src/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { escapeMultiplier, scoreOf, wealthPoints } from './scoring';
import { fixtureContent } from './testing/fixture';

const content = fixtureContent();
const points = content.scoring.wealthBreakpoints;

describe('scoring', () => {
  it('gives no wealth points at or below zero', () => {
    expect(wealthPoints(0, points)).toBe(0);
    expect(wealthPoints(-5_000_000, points)).toBe(0);
  });

  it('interpolates between breakpoints', () => {
    expect(wealthPoints(1_000_000, points)).toBe(100);
    expect(wealthPoints(5_500_000, points)).toBe(150);
    expect(wealthPoints(100_000_000, points)).toBe(300);
  });

  it('caps at the last breakpoint, even for absurd wealth', () => {
    expect(wealthPoints(10_000_000_000, points)).toBe(500);
    expect(wealthPoints(1e24, points)).toBe(500);
  });

  it('multiplies by 100 without escape and more the earlier the escape', () => {
    expect(escapeMultiplier(null, 20, content.scoring)).toBe(100);
    expect(escapeMultiplier(20, 20, content.scoring)).toBe(125);
    expect(escapeMultiplier(1, 20, content.scoring)).toBe(182);
  });

  it('combines wealth, status and escape', () => {
    expect(scoreOf(100_000_000, 50, null, content)).toBe(350);
    expect(scoreOf(100_000_000, 50, 1, content)).toBe(637);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run packages/engine/src/economy.test.ts packages/engine/src/scoring.test.ts`
Expected: FAIL, cannot resolve `./economy` and `./scoring`.

- [ ] **Step 3: Implement economy and scoring**

`packages/engine/src/economy.ts`:

```ts
import { debtServiceForRound } from './debt';
import type { DebtService } from './debt';
import { cityOf } from './lookup';
import { applyBp, mulDiv } from './money';
import type { Cents } from './money';
import { ownsHome } from './property';
import type { Content, PlayerState, WorldState } from './types';

/** Amounts for one whole round. */
export interface RoundIncome {
  salary: Cents;
  dividends: Cents;
  interest: Cents;
  rent: Cents;
  otherPassive: Cents;
}

export interface RoundExpenses {
  living: Cents;
  other: Cents;
  debtInterest: Cents;
  debtPrincipal: Cents;
  service: DebtService;
}

export function livingCostAnnual(p: PlayerState, content: Content): Cents {
  const city = cityOf(content, p.cityId);
  const base = mulDiv(city.livingCostAnnual, content.lifestyleMultiplierPct[p.lifestyleTier], 100);
  return ownsHome(p) ? base - mulDiv(base, content.housingSharePct, 100) : base;
}

/** Income earned on what the player holds, at the rates of the given world. */
export function incomeForRound(p: PlayerState, content: Content, world: WorldState): RoundIncome {
  const years = content.yearsPerRound;

  let dividends = 0;
  for (const asset of content.assets) {
    if (!Object.hasOwn(p.positions, asset.id)) continue;
    const yieldBp =
      asset.class === 'bond' ? Math.max(0, world.policyRateBp + (asset.yieldSpreadBp ?? 0)) : asset.yieldBp;
    dividends += applyBp(p.positions[asset.id].value, yieldBp * years);
  }

  const depositRateBp = Math.max(0, world.policyRateBp - content.market.depositSpreadBp);
  const interest = applyBp(p.deposit, depositRateBp * years);

  let rent = 0;
  for (const property of p.properties) {
    if (property.rented) rent += applyBp(property.value, cityOf(content, property.cityId).rentYieldBp * years);
  }

  return {
    salary: p.salaryAnnual * years,
    dividends,
    interest,
    rent,
    otherPassive: p.extraPassiveAnnual * years,
  };
}

export function expensesForRound(p: PlayerState, content: Content, world: WorldState): RoundExpenses {
  const years = content.yearsPerRound;
  const service = debtServiceForRound(p, content, world);
  return {
    living: livingCostAnnual(p, content) * years,
    other: p.extraExpensesAnnual * years,
    debtInterest: service.interest,
    debtPrincipal: service.principal,
    service,
  };
}

export function passiveOf(income: RoundIncome): Cents {
  return income.dividends + income.interest + income.rent + income.otherPassive;
}

export function outgoingsOf(expenses: RoundExpenses): Cents {
  return expenses.living + expenses.other + expenses.debtInterest + expenses.debtPrincipal;
}
```

`packages/engine/src/scoring.ts`:

```ts
import { mulDiv } from './money';
import type { Cents } from './money';
import type { Content, ScoringParams } from './types';

export function wealthPoints(netWorth: Cents, breakpoints: ReadonlyArray<readonly [Cents, number]>): number {
  if (netWorth <= breakpoints[0][0]) return breakpoints[0][1];
  for (let i = 1; i < breakpoints.length; i++) {
    const [x0, y0] = breakpoints[i - 1];
    const [x1, y1] = breakpoints[i];
    if (netWorth <= x1) return y0 + mulDiv(netWorth - x0, y1 - y0, x1 - x0);
  }
  return breakpoints[breakpoints.length - 1][1];
}

/** In percent: 100 means no bonus. */
export function escapeMultiplier(escapedAtRound: number | null, rounds: number, scoring: ScoringParams): number {
  if (escapedAtRound === null) return 100;
  return scoring.escapeBase + scoring.escapePerRoundLeft * (rounds - escapedAtRound);
}

export function scoreOf(netWorth: Cents, statusPoints: number, escapedAtRound: number | null, content: Content): number {
  const wealth = wealthPoints(netWorth, content.scoring.wealthBreakpoints);
  const multiplier = escapeMultiplier(escapedAtRound, content.rounds, content.scoring);
  return Math.floor(((wealth + statusPoints) * multiplier) / 100);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run packages/engine/src/economy.test.ts packages/engine/src/scoring.test.ts && pnpm lint && pnpm typecheck`
Expected: 10 tests pass; lint and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): round income and expenses, wealth points and escape multiplier"
```

---

### Task 9: Round resolution

**Files:**
- Create: `packages/engine/src/orders.ts`, `packages/engine/src/game.ts`, `packages/engine/src/selectors.ts`
- Test: `packages/engine/src/game.test.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 2 to 8.
- Produces:
  - `executeOrder(p: PlayerState, order: Order, ctx: OrderContext): string | null`
  - `createGame(config: GameConfig, seed: string): GameState` (throws `invalid content: ...` or `unknown city: ...`)
  - `applyRound(content: Content, state: GameState, choices: RoundChoices): { state: GameState; events: GameEvent[] }` (throws `applyRound: the game is already finished`)
  - `netWorth(p: PlayerState): Cents`
  - `finalScore(content: Content, state: GameState): number`
  - `cashflow(content: Content, state: GameState): { salaryAnnual: Cents; passiveAnnual: Cents; expensesAnnual: Cents }`

`applyRound` takes `content` as its first argument. The spec's sketch folded it into the state; keeping it separate keeps saved games small.

Resolve order inside `applyRound`:

1. Clone the state.
2. Execute orders at this round's prices and rates. A rejected order becomes an `orderRejected` event.
3. Work out income and expenses from what is now held, at this round's rates.
4. Move prices to the next world state.
5. Add income, subtract expenses, apply debt payments.
6. Charge tax.
7. Settle cash: a shortfall goes on the credit card; spare cash pays the card down.
8. Update the passive-income streak and mark escape after two rounds in a row.
9. Check bankruptcy.
10. Advance the round counter and set `finished`.

- [ ] **Step 1: Write the failing tests**

`packages/engine/src/game.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { cashflow, finalScore, netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameEvent, GameState, LedgerLine } from './types';

const content = fixtureContent();

const ledger = (events: GameEvent[], line: LedgerLine) => events.find((e) => e.kind === 'ledger' && e.line === line);

function withPlayer(state: GameState, over: Partial<GameState['player']>): GameState {
  return { ...state, player: { ...state.player, ...over } };
}

describe('createGame', () => {
  it('builds the timeline and the player', () => {
    const state = createGame({ content, start: fixtureStart() }, 'new');
    expect(state.round).toBe(0);
    expect(state.finished).toBe(false);
    expect(state.timeline).toHaveLength(21);
    expect(state.player.cityId).toBe('home');
  });

  it('refuses invalid content and unknown cities', () => {
    expect(() => createGame({ content: { ...content, rounds: 0 }, start: fixtureStart() }, 's')).toThrow('invalid content: rounds must be a positive integer');
    expect(() => createGame({ content, start: { ...fixtureStart(), cityId: 'atlantis' } }, 's')).toThrow('unknown city: atlantis');
  });
});

describe('applyRound', () => {
  it('pays salary, charges living costs and income tax', () => {
    const start = createGame({ content, start: fixtureStart() }, 'g1');
    const { state, events } = applyRound(content, start, { orders: [] });
    expect(state.round).toBe(1);
    expect(state.player.cash).toBe(1_830_000);
    expect(ledger(events, 'salary')).toEqual({ kind: 'ledger', line: 'salary', amount: 6_000_000 });
    expect(ledger(events, 'living')).toEqual({ kind: 'ledger', line: 'living', amount: -3_600_000 });
    expect(ledger(events, 'incomeTax')).toEqual({ kind: 'ledger', line: 'incomeTax', amount: -570_000 });
    expect(ledger(events, 'dividends')).toBeUndefined();
  });

  it('does not change the state it was given', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 500_000 } }, 'g2');
    const before = JSON.stringify(start);
    applyRound(content, start, { orders: [{ type: 'buy', assetId: 'gold', amount: 100_000 }] });
    expect(JSON.stringify(start)).toBe(before);
  });

  it('executes orders now and applies the next world step to them', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 1_000_000 } }, 'g3');
    const { state } = applyRound(content, start, { orders: [{ type: 'buy', assetId: 'fund_world', amount: 1_000_000 }] });
    const ret = start.timeline[1].assetReturnBp.fund_world;
    expect(state.player.positions.fund_world).toEqual({ value: 1_000_000 + 100 * ret, basis: 1_000_000 });
  });

  it('reports a rejected order and carries on as if it was not there', () => {
    const start = createGame({ content, start: fixtureStart() }, 'g4');
    const bad = applyRound(content, start, { orders: [{ type: 'buy', assetId: 'fund_world', amount: 12.5 }] });
    const none = applyRound(content, start, { orders: [] });
    expect(bad.events.filter((e) => e.kind === 'orderRejected')).toEqual([
      { kind: 'orderRejected', order: { type: 'buy', assetId: 'fund_world', amount: 12.5 }, reason: 'amount must be a positive whole number of cents' },
    ]);
    expect(bad.state).toEqual(none.state);
  });

  it('rejects orders that are not orders', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'g4b');
    const orders = JSON.parse(
      '[{"type":"teleport","amount":5},null,7,{"type":"buyProperty","typeId":"studio","downPayment":5000000,"mortgage":"weird","rented":"yes"}]',
    );
    const { state, events } = applyRound(content, start, { orders });
    const reasons = events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));
    expect(reasons).toEqual(['unknown order type', 'unknown order type', 'unknown order type', 'unknown mortgage type']);
    expect(state.player.properties).toEqual([]);
  });

  it('survives a life with no income: card debt, one bankruptcy lock, and still reaches the end', () => {
    let state = createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0 } }, 'g5');
    const first = applyRound(content, state, { orders: [] });
    expect(first.state.player.debts).toEqual([{ id: 'debt-1', kind: 'creditCard', principal: 3_600_000, fixedRateBp: 0, roundsLeft: 0 }]);
    expect(ledger(first.events, 'creditCardDraw')).toEqual({ kind: 'ledger', line: 'creditCardDraw', amount: 3_600_000 });

    const second = applyRound(content, first.state, { orders: [] });
    expect(second.events).toContainEqual({ kind: 'bankrupt' });
    expect(second.state.player.debts).toEqual([]);
    expect(second.state.player.bankruptUntilRound).toBe(5);

    const third = applyRound(content, second.state, { orders: [{ type: 'borrow', amount: 100 }] });
    expect(third.events.find((e) => e.kind === 'orderRejected')).toMatchObject({ reason: 'no credit available after bankruptcy' });

    state = third.state;
    while (!state.finished) {
      state = applyRound(content, state, { orders: [] }).state;
      expect(state.player.cash).toBeGreaterThanOrEqual(0);
    }
    expect(state.round).toBe(20);
    expect(Number.isFinite(netWorth(state.player))).toBe(true);
  });

  it('settles an underwater property sale onto the credit card', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 5_000_000 } }, 'g6');
    const bought = applyRound(content, start, {
      orders: [{ type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: false }],
    });
    expect(bought.state.player.properties).toHaveLength(1);
    const crashed = structuredClone(bought.state);
    crashed.player.properties[0].value = 5_000_000;
    const sold = applyRound(content, crashed, {
      orders: [{ type: 'sellProperty', propertyId: crashed.player.properties[0].id }],
    });
    const p = sold.state.player;
    expect(p.properties).toEqual([]);
    expect(p.debts.some((d) => d.kind === 'mortgageVariable')).toBe(false);
    expect(p.debts.some((d) => d.kind === 'creditCard')).toBe(true);
    expect(p.cash).toBe(0);
    expect(ledger(sold.events, 'investmentTax')).toBeUndefined();
  });

  it('marks escape after two rounds in a row of passive income covering expenses', () => {
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 'g7'), { extraPassiveAnnual: 5_000_000 });
    const first = applyRound(content, start, { orders: [] });
    expect(first.state.player.passiveStreak).toBe(1);
    expect(first.state.player.escapedAtRound).toBeNull();
    const second = applyRound(content, first.state, { orders: [] });
    expect(second.state.player.escapedAtRound).toBe(1);
    expect(second.events).toContainEqual({ kind: 'escaped', round: 1 });
    const third = applyRound(content, second.state, { orders: [] });
    expect(third.state.player.escapedAtRound).toBe(1);
    expect(third.events.some((e) => e.kind === 'escaped')).toBe(false);
  });

  it('resets the streak when passive income falls short', () => {
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 'g8'), { extraPassiveAnnual: 5_000_000 });
    const first = applyRound(content, start, { orders: [] });
    const second = applyRound(content, withPlayer(first.state, { extraPassiveAnnual: 0 }), { orders: [] });
    expect(second.state.player.passiveStreak).toBe(0);
    expect(second.state.player.escapedAtRound).toBeNull();
  });

  it('gives the same result after a JSON round trip of the state', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 2_000_000 } }, 'g9');
    const orders = [{ type: 'buy' as const, assetId: 'coin_meme', amount: 500_000 }];
    const direct = applyRound(content, applyRound(content, start, { orders }).state, { orders: [] });
    const reloaded = JSON.parse(JSON.stringify(applyRound(content, start, { orders }).state)) as GameState;
    expect(applyRound(content, reloaded, { orders: [] })).toEqual(direct);
  });

  it('finishes after the last round and then refuses to continue', () => {
    let state = createGame({ content, start: fixtureStart() }, 'g10');
    for (let i = 0; i < 20; i++) state = applyRound(content, state, { orders: [] }).state;
    expect(state.finished).toBe(true);
    expect(() => applyRound(content, state, { orders: [] })).toThrow('applyRound: the game is already finished');
  });
});

describe('selectors', () => {
  it('nets assets against debts', () => {
    const state = createGame({ content, start: { ...fixtureStart(), cash: 1_000 } }, 'n');
    const p = state.player;
    p.deposit = 2_000;
    p.pension = 3_000;
    p.positions.gold = { value: 4_000, basis: 1 };
    p.properties.push({ id: 'property-1', cityId: 'home', typeId: 'flat', value: 5_000, basis: 1, rented: true, mortgageId: null });
    p.debts.push({ id: 'debt-2', kind: 'personalLoan', principal: 6_000, fixedRateBp: 0, roundsLeft: 1 });
    expect(netWorth(p)).toBe(9_000);
  });

  it('scores a finished state', () => {
    const state = withPlayer(createGame({ content, start: { ...fixtureStart(), cash: 100_000_000 } }, 'f'), {
      statusPoints: 50,
      escapedAtRound: 1,
    });
    expect(finalScore(content, state)).toBe(637);
  });

  it('reports annual cashflow at the current rates', () => {
    const state = withPlayer(createGame({ content, start: fixtureStart() }, 'c'), { deposit: 1_000_000 });
    expect(cashflow(content, state)).toEqual({ salaryAnnual: 3_000_000, passiveAnnual: 15_000, expensesAnnual: 1_800_000 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/engine/src/game.test.ts`
Expected: FAIL, cannot resolve `./game` and `./selectors`.

- [ ] **Step 3: Implement the order router**

`packages/engine/src/orders.ts`:

```ts
import { executeBorrow, executeRepay } from './debt';
import { executePortfolioOrder } from './portfolio';
import type { OrderContext } from './portfolio';
import { executeBuyProperty, executeSellProperty, executeSetRented } from './property';
import type { Order, PlayerState } from './types';

/** Returns the reason for rejection, or null when the order was executed. */
export function executeOrder(p: PlayerState, order: Order, ctx: OrderContext): string | null {
  if (order === null || typeof order !== 'object') return 'unknown order type';
  switch (order.type) {
    case 'buy':
    case 'sell':
    case 'depositIn':
    case 'depositOut':
    case 'pensionIn':
      return executePortfolioOrder(p, order, ctx);
    case 'borrow':
      return executeBorrow(p, order, ctx);
    case 'repay':
      return executeRepay(p, order);
    case 'buyProperty':
      return executeBuyProperty(p, order, ctx);
    case 'sellProperty':
      return executeSellProperty(p, order, ctx);
    case 'setRented':
      return executeSetRented(p, order);
    default:
      return 'unknown order type';
  }
}
```

- [ ] **Step 4: Implement the selectors**

`packages/engine/src/selectors.ts`:

```ts
import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import type { Cents } from './money';
import { scoreOf } from './scoring';
import type { Content, GameState, PlayerState } from './types';

export function netWorth(p: PlayerState): Cents {
  let total = p.cash + p.deposit + p.pension;
  for (const held of Object.values(p.positions)) total += held.value;
  for (const property of p.properties) total += property.value;
  for (const debt of p.debts) total -= debt.principal;
  return total;
}

export function finalScore(content: Content, state: GameState): number {
  const p = state.player;
  return scoreOf(netWorth(p), p.statusPoints, p.escapedAtRound, content);
}

/** Yearly figures at the current world's rates, for the HUD. */
export function cashflow(
  content: Content,
  state: GameState,
): { salaryAnnual: Cents; passiveAnnual: Cents; expensesAnnual: Cents } {
  const world = state.timeline[state.round];
  const years = content.yearsPerRound;
  const income = incomeForRound(state.player, content, world);
  const expenses = expensesForRound(state.player, content, world);
  return {
    salaryAnnual: Math.floor(income.salary / years),
    passiveAnnual: Math.floor(passiveOf(income) / years),
    expensesAnnual: Math.floor(outgoingsOf(expenses) / years),
  };
}
```

- [ ] **Step 5: Implement createGame and applyRound**

`packages/engine/src/game.ts`:

```ts
import { applyDebtPayments, checkBankruptcy, settleCash } from './debt';
import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import { cityOf } from './lookup';
import type { Cents } from './money';
import { executeOrder } from './orders';
import { newPlayer } from './player';
import { growPortfolio } from './portfolio';
import type { OrderContext, RoundTally } from './portfolio';
import { growProperties } from './property';
import { computeTax } from './tax';
import type { Content, GameConfig, GameEvent, GameState, LedgerLine, RoundChoices } from './types';
import { validateContent } from './validate';
import { generateTimeline } from './world';

export function createGame(config: GameConfig, seed: string): GameState {
  const errors = validateContent(config.content);
  if (errors.length > 0) throw new Error(`invalid content: ${errors.join('; ')}`);
  cityOf(config.content, config.start.cityId);
  return {
    seed,
    round: 0,
    timeline: generateTimeline(seed, config.content),
    player: newPlayer(config.start),
    finished: false,
  };
}

export function applyRound(
  content: Content,
  state: GameState,
  choices: RoundChoices,
): { state: GameState; events: GameEvent[] } {
  if (state.finished) throw new Error('applyRound: the game is already finished');

  const next = structuredClone(state);
  const p = next.player;
  const events: GameEvent[] = [];
  const now = next.timeline[next.round];
  const after = next.timeline[next.round + 1];
  const years = content.yearsPerRound;
  const completed = next.round + 1;

  const tally: RoundTally = { realisedGains: 0, pensionContribution: 0, propertyPurchases: 0 };
  const ctx: OrderContext = { content, world: now, round: next.round, tally };
  for (const order of choices.orders) {
    const reason = executeOrder(p, order, ctx);
    if (reason !== null) events.push({ kind: 'orderRejected', order, reason });
  }

  const income = incomeForRound(p, content, now);
  const expenses = expensesForRound(p, content, now);
  const passive = passiveOf(income);
  const outgoings = outgoingsOf(expenses);

  growPortfolio(p, content, after);
  growProperties(p, after);

  p.cash += income.salary + passive - outgoings;
  applyDebtPayments(p, expenses.service);

  let propertyValueOwned = 0;
  for (const property of p.properties) propertyValueOwned += property.value;
  const bill = computeTax(cityOf(content, p.cityId), years, {
    salary: income.salary,
    pensionContribution: tally.pensionContribution,
    realisedGains: tally.realisedGains,
    dividends: income.dividends + income.interest,
    rent: income.rent,
    propertyValueOwned,
    propertyPurchases: tally.propertyPurchases,
  });
  p.cash -= bill.total;

  const drawn = settleCash(p);

  const lines: Array<[LedgerLine, Cents]> = [
    ['salary', income.salary],
    ['dividends', income.dividends],
    ['interest', income.interest],
    ['rent', income.rent],
    ['otherPassive', income.otherPassive],
    ['living', -expenses.living],
    ['otherExpenses', -expenses.other],
    ['debtInterest', -expenses.debtInterest],
    ['debtPrincipal', -expenses.debtPrincipal],
    ['incomeTax', -bill.income],
    ['investmentTax', -bill.investment],
    ['propertyTax', -bill.property],
    ['creditCardDraw', drawn],
  ];
  for (const [line, amount] of lines) {
    if (amount !== 0) events.push({ kind: 'ledger', line, amount });
  }

  p.passiveStreak = passive >= outgoings ? p.passiveStreak + 1 : 0;
  if (p.escapedAtRound === null && p.passiveStreak >= 2) {
    p.escapedAtRound = completed - 1;
    events.push({ kind: 'escaped', round: completed - 1 });
  }

  const annualIncome = p.salaryAnnual + Math.floor(passive / years);
  if (checkBankruptcy(p, content, annualIncome, completed)) events.push({ kind: 'bankrupt' });

  next.round = completed;
  next.finished = completed >= content.rounds;
  return { state: next, events };
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm vitest run packages/engine/src/game.test.ts && pnpm lint && pnpm typecheck`
Expected: 16 tests pass; lint and typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): createGame, applyRound and selectors"
```

---

### Task 10: Hash, determinism, invariants and golden replay

**Files:**
- Create: `packages/engine/src/hash.ts`, `packages/engine/src/invariants.ts`, `packages/engine/src/testing/play.ts`
- Modify: `packages/engine/src/index.ts` (replace the whole file)
- Test: `packages/engine/src/determinism.test.ts`, `packages/engine/src/invariants.test.ts`, `packages/engine/src/properties.test.ts`, `packages/engine/src/replay.test.ts`

**Interfaces:**
- Consumes: `createGame`, `applyRound`, `netWorth`, `finalScore`, the fixture, all types.
- Produces:
  - `canonical(value: unknown): string` (JSON with sorted keys)
  - `stateHash(state: unknown): string` (16 hex characters)
  - `playGame(content: Content, start: StartConfig, seed: string, choose: (state: GameState) => RoundChoices): { state: GameState; events: GameEvent[] }`
  - `scriptedChoices(content: Content): (state: GameState) => RoundChoices`
  - `findInvariantBreaks(content: Content, state: GameState): string[]` (empty means sound)
  - `assertInvariants(content: Content, state: GameState): void` (throws `invariant broken at round N (state HASH): ...`). The web client calls this after every round in development builds.
  - The public API of `@ratrace/engine` through `index.ts`

- [ ] **Step 1: Write the hash, the invariant checker, the play helper and the public exports**

`packages/engine/src/hash.ts`:

```ts
/** JSON with object keys sorted, so equal states always give equal text. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`);
  return `{${parts.join(',')}}`;
}

function fnv1a(text: string, seed: number): number {
  let h = seed | 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A 16-character hex fingerprint of a state. Equal states give equal hashes on every device. */
export function stateHash(state: unknown): string {
  const text = canonical(state);
  const high = fnv1a(text, 0x811c9dc5).toString(16).padStart(8, '0');
  const low = fnv1a(text, 0x9747b28c).toString(16).padStart(8, '0');
  return high + low;
}
```

`packages/engine/src/invariants.ts`:

```ts
import { stateHash } from './hash';
import type { Content, GameState } from './types';

/** Lists every broken rule. An empty list means the state is sound. */
export function findInvariantBreaks(content: Content, state: GameState): string[] {
  const p = state.player;
  const breaks: string[] = [];

  const money: Array<[string, number]> = [
    ['cash', p.cash],
    ['deposit', p.deposit],
    ['pension', p.pension],
  ];
  for (const [id, held] of Object.entries(p.positions)) {
    money.push([`position ${id} value`, held.value], [`position ${id} basis`, held.basis]);
  }
  for (const property of p.properties) {
    money.push([`property ${property.id} value`, property.value], [`property ${property.id} basis`, property.basis]);
  }
  for (const debt of p.debts) money.push([`debt ${debt.id} principal`, debt.principal]);

  for (const [name, value] of money) {
    if (!Number.isInteger(value) || value < 0 || Object.is(value, -0)) {
      breaks.push(`${name} is not a non-negative whole number: ${value}`);
    }
  }
  for (const debt of p.debts) {
    if (debt.principal === 0) breaks.push(`debt ${debt.id} is fully paid but still listed`);
  }
  for (const [id, held] of Object.entries(p.positions)) {
    if (held.value === 0) breaks.push(`position ${id} is empty but still listed`);
    if (!content.assets.some((a) => a.id === id)) breaks.push(`position ${id} is not a known asset`);
  }
  for (const property of p.properties) {
    if (property.mortgageId !== null && !p.debts.some((d) => d.id === property.mortgageId)) {
      breaks.push(`property ${property.id} points at a missing mortgage`);
    }
  }
  if (!Number.isInteger(state.round) || state.round < 0 || state.round > content.rounds) {
    breaks.push(`round ${state.round} is out of range`);
  }
  if (state.finished !== (state.round >= content.rounds)) breaks.push('finished flag does not match the round');

  return breaks;
}

export function assertInvariants(content: Content, state: GameState): void {
  const breaks = findInvariantBreaks(content, state);
  if (breaks.length > 0) {
    throw new Error(`invariant broken at round ${state.round} (state ${stateHash(state)}): ${breaks.join('; ')}`);
  }
}
```

`packages/engine/src/testing/play.ts`:

```ts
import { applyRound, createGame } from '../game';
import { applyBp } from '../money';
import { propertyPrice } from '../property';
import type { Content, GameEvent, GameState, Order, RoundChoices, StartConfig } from '../types';

export function playGame(
  content: Content,
  start: StartConfig,
  seed: string,
  choose: (state: GameState) => RoundChoices,
): { state: GameState; events: GameEvent[] } {
  let state = createGame({ content, start }, seed);
  const events: GameEvent[] = [];
  while (!state.finished) {
    const result = applyRound(content, state, choose(state));
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/** A fixed strategy that touches every kind of order. Some orders are rejected on purpose. */
export function scriptedChoices(content: Content): (state: GameState) => RoundChoices {
  return (state) => {
    const p = state.player;
    const world = state.timeline[state.round];
    const orders: Order[] = [];

    if (state.round === 6) {
      if (p.deposit > 0) orders.push({ type: 'depositOut', amount: p.deposit });
      for (const [assetId, held] of Object.entries(p.positions)) {
        orders.push({ type: 'sell', assetId, amount: held.value });
      }
      const price = propertyPrice(content, world, p.cityId, 'studio');
      const downPayment = price - applyBp(price, content.debt.mortgageMaxLtvBp);
      orders.push({ type: 'buyProperty', typeId: 'studio', downPayment, mortgage: 'variable', rented: true });
      return { orders };
    }

    const slice = Math.floor(p.cash / 10);
    if (slice > 0) {
      orders.push(
        { type: 'depositIn', amount: slice },
        { type: 'buy', assetId: 'fund_world', amount: slice * 3 },
        { type: 'buy', assetId: 'bond_long', amount: slice },
        { type: 'buy', assetId: 'coin_meme', amount: slice },
        { type: 'pensionIn', amount: slice },
      );
    }
    if (state.round === 2) orders.push({ type: 'borrow', amount: 500_000 });
    if (state.round === 3) {
      for (const debt of p.debts) {
        if (debt.kind === 'personalLoan') orders.push({ type: 'repay', debtId: debt.id, amount: 100_000 });
      }
    }
    if (state.round === 9) {
      for (const property of p.properties) orders.push({ type: 'setRented', propertyId: property.id, rented: false });
    }
    if (state.round === 14) {
      for (const property of p.properties) orders.push({ type: 'sellProperty', propertyId: property.id });
    }
    if (state.round % 5 === 4 && Object.hasOwn(p.positions, 'fund_world')) {
      orders.push({ type: 'sell', assetId: 'fund_world', amount: Math.max(1, Math.floor(p.positions.fund_world.value / 2)) });
    }
    return { orders };
  };
}
```

`packages/engine/src/index.ts`:

```ts
export * from './types';
export type { Bp, Cents } from './money';
export { createGame, applyRound } from './game';
export { netWorth, finalScore, cashflow } from './selectors';
export { validateContent } from './validate';
export { propertyPrice } from './property';
export { debtRateBp } from './debt';
export { stateHash } from './hash';
export { assertInvariants, findInvariantBreaks } from './invariants';
```

- [ ] **Step 2: Write the tests**

`packages/engine/src/invariants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGame } from './game';
import { assertInvariants, findInvariantBreaks } from './invariants';
import { fixtureContent, fixtureStart } from './testing/fixture';

const content = fixtureContent();

describe('invariants', () => {
  it('finds nothing wrong with a fresh game', () => {
    const state = createGame({ content, start: fixtureStart() }, 'i');
    expect(findInvariantBreaks(content, state)).toEqual([]);
    expect(() => assertInvariants(content, state)).not.toThrow();
  });

  it('names each broken rule', () => {
    const state = createGame({ content, start: fixtureStart() }, 'i');
    state.player.cash = 0.5;
    state.player.deposit = NaN;
    state.player.positions.nope = { value: 0, basis: -1 };
    state.player.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 0, fixedRateBp: 0, roundsLeft: 1 });
    state.player.properties.push({
      id: 'property-2', cityId: 'home', typeId: 'flat', value: 1, basis: 1, rented: false, mortgageId: 'debt-9',
    });
    expect(findInvariantBreaks(content, state)).toEqual([
      'cash is not a non-negative whole number: 0.5',
      'deposit is not a non-negative whole number: NaN',
      'position nope basis is not a non-negative whole number: -1',
      'debt debt-1 is fully paid but still listed',
      'position nope is empty but still listed',
      'position nope is not a known asset',
      'property property-2 points at a missing mortgage',
    ]);
  });

  it('throws with the round and the state hash', () => {
    const state = createGame({ content, start: fixtureStart() }, 'i');
    state.player.cash = -1;
    expect(() => assertInvariants(content, state)).toThrow(
      /^invariant broken at round 0 \(state [0-9a-f]{16}\): cash is not a non-negative whole number: -1$/,
    );
  });
});
```

`packages/engine/src/determinism.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { canonical, stateHash } from './hash';
import { netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { playGame, scriptedChoices } from './testing/play';
import type { GameState, LedgerLine } from './types';

const content = fixtureContent();
const start = { ...fixtureStart(), cash: 5_000_000 };

describe('hash', () => {
  it('ignores key order and separates different states', () => {
    expect(canonical({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    expect(stateHash({ a: 1, b: 2 })).toBe(stateHash({ b: 2, a: 1 }));
    expect(stateHash({ a: 1 })).not.toBe(stateHash({ a: 2 }));
    expect(stateHash({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('determinism', () => {
  it('replays to the same hash from the same seed and choices', () => {
    const a = playGame(content, start, 'replay', scriptedChoices(content));
    const b = playGame(content, start, 'replay', scriptedChoices(content));
    expect(stateHash(a.state)).toBe(stateHash(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('gives a different game for a different seed', () => {
    const a = playGame(content, start, 'replay', scriptedChoices(content));
    const b = playGame(content, start, 'other', scriptedChoices(content));
    expect(stateHash(a.state)).not.toBe(stateHash(b.state));
  });

  it('is unchanged by saving and loading between every round', () => {
    const straight = playGame(content, start, 'saves', scriptedChoices(content));
    let state = createGame({ content, start }, 'saves');
    while (!state.finished) {
      state = JSON.parse(JSON.stringify(state)) as GameState;
      state = applyRound(content, state, scriptedChoices(content)(state)).state;
    }
    expect(stateHash(state)).toBe(stateHash(straight.state));
  });

  it('exercises the scripted strategy for real', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e'];
    const games = seeds.map((seed) => playGame(content, start, seed, scriptedChoices(content)));
    const events = games.flatMap((g) => g.events);
    const lines = new Set(events.flatMap((e) => (e.kind === 'ledger' ? [e.line] : [])));
    const expected: LedgerLine[] = [
      'salary', 'dividends', 'interest', 'rent', 'living',
      'debtInterest', 'debtPrincipal', 'incomeTax', 'investmentTax', 'propertyTax',
    ];
    for (const line of expected) expect(lines.has(line)).toBe(true);
    for (const g of games) expect(g.state.round).toBe(20);
  });

  it('stays finite and whole with absurd wealth', () => {
    const rich = { ...fixtureStart(), cash: 1e15 };
    const { state } = playGame(content, rich, 'rich', scriptedChoices(content));
    const worth = netWorth(state.player);
    expect(Number.isFinite(worth)).toBe(true);
    expect(Number.isInteger(worth)).toBe(true);
  });
});
```

`packages/engine/src/properties.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { stateHash } from './hash';
import { findInvariantBreaks } from './invariants';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameState, Order } from './types';

const content = fixtureContent();

const amount = fc.oneof(
  fc.integer({ min: -1_000, max: 50_000_000 }),
  fc.constantFrom(0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 1e300),
);
const assetId = fc.constantFrom('fund_world', 'bond_long', 'stock_growth', 'coin_meme', 'gold', 'nope', '__proto__', 'constructor');
const debtId = fc.constantFrom('debt-1', 'debt-2', 'debt-3', 'debt-4', 'gone');
const propertyId = fc.constantFrom('property-1', 'property-2', 'property-3', 'property-4', 'gone');

const order: fc.Arbitrary<Order> = fc.oneof(
  fc.record({ type: fc.constant('buy' as const), assetId, amount }),
  fc.record({ type: fc.constant('sell' as const), assetId, amount }),
  fc.record({ type: fc.constant('depositIn' as const), amount }),
  fc.record({ type: fc.constant('depositOut' as const), amount }),
  fc.record({ type: fc.constant('pensionIn' as const), amount }),
  fc.record({ type: fc.constant('borrow' as const), amount }),
  fc.record({ type: fc.constant('repay' as const), debtId, amount }),
  fc.record({
    type: fc.constant('buyProperty' as const),
    typeId: fc.constantFrom('studio', 'flat', 'villa', 'castle'),
    downPayment: amount,
    mortgage: fc.constantFrom('fixed' as const, 'variable' as const, 'none' as const),
    rented: fc.boolean(),
  }),
  fc.record({ type: fc.constant('sellProperty' as const), propertyId }),
  fc.record({ type: fc.constant('setRented' as const), propertyId, rented: fc.boolean() }),
);

const game = fc.record({
  seed: fc.string({ maxLength: 12 }),
  cash: fc.integer({ min: 0, max: 100_000_000 }),
  salary: fc.integer({ min: 0, max: 20_000_000 }),
  tier: fc.constantFrom(0 as const, 1 as const, 2 as const, 3 as const),
  rounds: fc.array(fc.array(order, { maxLength: 6 }), { minLength: 20, maxLength: 20 }),
});

function play(input: { seed: string; cash: number; salary: number; tier: 0 | 1 | 2 | 3; rounds: Order[][] }): GameState {
  const start = { ...fixtureStart(), cash: input.cash, salaryAnnual: input.salary, lifestyleTier: input.tier };
  let state = createGame({ content, start }, input.seed);
  for (const orders of input.rounds) {
    state = applyRound(content, state, { orders }).state;
    expect(findInvariantBreaks(content, state)).toEqual([]);
  }
  return state;
}

describe('engine invariants under arbitrary orders', () => {
  it('keeps money whole, non-negative and consistent for any seed and any orders', () => {
    fc.assert(
      fc.property(game, (input) => {
        const state = play(input);
        expect(state.round).toBe(20);
        expect(state.finished).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('replays any game to the same hash', () => {
    fc.assert(
      fc.property(game, (input) => {
        expect(stateHash(play(input))).toBe(stateHash(play(input)));
      }),
      { numRuns: 50 },
    );
  });

  it('leaves Object.prototype untouched', () => {
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
});
```

`packages/engine/src/replay.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateHash } from './hash';
import { finalScore, netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { playGame, scriptedChoices } from './testing/play';

describe('golden replay', () => {
  it('reproduces the recorded final state', () => {
    const content = fixtureContent();
    const { state } = playGame(content, { ...fixtureStart(), cash: 5_000_000 }, 'golden-1', scriptedChoices(content));
    expect({
      hash: stateHash(state),
      netWorth: netWorth(state.player),
      score: finalScore(content, state),
      escapedAtRound: state.player.escapedAtRound,
    }).toMatchSnapshot();
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `pnpm vitest run packages/engine/src/invariants.test.ts packages/engine/src/determinism.test.ts packages/engine/src/properties.test.ts packages/engine/src/replay.test.ts`
Expected: 13 tests pass. Vitest reports `1 snapshot written` and creates `packages/engine/src/__snapshots__/replay.test.ts.snap`.

If a property test fails, fast-check prints the smallest failing input. Fix the engine module that owns the broken invariant, add a plain unit test for that input to the module's own test file, and run again. Do not loosen the invariant.

- [ ] **Step 4: Confirm the golden test now guards behaviour**

Run: `pnpm vitest run packages/engine/src/replay.test.ts`
Expected: 1 test passes with no snapshot written.

In `packages/engine/src/testing/fixture.ts`, change `depositSpreadBp: 100` to `101` and run the same command. The scripted player holds a deposit from round 0, so its interest changes.
Expected: FAIL with a snapshot mismatch.

Restore the value to `100` and run once more.
Expected: PASS.

- [ ] **Step 5: Run everything**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: every test file passes; lint and typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): state hash, determinism and invariant tests, golden replay"
```

---

## What this plan leaves for plans 2 and 3

- Cards, news, career, focus, family, insurance, status items, finance-skill gating and moving city (plan 2). They set `salaryAnnual`, `extraExpensesAnnual`, `extraPassiveAnnual`, `statusPoints`, `lifestyleTier` and `cityId` on the player, which this engine already reads.
- The real v1 data: six cities, 21 assets, tax tables, market parameters (plan 2).
- The terminal game and the balance bots with their acceptance bands (plan 3).
