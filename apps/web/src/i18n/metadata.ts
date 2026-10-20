import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from './routing';
import type { AppLocale } from './routing';

export { SITE_URL } from '@/lib/site';

/** The pages a link can lead to, by the path after the language. The front door is the empty one. */
export const PAGES = ['', '/new', '/challenge', '/room', '/rankings', '/collection', '/records', '/play', '/player', '/legal'] as const;
export type Page = (typeof PAGES)[number];
const TITLE_OF: Partial<Record<Page, 'new' | 'play' | 'collection' | 'records' | 'rankings' | 'challenge' | 'room' | 'player' | 'legal'>> = {
  '/new': 'new',
  '/play': 'play',
  '/collection': 'collection',
  '/records': 'records',
  '/rankings': 'rankings',
  '/challenge': 'challenge',
  '/room': 'room',
  '/player': 'player',
  '/legal': 'legal',
};

/** How each language is written for the networks that read Open Graph. */
const OG_LOCALE: Record<AppLocale, string> = { en: 'en_US', es: 'es_ES', ru: 'ru_RU' };

/** The picture a shared link shows: drawn by `scripts/pwa.ts`, the same for every language. */
export const SHARE_IMAGE = { url: '/og.png', width: 1200, height: 630 } as const;

/** What a page is called and what it says, in its language, as plain words. */
export interface PageWords {
  /** The name of the game. */
  name: string;
  description: string;
  /** What the shared picture shows, for whoever cannot see it. */
  imageAlt: string;
  /** The page's own title, or none for the front door, which is the game's name alone. */
  title?: string;
}

/**
 * Everything a page tells a browser, a search engine and a network that a link to it is shared on:
 * its title, the address that is the page's own and its twin in each language, and the card with
 * its picture. Open Graph and the card are given whole on every page, never in part: a page that
 * named only its title would leave the rest behind.
 */
export function pageMetadata(locale: AppLocale, page: Page, words: PageWords): Metadata {
  const full = words.title ? `${words.title} · ${words.name}` : words.name;
  const url = `/${locale}${page}`;
  const languages = Object.fromEntries([...routing.locales.map((other) => [other, `/${other}${page}`]), ['x-default', `/${routing.defaultLocale}${page}`]]);
  const image = { ...SHARE_IMAGE, alt: words.imageAlt, type: 'image/png' };
  return {
    // The layout's template adds the game's name to a page's own title.
    ...(words.title ? { title: words.title } : {}),
    description: words.description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: 'website',
      siteName: words.name,
      title: full,
      description: words.description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: full, description: words.description, images: [image] },
    // A life on screen is one player's own: it is not a page to find in a search.
    ...(page === '/play' ? { robots: { index: false, follow: true } } : {}),
  };
}

/** The metadata of a page in the language of its address, read from that language's words. */
export async function metadataOf(params: Promise<{ locale: string }>, page: Page): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  const titled = TITLE_OF[page];
  return pageMetadata(locale, page, { name: t('title'), description: t('description'), imageAlt: t('imageAlt'), title: titled ? t(`titles.${titled}`) : undefined });
}
