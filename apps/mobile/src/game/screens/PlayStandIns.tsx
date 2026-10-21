import { previewCard } from '@ratrace/engine';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBlink } from '../../ui/animations';
import { Button } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useT, useWords } from '../context';

/*
 * TEMPORARY, for development: what stands in Play where a part of it will be until the task that ports it. Plainly not the game (a dashed box, a
 * sign of works, the part's name in the game's words), and the round goes on through Play's bar as it will. All in this one file, so that each
 * task deletes its own stand-in here and draws its screen in Play where the stand-in was:
 * - the cards (`CardsStandIn`) and a card's result (`StageStandIn` 'outcome'): Task 11;
 * - the finances (`StageStandIn` 'finance') and the basket (`BasketStandIn`): Task 12;
 * - the ledger (`StageStandIn` 'resolve'): Task 16;
 * - the end of a life (`EndStandIn`): Task 18.
 * `StandIn` goes with the last of them.
 */

/** The dashed box of a part not ported yet: a sign of works and its name, and whatever keeps the round going in the meantime. */
export function StandIn({ name, children }: { name?: string; children?: ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS['ink-500'], padding: 12, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <ReadText size={13} tone="ink-300">{'🚧'}</ReadText>
        {name ? <ReadText size={13} tone="ink-300" style={{ flexShrink: 1 }}>{name}</ReadText> : null}
      </View>
      {children}
    </View>
  );
}

/** A stage a later task brings (Task 11: a card's result; Task 12: the finances; Task 16: the ledger): its name, as the stage is called for someone who cannot see it. */
export function StageStandIn({ stage }: { stage: 'outcome' | 'finance' | 'resolve' }) {
  const play = useT('play');
  return <StandIn name={play(`stages.${stage}`)} />;
}

/** The game's "Loading…", blinking, as Play's `Waiting` says it, for a stage with nothing to show yet. */
function Opening() {
  const common = useT('common');
  const blink = useBlink();
  return (
    <Animated.View style={blink}>
      <PixelText tone="ink-300">{common('loading')}</PixelText>
    </Animated.View>
  );
}

/**
 * Task 11 brings the cards: until then the card waiting as a line, and its choices as buttons, so that a life can be played on. What it reads is
 * what the web's cards read: the hand, the card's words, the choices that can be taken. With no card waiting (the game not open yet, or the round
 * gone on past its cards a moment before the stage does), it says the game is opening, never an empty stage with nothing to press.
 */
export function CardsStandIn() {
  const t = useT('cards');
  const { content, text } = useWords();
  const view = useGame((s) => s.view);
  const busy = useGame((s) => s.busy);
  const pick = useGame((s) => s.pick);
  const waiting = view !== null && view.phase === 'cards';
  const def = waiting ? content.cards.find((card) => card.id === view.hand[view.answered]) : undefined;
  const previews = useMemo(() => (view && def ? previewCard(content, view, def.id) : []), [content, view, def]);
  if (!view || !def) {
    return (
      <StandIn>
        <Opening />
      </StandIn>
    );
  }
  const written = text.cards[def.id];
  const shown = previews.flatMap((preview, index) => (preview.available ? [index] : []));
  return (
    <StandIn name={`${t('progress', { n: view.answered + 1, total: view.hand.length })} · ${def.category === 'world' ? t('world') : text.categories[def.category]}`}>
      <PixelText size={19}>{written.title}</PixelText>
      <View role="group" aria-label={t('choices', { title: written.title })} style={{ gap: 10 }}>
        {shown.map((i) => (
          <Button key={`${def.id}-${i}`} variant="secondary" wide disabled={busy} onPress={() => void pick(i)}>
            {written.options[i].label}
          </Button>
        ))}
      </View>
    </StandIn>
  );
}

/** Task 18 brings the end of a life: until then its box, which Play draws above the two ways on from a life that is over. */
export function EndStandIn() {
  return <StandIn />;
}

/** Task 12 brings the basket: until then what the finances' button of orders opens, so that it is never a button that does nothing. */
export function BasketStandIn({ open, onClose }: { open: boolean; onClose(): void }) {
  const finance = useT('finance');
  const common = useT('common');
  const orders = useGame((s) => s.orders.length);
  return (
    <Sheet open={open} onClose={onClose} title={finance('basketTitle')} closeLabel={common('close')}>
      <StandIn name={finance('basket', { count: orders })} />
    </Sheet>
  );
}
