import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, Exo_2, Handjet, Jersey_15 } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';
import { GameProvider } from '@/game/context';
import { routing } from '@/i18n/routing';
import '../globals.css';

const pixel = Jersey_15({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-jersey', display: 'swap' });
// The two weights the game sets sentences in: plain, and the heavier one of a headline.
const reading = Chakra_Petch({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--font-chakra', display: 'swap' });

// Neither draws Cyrillic. In Russian each gives way, letter by letter, to one that does; the figures and the Latin
// names stay in Jersey and Chakra. They are not fetched ahead: a page with no Cyrillic on it never asks for them.
const pixelCyrillic = Handjet({ subsets: ['cyrillic'], weight: '600', variable: '--font-pixel-cyrillic', display: 'swap', preload: false });
const readingCyrillic = Exo_2({ subsets: ['cyrillic'], weight: ['400', '600'], variable: '--font-reading-cyrillic', display: 'swap', preload: false });

/** A typeface by its own name alone, without the stand-in that is named after it for while it loads. */
const alone = (font: { style: { fontFamily: string } }) => font.style.fontFamily.split(',')[0].trim();
/**
 * What a Russian page calls the four. The stand-in a browser shows while a typeface loads is a
 * system one cut to its measure, and it has every letter, Cyrillic too: named right after Jersey
 * or Chakra, as it is everywhere else, it would draw all the Russian before the typefaces kept
 * for it were ever asked.
 */
const RUSSIAN = {
  '--font-jersey': alone(pixel),
  '--font-chakra': alone(reading),
  '--font-pixel-cyrillic': alone(pixelCyrillic),
  '--font-reading-cyrillic': alone(readingCyrillic),
} as CSSProperties;
/** On every page: the Cyrillic pixel typeface by itself, for the one Russian word a page of another language shows, the name of the language. */
const EVERYWHERE = { '--font-pixel-cyrillic-alone': alone(pixelCyrillic) } as CSSProperties;

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
    <html lang={locale} className={`${pixel.variable} ${reading.variable} ${pixelCyrillic.variable} ${readingCyrillic.variable}`} style={locale === 'ru' ? { ...EVERYWHERE, ...RUSSIAN } : EVERYWHERE}>
      <body>
        <NextIntlClientProvider>
          <GameProvider>{children}</GameProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
