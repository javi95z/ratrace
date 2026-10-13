import { describe, expect, it } from 'vitest';
import { applyCard, applyRound, createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { quoteMove, quoteWork } from '../quotes';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { CardDef, Content, GameEvent, GameState, LifeStart } from '../types';
import { validateContent } from '../validate';
import { viewOf } from '../view';
import { deriveSalary, ownPay } from './derive';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

/** The fixture with a price on moving: a rung, a share for the family, and a round for a partner to find work. */
function contentWith(change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  content.life.moveRungsLost = 1;
  content.life.movePartnerPct = 50;
  content.life.moveChildPct = 25;
  content.life.partnerSettlingRounds = 1;
  change(content);
  return content;
}

const game = (content: Content, life: Partial<LifeStart> = {}): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash: 50_000_000, life: { ...office, ...life } } }, 'moving');
const move = { orders: [{ type: 'moveCity' as const, cityId: 'haven' }] };
const moved = (events: GameEvent[]) => events.find((e): e is Extract<GameEvent, { kind: 'moved' }> => e.kind === 'moved');

describe('moving of one\'s own accord', () => {
  it('lands a rung down, and gives the rung back with the next promotion', () => {
    const content = contentWith();
    // A manager with the experience of one: skill 10 holds the top rung.
    const senior = game(content, { career: { id: 'office', level: 2 }, careerSkill: 10 });
    const landed = applyRound(content, senior, move);
    expect(moved(landed.events)).toEqual({ kind: 'moved', cityId: 'haven', rungsLost: 1, partnerIdle: false });
    expect(landed.state.player.cityId).toBe('haven');
    expect(landed.state.player.life.career).toEqual({ id: 'office', level: 1 });
    expect(findInvariantBreaks(content, landed.state)).toEqual([]);
    // One round at the lower pay, and the experience speaks for itself.
    const after = applyRound(content, landed.state, { orders: [] });
    expect(after.events).toContainEqual({ kind: 'promoted', careerId: 'office', level: 2 });
    expect(after.state.player.life.career).toEqual({ id: 'office', level: 2 });
  });

  it('costs no rung to someone on the first one, nor to someone without a career', () => {
    const content = contentWith();
    const junior = applyRound(content, game(content), move);
    expect(moved(junior.events)).toMatchObject({ rungsLost: 0 });
    expect(junior.state.player.life.career?.level).toBe(0);
    const jobless = applyRound(content, withPlayer(content, game(content), {}, { career: null }), move);
    expect(moved(jobless.events)).toMatchObject({ rungsLost: 0 });
  });

  it('costs more with a partner and with each child, exactly as quoted', () => {
    const content = contentWith();
    const single = game(content);
    const alone = quoteMove(content, viewOf(single), 'haven').cost;
    const couple = withPlayer(content, single, {}, { partner: true, partnerSalaryPct: 50 });
    const family = withPlayer(content, single, {}, { partner: true, partnerSalaryPct: 50, children: [5, 5] });
    expect(quoteMove(content, viewOf(couple), 'haven').cost).toBe(Math.floor((alone * 150) / 100));
    expect(quoteMove(content, viewOf(family), 'haven').cost).toBe(Math.floor((alone * 200) / 100));
    const paid = applyRound(content, family, move).events.find((e) => e.kind === 'ledger' && e.line === 'moving');
    expect(paid && paid.kind === 'ledger' ? -paid.amount : null).toBe(quoteMove(content, viewOf(family), 'haven').cost);
  });

  it('leaves a partner without pay for the round after, and with it again the round after that', () => {
    const content = contentWith();
    const couple = withPlayer(content, game(content), {}, { partner: true, partnerSalaryPct: 50 });
    const theirs = (state: GameState) => state.player.salaryAnnual - ownPay(state.player, content);
    expect(theirs(couple)).toBeGreaterThan(0);
    const landed = applyRound(content, couple, move);
    expect(moved(landed.events)).toMatchObject({ partnerIdle: true });
    expect(landed.state.player.life.partnerSettling).toBe(1);
    expect(theirs(landed.state)).toBe(0);
    expect(landed.state.player.salaryAnnual).toBe(deriveSalary(landed.state.player, content));
    const next = applyRound(content, landed.state, { orders: [] }).state;
    expect(next.player.life.partnerSettling).toBe(0);
    expect(theirs(next)).toBeGreaterThan(0);
    expect(findInvariantBreaks(content, next)).toEqual([]);
    // Someone alone has nobody to wait for.
    expect(moved(applyRound(content, game(content), move).events)).toMatchObject({ partnerIdle: false });
  });

  it('costs none of that when a card offers the move: a transfer comes with a place to go to', () => {
    const transfer: CardDef = { id: 'transfer', category: 'career', weight: 10, cooldown: 0, options: [{}, { effects: { moveCity: 'haven' } }] };
    const content = contentWith((c) => {
      c.cards = [transfer];
    });
    const senior = withPlayer(content, game(content, { career: { id: 'office', level: 2 }, careerSkill: 10 }), {}, { partner: true, partnerSalaryPct: 50 });
    expect(senior.hand).toEqual(['transfer']);
    const taken = applyCard(content, senior, 1).state;
    expect(taken.player.life).toMatchObject({ movingTo: 'haven', movingTransfer: true });
    const landed = applyRound(content, taken, { orders: [] });
    expect(moved(landed.events)).toEqual({ kind: 'moved', cityId: 'haven', rungsLost: 0, partnerIdle: false });
    expect(landed.state.player.life.career?.level).toBe(2);
    expect(landed.state.player.life).toMatchObject({ partnerSettling: 0, movingTransfer: false });
  });
});

describe('a city that pays a trade more', () => {
  const content = contentWith((c) => {
    c.cities = c.cities.map((city) => (city.id === 'haven' ? { ...city, careerPayPct: { office: 125 } } : city));
  });

  it('pays the career its share more there, and nobody else', () => {
    const here = game(content);
    const there = withPlayer(content, here, { cityId: 'haven' });
    const median = (state: GameState) => content.cities.find((city) => city.id === state.player.cityId)?.medianSalaryAnnual ?? 0;
    expect(ownPay(here.player, content)).toBe(Math.floor((median(here) * 80) / 100));
    expect(ownPay(there.player, content)).toBe(Math.floor((Math.floor((median(there) * 80) / 100) * 125) / 100));
    expect(there.player.salaryAnnual).toBe(deriveSalary(there.player, content));
    // The whole ladder is paid by the same measure.
    expect(quoteWork(content, viewOf(there)).ladder[2].payAnnual).toBeGreaterThan(quoteWork(content, viewOf(here)).ladder[2].payAnnual);
    // Without a career there is no trade to pay more for.
    const jobless = withPlayer(content, there, {}, { career: null });
    expect(ownPay(jobless.player, content)).toBe(jobless.player.life.baseSalaryAnnual);
  });

  it('refuses a career that does not exist and a share that is not a whole, positive one', () => {
    const bad = (pay: Record<string, number>) => validateContent(contentWith((c) => {
      c.cities = c.cities.map((city) => (city.id === 'haven' ? { ...city, careerPayPct: pay } : city));
    }));
    expect(bad({ office: 125 })).toEqual([]);
    expect(bad({ piracy: 125 })).toContain('city haven pays for an unknown career: piracy');
    expect(bad({ office: 0 })).toContain('city haven needs a whole, positive pay percentage for office');
    expect(bad({ office: 12.5 })).toContain('city haven needs a whole, positive pay percentage for office');
  });
});

describe('the year here beside the year there', () => {
  const content = contentWith((c) => {
    c.cities = c.cities.map((city) => (city.id === 'haven' ? { ...city, careerPayPct: { office: 125 } } : city));
  });

  it('shows the year the player has now, figure for figure', () => {
    const state = withPlayer(content, game(content, { career: { id: 'office', level: 2 }, careerSkill: 10 }), {}, { partner: true, partnerSalaryPct: 50 });
    const { here } = quoteMove(content, viewOf(state), 'haven');
    expect(here.level).toBe(2);
    expect(here.payAnnual).toBe(quoteWork(content, viewOf(state)).payAnnual);
    expect(here.payAnnual + here.partnerAnnual).toBe(state.player.salaryAnnual);
    expect(here.leftAnnual).toBe(here.payAnnual + here.partnerAnnual - here.taxAnnual - here.costAnnual);
    expect(here).toMatchObject({ careerPayPct: 100, prestige: content.cities[0].prestige });
  });

  it('shows the year there as the move would then leave the player', () => {
    const state = withPlayer(content, game(content, { career: { id: 'office', level: 2 }, careerSkill: 10 }), {}, { partner: true, partnerSalaryPct: 50 });
    const quote = quoteMove(content, viewOf(state), 'haven');
    expect(quote).toMatchObject({ rungsLost: 1, partnerIdleRounds: 1 });
    const landed = applyRound(content, state, move).state;
    // Prices have moved by the time the player lands, so the comparison is made in the rules, not in the dollars.
    expect(quote.there.level).toBe(landed.player.life.career?.level);
    expect(quote.there.partnerAnnual).toBe(0);
    expect(quote.there.careerPayPct).toBe(125);
    expect(quote.there.prestige).toBe(content.cities.find((city) => city.id === 'haven')?.prestige);
    expect(quote.there.leftAnnual).toBe(quote.there.payAnnual - quote.there.taxAnnual - quote.there.costAnnual);
    // The quote changes nothing.
    expect(state.player.cityId).toBe('home');
    expect(state.player.life.career?.level).toBe(2);
  });

  it('counts what the move would end: a membership that lapses is no longer paid for there', () => {
    const local = contentWith((c) => {
      c.items = c.items.map((item) => (item.id === 'club' ? { ...item, cities: ['home'] } : item));
    });
    const member = withPlayer(local, game(local), {}, { items: [{ itemId: 'club', value: 0, roundsLeft: null, paid: 0 }], collection: ['club'] });
    const plain = quoteMove(local, viewOf(game(local)), 'haven');
    const quote = quoteMove(local, viewOf(member), 'haven');
    expect(quote.lapses).toEqual(['club']);
    expect(quote.there.costAnnual).toBe(plain.there.costAnnual);
    expect(quote.here.costAnnual).toBeGreaterThan(plain.here.costAnnual);
  });
});
