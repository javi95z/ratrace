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
import { RoomPaper } from '../roomStory';
import { dashesOf, Headlines, NewsPanel, RoundOpener } from './News';
import type { RoomMember } from '@ratrace/core/game/room';

afterEach(cleanup);

const en = messagesFor('en');

/** Plays whole rounds without the screen. */
async function playRounds(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

/** A player of a room, as the round left them: their score, and the score and place of the round before. */
const player = (userId: string, name: string, score: number, before: [number, number], over: Partial<RoomMember> = {}): RoomMember => ({
  userId, name, me: false, host: false, bot: null, followed: false, friend: false, ready: false, left: false, shout: null, avatar: null,
  standing: { score, netWorth: 0, status: 0, escaped: false, bankruptcies: 0, before: { score: before[0], place: before[1] }, cityId: null, career: null },
  ...over,
});

describe('the news of a game with friends', () => {
  it('tells of the players themselves, with the rat it is about, and never of the player\'s made-up people', async () => {
    const services = memoryServices();
    await playRounds(await services.sessions.start('engineer'), 1);
    // Bea took the lead from the player this round.
    const members = [player('me-0000', 'Rata_Uno', 100, [90, 1], { me: true }), player('bea-0000', 'Bea_7', 140, [80, 2], { avatar: 'rat_teal' })];
    renderGame(
      <RoomPaper.Provider value={members}>
        <Headlines />
      </RoomPaper.Provider>,
      services,
    );
    const paper = await screen.findByRole('region', { name: 'News' });
    const story = within(paper).getByText(en.room.paperTopic.toUpperCase()).closest('[role="listitem"]') as HTMLElement;
    expect(story.textContent).toContain('Bea_7');
    expect(story.querySelector('[data-sprite="icon.percentile"]')).toBeNull();
    expect(screen.queryByText(en.rivals.topic.toUpperCase())).toBeNull();
  });

  it('says nothing of the game in a quiet round', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(
      <RoomPaper.Provider value={[player('me-0000', 'Rata_Uno', 400, [396, 1], { me: true }), player('bea-0000', 'Bea_7', 300, [298, 2])]}>
        <Headlines />
      </RoomPaper.Provider>,
      services,
    );
    const paper = await screen.findByRole('region', { name: 'News' });
    expect(within(paper).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByText(en.room.paperTopic.toUpperCase())).toBeNull();
  });
});

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

  /** The clippings of the paper of a scene. */
  async function clippingsOf(scene: string) {
    renderGame(<Headlines />, memoryServices(await sceneStore(scene)));
    const paper = await screen.findByRole('region', { name: 'News' });
    return within(paper).getAllByRole('listitem');
  }

  /** The ways a sentence of the rivals is written, filled with who it is about and the thing. */
  const ways = (sentence: string, who: string, thing = '') => sentence.split('|').map((way) => way.replace('{who}', who).replace('{thing}', thing));

  it('tells of a rival who keeps up with what the player bought: a notch better, its picture beside it', async () => {
    const clippings = await clippingsOf('play-news-rival-copy');
    const people = clippings.at(-1) as HTMLElement;
    expect(people.querySelector('[data-topic]')?.textContent).toBe(en.rivals.topic.toUpperCase());
    expect(people.querySelector('[data-sprite="item.watch_ap"]')).toBeTruthy();
    const said = people.textContent ?? '';
    expect(ways(en.rivals.asides.copyWatch, '', 'Audemars Piguet Royal Oak').some((way) => said.endsWith(way.slice(1)))).toBe(true);
  });

  it('carries a line from a rival about the player\'s fall, under its own heading, the same each time the paper is read', async () => {
    const clippings = await clippingsOf('play-news-rival-needle');
    const needle = clippings.at(-1) as HTMLElement;
    expect(needle.querySelector('[data-topic]')?.textContent).toBe(en.rivals.needles.needleTopic.toUpperCase());
    expect(needle.querySelector('[data-sprite="icon.room_tease"]')).toBeTruthy();
    const said = needle.textContent ?? '';
    expect(ways(en.rivals.needles.needleBankrupt, '').some((way) => said.includes(way.trim()))).toBe(true);
    cleanup();
    const again = await clippingsOf('play-news-rival-needle');
    expect(again.at(-1)?.textContent).toBe(said);
  });

  it('tells of the luck that brings a rival back within reach of a player far ahead', async () => {
    const clippings = await clippingsOf('play-news-rival-luck');
    // The people's clipping, which a needle from one of them may follow.
    const people = clippings.find((clipping) => clipping.querySelector('[data-topic]')?.textContent === en.rivals.topic.toUpperCase()) as HTMLElement;
    expect(people).toBeTruthy();
    const said = people.textContent ?? '';
    const lucky = [en.rivals.asides.luckInheritance, en.rivals.asides.luckStartup, en.rivals.asides.luckCoin].flatMap((sentence) => ways(sentence, ''));
    expect(lucky.some((way) => said.includes(way.trim()))).toBe(true);
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
