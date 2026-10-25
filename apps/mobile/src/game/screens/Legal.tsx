import { View } from 'react-native';
import { WIDE_COLUMN } from '../../ui/desk';
import { Screen } from '../../ui/Page';
import { LEVEL_2 } from '../../ui/headingLevel';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { LEGAL_EMAIL, LEGAL_NAME } from '../site';
import { LEGAL_SECTION } from '../ownWords';
import { useT } from '../words';
import { BackLink } from './BackLink';

/**
 * Privacy and the legal notice: plain words, reached only from the foot of the front page (the web's legal/page.tsx). The sections are the
 * web's, in its order, in the phone's own words on the phone (`phone.legal`; on the web the Next web's own: `LEGAL_SECTION`, game/ownWords.ts): the phone's notification address instead of the browser's, Expo and Firebase
 * carrying the notices instead of the site and its visits, and the app's storage instead of the browser's. Who answers for it (the owner and
 * the contact, if the build names them) is the web's `legal.owner` and `legal.contact`; the contact is shown here and nowhere else.
 */
export function Legal() {
  const t = useT(LEGAL_SECTION);
  const web = useT('legal');
  const sections = [
    [t('noticeTitle'), t('noticeBody')],
    [t('dataTitle'), t('dataBody')],
    [t('whyTitle'), t('whyBody')],
    [t('whoTitle'), t('whoBody')],
    [t('deviceTitle'), t('deviceBody')],
    [t('rightsTitle'), t('rightsBody')],
  ] as const;
  // Who answers for the game, if the build says: the owner and how to reach them, in one line.
  const owner = [LEGAL_NAME ? web('owner', { name: LEGAL_NAME }) : null, LEGAL_EMAIL ? web('contact', { email: LEGAL_EMAIL }) : null].filter(Boolean).join(' ');

  return (
    <Screen width={WIDE_COLUMN} contentStyle={{ gap: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={22} tone="gold-500">{t('title')}</PixelText>
        </View>
      </View>
      {sections.map(([title, body], at) => (
        <View key={title}>
          <View accessibilityRole="header" {...LEVEL_2}>
            <PixelText size={16}>{title}</PixelText>
          </View>
          <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG} style={{ marginTop: 4 }}>{body}</ReadText>
          {at === 0 && owner !== '' ? <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG} style={{ marginTop: 4 }}>{owner}</ReadText> : null}
        </View>
      ))}
      <ReadText size={12} tone="ink-300">{t('updated')}</ReadText>
    </Screen>
  );
}
