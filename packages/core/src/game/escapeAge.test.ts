import { content, lives, textFor } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import en from '@ratrace/i18n/messages/en.json';
import { describe, expect, it } from 'vitest';
import { formatFor } from '../lib/format';
import { fixedSessions } from '../session/fixed';
import { runScene, sceneStore } from '../testing/scenes';
import { chapters, epilogue } from './epilogue';
import { momentsOf } from './moments';
import { escapeAge, milestoneAge, milestoneRound } from './present';
import type { Translate } from './present';
import { createGameStore } from './store';

/** The epilogue's words as the pages fill them. */
const tale: Translate = (key, values = {}) => {
  let found: unknown = en.epilogue;
  for (const part of key.split('.')) found = (found as Record<string, unknown>)[part];
  return String(found).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
};

/** The game of a scene, opened on its store and taken through its steps, as either client takes it. */
async function scene(name: string) {
  const game = createGameStore({ sessions: fixedSessions(await sceneStore(name)), content });
  await game.getState().boot();
  await runScene(name, game);
  return game.getState();
}

describe('the age a life left the rat race at', () => {
  // The engineer of the scenes, played by the saver: her fifteenth round (round 14, counted from 0) is the second that covers her life.
  // She lives it at 50 and is 52 once it is played. The rules count her out at 50: `escapedAtRound` is 14, and the badges'
  // `escapedAtAge` (content/badges.ts) is START_AGE + 14 × 2.
  it('is the age of the round the life got out in, wherever it is told: the moment, the life line, the epilogue', async () => {
    const state = await scene('moment-escape');
    const view = state.view!;
    expect(view.round).toBe(15);
    expect(view.player.escapedAtRound).toBe(14);
    expect(escapeAge(content, view.player.escapedAtRound!)).toBe(50);

    const moment = momentsOf(state).find((m) => m.kind === 'escape');
    expect(moment).toMatchObject({ kind: 'escape', round: 14 });
    expect(escapeAge(content, (moment as { round: number }).round)).toBe(50);

    const out = state.story.find((m) => m.kind === 'escaped')!;
    expect(milestoneRound(out)).toBe(14);
    expect(milestoneAge(content, out)).toBe(50);

    const life = lives.find((one) => one.id === 'engineer')!;
    const [, middle] = epilogue({ words: { content, ...textFor('en'), fmt: formatFor('en') }, t: tale, life, view, story: state.story, score: 0, bankruptcies: 0 });
    expect(middle).toContain('At 50 you left the rat race');
    expect(middle).not.toContain('At 52 you left the rat race');
  });

  it('is told before what the same round brought once it was played, which is a round older', () => {
    // A round played: its end brought the top of a career (told at the round that opens, 15) and the way out (won in round 14).
    const story: Milestone[] = [
      { round: 15, kind: 'promoted', careerId: 'tech', level: 4, top: true },
      { round: 15, kind: 'escaped' },
    ];
    expect(chapters(story).map((m) => [m.kind, milestoneAge(content, m)])).toEqual([['escaped', 50], ['promoted', 52]]);
  });
});
