import { content, lives, textFor } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { createGame, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { formatFor } from '@/lib/format';
import en from '@ratrace/i18n/messages/en.json';
import es from '@ratrace/i18n/messages/es.json';
import { chapters, epilogue } from './epilogue';
import type { Translate, Words } from './present';

const words = (locale: 'en' | 'es'): Words => ({ content, ...textFor(locale), fmt: formatFor(locale) });

/** A translator that reads the messages as written and fills their placeholders, as the pages do. */
function translator(locale: 'en' | 'es'): Translate {
  const section = (locale === 'en' ? en : es).epilogue as unknown as Record<string, unknown>;
  return (key, values = {}) => {
    let found: unknown = section;
    for (const part of key.split('.')) found = (found as Record<string, unknown> | undefined)?.[part];
    if (typeof found !== 'string') throw new Error(`no epilogue text for ${key}`);
    return found.replace(/\{(\w+)\}/g, (_, name: string) => {
      if (!(name in values)) throw new Error(`${key} needs ${name}`);
      return String(values[name]);
    });
  };
}

const life = (id: string) => lives.find((candidate) => candidate.id === id)!;
function ended(id: string, change: (view: GameView) => void = () => undefined): GameView {
  const view = viewOf(createGame({ content, start: life(id).start }, 'tale'));
  // The last round of a life, in a world that never moved: only the player matters here.
  view.timeline = Array.from({ length: content.rounds + 1 }, (_, round) => ({ ...view.timeline[0], round }));
  view.round = content.rounds;
  view.finished = true;
  change(view);
  return view;
}
const tell = (id: string, story: Milestone[], view = ended(id), locale: 'en' | 'es' = 'en', bankruptcies = 0) =>
  epilogue({ words: words(locale), t: translator(locale), life: life(id), view, story, score: 321, bankruptcies });

describe('the epilogue', () => {
  it('opens where the life began, says a quiet life was quiet, and closes on how it ended', () => {
    const [opening, middle, closing] = tell('nurse', []);
    expect(opening).toBe('You started at 22 in Madrid, as a Nurse, with $3,000 to your name.');
    expect(middle).toMatch(/^It was a quiet life/);
    expect(closing).toBe('You finished at 62 in Madrid with $3,000 and 321 points. A lifetime of early mornings, and the wheel turning to the end.');
  });

  it('tells what happened in the order it happened, each with the age it happened at', () => {
    const story: Milestone[] = [
      { round: 3, kind: 'moved', cityId: 'london' },
      { round: 4, kind: 'career', careerId: 'finance' },
      { round: 9, kind: 'crisis', crisisId: 'crash' },
      { round: 12, kind: 'worth', mark: 100_000_000 },
      { round: 14, kind: 'escaped' },
    ];
    expect(tell('nurse', story)[1]).toBe(
      'At 28 you packed your bags for London. At 30 you left it all for another career: Finance. At 40 The Great Crash found you. At 46 you were a millionaire. At 50 you left the rat race: your income paid for your life without you.',
    );
  });

  it('keeps the six that say most about a life when more happened, and only the last promotion', () => {
    const story: Milestone[] = [
      { round: 1, kind: 'promoted', careerId: 'healthcare', level: 1, top: false },
      { round: 2, kind: 'worth', mark: 10_000_000 },
      { round: 3, kind: 'partner' },
      { round: 4, kind: 'child', first: true },
      { round: 5, kind: 'promoted', careerId: 'healthcare', level: 2, top: false },
      { round: 6, kind: 'home', typeId: 'flat' },
      { round: 7, kind: 'child', first: false },
      { round: 8, kind: 'bankrupt' },
      { round: 9, kind: 'moved', cityId: 'bangkok' },
      { round: 10, kind: 'promoted', careerId: 'healthcare', level: 3, top: true },
      { round: 15, kind: 'escaped' },
    ];
    const told = chapters(story);
    expect(told).toHaveLength(6);
    // Of three things that weigh the same, the two that came first are told: the home is left out.
    expect(told.map((m) => m.kind)).toEqual(['partner', 'child', 'bankrupt', 'moved', 'promoted', 'escaped']);
    expect(told.find((m) => m.kind === 'promoted')).toMatchObject({ level: 3, top: true });
    // Told in the order they happened, whatever their weight.
    expect(told.map((m) => m.round)).toEqual([3, 4, 8, 9, 10, 15]);
  });

  it('ends a life as it earned: free, rich, broke, or simply through', () => {
    const rich = (view: GameView) => (view.player.cash = 300_000_000);
    expect(tell('nurse', [], ended('nurse', (v) => (v.player.escapedAtRound = 14)))[2]).toMatch(/free/);
    expect(tell('nurse', [], ended('nurse', rich))[2]).toMatch(/^You finished at 62 in Madrid with \$3,000,000 and 321 points\. Rich, yes/);
    expect(tell('nurse', [], ended('nurse', (v) => (v.player.cash = -5_000_00)))[2]).toMatch(/did not go as you hoped/);
    expect(tell('nurse', [], ended('nurse'), 'en', 1)[2]).toMatch(/did not go as you hoped/);
    // A bankruptcy long ago does not make a rich life a ruined one.
    expect(tell('nurse', [], ended('nurse', rich), 'en', 1)[2]).toMatch(/Rich, yes/);
  });

  it('has a sentence for every kind of milestone, in both languages, with nothing left unfilled', () => {
    const every: Milestone[] = [
      { round: 1, kind: 'promoted', careerId: 'tech', level: 1, top: false },
      { round: 1, kind: 'promoted', careerId: 'tech', level: 4, top: true },
      { round: 1, kind: 'career', careerId: 'medicine' },
      { round: 1, kind: 'jobLost' },
      { round: 1, kind: 'moved', cityId: 'singapore' },
      { round: 1, kind: 'partner' },
      { round: 1, kind: 'split' },
      { round: 1, kind: 'child', first: true },
      { round: 1, kind: 'child', first: false },
      { round: 1, kind: 'home', typeId: 'studio' },
      { round: 1, kind: 'business' },
      { round: 1, kind: 'soldBusiness' },
      { round: 1, kind: 'escaped' },
      { round: 1, kind: 'escapeLost' },
      { round: 1, kind: 'bankrupt' },
      ...content.crises.map((crisis): Milestone => ({ round: 1, kind: 'crisis', crisisId: crisis.id })),
      { round: 1, kind: 'worth', mark: 10_000_000 },
      { round: 1, kind: 'worth', mark: 100_000_000 },
      { round: 1, kind: 'worth', mark: 1_000_000_000 },
    ];
    for (const locale of ['en', 'es'] as const) {
      for (const milestone of every) {
        const [, middle] = tell('engineer', [milestone], ended('engineer'), locale);
        expect(middle, `${locale} ${milestone.kind}`).not.toMatch(/[{}]|undefined/);
        expect(middle.length, `${locale} ${milestone.kind}`).toBeGreaterThan(15);
      }
      // A life with no career opens without one.
      const jobless = { ...life('nurse'), start: { ...life('nurse').start, life: { ...life('nurse').start.life!, career: null } } };
      expect(epilogue({ words: words(locale), t: translator(locale), life: jobless, view: ended('nurse'), story: [], score: 1, bankruptcies: 0 })[0]).not.toMatch(/[{}]/);
    }
    // The space before the dollar sign is one that does not break.
    expect(tell('engineer', [], ended('engineer'), 'es')[0]).toMatch(/^Empezaste a los 22 en Tokio, de Programador júnior, con 2\.000\s\$ en el bolsillo\.$/);
  });
});
