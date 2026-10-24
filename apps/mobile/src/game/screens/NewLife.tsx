import { lives, portraitArt } from '@ratrace/content';
import type { LifeDef } from '@ratrace/content';
import { ageAt } from '@ratrace/core/game/present';
import { unlockProgress } from '@ratrace/core/game/unlockProgress';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import type { HostInstance, LayoutChangeEvent } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Button, Notice, Raised, Segmented, Well } from '../../ui/kit';
import { focusMarked, onKeys, useKeyboardContext } from '../../ui/keyboard';
import { Sheet } from '../../ui/overlay';
import { BottomBar, Screen } from '../../ui/Page';
import type { ScreenScroller } from '../../ui/Page';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useProfile, useRanking, useRuns, useStill, useT, useWords } from '../context';
import { anotherLife, lifeRows } from '../lives';
import { BackLink } from './BackLink';
import { Difficulty, LifeBrief, LifeSummary } from './LifeSummary';
import { useGo } from '../pages';

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
        marks={{ life: id }}
        tabbable={on}
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
 * A player has one ranked life in progress: one on another device is never ended by starting here, it is asked about (the web's sheet, on each page
 * that begins a life: a new one, the week's attempt). It is taken up here (`onTake`), where its rules are this app's, or ended for the life asked for
 * (`onEnd`, with the id of the life it ends), or left as it is. `away` says the server did not answer the taking up; `starting`, that an answer is on
 * its way. A leaf of its own: the page is not drawn again as the question comes and goes. It keeps the life it asked about while it leaves.
 */
export function ElsewhereSheet({ starting, away, onTake, onEnd }: { starting: boolean; away: boolean; onTake(): void; onEnd(gameId: string): void }) {
  const t = useT('newLife');
  const common = useT('common');
  const { content, text } = useWords();
  const elsewhere = useGame((s) => s.elsewhere);
  const clearElsewhere = useGame((s) => s.clearElsewhere);
  const [held, setHeld] = useState(elsewhere);
  if (elsewhere !== null && elsewhere !== held) setHeld(elsewhere);
  const life = elsewhere ?? held;
  return (
    <Sheet open={elsewhere !== null} onClose={clearElsewhere} title={t('elsewhereTitle')} closeLabel={common('close')} back={false}>
      {life ? (
        <>
          <ReadText lineHeight={15 * SNUG} tone="ink-200">
            {t('elsewhereBody', { life: text.lives[life.lifeId]?.name ?? life.lifeId, round: Math.min(life.round + 1, content.rounds), total: content.rounds })}
          </ReadText>
          {life.here ? null : (
            <ReadText size={14} lineHeight={14 * SNUG} tone="ink-200" style={{ marginTop: 8 }}>
              {t('elsewhereOther')}
            </ReadText>
          )}
          {away ? (
            <Notice role="alert" size={13} style={{ marginTop: 12 }}>
              {t('elsewhereAway')}
            </Notice>
          ) : null}
          <View style={{ marginTop: 16, gap: 12 }}>
            {life.here ? (
              <Button variant="primary" wide disabled={starting} onPress={onTake}>
                {t('elsewhereTake')}
              </Button>
            ) : null}
            <Button variant="danger" wide disabled={starting} onPress={() => onEnd(life.gameId)}>
              {t('elsewhereEnd')}
            </Button>
            <Button variant="quiet" wide onPress={clearElsewhere}>
              {common('cancel')}
            </Button>
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

/**
 * Choose who to be. A locked life shows what unlocks it. A player signed in chooses whether the life is ranked (played by the server) or their own,
 * and a ranked life of theirs in progress on another device is asked about, never ended by starting here.
 */
export function NewLife({ opened }: { opened?: NewLifeOpened } = {}) {
  const t = useT('newLife');
  const common = useT('common');
  const go = useGo();
  const start = useGame((s) => s.start);
  const continueElsewhere = useGame((s) => s.continueElsewhere);
  const inProgress = useGame((s) => s.status === 'playing' && s.stage !== 'end');
  const [chosen, setChosen] = useState(lives[0].id);
  const [starting, setStarting] = useState(false);
  /** A life begun here: the page is on its way to it, and the life in progress it now sees is that one, not one to warn of. */
  const [begun, setBegun] = useState(false);
  const [asking, setAsking] = useState(opened === 'replace');
  /** The last try to start a life came to nothing, for a reason that is not the player's. */
  const [failed, setFailed] = useState(false);
  /** The ranked life in progress elsewhere could not be asked for just now. */
  const [away, setAway] = useState(false);
  // A ranked life is played by the server. It is offered when there is someone to play it for and a way to reach it.
  const ranking = useRanking();
  const [wantRanked, setWantRanked] = useState(true);
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
  // On the web the keyboard picks a life as the Next web's (docs/keyboard.md): the arrows, Home and End through the open lives in their order, each
  // chosen and given the focus; letters typed find one by its name (what is typed within 0.7 s of the last letter).
  useKeyboardContext('new-life');
  const { text: written } = useWords();
  const typed = useRef({ text: '', at: 0 });
  const chooseAndFocus = (id: string) => {
    setChosen(id);
    requestAnimationFrame(() => focusMarked('life', id));
  };
  const lifeKeys = onKeys((event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || available.length === 0) return false;
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (direction || event.key === 'Home' || event.key === 'End') {
      const at = Math.max(0, available.findIndex((life) => life.id === chosen));
      const next = event.key === 'Home' ? available[0] : event.key === 'End' ? available[available.length - 1] : available[(at + direction + available.length) % available.length];
      chooseAndFocus(next.id);
      return true;
    }
    if (event.key.length !== 1 || !/[\p{L}\p{N}]/u.test(event.key)) return false;
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + event.key.toLocaleLowerCase(), at: now };
    const match = available.find((life) => written.lives[life.id].name.toLocaleLowerCase().startsWith(typed.current.text));
    if (!match) return false;
    chooseAndFocus(match.id);
    return true;
  });
  /** The dice: another of the open lives, which is picked here and not in the state's update (a pick is not pure), and brought into view once it has moved. */
  const roll = () => {
    const next = anotherLife(openIds, chosen);
    if (next === chosen) return;
    revealing.current = next;
    setChosen(next);
  };

  /**
   * Starts the chosen life. `replace` names the ranked life in progress elsewhere that the player has said may end for it. The answer of a sheet
   * waits for the sheets to be gone before the page changes under them (`sheetsGone`: a Modal still leaving on iOS holds the screen that is
   * changing); one that came from the button has no sheet to wait for.
   */
  const begin = async (replace?: string, fromSheet = false) => {
    if (busy.current) return;
    busy.current = true;
    setAsking(false);
    setFailed(false);
    setAway(false);
    setStarting(true);
    try {
      // Nothing began if the player has a ranked life in progress somewhere else: they are asked what to do about it.
      // Replaced, not pushed: the Back button must not lead here again from a life, one tap away from ending it.
      if (await start(chosen, { ranked: ranking === 'yes' && wantRanked, replace })) {
        setBegun(true);
        if (fromSheet) await sheetsGone();
        go.replace('play');
      }
    } catch (error) {
      console.error('the life could not be started:', error);
      setFailed(true);
    } finally {
      busy.current = false;
      setStarting(false);
    }
  };
  /** Goes on with the ranked life in progress elsewhere, in place of starting one: from its sheet, once the sheet has gone. */
  const takeUp = async () => {
    if (busy.current) return;
    busy.current = true;
    setAway(false);
    setStarting(true);
    try {
      const answer = await continueElsewhere();
      if (answer === 'taken') {
        setBegun(true);
        await sheetsGone();
        go.replace('play');
      }
      // Gone, there is nothing in the way any more, and the sheet has closed by itself.
      else if (answer === 'away') setAway(true);
    } catch (error) {
      console.error('the life could not be taken up:', error);
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
          {ranking === 'yes' ? (
            // Two ways to play, side by side, each saying in a few words what it is.
            <View style={{ marginBottom: 8 }}>
              <Segmented<'ranked' | 'free'>
                label={t('mode')}
                value={wantRanked ? 'ranked' : 'free'}
                onChange={(mode) => setWantRanked(mode === 'ranked')}
                options={[
                  { value: 'ranked', label: t('modeRanked'), hint: t('modeRankedHint') },
                  { value: 'free', label: t('modeFree'), hint: t('modeFreeHint') },
                ]}
              />
            </View>
          ) : null}
          {ranking === 'offline' ? (
            <View accessible role="status" style={{ marginBottom: 8 }}>
              <ReadText size={12} tone="ink-200" style={{ textAlign: 'center' }}>
                {t('noConnection')}
              </ReadText>
            </View>
          ) : null}
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
        {...lifeKeys}
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
          <Button variant="danger" wide disabled={starting} onPress={() => void begin(undefined, true)}>
            {t('confirmYes')}
          </Button>
        </View>
      </Sheet>

      {/* A player has one ranked life in progress. One on another device is never ended by starting here: it is asked about. */}
      <ElsewhereSheet starting={starting} away={away} onTake={() => void takeUp()} onEnd={(gameId) => void begin(gameId, true)} />
    </Screen>
  );
}
