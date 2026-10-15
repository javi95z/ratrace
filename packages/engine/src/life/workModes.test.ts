import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from '../game';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { Content, GameState, LifeStart } from '../types';
import { validateContent } from '../validate';
import { ownPay, statusParts, workModeOf } from './derive';
import { focusLock, focusTotal, raiseChance } from './orders';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 2 }, careerSkill: 10, financeSkill: 0, focus: 3 };

/** The fixture, with its one career open to work from home or not. */
function content(remote: boolean): Content {
  const c = fixtureContent();
  c.careers = c.careers.map((career) => ({ ...career, remote }));
  return c;
}
const game = (c: Content): GameState => createGame({ content: c, start: { ...fixtureStart(), cash: 50_000_00, life: office } }, 'work');

describe('ways of working', () => {
  it('from home: a point of focus more at once, the same pay, and less standing for the job', () => {
    const c = content(true);
    const state = game(c);
    const pay = ownPay(state.player, c);
    const job = statusParts(state.player, c, 0).job;
    const focus = focusTotal(state.player);
    const { player, rejected } = previewRound(c, state, { orders: [{ type: 'setWorkMode', mode: 'remote' }] });
    expect(rejected).toEqual([]);
    expect(workModeOf(player, c)).toBe('remote');
    expect(focusTotal(player)).toBe(focus + 1);
    expect(ownPay(player, c)).toBe(pay);
    expect(statusParts(player, c, 0).job).toBe(Math.floor(job / 2));
  });

  it('from home only where the job allows it', () => {
    const c = content(false);
    const { rejected } = previewRound(c, game(c), { orders: [{ type: 'setWorkMode', mode: 'remote' }] });
    expect(rejected.map((r) => r.reason)).toEqual(['no-remote']);
  });

  it('half the day: two points of focus, less pay, and the trade learnt only by study', () => {
    const c = content(false);
    const state = game(c);
    const pay = ownPay(state.player, c);
    const skill = state.player.life.careerSkill;
    const { state: after } = applyRound(c, state, { orders: [{ type: 'setWorkMode', mode: 'partTime' }] });
    expect(ownPay(after.player, c)).toBe(Math.floor((pay * 60) / 100));
    expect(after.player.life.careerSkill).toBe(skill);
    // It lasts: the next round starts with the focus of half a day.
    expect(focusTotal(after.player)).toBe(3 + 2);
    // And the way back is an order like any other.
    const { state: back } = applyRound(c, after, { orders: [{ type: 'setWorkMode', mode: 'office' }] });
    expect(back.player.life.careerSkill).toBe(skill + c.life.workSkill);
    expect(focusTotal(back.player)).toBe(3);
  });

  it('ends with the job: out of work, it is the workplace again', () => {
    const c = content(true);
    const { state } = applyRound(c, game(c), { orders: [{ type: 'setWorkMode', mode: 'remote' }] });
    state.player.life.career = null;
    expect(workModeOf(state.player, c)).toBe('office');
    expect(focusLock(state.player, 'askRaise', c)).toBe('no-job');
  });

  it('checks its rules', () => {
    const c = fixtureContent();
    c.life.workModes.partTime.payPct = 120;
    c.life.raise.restRounds = 0;
    expect(validateContent(c)).toEqual(expect.arrayContaining(['life.workModes.partTime.payPct must be a whole number from 0 to 100', 'life.raise.restRounds must be a whole number from 1 up']));
  });
});

describe('asking for a raise', () => {
  it('raises the pay for good when the boss says yes, and waits a while either way', () => {
    const c = content(false);
    c.life.raise = { chancePct: 100, perNegotiationPct: 0, pct: 5, restRounds: 2 };
    const state = game(c);
    const mod = state.player.life.salaryModPct;
    const { state: after, events } = applyRound(c, state, { orders: [{ type: 'focus', action: 'askRaise' }] });
    expect(events).toContainEqual({ kind: 'raise', success: true, pct: 5 });
    expect(after.player.life.salaryModPct).toBe(mod + 5);
    expect(focusLock(after.player, 'askRaise', c)).toBe('raise-resting');
  });

  it('is said no to, and still waits', () => {
    const c = content(false);
    c.life.raise = { chancePct: 0, perNegotiationPct: 0, pct: 5, restRounds: 1 };
    const state = game(c);
    const mod = state.player.life.salaryModPct;
    const { state: after, events } = applyRound(c, state, { orders: [{ type: 'focus', action: 'askRaise' }] });
    expect(events).toContainEqual({ kind: 'raise', success: false, pct: 0 });
    expect(after.player.life.salaryModPct).toBe(mod);
    expect(focusLock(after.player, 'askRaise', c)).toBe('raise-resting');
  });

  it('is likelier for someone who negotiates well', () => {
    const c = content(false);
    const p = game(c).player;
    const plain = raiseChance(p, c);
    p.life.skills.negotiation = 999;
    expect(raiseChance(p, c)).toBeGreaterThan(plain);
  });
});
