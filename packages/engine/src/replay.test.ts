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
