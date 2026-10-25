import { useIsFocused } from 'expo-router';
import { useContext } from 'react';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { PixelText, Language } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { openDocument } from '../openDocument';
import { hrefOf } from '../pages';
import { WayOut } from '../PageFault.web';
import { useT } from '../words';

/*
 * The web export's twin of `NotFound.tsx` (Metro picks it for the web): the game's page of nothing, where the Next web answers an address it has no
 * page at with its 404 (and `[locale]/layout.tsx`'s `notFound()` a language it does not have). The site serves it as its `404.html`, with a 404, for
 * every such address (`scripts/sitePieces.ts`), and in the address's language once its words are in (`useLanguage.web.ts`). The words are the
 * Next web's error page's (`play.faultTitle`, `newLife`, `home`): a line, then the ways back, each a new document of the site as the error page's.
 * The router's own page (its sitemap, the address said back) is never shown.
 */
export function NotFound() {
  const locale = useContext(Language);
  const t = useT('play');
  const meta = useT('meta');
  const inFront = useIsFocused();
  return (
    <View role="main" style={{ flex: 1, justifyContent: 'center' }}>
      {/* The document's head, as a page's (`pageHead.web.tsx`): the game's name, and nothing for a search engine to keep. */}
      {inFront ? (
        <>
          <title>{meta('title')}</title>
          <meta name="robots" content="noindex" />
        </>
      ) : null}
      <View style={{ width: '100%', maxWidth: 384, alignSelf: 'center', paddingHorizontal: 16, gap: 16 }}>
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 16 }}>
          <View accessibilityRole="header">
            <PixelText size={20}>{t('faultTitle')}</PixelText>
          </View>
        </Framed>
        <WayOut label={t('newLife')} onPress={() => openDocument(hrefOf('new', { locale }), 'push')} />
        <WayOut label={t('home')} onPress={() => openDocument(hrefOf('', { locale }), 'push')} />
      </View>
    </View>
  );
}
