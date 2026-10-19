import { rarityOf } from '@ratrace/content';
import type { Cue } from '@/ui/sound';
import { momentsOf } from '@ratrace/core/game/moments';
import type { Moment } from '@ratrace/core/game/moments';
import type { RoundState } from '@ratrace/core/game/store';

/** What of the round on screen the sounds listen to. */
export type Heard = Pick<RoundState, 'stage' | 'view' | 'resolved' | 'orders' | 'refusal' | 'earned' | 'story'>;

/** The sound of each moment that takes the screen. */
const MOMENT: Record<Moment['kind'], Cue> = { bankrupt: 'bankrupt', escape: 'escape', million: 'million', crisis: 'crisis' };

/** The cues that speak for a whole moment of a life. One of them plays alone. */
const LONG: readonly Cue[] = ['bankrupt', 'escape', 'million', 'crisis', 'end'];

/** What a round that has just been played sounds like: its moment if it has one, or the biggest news in it. */
function roundCue(state: Heard): Cue {
  const [moment] = momentsOf(state);
  if (moment) return MOMENT[moment.kind];
  const events = state.resolved?.events ?? [];
  if (events.some((event) => event.kind === 'promoted')) return 'promote';
  if (events.some((event) => event.kind === 'escapeLost' || event.kind === 'lapsed')) return 'bad';
  return 'round';
}

/** What the opening of a round sounds like: nothing, unless a crisis begins or ends with it. */
function newsCue(state: Heard): Cue | null {
  const view = state.view;
  if (!view) return null;
  const [moment] = momentsOf(state);
  if (moment) return MOMENT[moment.kind];
  const was = view.round > 0 ? (view.timeline[view.round - 1]?.crisis ?? null) : null;
  return was && !view.timeline[view.round]?.crisis ? 'calm' : null;
}

/** The ring of the rarest of the badges earned together: the rarer, the longer and fuller. */
export function badgeCue(earned: readonly string[]): Cue {
  const rarities = earned.map(rarityOf);
  if (rarities.includes('legendary')) return 'badgeLegendary';
  if (rarities.includes('rare')) return 'badgeRare';
  if (rarities.includes('uncommon')) return 'badgeUncommon';
  return 'badge';
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
        cues.push(roundCue(state));
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
  if (state.earned.length > 0 && state.earned !== before.earned && !cues.some((cue) => LONG.includes(cue))) cues.push(badgeCue(state.earned));
  return cues;
}
