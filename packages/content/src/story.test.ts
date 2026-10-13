import { applyCard, applyRound, createGame, viewOf } from '@ratrace/engine';
import type { GameEvent, GameState, GameView } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { content } from './content';
import { lives } from './lives';
import { storyAfter, storyStart, WORTH_MARKS } from './story';
import type { Milestone, Story } from './story';

const life = (id: string, seed = 'story'): GameState => createGame({ content, start: lives.find((x) => x.id === id)!.start }, seed);

/** A view of the game with the player changed, and the story told of that change. */
function step(story: Story, state: GameState, change: (view: GameView) => void, events: GameEvent[] = []): Story {
  const after = viewOf(state);
  change(after);
  return storyAfter(content, story, after, events);
}
const kinds = (story: Story) => story.milestones.map((m) => m.kind);

describe('the story of a life', () => {
  it('starts with nothing told: where a life begins is not a milestone', () => {
    for (const each of lives) {
      const story = storyStart(content, viewOf(life(each.id)));
      expect(story.milestones, each.id).toEqual([]);
      // Nor does a step in which nothing changes add anything.
      expect(storyAfter(content, story, viewOf(life(each.id)), []).milestones, each.id).toEqual([]);
    }
    // The heir owns a home and the founder a business from the first day: neither is news.
    expect(storyStart(content, viewOf(life('heir'))).last.ownsHome).toBe(true);
    expect(storyStart(content, viewOf(life('founder'))).last.business).toBe(true);
  });

  it('tells a change of career, a lost job and a promotion apart, and marks the top of a ladder', () => {
    const state = life('nurse');
    let story = storyStart(content, viewOf(state));
    story = step(story, state, (v) => (v.player.life.career = { id: 'finance', level: 0 }));
    story = step(story, state, (v) => (v.player.life.career = { id: 'finance', level: 1 }), [{ kind: 'promoted', careerId: 'finance', level: 1 }]);
    story = step(story, state, (v) => (v.player.life.career = { id: 'finance', level: 4 }), [
      { kind: 'promoted', careerId: 'finance', level: 3 },
      { kind: 'promoted', careerId: 'finance', level: 4 },
    ]);
    story = step(story, state, (v) => (v.player.life.career = null));
    expect(story.milestones).toEqual<Milestone[]>([
      { round: 0, kind: 'career', careerId: 'finance' },
      { round: 0, kind: 'promoted', careerId: 'finance', level: 1, top: false },
      // Two promotions at once are one piece of news: the rung reached.
      { round: 0, kind: 'promoted', careerId: 'finance', level: 4, top: true },
      { round: 0, kind: 'jobLost' },
    ]);
  });

  it('tells of a partner, of each child, of a split, and of the first home only', () => {
    const state = life('nurse');
    let story = storyStart(content, viewOf(state));
    story = step(story, state, (v) => (v.player.life.partner = true));
    story = step(story, state, (v) => {
      v.player.life.partner = true;
      v.player.life.children = [10];
    });
    story = step(story, state, (v) => {
      v.player.life.partner = true;
      v.player.life.children = [9, 10];
    });
    story = step(story, state, (v) => (v.player.life.children = [8, 9]));
    expect(story.milestones).toEqual<Milestone[]>([
      { round: 0, kind: 'partner' },
      { round: 0, kind: 'child', first: true },
      { round: 0, kind: 'child', first: false },
      { round: 0, kind: 'split' },
    ]);

    const home = { id: 'property-1', cityId: 'madrid', typeId: 'flat', value: 1, basis: 1, rented: false, mortgageId: null };
    story = step(story, state, (v) => v.player.properties.push(home));
    story = step(story, state, () => undefined);
    story = step(story, state, (v) => v.player.properties.push({ ...home, id: 'property-2', typeId: 'villa' }));
    expect(story.milestones.filter((m) => m.kind === 'home')).toEqual([{ round: 0, kind: 'home', typeId: 'flat' }]);
  });

  it('tells of a move, a bankruptcy, an escape and its loss as the game reports them', () => {
    const state = life('nurse');
    const story = step(storyStart(content, viewOf(state)), state, () => undefined, [
      { kind: 'escaped', round: 3 },
      { kind: 'moved', cityId: 'dubai' },
      { kind: 'bankrupt', proceeds: 0, debtsCleared: 0 },
      { kind: 'escapeLost' },
    ]);
    expect(kinds(story)).toEqual(['bankrupt', 'moved', 'escaped', 'escapeLost']);
  });

  it('tells of a business started and of one sold', () => {
    const state = life('nurse');
    let story = step(storyStart(content, viewOf(state)), state, (v) => (v.player.life.flags.has_business = 0));
    story = step(story, state, (v) => (v.player.life.flags.sold_business = 0));
    expect(kinds(story)).toEqual(['business', 'soldBusiness']);
  });

  it('marks each sum the first time the life is worth it, and never again', () => {
    const state = life('nurse');
    let story = storyStart(content, viewOf(state));
    story = step(story, state, (v) => (v.player.cash = WORTH_MARKS[1] + 1));
    expect(story.milestones).toEqual([
      { round: 0, kind: 'worth', mark: WORTH_MARKS[0] },
      { round: 0, kind: 'worth', mark: WORTH_MARKS[1] },
    ]);
    // Losing it and making it back is not a second first million.
    story = step(story, state, (v) => (v.player.cash = 0));
    story = step(story, state, (v) => (v.player.cash = WORTH_MARKS[1] + 1));
    expect(story.milestones).toHaveLength(2);
  });

  it('tells of a crisis once, when it opens', () => {
    const state = life('nurse');
    const during = (year: number) => (v: GameView) => (v.timeline[v.round].crisis = { id: 'crash', year, of: 3 });
    let story = step(storyStart(content, viewOf(state)), state, during(1));
    story = step(story, state, during(2));
    story = step(story, state, () => undefined);
    expect(story.milestones).toEqual([{ round: 0, kind: 'crisis', crisisId: 'crash' }]);
  });

  it('is rebuilt the same by playing the same life again', () => {
    const play = (): Story => {
      let state = life('engineer', 'again');
      let story = storyStart(content, viewOf(state));
      for (let round = 0; round < content.rounds; round++) {
        while (state.phase === 'cards') {
          const result = applyCard(content, state, 1);
          story = storyAfter(content, story, viewOf(result.state), result.events);
          state = result.state;
        }
        const result = applyRound(content, state, { orders: [{ type: 'focus', action: 'studyCareer' }] });
        story = storyAfter(content, story, viewOf(result.state), result.events);
        state = result.state;
      }
      return story;
    };
    const told = play();
    expect(play()).toEqual(told);
    // Forty years of studying every round lead somewhere: this life has something to tell.
    expect(told.milestones.length).toBeGreaterThan(2);
    expect(told.milestones.map((m) => m.round)).toEqual([...told.milestones.map((m) => m.round)].sort((a, b) => a - b));
  });
});
