import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';

// The phone may not import a file of the web, so it holds its own copy of who answers for the game (the legal notice names them) and of where
// the game lives (a picture of a life carries the way into it), and this holds the copy to the web's: the same constants, read the same way,
// from the variables of the build that makes it.
const phone = readFileSync(new URL('./site.ts', import.meta.url), 'utf8');
const web = readFileSync(new URL('../../../web/src/lib/site.ts', import.meta.url), 'utf8');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** The address the web is published at today: the last word of its `SITE_URL`, after the build's variable and Vercel's production address. */
const publishedOf = (source: string) => {
  const block = source.slice(source.indexOf('export const SITE_URL = new URL('), source.indexOf(');', source.indexOf('export const SITE_URL')));
  return [...block.matchAll(/'(https:\/\/[^']+)'/g)].at(-1)?.[1];
};

const constantOf = (source: string, name: string) => /export const (\w+) = (.*);/.exec(source.split('\n').filter((line) => line.startsWith(`export const ${name} =`))[0] ?? '')?.[0];

test('the owner and the contact of the legal notice are read as the web reads them, from the build\'s own variables', () => {
  for (const name of ['LEGAL_NAME', 'LEGAL_EMAIL']) {
    const theirs = constantOf(web, name);
    expect(theirs, `the web's ${name}`).toBeDefined();
    expect(constantOf(phone, name), name).toBe(theirs?.replace('NEXT_PUBLIC_', 'EXPO_PUBLIC_'));
  }
});

test('they are the two the web has: no more constants than it names', () => {
  const names = (source: string) => [...source.matchAll(/^export const (LEGAL_\w+)/gm)].map((m) => m[1]);
  expect(names(phone)).toEqual(['LEGAL_NAME', 'LEGAL_EMAIL']);
  expect(names(web)).toEqual(['LEGAL_NAME', 'LEGAL_EMAIL']);
});

test('they are written the way Expo inlines a variable of the build: process.env.EXPO_PUBLIC_<NAME>, named in full', () => {
  expect(phone).toContain('process.env.EXPO_PUBLIC_LEGAL_NAME');
  expect(phone).toContain('process.env.EXPO_PUBLIC_LEGAL_EMAIL');
});

test('where the game lives is the web\'s own address, read as the web reads it: the build\'s variable first, then the address it is published at today', () => {
  // Between the two the web names Vercel's production address, which only a build on Vercel has; its last word is the address it is published at.
  const published = publishedOf(web);
  expect(published).toMatch(/^https:\/\//);
  // The variable is trimmed, and an empty one is no address, as the legal notice's are read: `new URL('')` would stop the app as it starts.
  expect(phone).toContain(`export const SITE_URL = new URL(process.env.EXPO_PUBLIC_SITE_URL?.trim() || '${published}');`);
  expect(web).toContain('process.env.NEXT_PUBLIC_SITE_URL ??');
});

test('a build that names the address empty, or as spaces, gets the published one; one named with spaces round it is read without them', async () => {
  const published = new URL(publishedOf(web) as string).href;
  for (const [given, address] of [['', published], ['   ', published], [' https://example.test/play ', 'https://example.test/play']]) {
    vi.stubEnv('EXPO_PUBLIC_SITE_URL', given);
    vi.resetModules();
    const { SITE_URL } = await import('./site');
    expect(SITE_URL.href, JSON.stringify(given)).toBe(address);
  }
});

test('the way into the game a picture of a life carries is that address, in the language of the life, as the web\'s share card writes it', async () => {
  const { SITE_URL } = await import('./site');
  const { hrefOf } = await import('./pages');
  expect(new URL('/en', SITE_URL).href).toBe(`${SITE_URL.origin}/en`);
  const card = readFileSync(new URL('../../../web/src/game/screens/ShareCard.tsx', import.meta.url), 'utf8');
  expect(card).toContain("const invite = t('invite', { url: new URL(`/${locale}`, SITE_URL).href });");
  // The app writes the address of the front door of a language through its pages (`hrefOf`), which is the web's `/${locale}`.
  expect(readFileSync(new URL('./screens/ShareCard.tsx', import.meta.url), 'utf8')).toContain("const invite = t('invite', { url: new URL(hrefOf('', { locale }), SITE_URL).href });");
  for (const locale of ['en', 'es', 'ru']) expect(hrefOf('', { locale })).toBe(`/${locale}`);
});
