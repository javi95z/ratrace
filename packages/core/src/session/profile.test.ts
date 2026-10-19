import { badges, content, lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory';
import { profileAfter, readProfile, updateProfile } from './profile';
import { newProfile } from './types';
import type { Profile } from './types';

const earnedIn = (gameId: string, at: number) => ({ at, gameId });
const step = (over: Partial<Parameters<typeof profileAfter>[3]> = {}) => ({ gameId: 'g1', at: 100, earned: [], collection: [], finished: 0, ...over });

describe('reading a profile', () => {
  it('starts a new player with nothing but the default settings', () => {
    expect(newProfile()).toEqual({ format: 1, settings: { reducedMotion: false, sound: true }, badges: {}, gallery: [], unlocked: {}, guide: { seen: [], off: false }, rank: { points: 0, lives: {} } });
    for (const junk of [null, undefined, 'profile', 7, [], {}, { format: 2 }, { format: 1, settings: null }, { format: 1, settings: {} }]) {
      // Not a profile at all, or one with nothing in it but broken settings: a fresh one either way.
      expect(readProfile(junk), JSON.stringify(junk)).toEqual(newProfile());
    }
  });

  it('opens a profile from before badges existed, and keeps its settings', () => {
    expect(readProfile({ format: 1, settings: { reducedMotion: true, sound: true } })).toEqual({ ...newProfile(), settings: { reducedMotion: true, sound: true } });
  });

  it('keeps what is sound and drops what is not, part by part', () => {
    const stored = {
      format: 1,
      settings: { reducedMotion: true, volume: 11 },
      badges: { millionaire: { at: 5, gameId: 'g' }, broken: { at: 'yesterday' }, alsoBroken: 3 },
      gallery: ['watch_rolex', 7, 'watch_rolex', 'car_bmw_m3'],
      unlocked: { rider: { at: 9, gameId: 'g' }, heir: null },
      guide: { seen: ['news', 4], off: 'yes' },
      extra: true,
    };
    expect(readProfile(stored)).toEqual({
      format: 1,
      settings: { reducedMotion: true, sound: true },
      badges: { millionaire: { at: 5, gameId: 'g' } },
      gallery: ['watch_rolex', 'car_bmw_m3'],
      unlocked: { rider: { at: 9, gameId: 'g' } },
      guide: { seen: ['news'], off: false },
      rank: { points: 0, lives: {} },
    });
  });

  it('keeps every badge when only the settings are damaged', () => {
    const stored = { ...newProfile(), badges: { millionaire: { at: 5, gameId: 'g' } }, gallery: ['watch_rolex'], unlocked: { rider: { at: 9, gameId: 'g' } } };
    for (const settings of [null, 'loud', {}, { reducedMotion: 'yes' }]) {
      expect(readProfile({ ...stored, settings }), JSON.stringify(settings)).toEqual({ ...stored, settings: { reducedMotion: false, sound: true } });
    }
  });

  it('drops a badge whose date is no date at all', () => {
    const read = readProfile({ ...newProfile(), badges: { a: { at: 1e17, gameId: 'g' }, b: { at: -1e17, gameId: 'g' }, c: { at: Number.NaN, gameId: 'g' }, d: { at: 1_700_000_000_000, gameId: 'g' } } });
    expect(Object.keys(read.badges)).toEqual(['d']);
  });

  it('hands back a copy, never the thing it was given', () => {
    const stored = { ...newProfile(), gallery: ['watch_rolex'] };
    const read = readProfile(stored);
    read.gallery.push('x');
    read.guide.seen.push('y');
    expect(stored.gallery).toEqual(['watch_rolex']);
    expect(readProfile(stored).guide.seen).toEqual([]);
  });
});

describe('changing a profile', () => {
  it('reads, changes and writes back, so that one change never erases another', async () => {
    const store = new MemoryStore();
    await updateProfile(store, (p) => ({ ...p, gallery: ['watch_rolex'] }));
    await updateProfile(store, (p) => ({ ...p, settings: { reducedMotion: true, sound: true } }));
    expect(await store.loadProfile()).toEqual({ ...newProfile(), settings: { reducedMotion: true, sound: true }, gallery: ['watch_rolex'] });
  });

  it('applies changes asked for at the same moment one after another, losing none', async () => {
    const store = new MemoryStore();
    await Promise.all(['a', 'b', 'c', 'd'].map((item) => updateProfile(store, (p) => ({ ...p, gallery: [...p.gallery, item] }))));
    expect((await store.loadProfile()).gallery).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives back the profile as it now stands, and carries on after a change that failed', async () => {
    const store = new MemoryStore();
    await expect(
      updateProfile(store, () => {
        throw new Error('bad change');
      }),
    ).rejects.toThrow('bad change');
    const after = await updateProfile(store, (p) => ({ ...p, guide: { seen: ['news'], off: false } }));
    expect(after.guide.seen).toEqual(['news']);
    expect(await store.loadProfile()).toEqual(after);
  });
});

describe('what a step of a life adds to the profile', () => {
  it('adds what was owned to the gallery, once each, in the order first owned', () => {
    const first = profileAfter(content, lives, newProfile(), step({ collection: ['watch_casio', 'tech_phone'] }));
    expect(first.profile.gallery).toEqual(['watch_casio', 'tech_phone']);
    const second = profileAfter(content, lives, first.profile, step({ gameId: 'g2', collection: ['tech_phone', 'car_seat_ibiza'] }));
    expect(second.profile.gallery).toEqual(['watch_casio', 'tech_phone', 'car_seat_ibiza']);
    expect(second.earned).toEqual([]);
  });

  it('records a badge the first time it is earned, with when and in which life, and never again', () => {
    const first = profileAfter(content, lives, newProfile(), step({ earned: ['first_100k', 'first_share'] }));
    expect(first.earned).toEqual(['first_100k', 'first_share']);
    expect(first.profile.badges).toEqual({ first_100k: earnedIn('g1', 100), first_share: earnedIn('g1', 100) });
    const again = profileAfter(content, lives, first.profile, step({ gameId: 'g2', at: 900, earned: ['first_100k', 'millionaire'] }));
    expect(again.earned).toEqual(['millionaire']);
    expect(again.profile.badges.first_100k).toEqual(earnedIn('g1', 100));
    expect(again.profile.badges.millionaire).toEqual(earnedIn('g2', 900));
  });

  it('ignores a badge that does not exist', () => {
    const result = profileAfter(content, lives, newProfile(), step({ earned: ['made_up', 'first_share'] }));
    expect(result.earned).toEqual(['first_share']);
    expect(Object.keys(result.profile.badges)).toEqual(['first_share']);
  });

  it('gives the gallery its badges as soon as the gallery has earned them', () => {
    const cars = content.items.filter((item) => item.ladder === 'car' && item.id !== 'car_motorbike').map((item) => item.id);
    const most = profileAfter(content, lives, newProfile(), step({ collection: cars.slice(0, 6) }));
    expect(most.earned).toEqual([]);
    const all = profileAfter(content, lives, most.profile, step({ gameId: 'g2', at: 7, collection: [cars[6]] }));
    expect(all.earned).toEqual(['every_car']);
    expect(all.profile.badges.every_car).toEqual(earnedIn('g2', 7));
  });

  it('unlocks the lives that the badges and the finished lives have earned, once', () => {
    const none = profileAfter(content, lives, newProfile(), step());
    expect(none.unlocked).toEqual([]);
    const rich = profileAfter(content, lives, none.profile, step({ earned: ['millionaire'] }));
    expect(rich.unlocked).toEqual(['heir']);
    expect(rich.profile.unlocked).toEqual({ heir: earnedIn('g1', 100) });
    const done = profileAfter(content, lives, rich.profile, step({ gameId: 'g1', at: 200, finished: 1 }));
    expect(done.unlocked).toEqual(['rider']);
    expect(done.profile.unlocked).toEqual({ heir: earnedIn('g1', 100), rider: earnedIn('g1', 200) });
    // The next life starts with no finished life counted in its steps: what was unlocked stays unlocked.
    const next = profileAfter(content, lives, done.profile, step({ gameId: 'g2', at: 300 }));
    expect(next.unlocked).toEqual([]);
    expect(Object.keys(next.profile.unlocked)).toEqual(['heir', 'rider']);
  });

  it('changes nothing it was given', () => {
    const profile: Profile = newProfile();
    profileAfter(content, lives, profile, step({ earned: ['millionaire'], collection: ['watch_rolex'], finished: 1 }));
    expect(profile).toEqual(newProfile());
  });

  it('can hold every badge there is', () => {
    const every = profileAfter(content, lives, newProfile(), step({ earned: badges.map((b) => b.id) }));
    expect(Object.keys(every.profile.badges)).toHaveLength(61);
  });
});
