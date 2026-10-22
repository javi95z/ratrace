import { lives, portraitArt } from '@ratrace/content';
import type { LifeDef } from '@ratrace/content';
import { ageAt } from '@ratrace/core/game/present';
import { unlockProgress } from '@ratrace/core/game/unlockProgress';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import type { HostInstance, LayoutChangeEvent } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Button, Notice, Raised, Well } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { BottomBar, Screen } from '../../ui/Page';
import type { ScreenScroller } from '../../ui/Page';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useProfile, useRuns, useStill, useT, useWords } from '../context';
import { anotherLife, lifeRows } from '../lives';
import { BackLink } from './BackLink';
import { Difficulty, LifeBrief, LifeSummary } from './LifeSummary';

const byId = new Map<string, LifeDef>(lives.map((life) => [life.id, life]));

/**
 * What a scene shows open at the start (a client draws a scene by the screen's own initial state, never by a tap): the question of ending the life
 * in progress, or the list of the lives still locked. Left out, the screen as a player first meets it.
 */
export type NewLifeOpened = 'replace' | 'locked';

/**
 * One life in the grid. Drawn again only when it is chosen or let go, not for another life being chosen: a tile has a portrait, a city
 * and a good deal of frame, and twenty of them are on the page of someone who has unlocked every life.
 */
const LifeTile = memo(function LifeTile({ id, on, onChoose, onLayout, onNode }: { id: string; on: boolean; onChoose(id: string): void; onLayout(id: string, event: LayoutChangeEvent): void; onNode(id: string, node: HostInstance | null): void }) {
  const node = useCallback((view: HostInstance | null) => onNode(id, view), [id, onNode]);
  return (
    // Half the row, or all of it for the life chosen; 4 on each side and the grid made 8 wider than its page, so that the gap between two is 8 and the outer
    // edges are the page's.
    <View style={{ width: on ? '100%' : '50%', paddingHorizontal: 4 }} onLayout={(event) => onLayout(id, event)}>
      <Raised
        ref={node}
        role="radio"
        checked={on}
        tone={on ? GOLD : {}}
        bg={on ? 'cream' : 'night-700'}
        place={{ flexGrow: 1 }}
        style={{ flexGrow: 1, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6 }}
        onPress={() => onChoose(id)}
      >
        {/* The portrait at its own size: drawn at 64 pixels, any other size blurs it. */}
        <Well style={{ width: 68, height: 68, alignSelf: 'center' }}>
          <Sprite id={portraitArt(id, 22)} fallback={{ w: 64, h: 64 }} />
        </Well>
        {on ? <LifeSummary lifeId={id} light /> : <LifeBrief lifeId={id} />}
      </Raised>
    </View>
  );
});

/** A life still locked: only the shape of who it is, what unlocks it and how far the player is, a hint, and how hard it is. */
const LockedLife = memo(function LockedLife({ id, finished }: { id: string; finished: number | null }) {
  const t = useT('newLife');
  const { text } = useWords();
  const life = byId.get(id);
  if (!life) return null;
  const progress = unlockProgress(life.unlock, finished);
  return (
    <Framed kind="raised" style={{ backgroundColor: COLORS['night-800'], flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6 }}>
      {/* Only the shape of who it is: the portrait waits for whoever opens the life. */}
      <Well style={{ width: 68, height: 68, alignSelf: 'center' }}>
        <Sprite id={portraitArt(id, 22)} fallback={{ w: 64, h: 64 }} silhouette />
        <View style={{ position: 'absolute', bottom: 2, right: 2 }}>
          <Sprite id="icon.locked" fallback={{ w: 16, h: 16 }} />
        </View>
      </Well>
      <View style={{ flex: 1, minWidth: 0 }}>
        <PixelText size={15}>{text.lives[id].name}</PixelText>
        <ReadText size={12} lineHeight={12 * SNUG} tone="gold-500" after={[{ text: text.lives[id].unlock, tone: 'ink-200' }]}>
          {`${t('unlock')}: `}
        </ReadText>
        {progress ? (
          <ReadText size={12} lineHeight={12 * SNUG} tone="teal-300">{t('progressFinished', { n: progress.have, total: progress.need })}</ReadText>
        ) : null}
        <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" italic>{t(`hints.${id}`)}</ReadText>
      </View>
      <Difficulty lifeId={id} />
    </Framed>
  );
});

/** The rows of the locked list that are drawn in the frame the list is opened, and each of the frames after it. */
export const LOCKED_FIRST = 5;
export const LOCKED_STEP = 6;

/**
 * The locked lives, opened: the first few rows at once and the rest a few to a frame, so that opening it is not one long stop of the screen. A row is two
 * Skia pictures, a frame and four texts, and the seventeen of them at once took 300 to 400 ms to draw on the simulator in a development build (the twenty
 * tiles of someone who has unlocked everything, 100 to 145 ms: those are drawn when the page is). It is drawn when it is opened, so it starts again each time.
 */
function LockedList({ ids, finished }: { ids: readonly string[]; finished: number | null }) {
  const [shown, setShown] = useState(LOCKED_FIRST);
  useEffect(() => {
    if (shown >= ids.length) return;
    const frame = requestAnimationFrame(() => setShown((now) => now + LOCKED_STEP));
    return () => cancelAnimationFrame(frame);
  }, [shown, ids.length]);
  return (
    <View role="list" style={{ marginTop: 8, gap: 8 }}>
      {ids.slice(0, shown).map((id) => (
        <View key={id} role="listitem">
          <LockedLife id={id} finished={finished} />
        </View>
      ))}
    </View>
  );
}

/** What the sheet asks about: the life in progress, which this one would end. Reads the life itself, so that the page is not drawn again for each round of it. */
function InProgress() {
  const t = useT('newLife');
  const { content, text } = useWords();
  const living = useGame((s) => s.lifeId);
  const round = useGame((s) => s.view?.round ?? 0);
  return (
    <ReadText lineHeight={15 * SNUG} tone="ink-200">
      {t('confirmBody', { life: text.lives[living ?? '']?.name ?? '', age: ageAt(content, round) })}
    </ReadText>
  );
}

/**
 * Choose who to be. A locked life shows what unlocks it. (What the web adds for a player with an account, the ranked or free way to play and the
 * ranked life in progress on another device, is not here: the phone has no account yet.)
 */
export function NewLife({ opened }: { opened?: NewLifeOpened } = {}) {
  const t = useT('newLife');
  const common = useT('common');
  const router = useRouter();
  const start = useGame((s) => s.start);
  const inProgress = useGame((s) => s.status === 'playing' && s.stage !== 'end');
  const [chosen, setChosen] = useState(lives[0].id);
  const [starting, setStarting] = useState(false);
  /** A life begun here: the page is on its way to it, and the life in progress it now sees is that one, not one to warn of. */
  const [begun, setBegun] = useState(false);
  const [asking, setAsking] = useState(opened === 'replace');
  /** The last try to start a life came to nothing, for a reason that is not the player's. */
  const [failed, setFailed] = useState(false);
  const [showLocked, setShowLocked] = useState(opened === 'locked');
  /** A life being begun: a second press while it is is no second life, whatever the screen has drawn by then. */
  const busy = useRef(false);
  const still = useStill();
  // Where each tile stands, to bring the one the dice picks into view; and the pressable of each, to move the screen reader to it.
  const scroller = useRef<ScreenScroller>(null);
  const group = useRef(0);
  const frames = useRef(new Map<string, { y: number; height: number }>());
  const nodes = useRef(new Map<string, HostInstance>());
  /** The life the dice picked, until its tile has been laid out where it now stands (it opens across a row, and the tiles after it move). */
  const revealing = useRef<string | null>(null);
  // Which lives are open is the profile's to say. Nothing is judged here.
  const { unlocked } = useProfile();
  const runs = useRuns();
  const available = useMemo(() => lives.filter((life) => life.unlock === 'default' || Object.hasOwn(unlocked, life.id)), [unlocked]);
  const locked = useMemo(() => lives.filter((life) => !available.includes(life)), [available]);
  const lockedIds = useMemo(() => locked.map((life) => life.id), [locked]);
  // Two to a row, the chosen life across one: in the order of the web's dense grid, all in one place so that a life that moves is moved and not made again.
  const order = useMemo(() => lifeRows(available.map((life) => life.id), chosen).flat(), [available, chosen]);
  const finished = runs?.length ?? null;
  const openIds = useMemo(() => available.map((life) => life.id), [available]);

  /** Brings a tile into view if it is not, and says to the screen reader which life is chosen: the web scrolls the chosen tile into view and focuses it. */
  const show = useCallback(
    (id: string) => {
      const frame = frames.current.get(id);
      if (frame) scroller.current?.reveal(group.current + frame.y, frame.height, !still);
      const node = nodes.current.get(id);
      if (node && typeof AccessibilityInfo.sendAccessibilityEvent === 'function') AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
    },
    [still],
  );
  const tileLaidOut = useCallback(
    (id: string, event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      frames.current.set(id, { y, height });
      if (revealing.current === id) {
        revealing.current = null;
        show(id);
      }
    },
    [show],
  );
  const tileNode = useCallback((id: string, node: HostInstance | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);
  /** The dice: another of the open lives, which is picked here and not in the state's update (a pick is not pure), and brought into view once it has moved. */
  const roll = () => {
    const next = anotherLife(openIds, chosen);
    if (next === chosen) return;
    revealing.current = next;
    setChosen(next);
  };

  /**
   * Starts the chosen life. The answer of the question's sheet waits for the sheet to be gone before the page changes under it (`sheetsGone`: a Modal
   * still leaving on iOS holds the screen that is changing); one that came from the button has no sheet to wait for.
   */
  const begin = async (fromSheet = false) => {
    if (busy.current) return;
    busy.current = true;
    setAsking(false);
    setFailed(false);
    setStarting(true);
    try {
      // Replaced, not pushed: the Back button must not lead here again from a life, one tap away from ending it.
      if (await start(chosen)) {
        setBegun(true);
        if (fromSheet) await sheetsGone();
        router.replace('/play');
      }
    } catch (error) {
      console.error('the life could not be started:', error);
      setFailed(true);
    } finally {
      busy.current = false;
      setStarting(false);
    }
  };

  return (
    <Screen
      scroller={scroller}
      contentStyle={{ gap: 12 }}
      bar={
        <BottomBar>
          {failed ? (
            <Notice role="alert" size={13} center style={{ marginBottom: 8 }}>
              {t('failed')}
            </Notice>
          ) : null}
          {inProgress && !starting && !begun ? (
            <ReadText size={12} tone="wine-300" style={{ textAlign: 'center', marginBottom: 8 }}>
              {t('replace')}
            </ReadText>
          ) : null}
          {/* A life in progress is not ended by one tap: the question is asked first, and its answer sits somewhere else. */}
          <Button variant="primary" wide disabled={starting || begun} onPress={() => (inProgress ? setAsking(true) : void begin())}>
            {t('start')}
          </Button>
        </BottomBar>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={24} tone="gold-500">{t('title')}</PixelText>
        </View>
        {/* Someone who cannot choose lets the dice: one of the open lives, never the one already chosen. Started only with the usual button. */}
        {available.length > 1 ? (
          <Raised
            bg="night-700"
            place={{ marginLeft: 'auto' }}
            style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
            onPress={roll}
          >
            <PixelText size={14} tone="ink-200">{t('random')}</PixelText>
          </Raised>
        ) : null}
      </View>

      {/* The lives that can be lived, two to a row; the one chosen opens across the row with what it is. */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('title')}
        onLayout={(event) => void (group.current = event.nativeEvent.layout.y)}
        style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 }}
      >
        {order.map((id) => (
          <LifeTile key={id} id={id} on={id === chosen} onChoose={setChosen} onLayout={tileLaidOut} onNode={tileNode} />
        ))}
      </View>

      {/* What is still locked waits at the foot, folded: what unlocks each is there for whoever wants to know. */}
      {locked.length > 0 ? (
        <View>
          <Raised
            expanded={showLocked}
            bg="night-800"
            style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            onPress={() => setShowLocked((open) => !open)}
          >
            <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sprite id="icon.locked" />
              <View style={{ flexShrink: 1 }}>
                <ReadText size={14} tone="ink-200">{t('lockedMany', { count: locked.length })}</ReadText>
              </View>
            </View>
            <View aria-hidden>
              <PixelText size={14} tone="ink-300">{showLocked ? '▴' : '▾'}</PixelText>
            </View>
          </Raised>
          {showLocked ? <LockedList ids={lockedIds} finished={finished} /> : null}
        </View>
      ) : null}

      <Sheet open={asking && inProgress} onClose={() => setAsking(false)} title={t('confirmTitle')} closeLabel={common('close')} back={false}>
        <InProgress />
        <View style={{ marginTop: 16, gap: 12 }}>
          <Button variant="primary" wide onPress={() => setAsking(false)}>
            {t('confirmNo')}
          </Button>
          <Button variant="danger" wide disabled={starting} onPress={() => void begin(true)}>
            {t('confirmYes')}
          </Button>
        </View>
      </Sheet>
    </Screen>
  );
}
