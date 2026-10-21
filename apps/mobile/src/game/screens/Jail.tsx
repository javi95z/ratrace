import { Canvas, Circle } from '@shopify/react-native-skia';
import { cardArt } from '@ratrace/content';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT, useWords } from '../context';

/** The web's `list-disc pl-5`: each line stands 20 in, its disc out in the room to its left. */
const INDENT = 20;

/**
 * The disc the browser draws before a line of a list of 14 × 1.375 (not a glyph: a filled circle), as measured on the web's shot: 5 points
 * across, 4 in from the list's edge, its top 7 under the line's.
 */
const DISC = { size: 5, left: 4, top: 7 };

/** A line of a list with a disc before it. */
function Item({ children }: { children: string }) {
  return (
    <View role="listitem" style={{ paddingLeft: INDENT }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: DISC.left, top: DISC.top }}>
        <Canvas style={{ width: DISC.size, height: DISC.size }}>
          <Circle cx={DISC.size / 2} cy={DISC.size / 2} r={DISC.size / 2} color={COLORS.cream} />
        </Canvas>
      </View>
      <ReadText size={14} lineHeight={14 * SNUG}>{children}</ReadText>
    </View>
  );
}

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
        <Item>{t('noPay')}</Item>
        <Item>{t('noFocus')}</Item>
        <Item>{t('noCareer')}</Item>
        <Item>{t('cards')}</Item>
        <Item>{t('goesOn')}</Item>
      </View>
      <ReadText size={14} lineHeight={14 * SNUG} style={{ marginTop: 12 }}>{t('enter', { status: statusLost })}</ReadText>
      <ReadText size={14} lineHeight={14 * SNUG} style={{ marginTop: 4 }}>{t('leave', { n: rungsLost })}</ReadText>
    </Sheet>
  );
}
