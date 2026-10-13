import { describe, expect, it } from 'vitest';
import { incomeForRound } from './economy';
import { createGame } from './game';
import { findInvariantBreaks } from './invariants';
import { executeBuyProperty, executeSetRented, ownsHome } from './property';
import { quoteProperty } from './quotes';
import { newTally } from './tally';
import { fixtureContent, fixturePlayer, fixtureStart } from './testing/fixture';
import type { Content, LifeStart, OrderContext } from './types';
import { validateContent, validateStart } from './validate';
import { viewOf } from './view';
import { generateTimeline } from './world';

/** The fixture, with two things nobody can live in: a garage that lets like a home, and a shop that lets for a fifth more. */
const content: Content = {
  ...fixtureContent(),
  propertyTypes: [
    ...fixtureContent().propertyTypes,
    { id: 'garage', pricePct: 20, status: 0, rentalOnly: true },
    { id: 'shop', pricePct: 100, status: 0, rentalOnly: true, rentPct: 120 },
  ],
};

function setup(cash = 100_000_000) {
  const timeline = generateTimeline('rentals', content);
  const p = fixturePlayer({ cash });
  const ctx: OrderContext = { content, world: timeline[0], round: 0, tally: newTally() };
  return { timeline, p, ctx };
}

describe('a property nobody can live in', () => {
  it('is bought only to be let', () => {
    const { p, ctx } = setup();
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'garage', downPayment: 0, mortgage: 'none', rented: false }, ctx)).toBe('not-a-home');
    expect(p.properties).toEqual([]);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'garage', downPayment: 0, mortgage: 'none', rented: true }, ctx)).toBeNull();
    expect(p.properties[0]).toMatchObject({ typeId: 'garage', rented: true, value: 5_000_000 });
    // Owning one does not make the player an owner-occupier.
    expect(ownsHome(p)).toBe(false);
  });

  it('cannot be taken off the market', () => {
    const { p, ctx } = setup();
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'garage', downPayment: 0, mortgage: 'none', rented: true }, ctx);
    const id = p.properties[0].id;
    expect(executeSetRented(p, { type: 'setRented', propertyId: id, rented: false }, ctx)).toBe('not-a-home');
    expect(p.properties[0].rented).toBe(true);
    expect(executeSetRented(p, { type: 'setRented', propertyId: id, rented: true }, ctx)).toBeNull();
  });

  it('leaves a home as free as it was', () => {
    const { p, ctx } = setup();
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'flat', downPayment: 0, mortgage: 'none', rented: false }, ctx)).toBeNull();
    expect(executeSetRented(p, { type: 'setRented', propertyId: p.properties[0].id, rented: true }, ctx)).toBeNull();
    expect(executeSetRented(p, { type: 'setRented', propertyId: p.properties[0].id, rented: false }, ctx)).toBeNull();
  });

  it('asks for the skill of a landlord like any other let', () => {
    const skilled: Content = { ...content, life: { ...content.life, rentOutMinFinanceSkill: 2 } };
    const { p, ctx } = setup();
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'garage', downPayment: 0, mortgage: 'none', rented: true }, { ...ctx, content: skilled })).toBe('needs-finance-skill');
  });
});

describe('rent by kind of property', () => {
  const rentOf = (typeId: string, value: number) => {
    const { p, timeline } = setup();
    p.properties.push({ id: 'property-1', cityId: 'home', typeId, value, basis: value, rented: true, mortgageId: null });
    return incomeForRound(p, content, timeline[0]).rent;
  };

  it('pays the rent of the city where nothing else is said, and a share more or less where it is', () => {
    const flat = rentOf('flat', 25_000_000);
    expect(flat).toBe(2_250_000);
    expect(rentOf('garage', 25_000_000)).toBe(flat);
    expect(rentOf('shop', 25_000_000)).toBe(2_700_000);
  });

  it('quotes the rent a purchase would bring, and whether it can be lived in', () => {
    const start = { ...fixtureStart(), cash: 100_000_000 };
    const view = viewOf(createGame({ content, start }, 'rentals'));
    const flat = quoteProperty(content, view, 'flat');
    const shop = quoteProperty(content, view, 'shop');
    expect(flat.letOnly).toBe(false);
    expect(shop.letOnly).toBe(true);
    // Same price, a fifth more rent: 4.5% a year of 250,000 is 11,250.
    expect(shop.price).toBe(flat.price);
    expect(flat.rentAnnual).toBe(1_125_000);
    expect(shop.rentAnnual).toBe(1_350_000);
  });
});

describe('rules for what nobody can live in', () => {
  const errors = (types: Content['propertyTypes']) => validateContent({ ...content, propertyTypes: types });

  it('accepts the two kinds above', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('gives it no status, since status is for living somewhere', () => {
    expect(errors([{ id: 'garage', pricePct: 20, status: 2, rentalOnly: true }])).toContain('property type garage cannot be lived in, so it gives no status');
  });

  it('wants a rent share that is a whole percentage above nothing', () => {
    expect(errors([{ id: 'shop', pricePct: 100, status: 0, rentPct: 0 }])).toContain('property type shop needs a whole, positive rent percentage');
    expect(errors([{ id: 'shop', pricePct: 100, status: 0, rentPct: 12.5 }])).toContain('property type shop needs a whole, positive rent percentage');
  });

  it('does not let a card hand one over as a home', () => {
    const card = (rented: boolean) => ({
      ...content,
      cards: [
        {
          id: 'offer', category: 'housing' as const, weight: 1, cooldown: 0,
          options: [{}, { effects: { property: { typeId: 'garage', pricePct: 90, downPct: 20, rented } } }],
        },
      ],
    });
    expect(validateContent(card(true))).toEqual([]);
    expect(validateContent(card(false))).toEqual(['card offer option 1 hands over a garage to live in, and nobody can']);
  });

  it('does not let a life start in one', () => {
    const life: LifeStart = { lifeId: 'tester', career: null, careerSkill: 0, financeSkill: 0, focus: 3, properties: [{ typeId: 'garage', rented: false }] };
    expect(validateStart(content, { ...fixtureStart(), life })).toContain('life property 0 is a garage, which nobody can live in');
  });

  it('counts one left empty as a broken game', () => {
    const state = createGame({ content, start: { ...fixtureStart(), cash: 100_000_000 } }, 'rentals');
    state.player.properties.push({ id: 'property-9', cityId: state.player.cityId, typeId: 'garage', value: 1, basis: 1, rented: false, mortgageId: null });
    expect(findInvariantBreaks(content, state)).toContain('property property-9 cannot be lived in and is not let');
  });
});
