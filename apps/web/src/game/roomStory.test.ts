import { describe, expect, it } from 'vitest';
import type { RoomMember } from '@/session/room';
import { roomStory } from './roomStory';

/** A member who scored `score`, after `before` and a place the round before. */
const member = (id: string, score: number, before: [number, number] | null, over: Partial<RoomMember> = {}): RoomMember => ({
  userId: id, name: id, me: false, host: false, ready: false, left: false, reaction: null, shout: null,
  standing: { score, netWorth: 0, status: 0, escaped: false, bankruptcies: 0, before: before ? { score: before[0], place: before[1] } : null, cityId: null, career: null },
  ...over,
});

describe('the story of a game in the round\'s paper', () => {
  it('says nothing before a round has turned twice, nor alone, nor to a player who left', () => {
    expect(roomStory([member('me', 100, null, { me: true }), member('ana', 90, null)])).toBeNull();
    expect(roomStory([member('me', 100, [80, 1], { me: true })])).toBeNull();
    expect(roomStory([member('me', 100, [80, 2], { me: true, left: true }), member('ana', 90, [85, 1])])).toBeNull();
  });

  it('tells of a new leader first, the player or another', () => {
    expect(roomStory([member('me', 120, [80, 2], { me: true }), member('ana', 90, [85, 1])])).toMatchObject({ kind: 'lead', me: true });
    expect(roomStory([member('me', 100, [90, 2], { me: true }), member('ana', 130, [80, 3]), member('bo', 95, [95, 1])])).toMatchObject({ kind: 'lead', me: false, who: { userId: 'ana' } });
  });

  it('then of the player overtaking someone, or being overtaken', () => {
    expect(roomStory([member('lead', 300, [280, 1]), member('me', 150, [120, 3], { me: true }), member('ana', 140, [130, 2])])).toMatchObject({ kind: 'passed', who: { userId: 'ana' } });
    expect(roomStory([member('lead', 300, [280, 1]), member('me', 140, [130, 2], { me: true }), member('ana', 150, [120, 3])])).toMatchObject({ kind: 'passedBy', who: { userId: 'ana' } });
  });

  it('then of a big gain or a big loss, and of two leaders neck and neck', () => {
    expect(roomStory([member('lead', 400, [390, 1]), member('me', 250, [200, 2], { me: true }), member('ana', 100, [100, 3])])).toMatchObject({ kind: 'jump', me: true, points: 50 });
    expect(roomStory([member('lead', 400, [390, 1]), member('me', 250, [245, 2], { me: true }), member('ana', 100, [160, 3])])).toMatchObject({ kind: 'drop', who: { userId: 'ana' }, points: 60 });
    expect(roomStory([member('lead', 400, [395, 1]), member('me', 396, [392, 2], { me: true })])).toMatchObject({ kind: 'neck' });
  });

  it('keeps quiet in a quiet round', () => {
    expect(roomStory([member('lead', 400, [395, 1]), member('me', 300, [296, 2], { me: true })])).toBeNull();
  });
});
