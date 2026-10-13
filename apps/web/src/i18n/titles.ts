import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from './routing';

/** The title of a page in its language. The layout adds the name of the game after it. */
export async function titleOf(params: Promise<{ locale: string }>, page: 'new' | 'play' | 'collection' | 'records'): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t(`titles.${page}`) };
}
