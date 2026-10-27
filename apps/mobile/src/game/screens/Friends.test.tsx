// @vitest-environment jsdom
import type { Community, Friend, RankingRow } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clipboard } from '../../testing/fakes';
import { memoryServices, renderGame } from '../../testing/render';
import { settled } from '../../testing/renders';
import { FriendsPanel, InviteFriends } from './Friends';

/*
 * The player's friends, on the games with others' page (Friends.tsx, drawn on its own here): their code to share, the requests waiting on them, their
 * friends with the game each is in now, the requests they sent, a code to ask with; a friend opened in their sheet, joined or asked into a game; and
 * the friends asked into a lobby.
 */

afterEach(cleanup);

const row = (place: number, userId: string, over: Partial<RankingRow> = {}): RankingRow => ({ place, userId, nickname: null, score: 1000 - place * 100, lifeId: 'nurse', finishedAt: Date.UTC(2026, 9, 13), mine: false, ...over });

/** The other players, as a test says they are, remembering what was asked. */
function community(over: Partial<Community> = {}) {
  const asked: string[] = [];
  const state = {
    me: { nickname: null as string | null, friendCode: 'ABCD2345', avatar: null as string | null },
    friends: { friends: [] as Friend[], incoming: [] as Friend[], outgoing: [] as Friend[] },
    board: [] as RankingRow[],
  };
  const all = {
    me: async () => state.me,
    ranking: async () => state.board,
    friends: async () => state.friends,
    befriend: async (code: string) => {
      asked.push(`befriend ${code}`);
      state.friends = { ...state.friends, outgoing: [{ userId: 'aaaa1111-0000', nickname: 'Otra_Rata', avatar: null }, ...state.friends.outgoing] };
      return 'sent';
    },
    answerFriend: async (userId: string, yes: boolean) => {
      asked.push(`answer ${userId} ${yes ? 'yes' : 'no'}`);
      const asking = state.friends.incoming.find((friend) => friend.userId === userId);
      const incoming = state.friends.incoming.filter((friend) => friend.userId !== userId);
      state.friends = { ...state.friends, incoming, friends: yes && asking ? [asking, ...state.friends.friends] : state.friends.friends };
      return yes ? 'accepted' : 'declined';
    },
    unfriend: async (userId: string) => {
      asked.push(`unfriend ${userId}`);
      const without = (list: Friend[]) => list.filter((friend) => friend.userId !== userId);
      state.friends = { friends: without(state.friends.friends), incoming: without(state.friends.incoming), outgoing: without(state.friends.outgoing) };
      return true;
    },
    ...over,
  } as unknown as Community;
  return { community: all, asked, state };
}

const moves = { joined: [] as string[], invited: [] as string[], told: [] as string[] };
afterEach(() => {
  moves.joined.length = 0;
  moves.invited.length = 0;
  moves.told.length = 0;
});
/** The panel, as the games with others' page draws it, over a test's community. */
const show = (with_: Community, initial?: string) =>
  renderGame(
    <FriendsPanel onJoin={(code) => void moves.joined.push(code)} onInvite={(friend) => void moves.invited.push(friend.userId)} onTold={(said) => void moves.told.push(said)} initial={initial} />,
    { ...memoryServices(), community: () => with_ },
  );
const panel = () => screen.getByRole('region', { name: 'Your friends' });
const sheetOf = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
const type = (field: HTMLElement, text: string) => fireEvent.change(field, { target: { value: text } });

describe('the friends\' panel', () => {
  it('shows the player\'s friend code, which opens their invitation: its QR code, the link to share, the code to copy', async () => {
    const { community: c } = community();
    show(c);
    fireEvent.click(await screen.findByRole('button', { name: 'Your friend code: ABCD2345' }));
    const sheet = sheetOf('Your friend code');
    expect(within(sheet).getByRole('img', { name: /Scan it with another phone's camera/ })).toBeTruthy();
    expect(within(sheet).getByText('ABCD2345')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Share' })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(moves.told).toEqual(['Code copied']));
    expect(clipboard.text).toBe('ABCD2345');
  });

  it('asks another player to be friends by their code, written in capitals, and keeps the request apart until it is answered', async () => {
    const { community: c, asked } = community();
    show(c);
    await waitFor(() => expect(panel().textContent).toContain('No friends yet.'));
    type(within(panel()).getByRole('textbox', { name: 'Friend code' }), 'wxyz6789');
    expect((within(panel()).getByRole('textbox', { name: 'Friend code' }) as HTMLInputElement).value).toBe('WXYZ6789');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Send request' }));
    expect((await within(panel()).findByRole('status')).textContent).toBe('Request sent. Once they accept, you are friends.');
    expect(asked).toContain('befriend WXYZ6789');
    expect((within(panel()).getByRole('textbox', { name: 'Friend code' }) as HTMLInputElement).value).toBe('');
    expect(await within(panel()).findByRole('heading', { name: 'Requests sent' })).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Otra_Rata, Waiting' })).toBeTruthy();
  });

  it('writes in a friend\'s code their link brought (their QR code), for the player to send', async () => {
    const { community: c, asked } = community();
    show(c, 'WXYZ6789');
    expect((await within(panel()).findByRole('textbox', { name: 'Friend code' }) as HTMLInputElement).value).toBe('WXYZ6789');
    expect(asked.some((one) => one.startsWith('befriend'))).toBe(false);
  });

  it('accepts or declines a request on its line, and ends a friendship only from the friend\'s sheet', async () => {
    const { community: c, asked, state } = community();
    state.friends.incoming = [{ userId: 'bbbb2222-0000', nickname: 'Tercera', avatar: null }, { userId: 'dddd4444-0000', nickname: null, avatar: null }];
    show(c);
    expect(await within(panel()).findByRole('heading', { name: 'Friend requests' })).toBeTruthy();
    expect(panel().textContent).toContain('Rat DDDD');
    fireEvent.click(within(panel()).getAllByRole('button', { name: 'Accept' })[0]);
    expect((await within(panel()).findByRole('status')).textContent).toBe('You are friends now!');
    expect(asked).toContain('answer bbbb2222-0000 yes');
    await waitFor(() => expect(within(panel()).getAllByRole('button', { name: 'Decline' })).toHaveLength(1));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(within(panel()).queryByRole('heading', { name: 'Friend requests' })).toBeNull());
    expect(asked).toContain('answer dddd4444-0000 no');
    fireEvent.click(await within(panel()).findByRole('button', { name: 'Tercera' }));
    const sheet = sheetOf('Tercera');
    expect(sheet.textContent).toContain("You will no longer see each other's lives among friends.");
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove friend' }));
    await waitFor(() => expect(panel().textContent).toContain('No friends yet.'));
    expect(asked).toContain('unfriend bbbb2222-0000');
  });

  it('takes back a request the player sent from its sheet', async () => {
    const { community: c, asked, state } = community();
    state.friends.outgoing = [{ userId: 'eeee5555-0000', nickname: 'Cuarta', avatar: null }];
    show(c);
    fireEvent.click(await within(panel()).findByRole('button', { name: 'Cuarta, Waiting' }));
    fireEvent.click(within(sheetOf('Cuarta')).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(within(panel()).queryByRole('heading', { name: 'Requests sent' })).toBeNull());
    expect(asked).toContain('unfriend eeee5555-0000');
  });

  it('asks nobody for an empty code, and trims a pasted one', async () => {
    const { community: c, asked } = community();
    show(c);
    const field = await within(panel()).findByRole('textbox', { name: 'Friend code' });
    type(field, '   ');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Send request' }));
    await settled();
    expect(asked.filter((line) => line.startsWith('befriend'))).toEqual([]);
    type(field, ' wxyz6789 ');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(asked).toContain('befriend WXYZ6789'));
  });

  it('says nothing of friends that could not be read, and still asks by code', async () => {
    const { community: c } = community({ friends: async () => null });
    show(c);
    await settled();
    expect(within(panel()).queryByRole('alert')).toBeNull();
    expect(panel().textContent).not.toContain('No friends yet.');
    expect(within(panel()).getByRole('button', { name: 'Send request' })).toBeTruthy();
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
      type(await within(panel()).findByRole('textbox', { name: 'Friend code' }), 'wxyz6789');
      fireEvent.click(within(panel()).getByRole('button', { name: 'Send request' }));
      expect((await within(panel()).findByRole(role)).textContent, answer).toBe(said);
      cleanup();
    }
  });
});

describe('a friend, opened', () => {
  const ana = (playing: Friend['playing'] = null, together = 3): Friend => ({ userId: 'aaaa1111-0000', nickname: 'Ana', avatar: null, playing, together });

  it('says where each friend is now: in a game waiting for its players, in one under way, or nowhere', async () => {
    const { community: c, state } = community();
    state.friends.friends = [ana({ status: 'open', code: 'K7Q2XM' }), { ...ana({ status: 'playing', code: null }), userId: 'bbbb2222-0000', nickname: 'Beto' }, { ...ana(), userId: 'cccc3333-0000', nickname: 'Cata' }];
    show(c);
    expect(await within(panel()).findByRole('button', { name: 'Ana, Looking for players' })).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Beto, Playing now' })).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Cata' })).toBeTruthy();
  });

  it('shows the games played together and their best ranked life, and joins the game they wait in once the sheet has gone', async () => {
    const { community: c, state } = community();
    state.friends.friends = [ana({ status: 'open', code: 'K7Q2XM' })];
    state.board = [row(1, 'aaaa1111-0000', { nickname: 'Ana', lifeId: 'engineer', score: 4321 }), row(2, 'me', { mine: true })];
    show(c);
    fireEvent.click(await within(panel()).findByRole('button', { name: 'Ana, Looking for players' }));
    const sheet = sheetOf('Ana');
    expect(sheet.textContent).toContain('3 games together');
    await waitFor(() => expect(sheet.textContent).toContain('4,321'));
    expect(within(sheet).queryByRole('button', { name: 'Invite to a game' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Join their game' }));
    await waitFor(() => expect(moves.joined).toEqual(['K7Q2XM']));
  });

  it('asks a friend who waits in no game into one, and asks nothing of one already playing', async () => {
    const { community: c, state } = community();
    state.friends.friends = [ana(null, 0), { ...ana({ status: 'playing', code: null }), userId: 'bbbb2222-0000', nickname: 'Beto' }];
    show(c);
    fireEvent.click(await within(panel()).findByRole('button', { name: 'Ana' }));
    const sheet = sheetOf('Ana');
    expect(sheet.textContent).toContain('No games together yet');
    await waitFor(() => expect(sheet.textContent).toContain('No ranked lives yet.'));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Invite to a game' }));
    await waitFor(() => expect(moves.invited).toEqual(['aaaa1111-0000']));
    cleanup();
    show(c);
    fireEvent.click(await within(panel()).findByRole('button', { name: 'Beto, Playing now' }));
    expect(within(sheetOf('Beto')).queryByRole('button', { name: /Invite|Join/ })).toBeNull();
  });
});

describe('friends asked into a lobby', () => {
  it('lists the friends not in it, each asked once, and says it went or did not', async () => {
    const { community: c, state } = community();
    state.friends.friends = [
      { userId: 'aaaa1111-0000', nickname: 'Ana', avatar: null },
      { userId: 'bbbb2222-0000', nickname: 'Beto', avatar: null },
      { userId: 'cccc3333-0000', nickname: 'Cata', avatar: null },
    ];
    const asked: string[] = [];
    const onInvite = vi.fn(async (userId: string) => (asked.push(userId), userId === 'bbbb2222-0000' ? ('failed' as const) : ('sent' as const)));
    renderGame(<InviteFriends here={['cccc3333-0000']} onInvite={onInvite} />, { ...memoryServices(), community: () => c });
    const invite = await screen.findByRole('region', { name: 'Invite your friends' });
    expect(invite.textContent).not.toContain('Cata');
    const [first, second] = within(invite).getAllByRole('button', { name: 'Invite' });
    fireEvent.click(first);
    await waitFor(() => expect(invite.textContent).toContain('Invite sent'));
    fireEvent.click(second);
    await waitFor(() => expect(invite.textContent).toContain('Could not invite. Try again.'));
    expect(asked).toEqual(['aaaa1111-0000', 'bbbb2222-0000']);
  });

  it('is nothing for a player with no friends to ask', async () => {
    const { community: c } = community();
    renderGame(<InviteFriends here={[]} onInvite={async () => 'sent'} />, { ...memoryServices(), community: () => c });
    await act(async () => undefined);
    await settled();
    expect(screen.queryByRole('region', { name: 'Invite your friends' })).toBeNull();
  });
});
