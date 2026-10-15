// @vitest-environment jsdom
import { content, textFor } from '@ratrace/content';
import { quoteItem } from '@ratrace/engine';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatFor } from '@/lib/format';
import type { SavedGame } from '@/session/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

afterEach(cleanup);

const fmt = formatFor('en');
const { names } = textFor('en');

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
    setWidth('phone');
    const user = userEvent.setup();
    const services = await withThings();
    const [casio, gymPass] = services.items;
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: 'Open your profile' }));
    const profile = screen.getByRole('dialog', { name: 'Your life' });

    await user.click(within(profile).getByRole('button', { name: 'Casio F-91W' }));
    const watch = screen.getByRole('dialog', { name: 'Casio F-91W' });
    expect(within(watch).getByText('Watches')).toBeTruthy();
    expect(within(watch).getByText('Status +1')).toBeTruthy();
    expect(within(watch).getByText(/^Would sell for \$\d+ today$/)).toBeTruthy();
    expect(within(watch).getByText('It is sold or cancelled during the finances: here or in the Shop tab.')).toBeTruthy();
    // What it cost is beside what it would fetch, and the gap between the two is spelled out.
    expect(casio.paid).toBe(content.items.find((item) => item.id === 'watch_casio')?.price);
    expect(casio.value).toBeLessThan(casio.paid);
    expect(within(watch).getByText(`It cost you ${fmt.money(casio.paid)}`)).toBeTruthy();
    expect(within(watch).getByText(`Sell it today and you lose ${fmt.money(casio.paid - casio.value)}`)).toBeTruthy();

    // Closing it leaves the profile where it was.
    await user.click(within(watch).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Casio F-91W' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Your life' })).toBeTruthy();

    // A membership has a fee and no resale value.
    await user.click(within(screen.getByRole('dialog', { name: 'Your life' })).getByRole('button', { name: 'Gym' }));
    const gym = screen.getByRole('dialog', { name: 'Gym' });
    expect(within(gym).getByText(/a year upkeep|\/yr|upkeep/)).toBeTruthy();
    expect(within(gym).queryByText(/Would sell for/)).toBeNull();
    // What was paid to join is shown, with no gain or loss: there is nothing to sell.
    expect(within(gym).getByText(`It cost you ${fmt.money(gymPass.paid)}`)).toBeTruthy();
    expect(within(gym).queryByText(/Sell it today/)).toBeNull();
  });

  it('sells a thing or cancels a membership from its own sheet while the finances are open', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    const services = await withThings();
    const { session } = await services.sessions.resume();
    if (!session) throw new Error('no life to resume');
    while (session.view().phase === 'cards') await session.answerCard(0);
    const [casio] = session.view().player.life.items;
    renderGame(<Play />, services);
    await screen.findByRole('tablist', { name: 'Your finances' });
    const orders = () => screen.queryAllByRole('button', { name: /^Remove: /, hidden: true }).map((b) => (b.getAttribute('aria-label') ?? '').replace('Remove: ', ''));

    await user.click(screen.getByRole('button', { name: 'Casio F-91W' }));
    const watch = screen.getByRole('dialog', { name: 'Casio F-91W' });
    await user.click(within(watch).getByRole('button', { name: `Sell for ${fmt.money(casio.value)}` }));
    // The order is given and the sheet closes: the watch is no longer among her things.
    expect(screen.queryByRole('dialog', { name: 'Casio F-91W' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Casio F-91W' })).toBeNull();
    expect(orders()).toEqual(['Sell Casio F-91W']);

    await user.click(screen.getByRole('button', { name: 'Gym' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Gym' })).getByRole('button', { name: 'Cancel it' }));
    expect(orders()).toEqual(['Sell Casio F-91W', 'Cancel Gym']);

    await user.click(screen.getByRole('button', { name: 'Play the round' }));
    await screen.findByRole('heading', { name: 'Two years later' });
    expect(((await services.store.loadGame()) as SavedGame).state.player.life.items).toEqual([]);
  });

  it('shows a thing that has aged at the status it gives now, beside what it gave new', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'tech_phone' }] });
    const quote = quoteItem(content, session.view(), 'tech_phone');
    // A phone halves in value in a round, and in what it says about its owner.
    expect(quote).toMatchObject({ statusNew: 2, status: 1, ages: true });
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: names.items.tech_phone }));
    const sheet = screen.getByRole('dialog', { name: names.items.tech_phone });
    expect(within(sheet).getByText('Status +1')).toBeTruthy();
    expect(within(sheet).getByText('Gave +2 new')).toBeTruthy();
    expect(within(sheet).getByText('It has lost status over the years. A new one gives it all again.')).toBeTruthy();
  });

  it('opens from the side column of a wide screen too', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    renderGame(<Play />, await withThings());
    await screen.findAllByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: 'Casio F-91W' }));
    expect(screen.getByRole('dialog', { name: 'Casio F-91W' })).toBeTruthy();
  });

  it('says in words what the picture of the family shows: alone, seeing someone, together, married', async () => {
    setWidth('desk');
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
      await screen.findAllByRole('heading', { name: 'News' });
      expect(screen.getByText(words), words).toBeTruthy();
      cleanup();
    }
  });

  it('opens how the player lives, where, and what each insurance is for', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });

    // The nurse lives normally, in a rented room, with no insurance.
    await user.click(screen.getByRole('button', { name: /^Lifestyle/ }));
    let sheet = screen.getByRole('dialog', { name: 'Lifestyle' });
    let choices = within(sheet).getAllByRole('listitem');
    expect(choices.map((li) => li.getAttribute('aria-current'))).toEqual([null, 'true', null, null]);
    expect(within(choices[1]).getByText('Normal')).toBeTruthy();
    expect(within(choices[1]).getByText('Yours')).toBeTruthy();
    // Each says what a year of it costs, dearer as it goes up; the top two give status, and the frugal one takes it.
    const costs = choices.map((li) => Number((li.textContent ?? '').match(/\$([\d,]+)\/yr/)?.[1].replace(/,/g, '')));
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(within(choices[3]).getByText('Status +8')).toBeTruthy();
    expect(within(choices[0]).getByText('Status −2')).toBeTruthy();
    // And says when the frugal way will cost more: from 26.
    expect(within(choices[0]).getByText('From 26, living frugally costs 4 status.')).toBeTruthy();
    expect(within(choices[1]).queryByText(/^Status/)).toBeNull();
    expect(within(sheet).getByText('It is changed during the finances: here or in the Lifestyle tab.')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: /^Home/ }));
    sheet = screen.getByRole('dialog', { name: 'Home' });
    choices = within(sheet).getAllByRole('listitem');
    expect(choices).toHaveLength(2);
    expect(choices[0].getAttribute('aria-current')).toBe('true');
    expect(within(sheet).getByText(/^Until you own a home in Madrid, you rent/)).toBeTruthy();
    // A room costs nothing in status at twenty-two, and the sheet says from when it will.
    expect(within(choices[0]).queryByText(/^Status/)).toBeNull();
    expect(within(choices[1]).getByText('Status +3')).toBeTruthy();
    expect(within(sheet).getByText('From 26, a rented room costs 3 status.')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: /^Insurance/ }));
    sheet = screen.getByRole('dialog', { name: 'Insurance' });
    // What each one is for is read from the cards: the bills it pays part of, and the ways out it opens.
    expect(within(sheet).getByText('Pays 90% on "A serious illness"')).toBeTruthy();
    expect(within(sheet).getByText('Pays 90% on "Water damage"')).toBeTruthy();
    expect(within(sheet).getByText('Opens a way out on "A serious illness"')).toBeTruthy();
    expect(within(sheet).queryByText('Insured')).toBeNull();
    expect(within(sheet).getAllByText(/^\$\d+\/yr$/)).toHaveLength(3);
  });

  it('is only to be read until the finances open, and there each line is the choice itself', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });

    // During the news there is nothing to press but the way out.
    await user.click(screen.getByRole('button', { name: /^Lifestyle/ }));
    expect(within(screen.getByRole('dialog', { name: 'Lifestyle' })).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
    cleanup();

    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(<Play />, services);
    await screen.findByRole('tablist', { name: 'Your finances' });
    // The orders waiting, as the basket of a wide screen lists them.
    const orders = () => screen.queryAllByRole('button', { name: /^Remove: /, hidden: true }).map((b) => (b.getAttribute('aria-label') ?? '').replace('Remove: ', ''));

    await user.click(screen.getByRole('button', { name: /^Lifestyle/ }));
    let sheet = screen.getByRole('dialog', { name: 'Lifestyle' });
    expect(within(sheet).getByText('Tap to choose. It takes effect when the round is played.')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: /^Comfortable/ }));
    // The sheet shows the life as it will be, and the order waits with the others.
    expect(within(sheet).getAllByRole('listitem').map((li) => li.getAttribute('aria-current'))).toEqual([null, null, 'true', null]);
    expect(within(sheet).getByRole('button', { name: /^Comfortable/ }).getAttribute('aria-pressed')).toBe('true');
    expect(orders()).toEqual(['Live: Comfortable']);
    // Choosing again what is already so takes the order back.
    await user.click(within(sheet).getByRole('button', { name: /^Normal/ }));
    expect(orders()).toEqual([]);
    expect(within(sheet).getAllByRole('listitem').map((li) => li.getAttribute('aria-current'))).toEqual([null, 'true', null, null]);
    await user.click(within(sheet).getByRole('button', { name: /^Frugal/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: /^Home/ }));
    sheet = screen.getByRole('dialog', { name: 'Home' });
    await user.click(within(sheet).getByRole('button', { name: /^Rented flat/ }));
    expect(within(sheet).getAllByRole('listitem').map((li) => li.getAttribute('aria-current'))).toEqual([null, 'true']);
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: /^Insurance/ }));
    sheet = screen.getByRole('dialog', { name: 'Insurance' });
    await user.click(within(sheet).getByRole('button', { name: /^Health/ }));
    expect(within(sheet).getByText('Insured')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: /^Home/ }));
    await user.click(within(sheet).getByRole('button', { name: /^Home/ }));
    expect(within(sheet).getAllByText('Insured')).toHaveLength(1);
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    expect(orders()).toHaveLength(3);
    expect(orders()[0]).toBe('Live: Frugal');
    await user.click(screen.getByRole('button', { name: 'Play the round' }));
    await screen.findByRole('heading', { name: 'Two years later' });
    // The screen plays its own copy of the life: what it did is read from what was saved.
    const after = ((await services.store.loadGame()) as SavedGame).state.player;
    expect(after.lifestyleTier).toBe(0);
    expect(after.life.rentTier).toBe(1);
    expect(after.life.insurance).toMatchObject({ health: true, home: false });
  });

  it('shows a rented room as a loss of status once the player is twenty-six, and warns of the next step, at thirty-two', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    for (let round = 0; round < 2; round++) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: /^Home/ }));
    const sheet = screen.getByRole('dialog', { name: 'Home' });
    expect(within(within(sheet).getAllByRole('listitem')[0]).getByText('Status −3')).toBeTruthy();
    expect(within(sheet).getByText('From 32, a rented room costs 6 status.')).toBeTruthy();
  });

  it('names every insurance held in one word each, so that all of them fit on the line', async () => {
    setWidth('desk');
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: (['health', 'home', 'life'] as const).map((insurance) => ({ type: 'setInsurance' as const, insurance, on: true })) });
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    expect(screen.getByRole('button', { name: /^Insurance/ }).textContent).toContain('Health · Home · Life');
    cleanup();
    renderGame(<Play />, services, 'es');
    await screen.findAllByRole('heading', { name: 'Noticias' });
    expect(screen.getByRole('button', { name: /^Seguros/ }).textContent).toContain('Salud · Hogar · Vida');
  });

  it('shows the home itself, and no rent, to someone who owns where they live', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    const services = memoryServices();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' } } });
    await services.sessions.start('heir');
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: /^Home/ }));
    const sheet = screen.getByRole('dialog', { name: 'Home' });
    expect(within(sheet).getByText('You live in a home you own, so you pay no rent.')).toBeTruthy();
    expect(within(sheet).getByText('Apartment in the Marina')).toBeTruthy();
    expect(within(sheet).getByText('Worth today')).toBeTruthy();
    expect(within(sheet).queryAllByRole('listitem')).toEqual([]);
  });
});
