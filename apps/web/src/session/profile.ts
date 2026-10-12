import { newProfile, SAVE_FORMAT } from './types';
import type { Profile } from './types';

/** A stored profile, checked. Anything that is not a profile becomes a fresh one, so a bad write never locks the player out. */
export function readProfile(raw: unknown): Profile {
  if (typeof raw !== 'object' || raw === null) return newProfile();
  const candidate = raw as Partial<Profile>;
  if (candidate.format !== SAVE_FORMAT || typeof candidate.settings !== 'object' || candidate.settings === null) return newProfile();
  if (typeof candidate.settings.reducedMotion !== 'boolean') return newProfile();
  return { format: SAVE_FORMAT, settings: { reducedMotion: candidate.settings.reducedMotion } };
}
