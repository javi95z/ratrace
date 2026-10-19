import { describe, expect, it } from 'vitest';
import { friends } from '../../../supabase/functions/_shared/friends.ts';
import type { Befriended, FriendsDeps } from '../../../supabase/functions/_shared/friends.ts';
import type { NoticeAbout } from '../../../supabase/functions/_shared/notice.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** The database as the function sees it, answering as told, and remembering whom it told what. */
function deps(over: Partial<FriendsDeps> = {}) {
  const told: Array<{ user: string; about: NoticeAbout }> = [];
  const asked: string[] = [];
  const all: FriendsDeps = {
    allow: async () => true,
    requestByCode: async (user, code) => (asked.push(`request ${user} ${code}`), { answer: 'sent', to: B }),
    answer: async (user, from, yes) => (asked.push(`answer ${user} ${from} ${yes}`), yes ? 'accepted' : 'declined'),
    remove: async (user, other) => void asked.push(`remove ${user} ${other}`),
    list: async () => ({ friends: [], incoming: [], outgoing: [] }),
    names: async (ids) => Object.fromEntries(ids.map((id) => [id, id === A ? 'Ana_1' : null])),
    notify: async (users, about) => {
      for (const user of users) told.push({ user, about });
    },
    ...over,
  };
  return { all, told, asked };
}

describe('friends, both ways', () => {
  it('asks by code, and tells whoever is asked, by the asker\'s name', async () => {
    const { all, told, asked } = deps();
    expect(await friends(all, A, { action: 'request', code: ' abcd2345 ' })).toEqual({ status: 200, body: { answer: 'sent' } });
    expect(asked).toEqual([`request ${A}  abcd2345 `]);
    expect(told).toEqual([{ user: B, about: { kind: 'friendRequest', who: 'Ana_1' } }]);
  });

  it('tells the asker when the other asked first, and nobody of anything else', async () => {
    for (const answer of ['accepted', 'pending', 'friends', 'self', 'full', 'unknown'] as const) {
      const { all, told } = deps({ requestByCode: async () => ({ answer, to: answer === 'unknown' ? null : B }) });
      expect((await friends(all, A, { action: 'request', code: 'X' })).body).toEqual({ answer });
      expect(told, answer).toEqual(answer === 'accepted' ? [{ user: B, about: { kind: 'friendAccepted', who: 'Ana_1' } }] : []);
    }
  });

  it('answers a request: a yes is the asker\'s news, a no is nobody\'s', async () => {
    const yes = deps();
    expect(await friends(yes.all, A, { action: 'answer', from: B, yes: true })).toEqual({ status: 200, body: { answer: 'accepted' } });
    expect(yes.told).toEqual([{ user: B, about: { kind: 'friendAccepted', who: 'Ana_1' } }]);
    const no = deps();
    expect((await friends(no.all, A, { action: 'answer', from: B, yes: false })).body).toEqual({ answer: 'declined' });
    expect(no.told).toEqual([]);
    const gone = deps({ answer: async () => 'gone' as Befriended | 'gone' });
    expect((await friends(gone.all, A, { action: 'answer', from: B, yes: true })).body).toEqual({ answer: 'gone' });
    expect(gone.told).toEqual([]);
  });

  it('ends a friendship, lists, and refuses what is not one of its calls', async () => {
    const { all, asked, told } = deps({ list: async () => ({ friends: [{ userId: B, nickname: null, avatar: null }], incoming: [], outgoing: [] }) });
    expect(await friends(all, A, { action: 'remove', userId: B })).toEqual({ status: 200, body: { answer: 'ok' } });
    expect(asked).toEqual([`remove ${A} ${B}`]);
    expect((await friends(all, A, { action: 'list' })).body).toEqual({ friends: [{ userId: B, nickname: null, avatar: null }], incoming: [], outgoing: [] });
    expect(told).toEqual([]);
    for (const [body, field] of [
      [null, 'body'],
      [{ action: 'request', code: 5 }, 'code'],
      [{ action: 'request', code: 'x'.repeat(40) }, 'code'],
      [{ action: 'answer', from: 'nobody', yes: true }, 'from'],
      [{ action: 'answer', from: B, yes: 'yes' }, 'yes'],
      [{ action: 'remove', userId: 'nobody' }, 'userId'],
      [{ action: 'follow' }, 'action'],
    ] as const) {
      expect(await friends(all, A, body), JSON.stringify(body)).toEqual({ status: 400, body: { error: 'bad-request', field } });
    }
  });

  it('counts every call, and refuses one too many', async () => {
    const { all } = deps({ allow: async () => false });
    expect(await friends(all, A, { action: 'list' })).toEqual({ status: 429, body: { error: 'too-many' } });
  });
});
