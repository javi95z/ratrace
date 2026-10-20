import { describe, expect, it } from 'vitest';
import { careerOf } from '../lookup';
import { Rng, seedRng } from '../rng';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { createGame } from '../game';
import type { Content, FocusAction, GameEvent, GameState, LifeStart, RoundTally } from '../types';
import { validateContent } from '../validate';
import { FLAG_IN_ROOM } from './flags';
import { focusLock, focusTotal } from './orders';
import { ageLife, careerStudyOf, jobHuntChance, overtimeToll, turnPage } from './roundEnd';
import { perksOf } from './derive';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

function limited(): Content {
  const content = fixtureContent();
  content.life.focusLimits = {
    overtimeTiredFrom: 2,
    overtimeHealthPoints: 1,
    overtimeBurnoutFrom: 3,
    burnoutChancePct: 100,
    burnoutHealthPoints: 2,
    burnoutFocus: 1,
    huntRestRounds: 1,
    huntMissPct: 15,
    huntFloorPct: 5,
    studyPerRung: 3,
  };
  return content;
}

const game = (content: Content): GameState => createGame({ content, start: { ...fixtureStart(), cash: 100_000_00, life: office } }, 'limits');
const tally = (...focusActions: FocusAction[]) => ({ focusActions }) as unknown as RoundTally;

/** Ends a round of living with these uses of focus, as the game does: the life ages, then the page turns. */
function live(content: Content, state: GameState, actions: FocusAction[], seed = 'x'): GameEvent[] {
  const events: GameEvent[] = [];
  const world = state.timeline[0];
  ageLife(state.player, content, world, world, tally(...actions), new Rng(seedRng(seed, 'life')), events);
  turnPage(state.player, content, events);
  return events;
}

describe('overtime round after round', () => {
  it('is free once, costs health the second time running, and may end in burnout from the third', () => {
    const content = limited();
    const state = game(content);
    const p = state.player;
    p.life.skills.health = 6;
    expect(overtimeToll(p, content)).toEqual({ streak: 1, healthPoints: 0, burnoutChancePct: 0 });

    expect(live(content, state, ['overtime']).some((event) => event.kind === 'overworked')).toBe(false);
    expect(p.life.overtimeStreak).toBe(1);

    const tired = live(content, state, ['overtime']);
    expect(tired).toContainEqual({ kind: 'overworked', streak: 2, healthLost: 1, burnout: false, focusLost: 0 });
    expect(p.life.skills.health).toBe(5);

    // With a certain burnout: a point for the overtime and two for the burnout, focus lost next round, and the count starts again.
    const before = focusTotal(p);
    const burnt = live(content, state, ['overtime']);
    expect(burnt).toContainEqual({ kind: 'overworked', streak: 3, healthLost: 3, burnout: true, focusLost: 1 });
    expect(p.life.skills.health).toBe(2);
    expect(p.life.overtimeStreak).toBe(0);
    expect(focusTotal(p)).toBe(before - 1);

    // The round after, focus is back, and a round without overtime breaks a streak.
    live(content, state, []);
    expect(focusTotal(p)).toBe(before);
    expect(p.life.overtimeStreak).toBe(0);
  });

  it('never takes more health than there is, nor leaves less than a point of focus', () => {
    const content = limited();
    const state = game(content);
    const p = state.player;
    p.life.skills.health = 1;
    p.life.focusBase = 1;
    p.life.overtimeStreak = 2;
    expect(live(content, state, ['overtime'])).toContainEqual({ kind: 'overworked', streak: 3, healthLost: 1, burnout: true, focusLost: 1 });
    expect(p.life.skills.health).toBe(0);
    expect(focusTotal(p)).toBe(1);
  });
});

describe('a job hunt', () => {
  it('rests a round after it works, and grows less likely with each failure in a row, down to a floor', () => {
    const content = limited();
    content.life.jobHuntChancePct = 100;
    const state = game(content);
    const p = state.player;
    expect(focusLock(p, 'jobHunt', content)).toBeNull();
    expect(live(content, state, ['jobHunt'])).toContainEqual({ kind: 'jobHunt', success: true });
    expect(focusLock(p, 'jobHunt', content)).toBe('hunt-resting');
    live(content, state, []);
    expect(focusLock(p, 'jobHunt', content)).toBeNull();

    content.life.jobHuntChancePct = 50;
    const perks = perksOf(p, content);
    expect(jobHuntChance(content, perks, p)).toBe(50);
    p.life.huntMisses = 2;
    expect(jobHuntChance(content, perks, p)).toBe(20);
    p.life.huntMisses = 10;
    expect(jobHuntChance(content, perks, p)).toBe(5);
    // A round without a search starts afresh.
    live(content, state, []);
    expect(p.life.huntMisses).toBe(0);
  });

  it('counts the failures in a row', () => {
    const content = limited();
    content.life.jobHuntChancePct = 0;
    const state = game(content);
    live(content, state, ['jobHunt']);
    live(content, state, ['jobHunt']);
    expect(state.player.life.huntMisses).toBe(2);
    expect(focusLock(state.player, 'jobHunt', content)).toBeNull();
  });
});

describe('study for the career', () => {
  it('adds no more than its share at a rung, which starts again with a promotion', () => {
    const content = limited();
    content.life.studySkill = 2;
    // A rung far enough away that study runs out before the promotion.
    careerOf(content, 'office').levels[1].minSkill = 20;
    careerOf(content, 'office').levels[2].minSkill = 30;
    const state = game(content);
    const p = state.player;
    const perks = perksOf(p, content);
    expect(careerStudyOf(p, content, perks)).toBe(2);
    live(content, state, ['studyCareer']);
    expect(p.life.rungStudy).toBe(2);
    expect(careerStudyOf(p, content, perks)).toBe(1);
    const skill = p.life.careerSkill;
    live(content, state, ['studyCareer']);
    expect(p.life.careerSkill).toBe(skill + content.life.workSkill + 1);
    expect(focusLock(p, 'studyCareer', content)).toBe('studied-enough');

    // Promoted, the share is whole again.
    p.life.careerSkill = careerOf(content, 'office').levels[1].minSkill;
    live(content, state, []);
    expect(p.life.career?.level).toBeGreaterThan(0);
    expect(p.life.rungStudy).toBe(0);
    expect(focusLock(p, 'studyCareer', content)).toBeNull();
  });

  it('is closed at the top of a career', () => {
    const content = limited();
    const state = game(content);
    const p = state.player;
    p.life.career = { id: 'office', level: careerOf(content, 'office').levels.length - 1 };
    expect(focusLock(p, 'studyCareer', content)).toBe('career-top');
  });
});

describe('a skill at its top', () => {
  it('is studied no more', () => {
    const content = limited();
    const p = game(content).player;
    expect(focusLock(p, 'studyNegotiation', content)).toBeNull();
    p.life.skills.negotiation = content.life.skills.levelPoints[2];
    expect(focusLock(p, 'studyNegotiation', content)).toBe('skill-maxed');
    p.life.financeSkill = 3;
    expect(focusLock(p, 'studyFinance', content)).toBe('skill-maxed');
  });
});

describe('a tease', () => {
  it('is never two rounds running', () => {
    const content = limited();
    const state = game(content);
    const p = state.player;
    p.life.flags[FLAG_IN_ROOM] = 0;
    expect(focusLock(p, 'tease', content)).toBeNull();
    live(content, state, ['tease']);
    expect(focusLock(p, 'tease', content)).toBe('tease-resting');
    live(content, state, []);
    expect(focusLock(p, 'tease', content)).toBeNull();
  });
});

describe('a contract that binds the player to their employer', () => {
  it('closes the job hunt for the round it is signed and the next, then opens it again', () => {
    const content = limited();
    const state = game(content);
    const p = state.player;
    p.life.bondRounds = 2;
    expect(focusLock(p, 'jobHunt', content)).toBe('bonded');
    live(content, state, []);
    expect(focusLock(p, 'jobHunt', content)).toBe('bonded');
    live(content, state, []);
    expect(focusLock(p, 'jobHunt', content)).toBeNull();
  });
});

describe('time with the family, and a rest', () => {
  it('needs a family for the time with it, and nothing for a rest', () => {
    const content = limited();
    const p = game(content).player;
    expect(focusLock(p, 'familyTime', content)).toBe('no-family');
    p.life.children = [0];
    expect(focusLock(p, 'familyTime', content)).toBeNull();
    p.life.career = null;
    expect(focusLock(p, 'unwind', content)).toBeNull();
    expect(focusLock(p, 'familyTime', content)).toBeNull();
  });

  it('takes the toll off a round of overtime, starts its streak again, and gives health back', () => {
    const content = limited();
    const state = game(content);
    const p = state.player;
    p.life.skills.health = 4;
    live(content, state, ['overtime']);
    live(content, state, ['overtime']);
    expect(p.life.skills.health).toBe(3);
    // The third round running would burn out for certain; rested, it costs nothing and gives a point back.
    expect(live(content, state, ['overtime', 'unwind']).some((event) => event.kind === 'overworked')).toBe(false);
    expect(p.life.overtimeStreak).toBe(0);
    expect(p.life.skills.health).toBe(3 + content.life.restHealthPoints);
  });
});

describe('the rules of the limits', () => {
  it('refuses limits out of range or burnout before tiredness', () => {
    const content = limited();
    content.life.focusLimits = { ...content.life.focusLimits, burnoutChancePct: 101, overtimeBurnoutFrom: 1 };
    expect(validateContent(content)).toEqual(
      expect.arrayContaining(['life.focusLimits.burnoutChancePct must be a whole number from 0 to 100', 'life.focusLimits.overtimeBurnoutFrom must not come before overtimeTiredFrom']),
    );
  });
});
