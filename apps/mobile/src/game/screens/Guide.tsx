import { ratArt } from '@ratrace/content';
import type { Term } from '@ratrace/core/game/glossary';
import { isFirst, nextTip } from '@ratrace/core/game/guide';
import { isHalfway } from '@ratrace/core/game/lifeMilestones';
import { escapeUnder } from '@ratrace/core/game/rules';
import { escapeProgress } from '@ratrace/engine';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRise } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Button } from '../../ui/kit';
import { Sprite } from '../../ui/Sprite';
import { PixelText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useGuide, useRuns, useT, useWords } from '../context';
import { MarkedText, TermSheet, useGuideValues } from './GuideWords';

/**
 * The tip of the guided first life that is due on this screen, if any. It is a note in the flow
 * of the page, not a dialog: it blocks nothing, and the game can be played straight past it.
 * A tip stays until it is read, so one that was passed by is there the next time. Reading one
 * does not bring up the next in line: that waits for the next visit to the stage.
 *
 * Its frame is the web's `bevel frame-gold`, standing in a 3-pixel gold ring under the frame (the web's `--glow`: its class list named
 * the ring as a `shadow-*`, which the bevel's own box-shadow took the place of, until batch pass 2 put it under the bevel's). With no
 * keyboard, nothing is handed the focus when the note goes.
 */
export function Guide() {
  const t = useT('guide');
  const stage = useGame((s) => s.stage);
  const round = useGame((s) => s.view?.round ?? 0);
  // The player as the orders of this round will leave them: someone who has just put money to work needs no telling.
  const player = useGame((s) => s.preview?.player ?? s.view?.player ?? null);
  const view = useGame((s) => s.view);
  // The way out as the life's own rules measure it.
  const rules = useGame((s) => s.rules);
  const preview = useGame((s) => s.preview);
  const { content } = useWords();
  const values = useGuideValues();
  const guide = useGuide();
  const runs = useRuns();
  // The visit to a stage in which a tip was last read.
  const [read, setRead] = useState<string | null>(null);
  const visit = `${round}:${stage}`;
  // Until the device has said whether a life was ever finished, say nothing: a veteran must not see a flash of tips.
  if (runs === null || player === null) return null;

  const hasInvested = player.deposit > 0 || Object.keys(player.positions).length > 0;
  const kinds = new Set(player.debts.filter((debt) => debt.principal > 0).map((debt) => debt.kind));
  const escape = view ? escapeUnder(rules, escapeProgress(content, view)) : null;
  const firsts = {
    crisis: view?.timeline[view.round]?.crisis != null,
    creditCard: kinds.has('creditCard'),
    mortgage: kinds.has('mortgageFixed') || kinds.has('mortgageVariable'),
    margin: kinds.has('margin'),
    halfway: escape !== null && isHalfway(escape) && escape.passiveAfterTax < escape.outgoings,
    // Overtime the round before: the next in a row is the one that costs health, and the third may burn the player out.
    overtime: (view?.player.life.overtimeStreak ?? 0) >= 1,
    // Something hidden from the tax office as the round's orders leave it.
    hiding: player.life.evasion.blackPct > 0 || player.life.evasion.shell || player.life.evasion.hideCrypto,
    // The orders leave cash short of what the savings cover: the rest goes on the card (the warning before the round says so too).
    short: preview !== null && -preview.cashAfter - preview.player.deposit > 0,
  };
  // While the game is being made, the guide shows whatever lives this device has finished, and even when it was turned off, so it can be seen and tried.
  const developing = process.env.NODE_ENV === 'development';
  const tip = nextTip({ stage, round, seen: guide.seen, off: developing ? false : guide.off, livesFinished: developing ? 0 : runs.length, hasInvested, firsts });
  if (tip === null || read === visit) return null;

  return (
    <Note
      title={isFirst(tip) ? t('firstTitle') : t('title')}
      label={t('title')}
      text={t(tip, values)}
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

/**
 * The note itself, rising into its place: the rat thinking it over with the player, the tip, and the two ways to be done with it. A word of
 * the glossary in the tip opens what it means in a sheet.
 */
function Note({ title, label, text, gotIt, skip, onRead, onSkip }: { title: string; label: string; text: string; gotIt: string; skip: string; onRead(): void; onSkip(): void }) {
  const rise = useRise();
  const [term, setTerm] = useState<Term | null>(null);
  return (
    // A note in the flow of the page and nothing more: a shade over the screen made the sticky bars look to jump as the page scrolled.
    <Animated.View role="note" aria-label={label} style={[{ marginBottom: 12 }, rise]}>
      {/* The ring of three under the frame (the web's `0 0 0 3px` gold shadow): the frame's two-point strips are drawn over all but its outer point
          and the frame's open corners, and the note's own ground over its inside. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, backgroundColor: COLORS['gold-500'] }} />
      <Framed kind="bevel" tone={GOLD} style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* The rat, thinking it over with the player. */}
          <Sprite id={ratArt('think')} fallback={{ w: 128, h: 128 }} size={{ w: 64, h: 64 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <PixelText size={14} tone="gold-500" style={{ marginBottom: 4, letterSpacing: 14 * 0.1 }}>{title.toUpperCase()}</PixelText>
            <MarkedText text={text} size={14} onTerm={setTerm} />
          </View>
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
          {/* The web's `flex-1 text-[15px]` and `text-[14px]`. */}
          <View style={{ flex: 1 }}>
            <Button variant="secondary" wide size={15} onPress={onRead}>
              {gotIt}
            </Button>
          </View>
          <Button variant="quiet" size={14} onPress={onSkip}>
            {skip}
          </Button>
        </View>
      </Framed>
      <TermSheet term={term} onClose={() => setTerm(null)} />
    </Animated.View>
  );
}
