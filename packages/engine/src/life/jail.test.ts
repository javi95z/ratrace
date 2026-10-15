import { describe, expect, it } from 'vitest';
import { createGame } from '../game';
import { Rng, seedRng } from '../rng';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { CardDef, Content, GameEvent, GameState, LifeStart, RoundTally } from '../types';
import { validateContent } from '../validate';
import { settleEvasion } from '../evasion';
import { drawHand } from './cards';
import { ownPay } from './derive';
import { applyEffects } from './effects';
import { focusTotal } from './orders';
import { ageLife, turnPage } from './roundEnd';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 2 }, careerSkill: 10, financeSkill: 0, focus: 3 };
const game = (content: Content): GameState => createGame({ content, start: { ...fixtureStart(), cash: 100_000_00, life: office } }, 'jail');
const at = (content: Content, state: GameState) => ({ content, world: state.timeline[0], round: state.round });

/** Ends a round as the game does: the life ages, then the page turns. */
function live(content: Content, state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const world = state.timeline[0];
  ageLife(state.player, content, world, world, { focusActions: [] } as unknown as RoundTally, new Rng(seedRng('x', 'life')), events);
  turnPage(state.player, content, events);
  return events;
}

describe('prison', () => {
  it('takes the pay, the focus and some status, for as many rounds as the sentence, and a rung on the way out', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = state.player;
    const status = p.life.bonusStatus;
    expect(ownPay(p, content)).toBeGreaterThan(0);

    applyEffects(p, { jail: { rounds: 2 } }, at(content, state));
    expect(p.life.jailRounds).toBe(2);
    expect(p.life.bonusStatus).toBe(status - content.life.jail.statusLost);
    expect(ownPay(p, content)).toBe(0);
    expect(focusTotal(p)).toBe(0);
    // A second sentence while inside runs to the later end, and costs no more status.
    applyEffects(p, { jail: { rounds: 1 } }, at(content, state));
    expect(p.life.jailRounds).toBe(2);
    expect(p.life.bonusStatus).toBe(status - content.life.jail.statusLost);

    const skill = p.life.careerSkill;
    expect(live(content, state).some((event) => event.kind === 'released')).toBe(false);
    expect(p.life.careerSkill).toBe(skill);
    expect(ownPay(p, content)).toBe(0);

    expect(live(content, state)).toContainEqual({ kind: 'released', rungsLost: 1 });
    expect(p.life.jailRounds).toBe(0);
    expect(p.life.career?.level).toBe(1);
    expect(Object.hasOwn(p.life.flags, 'ex_convict')).toBe(true);
    expect(ownPay(p, content)).toBeGreaterThan(0);
    expect(focusTotal(p)).toBeGreaterThan(0);
  });

  it('deals only the cards of prison inside, and none of them outside', () => {
    const content = fixtureContent();
    const inside: CardDef = { id: 'cell', category: 'luck', weight: 1_000, cooldown: 0, when: { inJail: true }, options: [{}, {}] };
    content.cards = [...content.cards, inside];
    const state = game(content);
    const hand = () => {
      state.player.life.seen = {};
      return drawHand(state, content, new Rng(seedRng('hand', 'cards')));
    };
    expect(hand()).not.toContain('cell');
    state.player.life.jailRounds = 1;
    const dealt = hand();
    expect(dealt.filter((id) => id !== state.timeline[state.round].eventCardId)).toEqual(['cell']);
  });

  it('is never more than three rounds', () => {
    const content = fixtureContent();
    content.cards = [{ id: 'odd', category: 'luck', weight: 1, cooldown: 0, options: [{}, { effects: { jail: { rounds: 4 }, launder: { feePct: 120 } } }] }];
    expect(validateContent(content)).toEqual(
      expect.arrayContaining(['card odd option 1 needs from 1 to 3 rounds of prison', 'card odd option 1 needs a whole percentage from 0 to 100 for the fee of laundering']),
    );
  });
});

describe('laundering', () => {
  it('takes a fee on what could still be claimed, and leaves nothing hidden to claim', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = state.player;
    p.life.evasion.evaded = [{ round: 0, amount: 30_000_00 }, { round: 1, amount: 10_000_00 }];
    const cash = p.cash;
    applyEffects(p, { launder: { feePct: 20 } }, at(content, state));
    expect(p.cash).toBe(cash - 8_000_00);
    expect(p.life.evasion.evaded).toEqual([]);
  });
});

describe('a trial after an inspection', () => {
  it('follows an inspection that finds a great deal hidden, and only that', () => {
    const content = fixtureContent();
    content.evasion.auditMaxPct = 100;
    const charged = (hidden: number) => {
      const state = game(content);
      const p = state.player;
      p.life.evasion.suspicion = 100;
      p.life.evasion.evaded = [{ round: 0, amount: hidden }];
      const events: GameEvent[] = [];
      settleEvasion(content, p, { black: 0, shell: 0, crypto: 0, total: 0 }, 0, 0, new Rng(seedRng('audit', 'evasion')), events);
      return { audited: events.some((event) => event.kind === 'audit'), charged: events.some((event) => event.kind === 'charged') && Object.hasOwn(p.life.flags, 'charged') };
    };
    expect(charged(content.evasion.chargedFromEvaded)).toEqual({ audited: true, charged: true });
    expect(charged(content.evasion.chargedFromEvaded - 1)).toEqual({ audited: true, charged: false });
  });
});
