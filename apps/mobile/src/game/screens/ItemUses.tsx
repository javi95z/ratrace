import { perkArt, skillArt } from '@ratrace/content';
import { ITEM_PERKS, SKILLS } from '@ratrace/engine';
import type { ItemDef } from '@ratrace/engine';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Bare } from '../../ui/kit';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT, useWords } from '../context';

/** One use of a thing: its sign in a square of 32, and what it does (the web's `li.flex.items-center.gap-2`, 14 on a snug line). */
function Use({ icon, children }: { icon: string; children: string }) {
  return (
    <View role="listitem" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Bare style={{ width: 32, height: 32 }}>
        <Sprite id={icon} />
      </Bare>
      <ReadText size={14} lineHeight={14 * SNUG} style={{ flexShrink: 1 }}>{children}</ReadText>
    </View>
  );
}

/** What a thing is good for beyond its status, each use with its sign: nothing is drawn for a thing that is status and nothing else. */
export function ItemUses({ item }: { item: ItemDef }) {
  const t = useT('effects');
  const { content, text } = useWords();
  const perks = item.perks ?? {};
  const uses = ITEM_PERKS.filter((perk) => (perks[perk] ?? 0) > 0);
  // A gym is used, and its use practises a skill: said here, beside what else it does.
  const trains = SKILLS.filter((skill) => (content.life.skills.practiceItems[skill] ?? []).includes(item.id));
  if (uses.length === 0 && trains.length === 0) return null;
  return (
    // The web's `section` named by its title: `frame bg-night-800 px-3 py-2`.
    <View role="region" aria-label={t('perks.title')}>
      <Framed kind="frame" style={{ backgroundColor: COLORS['night-800'], paddingHorizontal: 12, paddingVertical: 8 }}>
        <PixelText size={12} tone="teal-300" style={{ textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{t('perks.title')}</PixelText>
        <View role="list" style={{ marginTop: 4, gap: 4 }}>
          {trains.map((skill) => (
            <Use key={skill} icon={skillArt[skill]}>{t('perks.trains', { skill: text.skills[skill], n: content.life.skills.practicePoints })}</Use>
          ))}
          {uses.map((perk) => (
            <Use key={perk} icon={perkArt[perk]}>{t(`perks.${perk}`, { n: perks[perk] ?? 0 })}</Use>
          ))}
        </View>
        {uses.length > 0 ? <ReadText size={12} tone="ink-300" style={{ marginTop: 4 }}>{t('perks.best')}</ReadText> : null}
      </Framed>
    </View>
  );
}
