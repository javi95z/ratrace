import { describe, expect, it } from 'vitest';
import type { RoomMember } from '@/session/room';
import { roomStory } from './roomStory';
import { storyText } from './screens/News';
import en from '@ratrace/i18n/messages/en.json';
import es from '@ratrace/i18n/messages/es.json';
import ru from '@ratrace/i18n/messages/ru.json';

/** A member who scored `score`, after `before` and a place the round before. */
const member = (id: string, score: number, before: [number, number] | null, over: Partial<RoomMember> = {}): RoomMember => ({
  userId: id, name: id, me: false, host: false, ready: false, left: false, shout: null, avatar: null,
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

  it('last, of one of three or more left far behind', () => {
    expect(roomStory([member('lead', 400, [395, 1]), member('ana', 380, [378, 2]), member('me', 200, [198, 3], { me: true })])).toMatchObject({ kind: 'last', me: true });
    expect(roomStory([member('lead', 400, [395, 1]), member('me', 380, [378, 2], { me: true }), member('bo', 200, [198, 3])])).toMatchObject({ kind: 'last', me: false, who: { userId: 'bo' } });
    // Two are not a table to be last in.
    expect(roomStory([member('lead', 400, [395, 1]), member('me', 200, [198, 2], { me: true })])).toBeNull();
  });

  it('keeps quiet in a quiet round', () => {
    expect(roomStory([member('lead', 400, [395, 1]), member('me', 300, [296, 2], { me: true })])).toBeNull();
  });
});

describe('the story in the words of the paper', () => {
  /** The words of a language, filled in as next-intl fills them, plurals and all. */
  const words = (messages: { room: object }, locale: string) => (key: string, values: Record<string, string | number> = {}) => {
    const plural = new Intl.PluralRules(locale);
    return String((messages.room as Record<string, unknown>)[key])
      .replace(/\{(\w+), plural, ((?:\w+ \{[^}]*\} ?)+)\}/g, (_, name: string, forms: string) => {
        const n = Number(values[name]);
        const found = Object.fromEntries([...forms.matchAll(/(\w+) \{([^}]*)\}/g)].map((m) => [m[1], m[2]]));
        return (found[plural.select(n)] ?? found.other).replace('#', String(n));
      })
      .replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
  };
  const ana = member('ana', 90, [85, 1]);
  const stories = [
    { kind: 'lead', who: ana, me: false }, { kind: 'lead', who: ana, me: true }, { kind: 'passed', who: ana }, { kind: 'passedBy', who: ana },
    { kind: 'jump', who: ana, me: false, points: 42 }, { kind: 'jump', who: ana, me: true, points: 21 }, { kind: 'drop', who: ana, me: false, points: 33 },
    { kind: 'drop', who: ana, me: true, points: 35 }, { kind: 'neck', who: ana, other: member('bo', 89, [80, 2]) }, { kind: 'last', who: ana, me: false }, { kind: 'last', who: ana, me: true },
  ] as const;

  for (const [locale, messages] of [['en', en], ['es', es], ['ru', ru]] as const) {
    it(`tells every story in ${locale}, three ways each, every one filled in`, () => {
      const t = words(messages, locale);
      for (const story of stories) {
        const told = new Set([0, 1, 2, 3, 4, 5].map((round) => storyText(t, story, round)));
        expect(told.size, story.kind).toBe(3);
        for (const line of told) {
          expect(line, line).not.toMatch(/[{}]|undefined/);
          if (!('me' in story && story.me)) expect(line, line).toContain('ana');
        }
      }
    });
  }

  it('counts points as Russian does', () => {
    const t = words(ru, 'ru');
    const said = (points: number) => storyText(t, { kind: 'jump', who: ana, me: true, points }, 0);
    expect(said(21)).toMatch(/21 очко/);
    expect(said(33)).toMatch(/33 очка/);
    expect(said(45)).toMatch(/45 очков/);
  });
});
