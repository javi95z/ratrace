import { View } from 'react-native';
import { Screen } from '../../ui/Page';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { LEGAL_EMAIL, LEGAL_NAME } from '../site';
import { useT } from '../words';
import { BackLink } from './BackLink';

/**
 * Privacy and the legal notice: plain words, reached only from the foot of the front page (the web's legal/page.tsx). The words are the
 * phone's own (`phone.legal`): the web's tell of an account, a database and cookies, and this app has none of them. The sections are those of the
 * web's that are true of an app that keeps everything on the phone and sends nothing, and one that says it may change; who answers for it
 * (the owner and the contact, if the build names them) is the web's `legal.owner` and `legal.contact`.
 */
export function Legal() {
  const t = useT('phone.legal');
  const web = useT('legal');
  const sections = [
    [t('noticeTitle'), t('noticeBody')],
    [t('dataTitle'), t('dataBody')],
    [t('deviceTitle'), t('deviceBody')],
    [t('whoTitle'), t('whoBody')],
    [t('laterTitle'), t('laterBody')],
  ] as const;
  // Who answers for the game, if the build says: the owner and how to reach them, in one line.
  const owner = [LEGAL_NAME ? web('owner', { name: LEGAL_NAME }) : null, LEGAL_EMAIL ? web('contact', { email: LEGAL_EMAIL }) : null].filter(Boolean).join(' ');

  return (
    <Screen contentStyle={{ gap: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={22} tone="gold-500">{t('title')}</PixelText>
        </View>
      </View>
      {sections.map(([title, body], at) => (
        <View key={title}>
          <View accessibilityRole="header">
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
