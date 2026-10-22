import { cardArt } from '@ratrace/content';
import { View } from 'react-native';
import { DiscItem } from '../../ui/DiscItem';
import { Framed } from '../../ui/Frame';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { useT, useWords } from '../context';

/**
 * What prison does to a life, in a sheet: what stops while inside, what goes on, and what it costs
 * going in and coming out. `left` is the rounds still to serve, for someone already inside.
 */
export function JailSheet({ open, onClose, left = 0 }: { open: boolean; onClose(): void; left?: number }) {
  const t = useT('jail');
  const common = useT('common');
  const { content } = useWords();
  const { statusLost, rungsLost } = content.life.jail;
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      {/* The web's framed block is the sheet's width, the picture at its left. */}
      <Framed kind="frame">
        <Sprite id={cardArt.crime_jail_cellmate ?? ''} scale="art" fallback={{ w: 288, h: 120 }} />
      </Framed>
      {left > 0 ? (
        <PixelText size={15} tone="wine-300" style={{ marginTop: 12 }}>
          {t('left', { n: left })}
        </PixelText>
      ) : null}
      <ReadText size={14} tone="ink-200" style={{ marginTop: 12 }}>{t('inside')}</ReadText>
      <View role="list" style={{ marginTop: 4, gap: 4 }}>
        <DiscItem>{t('noPay')}</DiscItem>
        <DiscItem>{t('noFocus')}</DiscItem>
        <DiscItem>{t('noCareer')}</DiscItem>
        <DiscItem>{t('cards')}</DiscItem>
        <DiscItem>{t('goesOn')}</DiscItem>
      </View>
      <ReadText size={14} lineHeight={14 * SNUG} style={{ marginTop: 12 }}>{t('enter', { status: statusLost })}</ReadText>
      <ReadText size={14} lineHeight={14 * SNUG} style={{ marginTop: 4 }}>{t('leave', { n: rungsLost })}</ReadText>
    </Sheet>
  );
}
