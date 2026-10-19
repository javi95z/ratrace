import type { CryptoPhase, Headline } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { CELEB_ART, headlineArt, headlineVoice } from './art';
import { content } from './content';
import { textFor } from './text';

/** Every headline that tells something of the coming round, in each of its forms. */
const PHASES: CryptoPhase[] = ['accumulation', 'bull', 'mania', 'winter'];
const telling: Headline[] = [
  ...PHASES.map((phase): Headline => ({ topic: 'crypto', phase })),
  ...content.assets.filter((asset) => asset.class !== 'crypto' && asset.class !== 'bond').flatMap((asset) => (['up', 'down'] as const).map((trend): Headline => ({ topic: 'asset', assetId: asset.id, trend }))),
  ...(['up', 'down'] as const).map((trend): Headline => ({ topic: 'property', cityId: content.cities[0].id, trend })),
  ...(['up', 'down', 'flat'] as const).map((trend): Headline => ({ topic: 'inflation', trend })),
  ...(['up', 'down', 'flat'] as const).map((trend): Headline => ({ topic: 'rates', trend })),
];

describe('the famous saying the news', () => {
  it('speak on every other one only, and never for filler, the government, rates or taxes', () => {
    for (const h of telling) expect(headlineVoice(h, 1)).toBeNull();
    for (const h of [{ topic: 'noise', id: 0 }, { topic: 'government', id: 0 }, { topic: 'rates', trend: 'up' }, { topic: 'taxes', cityId: 'madrid', trend: 'up' }, { topic: 'regime', regime: 'boom' }] as Headline[]) {
      expect(headlineVoice(h, 0)).toBeNull();
    }
  });

  it('use every line they have, and each is written in every language, with the name it needs', () => {
    const used = new Set(telling.flatMap((h) => {
      const voice = headlineVoice(h, 0);
      return voice === null ? [] : [`${voice.celeb}.${String(voice.line)}`];
    }));
    for (const locale of ['en', 'es', 'ru'] as const) {
      const celebs = textFor(locale).text.headlines.celebs;
      const lines = Object.entries(celebs).flatMap(([celeb, said]) => Object.entries(said).map(([line, words]) => ({ key: `${celeb}.${line}`, words: words as string })));
      expect(new Set(lines.map((one) => one.key)), locale).toEqual(used);
      for (const { key, words } of lines) {
        expect(words.trim(), `${locale} ${key}`).not.toBe('');
        const about = telling.find((h) => { const v = headlineVoice(h, 0); return v !== null && `${v.celeb}.${String(v.line)}` === key; }) as Headline;
        // An investment's line names it, a city's names the city; gold and the rest name nothing.
        expect(words.includes('{asset}'), `${locale} ${key}`).toBe(about.topic === 'asset' && about.assetId !== 'gold');
        expect(words.includes('{city}'), `${locale} ${key}`).toBe(about.topic === 'property');
      }
    }
  });

  it('show their own portrait beside what they say', () => {
    for (const h of telling) {
      const voice = headlineVoice(h, 0);
      if (voice === null) expect(headlineArt(h, 0)).not.toMatch(/^celeb\./);
      else expect(headlineArt(h, 0)).toBe(`celeb.${voice.celeb}`);
      expect(CELEB_ART).not.toContain(headlineArt(h, 1));
      expect(CELEB_ART).not.toContain(headlineArt(h));
    }
  });
});
