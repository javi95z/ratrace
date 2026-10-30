import { describe, expect, it, vi } from 'vitest';
import { amongBestThree, ASK_GAP_MS, askForReview, mayAsk, MOST_ASKS, type ReviewMemory, type ReviewsAsked, type ReviewStore } from './reviewTimes';

/** A phone's memory of the asking, in a box. */
function memory(start: ReviewsAsked | null = null): ReviewMemory & { kept: ReviewsAsked | null } {
  const box = {
    kept: start,
    read: () => box.kept,
    write: (asked: ReviewsAsked) => void (box.kept = asked),
  };
  return box;
}

/** A store that has its prompt (or not), and counts how often it is shown. */
function store(has = true) {
  const fake = { hasAction: vi.fn(async () => has), requestReview: vi.fn(async () => undefined) } satisfies ReviewStore;
  return { fake, load: async () => fake };
}

const DAY = 24 * 60 * 60 * 1000;

describe('when the game may ask for a rating', () => {
  it('asks the first time, and notes it', async () => {
    const kept = memory();
    const { fake, load } = store();
    expect(await askForReview({ store: load, memory: kept, now: () => 1_000, release: true })).toBe(true);
    expect(fake.requestReview).toHaveBeenCalledOnce();
    expect(kept.kept).toEqual({ times: 1, last: 1_000 });
  });

  it('never asks twice within 120 days, and asks again after them', async () => {
    let now = 0;
    const kept = memory();
    const { fake, load } = store();
    const ask = () => askForReview({ store: load, memory: kept, now: () => now, release: true });
    expect(await ask()).toBe(true);
    now = 119 * DAY;
    expect(await ask()).toBe(false);
    now = ASK_GAP_MS;
    expect(await ask()).toBe(true);
    expect(fake.requestReview).toHaveBeenCalledTimes(2);
    expect(kept.kept).toEqual({ times: 2, last: ASK_GAP_MS });
  });

  it('asks three times ever at most, however long apart', async () => {
    let now = 0;
    const kept = memory();
    const { fake, load } = store();
    for (let i = 0; i < 5; i += 1) {
      await askForReview({ store: load, memory: kept, now: () => now, release: true });
      now += 365 * DAY;
    }
    expect(fake.requestReview).toHaveBeenCalledTimes(MOST_ASKS);
    expect(mayAsk({ times: MOST_ASKS, last: 0 }, 10 * 365 * DAY)).toBe(false);
  });

  it('asks nothing in a build that is not for players, nor where the store has no prompt, nor where there is no store', async () => {
    const kept = memory();
    const { fake, load } = store();
    expect(await askForReview({ store: load, memory: kept, now: () => 0, release: false })).toBe(false);
    expect(fake.hasAction).not.toHaveBeenCalled();

    const none = store(false);
    expect(await askForReview({ store: none.load, memory: kept, now: () => 0, release: true })).toBe(false);
    expect(none.fake.requestReview).not.toHaveBeenCalled();
    expect(await askForReview({ store: async () => null, memory: kept, now: () => 0, release: true })).toBe(false);
    // Nothing shown is nothing counted.
    expect(kept.kept).toBeNull();
  });

  it('asks once when asked twice at the same moment', async () => {
    const kept = memory();
    const { fake, load } = store();
    const ask = () => askForReview({ store: load, memory: kept, now: () => 0, release: true });
    expect(await Promise.all([ask(), ask()])).toEqual([true, false]);
    expect(fake.requestReview).toHaveBeenCalledOnce();
  });

  it('is never an error: a store that fails is a prompt not shown', async () => {
    const kept = memory();
    const failing: ReviewStore = { hasAction: async () => Promise.reject(new Error('no store')), requestReview: async () => undefined };
    expect(await askForReview({ store: async () => failing, memory: kept, now: () => 0, release: true })).toBe(false);
    expect(kept.kept).toBeNull();
  });
});

describe('a life among the best three', () => {
  it('is one fewer than three lives scored more than', () => {
    expect(amongBestThree(500, [])).toBe(true);
    expect(amongBestThree(500, [900, 800, 500, 100])).toBe(true);
    expect(amongBestThree(500, [900, 800, 700])).toBe(false);
  });
});
