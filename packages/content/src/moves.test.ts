import { applyCard, applyRound, createGame, quoteWork, viewOf } from '@ratrace/engine';
import type { GameState, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { content } from './content';
import { lives } from './lives';
import { textFor } from './text';
import { withPlayer } from '../../engine/src/testing/patch';

const lifeOf = (id: string) => {
  const life = lives.find((one) => one.id === id);
  if (!life) throw new Error(id);
  return life;
};

/** A life at the finances of its first round, put on a rung of its ladder. */
function at(lifeId: string, level: number, seed = 'moves'): GameState {
  let state = createGame({ content, start: lifeOf(lifeId).start }, seed);
  while (state.phase === 'cards') state = applyCard(content, state, 0).state;
  const career = state.player.life.career;
  if (!career) throw new Error('no career');
  const ladder = content.careers.find((one) => one.id === career.id)?.levels ?? [];
  return withPlayer(content, state, {}, { career: { ...career, level }, careerSkill: ladder[level].minSkill });
}

const move = (id: string): Order => ({ type: 'focus', action: 'careerMove', move: id });
const next = (state: GameState): GameState => {
  let s = state;
  while (s.phase === 'cards') s = applyCard(content, s, 0).state;
  return s;
};

describe('the moves of a career', () => {
  it('are told in every language, with a line for each of their outcomes', () => {
    for (const locale of ['en', 'es', 'ru'] as const) {
      const { text } = textFor(locale);
      for (const career of content.careers) {
        for (const each of career.moves ?? []) {
          const told = text.careers[career.id].moves?.[each.id];
          expect(told, `${locale} ${career.id} ${each.id}`).toBeTruthy();
          expect(told?.outcomes, `${locale} ${career.id} ${each.id}`).toHaveLength(each.outcomes.length);
        }
      }
    }
  });

  it('are open only at their rungs: a lawyer bids for partnership one rung below it, and not before', () => {
    const junior = applyRound(content, at('lawyer', 0), { orders: [move('partnerBid')] });
    expect(junior.events).toContainEqual(expect.objectContaining({ kind: 'orderRejected', reason: 'no-move' }));
    expect(quoteWork(content, viewOf(at('lawyer', 2))).moves.map((one) => one.id)).toEqual(['partnerBid']);
    expect(quoteWork(content, viewOf(at('lawyer', 3))).moves.map((one) => one.id)).toEqual(['bigClient']);
  });

  it('are judged as the round ends, and rest before they can be tried again', () => {
    const played = applyRound(content, at('lawyer', 3), { orders: [move('bigClient')] });
    const judged = played.events.find((event) => event.kind === 'careerMove');
    expect(judged).toMatchObject({ kind: 'careerMove', careerId: 'law', move: 'bigClient' });
    const again = applyRound(content, next(played.state), { orders: [move('bigClient')] });
    expect(again.events).toContainEqual(expect.objectContaining({ kind: 'orderRejected', reason: 'move-resting' }));
  });

  it('take as many rounds as they ask: the internal promotion is prepared over two', () => {
    const first = applyRound(content, at('civil_servant', 0), { orders: [move('internalPromotion')] });
    expect(first.events.some((event) => event.kind === 'careerMove')).toBe(false);
    expect(first.state.player.life.moves?.internalPromotion?.progress).toBe(1);
    const second = applyRound(content, next(first.state), { orders: [move('internalPromotion')] });
    expect(second.events.some((event) => event.kind === 'careerMove')).toBe(true);
  });

  it('do what they say when they come off: a partnership is a rung up and a share of the profits', () => {
    // Over many seeds, both outcomes come up; each does what it says.
    let up = 0;
    let down = 0;
    for (let i = 0; i < 40; i++) {
      const before = at('lawyer', 2, `bid-${i}`);
      const after = applyRound(content, before, { orders: [move('partnerBid')] });
      const judged = after.events.find((event) => event.kind === 'careerMove');
      if (judged?.kind !== 'careerMove') throw new Error('not judged');
      if (judged.outcome === 0) {
        up += 1;
        expect(after.state.player.life.career?.level).toBe(3);
        expect(after.state.player.life.recurring.some((entry) => entry.tag === 'move_partnerbid' && entry.kind === 'passive')).toBe(true);
      } else {
        down += 1;
        expect(after.state.player.life.career?.level).toBe(2);
      }
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
  });

  it('change nothing for a life that makes none: the same seed draws the same game', () => {
    const plain = applyRound(content, at('lawyer', 2), { orders: [] });
    const again = applyRound(content, at('lawyer', 2), { orders: [] });
    expect(again.state).toEqual(plain.state);
    expect(plain.state.player.life.moves).toBeUndefined();
  });
});
