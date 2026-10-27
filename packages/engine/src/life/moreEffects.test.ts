import { describe, expect, it } from 'vitest';
import { createGame } from '../game';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { CardDef, Content, GameState, LifeStart } from '../types';
import { validateContent } from '../validate';
import { weightOf } from './cards';
import { conditionHolds } from './conditions';
import { applyEffects } from './effects';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 1 }, careerSkill: 4, financeSkill: 0, focus: 3 };
const game = (content: Content = fixtureContent()): GameState => createGame({ content, start: { ...fixtureStart(), cash: 1_000_000, life: office } }, 'more');
const at = (content: Content, state: GameState, round = state.round) => ({ content, world: state.timeline[0], round });

describe('a lasting change of focus', () => {
  it('adds to the focus of every round, and never leaves less than one', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    applyEffects(p, { focusBase: 1 }, at(content, state));
    expect(p.life.focusBase).toBe(4);
    applyEffects(p, { focusBase: -2 }, at(content, state));
    applyEffects(p, { focusBase: -2 }, at(content, state));
    expect(p.life.focusBase).toBe(1);
  });
});

describe('a change to every business', () => {
  it('moves what is in each by its percent, and never below nothing', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    p.businesses = [
      { id: 'a', typeId: 'stall', capital: 100_000, basis: 100_000, payoutPct: 50, manager: false, tended: false },
      { id: 'b', typeId: 'stall', capital: 50_000, basis: 50_000, payoutPct: 50, manager: false, tended: false },
    ];
    applyEffects(p, { businessesPct: -10 }, at(content, state));
    expect(p.businesses.map((business) => business.capital)).toEqual([90_000, 45_000]);
    applyEffects(p, { businessesPct: -100 }, at(content, state));
    expect(p.businesses.map((business) => business.capital)).toEqual([0, 0]);
    // What was put in is not what it is worth: the basis stays.
    expect(p.businesses.map((business) => business.basis)).toEqual([100_000, 50_000]);
  });
});

describe('the tax office, through a card', () => {
  it('suspects more, between nothing and everything', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    applyEffects(p, { suspicion: 30 }, at(content, state));
    expect(p.life.evasion.suspicion).toBe(30);
    applyEffects(p, { suspicion: 90 }, at(content, state));
    expect(p.life.evasion.suspicion).toBe(100);
    applyEffects(p, { suspicion: -100 }, at(content, state));
    expect(p.life.evasion.suspicion).toBe(0);
  });

  it('takes a share of what it could still claim in an amnesty, and forgets everything else', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    p.life.evasion = { blackPct: 20, shell: true, hideCrypto: false, suspicion: 60, evaded: [{ round: 0, amount: 300_000 }, { round: 1, amount: 200_000 }] };
    applyEffects(p, { amnesty: { pct: 10 } }, at(content, state));
    expect(p.cash).toBe(state.player.cash - 50_000);
    expect(p.life.evasion).toEqual({ blackPct: 0, shell: false, hideCrypto: false, suspicion: 0, evaded: [] });
  });
});

describe('the conditions of the later cards', () => {
  it('tells someone retired from someone without a job, and someone hiding from someone honest', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    expect(conditionHolds({ retired: false }, p, at(content, state))).toBe(true);
    p.life.career = null;
    expect(conditionHolds({ retired: true }, p, at(content, state))).toBe(false);
    p.life.retiredAtRound = 3;
    expect(conditionHolds({ retired: true }, p, at(content, state))).toBe(true);

    expect(conditionHolds({ evading: false }, p, at(content, state))).toBe(true);
    p.life.evasion.evaded = [{ round: 0, amount: 1 }];
    expect(conditionHolds({ evading: true }, p, at(content, state))).toBe(true);
    p.life.evasion.evaded = [];
    p.life.evasion.hideCrypto = true;
    expect(conditionHolds({ evading: true }, p, at(content, state))).toBe(true);
  });

  it('keeps a promise for as many rounds as it binds, and not after', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    const bound = { notRecentFlag: { flag: 'training_bond', rounds: 2 } };
    expect(conditionHolds(bound, p, at(content, state, 5))).toBe(true);
    p.life.flags.training_bond = 5;
    expect([5, 6, 7, 8].map((round) => conditionHolds(bound, p, at(content, state, round)))).toEqual([false, false, true, true]);
  });
});

describe('a swindle', () => {
  it('grows likelier with age and less likely with money sense', () => {
    const content = fixtureContent();
    content.life.riskByAge.scam = [
      { fromRound: 0, pct: 100 },
      { fromRound: 4, pct: 300 },
    ];
    content.life.skills.scamRiskOffPct = 25;
    const card: CardDef = { id: 'swindle', category: 'luck', weight: 8, cooldown: 0, risk: 'scam', options: [{}] };
    const p = game(content).player;
    expect(weightOf(card, p, content, 0)).toBe(8);
    expect(weightOf(card, p, content, 4)).toBe(24);
    p.life.financeSkill = 2;
    expect(weightOf(card, p, content, 4)).toBe(12);
  });
});

describe('the rules of the new effects', () => {
  it('refuses a change that changes nothing, or too much', () => {
    const content = fixtureContent();
    content.cards = [
      {
        id: 'odd',
        category: 'luck',
        weight: 1,
        cooldown: 0,
        options: [{}, { effects: { focusBase: 3, businessesPct: 0, suspicion: 101, amnesty: { pct: 120 } } }, { when: { notRecentFlag: { flag: 'x', rounds: 0 } }, effects: {} }],
      },
    ];
    expect(validateContent(content)).toEqual(
      expect.arrayContaining([
        'card odd option 1 needs a change of focus from -2 to 2 for focusBase',
        'card odd option 1 needs a whole percentage from -100 to 100 for businessesPct',
        'card odd option 1 needs a change of suspicion from -100 to 100',
        'card odd option 1 needs a whole percentage from 0 to 100 for an amnesty',
        'card odd option 2 condition needs a flag and a positive number of rounds for notRecentFlag',
      ]),
    );
  });
});

describe('a thing done a second time', () => {
  it('sets the flag it names only where the first flag was set already, at the round of the second time', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    const decline = { setFlags: ['declined'], onceMore: { declined: 'declined_twice' } };
    applyEffects(p, decline, at(content, state, 3));
    expect(p.life.flags.declined).toBe(3);
    expect(Object.hasOwn(p.life.flags, 'declined_twice')).toBe(false);
    applyEffects(p, decline, at(content, state, 6));
    expect(p.life.flags).toMatchObject({ declined: 6, declined_twice: 6 });
  });
});

describe('what belongs to a place', () => {
  it('is let go of with a move: the flags of the city left behind (`_here`) are cleared, every other flag kept', async () => {
    const { turnPage } = await import('./roundEnd');
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    p.life.flags = { landlord_here: 2, landlord_warm: 2, married: 1 };
    turnPage(p, content, []);
    expect(p.life.flags).toEqual({ landlord_here: 2, landlord_warm: 2, married: 1 });
    p.life.movingTo = content.cities.find((city) => city.id !== p.cityId)!.id;
    turnPage(p, content, []);
    expect(p.life.flags).toEqual({ landlord_warm: 2, married: 1 });
  });
});
