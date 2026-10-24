import { isLocale, type Locale } from '@ratrace/i18n/locales';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useMessages } from './languageWords';
import { headTagsOf, type MetaWords } from './pageMeta';
import type { Page } from './pageList';
import { SITE_URL } from './site';

/*
 * The web export's twin of `pageHead.tsx` (Metro picks it for the web). Each page tells the document its head (title, description, addresses, Open
 * Graph and card, as the Next web's metadata) with plain `<title>`, `<meta>` and `<link>`: React moves them into the document's head, on the build's
 * machine into each page's HTML and in the browser as the player moves from page to page. (expo-router's own `Head`, react-helmet, is not read by the
 * export's streaming render, which would leave every page without.) The words are those of the language of the address, whichever the game speaks.
 */

function HeadOf({ locale, page }: { locale: Locale; page: Page }) {
  const words = useMessages(locale).meta as MetaWords;
  return (
    <>
      {headTagsOf(locale, page, words, SITE_URL).map((one, at) => {
        if (one.tag === 'title') return <title key={at}>{one.text}</title>;
        if (one.tag === 'meta') return <meta key={at} {...(one.name === undefined ? { property: one.property } : { name: one.name })} content={one.content} />;
        return <link key={at} rel={one.rel} href={one.href} hrefLang={one.hrefLang} sizes={one.sizes} type={one.type} />;
      })}
    </>
  );
}

/**
 * What a page tells a search and a shared link, in the document's head: nothing for an address that is no language of the game's, and nothing from a
 * page under the one in front (the stack keeps the pages a player came through, and only the one in front names the document).
 */
export function PageHead({ page }: { page: Page }) {
  const { locale } = useLocalSearchParams<{ locale?: string }>();
  const inFront = useIsFocused();
  return inFront && isLocale(locale) ? <HeadOf locale={locale} page={page} /> : null;
}
