import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, Jersey_15 } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { GameProvider } from '@/game/context';
import { routing } from '@/i18n/routing';
import '../globals.css';

const pixel = Jersey_15({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-jersey', display: 'swap' });
// The two weights the game sets sentences in: plain, and the heavier one of a headline.
const reading = Chakra_Petch({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--font-chakra', display: 'swap' });

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    // A page gives its own title and the game's name follows it; the front door is the game's name alone.
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    icons: { icon: '/sprites/brand/brand.app_icon.png' },
  };
}

export const viewport: Viewport = {
  themeColor: '#141b33',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${pixel.variable} ${reading.variable}`}>
      <body>
        <NextIntlClientProvider>
          <GameProvider>{children}</GameProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
