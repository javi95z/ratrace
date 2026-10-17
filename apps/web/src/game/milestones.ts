import type { Milestone, MilestoneScene } from '@ratrace/content';

/** The scenes worth a picture, the biggest first when two come in the same two years. */
const ORDER: readonly MilestoneScene[] = ['retired', 'businessSold', 'promotion', 'home', 'wedding', 'child'];

/**
 * The milestone of a life to show with the round just played, from its cards to its end: the first
 * home, the first partner, the first child, the first business sold, the top of a career, retiring.
 * Each the first of its kind in the life, or nothing.
 */
export function milestoneOf(story: readonly Milestone[], fromRound: number, toRound: number): MilestoneScene | null {
  const found = new Set<MilestoneScene>();
  const seenBefore = (kind: Milestone['kind']) => story.some((m) => m.kind === kind && m.round < fromRound);
  for (const m of story) {
    if (m.round < fromRound || m.round > toRound) continue;
    if (m.kind === 'home' && !seenBefore('home')) found.add('home');
    if (m.kind === 'partner' && !seenBefore('partner')) found.add('wedding');
    if (m.kind === 'child' && m.first) found.add('child');
    if (m.kind === 'soldBusiness' && !seenBefore('soldBusiness')) found.add('businessSold');
    if (m.kind === 'retired') found.add('retired');
    if (m.kind === 'promoted' && m.top) found.add('promotion');
  }
  return ORDER.find((scene) => found.has(scene)) ?? null;
}
