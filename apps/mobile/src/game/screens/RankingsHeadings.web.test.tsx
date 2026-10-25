// @vitest-environment jsdom
import type { Community, Friend } from '@ratrace/online/types';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { Rankings } from './Rankings';

/*
 * The rankings' page has one `<h1>`, its title, as the Next web's: the friends' panel's tab is an `<h2>`, and its groups (the requests the player was
 * sent, those they sent) are under it (the Next web writes them as plain lines, `<p>`), never a second `<h1>`.
 */

afterEach(cleanup);

/** A community with a friend, a request to the player and one from them, as the fake server keeps them. */
function community(): Community {
  const friend = (userId: string, nickname: string): Friend => ({ userId, nickname, avatar: null });
  const friends = { friends: [friend('aaaa1111-0000', 'Amiga')], incoming: [friend('bbbb2222-0000', 'Tercera')], outgoing: [friend('cccc3333-0000', 'Otra_Rata')] };
  const no = async () => true;
  return {
    me: async () => ({ nickname: null, friendCode: 'ABCD2345', avatar: null }),
    rename: async () => 'ok',
    setAvatar: no,
    ranking: async () => [],
    friends: async () => friends,
    compare: async () => null,
    run: async () => null,
    befriend: async () => 'sent',
    answerFriend: async (_, yes) => (yes ? 'accepted' : 'declined'),
    unfriend: no,
    challengeEntry: async () => ({ entered: false, score: null }),
    challengeRanking: async () => ({ rows: [], entrants: 0 }),
    challengeChoices: async () => [],
    notifyMe: no,
    stopNotifying: no,
    marketNotice: no,
    setMarketNotice: no,
  } as Community;
}

it('gives the friends\' groups no h1: one h1 on the page, the groups under the panel\'s h2', async () => {
  renderGame(<Rankings />, { ...memoryServices(), community: () => community() });
  fireEvent.click(await screen.findByRole('tab', { name: 'Friends' }));
  await screen.findByText('Tercera');
  await screen.findByText('Otra_Rata');
  expect([...document.querySelectorAll('h1')].map((h) => h.textContent)).toEqual(['Rankings']);
  for (const name of ['Friend requests', 'Requests sent']) expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy();
  expect(screen.getByRole('heading', { level: 2, name: /your friends/i })).toBeTruthy();
});
