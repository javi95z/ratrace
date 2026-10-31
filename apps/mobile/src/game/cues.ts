import { content, rarityOf } from '@ratrace/content';
import { FLAG_IN_ROOM } from '@ratrace/engine';
import { momentsOf } from '@ratrace/core/game/moments';
import type { Moment } from '@ratrace/core/game/moments';
import type { RoundState } from '@ratrace/core/game/store';
import type { Cue } from '../ui/sound';

/*
 * What the round on screen sounds like. A copy of the web's (apps/web/src/game/sound.ts), which cannot be shared: it
 * lives beside the web's sound board. `cues.test.ts` runs both over the same changes of the round and holds this one
 * to it, so a rule changed there is a test failing here.
 */

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

/** The card waiting on screen, if the round is at its cards. */
const waitingOf = (state: Heard): string | null => (state.stage === 'cards' && state.view?.phase === 'cards' ? (state.view.hand[state.view.answered] ?? null) : null);

/** True where the change puts a legendary card (`CardDef.legendary`) on screen: the phone's own, the web never met one. */
export function legendaryComing(state: Heard, before: Heard): boolean {
  const waiting = waitingOf(state);
  if (waiting === null || waiting === waitingOf(before)) return false;
  return content.cards.some((card) => card.id === waiting && card.legendary === true);
}

/** The badges' rings, which a milestone reached in the same step speaks for. */
const RINGS: readonly Cue[] = ['badge', 'badgeUncommon', 'badgeRare', 'badgeLegendary'];

/** What of the round on screen the milestones' sound listens to, besides what the web's cues do. */
export type HeardMilestones = Heard & Pick<RoundState, 'reached'>;

/**
 * The cues of a change of the round with its milestones heard (lifeMilestones.ts; the web had none, so this is the phone's own, beside the web's
 * `cuesFor`): a milestone reached rings for the step, in place of its badges' ring, as it is shown in their place. The whole screen gets the
 * million's fanfare (a legendary badge carried in it, its own); any other, the coin. A moment that already has the floor (the way out, the first
 * million, a bankruptcy) keeps it. `milestone` says the step reached one, to be felt as a success.
 */
export function stepCues(state: HeardMilestones, before: HeardMilestones): { cues: Cue[]; milestone: boolean } {
  const heard = cuesFor(state, before);
  // A legendary card coming up rings as a legendary badge does, in place of the card's own sound, and is felt as one (feel.ts).
  const cues = legendaryComing(state, before) ? [...heard.filter((cue) => cue !== 'card'), 'badgeLegendary' as const] : heard;
  if (!state.view || state.reached.length === 0 || state.reached === before.reached || cues.some((cue) => LONG.includes(cue))) return { cues, milestone: false };
  const inRoom = Object.hasOwn(state.view.player.life.flags, FLAG_IN_ROOM);
  const legendary = state.earned.some((id) => rarityOf(id) === 'legendary');
  const ring: Cue = inRoom ? 'coin' : state.reached.some((each) => each.size === 'big') ? 'million' : legendary ? 'badgeLegendary' : 'coin';
  return { cues: [...cues.filter((cue) => !RINGS.includes(cue)), ring], milestone: true };
}
