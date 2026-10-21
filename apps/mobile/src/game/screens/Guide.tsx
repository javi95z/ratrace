import { ratArt } from '@ratrace/content';
import { isFirst, nextTip } from '@ratrace/core/game/guide';
import { escapeProgress } from '@ratrace/engine';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRise } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Button } from '../../ui/kit';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useGuide, useRuns, useT, useWords } from '../context';

/**
 * The tip of the guided first life that is due on this screen, if any. It is a note in the flow
 * of the page, not a dialog: it blocks nothing, and the game can be played straight past it.
 * A tip stays until it is read, so one that was passed by is there the next time. Reading one
 * does not bring up the next in line: that waits for the next visit to the stage.
 *
 * Its frame is the web's `bevel frame-gold`: the web's class list also names a 3-pixel gold ring, which the bevel's own box-shadow
 * takes the place of in its stylesheet (measured on the web's page: no ring is drawn), so none is drawn here either. With no keyboard,
 * nothing is handed the focus when the note goes.
 */
export function Guide() {
  const t = useT('guide');
  const stage = useGame((s) => s.stage);
  const round = useGame((s) => s.view?.round ?? 0);
  // The player as the orders of this round will leave them: someone who has just put money to work needs no telling.
  const player = useGame((s) => s.preview?.player ?? s.view?.player ?? null);
  const view = useGame((s) => s.view);
  const { content, fmt } = useWords();
  const guide = useGuide();
  const runs = useRuns();
  // The visit to a stage in which a tip was last read.
  const [read, setRead] = useState<string | null>(null);
  const visit = `${round}:${stage}`;
  // Until the device has said whether a life was ever finished, say nothing: a veteran must not see a flash of tips.
  if (runs === null || player === null) return null;

  const hasInvested = player.deposit > 0 || Object.keys(player.positions).length > 0;
  const kinds = new Set(player.debts.filter((debt) => debt.principal > 0).map((debt) => debt.kind));
  const escape = view ? escapeProgress(content, view) : null;
  const firsts = {
    crisis: view?.timeline[view.round]?.crisis != null,
    creditCard: kinds.has('creditCard'),
    mortgage: kinds.has('mortgageFixed') || kinds.has('mortgageVariable'),
    margin: kinds.has('margin'),
    halfway: escape !== null && escape.outgoings > 0 && escape.passiveAfterTax * 2 >= escape.outgoings && escape.passiveAfterTax < escape.outgoings,
  };
  // While the game is being made, the guide shows whatever lives this device has finished, and even when it was turned off, so it can be seen and tried.
  const developing = process.env.NODE_ENV === 'development';
  const tip = nextTip({ stage, round, seen: guide.seen, off: developing ? false : guide.off, livesFinished: developing ? 0 : runs.length, hasInvested, firsts });
  if (tip === null || read === visit) return null;

  return (
    <Note
      title={isFirst(tip) ? t('firstTitle') : t('title')}
      label={t('title')}
      text={t(tip, { rate: fmt.rate(content.debt.creditCardRateBp) })}
      gotIt={t('gotIt')}
      skip={t('skip')}
      onRead={() => {
        setRead(visit);
        guide.read(tip);
      }}
      onSkip={() => guide.turnOff()}
    />
  );
}

/** The note itself, rising into its place: the rat thinking it over with the player, the tip, and the two ways to be done with it. */
function Note({ title, label, text, gotIt, skip, onRead, onSkip }: { title: string; label: string; text: string; gotIt: string; skip: string; onRead(): void; onSkip(): void }) {
  const rise = useRise();
  return (
    // A note in the flow of the page and nothing more: a shade over the screen made the sticky bars look to jump as the page scrolled.
    <Animated.View role="note" aria-label={label} style={[{ marginBottom: 12 }, rise]}>
      <Framed kind="bevel" tone={GOLD} style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* The rat, thinking it over with the player. */}
          <Sprite id={ratArt('think')} fallback={{ w: 128, h: 128 }} size={{ w: 64, h: 64 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <PixelText size={14} tone="gold-500" style={{ marginBottom: 4, letterSpacing: 14 * 0.1 }}>{title.toUpperCase()}</PixelText>
            <ReadText size={14} lineHeight={14 * SNUG}>{text}</ReadText>
          </View>
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" wide onPress={onRead}>
              {gotIt}
            </Button>
          </View>
          <Button variant="quiet" onPress={onSkip}>
            {skip}
          </Button>
        </View>
      </Framed>
    </Animated.View>
  );
}
