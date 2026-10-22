import { careerArt } from '@ratrace/content';
import { quoteCareer } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Bare, Tag } from '../../ui/kit';
import { PAY_DROP } from '../../ui/fonts';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT, useWords } from '../context';


/**
 * A career a card offers, before it is taken: every rung with what it pays in the player's city
 * today, its status and the experience it asks, the rung the card starts the player on marked. The
 * job they have now is said beside it, to weigh one against the other.
 */
export function CareerPreview({ careerId, startLevel, shown, onClose }: { careerId: string; startLevel: number; shown: GameView; onClose(): void }) {
  const t = useT('work');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const quote = useMemo(() => quoteCareer(content, shown, careerId), [content, shown, careerId]);
  const titles = text.careers[careerId].levels;
  const now = shown.player.life.career;
  const top = quote.ladder[quote.ladder.length - 1];
  const perYear = (annual: number) => common('perYear', { amount: fmt.money(annual) });
  return (
    <Sheet open onClose={onClose} title={text.careers[careerId].name} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Bare style={{ width: 32, height: 32 }}>
            <Sprite id={careerArt(careerId)} />
          </Bare>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">
              {`${t('previewStart', { title: titles[startLevel], pay: perYear(quote.ladder[startLevel].payAnnual) })} ${t('previewTop', { title: titles[top.level], pay: perYear(top.payAnnual) })}`}
            </ReadText>
          </View>
        </View>
        {now ? (
          <ReadText size={12} tone="ink-300">{t('previewNow', { title: text.careers[now.id].levels[now.level], career: text.careers[now.id].name })}</ReadText>
        ) : null}
        {/* The way up reads from the top down, as the web's reversed list does. */}
        <View role="list" style={{ flexDirection: 'column-reverse', gap: 8 }}>
          {quote.ladder.map((rung) => {
            const start = rung.level === startLevel;
            return (
              // The rung the card starts the player on is the step they are on, as the web's `aria-current="step"` says.
              <View key={rung.level} role="listitem" accessibilityState={{ selected: start }} aria-selected={start}>
                <Framed kind={start ? 'bevel' : 'frame'} tone={start ? GOLD : {}} style={{ backgroundColor: COLORS[start ? 'night-600' : 'night-700'], paddingHorizontal: 10, paddingVertical: 8 }}>
                  {/* The web aligns the two by their baselines; the pay, 15 against the title's 16, stands a point lower at the top. */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flexShrink: 1, minWidth: 0 }}>
                      <PixelText size={16}>{titles[rung.level]}</PixelText>
                    </View>
                    <View style={{ flexShrink: 0, marginTop: PAY_DROP }}>
                      <PixelText size={15} tone="gold-500">{perYear(rung.payAnnual)}</PixelText>
                    </View>
                  </View>
                  <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {start ? <Tag tone="good">{t('previewYouStart')}</Tag> : null}
                    {rung.status > 0 ? <Tag tone="good">{t('status', { n: rung.status })}</Tag> : null}
                    {rung.level > startLevel ? <Tag>{t('previewNeeds', { skill: rung.minSkill })}</Tag> : null}
                  </View>
                </Framed>
              </View>
            );
          })}
        </View>
        <ReadText size={12} tone="ink-300">{t('previewNote', { city: names.cities[shown.player.cityId] })}</ReadText>
      </View>
    </Sheet>
  );
}
