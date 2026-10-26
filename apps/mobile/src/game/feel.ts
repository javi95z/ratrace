import type { Haptic } from '../ui/haptic';
import type { Cue } from '../ui/sound';

/*
 * What the round on screen says to the touch: decided from its sounds (`cuesFor`, ./cues.ts), so a moment is heard and felt as one, and felt with
 * the sound off too. Only what the player did and what a life won or lost is felt: the cards and news coming, an order put in the basket, the end
 * of a life counted up are heard only.
 */
const FELT: Partial<Record<Cue, Haptic>> = {
  pick: 'confirm',
  round: 'confirm',
  promote: 'success',
  escape: 'success',
  million: 'success',
  badge: 'success',
  badgeUncommon: 'success',
  badgeRare: 'success',
  badgeLegendary: 'success',
  bankrupt: 'reject',
  bad: 'reject',
  refuse: 'reject',
  crisis: 'warning',
};

/** The one moment to feel of the cues of a change of the round: the first that is felt, never two buzzes at once. */
export function feltOf(cues: readonly Cue[]): Haptic | null {
  for (const cue of cues) {
    const felt = FELT[cue];
    if (felt) return felt;
  }
  return null;
}
