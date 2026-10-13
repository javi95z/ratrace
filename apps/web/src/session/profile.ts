import { badges, galleryBadges, unlockedLives } from '@ratrace/content';
import type { LifeDef } from '@ratrace/content';
import type { Content } from '@ratrace/engine';
import { isDay } from './runs';
import { newProfile, SAVE_FORMAT } from './types';
import type { Earned, PlayerStore, Profile } from './types';

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const strings = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter((entry): entry is string => typeof entry === 'string'))] : []);

/** The entries of a record of things earned that are whole: a time and the life it happened in. */
function earnedOf(x: unknown): Record<string, Earned> {
  const out: Record<string, Earned> = {};
  if (!isRecord(x)) return out;
  for (const [id, entry] of Object.entries(x)) {
    if (isRecord(entry) && isDay(entry.at) && typeof entry.gameId === 'string') out[id] = { at: entry.at, gameId: entry.gameId };
  }
  return out;
}

/**
 * A stored profile, checked part by part. What is sound is kept and what is not is dropped or put
 * back to its default, so a bad write never locks the player out, and a profile from before badges
 * existed opens with none. Anything that is not a profile at all becomes a fresh one.
 */
export function readProfile(raw: unknown): Profile {
  if (!isRecord(raw) || raw.format !== SAVE_FORMAT) return newProfile();
  // Damaged settings go back to the default, and take nothing else with them: the profile is written
  // back after every step, and one bad field must not cost a player thirty badges.
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const guide = isRecord(raw.guide) ? raw.guide : {};
  return {
    format: SAVE_FORMAT,
    settings: { reducedMotion: settings.reducedMotion === true },
    badges: earnedOf(raw.badges),
    gallery: strings(raw.gallery),
    unlocked: earnedOf(raw.unlocked),
    guide: { seen: strings(guide.seen), off: guide.off === true },
  };
}

/** Changes to one store's profile wait for each other, so none is written over. */
const queues = new WeakMap<PlayerStore, Promise<unknown>>();

/**
 * Changes the profile: read, change, write back, as one step. The profile holds settings, badges,
 * the gallery and the guide, each changed from a different place; writing it whole from any one
 * of them would erase what the others had added since.
 */
export function updateProfile(store: PlayerStore, change: (profile: Profile) => Profile): Promise<Profile> {
  const run = async () => {
    const next = change(await store.loadProfile());
    await store.saveProfile(next);
    return next;
  };
  const result = (queues.get(store) ?? Promise.resolve()).then(run, run);
  queues.set(
    store,
    result.catch(() => undefined),
  );
  return result;
}

/** What one step of a life has to tell the profile. */
export interface LifeStep {
  gameId: string;
  /** When the step was played. */
  at: number;
  /** Badges the step earned in this life. */
  earned: readonly string[];
  /** Every status item this life has owned so far. */
  collection: readonly string[];
  /** Lives lived to the end, this one included if the step ended it. Zero when the step did not end a life. */
  finished: number;
}

/**
 * The profile after a step of a life: the gallery with what the life has owned, the badges earned
 * for the first time, and the lives those unlocked. Also says which badges and lives are new, so
 * the screen can celebrate them. Nothing it is given is changed.
 */
export function profileAfter(content: Content, lives: ReadonlyArray<LifeDef>, profile: Profile, step: LifeStep): { profile: Profile; earned: string[]; unlocked: string[] } {
  const stamp: Earned = { at: step.at, gameId: step.gameId };
  const gallery = [...profile.gallery, ...step.collection.filter((item, i) => !profile.gallery.includes(item) && step.collection.indexOf(item) === i)];

  // Badges about the gallery are judged from the gallery alone, never taken on a life's word.
  const ofGallery = galleryBadges(content, content.items.map((item) => item.id));
  const known = new Set(badges.map((badge) => badge.id));
  const candidates = [...step.earned.filter((id) => known.has(id) && !ofGallery.includes(id)), ...galleryBadges(content, gallery)];
  const earned = candidates.filter((id, i) => !Object.hasOwn(profile.badges, id) && candidates.indexOf(id) === i);
  const held: Record<string, Earned> = { ...profile.badges };
  for (const id of earned) held[id] = stamp;

  const open = unlockedLives(lives, { finished: step.finished, badges: Object.keys(held) });
  const unlocked = open.filter((id) => !Object.hasOwn(profile.unlocked, id));
  const lifeStamps: Record<string, Earned> = { ...profile.unlocked };
  for (const id of unlocked) lifeStamps[id] = stamp;

  return { profile: { ...profile, gallery, badges: held, unlocked: lifeStamps }, earned, unlocked };
}
