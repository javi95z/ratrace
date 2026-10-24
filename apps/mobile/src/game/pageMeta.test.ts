import { messagesFor } from '@ratrace/i18n';
import { LOCALES } from '@ratrace/i18n/locales';
import { describe, expect, it } from 'vitest';
import { PAGES as WEB_PAGES, pageMetadata, SITE_URL as WEB_SITE } from '../../../web/src/i18n/metadata';

type Metadata = ReturnType<typeof pageMetadata>;
import { PAGES } from './pageList';
import { headTagsOf, type HeadTag, type MetaWords } from './pageMeta';
import { SITE_URL } from './site';

/*
 * What a page tells search and a shared link, held to the Next web's own: the web's `pageMetadata` is called for the same page in the same
 * language, what it says is written out the way Next writes it into the HTML (apps/web/src/app/[locale]/layout.tsx adds the rest), and the app's
 * head must say the same, tag for tag.
 */

const SITE = new URL('https://rats.example');

/** A tag as one line, `kind:key=value`, so two heads compare as lists of lines. */
function line(tag: HeadTag): string {
  if (tag.tag === 'title') return `title=${tag.text}`;
  if (tag.tag === 'meta') return `meta:${tag.name ?? tag.property}=${tag.content}`;
  return `link:${tag.rel}${tag.hrefLang ? `:${tag.hrefLang}` : ''}=${tag.href}`;
}

/** The lines Next writes for a page's own metadata (`pageMetadata`'s title, description, addresses, Open Graph, card and robots), addresses made absolute against `site`. */
function nextLines(meta: Metadata, site: URL, name: string): string[] {
  const at = (path: string | URL) => new URL(String(path), site).href;
  const out: string[] = [];
  out.push(`title=${typeof meta.title === 'string' ? `${meta.title} · ${name}` : name}`);
  out.push(`meta:description=${meta.description}`);
  if (meta.robots && typeof meta.robots === 'object' && 'index' in meta.robots) out.push(`meta:robots=${meta.robots.index ? 'index' : 'noindex'}, ${meta.robots.follow ? 'follow' : 'nofollow'}`);
  const { canonical, languages = {} } = meta.alternates ?? {};
  out.push(`link:canonical=${at(String(canonical))}`);
  for (const [language, href] of Object.entries(languages)) out.push(`link:alternate:${language}=${at(String(href))}`);
  const og = meta.openGraph as Record<string, unknown>;
  const image = (og.images as Array<{ url: string; width: number; height: number; alt: string; type: string }>)[0];
  out.push(`meta:og:title=${og.title}`, `meta:og:description=${og.description}`, `meta:og:url=${at(String(og.url))}`, `meta:og:site_name=${og.siteName}`, `meta:og:locale=${og.locale}`);
  for (const other of og.alternateLocale as string[]) out.push(`meta:og:locale:alternate=${other}`);
  out.push(`meta:og:type=${og.type}`, `meta:og:image=${at(image.url)}`, `meta:og:image:type=${image.type}`, `meta:og:image:width=${image.width}`, `meta:og:image:height=${image.height}`, `meta:og:image:alt=${image.alt}`);
  const card = meta.twitter as Record<string, unknown>;
  out.push(`meta:twitter:card=${card.card}`, `meta:twitter:title=${card.title}`, `meta:twitter:description=${card.description}`, `meta:twitter:image=${at(image.url)}`, `meta:twitter:image:alt=${image.alt}`, `meta:twitter:image:type=${image.type}`, `meta:twitter:image:width=${image.width}`, `meta:twitter:image:height=${image.height}`);
  return out;
}

/** The lines of the app's head that the web's page metadata speaks of (the others are the layout's, below). */
const PAGE_KEYS = /^(title|meta:(description|robots|og:.*|twitter:.*)|link:(canonical|alternate:.*))=/;

const nameOf = (locale: (typeof LOCALES)[number]) => (messagesFor(locale).meta as MetaWords).title;
const wordsOf = (locale: (typeof LOCALES)[number]) => messagesFor(locale).meta as MetaWords;
const TITLE_OF: Record<string, keyof MetaWords['titles'] | undefined> = { '': undefined, new: 'new', play: 'play', collection: 'collection', records: 'records', rankings: 'rankings', challenge: 'challenge', room: 'room', player: 'player', legal: 'legal' };

describe('the head of a page', () => {
  it('lists the same pages as the Next web, in the same order', () => {
    expect(PAGES.map((page) => (page === '' ? '' : `/${page}`))).toEqual([...WEB_PAGES]);
  });

  it.each(LOCALES)('says in %s what the Next web says of each page: title, description, addresses, Open Graph, card and robots', (locale) => {
    const words = wordsOf(locale);
    for (const page of PAGES) {
      const path = page === '' ? '' : `/${page}`;
      const titled = TITLE_OF[page];
      const next = pageMetadata(locale, path as (typeof WEB_PAGES)[number], { name: words.title, description: words.description, imageAlt: words.imageAlt, title: titled ? words.titles[titled] : undefined });
      const mine = headTagsOf(locale, page, words, SITE).map(line).filter((one) => PAGE_KEYS.test(one));
      expect(mine.sort(), `${locale}${path}`).toEqual(nextLines(next, SITE, nameOf(locale)).sort());
    }
  });

  it('is the web\'s exactly when the site is the web\'s: the canonical of /es/rankings against the one Next wrote', () => {
    const tags = headTagsOf('es', 'rankings', wordsOf('es'), WEB_SITE).map(line);
    expect(tags).toContain(`link:canonical=${new URL('/es/rankings', WEB_SITE).href}`);
    expect(tags).toContain('title=Clasificaciones · The Rat Race');
    expect(SITE_URL.href).toBe(WEB_SITE.href);
  });

  it('says that /play is not to be found in a search, and no other page', () => {
    for (const page of PAGES) {
      const robots = headTagsOf('en', page, wordsOf('en'), SITE).filter((tag) => tag.tag === 'meta' && tag.name === 'robots');
      expect(robots, page).toEqual(page === 'play' ? [{ tag: 'meta', name: 'robots', content: 'noindex, follow' }] : []);
    }
  });

  it('names the game, its keywords, its manifest and its icons on every page, as the Next web\'s layout does', () => {
    const tags = headTagsOf('ru', 'legal', wordsOf('ru'), SITE).map(line);
    const words = wordsOf('ru');
    expect(tags).toEqual(
      expect.arrayContaining([
        `meta:application-name=${words.title}`,
        `meta:keywords=${words.keywords.split(',').map((word) => word.trim()).join(',')}`,
        'meta:category=games',
        'link:manifest=/manifest.webmanifest',
        'meta:mobile-web-app-capable=yes',
        `meta:apple-mobile-web-app-title=${words.title}`,
        'meta:apple-mobile-web-app-status-bar-style=black-translucent',
        'link:shortcut icon=/favicon.ico',
        'link:icon=/icons/icon-192.png',
        'link:icon=/icons/icon-512.png',
        'link:apple-touch-icon=/icons/apple-touch-icon.png',
      ]),
    );
    expect(headTagsOf('ru', 'legal', words, SITE)).toContainEqual({ tag: 'link', rel: 'icon', href: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' });
    expect(headTagsOf('ru', 'legal', words, SITE)).toContainEqual({ tag: 'link', rel: 'shortcut icon', href: '/favicon.ico', sizes: '32x32', type: 'image/png' });
    expect(headTagsOf('ru', 'legal', words, SITE)).toContainEqual({ tag: 'link', rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' });
  });

  it('gives a room\'s page the address without its code: one page, however many games', () => {
    const tags = headTagsOf('en', 'room', wordsOf('en'), SITE).map(line);
    expect(tags).toContain('link:canonical=https://rats.example/en/room');
  });
});
