import type { Metadata, Viewport } from 'next';
import { Inter, Pixelify_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { GameProvider } from '@/game/context';
import { routing } from '@/i18n/routing';
import '../globals.css';

const pixel = Pixelify_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-pixelify', display: 'swap' });
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

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
    <html lang={locale} className={`${pixel.variable} ${inter.variable}`}>
      <body>
        <NextIntlClientProvider>
          <GameProvider>{children}</GameProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
