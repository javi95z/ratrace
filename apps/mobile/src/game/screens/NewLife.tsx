import { cityIcon, lives, portraitArt } from '@ratrace/content';
import type { LifeDef } from '@ratrace/content';
import { characterName } from '@ratrace/core/game/characters';
import { difficultyOf } from '@ratrace/core/game/difficulty';
import { ageAt } from '@ratrace/core/game/present';
import { unlockProgress } from '@ratrace/core/game/unlockProgress';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { useIsWide, WIDE_COLUMN } from '../../ui/desk';
import { useHaptic } from '../../ui/haptic';
import { Button, Notice, Raised, Segmented, SrOnly } from '../../ui/kit';
import { focusedMark, focusMarked, onKeys, useKeyboardContext } from '../../ui/keyboard';
import { Sheet } from '../../ui/overlay';
import { Screen } from '../../ui/Page';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, GUTTER, SHELL_WIDTH } from '../../ui/theme';
import { useGame, useProfile, useRanking, useRuns, useSettings, useT, useWords } from '../context';
import { anotherLife } from '../lives';
import { BackLink } from './BackLink';
import { LifeFace } from './LifeFace';
import { Difficulty } from './LifeSummary';
import { useGo } from '../pages';

const byId = new Map<string, LifeDef>(lives.map((life) => [life.id, life]));
const LEVELS = ['level1', 'level2', 'level3'] as const;

/**
 * What a scene shows open at the start (a client draws a scene by the screen's own initial state, never by a tap): the question of ending the life
 * in progress, the sheet of the first life still locked, or that of the first open life. Left out, the screen as a player first meets it.
 */
export type NewLifeOpened = 'replace' | 'locked' | 'life';

/** The grid's columns: three on a phone, five in the web's wider column (`WIDE_COLUMN`), so that no tile is larger than a phone's. */
export const COLUMNS = { phone: 3, wide: 5 } as const;
/** The gap between two tiles, across and down. */
const GAP = 8;
/** The most a tile's portrait is drawn at: one and a half points to an art pixel. */
const PORTRAIT_MAX = 96;
/** What a tile keeps round its portrait: its padding and frame. */
const TILE_ROOM = 12;
/** The portrait of the sheet of one life. */
const SHEET_PORTRAIT = 96;

/**
 * How large a tile's portrait is drawn: as large as its tile lets it be, up to `PORTRAIT_MAX`, in steps of a quarter of a point to an art pixel (16
 * points), so that the art's pixels stay even. `window` is the window's width (none on the build's machine: then the column's).
 */
export function portraitSize(window: number, column: number, columns: number): number {
  const inner = Math.min(window > 0 ? window : column, column) - 2 * GUTTER;
  const tile = (inner + GAP) / columns - GAP;
  return Math.max(48, Math.min(PORTRAIT_MAX, Math.floor((tile - TILE_ROOM) / 16) * 16));
}

/**
 * One life in the grid: its portrait, large, its job on one line, the city's icon and how hard it is. A life still locked is only the shape of who it
 * is, with a lock. Pressed, it opens the sheet of the life. Drawn again only when its Tab stop moves: twenty are on the page of someone who has them all.
 */
const LifeTile = memo(function LifeTile({ id, locked, portrait, width, tabbable, onOpen }: { id: string; locked: boolean; portrait: number; width: string; tabbable: boolean; onOpen(id: string): void }) {
  const t = useT('newLife');
  const { text, names } = useWords();
  const haptic = useHaptic();
  const life = byId.get(id);
  if (!life) return null;
  const name = text.lives[id]?.name ?? id;
  const label = locked ? t('lockedTile', { life: name }) : t('tile', { life: name, city: names.cities[life.start.cityId], level: t(LEVELS[difficultyOf(id) - 1]) });
  return (
    // A share of the row; 4 on each side and the grid made 8 wider than its page, so that the gap between two is 8 and the outer edges are the page's.
    <View style={{ width: width as `${number}%`, paddingHorizontal: GAP / 2 }}>
      <Raised
        marks={{ life: id }}
        tabbable={tabbable}
        label={label}
        bg={locked ? 'night-800' : 'night-700'}
        place={{ flexGrow: 1 }}
        style={{ flexGrow: 1, alignItems: 'center', gap: 6, padding: 6 }}
        onPress={() => {
          haptic('select');
          onOpen(id);
        }}
      >
        {locked ? <Silhouette id={id} px={portrait} /> : <LifeFace lifeId={id} size="lg" px={portrait} />}
        <View aria-hidden style={{ alignSelf: 'stretch' }}>
          <ReadText size={12} lineHeight={14} tone={locked ? 'ink-300' : 'ink-200'} numberOfLines={1} style={{ textAlign: 'center' }}>
            {name}
          </ReadText>
        </View>
        {locked ? null : (
          <View aria-hidden style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Sprite id={cityIcon(life.start.cityId)} size={{ w: 16, h: 16 }} />
            <Difficulty lifeId={id} word />
          </View>
        )}
      </Raised>
    </View>
  );
});

/** A life still locked: only the dark shape of who it is, and a lock at its foot. */
function Silhouette({ id, px }: { id: string; px: number }) {
  return (
    <View aria-hidden style={{ width: px, height: px, backgroundColor: COLORS['night-600'] }}>
      <Sprite id={portraitArt(id, 22)} fallback={{ w: 64, h: 64 }} size={{ w: px, h: px }} silhouette />
      <View style={{ position: 'absolute', bottom: 2, right: 2 }}>
        <Sprite id="icon.locked" fallback={{ w: 16, h: 16 }} size={{ w: 16, h: 16 }} />
      </View>
    </View>
  );
}

/** Where a life starts, with how much, and how hard it is, beside its portrait; then a line each of what it is good at and what holds it back. */
function LifeDetails({ id }: { id: string }) {
  const t = useT('newLife');
  const { text, names, fmt } = useWords();
  const life = byId.get(id);
  const written = text.lives[id];
  if (!life || !written) return null;
  const city = names.cities[life.start.cityId];
  const cash = fmt.money(life.start.cash);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LifeFace lifeId={id} size="lg" px={SHEET_PORTRAIT} />
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 6 }}>
          <SrOnly>{t('startsIn', { city, cash })}</SrOnly>
          {/* What the sentence above says, for the eyes. */}
          <View aria-hidden style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sprite id={cityIcon(life.start.cityId)} size={{ w: 20, h: 20 }} />
              <ReadText size={14} tone="ink-200">{city}</ReadText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sprite id="icon.cash" size={{ w: 20, h: 20 }} />
              <PixelText size={15} tone="ink-200">{cash}</PixelText>
            </View>
          </View>
          <Difficulty lifeId={id} word />
        </View>
      </View>
      <ReadText size={14} lineHeight={14 * SNUG} tone="teal-300">{`＋ ${written.perk}`}</ReadText>
      <ReadText size={14} lineHeight={14 * SNUG} tone="wine-300">{`− ${written.handicap}`}</ReadText>
    </View>
  );
}

/** What unlocks a life still locked, how far the player is, and a hint of what it is, beside its shape. */
function LockedDetails({ id, finished }: { id: string; finished: number | null }) {
  const t = useT('newLife');
  const { text } = useWords();
  const life = byId.get(id);
  if (!life) return null;
  const progress = unlockProgress(life.unlock, finished);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Silhouette id={id} px={SHEET_PORTRAIT} />
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 6 }}>
          <ReadText size={14} lineHeight={14 * SNUG} tone="gold-500" after={[{ text: text.lives[id].unlock, tone: 'ink-200' }]}>
            {`${t('unlock')}: `}
          </ReadText>
          {progress ? (
            <ReadText size={13} lineHeight={13 * SNUG} tone="teal-300">{t('progressFinished', { n: progress.have, total: progress.need })}</ReadText>
          ) : null}
          <Difficulty lifeId={id} word />
        </View>
      </View>
      <ReadText size={14} lineHeight={14 * SNUG} tone="ink-300" italic>{t(`hints.${id}`)}</ReadText>
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
 * Choose who to be: every life a tile of a grid, the open ones first and those still locked after them. A tile opens the sheet of its life: what it
 * is and the button that starts it, or, for one still locked, what unlocks it. A player signed in chooses there whether the life is ranked (played by
 * the server) or their own, and a ranked life of theirs in progress on another device is asked about, never ended by starting here.
 */
export function NewLife({ opened }: { opened?: NewLifeOpened } = {}) {
  const t = useT('newLife');
  const common = useT('common');
  const go = useGo();
  const start = useGame((s) => s.start);
  const continueElsewhere = useGame((s) => s.continueElsewhere);
  const inProgress = useGame((s) => s.status === 'playing' && s.stage !== 'end');
  // Which lives are open is the profile's to say. Nothing is judged here.
  const { unlocked } = useProfile();
  const runs = useRuns();
  const { locale } = useSettings();
  const { text: written } = useWords();
  const available = useMemo(() => lives.filter((life) => life.unlock === 'default' || Object.hasOwn(unlocked, life.id)), [unlocked]);
  const locked = useMemo(() => lives.filter((life) => !available.includes(life)), [available]);
  const openIds = useMemo(() => available.map((life) => life.id), [available]);
  /** Every tile, in the order of the grid: the open lives, then the locked. */
  const order = useMemo(() => [...available, ...locked].map((life) => life.id), [available, locked]);
  const finished = runs?.length ?? null;

  /** The life whose sheet is open, or was last: kept while its sheet leaves, so that the sheet does not empty as it goes. */
  const [chosen, setChosen] = useState<string>(() => (opened === 'locked' ? (locked[0]?.id ?? lives[0].id) : lives[0].id));
  const [sheetOpen, setSheetOpen] = useState(opened === 'locked' || opened === 'life');
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
  /** A life being begun: a second press while it is is no second life, whatever the screen has drawn by then. */
  const busy = useRef(false);
  const chosenOpen = !locked.some((life) => life.id === chosen);

  // Three tiles to a row on a phone, more in the web's wider column; each portrait as large as its tile lets it be.
  const wide = useIsWide();
  const columns = wide ? COLUMNS.wide : COLUMNS.phone;
  const { width: windowWidth } = useWindowDimensions();
  const portrait = portraitSize(windowWidth, wide ? WIDE_COLUMN : SHELL_WIDTH, columns);
  const tileWidth = `${100 / columns}%`;

  const [tabStop, setTabStop] = useState(order[0]);
  const openLife = useCallback((id: string) => {
    setFailed(false);
    setChosen(id);
    setTabStop(id);
    setSheetOpen(true);
  }, []);
  /** The dice: the sheet of one of the open lives, never the one last opened. Picked here, not in the state's update: a pick is not pure. */
  const roll = () => openLife(anotherLife(openIds, chosen));

  // On the web the keyboard moves through the grid (docs/keyboard.md): one Tab stop, the arrows across a row and down a column, Home and End to
  // the first and the last; letters typed find a life by its name (what is typed within 0.7 s of the last letter). Enter opens the life's sheet.
  useKeyboardContext('new-life');
  const typed = useRef({ text: '', at: 0 });
  const focusTile = (id: string) => {
    setTabStop(id);
    requestAnimationFrame(() => focusMarked('life', id));
  };
  const gridKeys = onKeys((event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || order.length === 0) return false;
    // From the tile in focus (one pressed or clicked into is not the Tab stop until the arrows move), else the Tab stop.
    const at = Math.max(0, order.indexOf(focusedMark('life') ?? tabStop));
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
    if (step !== undefined || event.key === 'Home' || event.key === 'End') {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : Math.min(order.length - 1, Math.max(0, at + (step ?? 0)));
      focusTile(order[next]);
      return true;
    }
    if (event.key.length !== 1 || !/[\p{L}\p{N}]/u.test(event.key)) return false;
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + event.key.toLocaleLowerCase(), at: now };
    const match = order.find((id) => written.lives[id]?.name.toLocaleLowerCase().startsWith(typed.current.text));
    if (!match) return false;
    focusTile(match);
    return true;
  });

  /**
   * Starts the chosen life. `replace` names the ranked life in progress elsewhere that the player has said may end for it. The page changes only once
   * every sheet is gone (`sheetsGone`: a Modal still leaving on iOS holds the screen that is changing). A life that did not begin because one is in
   * progress elsewhere closes the life's sheet, for the question of that one to take its turn; one that failed opens it again, saying so.
   */
  const begin = async (replace?: string) => {
    if (busy.current) return;
    busy.current = true;
    setAsking(false);
    setFailed(false);
    setAway(false);
    setStarting(true);
    try {
      // Replaced, not pushed: the Back button must not lead here again from a life, one tap away from ending it.
      if (await start(chosen, { ranked: ranking === 'yes' && wantRanked, replace })) {
        setBegun(true);
        setSheetOpen(false);
        await sheetsGone();
        go.replace('play');
      } else setSheetOpen(false);
    } catch (error) {
      console.error('the life could not be started:', error);
      setFailed(true);
      setSheetOpen(true);
    } finally {
      busy.current = false;
      setStarting(false);
    }
  };
  /** The sheet's Start: a life in progress is not ended by one tap, the question is asked first, once the life's sheet has made way for it. */
  const startPressed = () => {
    if (busy.current || begun) return;
    if (inProgress) {
      setSheetOpen(false);
      setAsking(true);
    } else void begin();
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

  const name = written.lives[chosen]?.name ?? chosen;
  const character = chosenOpen ? characterName(chosen, locale) : null;

  return (
    <Screen width={wide ? WIDE_COLUMN : undefined} contentStyle={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={24} tone="gold-500">{t('title')}</PixelText>
        </View>
        {/* Someone who cannot choose lets the dice: the sheet of one of the open lives, started only with its own button. */}
        {available.length > 1 ? (
          <Raised bg="night-700" place={{ marginLeft: 'auto' }} style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }} onPress={roll}>
            <PixelText size={14} tone="ink-200">{t('random')}</PixelText>
          </Raised>
        ) : null}
      </View>

      {/* Every life, the open ones first: a tile each, which opens its sheet. */}
      <View {...gridKeys} aria-label={t('title')} style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -GAP / 2, rowGap: GAP }}>
        {order.map((id, at) => (
          <LifeTile key={id} id={id} locked={at >= available.length} portrait={portrait} width={tileWidth} tabbable={id === tabStop} onOpen={openLife} />
        ))}
      </View>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={character ? `${name} · ${character}` : name}
        closeLabel={common('close')}
      >
        {chosenOpen ? (
          <>
            <LifeDetails id={chosen} />
            <View style={{ marginTop: 16, gap: 8 }}>
              {inProgress && !starting && !begun ? (
                <ReadText size={13} tone="wine-300" style={{ textAlign: 'center' }}>
                  {t('replace')}
                </ReadText>
              ) : null}
              {ranking === 'yes' ? (
                // Two ways to play, side by side, each saying in a few words what it is.
                <Segmented<'ranked' | 'free'>
                  label={t('mode')}
                  value={wantRanked ? 'ranked' : 'free'}
                  onChange={(mode) => setWantRanked(mode === 'ranked')}
                  options={[
                    { value: 'ranked', label: t('modeRanked'), hint: t('modeRankedHint') },
                    { value: 'free', label: t('modeFree'), hint: t('modeFreeHint') },
                  ]}
                />
              ) : null}
              {ranking === 'offline' ? (
                <View accessible role="status">
                  <ReadText size={12} tone="ink-200" style={{ textAlign: 'center' }}>
                    {t('noConnection')}
                  </ReadText>
                </View>
              ) : null}
              {failed ? (
                <Notice role="alert" size={13} center>
                  {t('failed')}
                </Notice>
              ) : null}
              <Button variant="primary" wide disabled={starting || begun} onPress={startPressed}>
                {t('start')}
              </Button>
            </View>
          </>
        ) : (
          <LockedDetails id={chosen} finished={finished} />
        )}
      </Sheet>

      <Sheet open={asking && inProgress} onClose={() => setAsking(false)} title={t('confirmTitle')} closeLabel={common('close')} back={false}>
        <InProgress />
        <View style={{ marginTop: 16, gap: 12 }}>
          <Button variant="primary" wide onPress={() => setAsking(false)}>
            {t('confirmNo')}
          </Button>
          <Button variant="danger" wide disabled={starting} onPress={() => void begin()}>
            {t('confirmYes')}
          </Button>
        </View>
      </Sheet>

      {/* A player has one ranked life in progress. One on another device is never ended by starting here: it is asked about. */}
      <ElsewhereSheet starting={starting} away={away} onTake={() => void takeUp()} onEnd={(gameId) => void begin(gameId)} />
    </Screen>
  );
}
