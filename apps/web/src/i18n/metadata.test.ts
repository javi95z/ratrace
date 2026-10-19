import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import en from '@ratrace/i18n/messages/en.json';
import es from '@ratrace/i18n/messages/es.json';
import ru from '@ratrace/i18n/messages/ru.json';
import { PAGES, pageMetadata, SHARE_IMAGE, SITE_URL } from './metadata';

const words = { name: 'The Rat Race', description: 'Forty years.', imageAlt: 'A rat in a wheel.' };

describe('what a shared link shows', () => {
  it('gives every page its own address, its twins in every language, and the whole card', () => {
    const page = pageMetadata('es', '/challenge', { ...words, title: 'Reto de la semana' });
    expect(page.title).toBe('Reto de la semana');
    expect(page.alternates).toEqual({
      canonical: '/es/challenge',
      languages: { en: '/en/challenge', es: '/es/challenge', ru: '/ru/challenge', 'x-default': '/en/challenge' },
    });
    expect(page.openGraph).toMatchObject({
      type: 'website',
      siteName: 'The Rat Race',
      title: 'Reto de la semana · The Rat Race',
      description: 'Forty years.',
      url: '/es/challenge',
      locale: 'es_ES',
      alternateLocale: ['en_US', 'ru_RU'],
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'A rat in a wheel.', type: 'image/png' }],
    });
    expect(page.twitter).toMatchObject({ card: 'summary_large_image', title: 'Reto de la semana · The Rat Race', images: [{ url: SHARE_IMAGE.url }] });
    expect(page.robots).toBeUndefined();
  });

  it('calls the front door by the game\'s name alone, and keeps a life on screen out of searches', () => {
    const home = pageMetadata('en', '', words);
    expect(home.title).toBeUndefined();
    expect(home.openGraph).toMatchObject({ title: 'The Rat Race', url: '/en' });
    expect(pageMetadata('ru', '/play', { ...words, title: 'Твоя жизнь' }).robots).toEqual({ index: false, follow: true });
  });

  it('has the words of the card in every language, and a picture of the size the networks ask for', () => {
    for (const messages of [en, es, ru]) {
      expect(messages.meta.description.length).toBeGreaterThan(20);
      expect(messages.meta.description.length).toBeLessThanOrEqual(160);
      expect(messages.meta.imageAlt.length).toBeGreaterThan(20);
      expect(messages.meta.keywords.split(',').length).toBeGreaterThanOrEqual(4);
    }
    expect(SHARE_IMAGE).toMatchObject({ width: 1200, height: 630 });
  });

  it('lists every page to be found in every language in the sitemap, and points robots to it', () => {
    const entries = sitemap();
    expect(entries).toHaveLength((PAGES.length - 1) * 3);
    expect(entries.map((entry) => entry.url)).not.toContain(new URL('/en/play', SITE_URL).href);
    const home = entries.find((entry) => entry.url === new URL('/es', SITE_URL).href);
    expect(home?.alternates?.languages).toEqual({ en: new URL('/en', SITE_URL).href, es: new URL('/es', SITE_URL).href, ru: new URL('/ru', SITE_URL).href });
    expect(robots().sitemap).toBe(new URL('/sitemap.xml', SITE_URL).href);
  });
});
