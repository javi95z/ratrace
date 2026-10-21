// @vitest-environment jsdom
import { content, textFor } from '@ratrace/content';
import type { Order } from '@ratrace/engine';
import { quoteItem } from '@ratrace/engine';
import { formatFor } from '@ratrace/core/lib/format';
import type { SavedGame } from '@ratrace/core/session/types';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, router } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { GameProvider, useGame } from '../context';
import { Play } from './Play';
import { ProfileSheet } from './Profile';

// How often Play draws the profile's sheet: the sheet itself, counted each time it is drawn (a stand-in that draws the real one).
const drawn = vi.hoisted(() => ({ sheet: 0 }));
vi.mock('./Profile', async (original) => {
  const real = (await original()) as typeof import('./Profile');
  return {
    ...real,
    ProfileSheet: (props: Parameters<typeof real.ProfileSheet>[0]) => {
      drawn.sheet += 1;
      return real.ProfileSheet(props);
    },
  };
});

afterEach(cleanup);

const fmt = formatFor('en');
const { names } = textFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
/** The stage of the round on screen, by the name it is given. */
const stageIs = (name: string | RegExp) => waitFor(() => expect(screen.getByRole('main').getAttribute('aria-label')).toMatch(name));
/** What a list of choices marks as the one in force (the web's `aria-current`). */
const current = (sheet: HTMLElement) => within(sheet).getAllByRole('listitem').map((li) => li.getAttribute('aria-current'));

/** On a phone the profile is a sheet, opened from the portrait (the web's desk keeps it at the side; the phone has no desk). */
async function openProfile(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'Open your profile' }));
  return sheetTitled('Your life');
}

/** The orders waiting in the basket, as the round store holds them. */
let basket: () => Order[] = () => [];
function Orders() {
  const orders = useGame((s) => s.orders);
  basket = () => orders;
  return null;
}

/** A nurse who bought a watch and joined a gym in her first round. */
async function withThings() {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  while (session.view().phase === 'cards') await session.answerCard(0);
  await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }, { type: 'buyItem', itemId: 'member_gym' }] });
  expect(session.view().player.life.items.map((owned) => owned.itemId)).toEqual(['watch_casio', 'member_gym']);
  return Object.assign(services, { items: session.view().player.life.items });
}

describe('what the player owns, in the profile', () => {
  it('opens on a tap: what it is, what it gives, what it would fetch, and where to sell it', async () => {
    const services = await withThings();
    const [casio, gymPass] = services.items;
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    const profile = await openProfile();

    fireEvent.click(within(profile).getByRole('button', { name: 'Casio F-91W' }));
    const watch = sheetTitled('Casio F-91W');
    expect(within(watch).getByText('WATCHES')).toBeTruthy();
    expect(within(watch).getByText('Status +1')).toBeTruthy();
    expect(within(watch).getByText(/^Would sell for \$\d+ today$/)).toBeTruthy();
    expect(within(watch).getByText('It is sold or cancelled during the finances: here or in the Shop tab.')).toBeTruthy();
    // What it cost is beside what it would fetch, and the gap between the two is spelled out.
    expect(casio.paid).toBe(content.items.find((item) => item.id === 'watch_casio')?.price);
    expect(casio.value).toBeLessThan(casio.paid);
    expect(within(watch).getByText(`It cost you ${fmt.money(casio.paid)}`)).toBeTruthy();
    expect(within(watch).getByText(`Sell it today and you lose ${fmt.money(casio.paid - casio.value)}`)).toBeTruthy();

    // Closing it leaves the profile where it was.
    fireEvent.click(within(watch).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Casio F-91W' })).toBeNull());
    expect(sheetTitled('Your life')).toBeTruthy();

    // A membership has a fee and no resale value.
    fireEvent.click(within(sheetTitled('Your life')).getByRole('button', { name: 'Gym' }));
    const gym = sheetTitled('Gym');
    expect(within(gym).getByText(/a year upkeep|\/yr|upkeep/)).toBeTruthy();
    expect(within(gym).queryByText(/Would sell for/)).toBeNull();
    // What it is good for beyond its status: a gym trains the body.
    expect(within(within(gym).getByLabelText('Good for')).getByText(/^Trains Health: \+\d+ point every round$/)).toBeTruthy();
    // What was paid to join is shown, with no gain or loss: there is nothing to sell.
    expect(within(gym).getByText(`It cost you ${fmt.money(gymPass.paid)}`)).toBeTruthy();
    expect(within(gym).queryByText(/Sell it today/)).toBeNull();
  });

  it('sells a thing or cancels a membership from its own sheet while the finances are open', async () => {
    const services = await withThings();
    const { session } = await services.sessions.resume();
    if (!session) throw new Error('no life to resume');
    while (session.view().phase === 'cards') await session.answerCard(0);
    const [casio] = session.view().player.life.items;
    renderGame(
      <>
        <Play />
        <Orders />
      </>,
      services,
    );
    await stageIs('Your finances');

    let profile = await openProfile();
    fireEvent.click(within(profile).getByRole('button', { name: 'Casio F-91W' }));
    const watch = sheetTitled('Casio F-91W');
    expect(within(watch).getByText('It takes effect when the round is played. Until then you can take it out of the basket.')).toBeTruthy();
    fireEvent.click(within(watch).getByRole('button', { name: `Sell for ${fmt.money(casio.value)}` }));
    // The order is given and the sheet closes: the watch is no longer among her things.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Casio F-91W' })).toBeNull());
    profile = sheetTitled('Your life');
    expect(within(profile).queryByRole('button', { name: 'Casio F-91W' })).toBeNull();
    expect(basket()).toEqual([{ type: 'sellItem', itemId: 'watch_casio' }]);

    fireEvent.click(within(profile).getByRole('button', { name: 'Gym' }));
    fireEvent.click(within(sheetTitled('Gym')).getByRole('button', { name: 'Cancel it' }));
    expect(basket()).toEqual([{ type: 'sellItem', itemId: 'watch_casio' }, { type: 'sellItem', itemId: 'member_gym' }]);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Gym' })).toBeNull());

    // The profile closed, the round is played from the foot of the screen.
    fireEvent.click(within(sheetTitled('Your life')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Your life' })).toBeNull());
    expect(button('2 orders')).toBeTruthy();
    fireEvent.click(button('Play the round'));
    await stageIs('Two years later');
    expect(((await services.store.loadGame()) as SavedGame).state.player.life.items).toEqual([]);
  });

  it('shows a thing that has aged at the status it gives now, beside what it gave new', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'tech_phone' }] });
    const quote = quoteItem(content, session.view(), 'tech_phone');
    // A phone halves in value in a round, and in what it says about its owner.
    expect(quote).toMatchObject({ statusNew: 2, status: 1, ages: true });
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    fireEvent.click(within(await openProfile()).getByRole('button', { name: names.items.tech_phone }));
    const sheet = sheetTitled(names.items.tech_phone);
    expect(within(sheet).getByText('Status +1')).toBeTruthy();
    expect(within(sheet).getByText('Gave +2 new')).toBeTruthy();
    expect(within(sheet).getByText('It has lost status over the years. A new one gives it all again.')).toBeTruthy();
  });

  it('says so when nothing is owned yet', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    expect(within(await openProfile()).getByText('Nothing yet')).toBeTruthy();
  });

  it('says in words what the picture of the family shows: alone, seeing someone, together, married', async () => {
    for (const [flags, partner, words] of [
      [[], false, 'Single'],
      [['dating'], false, 'Seeing someone'],
      [['cohabiting'], true, 'Partner'],
      [['married'], true, 'Married'],
    ] as const) {
      const services = memoryServices();
      const real = await services.sessions.start('nurse');
      const seen = () => {
        const view = structuredClone(real.view());
        view.player.life.partner = partner;
        for (const flag of flags) view.player.life.flags[flag] = 0;
        return view;
      };
      services.sessions.resume = async () => ({
        lost: null,
        session: { gameId: real.gameId, lifeId: real.lifeId, view: seen, history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices) },
      });
      renderGame(<Play />, services);
      await screen.findByRole('heading', { name: 'News' });
      expect(within(await openProfile()).getByText(words), words).toBeTruthy();
      cleanup();
    }
  });

  it('opens how the player lives, where, and what each insurance is for', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    const profile = await openProfile();

    // The nurse lives normally, in a rented room, with no insurance.
    fireEvent.click(within(profile).getByRole('button', { name: /^Lifestyle/ }));
    let sheet = sheetTitled('Lifestyle');
    let choices = within(sheet).getAllByRole('listitem');
    expect(current(sheet)).toEqual([null, 'true', null, null]);
    expect(within(choices[1]).getByText('Normal')).toBeTruthy();
    expect(within(choices[1]).getByText('Yours')).toBeTruthy();
    // Each says what a year of it costs, dearer as it goes up; the top two give status, and the frugal one takes it.
    const costs = choices.map((li) => Number((li.textContent ?? '').match(/\$([\d,]+)\/yr/)?.[1].replace(/,/g, '')));
    expect(costs.every((cost) => cost > 0)).toBe(true);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(within(choices[3]).getByText('Status +8')).toBeTruthy();
    expect(within(choices[0]).getByText('Status −2')).toBeTruthy();
    // And says when the frugal way will cost more: from 26.
    expect(within(choices[0]).getByText('From 26, living frugally costs 4 status.')).toBeTruthy();
    expect(within(choices[1]).queryByText(/^Status/)).toBeNull();
    expect(within(sheet).getByText('It is changed during the finances: here or in the Lifestyle tab.')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Lifestyle' })).toBeNull());

    fireEvent.click(within(sheetTitled('Your life')).getByRole('button', { name: /^Home/ }));
    sheet = sheetTitled('Home');
    choices = within(sheet).getAllByRole('listitem');
    expect(choices).toHaveLength(2);
    expect(choices[0].getAttribute('aria-current')).toBe('true');
    expect(within(sheet).getByText(/^Until you own a home in Madrid, you rent/)).toBeTruthy();
    // A room costs nothing in status at twenty-two, and the sheet says from when it will.
    expect(within(choices[0]).queryByText(/^Status/)).toBeNull();
    expect(within(choices[1]).getByText('Status +3')).toBeTruthy();
    expect(within(sheet).getByText('From 26, a rented room costs 3 status.')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Home' })).toBeNull());

    fireEvent.click(within(sheetTitled('Your life')).getByRole('button', { name: /^Insurance/ }));
    sheet = sheetTitled('Insurance');
    // What each one is for is read from the cards: the bills it pays part of, and the ways out it opens.
    expect(within(sheet).getByText('Pays 90% on "A serious illness"')).toBeTruthy();
    expect(within(sheet).getByText('Pays 90% on "Water damage"')).toBeTruthy();
    expect(within(sheet).getByText('Opens a way out on "A serious illness"')).toBeTruthy();
    expect(within(sheet).queryByText('Insured')).toBeNull();
    expect(within(sheet).getAllByText(/^\$\d+\/yr$/)).toHaveLength(3);
    // What sets the price of health cover, and that every cover renews by itself.
    expect(within(sheet).getByText('Every cover renews by itself each round until you end it.')).toBeTruthy();
  });

  it('is only to be read until the finances open, and there each line is the choice itself', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });

    // During the news there is nothing to press but the way out.
    fireEvent.click(within(await openProfile()).getByRole('button', { name: /^Lifestyle/ }));
    expect(within(sheetTitled('Lifestyle')).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
    cleanup();

    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(
      <>
        <Play />
        <Orders />
      </>,
      services,
    );
    await stageIs('Your finances');

    fireEvent.click(within(await openProfile()).getByRole('button', { name: /^Lifestyle/ }));
    let sheet = sheetTitled('Lifestyle');
    expect(within(sheet).getByText('Tap to choose. It takes effect when the round is played.')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Comfortable/ }));
    // The sheet shows the life as it will be, and the order waits with the others.
    expect(current(sheet)).toEqual([null, null, 'true', null]);
    expect(within(sheet).getByRole('button', { name: /^Comfortable/ }).getAttribute('aria-pressed')).toBe('true');
    expect(basket()).toEqual([{ type: 'setLifestyle', tier: 2 }]);
    // Choosing again what is already so takes the order back.
    fireEvent.click(within(sheet).getByRole('button', { name: /^Normal/ }));
    expect(basket()).toEqual([]);
    expect(current(sheet)).toEqual([null, 'true', null, null]);
    fireEvent.click(within(sheet).getByRole('button', { name: /^Frugal/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Lifestyle' })).toBeNull());

    fireEvent.click(within(sheetTitled('Your life')).getByRole('button', { name: /^Home/ }));
    sheet = sheetTitled('Home');
    fireEvent.click(within(sheet).getByRole('button', { name: /^Rented flat/ }));
    expect(current(sheet)).toEqual([null, 'true']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Home' })).toBeNull());

    fireEvent.click(within(sheetTitled('Your life')).getByRole('button', { name: /^Insurance/ }));
    sheet = sheetTitled('Insurance');
    fireEvent.click(within(sheet).getByRole('button', { name: /^Health/ }));
    expect(within(sheet).getByText('Insured')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Home/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: /^Home/ }));
    expect(within(sheet).getAllByText('Insured')).toHaveLength(1);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Insurance' })).toBeNull());

    expect(basket()).toHaveLength(3);
    expect(basket()[0]).toEqual({ type: 'setLifestyle', tier: 0 });
    fireEvent.click(within(sheetTitled('Your life')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Your life' })).toBeNull());
    fireEvent.click(button('Play the round'));
    await stageIs('Two years later');
    // The screen plays its own copy of the life: what it did is read from what was saved.
    const after = ((await services.store.loadGame()) as SavedGame).state.player;
    expect(after.lifestyleTier).toBe(0);
    expect(after.life.rentTier).toBe(1);
    expect(after.life.insurance).toMatchObject({ health: true, home: false });
  });

  it('shows a rented room as a loss of status once the player is twenty-six, and warns of the next step, at thirty-two', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    for (let round = 0; round < 2; round++) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    fireEvent.click(within(await openProfile()).getByRole('button', { name: /^Home/ }));
    const sheet = sheetTitled('Home');
    expect(within(within(sheet).getAllByRole('listitem')[0]).getByText('Status −3')).toBeTruthy();
    expect(within(sheet).getByText('From 32, a rented room costs 6 status.')).toBeTruthy();
  });

  it('names every insurance held in one word each, so that all of them fit on the line', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: (['health', 'home', 'life'] as const).map((insurance) => ({ type: 'setInsurance' as const, insurance, on: true })) });
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    expect(within(await openProfile()).getByRole('button', { name: /^Insurance/ }).textContent).toContain('Health · Home · Life');
    cleanup();
    renderGame(<Play />, services, 'es');
    await screen.findByRole('heading', { name: 'Noticias' });
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir tu perfil' }));
    expect(within(sheetTitled('Tu vida')).getByRole('button', { name: /^Seguros/ }).textContent).toContain('Salud · Hogar · Vida');
  });

  it('shows the home itself, and no rent, to someone who owns where they live', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' } } });
    await services.sessions.start('heir');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    fireEvent.click(within(await openProfile()).getByRole('button', { name: /^Home/ }));
    const sheet = sheetTitled('Home');
    expect(within(sheet).getByText('You live in a home you own, so you pay no rent.')).toBeTruthy();
    expect(within(sheet).getByText('Apartment in the Marina')).toBeTruthy();
    expect(within(sheet).getByText('Worth today')).toBeTruthy();
    expect(within(sheet).queryAllByRole('listitem')).toEqual([]);
    expect(within(sheet).getByText('It is changed during the finances: here or in the Lifestyle tab.')).toBeTruthy();
  });
});

describe('the way out of a life, at the foot of the profile', () => {
  it('goes home once the profile has closed, and says the life is saved after every step', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    const profile = await openProfile();
    expect(within(profile).getByText('Your life is saved after every step.')).toBeTruthy();
    fireEvent.click(within(profile).getByRole('link', { name: 'Leave to the home screen' }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('heading', { name: 'Your life' })).toBeNull();
  });

  it('says so, in the phone\'s words, when the phone is not saving', async () => {
    const services = memoryServices(undefined, { savingOff: true });
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    const profile = await openProfile();
    expect(within(profile).getByRole('alert').textContent).toBe('This phone is not saving right now. Keep the game open: closing it would lose what you have played.');
    expect(within(profile).queryByText('Your life is saved after every step.')).toBeNull();
  });
});

describe('what is drawn again', () => {
  it('draws nothing of a closed profile for a card picked: never opened, or opened and closed again', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const renders: Renders = { count: 0 };
    let play: { leaveNews(): void; pick(option: number): Promise<void>; afterCard(): void } | null = null;
    let sheet: { open(): void; close(): void } | null = null;
    function Hands() {
      const leaveNews = useGame((s) => s.leaveNews);
      const pick = useGame((s) => s.pick);
      const afterCard = useGame((s) => s.afterCard);
      play = { leaveNews, pick, afterCard };
      return null;
    }
    // The profile's sheet as Play holds it: open or not, by a state of its own that no step of the game changes.
    function Holder() {
      const [open, setOpen] = useState(false);
      sheet = { open: () => setOpen(true), close: () => setOpen(false) };
      return (
        <Counted into={renders}>
          <ProfileSheet open={open} onClose={() => setOpen(false)} />
        </Counted>
      );
    }
    function Playing() {
      return useGame((s) => s.view !== null) ? <Holder /> : null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Playing />
        <Hands />
      </GameProvider>,
    );
    await waitFor(() => expect(sheet).not.toBeNull());
    await settled(() => play!.leaveNews());
    // Never opened: a card picked draws nothing of it.
    let before = renders.count;
    await settled(() => play!.pick(0));
    expect(renders.count).toBe(before);
    await settled(() => play!.afterCard());

    // Open, it draws the life as it stands; a card picked draws it again.
    await settled(() => sheet!.open());
    expect(screen.getByRole('heading', { name: 'Your life' })).toBeTruthy();
    before = renders.count;
    await settled(() => play!.pick(0));
    expect(renders.count).toBeGreaterThan(before);
    await settled(() => play!.afterCard());

    // Closed again (its window gone), a card picked draws nothing of it.
    await settled(() => sheet!.close());
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Your life' })).toBeNull());
    before = renders.count;
    await settled(() => play!.pick(0));
    expect(renders.count).toBe(before);
  });

  it('is not drawn again by Play for a step of the round while it is closed', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    let play: { leaveNews(): void; pick(option: number): Promise<void>; afterCard(): void } | null = null;
    function Hands() {
      const leaveNews = useGame((s) => s.leaveNews);
      const pick = useGame((s) => s.pick);
      const afterCard = useGame((s) => s.afterCard);
      play = { leaveNews, pick, afterCard };
      return null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Play />
        <Hands />
      </GameProvider>,
    );
    await screen.findByRole('heading', { name: 'News' });
    await settled(() => play!.leaveNews());
    await stageIs(/^Card 1 of/);
    const before = drawn.sheet;
    expect(before).toBeGreaterThan(0);
    // A card picked, its result, the next card: Play is drawn again for each, the closed profile's sheet is not.
    await settled(() => play!.pick(0));
    await stageIs('What happened');
    await settled(() => play!.afterCard());
    await stageIs(/^Card 2 of/);
    expect(drawn.sheet).toBe(before);
  });
});
