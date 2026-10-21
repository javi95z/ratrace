// @vitest-environment jsdom
import { sceneStore } from '@ratrace/core/testing/scenes';
import type { GameSession } from '@ratrace/core/session/types';
import type { Order } from '@ratrace/engine';
import { messagesFor } from '@ratrace/i18n';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { GameProvider, useGame } from '../context';
import { dashesOf, Headlines, NewsPanel, RoundOpener } from './News';

afterEach(cleanup);

const en = messagesFor('en');

/** Plays whole rounds without the screen. */
async function playRounds(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

describe('the news of a round', () => {
  it('is a paper with its masthead, the city and the issue, a clipping to each headline and the gauges of the economy', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(<NewsPanel />, services);
    const paper = await screen.findByRole('region', { name: 'News' });
    expect(within(paper).getByRole('heading', { name: 'News' })).toBeTruthy();
    expect(within(paper).getByText('The Rat Race Times')).toBeTruthy();
    expect(within(paper).getByText('TOKYO')).toBeTruthy();
    expect(within(paper).getByText('NO. 1')).toBeTruthy();
    const clippings = within(paper).getAllByRole('listitem');
    expect(clippings).toHaveLength(4);
    // A topic's icon sits in a box of the topic's colour, inside its padding.
    expect(clippings[0].querySelector('[data-sprite="icon.news"]')).toBeTruthy();
    for (const label of ['Rates', 'Inflation', 'Economy', 'Crypto']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Expansion')).toBeTruthy();
    // The first round has no round before it: nothing is told of the player's people.
    expect(screen.queryByText(en.rivals.topic.toUpperCase())).toBeNull();
  });

  it('tells of the player\'s people now and then, and shows one of the famous whole when they say the news', async () => {
    const services = memoryServices();
    await playRounds(await services.sessions.start('engineer'), 1);
    renderGame(<Headlines />, services);
    const paper = await screen.findByRole('region', { name: 'News' });
    const clippings = within(paper).getAllByRole('listitem');
    // Four headlines, and the story of the people the player grew up with.
    expect(clippings).toHaveLength(5);
    expect(clippings[3].querySelector('[data-sprite="celeb.grump"]')).toBeTruthy();
    const people = clippings[4];
    expect(people.querySelector('[data-topic]')?.textContent).toBe(en.rivals.topic.toUpperCase());
    expect(people.querySelector('[data-sprite="icon.percentile"]')).toBeTruthy();
    expect(people.textContent).toMatch(/^.*You now have more than \w+, your ex$/);
  });

  it('opens on the bar of a crisis, whole, when the world is in one', async () => {
    const store = await sceneStore('hud-crisis');
    renderGame(<NewsPanel />, memoryServices(store));
    const bar = await screen.findByTestId('crisis-bar');
    expect(bar.textContent).toContain('YEAR 2 OF');
    expect(screen.queryByTestId('crisis-strip')).toBeNull();
  });

  it('opens a round on a wide screen with its own title: the round, the age, the city', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(<RoundOpener />, services);
    expect(await screen.findByText('ROUND 1 OF 20')).toBeTruthy();
    expect(screen.getByText('Age 22')).toBeTruthy();
    expect(screen.getAllByText('Tokyo').length).toBeGreaterThan(0);
    expect(screen.getByText(en.news.opener)).toBeTruthy();
  });

  it('is not drawn again when the orders of the round change: it draws none of them', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    const news: Renders = { count: 0 };
    let setOrder: ((same: (order: Order) => boolean, order: Order | null) => boolean) | null = null;
    let orders = -1;
    function Hands() {
      setOrder = useGame((s) => s.setOrder);
      orders = useGame((s) => s.orders.length);
      return null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Counted into={news}>
          <NewsPanel />
        </Counted>
        <Hands />
      </GameProvider>,
    );
    await screen.findByRole('region', { name: 'News' });
    await settled();
    const before = news.count;
    await settled(() => void setOrder!((order) => order.type === 'setLifestyle', { type: 'setLifestyle', tier: 2 } as Order));
    expect(orders).toBe(1);
    expect(news.count).toBe(before);
  });
});

describe('the dashed rule between two clippings', () => {
  it('lays its dashes as Chrome does: three long, a dash at each end, the gaps as near two as a whole count of dashes allows', () => {
    // The paper's column on the shots' phone: 346 points, which Chrome draws as 70 dashes (measured on the web's shot).
    const dashes = dashesOf(346);
    expect(dashes).toHaveLength(70);
    expect(dashes[0]).toBe(0);
    expect(dashes[69] + 3).toBeCloseTo(346, 9);
    const gap = dashes[1] - dashes[0] - 3;
    expect(gap).toBeCloseTo(136 / 69, 9);
    // On the narrower phone the count follows the length, never a gap of nothing.
    for (const length of [304, 318, 346, 410]) {
      const each = dashesOf(length);
      expect(each.at(-1)! + 3, String(length)).toBeCloseTo(length, 9);
      expect(each[1] - each[0] - 3, String(length)).toBeGreaterThan(1.5);
      expect(each[1] - each[0] - 3, String(length)).toBeLessThan(2.5);
    }
  });
});
