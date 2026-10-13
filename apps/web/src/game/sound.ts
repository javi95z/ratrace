import type { Cue } from '@/ui/sound';
import type { RoundState } from './store';

/** What of the round on screen the sounds listen to. */
export type Heard = Pick<RoundState, 'stage' | 'view' | 'resolved' | 'orders' | 'refusal' | 'earned' | 'badges'>;

/** The cues that speak for a whole moment of a life. One of them plays alone. */
const LONG: readonly Cue[] = ['bankrupt', 'escape', 'million', 'crisis', 'end'];

/** What a round that has just been played sounds like: the biggest thing that happened in it. */
function roundCue(state: Heard, before: Heard): Cue {
  const events = state.resolved?.events ?? [];
  if (events.some((event) => event.kind === 'bankrupt')) return 'bankrupt';
  if (events.some((event) => event.kind === 'escaped')) return 'escape';
  if (state.badges.includes('millionaire') && !before.badges.includes('millionaire')) return 'million';
  if (events.some((event) => event.kind === 'promoted')) return 'promote';
  if (events.some((event) => event.kind === 'escapeLost' || event.kind === 'lapsed')) return 'bad';
  return 'round';
}

/** What the opening of a round sounds like: nothing, unless a crisis begins or ends with it. */
function newsCue(state: Heard): Cue | null {
  const view = state.view;
  if (!view) return null;
  const now = view.timeline[view.round]?.crisis ?? null;
  const was = view.round > 0 ? (view.timeline[view.round - 1]?.crisis ?? null) : null;
  if (now && now.year === 1) return 'crisis';
  if (!now && was) return 'calm';
  return null;
}

/**
 * The cues for one change of the round on screen, in the order to play them. Every sound of the
 * game besides the tap of a button is decided here, so that two of them never talk over each other.
 */
export function cuesFor(state: Heard, before: Heard): Cue[] {
  if (!state.view) return [];
  const cues: Cue[] = [];

  if (state.stage !== before.stage) {
    switch (state.stage) {
      case 'cards':
        cues.push('card');
        break;
      case 'outcome':
        cues.push('pick');
        break;
      case 'resolve':
        cues.push(roundCue(state, before));
        break;
      case 'news': {
        const cue = newsCue(state);
        if (cue) cues.push(cue);
        break;
      }
      case 'end':
        cues.push('end');
        break;
      default:
        break;
    }
  } else if (state.stage === 'finance') {
    if (state.refusal !== null && state.refusal !== before.refusal) cues.push('refuse');
    else if (state.orders.length > before.orders.length) cues.push('coin');
  }

  // A badge earned for the first time ever rings, unless the moment it came with already has the floor.
  if (state.earned.length > 0 && state.earned !== before.earned && !cues.some((cue) => LONG.includes(cue))) cues.push('badge');
  return cues;
}
