// @vitest-environment jsdom
import { challengeOf, lives, textFor, weekOf } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import type { ChallengeRow, Community, Friend, RankedLifeDetail, RankingQuery, RankingRow } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { useGame } from '../context';
import { Rankings } from './Rankings';
import type { Opening } from './Rankings';
import { useState, type ReactElement } from 'react';

afterEach(cleanup);

// Every row of a list is drawn here (a list on a phone draws only those near the screen): the lines are all there to be read. A test of the windowing
// itself draws the real list (`windowed.on`). What the page hands its list is kept (`listed`).
const windowed = vi.hoisted(() => ({ on: false }));
const listed = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('react-native', async (original) => {
  const native = await original<typeof import('react-native')>();
  const { everyRow } = await import('../../testing/fakes');
  const { createElement } = await import('react');
  const EveryRow = everyRow(native.FlatList as never);
  return {
    ...native,
    FlatList: (props: Record<string, unknown>) => {
      listed.push(props);
      return createElement((windowed.on ? native.FlatList : EveryRow) as never, props as never);
    },
  };
});
// A player's rat is a canvas: here a box that counts its drawings, by the rat (a friend's line is drawn again only when what it shows changes).
const rats = vi.hoisted(() => new Map<string, number>());
vi.mock('../../ui/RatAvatar', async () => {
  const { createElement } = await import('react');
  return {
    RatAvatar: ({ look }: { look: unknown }) => {
      const key = JSON.stringify(look);
      rats.set(key, (rats.get(key) ?? 0) + 1);
      return createElement('div', { 'data-rat': key });
    },
  };
});
afterEach(() => {
  windowed.on = false;
  listed.length = 0;
  rats.clear();
});

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
const show = (with_: Community | null, locale: 'en' | 'es' = 'en', props: Parameters<typeof Rankings>[0] = {}) => renderGame(<Rankings {...props} />, { ...memoryServices(), community: () => with_ }, locale);
/** The page with the tab its route names, which a test changes while the page is open (`followed.to`), as a link followed then does. */
const followed: { to?: (tab: Opening) => void } = {};
function Followed() {
  const [tab, setTab] = useState<Opening>('global');
  followed.to = setTab;
  return <Rankings tab={tab} />;
}

/**
 * The list of a ranking, by its name: the page's own list (its rows are the ranking's lines, its header the page above them). Null while there is
 * none: the page's list is named by its ranking only while it has lines to list.
 */
const rankingOf = (name: string) => screen.queryByRole('list', { name });
/** The lines on the page now, of any ranking: none while a ranking is on its way, or has nobody in it. */
const anyLines = () => screen.queryAllByRole('listitem').filter((item) => item.parentElement?.closest('[role="list"]') === screen.getAllByRole('list')[0]);
/** The lines of a ranking: the rows of that list itself (the friends' lists, in its foot, are lists of their own). */
const linesOf = async (name: string) => {
  const list = await screen.findByRole('list', { name });
  return within(list).getAllByRole('listitem').filter((item) => item.parentElement?.closest('[role="list"]') === list);
};
/** A sheet, by its title. */
const sheetOf = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
/**
 * The friends' panel, once it is drawn: its lines are rows of the page's list and its foot is the list's footer, so the panel is no one box. It is
 * found by its title, and asked of as the page.
 */
/** The page pulled down past its top, as the phone's spinner asks it to read itself again. */
const pullDown = () => act(() => (listed.at(-1)!.refreshControl as ReactElement<{ onRefresh(): void }>).props.onRefresh());

describe('the rankings', () => {
  it('says what they need where there is no account to ask', async () => {
    show(null);
    expect(await screen.findByText('The rankings need an account and a connection.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/en');
  });

  it('lists the best ranked life of each player this week, the highest first, and pins the player\'s own line at its foot when it is far below', async () => {
    const { community: c, asked } = community();
    show(c);
    const lines = await linesOf('Global');
    // Each line: the place, the name, the starting life and the day it ended, and the score.
    // The day is held whole on its line: its spaces do not break.
    const day = formatFor('en').day(Date.UTC(2026, 9, 13)).replace(/ /g, ' ');
    expect(lines.map((line) => line.textContent)).toEqual([`1Otra_RataSoftware engineer · ${day}900▸`, `2Rat BBBBNurse · ${day}800▸`]);
    expect(lines.map((line) => line.getAttribute('aria-selected'))).toEqual(['false', 'false']);
    // The player is ninth, past the lines the ranking lists: their own line stands at the foot of the page, lit as theirs (the web's `aria-current`).
    const [mine] = await linesOf('Your place');
    expect(mine.textContent).toBe(`9YouNurse · ${day}120▸`);
    expect(mine.getAttribute('aria-selected')).toBe('true');
    // Each line opens the life behind it, in a sheet.
    expect(within(lines[0]).getByRole('button')).toBeTruthy();
    expect(asked).toEqual(['ranking week everyone any']);
  });

  it('lists the player\'s own line among the others where it follows them, and pins nothing', async () => {
    const { community: c, state } = community();
    state.board = () => [row(1, 'aaaa1111-0000'), row(2, 'me', { mine: true }), row(3, 'bbbb2222-0000')];
    show(c);
    const lines = await linesOf('Global');
    expect(lines.map((line) => line.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(rankingOf('Your place')).toBeNull();
  });

  it('has three rankings, everyone\'s and the friends\' of this week or of all time, and the week\'s challenge', async () => {
    const { community: c, asked } = community();
    show(c);
    await linesOf('Global');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Global', 'Friends', 'Weekly challenge']);
    expect(screen.getByRole('tablist', { name: 'Which ranking' })).toBeTruthy();
    // This week first, and what it counts said for the week.
    const period = screen.getByRole('radiogroup', { name: 'Which period' });
    expect(within(period).getAllByRole('radio').map((one) => [one.textContent, one.getAttribute('aria-checked')])).toEqual([['This week', 'true'], ['All time', 'false']]);
    expect(screen.getByText("Each player's best ranked life this week. Only lives played on the server count.")).toBeTruthy();
    fireEvent.click(within(period).getByRole('radio', { name: 'All time' }));
    await waitFor(() => expect(asked).toContain('ranking all everyone any'));
    expect(screen.getByText('The best ranked life of each player. Only lives played on the server count.')).toBeTruthy();
    // The period chosen stays chosen among friends.
    fireEvent.click(screen.getByRole('tab', { name: 'Friends' }));
    await linesOf('Friends');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Which period' })).getByRole('radio', { name: 'This week' }));
    await waitFor(() => expect(asked).toContain('ranking week friends any'));
    expect(asked).toEqual(['ranking week everyone any', 'ranking all everyone any', 'ranking all friends any', 'ranking week friends any']);
    expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true');
    // The week's challenge has no period of its own.
    fireEvent.click(screen.getByRole('tab', { name: 'Weekly challenge' }));
    await screen.findByText("Nobody has finished this week's challenge yet.");
    expect(screen.queryByRole('radiogroup', { name: 'Which period' })).toBeNull();
  });

  it('opens on the ranking a link names: among friends (a friend request\'s notice), the week\'s challenge, and the tabs of before', async () => {
    const { community: c, asked } = community();
    show(c, 'en', { tab: 'friends' });
    await linesOf('Friends');
    expect(asked).toEqual(['ranking week friends any']);
    // No way off the page to the friends: they are answered and asked for here.
    expect(screen.queryByRole('button', { name: /their requests/ })).toBeNull();
    cleanup();
    const other = community();
    show(other.community, 'en', { tab: 'challenge' });
    expect(await screen.findByText("Nobody has finished this week's challenge yet.")).toBeTruthy();
    expect(other.asked).toEqual([]);
    // `?tab=week` and `?tab=all`, the tabs the global ranking was before: everyone's, of that period.
    for (const [tab, period] of [['week', 'This week'], ['all', 'All time']] as const) {
      cleanup();
      const before = community();
      show(before.community, 'en', { tab });
      await linesOf('Global');
      expect(screen.getByRole('tab', { name: 'Global' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('radio', { name: period }).getAttribute('aria-checked')).toBe('true');
      expect(before.asked).toEqual([`ranking ${tab} everyone any`]);
    }
  });

  it('narrows a ranking to one starting life, and widens it again', async () => {
    const { community: c, asked } = community();
    show(c);
    await linesOf('Global');
    // The game's own picker: a button that says what is chosen, and a list in a sheet.
    fireEvent.click(screen.getByRole('button', { name: 'Starting life: Any life' }));
    const list = within(sheetOf('Starting life')).getByRole('radiogroup', { name: 'Starting life' });
    const options = within(list).getAllByRole('radio');
    expect(options.map((option) => option.textContent?.replace('✓', '')).slice(0, 3)).toEqual(['Any life', 'Nurse', 'Software engineer']);
    expect(options[0].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(list).getByRole('radio', { name: 'Nurse' }));
    await waitFor(() => expect(asked).toContain('ranking week everyone nurse'));
    // The life chosen stays chosen from one ranking to the next.
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    await waitFor(() => expect(asked).toContain('ranking all everyone nurse'));
    fireEvent.click(screen.getByRole('button', { name: 'Starting life: Nurse' }));
    fireEvent.click(within(within(sheetOf('Starting life')).getByRole('radiogroup', { name: 'Starting life' })).getByRole('radio', { name: /^Any life/ }));
    await waitFor(() => expect(asked[asked.length - 1]).toBe('ranking all everyone any'));
  });

  it('shows a ranking only for what was asked last, whichever answer comes last', async () => {
    const waiting: Array<{ query: RankingQuery; answer(rows: RankingRow[]): void }> = [];
    const { community: c } = community({ ranking: (query) => new Promise((answer) => waiting.push({ query, answer })) });
    show(c);
    await waitFor(() => expect(waiting).toHaveLength(1));
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    await waitFor(() => expect(waiting).toHaveLength(2));
    // All time answers first, and the week after it: all time is what the player is looking at.
    await act(async () => waiting[1].answer([row(1, 'allt0000-0000')]));
    await linesOf('Global');
    await act(async () => waiting[0].answer([row(1, 'week0000-0000'), row(2, 'week1111-0000')]));
    await settled();
    expect((await linesOf('Global')).map((line) => line.textContent)).toEqual([`1Rat ALLTNurse · ${formatFor('en').day(Date.UTC(2026, 9, 13)).replace(/ /g, ' ')}900▸`]);
  });

  it('is read again when pulled down: the ranking on screen asked anew, kept until the new one comes, the spinner turning until it has', async () => {
    // The answer to the second asking waits until the test lets it come.
    let held: Promise<void> | null = null;
    let letCome = () => {};
    const { community: base, asked, state } = community();
    const withFriends: Community = {
      ...base,
      ranking: async (query) => {
        const answer = await base.ranking(query);
        if (held) await held;
        return answer;
      },
    };
    show(withFriends);
    await screen.findByText('Otra_Rata');
    /** The phone's pull of the page's list, as the list was last given it. */
    const pull = () => listed.at(-1)!.refreshControl as ReactElement<{ refreshing: boolean; onRefresh(): void }>;
    held = new Promise((done) => (letCome = done));
    state.board = () => [row(1, 'cccc3333-0000', { nickname: 'Nueva_Rata' })];
    act(() => pull().props.onRefresh());
    await waitFor(() => expect(pull().props.refreshing).toBe(true));
    // What was on screen stays while it is read again.
    expect(screen.getByText('Otra_Rata')).toBeTruthy();
    act(() => letCome());
    await screen.findByText('Nueva_Rata');
    await waitFor(() => expect(pull().props.refreshing).toBe(false));
    expect(asked.filter((one) => one.startsWith('ranking'))).toEqual(['ranking week everyone any', 'ranking week everyone any']);
  });

  it('reads the ranking among friends again, and the week\'s challenge on its own, when pulled down on their tabs', async () => {
    let boards = 0;
    const { community: withFriends, asked } = community({ challengeRanking: async () => ((boards += 1), { rows: [], entrants: 0 }) });
    show(withFriends, 'en', { tab: 'friends' });
    await linesOf('Friends');
    const pull = () => listed.at(-1)!.refreshControl as ReactElement<{ refreshing: boolean; onRefresh(): void }>;
    act(() => pull().props.onRefresh());
    await waitFor(() => expect(asked.filter((one) => one === 'ranking week friends any')).toHaveLength(2));
    fireEvent.click(screen.getByRole('tab', { name: 'Weekly challenge' }));
    await waitFor(() => expect(boards).toBe(1));
    act(() => pull().props.onRefresh());
    await waitFor(() => expect(boards).toBe(2));
    await waitFor(() => expect(pull().props.refreshing).toBe(false));
  });

  it('cannot be pulled down with nobody to ask', async () => {
    show(null);
    await screen.findByText(/account/i);
    expect(listed.at(-1)!.refreshControl).toBeUndefined();
  });

  it('says so when nobody is in a ranking yet, and when it could not be read', async () => {
    const empty = community();
    empty.state.board = () => [];
    show(empty.community);
    expect(await screen.findByText('Nobody has finished a ranked life here yet. Yours could be the first.')).toBeTruthy();
    expect(anyLines()).toEqual([]);
    expect(rankingOf('Global')).toBeNull();
    cleanup();
    const away = community();
    away.state.board = () => null;
    show(away.community, 'es');
    const said = await screen.findByText('No se han podido leer los rankings. Inténtalo más tarde.');
    expect(said.closest('[role="status"]')).not.toBeNull();
  });

  it('says it is reading a ranking while it is on its way', async () => {
    show(community({ ranking: () => new Promise(() => {}) }).community);
    expect(await screen.findByText('Loading…')).toBeTruthy();
    expect(screen.getByText("Each player's best ranked life this week. Only lives played on the server count.")).toBeTruthy();
  });

  it('shows nothing of one ranking under the name of another while that other is on its way', async () => {
    const { community: c } = community({ ranking: (query) => (query.period === 'week' ? Promise.resolve([row(1, 'aaaa1111-0000')]) : new Promise(() => {})) });
    show(c);
    await linesOf('Global');
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    // All time has not answered: what is on screen is that it is being read, not the lines of the week.
    expect(anyLines()).toEqual([]);
    expect(rankingOf('Global')).toBeNull();
    expect(screen.getByText('Loading…')).toBeTruthy();
    // Back where the answer is known, it is there at once.
    fireEvent.click(screen.getByRole('radio', { name: 'This week' }));
    expect(rankingOf('Global')).not.toBeNull();
    expect(await linesOf('Global')).toHaveLength(1);
  });

  it('keeps the ranking on screen while it is read again', async () => {
    let asks = 0;
    const { community: c } = community({ ranking: () => ((asks += 1) === 1 ? Promise.resolve([row(1, 'aaaa1111-0000')]) : new Promise(() => {})) });
    show(c);
    await linesOf('Global');
    // Pulled down, it is read again.
    pullDown();
    await waitFor(() => expect(asks).toBe(2));
    // The second answer never comes here: the first is still what is shown.
    expect(await linesOf('Global')).toHaveLength(1);
  });

  it('opens the life behind a line: how it ended, what it was worth, where it was lived and what it earned', async () => {
    const detail: RankedLifeDetail = { netWorth: 123_456_00, status: 41, escapedAtRound: 9, bankruptcies: 1, badges: ['first_share'], cities: ['madrid', 'london'], history: [100_000, 400_000, 900_000], finishedAt: Date.UTC(2026, 9, 13) };
    const asked: unknown[] = [];
    const { community: c } = community({ run: async (line) => (asked.push(line), detail) });
    show(c);
    const [first] = await linesOf('Global');
    fireEvent.click(within(first).getByRole('button'));
    const sheet = sheetOf('Otra_Rata');
    expect(asked).toEqual([expect.objectContaining({ userId: 'aaaa1111-0000', lifeId: 'engineer', score: 900 })]);
    expect(await within(sheet).findByText('$123,456')).toBeTruthy();
    expect(within(sheet).getByText('At 40')).toBeTruthy();
    expect(within(sheet).getByText('Madrid')).toBeTruthy();
    expect(within(sheet).getByText('London')).toBeTruthy();
    expect(within(sheet).getByText(`Place 1 · ${formatFor('en').day(Date.UTC(2026, 9, 13))}`)).toBeTruthy();
    const badges = within(sheet).getByRole('list', { name: 'Badges of this life' });
    // A badge's name is a tap away (the web shows it on hover, or a tap where there is none), and a second tap hides it.
    const badge = within(badges).getByRole('button', { name: textFor('en').text.badges.first_share.name });
    fireEvent.click(badge);
    expect(within(sheet).getByRole('status').textContent).toContain(textFor('en').text.badges.first_share.name);
    fireEvent.click(badge);
    expect(within(sheet).queryByRole('status')).toBeNull();
    expect(within(sheet).getByRole('img', { name: /net worth/i })).toBeTruthy();
  });

  it('asks for the life behind a line each time its sheet is opened, and closes it with its own button', async () => {
    let asks = 0;
    const { community: c } = community({ run: async () => ((asks += 1), null) });
    show(c);
    const [first] = await linesOf('Global');
    fireEvent.click(within(first).getByRole('button'));
    await within(sheetOf('Otra_Rata')).findByText('This life could not be read.');
    fireEvent.click(within(sheetOf('Otra_Rata')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Otra_Rata' })).toBeNull());
    fireEvent.click(within((await linesOf('Global'))[0]).getByRole('button'));
    await within(sheetOf('Otra_Rata')).findByText('This life could not be read.');
    expect(asks).toBe(2);
  });

  it('says so when the life behind a line cannot be read', async () => {
    const { community: c } = community({ run: async () => null });
    show(c);
    const [first] = await linesOf('Global');
    fireEvent.click(within(first).getByRole('button'));
    expect(await within(sheetOf('Otra_Rata')).findByText('This life could not be read.')).toBeTruthy();
  });
});

describe('the ranking of the weekly challenge', () => {
  const week = challengeOf(weekOf(Date.now()), lives);
  if (!week) throw new Error('no challenge this week');
  const entry = (place: number, over: Partial<ChallengeRow> = {}): ChallengeRow => ({ place, userId: `user-${place}`, nickname: `Rata_${place}`, score: 2000 - place * 10, finishedAt: Date.UTC(2026, 9, 13), mine: false, ...over });

  it('shows the week’s life and rule, each player\'s best attempt best first, the best tenth marked, and how many players took part', async () => {
    const asked: string[] = [];
    const { community: everyone } = community({
      challengeRanking: async (asking) => {
        asked.push(asking);
        return { rows: [entry(1), entry(2), entry(3, { mine: true, nickname: null })], entrants: 20 };
      },
    });
    show(everyone);
    fireEvent.click(await screen.findByRole('tab', { name: 'Weekly challenge' }));
    const lines = await linesOf("This week's challenge");
    expect(asked).toEqual([week.week]);
    expect(screen.getByText(textFor('en').text.lives[week.lifeId].name)).toBeTruthy();
    expect(screen.getByText('20 players · the best 2 are in the top 10%')).toBeTruthy();
    expect(lines.map((line) => line.textContent)).toEqual([
      expect.stringContaining('Rata_1'),
      expect.stringContaining('Rata_2'),
      expect.stringContaining('Unnamed player'),
    ]);
    expect(lines.map((line) => within(line).queryByText('Top 10%') !== null)).toEqual([true, true, false]);
    expect(lines.map((line) => line.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    // The friends' panel belongs to the friends' ranking alone.
    expect(screen.queryByText('YOUR FRIENDS')).toBeNull();
  });

  it('says so when nobody has finished it yet, and when it cannot be read', async () => {
    show(community({ challengeRanking: async () => ({ rows: [], entrants: 0 }) }).community);
    fireEvent.click(await screen.findByRole('tab', { name: /challenge/ }));
    expect(await screen.findByText("Nobody has finished this week's challenge yet.")).toBeTruthy();
    cleanup();
    show(community({ challengeRanking: async () => null }).community);
    fireEvent.click(await screen.findByRole('tab', { name: /challenge/ }));
    expect(await screen.findByText('The ranking of the challenge cannot be read just now.')).toBeTruthy();
  });
});

describe('what the rankings are drawn again for', () => {
  it('draws a line once: switching to another ranking with the same line draws it no more, and only the lines that differ are drawn anew', async () => {
    const { community: c, state } = community();
    const same = (query: RankingQuery): RankingRow[] => [
      row(1, 'aaaa1111-0000', { nickname: 'Otra_Rata', lifeId: 'engineer' }),
      // Only the week's second line differs: another life, another score.
      query.period === 'week' ? row(2, 'bbbb2222-0000', { lifeId: 'heir', score: 640 }) : row(2, 'bbbb2222-0000', { lifeId: 'civil_servant' }),
    ];
    state.board = same;
    show(c);
    await linesOf('Global');
    fireEvent.click(screen.getByRole('radio', { name: 'This week' }));
    await linesOf('Global');
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    await linesOf('Global');
    await settled();
    // Each answer known, a ranking switched to is drawn from it at once: the line that is the same in both is the same line, not drawn again.
    const engineer = spriteRenders.get('portrait.engineer.22');
    const civil = spriteRenders.get('portrait.civil_servant.22');
    fireEvent.click(screen.getByRole('radio', { name: 'This week' }));
    await linesOf('Global');
    await settled();
    expect(spriteRenders.get('portrait.engineer.22')).toBe(engineer);
    expect(spriteRenders.get('portrait.heir.22')).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    await settled();
    expect(spriteRenders.get('portrait.engineer.22')).toBe(engineer);
    expect(spriteRenders.get('portrait.civil_servant.22')).toBeGreaterThan(civil ?? 0);
  });

  it('draws no line again for an answer that says what is on screen already: each line is drawn from what it shows', async () => {
    let asks = 0;
    const { community: c } = community({ ranking: async () => ((asks += 1), [row(1, 'aaaa1111-0000', { nickname: 'Otra_Rata' })]) });
    show(c);
    await linesOf('Global');
    await settled();
    const portraits = spriteRenders.get('portrait.nurse.22');
    // Pulled down: the ranking is read again, and answers the same lines.
    pullDown();
    await waitFor(() => expect(asks).toBe(2));
    await settled();
    expect(spriteRenders.get('portrait.nurse.22')).toBe(portraits);
  });

  it('is not drawn again by a change of the game it does not show: a life begun, the news left, a card answered', async () => {
    const { community: c } = community();
    const services = { ...memoryServices(), community: () => c };
    const renders: Renders = { count: 0 };
    const probe: { state: (RoundState & RoundActions) | null } = { state: null };
    function Probe() {
      probe.state = useGame((s) => s);
      return null;
    }
    renderGame(
      <>
        <Probe />
        <Counted into={renders}>
          <Rankings />
        </Counted>
      </>,
      services,
    );
    await linesOf('Global');
    await settled(() => probe.state?.start('nurse'));
    await settled(() => probe.state?.leaveNews());
    const before = renders.count;
    await settled(() => probe.state?.pick(0));
    await settled(() => probe.state?.afterCard());
    expect(probe.state?.view?.answered).toBe(1);
    expect(renders.count).toBe(before);
  });
});



describe('the rankings, followed and kept up to date', () => {
  it('opens on the ranking a link names when it is followed with the page open (a notice tapped)', async () => {
    const { community: c, asked } = community();
    renderGame(<Followed />, { ...memoryServices(), community: () => c });
    await linesOf('Global');
    act(() => followed.to?.('friends'));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true'));
    await waitFor(() => expect(asked).toContain('ranking week friends any'));
  });
});

describe('the friends among the rankings', () => {
  const friend = (userId: string, nickname: string | null = null): Friend => ({ userId, nickname, avatar: null });

  it('says how many requests wait in the tab\'s name, and answers them in a sheet from a line at the top of the ranking among friends', async () => {
    const { community: c, asked, state } = community();
    state.friends = { friends: [friend('dddd4444-0000', 'Amiga'), friend('eeee5555-0000', 'Amigo')], incoming: [friend('aaaa1111-0000', 'Otra_Rata'), friend('cccc3333-0000')], outgoing: [] };
    show(c);
    await linesOf('Global');
    const tab = await screen.findByRole('tab', { name: 'Friends · 2' });
    // The line of the requests is the friends' ranking's alone.
    expect(screen.queryByRole('button', { name: /friend requests/ })).toBeNull();
    fireEvent.click(tab);
    await linesOf('Friends');
    fireEvent.click(screen.getByRole('button', { name: '2 friend requests' }));
    const sheet = sheetOf('Friend requests');
    expect(within(sheet).getByText('Otra_Rata')).toBeTruthy();
    expect(within(sheet).getByText('Rat CCCC')).toBeTruthy();
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'Accept' })[0]);
    await waitFor(() => expect(asked).toContain('answer aaaa1111-0000 yes'));
    // A friend made: the ranking among friends is asked again, and one request is left.
    await waitFor(() => expect(asked.filter((one) => one === 'ranking week friends any')).toHaveLength(2));
    await screen.findByRole('tab', { name: 'Friends · 1' });
    expect(within(sheetOf('Friend requests')).queryByText('Otra_Rata')).toBeNull();
    fireEvent.click(within(sheetOf('Friend requests')).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(asked).toContain('answer cccc3333-0000 no'));
    // None left: the sheet goes, the line with it, and the tab is the friends' again.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Friend requests' })).toBeNull());
    expect(await screen.findByRole('tab', { name: 'Friends' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /friend request/ })).toBeNull();
  });

  it('asks a player with one friend or none to add some, with their friend code and its QR code in a sheet', async () => {
    const { community: c, state } = community();
    state.friends = { friends: [friend('dddd4444-0000', 'Amiga')], incoming: [], outgoing: [] };
    show(c, 'en', { tab: 'friends' });
    await linesOf('Friends');
    expect(await screen.findByText('Compare your lives with your friends.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add friends' }));
    const sheet = sheetOf('Add friends');
    expect(within(sheet).getByText('ABCD2345')).toBeTruthy();
    expect(within(sheet).getByRole('textbox', { name: 'Friend code' })).toBeTruthy();
    // Not among everyone.
    cleanup();
    show(community().community);
    await linesOf('Global');
    await settled();
    expect(screen.queryByText('Compare your lives with your friends.')).toBeNull();
  });

  it('asks nothing of a player with two friends or more', async () => {
    const { community: c, state } = community();
    state.friends = { friends: [friend('dddd4444-0000', 'Amiga'), friend('eeee5555-0000', 'Amigo')], incoming: [], outgoing: [] };
    show(c, 'en', { tab: 'friends' });
    await linesOf('Friends');
    await settled();
    expect(screen.queryByText('Compare your lives with your friends.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add friends' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Friends' })).toBeTruthy();
  });
});
