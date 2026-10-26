import { badges, content, lives, rarityOf } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { createGameStore } from '@ratrace/core/game/store';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { createGame, viewOf } from '@ratrace/engine';
import type { GameEvent, GameView, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { badgeCue as webBadgeCue, cuesFor as webCuesFor } from '../../../web/src/game/sound';
import type { Cue } from '../ui/sound';
import type { Reached } from '@ratrace/core/game/lifeMilestones';
import { badgeCue, cuesFor, stepCues } from './cues';
import type { Heard, HeardMilestones } from './cues';

/*
 * The phone's cues are a copy of the web's (apps/web/src/game/sound.ts): the file cannot be shared, because the
 * web's imports its own sound board. This holds the copy to the original: both run over the same changes of the
 * round, and say the same thing. The web's own expectations (moments.test.ts, badgeFeel.test.ts) are repeated here,
 * on both, so that a copy that agreed with a web that had changed would not pass for a copy that is right.
 */

function view(change: (view: GameView) => void = () => undefined): GameView {
  const made = viewOf(createGame({ content, start: lives[0].start }, 'cues'));
  made.timeline = Array.from({ length: 6 }, (_, round) => ({ ...made.timeline[0], round }));
  made.round = 5;
  change(made);
  return made;
}
const crisis = (year: number) => (v: GameView) => (v.timeline[v.round].crisis = { id: 'crash', year, of: 3 });
const heard = (over: Partial<Heard>): Heard => ({ stage: 'news', view: view(), resolved: null, orders: [], refusal: null, earned: [], story: [], ...over });
const resolved = (events: GameEvent[]) => ({ before: view(), events });
const million: Milestone = { round: 5, kind: 'worth', mark: 100_000_000 };
const order: Order = { type: 'depositIn', amount: 100 };
const NONE: string[] = [];
const ofRarity = (rarity: string) => badges.find((badge) => rarityOf(badge.id) === rarity)!.id;

/** What the phone and the web each hear in a change of the round, which the test requires to be one and the same. */
function both(state: Heard, before: Heard): Cue[] {
  const web = webCuesFor(state, before);
  expect(cuesFor(state, before)).toEqual(web);
  return web;
}

describe('the cues are the web\'s', () => {
  it('are silent while nothing changes, and without a life', () => {
    expect(both(heard({}), heard({}))).toEqual([]);
    expect(both(heard({ stage: 'cards', view: null }), heard({ view: null }))).toEqual([]);
  });

  it('deal a card, make a choice, roll the ledger and end a life', () => {
    expect(both(heard({ stage: 'cards' }), heard({}))).toEqual(['card']);
    expect(both(heard({ stage: 'outcome' }), heard({ stage: 'cards' }))).toEqual(['pick']);
    expect(both(heard({ stage: 'finance' }), heard({ stage: 'outcome' }))).toEqual([]);
    expect(both(heard({ stage: 'resolve', resolved: resolved([]) }), heard({ stage: 'finance' }))).toEqual(['round']);
    expect(both(heard({ stage: 'end' }), heard({ stage: 'resolve' }))).toEqual(['end']);
  });

  it('ring a coin for an order taken and buzz for one refused, in the finances only', () => {
    const finance = heard({ stage: 'finance' });
    expect(both({ ...finance, orders: [order] }, finance)).toEqual(['coin']);
    expect(both(finance, { ...finance, orders: [order] })).toEqual([]);
    expect(both({ ...finance, refusal: 'not-enough-cash' }, finance)).toEqual(['refuse']);
    expect(both({ ...finance, refusal: 'not-enough-cash' }, { ...finance, refusal: 'not-enough-cash' })).toEqual([]);
    expect(both({ ...heard({ stage: 'news' }), orders: [order] }, heard({ stage: 'news' }))).toEqual([]);
  });

  it('play the moment of a round instead of its ledger, and the news of a round when it has no moment', () => {
    const after = (events: GameEvent[], story: Milestone[] = []) => both(heard({ stage: 'resolve', resolved: resolved(events), story }), heard({ stage: 'finance' }));
    expect(after([{ kind: 'bankrupt', proceeds: 0, debtsCleared: 0 }, { kind: 'escaped', round: 5 }])).toEqual(['bankrupt']);
    expect(after([{ kind: 'escaped', round: 5 }])).toEqual(['escape']);
    expect(after([], [million])).toEqual(['million']);
    expect(after([{ kind: 'promoted', careerId: 'tech', level: 1 }])).toEqual(['promote']);
    expect(after([{ kind: 'escapeLost' }])).toEqual(['bad']);
    expect(after([{ kind: 'lapsed', itemId: 'club' }])).toEqual(['bad']);
  });

  it('sound the siren when a crisis opens and the all-clear when it is over', () => {
    const opening = (now: (v: GameView) => void, before: (v: GameView) => void = () => undefined) =>
      both(heard({ view: view((v) => (before(v), now(v))) }), heard({ stage: 'resolve' }));
    const was = (v: GameView) => (v.timeline[v.round - 1].crisis = { id: 'crash', year: 3, of: 3 });
    expect(opening(crisis(1))).toEqual(['crisis']);
    expect(opening(crisis(2))).toEqual([]);
    expect(opening(() => undefined, was)).toEqual(['calm']);
    expect(opening(() => undefined)).toEqual([]);
  });

  it('ring a badge earned for the first time, unless a moment already has the floor', () => {
    const earned = ['first_100k'];
    expect(both(heard({ stage: 'resolve', resolved: resolved([]), earned }), heard({ stage: 'finance', earned: NONE }))).toEqual(['round', 'badge']);
    expect(both(heard({ stage: 'resolve', resolved: resolved([{ kind: 'escaped', round: 5 }]), earned }), heard({ stage: 'finance', earned: NONE }))).toEqual(['escape']);
    expect(both(heard({ stage: 'outcome', earned }), heard({ stage: 'cards', earned: NONE }))).toEqual(['pick', 'badge']);
    // The same badges still on screen are not rung a second time.
    const still = heard({ stage: 'outcome', earned });
    expect(both(still, still)).toEqual([]);
  });

  it('ring the rarest tier among the badges earned together', () => {
    expect(badgeCue([ofRarity('common')])).toBe('badge');
    expect(badgeCue([ofRarity('common'), ofRarity('uncommon')])).toBe('badgeUncommon');
    expect(badgeCue([ofRarity('uncommon'), ofRarity('rare'), ofRarity('common')])).toBe('badgeRare');
    expect(badgeCue([ofRarity('rare'), ofRarity('legendary')])).toBe('badgeLegendary');
    expect(badgeCue([])).toBe('badge');
    // Every badge there is, alone and beside a legendary one, rings as it does on the web.
    for (const { id } of badges) {
      expect(badgeCue([id]), id).toBe(webBadgeCue([id]));
      expect(badgeCue([id, ofRarity('legendary')]), id).toBe('badgeLegendary');
    }
    const base = heard({ stage: 'outcome' });
    expect(both({ ...heard({ stage: 'outcome' }), earned: [ofRarity('legendary')] }, base)).toContain('badgeLegendary');
  });
});

describe('the cues of a whole life', () => {
  /** A real round store on a real life, played to its end by the book: every change it makes is heard by both. */
  async function liveOut(lifeId: string): Promise<Set<Cue>> {
    let ids = 0;
    const sessions = new LocalSessions(new MemoryStore(), content, lives, { newId: () => `cues-${(ids += 1)}`, newSeed: () => `cues-seed-${ids}`, now: () => ids });
    const game = createGameStore({ sessions, content });
    const rung = new Set<Cue>();
    game.subscribe((state, before) => {
      for (const cue of both(state, before)) rung.add(cue);
    });
    await game.getState().start(lifeId);
    for (let steps = 0; game.getState().stage !== 'end'; steps++) {
      expect(steps, 'a life that never ends').toBeLessThan(2_000);
      const s = game.getState();
      if (s.stage === 'news') s.leaveNews();
      else if (s.stage === 'cards') await s.pick(0);
      else if (s.stage === 'outcome') s.afterCard();
      else if (s.stage === 'finance') {
        // The first round of the finances takes one order and is refused another; the rest are played with none.
        if (s.view?.round === 0) {
          expect(s.addOrder({ type: 'focus', action: 'studyCareer' })).toBe(true);
          expect(s.addOrder({ type: 'depositIn', amount: 999_999_999_00 })).toBe(false);
        }
        await s.play();
      } else if (s.stage === 'resolve') s.next();
    }
    return rung;
  }

  it('is heard the same by the phone and the web, change by change', async () => {
    const rung = await liveOut('nurse');
    // A life that was heard to say nothing would agree with anything.
    for (const cue of ['card', 'pick', 'coin', 'refuse', 'round', 'end'] as const) expect(rung, cue).toContain(cue);
  });
});

describe('a milestone reached rings for its step (the phone\'s own: the web had none)', () => {
  const at = (over: Partial<HeardMilestones>): HeardMilestones => ({ ...heard({ stage: 'outcome' }), reached: [], ...over });
  const card = at({ stage: 'cards' });
  const home: Reached = { id: 'home', age: 30, best: 28, size: 'medium' };
  const first: Reached = { id: 'home', age: 30, best: null, size: 'big' };

  it('rings the coin for a banner, in place of the badges of the step, and is felt', () => {
    expect(stepCues(at({ reached: [home], earned: [ofRarity('rare')] }), card)).toEqual({ cues: ['pick', 'coin'], milestone: true });
  });

  it('plays the fanfare for the whole screen', () => {
    expect(stepCues(at({ reached: [first] }), card).cues).toEqual(['pick', 'million']);
  });

  it('leaves the floor to a moment that already has it, and says nothing again for the same step', () => {
    const out = at({ stage: 'resolve', resolved: resolved([{ kind: 'escaped', round: 5 } as GameEvent]), reached: [{ id: 'escaped', age: 32, best: null, size: 'big' }] });
    expect(stepCues(out, at({ stage: 'finance' }))).toEqual({ cues: ['escape'], milestone: false });
    const shown = at({ reached: [home] });
    expect(stepCues(shown, shown)).toEqual({ cues: [], milestone: false });
  });
});
