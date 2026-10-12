import { content, lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import type { Bot } from './bots';
import { compare, playLife, seedsFor } from './simulate';

const idle = (id: string): Bot => ({ id, pick: () => 0, orders: () => [] });
/** Saves nothing and lives lavishly: ends poor. */
const spender: Bot = { id: 'spender', pick: () => 0, orders: () => [{ type: 'setLifestyle', tier: 3 }] };
const nurse = lives.filter((life) => life.id === 'nurse');

describe('the simulator', () => {
  it('plays a life to the end and reports how it went', () => {
    const result = playLife(content, nurse[0], 'sim', idle('idle'));
    expect(result).toMatchObject({ bot: 'idle', life: 'nurse', seed: 'sim' });
    expect(result.state.finished).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.netWorth).toBeGreaterThan(0);
  });

  it('uses the same seeds every time', () => {
    expect(seedsFor(3)).toEqual(['balance-1', 'balance-2', 'balance-3']);
  });

  it('splits the top score between bots that tie, and calls nobody richest', () => {
    const { summaries } = compare(content, nurse, seedsFor(4), [idle('one'), idle('two')]);
    expect(summaries.map((s) => s.topScorePct)).toEqual([50, 50]);
    expect(summaries.map((s) => s.richestPct)).toEqual([0, 0]);
    expect(summaries.map((s) => s.lives)).toEqual([4, 4]);
  });

  it('counts a bot as ruined when it ends with less than half of what the saver had', () => {
    const { summaries } = compare(content, nurse, seedsFor(4), [idle('saver'), spender]);
    const [saver, spent] = summaries;
    expect(saver).toMatchObject({ ruinedPct: 0, richestPct: 100, topScorePct: 100, bankruptPct: 0 });
    expect(spent).toMatchObject({ ruinedPct: 100, richestPct: 0, topScorePct: 0, bankruptPct: 100 });
    expect(spent.medianNetWorth).toBeLessThan(saver.medianNetWorth);
  });
});
