import { DEFAULT_LOCALE, isLocale, type Locale } from '@ratrace/i18n/locales';
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Framed } from '../ui/Frame';
import { GOLD } from '../ui/frames';
import { Raised } from '../ui/kit';
import { Language, PixelText, ReadText, SNUG } from '../ui/text';
import { COLORS } from '../ui/theme';
import { FAULT_KEYS, FAULT_WORDS, type FaultWords } from './faultWords';
import { loadedMessages } from './languageWords';
import { openDocument } from './openDocument';
import { hrefOf } from './pages';

/*
 * What a visitor sees on the web if the game cannot be drawn: the Next web's `[locale]/error.tsx`, in the page's language. The game is saved after
 * every step, so the life is where it was; this offers another try, a new life, and the way home, instead of a blank page. It is expo-router's
 * `ErrorBoundary` of the root layout (`app/_layout.tsx`), drawn in the root's place: the game, its context and its words are gone with it, so it
 * stands alone. Its words are the page's language's from the game where they are in, else the HTML's (`faultWords.ts`, written by `app/+html.tsx`):
 * a language whose chunk could not be had is such a fault, and the page still speaks. Another try draws the game again, from nothing (its words
 * asked for again); a new life and home are new documents of the site, as the Next web's links leave its page.
 */

/** The page's language: its address's, else its document's, else English. */
function pageLocale(): Locale {
  const first = /^\/([^/?#]+)/.exec(window.location.pathname)?.[1];
  if (isLocale(first)) return first;
  const lang = document.documentElement.lang;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

/** The fault's words in `locale`: the game's, where its language is in, else the HTML's; null where neither is there. */
function faultWordsIn(locale: Locale): FaultWords | null {
  const play = loadedMessages(locale)?.play as Partial<FaultWords> | undefined;
  if (play && FAULT_KEYS.every((key) => typeof play[key] === 'string')) return play as FaultWords;
  try {
    const held = JSON.parse(document.getElementById(FAULT_WORDS)?.textContent ?? 'null') as Partial<FaultWords> | null;
    return held && FAULT_KEYS.every((key) => typeof held[key] === 'string') ? (held as FaultWords) : null;
  } catch {
    return null;
  }
}

/** A way out of the page, as the Next web's links: a full-width raised line. */
function WayOut({ label, primary, onPress }: { label: string; primary?: boolean; onPress(): void }) {
  return (
    <Raised
      role={primary ? 'button' : 'link'}
      tone={primary ? GOLD : {}}
      bg={primary ? 'gold-500' : 'night-600'}
      style={{ minHeight: primary ? 48 : 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
      onPress={onPress}
    >
      <PixelText size={primary ? 17 : 15} tone={primary ? 'ink-900' : 'cream'}>{label}</PixelText>
    </Raised>
  );
}

/** The page of a fault (the Next web's `main mx-auto max-w-sm flex-col justify-center gap-4 px-4`), told by the router what was thrown. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [locale] = useState(pageLocale);
  const [words] = useState(() => faultWordsIn(locale));
  useEffect(() => {
    console.error('a screen could not be drawn:', error);
  }, [error]);
  return (
    <Language.Provider value={locale}>
      <View role="main" style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: 384, alignSelf: 'center', paddingHorizontal: 16, gap: 16 }}>
          <View role="alert">
            <Framed kind="frame" style={{ backgroundColor: COLORS['wine-900'], padding: 16 }}>
              <View accessibilityRole="header">
                <PixelText size={20}>{words?.faultTitle ?? ''}</PixelText>
              </View>
              <ReadText size={14} lineHeight={14 * SNUG} style={{ marginTop: 8 }}>{words?.faultBody ?? ''}</ReadText>
            </Framed>
          </View>
          <WayOut primary label={words?.retry ?? ''} onPress={() => void retry()} />
          <WayOut label={words?.newLife ?? ''} onPress={() => openDocument(hrefOf('new', { locale }), 'push')} />
          <WayOut label={words?.home ?? ''} onPress={() => openDocument(hrefOf('', { locale }), 'push')} />
        </View>
      </View>
    </Language.Provider>
  );
}
