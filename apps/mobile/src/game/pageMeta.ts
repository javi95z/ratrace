import { LOCALES, type Locale } from '@ratrace/i18n/locales';
import type { Page } from './pageList';
import { hrefOf } from './pages';

/*
 * What a page tells a search engine and a network a link to it is shared on, as the Next web's `pageMetadata` (apps/web/src/i18n/metadata.ts) and its
 * layout (apps/web/src/app/[locale]/layout.tsx) write it into the HTML: the title, the description, the page's own address and its twin in each language,
 * the card with its picture, and the game's name, keywords, manifest and icons. It is a list of plain tags, so a test can hold it to the web's, and
 * `pageHead.web.tsx` hands it to the document.
 */

/** A tag of the document's head. */
export type HeadTag =
  | { tag: 'title'; text: string }
  | { tag: 'meta'; name?: string; property?: string; content: string }
  | { tag: 'link'; rel: string; href: string; hrefLang?: string; sizes?: string; type?: string };

/** The words of the `meta` section of a language's messages. */
export interface MetaWords {
  /** The name of the game. */
  title: string;
  description: string;
  /** The page's own name, by page (none for the front door: the game's name alone). */
  titles: { new: string; play: string; collection: string; records: string; rankings: string; challenge: string; room: string; player: string; legal: string };
  /** What the shared picture shows, for whoever cannot see it. */
  imageAlt: string;
  /** The words a search is made with, separated by commas. */
  keywords: string;
}

/** How each language is written for the networks that read Open Graph. */
const OG_LOCALE: Record<Locale, string> = { en: 'en_US', es: 'es_ES', ru: 'ru_RU' };

/** The language a page without one falls back to in a search: the game's first. */
const X_DEFAULT: Locale = 'en';

/** The picture a shared link shows, drawn by `scripts/sitePieces.ts`: the same for every language, at the size every network asks for. */
const SHARE_IMAGE = { path: '/og.png', width: 1200, height: 630, type: 'image/png' } as const;

const meta = (name: string, content: string): HeadTag => ({ tag: 'meta', name, content });
const property = (name: string, content: string): HeadTag => ({ tag: 'meta', property: name, content });

/**
 * The head of a page in a language, in the order Next writes it. The addresses of the page and of its twins, and the picture, are made absolute
 * against `site`; the manifest and the icons stay as they are the Next web's, paths of the site. A life on screen (`play`) is one player's own and is
 * not to be found in a search. The room's code is no part of its address: one page, however many games.
 */
export function headTagsOf(locale: Locale, page: Page, words: MetaWords, site: URL): HeadTag[] {
  const own = page === '' ? undefined : words.titles[page];
  const full = own === undefined ? words.title : `${own} · ${words.title}`;
  const absolute = (path: string) => new URL(path, site).href;
  const url = absolute(hrefOf(page, { locale }));
  const picture = absolute(SHARE_IMAGE.path);
  const rest = LOCALES.filter((other) => other !== locale);
  return [
    { tag: 'title', text: full },
    meta('description', words.description),
    meta('application-name', words.title),
    { tag: 'link', rel: 'manifest', href: '/manifest.webmanifest' },
    meta('keywords', words.keywords.split(',').map((word) => word.trim()).join(',')),
    meta('category', 'games'),
    ...(page === 'play' ? [meta('robots', 'noindex, follow')] : []),
    { tag: 'link', rel: 'canonical', href: url },
    ...LOCALES.map((other): HeadTag => ({ tag: 'link', rel: 'alternate', hrefLang: other, href: absolute(hrefOf(page, { locale: other })) })),
    { tag: 'link', rel: 'alternate', hrefLang: 'x-default', href: absolute(hrefOf(page, { locale: X_DEFAULT })) },
    meta('mobile-web-app-capable', 'yes'),
    meta('apple-mobile-web-app-title', words.title),
    meta('apple-mobile-web-app-status-bar-style', 'black-translucent'),
    property('og:title', full),
    property('og:description', words.description),
    property('og:url', url),
    property('og:site_name', words.title),
    property('og:locale', OG_LOCALE[locale]),
    property('og:image', picture),
    property('og:image:type', SHARE_IMAGE.type),
    property('og:image:width', String(SHARE_IMAGE.width)),
    property('og:image:height', String(SHARE_IMAGE.height)),
    property('og:image:alt', words.imageAlt),
    ...rest.map((other) => property('og:locale:alternate', OG_LOCALE[other])),
    property('og:type', 'website'),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', full),
    meta('twitter:description', words.description),
    meta('twitter:image', picture),
    meta('twitter:image:alt', words.imageAlt),
    meta('twitter:image:type', SHARE_IMAGE.type),
    meta('twitter:image:width', String(SHARE_IMAGE.width)),
    meta('twitter:image:height', String(SHARE_IMAGE.height)),
    { tag: 'link', rel: 'shortcut icon', href: '/favicon.ico', sizes: '32x32', type: 'image/png' },
    { tag: 'link', rel: 'icon', href: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { tag: 'link', rel: 'icon', href: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { tag: 'link', rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  ];
}
