import { GUIDE_ART } from '@ratrace/content';
import { marked, plain, TERMS, termsIn, type Term } from '@ratrace/core/game/glossary';
import { FIRSTS, TIPS } from '@ratrace/core/game/guide';
import { ageAt } from '@ratrace/core/game/present';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { LEVEL_3 } from '../../ui/headingLevel';
import { Button, pressDown, usePress } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import { useT, useWords } from '../context';

/**
 * The words of the guide: the figures its sentences are filled with, a sentence with the terms of the glossary marked in it, the sheet that
 * explains a term, and the whole of it to read again (How to play), from the settings.
 */

/** The figures the guide's sentences and the glossary name, from the rules the life is played under, so that what they say stays true. */
export function useGuideValues() {
  const { content, fmt } = useWords();
  return useMemo(
    () => ({
      rate: fmt.rate(content.debt.creditCardRateBp),
      chance: content.life.focusLimits.burnoutChancePct,
      fine: content.evasion.auditFinePct,
      share: content.life.fullTime.strongPct,
      rounds: content.rounds,
      from: ageAt(content, 0),
      to: ageAt(content, content.rounds),
    }),
    [content, fmt],
  );
}

/** The tint of a term in a sentence: a link's, as the word that opens it under the sentence. */
const TERM_TONE = 'sky-300';

/**
 * A sentence of the guide with its terms tinted as links, and under it each term once, a link that opens what it means (`onTerm`). The words
 * themselves are one text, read whole by a screen reader; the links are buttons of their own, 44 tall, for a thumb, a keyboard and a reader.
 */
export function MarkedText({ text, size, onTerm }: { text: string; size: number; onTerm(term: Term): void }) {
  const t = useT('guide');
  const pieces = marked(text);
  const head = pieces[0] !== undefined && pieces[0].term === undefined ? pieces[0].text : '';
  const rest = head === '' ? pieces : pieces.slice(1);
  const terms = termsIn(text);
  // The words a term is shown in, the first time the sentence names it.
  const shown = (term: Term) => pieces.find((piece) => piece.term === term)?.text ?? term;
  return (
    <View>
      <ReadText size={size} lineHeight={size * SNUG} after={rest.map((piece) => (piece.term === undefined ? { text: piece.text } : { text: piece.text, tone: TERM_TONE }))}>
        {head}
      </ReadText>
      {terms.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 }}>
          {terms.map((term) => (
            <TermLink key={term} words={shown(term)} label={t('whatIs', { term: shown(term) })} onPress={() => onTerm(term)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A term under its sentence: its words, underlined, the 44 a thumb needs. */
function TermLink({ words, label, onPress }: { words: string; label: string; onPress(): void }) {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press} style={({ pressed }) => ({ ...pressDown(pressed), minHeight: TOUCH, justifyContent: 'center' })}>
      <LinkText size={13} offset={4}>{words}</LinkText>
    </Pressable>
  );
}

/** What a term means, in a sheet of its own over the page. */
export function TermSheet({ term, onClose }: { term: Term | null; onClose(): void }) {
  const t = useT('guide');
  const common = useT('common');
  const values = useGuideValues();
  // The term stays named while its sheet slides away.
  const [last, setLast] = useState<Term | null>(term);
  if (term !== null && term !== last) setLast(term);
  const shown = term ?? last;
  return (
    <Sheet open={term !== null} onClose={onClose} title={shown === null ? '' : t(`terms.${shown}.name`)} closeLabel={common('close')}>
      {shown === null ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* The glossary's book: a word of it, looked up. */}
          <Sprite id={GUIDE_ART.glossary} />
          <ReadText size={15} lineHeight={15 * SNUG} style={{ flex: 1, minWidth: 0 }}>
            {t(`terms.${shown}.text`, values)}
          </ReadText>
        </View>
      )}
    </Sheet>
  );
}

/** A section of How to play: its heading, under the sheet's title, and the icon before it where it has one. */
function Section({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View accessibilityRole="header" {...LEVEL_3} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <Sprite id={icon} /> : null}
        <PixelText size={15} tone="gold-500" style={{ letterSpacing: 15 * 0.1, textTransform: 'uppercase', flexShrink: 1 }}>{title}</PixelText>
      </View>
      {children}
    </View>
  );
}

/** A paragraph of How to play: its terms are explained further down, so they are only words here. */
function Paragraph({ children }: { children: string }) {
  return (
    <ReadText size={14} lineHeight={14 * SNUG} tone="ink-200">
      {plain(children)}
    </ReadText>
  );
}

/** A list of How to play, its items a rule apart. */
function List({ children }: { children: ReactNode[] }) {
  return (
    <View role="list" style={{ gap: 8 }}>
      {children.map((child, i) => (
        <View key={i} role="listitem" style={i === 0 ? null : { borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * How to play: the goal, what a round is, how the score is made, every tip of the guide in the order a first life meets them, the notes of
 * a first time, and the glossary. A long sheet to read, at half the screen on a phone. Its terms are not links: the glossary is at its foot.
 */
export function HowToPlaySheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('guide');
  const common = useT('common');
  const values = useGuideValues();
  return (
    <Sheet open={open} onClose={onClose} half title={t('howTo.open')} closeLabel={common('close')}>
      <View style={{ gap: 20 }}>
        <Section title={t('howTo.goalTitle')} icon={GUIDE_ART.howTo}>
          <Paragraph>{t('howTo.goal', values)}</Paragraph>
        </Section>
        <Section title={t('howTo.roundTitle')}>
          <Paragraph>{t('howTo.round', values)}</Paragraph>
        </Section>
        <Section title={t('howTo.scoreTitle')}>
          <Paragraph>{t('howTo.score', values)}</Paragraph>
        </Section>
        <Section title={t('howTo.tipsTitle')}>
          <List>
            {TIPS.map((tip) => (
              <Paragraph key={tip.id}>{t(tip.id, values)}</Paragraph>
            ))}
          </List>
        </Section>
        <Section title={t('howTo.firstsTitle')}>
          <List>
            {FIRSTS.map((first) => (
              <Paragraph key={first.id}>{t(first.id, values)}</Paragraph>
            ))}
          </List>
        </Section>
        <Section title={t('howTo.termsTitle')} icon={GUIDE_ART.glossary}>
          <List>
            {TERMS.map((term) => (
              <View key={term} style={{ gap: 2 }}>
                <ReadText size={14} weight={600}>{t(`terms.${term}.name`)}</ReadText>
                <Paragraph>{t(`terms.${term}.text`, values)}</Paragraph>
              </View>
            ))}
          </List>
        </Section>
      </View>
    </Sheet>
  );
}

/** The way into How to play from the settings: a button, what it holds said under it, and its sheet over theirs. */
export function HowToPlay() {
  const t = useT('guide');
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* The open book of How to play. */}
        <Sprite id={GUIDE_ART.howTo} />
        <View style={{ flex: 1 }}>
          <Button variant="secondary" wide onPress={() => setOpen(true)}>
            {t('howTo.open')}
          </Button>
        </View>
      </View>
      <ReadText size={12} tone="ink-300" lineHeight={12 * SNUG}>
        {t('howTo.openHint')}
      </ReadText>
      <HowToPlaySheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}
