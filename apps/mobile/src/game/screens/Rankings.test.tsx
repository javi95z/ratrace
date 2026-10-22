// @vitest-environment jsdom
import { challengeOf, lives, textFor, weekOf } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import type { ChallengeRow, Community, Friend, RankedLifeDetail, RankingQuery, RankingRow } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clipboard } from '../../testing/fakes';
import { memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { useGame } from '../context';
import { Rankings } from './Rankings';

afterEach(cleanup);

// Every row of a list is drawn here (a list on a phone draws only those near the screen): the lines are all there to be read.
vi.mock('react-native', async (original) => {
  const native = await original<typeof import('react-native')>();
  const { everyRow } = await import('../../testing/fakes');
  return { ...native, FlatList: everyRow(native.FlatList as never) };
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
/** Types into a field, as the keyboard does: the whole of what it then holds. */
const type = (field: HTMLElement, text: string) => fireEvent.change(field, { target: { value: text } });

describe('the rankings', () => {
  it('says what they need where there is no account to ask', async () => {
    show(null);
    expect(await screen.findByText('The rankings need an account and a connection.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('lists the best ranked life of each player, the highest first, and marks the player\'s own line', async () => {
    const { community: c, asked } = community();
    show(c);
    const lines = await linesOf('All time');
    // Each line: the place, the name, the starting life and the day it ended, and the score.
    const day = formatFor('en').day(Date.UTC(2026, 9, 13));
    expect(lines.map((line) => line.textContent)).toEqual([`1Otra_RataSoftware engineer · ${day}900▸`, `2Rat BBBBNurse · ${day}800▸`, `9Rat MENurse · ${day}120▸`]);
    // The player's own line is the one they are on, as the web's `aria-current` says.
    expect(lines.map((line) => line.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    // Each line opens the life behind it, in a sheet.
    expect(within(lines[0]).getByRole('button')).toBeTruthy();
    expect(asked).toEqual(['ranking all everyone any']);
  });

  it('shows the ranking of the week, and the one among friends, when asked', async () => {
    const { community: c, asked } = community();
    show(c);
    await linesOf('All time');
    fireEvent.click(screen.getByRole('tab', { name: 'This week' }));
    await linesOf('This week');
    fireEvent.click(screen.getByRole('tab', { name: 'Friends' }));
    await linesOf('Friends');
    expect(asked).toEqual(['ranking all everyone any', 'ranking week everyone any', 'ranking all friends any']);
    expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['All time', 'This week', 'Friends', "This week's challenge"]);
    expect(screen.getByRole('tablist', { name: 'Which ranking' })).toBeTruthy();
  });

  it('opens on the ranking a link names: among friends (a friend request\'s notice), or the week\'s challenge', async () => {
    const { community: c, asked } = community();
    show(c, 'en', { tab: 'friends' });
    await linesOf('Friends');
    expect(asked).toEqual(['ranking all friends any']);
    expect(await screen.findByRole('region', { name: 'Your friends' })).toBeTruthy();
    cleanup();
    const other = community();
    show(other.community, 'en', { tab: 'challenge' });
    expect(await screen.findByText("Nobody has finished this week's challenge yet.")).toBeTruthy();
    expect(other.asked).toEqual([]);
  });

  it('narrows a ranking to one starting life, and widens it again', async () => {
    const { community: c, asked } = community();
    show(c);
    await linesOf('All time');
    // The game's own picker: a button that says what is chosen, and a list in a sheet.
    fireEvent.click(screen.getByRole('button', { name: 'Starting life: Any life' }));
    const list = within(sheetOf('Starting life')).getByRole('radiogroup', { name: 'Starting life' });
    const options = within(list).getAllByRole('radio');
    expect(options.map((option) => option.textContent?.replace('✓', '')).slice(0, 3)).toEqual(['Any life', 'Nurse', 'Software engineer']);
    expect(options[0].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(list).getByRole('radio', { name: 'Nurse' }));
    await waitFor(() => expect(asked).toContain('ranking all everyone nurse'));
    // The life chosen stays chosen from one ranking to the next.
    fireEvent.click(screen.getByRole('tab', { name: 'This week' }));
    await waitFor(() => expect(asked).toContain('ranking week everyone nurse'));
    fireEvent.click(screen.getByRole('button', { name: 'Starting life: Nurse' }));
    fireEvent.click(within(within(sheetOf('Starting life')).getByRole('radiogroup', { name: 'Starting life' })).getByRole('radio', { name: /^Any life/ }));
    await waitFor(() => expect(asked[asked.length - 1]).toBe('ranking week everyone any'));
  });

  it('shows a ranking only for what was asked last, whichever answer comes last', async () => {
    const waiting: Array<{ query: RankingQuery; answer(rows: RankingRow[]): void }> = [];
    const { community: c } = community({ ranking: (query) => new Promise((answer) => waiting.push({ query, answer })) });
    show(c);
    await waitFor(() => expect(waiting).toHaveLength(1));
    fireEvent.click(screen.getByRole('tab', { name: 'This week' }));
    await waitFor(() => expect(waiting).toHaveLength(2));
    // The week answers first, and all time after it: the week is what the player is looking at.
    await act(async () => waiting[1].answer([row(1, 'week0000-0000')]));
    await linesOf('This week');
    await act(async () => waiting[0].answer([row(1, 'allt0000-0000'), row(2, 'allt1111-0000')]));
    await settled();
    expect((await linesOf('This week')).map((line) => line.textContent)).toEqual([`1Rat WEEKNurse · ${formatFor('en').day(Date.UTC(2026, 9, 13))}900▸`]);
  });

  it('says so when nobody is in a ranking yet, and when it could not be read', async () => {
    const empty = community();
    empty.state.board = () => [];
    show(empty.community);
    expect(await screen.findByText('Nobody has finished a ranked life here yet. Yours could be the first.')).toBeTruthy();
    expect(anyLines()).toEqual([]);
    expect(rankingOf('All time')).toBeNull();
    cleanup();
    const away = community();
    away.state.board = () => null;
    show(away.community, 'es');
    const said = await screen.findByText('No se han podido leer las clasificaciones. Inténtalo más tarde.');
    expect(said.closest('[role="status"]')).not.toBeNull();
  });

  it('says it is reading a ranking while it is on its way', async () => {
    show(community({ ranking: () => new Promise(() => {}) }).community);
    expect(await screen.findByText('Loading…')).toBeTruthy();
    expect(screen.getByText('The best ranked life of each player. Only lives played on the server count.')).toBeTruthy();
  });

  it('lets the player choose the name they appear under, and checks how it is written before it asks', async () => {
    const { community: c, asked } = community();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    // Until one is chosen, the name the rankings give: Rat, and four characters.
    await waitFor(() => expect(you.textContent).toMatch(/Rat /));
    fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
    const field = within(you).getByRole('textbox', { name: 'Name' });
    type(field, 'a b');
    fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
    expect(within(you).getByRole('alert').textContent).toBe('3 to 16 letters, digits or underscores.');
    expect(asked.filter((line) => line.startsWith('rename'))).toEqual([]);
    type(field, 'Rata_Uno');
    fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(you.textContent).toContain('Rata_Uno'));
    expect(asked).toContain('rename Rata_Uno');
    expect(within(you).queryByRole('textbox')).toBeNull();
    // The rankings are read again: the player's line now carries the name.
    await waitFor(() => expect(asked.filter((line) => line.startsWith('ranking'))).toHaveLength(2));
  });

  it('sends the name from the keyboard too, as the web\'s form is sent by Enter', async () => {
    const { community: c, asked } = community();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    await waitFor(() => expect(within(you).getByRole('button', { name: 'Change it' })).toBeTruthy());
    fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
    const field = within(you).getByRole('textbox', { name: 'Name' });
    type(field, 'Rata_Dos');
    fireEvent.keyDown(field, { key: 'Enter', code: 'Enter', keyCode: 13 });
    await waitFor(() => expect(asked).toContain('rename Rata_Dos'));
  });

  it('shows nothing of one ranking under the name of another while that other is on its way', async () => {
    const { community: c } = community({ ranking: (query) => (query.period === 'all' ? Promise.resolve([row(1, 'aaaa1111-0000')]) : new Promise(() => {})) });
    show(c);
    await linesOf('All time');
    fireEvent.click(screen.getByRole('tab', { name: 'This week' }));
    // The week has not answered: what is on screen is that it is being read, not the lines of all time.
    expect(anyLines()).toEqual([]);
    expect(rankingOf('All time')).toBeNull();
    expect(rankingOf('This week')).toBeNull();
    expect(screen.getByText('Loading…')).toBeTruthy();
    // Back where the answer is known, it is there at once.
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(rankingOf('All time')).not.toBeNull();
    expect(await linesOf('All time')).toHaveLength(1);
  });

  it('keeps the ranking on screen while it is read again', async () => {
    let asks = 0;
    const { community: c } = community({ ranking: () => ((asks += 1) === 1 ? Promise.resolve([row(1, 'aaaa1111-0000')]) : new Promise(() => {})) });
    show(c);
    await linesOf('All time');
    const you = screen.getByRole('region', { name: 'You' });
    await waitFor(() => expect(within(you).getByRole('button', { name: 'Change it' })).toBeTruthy());
    fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
    type(within(you).getByRole('textbox', { name: 'Name' }), 'Rata_Uno');
    fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(asks).toBe(2));
    // The second answer never comes here: the first is still what is shown.
    expect(await linesOf('All time')).toHaveLength(1);
  });

  it('lets a name that is already chosen be changed, starting from it, and lets the player think better of it', async () => {
    const { community: c, asked, state } = community();
    state.me = { nickname: 'Rata_Uno', friendCode: 'ABCD2345', avatar: null };
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    await waitFor(() => expect(you.textContent).toContain('Rata_Uno'));
    fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
    expect((within(you).getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Rata_Uno');
    type(within(you).getByRole('textbox', { name: 'Name' }), 'Rata_Uno!');
    fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
    expect(within(you).getByRole('alert')).toBeTruthy();
    fireEvent.click(within(you).getByRole('button', { name: 'Cancel' }));
    expect(within(you).queryByRole('textbox')).toBeNull();
    expect(within(you).queryByRole('alert')).toBeNull();
    expect(asked.filter((line) => line.startsWith('rename'))).toEqual([]);
    // Opened again, the form says nothing of the last try.
    fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
    expect(within(you).queryByRole('alert')).toBeNull();
  });

  it('says nothing of a name where the player\'s own could not be read', async () => {
    const { community: c } = community({ me: async () => null });
    show(c);
    await linesOf('All time');
    expect(screen.queryByRole('region', { name: 'You' })).toBeNull();
  });

  it('takes a name of three to sixteen characters, without the spaces typed around it', async () => {
    const { community: c, asked } = community();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    await waitFor(() => expect(within(you).getByRole('button', { name: 'Change it' })).toBeTruthy());
    fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
    const field = within(you).getByRole('textbox', { name: 'Name' });
    type(field, 'ab');
    fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
    expect(within(you).getByRole('alert').textContent).toBe('3 to 16 letters, digits or underscores.');
    // The field takes no more than a name can hold, pasted too.
    type(field, 'abcdefghijklmnopq');
    expect((field as HTMLInputElement).value).toBe('abcdefghijklmnop');
    type(field, ' abc ');
    fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(you.textContent).toContain('abc'));
    expect(asked.filter((line) => line.startsWith('rename'))).toEqual(['rename abc']);
  });

  it('says why a name was not taken', async () => {
    for (const [answer, said] of [['taken', 'Someone already has that name.'], ['refused', 'That name is not accepted.'], ['failed', 'The name could not be saved. Try again.']] as const) {
      const { community: c } = community({ rename: async () => answer });
      show(c);
      const you = await screen.findByRole('region', { name: 'You' });
      await waitFor(() => expect(within(you).getByRole('button', { name: 'Change it' })).toBeTruthy());
      fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
      type(within(you).getByRole('textbox', { name: 'Name' }), 'Rata_Uno');
      fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
      expect((await within(you).findByRole('alert')).textContent, answer).toBe(said);
      cleanup();
    }
  });

  it('shows the player their friend code, and copies it for them when it is pressed', async () => {
    const { community: c } = community();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    await waitFor(() => expect(you.textContent).toContain('Your friend code: ABCD2345'));
    // The web's code is selected whole by a tap; a phone selects nothing in a line of text, so the code copies itself, and says so.
    fireEvent.click(within(you).getByRole('button', { name: 'Your friend code: ABCD2345' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Code copied');
    expect(clipboard.text).toBe('ABCD2345');
  });

  it('says nothing where the clipboard does not take the code: it is on screen to be read', async () => {
    clipboard.refuses = true;
    const { community: c } = community();
    show(c);
    const you = await screen.findByRole('region', { name: 'You' });
    await waitFor(() => expect(within(you).getByRole('button', { name: 'Your friend code: ABCD2345' })).toBeTruthy());
    fireEvent.click(within(you).getByRole('button', { name: 'Your friend code: ABCD2345' }));
    await settled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks another player to be friends by their code', async () => {
    const { community: c, asked } = community();
    show(c);
    expect((await screen.findByRole('region', { name: 'You' })).textContent).toBeDefined();
    // The friends belong with the ranking they decide, and are not shown beside the others.
    expect(screen.queryByRole('region', { name: 'Your friends' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    await waitFor(() => expect(friends.textContent).toContain('No friends yet.'));
    type(within(friends).getByRole('textbox', { name: 'Friend code' }), 'wxyz6789');
    // A code is written in capitals, as the web shows it.
    expect((within(friends).getByRole('textbox', { name: 'Friend code' }) as HTMLInputElement).value).toBe('WXYZ6789');
    fireEvent.click(within(friends).getByRole('button', { name: 'Send request' }));
    expect((await within(friends).findByRole('status')).textContent).toBe('Request sent. Once they accept, you are friends.');
    expect(asked).toContain('befriend WXYZ6789');
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
    show(c);
    fireEvent.click(await screen.findByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    const requests = await within(friends).findByRole('region', { name: 'Friend requests' });
    expect(requests.textContent).toContain('Rat DDDD');
    fireEvent.click(within(requests).getAllByRole('button', { name: 'Accept' })[0]);
    expect((await within(friends).findByRole('status')).textContent).toBe('You are friends now!');
    expect(asked).toContain('answer bbbb2222-0000 yes');
    await waitFor(() => expect(within(friends).getAllByRole('button', { name: 'Decline' })).toHaveLength(1));
    fireEvent.click(within(friends).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(within(friends).queryByRole('region', { name: 'Friend requests' })).toBeNull());
    expect(asked).toContain('answer dddd4444-0000 no');
    // A friend is a line to tap, with nothing on it that ends the friendship.
    const friend = await within(within(friends).getByRole('list')).findByRole('button', { name: /Tercera/ });
    expect(within(friends).queryByRole('button', { name: /Remove|Stop/ })).toBeNull();
    fireEvent.click(friend);
    const sheet = sheetOf('Tercera');
    expect(sheet.textContent).toContain("You will no longer see each other's lives among friends.");
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove friend' }));
    await waitFor(() => expect(friends.textContent).toContain('No friends yet.'));
    expect(asked).toContain('unfriend bbbb2222-0000');
    // Each change of the friends reads the friends' ranking again.
    expect(asked.filter((line) => line === 'ranking all friends any').length).toBeGreaterThanOrEqual(4);
  });

  it('takes back a request the player sent from its sheet', async () => {
    const { community: c, asked, state } = community();
    state.friends.outgoing = [{ userId: 'eeee5555-0000', nickname: 'Cuarta', avatar: null }];
    show(c, 'en', { tab: 'friends' });
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    const sent = await within(friends).findByRole('region', { name: 'Requests sent' });
    fireEvent.click(within(sent).getByRole('button', { name: /Cuarta/ }));
    const sheet = sheetOf('Cuarta');
    expect(sheet.textContent).toContain('Waiting');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(within(friends).queryByRole('region', { name: 'Requests sent' })).toBeNull());
    expect(asked).toContain('unfriend eeee5555-0000');
  });

  it('asks nobody for an empty code, and trims a pasted one', async () => {
    const { community: c, asked } = community();
    show(c);
    fireEvent.click(await screen.findByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    type(within(friends).getByRole('textbox', { name: 'Friend code' }), '   ');
    fireEvent.click(within(friends).getByRole('button', { name: 'Send request' }));
    await settled();
    expect(asked.filter((line) => line.startsWith('befriend'))).toEqual([]);
    type(within(friends).getByRole('textbox', { name: 'Friend code' }), ' wxyz6789 ');
    fireEvent.click(within(friends).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(asked).toContain('befriend WXYZ6789'));
  });

  it('says nothing of friends that could not be read, and still asks by code', async () => {
    const { community: c, asked } = community({ friends: async () => null });
    show(c);
    fireEvent.click(await screen.findByRole('tab', { name: 'Friends' }));
    const friends = await screen.findByRole('region', { name: 'Your friends' });
    await waitFor(() => expect(asked).toContain('ranking all friends any'));
    await settled();
    expect(within(friends).queryByRole('alert')).toBeNull();
    expect(friends.textContent).not.toContain('No friends yet.');
    expect(within(friends).getByRole('button', { name: 'Send request' })).toBeTruthy();
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
      show(c);
      fireEvent.click(await screen.findByRole('tab', { name: 'Friends' }));
      const friends = await screen.findByRole('region', { name: 'Your friends' });
      type(within(friends).getByRole('textbox', { name: 'Friend code' }), 'wxyz6789');
      fireEvent.click(within(friends).getByRole('button', { name: 'Send request' }));
      expect((await within(friends).findByRole(role)).textContent, answer).toBe(said);
      cleanup();
    }
  });

  it('opens the life behind a line: how it ended, what it was worth, where it was lived and what it earned', async () => {
    const detail: RankedLifeDetail = { netWorth: 123_456_00, status: 41, escapedAtRound: 9, bankruptcies: 1, badges: ['first_share'], cities: ['madrid', 'london'], history: [100_000, 400_000, 900_000], finishedAt: Date.UTC(2026, 9, 13) };
    const asked: unknown[] = [];
    const { community: c } = community({ run: async (line) => (asked.push(line), detail) });
    show(c);
    const [first] = await linesOf('All time');
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
    const [first] = await linesOf('All time');
    fireEvent.click(within(first).getByRole('button'));
    await within(sheetOf('Otra_Rata')).findByText('This life could not be read.');
    fireEvent.click(within(sheetOf('Otra_Rata')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Otra_Rata' })).toBeNull());
    fireEvent.click(within((await linesOf('All time'))[0]).getByRole('button'));
    await within(sheetOf('Otra_Rata')).findByText('This life could not be read.');
    expect(asks).toBe(2);
  });

  it('says so when the life behind a line cannot be read', async () => {
    const { community: c } = community({ run: async () => null });
    show(c);
    const [first] = await linesOf('All time');
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
    fireEvent.click(await screen.findByRole('tab', { name: "This week's challenge" }));
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
    expect(screen.queryByRole('region', { name: 'Your friends' })).toBeNull();
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
    await linesOf('All time');
    fireEvent.click(screen.getByRole('tab', { name: 'This week' }));
    await linesOf('This week');
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    await linesOf('All time');
    await settled();
    // Each answer known, a ranking switched to is drawn from it at once: the line that is the same in both is the same line, not drawn again.
    const engineer = spriteRenders.get('portrait.engineer.22');
    const civil = spriteRenders.get('portrait.civil_servant.22');
    fireEvent.click(screen.getByRole('tab', { name: 'This week' }));
    await linesOf('This week');
    await settled();
    expect(spriteRenders.get('portrait.engineer.22')).toBe(engineer);
    expect(spriteRenders.get('portrait.heir.22')).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    await settled();
    expect(spriteRenders.get('portrait.engineer.22')).toBe(engineer);
    expect(spriteRenders.get('portrait.civil_servant.22')).toBeGreaterThan(civil ?? 0);
  });

  it('is not drawn again for an answer that says what is on screen already', async () => {
    let asks = 0;
    const { community: c } = community({ ranking: async () => ((asks += 1), [row(1, 'aaaa1111-0000', { nickname: 'Otra_Rata' })]) });
    show(c);
    await linesOf('All time');
    await settled();
    const portraits = spriteRenders.get('portrait.nurse.22');
    // The name changed: the ranking is read again, and answers the same lines.
    const you = screen.getByRole('region', { name: 'You' });
    fireEvent.click(within(you).getByRole('button', { name: 'Change it' }));
    type(within(you).getByRole('textbox', { name: 'Name' }), 'Rata_Uno');
    fireEvent.click(within(you).getByRole('button', { name: 'Save' }));
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
    await linesOf('All time');
    await settled(() => probe.state?.start('nurse'));
    await settled(() => probe.state?.leaveNews());
    const before = renders.count;
    await settled(() => probe.state?.pick(0));
    await settled(() => probe.state?.afterCard());
    expect(probe.state?.view?.answered).toBe(1);
    expect(renders.count).toBe(before);
  });
});
