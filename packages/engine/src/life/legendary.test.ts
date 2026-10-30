import { describe, expect, it } from 'vitest';
import { applyCard, applyRound, createGame } from '../game';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { validateContent } from '../validate';
import type { CardDef, Content, LifeStart, StartConfig } from '../types';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };
const start: StartConfig = { ...fixtureStart(), cash: 1_000_000, life: office };

const card = (id: string, over: Partial<CardDef> = {}): CardDef => ({ id, category: 'luck', weight: 10, cooldown: 0, options: [{}, { effects: { cash: 100_000 } }], ...over });
const five = ['a', 'b', 'c', 'd', 'e'].map((id) => card(id));
const legends = ['l1', 'l2', 'l3'].map((id) => card(id, { legendary: true, once: true, weight: 1 }));
const isLegend = (id: string) => legends.some((legend) => legend.id === id);

function contentWith(cards: CardDef[], change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  content.cards = cards;
  change(content);
  return content;
}
const withLegends = (bp: number | undefined, cards: CardDef[] = [...five, ...legends]) =>
  contentWith(cards, (c) => {
    if (bp === undefined) delete c.life.legendaryBp;
    else c.life.legendaryBp = bp;
  });

/** Plays a life answering every card with its first option and ordering nothing: the hands dealt, round by round. */
function handsOf(content: Content, seed: string): string[][] {
  let state = createGame({ content, start }, seed);
  const hands: string[][] = [];
  while (!state.finished) {
    hands.push([...state.hand]);
    while (state.phase === 'cards') state = applyCard(content, state, 0).state;
    state = applyRound(content, state, { orders: [] }).state;
  }
  return hands;
}

describe('legendary cards', () => {
  it('are never dealt by weight, however heavy, where the rules give them no chance', () => {
    const heavy = withLegends(0, [...five, card('l1', { legendary: true, weight: 1_000 })]);
    for (const seed of ['n1', 'n2', 'n3']) expect(handsOf(heavy, seed).flat()).not.toContain('l1');
  });

  it('open a round as its first personal card, and come at most once in a life whatever the chance', () => {
    const always = withLegends(10_000);
    for (const seed of ['a1', 'a2', 'a3', 'a4']) {
      const hands = handsOf(always, seed);
      // Certain from the first round: the first card of the first hand, the hand no longer for it, and never another in the life.
      expect(isLegend(hands[0][0])).toBe(true);
      expect(hands[0]).toHaveLength(always.life.cardsPerRound);
      expect(hands.flat().filter(isLegend)).toHaveLength(1);
    }
  });

  it('come in about as many lives as their chance says, seeded', () => {
    // 100 bp a round: 1 - 0.99^rounds of lives, about 18% over twenty rounds.
    const content = withLegends(100);
    const lives = 300;
    let met = 0;
    for (let i = 0; i < lives; i++) if (handsOf(content, `rare-${i}`).flat().some(isLegend)) met += 1;
    const expected = 1 - 0.99 ** content.rounds;
    expect(met / lives).toBeGreaterThan(expected * 0.6);
    expect(met / lives).toBeLessThan(expected * 1.4);
  });

  it('roll dice that draw nothing from the player\'s own stream: until one is dealt, every hand is the one dealt without them', () => {
    // Open only from round 6: the rounds before deal what a life with no chance of one deals.
    const late = legends.map((legend) => ({ ...legend, when: { minRound: 6 } }));
    for (const seed of ['s1', 's2', 's3']) {
      const plain = handsOf(withLegends(0, [...five, ...late]), seed);
      const legendary = handsOf(withLegends(10_000, [...five, ...late]), seed);
      expect(legendary.slice(0, 6)).toEqual(plain.slice(0, 6));
      expect(isLegend(legendary[6][0])).toBe(true);
    }
  });

  it('are never dealt by content without the rule, as older content is', () => {
    expect(handsOf(withLegends(undefined), 'old').flat().some(isLegend)).toBe(false);
  });

  it('are checked: only a personal card is legendary, and the chance is a share of 10,000', () => {
    expect(validateContent(withLegends(10_000))).toEqual([]);
    expect(validateContent(withLegends(10_001)).join()).toContain('life.legendaryBp');
    const world = withLegends(10, [...five, { ...card('w', { legendary: true }), category: 'world', trigger: { regimes: ['boom'] } } as CardDef]);
    expect(validateContent(world).join()).toContain('card w may only be legendary');
  });
});
