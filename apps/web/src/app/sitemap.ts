import type { MetadataRoute } from 'next';
import { PAGES, SITE_URL } from '@/i18n/metadata';
import { routing } from '@/i18n/routing';

/** Every page worth finding, in each language, each naming its twins in the others. A life on screen is a player's own, and is left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => new URL(path, SITE_URL).href;
  return PAGES.filter((page) => page !== '/play').flatMap((page) =>
    routing.locales.map((locale) => ({
      url: at(`/${locale}${page}`),
      changeFrequency: page === '/challenge' || page === '/rankings' ? ('weekly' as const) : ('monthly' as const),
      priority: page === '' ? 1 : 0.6,
      alternates: { languages: Object.fromEntries(routing.locales.map((other) => [other, at(`/${other}${page}`)])) },
    })),
  );
}
