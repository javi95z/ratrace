import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { stateHash } from './hash';
import { finalScore, netWorth } from './selectors';
import { fixtureContent } from './testing/fixture';
import type { Order, StartConfig } from './types';

interface GoldenLog {
  seed: string;
  start: StartConfig;
  rounds: Order[][];
}

const path = fileURLToPath(new URL('./testing/golden-replay.json', import.meta.url));
const log = JSON.parse(readFileSync(path, 'utf8')) as GoldenLog;

describe('golden replay', () => {
  it('reproduces the recorded final state from the stored choice log', () => {
    const content = fixtureContent();
    let state = createGame({ content, start: log.start }, log.seed);
    let executed = 0;
    let rejected = 0;
    const ledgerLines = new Set<string>();
    for (const orders of log.rounds) {
      const result = applyRound(content, state, { orders });
      const refused = result.events.filter((e) => e.kind === 'orderRejected').length;
      rejected += refused;
      executed += orders.length - refused;
      for (const e of result.events) if (e.kind === 'ledger') ledgerLines.add(e.line);
      state = result.state;
    }
    expect(state.finished).toBe(true);
    expect({
      hash: stateHash(state),
      netWorth: netWorth(state.player),
      score: finalScore(content, state),
      escapedAtRound: state.player.escapedAtRound,
      executed,
      rejected,
      ledgerLines: [...ledgerLines].sort(),
    }).toMatchSnapshot();
  });
});
