// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { challengeOf, lives, textFor, weekOf } from '@ratrace/content';
import type { ChallengeRow, Community, Friend, RankedLifeDetail, RankingQuery, RankingRow } from '@ratrace/online/types';
import { formatFor } from '@ratrace/core/lib/format';
import { memoryServices, renderGame } from '@/testing/render';
import { Rankings } from './Rankings';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, 'aria-label': label }: { href: string; children: ReactNode; className?: string; 'aria-label'?: string }) => (
    <a href={href} className={className} aria-label={label}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/rankings',
}));

afterEach(cleanup);

const row = (place: number, userId: string, over: Partial<RankingRow> = {}): RankingRow => ({ place, userId, nickname: null, score: 1000 - place * 100, lifeId: 'nurse', finishedAt: Date.UTC(2026, 9, 13), mine: false, ...over });

/** The other players, as a test says they are, remembering what was asked. */
function community(over: Partial<Community> = {}) {
  const asked: string[] = [];
  const state = {
    me: { nickname: null as string | null, friendCode: 'ABCD2345', avatar: null as string | null },
    friends: { friends: [] as Friend[], incoming: [] as Friend[], outgoing: [] as Friend[] },
    board: (query: RankingQuery): RankingRow[] | null => [row(1, 'aaaa1111-0000', { nickname: 'Otra_Rata', lifeId: 'engineer' }), row(2, 'bbbb2222-0000'), row(9, 'me', { mine: true, score: 120 })].filter(() => query.period === 'all' || true),
  };
  const all: Community = {
    me: async () => state.me,
    rename: async (name) => {
      asked.push(`rename ${name}`);
      state.me = { ...state.me, nickname: name };
      return 'ok';
    },
    setAvatar: async (avatar) => {
      asked.push(`avatar ${avatar}`);
      state.me = { ...state.me, avatar };
      return true;
    },
    ranking: async (query) => {
      asked.push(`ranking ${query.period} ${query.friends ? 'friends' : 'everyone'} ${query.lifeId ?? 'any'}`);
      return state.board(query);
    },
    friends: async () => state.friends,
    compare: async () => null,
    run: async () => null,
    befriend: async (code) => {
      asked.push(`befriend ${code}`);
      state.friends = { ...state.friends, outgoing: [{ userId: 'aaaa1111-0000', nickname: 'Otra_Rata', avatar: null }, ...state.friends.outgoing] };
      return 'sent';
    },
    answerFriend: async (userId, yes) => {
      asked.push(`answer ${userId} ${yes ? 'yes' : 'no'}`);
      const asking = state.friends.incoming.find((friend) => friend.userId === userId);
      const incoming = state.friends.incoming.filter((friend) => friend.userId !== userId);
      state.friends = { ...state.friends, incoming, friends: yes && asking ? [asking, ...state.friends.friends] : state.friends.friends };
      return yes ? 'accepted' : 'declined';
    },
    unfriend: async (userId) => {
      asked.push(`unfriend ${userId}`);
      const without = (list: Friend[]) => list.filter((friend) => friend.userId !== userId);
      state.friends = { friends: without(state.friends.friends), incoming: without(state.friends.incoming), outgoing: without(state.friends.outgoing) };
      return true;
    },
    challengeEntry: async () => ({ entered: false, score: null }),
    challengeRanking: async () => ({ rows: [], entrants: 0 }),
    challengeChoices: async () => [],
    notifyMe: async () => true,
    stopNotifying: async () => true,
    marketNotice: async () => true,
    setMarketNotice: async () => true,
    ...over,
  };
  return { community: all, asked, state };
}
const show = (with_: Community | null, locale: 'en' | 'es' = 'en') => renderGame(<Rankings />, { ...memoryServices(), community: () => with_ }, locale);

describe('the rankings', () => {
  it('says what they need where there is no account to ask', async () => {
    show(null);
    expect(await screen.findByText('The rankings need an account and a connection.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Rankings' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('lists the best ranked life of each player, the highest first, and marks the player\'s own line', async () => {
    const { community: c, asked } = community();
    show(c);
    const lines = within(await screen.findByRole('list', { name: 'All time' })).getAllByRole('listitem');
    // Each line: the place, the name, the starting life and the day it ended, and the score.
    const day = formatFor('en').day(Date.UTC(2026, 9, 13));
    expect(lines.map((line) => line.textContent)).toEqual([`1Otra_RataSoftware engineer · ${day}900▸`, `2Rat BBBBNurse · ${day}800▸`, `9Rat MENurse · ${day}120▸`]);
    expect(lines[2].getAttribute('aria-current')).toBe('true');
    expect(lines[0].getAttribute('aria-current')).toBeNull();
    expect(asked).toEqual(['ranking all everyone any']);
  });

  it('shows the ranking of the week, and the one among friends, when asked', async () => {
    const { community: c, asked } = community();
    const user = userEvent.setup();
    show(c);
    await screen.findByRole('list', { name: 'All time' });
    await user.click(screen.getByRole('tab', { name: 'This week' }));
    await screen.findByRole('list', { name: 'This week' });
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    await screen.findByRole('list', { name: 'Friends' });
    expect(asked).toEqual(['ranking all everyone any', 'ranking week everyone any', 'ranking all friends any']);
    expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true');
    // The list belongs to the tab that is open, and is named by it.
    expect(within(screen.getByRole('tabpanel', { name: 'Friends' })).getByRole('list', { name: 'Friends' })).toBeTruthy();
  });

  it('narrows a ranking to one starting life, and widens it again', async () => {
    const { community: c, asked } = community();
    const user = userEvent.setup();
    show(c);
    await screen.findByRole('list', { name: 'All time' });
    // The game's own picker: a button that says what is chosen, and a list in a sheet.
    await user.click(screen.getByRole('button', { name: 'Starting life: Any life' }));
    const list = within(screen.getByRole('dialog', { name: 'Starting life' })).getByRole('listbox', { name: 'Starting life' });
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => option.textContent?.replace('✓', '')).slice(0, 3)).toEqual(['Any life', 'Nurse', 'Software engineer']);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    await user.click(within(list).getByRole('option', { name: 'Nurse' }));
    expect(screen.queryByRole('dialog', { name: 'Starting life' })).toBeNull();
    await waitFor(() => expect(asked).toContain('ranking all everyone nurse'));
    // The life chosen stays chosen from one ranking to the next.
    await user.click(screen.getByRole('tab', { name: 'This week' }));
    await waitFor(() => expect(asked).toContain('ranking week everyone nurse'));
    await user.click(screen.getByRole('button', { name: 'Starting life: Nurse' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Starting life' })).getByRole('option', { name: /^Any life/ }));
    await waitFor(() => expect(asked[asked.length - 1]).toBe('ranking week everyone any'));
  });

  it('shows a ranking only for what was asked last, whichever answer comes last', async () => {
    const waiting: Array<{ query: RankingQuery; answer(rows: RankingRow[]): void }> = [];
    const { community: c } = community({ ranking: (query) => new Promise((answer) => waiting.push({ query, answer })) });
    const user = userEvent.setup();
    show(c);
    await waitFor(() => expect(waiting).toHaveLength(1));
    await user.click(screen.getByRole('tab', { name: 'This week' }));
    await waitFor(() => expect(waiting).toHaveLength(2));
    // The week answers first, and all time after it: the week is what the player is looking at.
    waiting[1].answer([row(1, 'week0000-0000')]);
    await screen.findByRole('list', { name: 'This week' });
    waiting[0].answer([row(1, 'allt0000-0000'), row(2, 'allt1111-0000')]);
    await new Promise((done) => setTimeout(done, 20));
    expect(within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem').map((line) => line.textContent)).toEqual([`1Rat WEEKNurse · ${formatFor('en').day(Date.UTC(2026, 9, 13))}900▸`]);
  });

  it('says so when nobody is in a ranking yet, and when it could not be read', async () => {
    const empty = community();
    empty.state.board = () => [];
    show(empty.community);
    expect(await screen.findByText('Nobody has finished a ranked life here yet. Yours could be the first.')).toBeTruthy();
    cleanup();
    const away = community();
    away.state.board = () => null;
    show(away.community, 'es');
    expect(await screen.findByText('No se han podido leer las clasificaciones. Inténtalo más tarde.')).toBeTruthy();
  });

  it('lets the player choose the name they appear under, and checks how it is written before it asks', async () => {
    const { community: c, asked } = community();
    const user = userEvent.setup();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    // Until one is chosen, the name the rankings give: Rat, and four characters.
    expect(you.textContent).toMatch(/Rat /);
    await user.click(within(you).getByRole('button', { name: 'Change it' }));
    const field = within(you).getByRole('textbox', { name: 'Name' });
    await user.type(field, 'a b');
    await user.click(within(you).getByRole('button', { name: 'Save' }));
    expect(within(you).getByRole('alert').textContent).toBe('3 to 16 letters, digits or underscores.');
    expect(asked.filter((line) => line.startsWith('rename'))).toEqual([]);
    await user.clear(field);
    await user.type(field, 'Rata_Uno');
    await user.click(within(you).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(you.textContent).toContain('Rata_Uno'));
    expect(asked).toContain('rename Rata_Uno');
    expect(within(you).queryByRole('textbox')).toBeNull();
    // The rankings are read again: the player's line now carries the name.
    expect(asked.filter((line) => line.startsWith('ranking'))).toHaveLength(2);
  });

  it('shows nothing of one ranking under the name of another while that other is on its way', async () => {
    const { community: c } = community({ ranking: (query) => (query.period === 'all' ? Promise.resolve([row(1, 'aaaa1111-0000')]) : new Promise(() => {})) });
    const user = userEvent.setup();
    show(c);
    await screen.findByRole('list', { name: 'All time' });
    await user.click(screen.getByRole('tab', { name: 'This week' }));
    // The week has not answered: what is on screen is that it is being read, not the lines of all time.
    const week = screen.getByRole('tabpanel', { name: 'This week' });
    expect(within(week).queryByRole('list')).toBeNull();
    expect(within(week).getByText('Loading…')).toBeTruthy();
    // Back where the answer is known, it is there at once.
    await user.click(screen.getByRole('tab', { name: 'All time' }));
    expect(within(screen.getByRole('list', { name: 'All time' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the ranking on screen while it is read again', async () => {
    let asks = 0;
    const { community: c } = community({ ranking: () => ((asks += 1) === 1 ? Promise.resolve([row(1, 'aaaa1111-0000')]) : new Promise(() => {})) });
    const user = userEvent.setup();
    show(c);
    await screen.findByRole('list', { name: 'All time' });
    const you = screen.getByRole('region', { name: 'You' });
    await user.click(within(you).getByRole('button', { name: 'Change it' }));
    await user.type(within(you).getByRole('textbox', { name: 'Name' }), 'Rata_Uno');
    await user.click(within(you).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(asks).toBe(2));
    // The second answer never comes here: the first is still what is shown.
    expect(within(screen.getByRole('list', { name: 'All time' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('lets a name that is already chosen be changed, starting from it, and lets the player think better of it', async () => {
    const { community: c, asked, state } = community();
    state.me = { nickname: 'Rata_Uno', friendCode: 'ABCD2345', avatar: null };
    const user = userEvent.setup();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    await waitFor(() => expect(you.textContent).toContain('Rata_Uno'));
    await user.click(within(you).getByRole('button', { name: 'Change it' }));
    expect((within(you).getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Rata_Uno');
    await user.type(within(you).getByRole('textbox', { name: 'Name' }), '!');
    await user.click(within(you).getByRole('button', { name: 'Save' }));
    expect(within(you).getByRole('alert')).toBeTruthy();
    await user.click(within(you).getByRole('button', { name: 'Cancel' }));
    expect(within(you).queryByRole('textbox')).toBeNull();
    expect(within(you).queryByRole('alert')).toBeNull();
    expect(asked.filter((line) => line.startsWith('rename'))).toEqual([]);
    // Opened again, the form says nothing of the last try.
    await user.click(within(you).getByRole('button', { name: 'Change it' }));
    expect(within(you).queryByRole('alert')).toBeNull();
  });

  it('says nothing of a name where the player\'s own could not be read', async () => {
    const { community: c } = community({ me: async () => null });
    show(c);
    await screen.findByRole('list', { name: 'All time' });
    expect(screen.queryByRole('region', { name: 'You' })).toBeNull();
  });

  it('takes a name of three to sixteen characters, without the spaces typed around it', async () => {
    const { community: c, asked } = community();
    const user = userEvent.setup();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    await user.click(within(you).getByRole('button', { name: 'Change it' }));
    const field = within(you).getByRole('textbox', { name: 'Name' });
    await user.type(field, 'ab');
    await user.click(within(you).getByRole('button', { name: 'Save' }));
    expect(within(you).getByRole('alert').textContent).toBe('3 to 16 letters, digits or underscores.');
    // The field takes no more than a name can hold.
    await user.clear(field);
    await user.type(field, 'abcdefghijklmnopq');
    expect((field as HTMLInputElement).value).toBe('abcdefghijklmnop');
    await user.clear(field);
    await user.type(field, ' abc ');
    await user.click(within(you).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(you.textContent).toContain('abc'));
    expect(asked.filter((line) => line.startsWith('rename'))).toEqual(['rename abc']);
  });

  it('says why a name was not taken', async () => {
    for (const [answer, said] of [['taken', 'Someone already has that name.'], ['refused', 'That name is not accepted.'], ['failed', 'The name could not be saved. Try again.']] as const) {
      const { community: c } = community({ rename: async () => answer });
      const user = userEvent.setup();
      show(c);
      const you = await screen.findByRole('region', { name: 'You' });
      await user.click(within(you).getByRole('button', { name: 'Change it' }));
      await user.type(within(you).getByRole('textbox', { name: 'Name' }), 'Rata_Uno');
      await user.click(within(you).getByRole('button', { name: 'Save' }));
      expect((await within(you).findByRole('alert')).textContent, answer).toBe(said);
      cleanup();
    }
  });

  it('shows the player their friend code, and asks another player to be friends by theirs', async () => {
    const { community: c, asked } = community();
    const user = userEvent.setup();
    show(c);
    expect((await screen.findByRole('region', { name: 'You' })).textContent).toContain('ABCD2345');
    // The friends belong with the ranking they decide, and are not shown beside the others.
    expect(screen.queryByRole('region', { name: 'Your friends' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    expect(friends.textContent).toContain('No friends yet.');
    await user.type(within(friends).getByRole('textbox', { name: 'Friend code' }), 'wxyz6789');
    await user.click(within(friends).getByRole('button', { name: 'Send request' }));
    expect((await within(friends).findByRole('status')).textContent).toBe('Request sent. Once they accept, you are friends.');
    expect(asked).toContain('befriend wxyz6789');
    expect((within(friends).getByRole('textbox', { name: 'Friend code' }) as HTMLInputElement).value).toBe('');
    // A request waits, apart from the friends, until it is answered.
    const sent = await within(friends).findByRole('region', { name: 'Requests sent' });
    expect(sent.textContent).toContain('Otra_Rata');
    expect(sent.textContent).toContain('Waiting');
    expect(within(friends).queryByRole('list')).toBeNull();
  });

  it('accepts a request where it is read, and ends a friendship only from the friend\'s sheet', async () => {
    const { community: c, asked, state } = community();
    state.friends.incoming = [{ userId: 'bbbb2222-0000', nickname: 'Tercera', avatar: null }, { userId: 'dddd4444-0000', nickname: null, avatar: null }];
    const user = userEvent.setup();
    show(c);
    await user.click(await screen.findByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    const requests = await within(friends).findByRole('region', { name: 'Friend requests' });
    expect(requests.textContent).toContain('Rat DDDD');
    await user.click(within(requests).getAllByRole('button', { name: 'Accept' })[0]);
    expect((await within(friends).findByRole('status')).textContent).toBe('You are friends now!');
    expect(asked).toContain('answer bbbb2222-0000 yes');
    await user.click(within(friends).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(within(friends).queryByRole('region', { name: 'Friend requests' })).toBeNull());
    expect(asked).toContain('answer dddd4444-0000 no');
    // A friend is a line to tap, with nothing on it that ends the friendship.
    const friend = await within(within(friends).getByRole('list')).findByRole('button', { name: /Tercera/ });
    expect(within(friends).queryByRole('button', { name: /Remove|Stop/ })).toBeNull();
    await user.click(friend);
    const sheet = screen.getByRole('dialog', { name: 'Tercera' });
    await user.click(within(sheet).getByRole('button', { name: 'Remove friend' }));
    await waitFor(() => expect(friends.textContent).toContain('No friends yet.'));
    expect(asked).toContain('unfriend bbbb2222-0000');
    // Each change of the friends reads the friends' ranking again.
    expect(asked.filter((line) => line === 'ranking all friends any').length).toBeGreaterThanOrEqual(4);
  });

  it('asks nobody for an empty code, and trims a pasted one', async () => {
    const { community: c, asked } = community();
    const user = userEvent.setup();
    show(c);
    await user.click(await screen.findByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    await user.type(within(friends).getByRole('textbox', { name: 'Friend code' }), '   ');
    await user.click(within(friends).getByRole('button', { name: 'Send request' }));
    expect(asked.filter((line) => line.startsWith('befriend'))).toEqual([]);
    await user.clear(within(friends).getByRole('textbox', { name: 'Friend code' }));
    await user.type(within(friends).getByRole('textbox', { name: 'Friend code' }), ' wxyz6789 ');
    await user.click(within(friends).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(asked).toContain('befriend wxyz6789'));
  });

  it('says so when the friends could not be read', async () => {
    const { community: c } = community({ friends: async () => null });
    const user = userEvent.setup();
    show(c);
    await user.click(await screen.findByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    expect(await within(friends).findByText('Your friends could not be read.')).toBeTruthy();
    expect(friends.textContent).not.toContain('No friends yet.');
  });

  it('says what a request came to', async () => {
    for (const [answer, said, role] of [
      ['accepted', 'You are friends now!', 'status'],
      ['pending', 'You had already sent them a request.', 'status'],
      ['friends', 'You are friends already.', 'status'],
      ['unknown', 'No player has that code.', 'alert'],
      ['self', 'That is your own code.', 'alert'],
      ['full', 'You already have as many friends or waiting requests as one can.', 'alert'],
      ['failed', 'That did not work. Try again.', 'alert'],
    ] as const) {
      const { community: c } = community({ befriend: async () => answer });
      const user = userEvent.setup();
      show(c);
      await user.click(await screen.findByRole('tab', { name: 'Friends' }));
      const friends = await screen.findByRole('region', { name: 'Your friends' });
      await user.type(within(friends).getByRole('textbox', { name: 'Friend code' }), 'wxyz6789');
      await user.click(within(friends).getByRole('button', { name: 'Send request' }));
      expect((await within(friends).findByRole(role)).textContent, answer).toBe(said);
      cleanup();
    }
  });

  it('opens the life behind a line: how it ended, what it was worth, where it was lived and what it earned', async () => {
    const detail: RankedLifeDetail = { netWorth: 123_456_00, status: 41, escapedAtRound: 9, bankruptcies: 1, badges: ['first_share'], cities: ['madrid', 'london'], history: [100_000, 400_000, 900_000], finishedAt: Date.UTC(2026, 9, 13) };
    const asked: unknown[] = [];
    const { community: c } = community({ run: async (line) => (asked.push(line), detail) });
    const user = userEvent.setup();
    show(c);
    const [first] = within(await screen.findByRole('list', { name: 'All time' })).getAllByRole('listitem');
    await user.click(within(first).getByRole('button'));
    const sheet = screen.getByRole('dialog', { name: 'Otra_Rata' });
    expect(asked).toEqual([expect.objectContaining({ userId: 'aaaa1111-0000', lifeId: 'engineer', score: 900 })]);
    expect(await within(sheet).findByText('$123,456')).toBeTruthy();
    expect(within(sheet).getByText('At 40')).toBeTruthy();
    expect(within(sheet).getByText('Madrid')).toBeTruthy();
    expect(within(sheet).getByText('London')).toBeTruthy();
    expect(within(sheet).getByRole('list', { name: 'Badges of this life' })).toBeTruthy();
    expect(within(sheet).getByRole('img', { name: /net worth/i })).toBeTruthy();
  });

  it('says so when the life behind a line cannot be read', async () => {
    const { community: c } = community({ run: async () => null });
    const user = userEvent.setup();
    show(c);
    const [first] = within(await screen.findByRole('list', { name: 'All time' })).getAllByRole('listitem');
    await user.click(within(first).getByRole('button'));
    expect(await within(screen.getByRole('dialog', { name: 'Otra_Rata' })).findByText('This life could not be read.')).toBeTruthy();
  });
});

describe('the ranking of the weekly challenge', () => {
  const week = challengeOf(weekOf(Date.now()), lives);
  if (!week) throw new Error('no challenge this week');
  const entry = (place: number, over: Partial<ChallengeRow> = {}): ChallengeRow => ({ place, userId: `user-${place}`, nickname: `Rata_${place}`, score: 2000 - place * 10, finishedAt: Date.UTC(2026, 9, 13), mine: false, ...over });

  it('shows the week’s life and rule, every attempt best first, the best tenth marked, and how many took part', async () => {
    const asked: string[] = [];
    const { community: everyone } = community({
      challengeRanking: async (asking) => {
        asked.push(asking);
        return { rows: [entry(1), entry(2), entry(3, { mine: true, nickname: null })], entrants: 20 };
      },
    });
    const user = userEvent.setup();
    show(everyone);
    await user.click(await screen.findByRole('tab', { name: "This week's challenge" }));
    expect(asked).toEqual([week.week]);
    expect(screen.getByText(textFor('en').text.lives[week.lifeId].name)).toBeTruthy();
    expect(screen.getByText('20 attempts · the best 2 are in the top 10%')).toBeTruthy();
    const lines = within(screen.getByRole('list', { name: "This week's challenge" })).getAllByRole('listitem');
    expect(lines.map((line) => line.textContent)).toEqual([
      expect.stringContaining('Rata_1'),
      expect.stringContaining('Rata_2'),
      expect.stringContaining('Unnamed player'),
    ]);
    expect(lines.map((line) => within(line).queryByText('Top 10%') !== null)).toEqual([true, true, false]);
    expect(lines[2].getAttribute('aria-current')).toBe('true');
  });

  it('says so when nobody has finished it yet, and when it cannot be read', async () => {
    const user = userEvent.setup();
    show(community({ challengeRanking: async () => ({ rows: [], entrants: 0 }) }).community);
    await user.click(await screen.findByRole('tab', { name: /challenge/ }));
    expect(await screen.findByText("Nobody has finished this week's challenge yet.")).toBeTruthy();
    cleanup();
    show(community({ challengeRanking: async () => null }).community);
    await user.click(await screen.findByRole('tab', { name: /challenge/ }));
    expect(await screen.findByText('The ranking of the challenge cannot be read just now.')).toBeTruthy();
  });
});
