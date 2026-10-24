import { badgeArt, lives, portraitArt, ratArt } from '@ratrace/content';
import { ratLookOf } from '@ratrace/core/game/avatar';
import { MAX_MEMBERS, MIN_MEMBERS, ROUND_SECONDS, SHOUT_EVERY_MS, SHOUT_FACES, SHOUT_PHRASES } from '@ratrace/core/game/room';
import type { PublicPace, RoomMember, RoomState, RoundSeconds } from '@ratrace/core/game/room';
import type { GameStore } from '@ratrace/core/game/store';
import { indexed } from '@ratrace/engine';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePop, useRise } from '../../ui/animations';
import { copy } from '../../ui/copy';
import { DiscItem } from '../../ui/DiscItem';
import { webLine } from '../../ui/fonts';
import { CREAM, GOLD } from '../../ui/frames';
import { Framed } from '../../ui/Frame';
import { Button, Notice, Panel, pressDown, Raised, Segmented, SrOnly, Tag, usePress, Well } from '../../ui/kit';
import { Loading } from '../../ui/Loading';
import { Sheet, Toast, useSheetsShowing } from '../../ui/overlay';
import { Screen } from '../../ui/Page';
import { PERF, PerfDrawn } from '../../ui/perf';
import { RatAvatar } from '../../ui/RatAvatar';
import { useIsWide } from '../../ui/desk';
import { focusMarked, onKeys } from '../../ui/keyboard';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { TextField } from '../../ui/TextField';
import { COLORS, EXTRA } from '../../ui/theme';
import { GameScope, useClock, useCommunity, useGame, useProfile, useRoom, useSettings, useTrack, useWords } from '../context';
import { lifeRows } from '../lives';
import { useOwnT } from '../ownWords';
import { roomLink } from '../roomLink';
import { RoomPaper } from '../roomStory';
import { useRoomSlice } from '../roomSlice';
import { canShareLink, shareLink } from '../sharing';
import { useT } from '../words';
import { BackLink } from './BackLink';
import { LifeBrief, LifeSummary } from './LifeSummary';
import { Play } from './Play';
import type { RoomSlots } from './Play';
import { NAME } from './Rankings';
import { LinkButton, LoanOffers, LoanReplies, PlayerSheet } from './RoomLoans';
import type { LoanReply } from './RoomLoans';
import { clock, rankOf, useCountdown, useNameOf, useSecondsLeft, useSecondsToStart } from './RoomCard';

// The way back to a game from the front door, in a file of its own so that the front door does not load the room and the life played in it.
export { RoomCard, useRoomLive } from './RoomCard';

/*
 * The web's Room.tsx, on the phone: the way into a game with others (a public one, one of the player's own, one joined by its code or by an
 * invitation's link), its lobby, the life played in it (`RoomPlay`: Play's room slots, the bar over the round, the wait, the room's order after a
 * round and at the end, the shouts, the rematch), and the way back to it from the front door (`RoomCard`). Every look at the room brings it anew
 * from the server: each piece reads what it draws of it (`useRoomSlice`), so another player's shout or a seat that played draws only what shows it.
 */

/** The refusals the server gives in words of its own. Any other is told as a refusal with no reason. */
const REFUSALS = new Set(['unknown-room', 'started', 'full', 'other-version', 'in-a-room', 'locked-life', 'cannot-room', 'unreachable', 'alone', 'not-host', 'not-over']);
/** A round of a day is a day; one of hours, its hours; a quick one, its clock. */
const DAY = 86_400;
const HOUR = 3_600;
function usePaceOf() {
  const t = useT('room');
  return (seconds: number) => (seconds === DAY ? t('day') : seconds >= HOUR ? t('hours', { n: seconds / HOUR }) : clock(seconds));
}
/** A room's code as the web keeps one typed or brought by a link: its letters and digits, in capitals, six at most. */
const codeOf = (given: string): string => given.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);

/** A page of the rooms (the web's `max-w-md gap-4 px-3 pb-10 pt-4`): its way back, its title, what it holds, and what stands over it (a toast). */
function RoomPage({ title, fixed, children }: { title: string; fixed?: ReactNode; children: ReactNode }) {
  return (
    <Screen contentStyle={{ gap: 16, paddingBottom: 40 }} fixed={fixed}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={24} tone="gold-500">{title}</PixelText>
        </View>
      </View>
      {children}
    </Screen>
  );
}

/** A few words in the night's frame (the web's `frame bg-night-700 px-3 py-3 text-[15px]`): what the page has to say in place of what it would show. */
function Said({ role, children }: { role?: 'status'; children: string }) {
  return (
    <Notice role={role} bg="night-700" size={15} style={{ paddingVertical: 12 }}>
      {children}
    </Notice>
  );
}

/**
 * The server's words for a refusal, as the phone tells them: a version this app is not on is the app's to update, not a page's to reload (on the web,
 * the Next web's words: reload the page, `ownWords.web.ts`).
 */
function useRefusalText() {
  const t = useT('room');
  const phone = useOwnT();
  return (refusal: string) => (refusal === 'other-version' ? phone('roomOtherVersion') : t(`refused.${REFUSALS.has(refusal) ? refusal : 'refused'}`));
}

/** Why the last thing asked of the room did not happen, if it did not. Framed on a page; plain inside a sheet, which is framed itself. */
function Refusal({ plain = false }: { plain?: boolean }) {
  const refusal = useRoom((s) => s.refusal);
  const said = useRefusalText();
  if (refusal === null) return null;
  return plain ? (
    <View accessible role="alert">
      <ReadText size={14} tone="wine-300">{said(refusal)}</ReadText>
    </View>
  ) : (
    <Notice role="alert">{said(refusal)}</Notice>
  );
}

/**
 * Playing with friends: the way into a room, its lobby, and the life lived in it. It needs an account and a connection, and says so where there is
 * neither. `code` is the code an invitation's link brought (the route's `?code=`: `theratrace://room?code=`, or the web's own link opened on the phone).
 */
export function Room({ code }: { code?: string } = {}) {
  return (
    <>
      {PERF ? <RoomMark /> : null}
      <RoomShown code={code} />
    </>
  );
}

/**
 * What the room's page shows, told to the timing probe: its way in, its lobby, its game. Drawn in a build with EXPO_PUBLIC_PERF=1 only: any other
 * has no probe to tell, and need not follow the room for it.
 */
function RoomMark() {
  const where = useRoom((s) => (s.status === 'booting' ? 'booting' : s.status === 'unavailable' || s.status === 'away' ? s.status : s.room === null ? 'door' : s.room.status === 'open' ? 'lobby' : s.game === null ? 'loading' : 'playing'));
  return <PerfDrawn name={`room: ${where}`} />;
}

function RoomShown({ code }: { code?: string }) {
  const t = useT('room');
  const phone = useOwnT();
  const common = useT('common');
  const status = useRoom((s) => s.status);
  const room = useRoom((s) => s.room);
  const game = useRoom((s) => s.game);
  const refresh = useRoom((s) => s.refresh);
  const leave = useRoom((s) => s.leave);
  const otherRules = useRoom((s) => s.otherRules);

  if (status === 'booting') {
    return (
      <RoomPage title={t('title')}>
        <Loading>{common('loading')}</Loading>
      </RoomPage>
    );
  }
  if (status === 'unavailable') {
    return (
      <RoomPage title={t('title')}>
        <Said>{t('needAccount')}</Said>
      </RoomPage>
    );
  }
  if (status === 'away') {
    return (
      <RoomPage title={t('title')}>
        <Said>{t('away')}</Said>
        <Button variant="secondary" wide onPress={() => void refresh()}>
          {t('retry')}
        </Button>
      </RoomPage>
    );
  }
  if (status === 'none' || room === null) return <Door code={code} />;
  if (room.status === 'open') return <Lobby room={room} />;
  if (otherRules) {
    // The web's words say to reload the page: on the phone, a game on rules the app lacks waits for an update of it (on the web, the Next web's words).
    return (
      <RoomPage title={t('title')}>
        <Said role="status">{phone('roomOtherRules')}</Said>
        <Button variant="secondary" wide onPress={() => void leave()}>
          {t('leave')}
        </Button>
      </RoomPage>
    );
  }
  if (room.status === 'closed') {
    return (
      <RoomPage title={t('title')}>
        <Said role="status">{t('closed')}</Said>
        <Button variant="primary" wide onPress={() => void leave()}>
          {t('leave')}
        </Button>
      </RoomPage>
    );
  }
  if (game === null) {
    return (
      <RoomPage title={t('title')}>
        <Loading>{common('loading')}</Loading>
      </RoomPage>
    );
  }
  // One host a room: another room's game, should the store go straight to it, starts with none of this one's sheets, waits or answers.
  return <RoomPlay key={room.id} game={game} />;
}

/** The life lived in the room, on the screens of any life, with the room around it. */
function RoomPlay({ game }: { game: GameStore }) {
  return (
    <GameScope game={game}>
      <RoomScreens />
    </GameScope>
  );
}

/**
 * The room's members as the round's paper reads them (`roomStory`): who they are and how the rounds left them, nothing of what changes in a round
 * (who has played, who shouted), so the paper is not drawn again for it.
 */
function usePaperMembers(): readonly RoomMember[] {
  return useRoomSlice(({ room }) => (room === null ? [] : room.members.map((member) => ({ ...member, ready: false, shout: null }))));
}

/**
 * Play, with what the room puts round it (`RoomSlots`): each slot a piece that reads the room itself, made once, so the life's screens are not drawn
 * again by the room; only the wait, which stands in for the round's button, comes and goes. The shouts heard and the rounds the clock played stand
 * over all of it, the end of the life too.
 */
function RoomScreens() {
  const t = useT('room');
  const missed = useRoom((s) => s.missed);
  const clearMissed = useRoom((s) => s.clearMissed);
  const stage = useGame((s) => s.stage);
  const ready = useRoom((s) => s.room?.status === 'playing' && s.room.members.find((member) => member.me)?.ready === true);
  // Played, and waiting for the others: whether this page sent the round or the page before it did.
  const waiting = ready && stage === 'finance';
  const paper = usePaperMembers();
  const slots = useMemo<RoomSlots>(() => ({ bar: <RoomTop />, actions: waiting ? <Waiting /> : null, resolved: <RoomOrder />, end: <RoomEnd /> }), [waiting]);
  return (
    <View style={{ flex: 1 }}>
      <BarHost>
        <RoomPaper.Provider value={paper}>
          <Play room={slots} />
        </RoomPaper.Provider>
      </BarHost>
      <Heard />
      <Toast message={missed > 0 ? t('missed', { count: missed }) : null} onDone={clearMissed} ms={6_000} />
    </View>
  );
}

/** Over the round: the room's bar, a word on a game begun on earlier rules, and the loans of the round. */
function RoomTop() {
  const t = useT('room');
  const nameOf = useNameOf();
  const olderRules = useRoom((s) => s.olderRules);
  return (
    <View style={{ gap: 8 }}>
      <RoomBar />
      {olderRules ? <ReadText size={12} tone="ink-300" lineHeight={12 * SNUG}>{t('olderRules')}</ReadText> : null}
      <LoanOffers nameOf={nameOf} />
    </View>
  );
}

/** What the bar draws of the room: those still in (their rats, and who has played), the player's place, and the round. */
type BarSlice = {
  here: Array<{ userId: string; avatar: string | null; ready: boolean; me: boolean }>;
  place: number | null;
  playing: boolean;
  round: number;
  rounds: number;
  seconds: number;
  public: boolean;
};

/** A seat on the bar: the rat, ringed in gold for the player, faded until it has played, with a tick once it has. Drawn again only when it plays. */
const BarSeat = memo(function BarSeat({ userId, avatar, ready, me }: { userId: string; avatar: string | null; ready: boolean; me: boolean }) {
  return (
    <View style={{ flexShrink: 0, opacity: ready ? 1 : 0.6 }}>
      <MemberRat member={{ userId, avatar }} />
      {/* The player's ring, outside the seat's box as the web's outline is: it takes no room, and moves nothing. */}
      {me ? <View pointerEvents="none" style={{ position: 'absolute', left: -2, top: -2, right: -2, bottom: -2, borderWidth: 2, borderColor: COLORS['gold-500'] }} /> : null}
      {ready ? (
        <View style={{ position: 'absolute', right: -6, top: -6, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS['teal-300'] }}>
          <ReadText size={10} weight={600} tone="night-900" lineHeight={10}>{'✓'}</ReadText>
        </View>
      ) : null}
    </View>
  );
});

/**
 * The bar's button, which carries the round's clock: drawn again once a second, as the clock moves, and nothing in it but the clock and the line of
 * its time (the rats are `seats`, made by the bar, the same each second).
 */
function BarButton({ ready, total, place, playing, seconds, seats, onPress }: { ready: number; total: number; place: number | null; playing: boolean; seconds: number; seats: ReactNode; onPress(): void }) {
  const t = useT('room');
  const left = useSecondsLeft();
  const time = left === null ? '—' : clock(left);
  const low = left !== null && left <= 20;
  const share = left === null || seconds <= 0 ? 0 : Math.max(0, Math.min(1, left / seconds));
  // How many have played, said beside the rats where there is room for it (the web's `max-sm:hidden`).
  const wide = useIsWide();
  return (
    <Raised label={t('bar', { time, ready, total })} bg="night-700" place={{ flex: 1, minWidth: 0 }} style={{ minHeight: 0 }} onPress={onPress}>
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
        <View aria-hidden style={{ minWidth: 56, flexShrink: 0 }}>
          <PixelText size={22} tone={low ? 'wine-300' : 'gold-500'} style={{ fontVariant: ['tabular-nums'] }}>{time}</PixelText>
        </View>
        {seats}
        {wide ? (
          <View aria-hidden style={{ flexShrink: 0 }}>
            <ReadText size={12} tone="ink-300">{t('playedShort', { ready, total })}</ReadText>
          </View>
        ) : null}
        {place !== null ? (
          <View aria-hidden style={{ flexShrink: 0 }}>
            <PixelText size={16} tone="cream">{t('placeShort', { place })}</PixelText>
          </View>
        ) : null}
        <View aria-hidden style={{ flexShrink: 0 }}>
          <PixelText size={15} tone="ink-300">{'▸'}</PixelText>
        </View>
      </View>
      {/* The round's time, running out: gold, and wine for the last seconds. */}
      {playing && left !== null ? (
        <View aria-hidden style={{ height: 4, alignSelf: 'stretch', backgroundColor: COLORS['night-900'] }}>
          <View style={{ height: 4, width: `${share * 100}%`, backgroundColor: COLORS[low ? 'wine-300' : 'gold-500'] }} />
        </View>
      ) : null}
    </Raised>
  );
}

/**
 * What the room's bar opens, and what the loans of the round are waiting for: kept by `BarHost`, which stands round Play and never moves. The bar
 * itself is drawn where the stage puts it (over the finances' tabs, or at the top of any other stage), and is made anew as the stage changes: its
 * sheets, the shout's wait and an answer to a loan on its way are not its own, so they outlive it.
 */
type BarOpens = { order(): void; shout(): void };
const BarOpens = createContext<BarOpens>({ order: () => undefined, shout: () => undefined });

/**
 * The room's bar's sheets and what they hold, kept through the round: the room's order, the question of leaving, another player (and the terms of a
 * loan being typed), and the shouts with their wait. A round turning, which moves the bar, leaves every one of them as it was.
 */
function BarHost({ children }: { children: ReactNode }) {
  const t = useT('room');
  const common = useT('common');
  const nameOf = useNameOf();
  const shout = useRoom((s) => s.shout);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [shouting, setShouting] = useState(false);
  // When the next shout is taken: the sheet counts down to it while it is open, and nothing else is drawn for it.
  const [until, setUntil] = useState(0);
  const [replying, setReplying] = useState<string | null>(null);
  const replies = useMemo<LoanReply>(() => [replying, setReplying], [replying]);
  // Loans need a life on rules that know them: a game begun before them goes on without.
  const loans = useGame((s) => (s.view ? Object.hasOwn(s.view.player.life.flags, 'in_room') : false));
  const room = useRoomSlice(({ room: now }) => (now === null ? null : { playing: now.status === 'playing', round: now.round, rounds: now.rounds, public: now.public }));
  const opens = useMemo<BarOpens>(() => ({ order: () => setOpen(true), shout: () => setShouting(true) }), []);
  const pick = useCallback((userId: string) => {
    // One sheet at a time: the order gives way to the player.
    setOpen(false);
    setPicked(userId);
  }, []);
  // The sheet closes the moment a shout is chosen: the server is asked after, and the wait starts at once (by the clock the wait is counted by).
  const now = useClock();
  const send = useCallback(
    (n: number) => {
      setUntil(now() + SHOUT_EVERY_MS);
      setShouting(false);
      void shout(n);
    },
    [shout, now],
  );
  return (
    <BarOpens.Provider value={opens}>
      <LoanReplies.Provider value={replies}>
        {children}
        {room ? (
          <>
            <BarSheet
              open={open}
              onClose={() => setOpen(false)}
              playing={room.playing}
              round={room.round}
              rounds={room.rounds}
              loans={loans}
              onPick={loans || room.public ? pick : undefined}
              onLeave={() => {
                // One sheet at a time: the order gives way to the question.
                setOpen(false);
                setLeaving(true);
              }}
            />
            <LeaveSheet open={leaving} onClose={() => setLeaving(false)} />
            <PlayerSheet member={picked === null ? null : { userId: picked }} nameOf={nameOf} loans={loans} onClose={() => setPicked(null)} />
          </>
        ) : null}
        <Sheet open={shouting} onClose={() => setShouting(false)} title={t('shoutTitle')} closeLabel={common('close')}>
          <ShoutChoices until={until} onSend={send} />
        </Sheet>
      </LoanReplies.Provider>
    </BarOpens.Provider>
  );
}

/** Above the round: the time left and how it runs out, who has played, the player's place, and the way to the room's order, to leaving and to shouting. */
function RoomBar() {
  const t = useT('room');
  const opens = useContext(BarOpens);
  const bar = useRoomSlice<BarSlice | null>(({ room }) => {
    if (room === null) return null;
    const here = room.members.filter((member) => !member.left);
    const me = here.find((member) => member.me);
    return {
      here: here.map((member) => ({ userId: member.userId, avatar: member.avatar, ready: member.ready, me: member.me })),
      place: me?.standing ? rankOf(room.members, me) : null,
      playing: room.status === 'playing',
      round: room.round,
      rounds: room.rounds,
      seconds: room.seconds,
      public: room.public,
    };
  });
  const seats = useMemo(
    () =>
      bar === null ? null : (
        <View aria-hidden style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden', paddingTop: 4 }}>
          {bar.here.map((member) => (
            <BarSeat key={member.userId} userId={member.userId} avatar={member.avatar} ready={member.ready} me={member.me} />
          ))}
        </View>
      ),
    [bar],
  );
  if (bar === null) return null;
  const ready = bar.here.filter((member) => member.ready).length;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <BarButton ready={ready} total={bar.here.length} place={bar.place} playing={bar.playing} seconds={bar.seconds} seats={seats} onPress={opens.order} />
      <Raised label={t('shoutTitle')} bg="night-700" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={opens.shout}>
        <Sprite id="icon.room_shout" />
      </Raised>
    </View>
  );
}

/** The room's order, opened from the bar: the round and its time in the title, where each is in the round, and the way out of the game. */
function BarSheet({ open, onClose, playing, round, rounds, loans, onPick, onLeave }: { open: boolean; onClose(): void; playing: boolean; round: number; rounds: number; loans: boolean; onPick?: (userId: string) => void; onLeave(): void }) {
  const t = useT('room');
  const common = useT('common');
  // Its clock counts only while it is open.
  const left = useSecondsLeft(open);
  const time = left === null ? '—' : clock(left);
  return (
    <Sheet open={open} onClose={onClose} title={playing ? t('sheetTitle', { round: Math.min(round + 1, rounds), total: rounds, time }) : t('final')} closeLabel={common('close')}>
      <Standings live onPick={onPick} />
      {playing && loans ? <ReadText size={12} tone="ink-300" style={{ marginTop: 8, textAlign: 'center' }}>{t('loan.pickHint')}</ReadText> : null}
      {playing ? (
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <LinkButton onPress={onLeave}>{t('leave')}</LinkButton>
        </View>
      ) : null}
    </Sheet>
  );
}

/** The members still in, best first by the score the last round left them with; those who left after them. */
function ordered(members: readonly RoomMember[]): RoomMember[] {
  const score = (member: RoomMember) => member.standing?.score ?? Number.NEGATIVE_INFINITY;
  return [...members].sort((a, b) => Number(a.left) - Number(b.left) || score(b) - score(a));
}

/** A line of the room's order, as plain data: what it shows, worked out from the room. Its net worth in the dollars the life began with. */
type StandingLine = {
  userId: string;
  avatar: string | null;
  name: string | null;
  bot: string | null;
  me: boolean;
  left: boolean;
  rank: string;
  moved: number;
  cityId: string | null;
  career: { id: string; level: number } | null;
  escaped: boolean;
  /** Where they are in the round being played, for a `live` order; null otherwise. */
  played: boolean | null;
  netWorth: number | null;
  score: number | null;
  gained: number;
  /** Another player still in, while the game is played or once it is over: their line opens them. A rat's, never. */
  opens: boolean;
};

/** The room's order as its lines draw it. `live` adds where each is in the round being played. */
function standingLines(room: RoomState | null, live: boolean): StandingLine[] {
  if (room === null) return [];
  const list = ordered(room.members);
  const inPlay = live && room.status === 'playing';
  const open = room.status === 'playing' || room.status === 'finished';
  return list.map((member, at) => {
    const standing = member.left ? null : member.standing;
    const tied = standing !== null && list.some((other) => other !== member && !other.left && other.standing?.score === standing.score);
    const before = standing?.before ?? null;
    return {
      userId: member.userId,
      avatar: member.avatar,
      name: member.name,
      bot: member.bot,
      me: member.me,
      left: member.left,
      rank: member.left ? '·' : `${rankOf(room.members, member)}${tied ? '=' : ''}`,
      // Places move by the order shown, the order the server kept the round before.
      moved: before === null ? 0 : before.place - (at + 1),
      cityId: standing?.cityId ?? null,
      career: standing?.career ?? null,
      escaped: standing?.escaped === true,
      played: inPlay && !member.left ? member.ready : null,
      netWorth: standing ? standing.netWorth : null,
      score: member.standing ? member.standing.score : null,
      gained: standing !== null && before !== null ? standing.score - before.score : 0,
      opens: open && !member.me && !member.left && member.bot === null,
    };
  });
}

/**
 * The members of the room in order, with what the last round left each of them: their place and how it moved, their net worth, their score and what
 * the round added to it. `live` adds where each is in the round being played. `onPick` opens another player still in (a loan in play, following them
 * at the end, a name to report in a public game). Bare: whoever holds it frames it. Each line is drawn again only when what it shows changes.
 */
function Standings({ live = false, onPick }: { live?: boolean; onPick?: (userId: string) => void }) {
  const t = useT('room');
  const lines = useRoomSlice(({ room }) => standingLines(room, live));
  return (
    <View>
      <View aria-hidden style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <ReadText size={11} tone="ink-300" style={{ width: 64, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 11 * 0.05 }}>{t('worthShort')}</ReadText>
        <ReadText size={11} tone="ink-300" style={{ width: 56, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 11 * 0.05 }}>{t('score')}</ReadText>
      </View>
      <View role="list">
        {lines.map((line, at) => (
          <StandingRow key={line.userId} line={line} first={at === 0} onPick={line.opens ? onPick : undefined} />
        ))}
      </View>
    </View>
  );
}

/** One line of the room's order. Its `line` is compared by what it holds: a line that shows the same is not drawn again, whatever else changed. */
const StandingRow = memo(
  function StandingRow({ line, first, onPick }: { line: StandingLine; first: boolean; onPick?: (userId: string) => void }) {
    const t = useT('room');
    const { fmt, names, text } = useWords();
    const nameOf = useNameOf();
    // The server counts net worth in the dollars a life began with; the page shows it in today's, as the HUD does. Everyone in the room lives in the
    // same world, so the player's own prices serve for all.
    const world = useGame((s) => s.view?.timeline[s.view.round] ?? null);
    const where = [line.cityId ? names.cities[line.cityId] : null, line.career ? text.careers[line.career.id]?.levels[line.career.level] : null].filter(Boolean).join(' · ');
    const body = (
      <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
        <View style={{ width: 28, flexShrink: 0, alignItems: 'center' }}>
          {/* The web's `pixel` sets its own line (1.1) over the column's `leading-none`, as it does the score's over `leading-tight`. */}
          <PixelText size={16} tone="ink-300">{line.rank}</PixelText>
          {line.moved !== 0 ? (
            <View accessible role="img" aria-label={t(line.moved > 0 ? 'movedUp' : 'movedDown', { n: Math.abs(line.moved) })} style={{ marginTop: 2 }}>
              <ReadText size={11} tone={line.moved > 0 ? 'teal-300' : 'wine-300'} lineHeight={11}>{`${line.moved > 0 ? '▲' : '▼'}${Math.abs(line.moved)}`}</ReadText>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MemberRat member={{ userId: line.userId, avatar: line.avatar }} />
            <ReadText size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{nameOf(line)}</ReadText>
            {line.me ? <Tag tone="good" item>{t('you')}</Tag> : null}
            {line.bot ? <Tag item>{t('bot')}</Tag> : null}
          </View>
          {where ? <ReadText size={12} tone="ink-200" numberOfLines={1}>{where}</ReadText> : null}
          {line.left || line.escaped || line.played !== null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
              {line.left ? <ReadText size={12} tone="ink-300">{t('left')}</ReadText> : null}
              {line.escaped ? <ReadText size={12} tone="teal-300">{t('escaped')}</ReadText> : null}
              {line.played !== null ? <ReadText size={12} tone={line.played ? 'teal-300' : 'ink-300'}>{t(line.played ? 'played' : 'playing')}</ReadText> : null}
            </View>
          ) : null}
        </View>
        {/* Net worth in a column of its own, beside the points. */}
        <View style={{ width: 64, flexShrink: 0 }}>
          <ReadText size={13} tone="ink-200" style={{ textAlign: 'right', fontVariant: ['tabular-nums'] }}>{line.netWorth === null ? '—' : fmt.compact(world ? indexed(line.netWorth, world) : line.netWorth)}</ReadText>
          <SrOnly>{t('worthShort')}</SrOnly>
        </View>
        <View style={{ width: 56, flexShrink: 0, alignItems: 'flex-end' }}>
          <PixelText size={18} tone="gold-500">{line.score === null ? '—' : fmt.number(line.score)}</PixelText>
          <SrOnly>{t('score')}</SrOnly>
          {line.gained !== 0 ? <ReadText size={12} tone={line.gained > 0 ? 'teal-300' : 'wine-300'} lineHeight={12 * TIGHT}>{`${line.gained > 0 ? '+' : '−'}${fmt.number(Math.abs(line.gained))}`}</ReadText> : null}
        </View>
      </View>
    );
    return (
      <View role="listitem" style={{ opacity: line.left ? 0.6 : 1, ...(first ? null : { borderTopWidth: 2, borderTopColor: COLORS['night-900'] }) }}>
        {onPick ? <PickLine userId={line.userId} onPick={onPick}>{body}</PickLine> : body}
      </View>
    );
  },
  (a, b) => a.first === b.first && a.onPick === b.onPick && JSON.stringify(a.line) === JSON.stringify(b.line),
);

/** A line of the room's order that opens another player: a button. */
function PickLine({ userId, onPick, children }: { userId: string; onPick(userId: string): void; children: ReactNode }) {
  const press = usePress({ onPress: () => onPick(userId) });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={({ pressed }) => pressDown(pressed)}>
      {children}
    </Pressable>
  );
}

/** In place of the round's button, once the player has played: who the room is waiting for, and how long it may. */
function Waiting() {
  const t = useT('room');
  const nameOf = useNameOf();
  const left = useSecondsLeft();
  const here = useRoomSlice(({ room }) => (room === null ? [] : room.members.filter((member) => !member.left).map((member) => ({ userId: member.userId, name: member.name, bot: member.bot, ready: member.ready }))));
  const choosing = here.filter((member) => !member.ready).map(nameOf);
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingVertical: 4 }}>
      {/* The rat naps while the others play. */}
      <Sprite id={ratArt('sleep')} fallback={{ w: 128, h: 128 }} size={{ w: 64, h: 64 }} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <PixelText size={17} tone="cream">{t('waiting')}</PixelText>
        {/* The clock is in the room's bar for a screen reader; said here every second it would drown the rest. */}
        {left === null ? null : (
          <View aria-hidden>
            <PixelText size={17} tone="gold-500" style={{ fontVariant: ['tabular-nums'] }}>{clock(left)}</PixelText>
          </View>
        )}
      </View>
      <View accessible role="status" style={{ alignItems: 'center' }}>
        <ReadText size={13} tone="ink-200" style={{ textAlign: 'center' }}>{t('waitingCount', { ready: here.length - choosing.length, total: here.length })}</ReadText>
        {choosing.length > 0 ? <ReadText size={13} tone="ink-300" style={{ textAlign: 'center' }}>{t('choosing', { names: choosing.join(', ') })}</ReadText> : null}
      </View>
    </View>
  );
}

/** Under the ledger of a round: the room's order as the round left it. */
function RoomOrder() {
  const t = useT('room');
  const title = useRoom((s) => (s.room?.status === 'finished' ? t('final') : t('afterRound', { n: s.room?.round ?? 0 })));
  return (
    <View role="region" aria-label={title}>
      <Panel title={title}>
        <Standings />
      </Panel>
    </View>
  );
}

/** What the end draws of the room: the player's place among those still in. */
type EndSlice = { place: number; total: number };

/** Above the end of the life: the room's final order, the player's place and the badges the game earned, the way to the others, the rematch, and out. */
function RoomEnd() {
  const t = useT('room');
  const { text } = useWords();
  const nameOf = useNameOf();
  const earned = useRoom((s) => s.earned);
  const busy = useRoom((s) => s.busy);
  const leave = useRoom((s) => s.leave);
  const [picked, setPicked] = useState<string | null>(null);
  const end = useRoomSlice<EndSlice>(({ room }) => {
    const here = room?.members.filter((member) => !member.left) ?? [];
    const me = room?.members.find((member) => member.me);
    return { place: room && me && !me.left && me.standing ? rankOf(room.members, me) : 0, total: here.length };
  });
  const others = useRoom((s) => s.room?.members.some((member) => !member.left && !member.me && member.bot === null) === true);
  const pick = useCallback((userId: string) => setPicked(userId), []);
  const { locale } = useSettings();
  const badgeLine = webLine([['read', 14, 14 * TIGHT], ['pixel', 16, 16 * 1.1]], locale);
  return (
    <View role="region" aria-label={t('final')}>
      <Panel title={t('final')}>
        {end.place > 0 ? (
          <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sprite id="icon.room_podium" />
            <PixelText size={20} tone="gold-500">{t('place', { place: end.place, total: end.total })}</PixelText>
          </View>
        ) : null}
        {earned.length > 0 ? (
          <View role="list" aria-label={t('newBadges')} style={{ marginBottom: 8, gap: 6 }}>
            {earned.map((id) => (
              <View key={id} role="listitem" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Its own 64: the web's `size-10` loses to the picture's own size, which its Sprite sets inline. */}
                <Sprite id={badgeArt(id)} />
                {/* The web's `text-[14px] leading-tight` box: a block line of 12 (its line 1.25 × 12), then the name, a pixel 16 in a line of the box's 14. */}
                <View style={{ flexShrink: 1 }}>
                  <ReadText size={12} tone="ink-300" lineHeight={12 * TIGHT}>{t('newBadge')}</ReadText>
                  <View style={{ height: badgeLine.height }}>
                    <PixelText size={16} tone="gold-500" style={{ marginTop: badgeLine.tops[1] }}>{text.badges[id]?.name ?? id}</PixelText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {/* Another player opens, to be followed, or their name reported in a public game. */}
        <Standings onPick={pick} />
        {others ? <ReadText size={12} tone="ink-300" style={{ marginTop: 4, textAlign: 'center' }}>{t('followHint')}</ReadText> : null}
        <PlayerSheet member={picked === null ? null : { userId: picked }} nameOf={nameOf} loans={false} onClose={() => setPicked(null)} />
        <View style={{ marginTop: 12, gap: 8, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
          <Rematch />
          <Refusal plain />
          <Button variant="secondary" wide disabled={busy} onPress={() => void leave()}>
            {t('leave')}
          </Button>
        </View>
      </Panel>
    </View>
  );
}

/** A rematch of the room that is over: a life, which is the same one unless chosen otherwise, on the same pace. */
function RematchSheet({ lifeId: was, seconds, open, onClose }: { lifeId: string; seconds: number; open: boolean; onClose(): void }) {
  const t = useT('room');
  const paceOf = usePaceOf();
  const common = useT('common');
  const busy = useRoom((s) => s.busy);
  const rematch = useRoom((s) => s.rematch);
  const available = useAvailableLives();
  const [lifeId, setLifeId] = useState(available.includes(was) ? was : (available[0] ?? 'nurse'));
  const go = async () => {
    if (await rematch(lifeId)) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('rematch')} closeLabel={common('close')}>
      <View style={{ gap: 16 }}>
        <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG}>{t('rematchAbout', { time: paceOf(seconds) })}</ReadText>
        <View>
          <Over>{t('life')}</Over>
          <LifePicker label={t('life')} lives={available} value={lifeId} onChange={setLifeId} />
        </View>
        <Refusal plain />
        <Button variant="primary" wide disabled={busy} onPress={() => void go()}>
          {t('rematchCreate')}
        </Button>
      </View>
    </Sheet>
  );
}

/** What the rematch draws of the room that is over. */
type RematchSlice = { finished: boolean; public: boolean; seconds: number; lifeId: string; rematch: { code: string; open: boolean } | null };

/**
 * What a room that is over offers next: its rematch to join once someone has opened it, or to open. A public game offers another public game
 * instead: its players did not come together.
 */
function Rematch() {
  const t = useT('room');
  const track = useTrack();
  const busy = useRoom((s) => s.busy);
  const join = useRoom((s) => s.join);
  const quick = useRoom((s) => s.quick);
  const [asking, setAsking] = useState(false);
  const room = useRoomSlice<RematchSlice | null>(({ room: now }) => (now === null ? null : { finished: now.status === 'finished', public: now.public, seconds: now.seconds, lifeId: now.lifeId, rematch: now.rematch }));
  if (room === null || !room.finished) return null;
  if (room.public) {
    // Another of the same pace as the one just played.
    const slow = room.seconds >= HOUR;
    return (
      <Button variant="primary" wide disabled={busy} onPress={() => void quick(slow ? 'slow' : 'live').then((joined) => joined && track({ name: 'game_join', via: 'quick' }))}>
        <Sprite id="icon.multiplayer" />
        {t(slow ? 'quickAgainSlow' : 'quickAgain')}
      </Button>
    );
  }
  const waiting = room.rematch?.open ? room.rematch : null;
  if (waiting) {
    return (
      <View style={{ gap: 6 }}>
        <View accessible role="status">
          <ReadText size={14} tone="ink-200" style={{ textAlign: 'center' }}>{t('rematchWaiting')}</ReadText>
        </View>
        <Button variant="primary" wide disabled={busy} onPress={() => void join(waiting.code)}>
          {t('rematchJoin')}
        </Button>
      </View>
    );
  }
  // Opened and started already: there is nothing left to join.
  if (room.rematch !== null) return null;
  return (
    <>
      <Button variant="primary" wide disabled={busy} onPress={() => setAsking(true)}>
        <Sprite id="icon.room_rematch" />
        {t('rematch')}
      </Button>
      <RematchSheet lifeId={room.lifeId} seconds={room.seconds} open={asking} onClose={() => setAsking(false)} />
    </>
  );
}

/** The phrases a member may shout, by their number after the faces. */
const PHRASES = ['shout0', 'shout1', 'shout2', 'shout3', 'shout4', 'shout5', 'shout6', 'shout7'] as const;
/** How long a shout stays on screen. */
const SHOUT_SHOWN_MS = 4_000;

/** What a shout says: a face, or one of the phrases. */
function useShoutText() {
  const t = useT('room');
  return (n: number) => (n < SHOUT_FACES.length ? SHOUT_FACES[n] : t(PHRASES[Math.min(n - SHOUT_FACES.length, SHOUT_PHRASES - 1)]));
}

/** The way to shout to the others from the lobby: a face or a phrase from a short list, one every ten seconds. (In play, the bar's square: `BarHost`.) */
function ShoutButton() {
  const t = useT('room');
  const common = useT('common');
  const shout = useRoom((s) => s.shout);
  const [open, setOpen] = useState(false);
  // When the next shout is taken: the sheet counts down to it while it is open, and nothing else is drawn for it.
  const [until, setUntil] = useState(0);
  // The sheet closes the moment a shout is chosen: the server is asked after, and the wait starts at once (by the clock the wait is counted by).
  const now = useClock();
  const send = useCallback(
    (n: number) => {
      setUntil(now() + SHOUT_EVERY_MS);
      setOpen(false);
      void shout(n);
    },
    [shout, now],
  );
  return (
    <>
      <Button variant="secondary" wide onPress={() => setOpen(true)}>
        <Sprite id="icon.room_shout" />
        {t('shoutTitle')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('shoutTitle')} closeLabel={common('close')}>
        <ShoutChoices until={until} onSend={send} />
      </Sheet>
    </>
  );
}

/** The faces and the phrases to shout, and how long until the next may be: counted once a second while it is shown, and only then. */
function ShoutChoices({ until, onSend }: { until: number; onSend(n: number): void }) {
  const t = useT('room');
  const textOf = useShoutText();
  const now = useClock();
  const counted = useCountdown(until > now() ? until : null, 0);
  const wait = counted ?? 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SHOUT_FACES.map((face, n) => (
          <Raised key={face} label={face} disabled={wait > 0} bg="night-700" place={{ flex: 1, minWidth: 0 }} style={{ aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }} onPress={() => onSend(n)}>
            <ReadText size={24} lineHeight={28}>{face}</ReadText>
          </Raised>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PHRASES.map((key, at) => (
          <Raised key={key} disabled={wait > 0} bg="night-600" place={{ width: '48%', flexGrow: 1 }} style={{ paddingHorizontal: 8, paddingVertical: 6, justifyContent: 'center' }} onPress={() => onSend(SHOUT_FACES.length + at)}>
            <ReadText size={14} lineHeight={14 * TIGHT}>{textOf(SHOUT_FACES.length + at)}</ReadText>
          </Raised>
        ))}
      </View>
      <View accessible role="status">
        <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{wait > 0 ? t('shoutWait', { n: wait }) : t('shoutAbout')}</ReadText>
      </View>
    </View>
  );
}

/** What the shouts heard draw of the room: the name and the rat of each who shouted. */
type Shouter = { userId: string; name: string | null; bot: string | null; avatar: string | null };

/**
 * What the others shouted, each for a moment at the top of the screen, as they come: one timer at a time, for the first on screen, however many
 * come. Over the page, not over a sheet (a sheet is a window of its own on the phone): those heard while one is open wait for it to go.
 */
function Heard() {
  const heard = useRoom((s) => s.heard);
  const dismiss = useRoom((s) => s.dismissHeard);
  const inset = useSafeAreaInsets();
  const shouters = useRoomSlice<Shouter[]>(({ room, heard: now }) =>
    room === null ? [] : room.members.filter((member) => now.some((shout) => shout.userId === member.userId)).map((member) => ({ userId: member.userId, name: member.name, bot: member.bot, avatar: member.avatar })),
  );
  // A sheet stands over the page, where the shouts are: they wait for it to go (the room keeps the latest three), and each is then shown its whole time.
  const covered = useSheetsShowing();
  const first = heard[0];
  useEffect(() => {
    if (!first || covered) return;
    const timer = setTimeout(() => dismiss(first.key), SHOUT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [first, dismiss, covered]);
  if (heard.length === 0 || covered) return null;
  return (
    <View
      accessible
      role="status"
      aria-live="polite"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{ position: 'absolute', top: inset.top, left: 0, right: 0, zIndex: 60, alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}
    >
      {heard.map((shout) => {
        const member = shouters.find((one) => one.userId === shout.userId);
        return <HeardShout key={shout.key} n={shout.n} userId={shout.userId} name={member?.name ?? null} bot={member?.bot ?? null} avatar={member?.avatar ?? null} known={member !== undefined} />;
      })}
    </View>
  );
}

/**
 * One shout: the rat and the name of who shouted, and what they said, rising in; a face pops. Said once by a screen reader on iOS (Android's region
 * says it). Drawn once: another shout coming, or going, leaves it as it is.
 */
const HeardShout = memo(function HeardShout({ n, userId, name: named, bot, avatar, known }: { n: number; userId: string; name: string | null; bot: string | null; avatar: string | null; known: boolean }) {
  const nameOf = useNameOf();
  const textOf = useShoutText();
  const rise = useRise();
  const pop = usePop();
  const face = n < SHOUT_FACES.length;
  const name = known ? nameOf({ userId, name: named, bot }) : '';
  const said = textOf(n);
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(`${name} ${said}`);
    // Said once, as it comes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[{ width: '100%', maxWidth: 384 }, rise]}>
      {/* Its shadow, 4 right and 4 down: it sits over the game, and says someone is talking. */}
      <View style={{ position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, backgroundColor: EXTRA.shoutShadow }} />
      <Framed kind="raised" tone={GOLD} style={{ backgroundColor: COLORS['night-600'], flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
        {known ? <MemberRat member={{ userId, avatar }} size="md" /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText size={12} tone="gold-200" numberOfLines={1} style={{ textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{name}</PixelText>
          {face ? (
            <Animated.View style={[{ marginTop: 2, alignSelf: 'flex-start' }, pop]}>
              <ReadText size={34} lineHeight={34}>{said}</ReadText>
            </Animated.View>
          ) : (
            <PixelText size={20} tone="cream" lineHeight={20 * TIGHT} style={{ marginTop: 2 }}>{said}</PixelText>
          )}
        </View>
      </Framed>
    </Animated.View>
  );
});

/** A note of the page's (the web's `frame bg-night-700 px-3 py-2 text-[14px]`): a game closed under the player, or a public one they were taken out of. */
function Told({ children }: { children: string }) {
  return (
    <Notice role="status" bg="night-700">
      {children}
    </Notice>
  );
}

/** In no room: a quick game with whoever is looking for one, a game of one's own, or one joined with a code. A link with a code fills it in. */
function Door({ code: given }: { code?: string }) {
  const t = useT('room');
  const track = useTrack();
  const busy = useRoom((s) => s.busy);
  const join = useRoom((s) => s.join);
  const quick = useRoom((s) => s.quick);
  const closed = useRoom((s) => s.closed);
  const clearClosed = useRoom((s) => s.clearClosed);
  const dropped = useRoom((s) => s.dropped);
  const clearDropped = useRoom((s) => s.clearDropped);
  const lobbies = useRoom((s) => s.lobbies);
  const lookForLobbies = useRoom((s) => s.lookForLobbies);
  // A public game played together, or a round a day with whoever comes.
  const [pace, setPace] = useState<PublicPace>('live');
  const waiting = lobbies?.[pace] ?? 0;
  useEffect(() => {
    void lookForLobbies();
  }, [lookForLobbies]);
  const [opening, setOpening] = useState(false);
  const [code, setCode] = useState('');
  // An invitation is a link with the room's code: it is shown as one, to be joined with one press.
  const invited = given === undefined || codeOf(given).length !== 6 ? null : codeOf(given);
  const submit = () => {
    if (busy || code.length !== 6) return;
    clearClosed();
    void join(code).then((joined) => joined && track({ name: 'game_join', via: 'code' }));
  };

  // Come by an invitation, the page is the invitation: the game to join, and the one button that joins it.
  if (invited) {
    return (
      <RoomPage title={t('title')}>
        <View role="region" aria-label={t('invited')}>
          <Framed kind="raised" tone={GOLD} style={{ backgroundColor: COLORS['night-600'], paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center', gap: 12 }}>
            <Sprite id="icon.skill_network" size={{ w: 48, h: 48 }} />
            <PixelText size={18} tone="gold-500" lineHeight={18 * TIGHT} style={{ textAlign: 'center' }}>{t('invited')}</PixelText>
            <PixelText size={52} tone="cream" lineHeight={52} style={{ textAlign: 'center', letterSpacing: 52 * 0.16 }}>{invited}</PixelText>
            <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG} style={{ textAlign: 'center' }}>{t('invitedAbout')}</ReadText>
            <Button
              variant="primary"
              wide
              disabled={busy}
              onPress={() => {
                clearClosed();
                void join(invited).then((joined) => joined && track({ name: 'game_join', via: 'link' }));
              }}
            >
              {t('joinInvite')}
            </Button>
          </Framed>
        </View>
        {closed ? <Told>{t('closed')}</Told> : null}
        <Refusal />
      </RoomPage>
    );
  }

  return (
    <RoomPage title={t('title')}>
      <View role="list" style={{ gap: 6 }}>
        {(['introSame', 'introWho', 'introPace'] as const).map((line) => (
          <View key={line} role="listitem" style={{ flexDirection: 'row', gap: 8 }}>
            <View aria-hidden>
              <ReadText size={15} tone="gold-500" lineHeight={15 * SNUG}>{'▸'}</ReadText>
            </View>
            <ReadText size={15} tone="ink-200" lineHeight={15 * SNUG} style={{ flex: 1 }}>{t(line)}</ReadText>
          </View>
        ))}
      </View>
      {closed ? <Told>{t('closed')}</Told> : null}
      {dropped ? <Told>{t('dropped')}</Told> : null}
      {/* The quickest way in: a seat in a public game, with no code to pass round, at the pace chosen. */}
      <View style={{ gap: 6 }}>
        <Segmented<PublicPace>
          label={t('publicPace')}
          value={pace}
          onChange={setPace}
          options={[
            { value: 'live', label: t('paceTogether') },
            { value: 'slow', label: t('paceSlow') },
          ]}
        />
        <Button
          variant="primary"
          wide
          disabled={busy}
          onPress={() => {
            clearClosed();
            clearDropped();
            void quick(pace).then((joined) => joined && track({ name: 'game_join', via: 'quick' }));
          }}
        >
          <Sprite id="icon.multiplayer" />
          {t(pace === 'live' ? 'quick' : 'quickSlow')}
        </Button>
        {waiting > 0 ? (
          <View accessible role="status">
            <ReadText size={13} tone="teal-300" style={{ textAlign: 'center' }}>{t('openNow', { count: waiting })}</ReadText>
          </View>
        ) : null}
        <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ textAlign: 'center' }}>{t(pace === 'live' ? 'quickAbout' : 'quickSlowAbout')}</ReadText>
      </View>
      <Button variant="secondary" wide disabled={busy} onPress={() => setOpening(true)}>
        {t('open')}
      </Button>
      <Panel title={t('join')}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText size={12} tone="ink-300" style={{ marginBottom: 4 }}>{t('code')}</ReadText>
            <TextField label={t('code')} kind="room" value={code} onChangeText={setCode} placeholder="······" returnKeyType="go" onSubmitEditing={submit} />
          </View>
          <Button variant="secondary" disabled={busy || code.length !== 6} onPress={submit}>
            {t('enter')}
          </Button>
        </View>
      </Panel>
      <Refusal />
      <OpenSheet open={opening} onClose={() => setOpening(false)} />
    </RoomPage>
  );
}

/** One life to choose, with its face: small in its column, or across both with what it is, chosen. Drawn again only when it is chosen or let go. */
const LifeChoice = memo(function LifeChoice({ id, on, onChoose }: { id: string; on: boolean; onChoose(id: string): void }) {
  return (
    // Half the row, or all of it for the life chosen: 4 on each side, the grid 8 wider than its sheet, so the gap between two is 8.
    <View style={{ width: on ? '100%' : '50%', paddingHorizontal: 4 }}>
      <Raised
        marks={{ roomLife: id }}
        tabbable={on}
        role="radio"
        checked={on}
        tone={on ? CREAM : {}}
        bg={on ? 'cream' : 'night-600'}
        place={{ flexGrow: 1 }}
        style={{ flexGrow: 1, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 4 }}
        onPress={() => onChoose(id)}
      >
        <Sprite id={portraitArt(id, 22)} fallback={{ w: 64, h: 64 }} />
        {on ? <LifeSummary lifeId={id} light /> : <LifeBrief lifeId={id} />}
      </Raised>
    </View>
  );
});

/** One of the lives the player may live, each with its face: a choice in two columns, the one chosen across both (the web's dense grid). */
function LifePicker({ label, lives: choices, value, onChange }: { label: string; lives: readonly string[]; value: string; onChange(id: string): void }) {
  const order = useMemo(() => lifeRows(choices, value).flat(), [choices, value]);
  // On the web the arrows, Home and End move through the lives in their order, each chosen and given the focus (the web's `LifePicker`).
  const keys = onKeys((event) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step && event.key !== 'Home' && event.key !== 'End') return false;
    const at = Math.max(0, choices.indexOf(value));
    const next = event.key === 'Home' ? choices[0] : event.key === 'End' ? choices[choices.length - 1] : choices[(at + step + choices.length) % choices.length];
    onChange(next);
    requestAnimationFrame(() => focusMarked('room-life', next));
    return true;
  });
  return (
    <View {...keys} accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 }}>
      {order.map((id) => (
        <LifeChoice key={id} id={id} on={id === value} onChoose={onChange} />
      ))}
    </View>
  );
}

/** The lives the player may live: those everyone has, and those they have unlocked. */
function useAvailableLives(): string[] {
  const { unlocked } = useProfile();
  return useMemo(() => lives.filter((life) => life.unlock === 'default' || Object.hasOwn(unlocked, life.id)).map((life) => life.id), [unlocked]);
}

/** A label over a choice in a sheet (the web's `text-[13px] text-ink-300`). */
function Over({ children, below = false }: { children: string; below?: boolean }) {
  return (
    <ReadText size={13} tone="ink-300" style={below ? { marginTop: 6 } : { marginBottom: 6 }}>
      {children}
    </ReadText>
  );
}

/** Opening a room: its life, from those the player may live, and how long a round may take. */
function OpenSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('room');
  const paceOf = usePaceOf();
  const common = useT('common');
  const busy = useRoom((s) => s.busy);
  const openRoom = useRoom((s) => s.open);
  const available = useAvailableLives();
  const [lifeId, setLifeId] = useState(available[0] ?? 'nurse');
  const [seconds, setSeconds] = useState<RoundSeconds>(180);
  const go = async () => {
    if (await openRoom(lifeId, seconds)) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('open')} closeLabel={common('close')}>
      <View style={{ gap: 16 }}>
        <View>
          <Over>{t('pace')}</Over>
          <Segmented<RoundSeconds> label={t('pace')} value={seconds} onChange={setSeconds} options={ROUND_SECONDS.map((value) => ({ value, label: paceOf(value) }))} />
          <Over below>{t(seconds >= HOUR ? 'paceDay' : 'paceLive')}</Over>
        </View>
        <View>
          <Over>{t('life')}</Over>
          <LifePicker label={t('life')} lives={available} value={lifeId} onChange={setLifeId} />
        </View>
        <Refusal plain />
        <Button variant="primary" wide disabled={busy} onPress={() => void go()}>
          {t('create')}
        </Button>
      </View>
    </Sheet>
  );
}

/** Asks before leaving, saying what leaving does here: a host closes the lobby; in play the life ends. */
function LeaveSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('room');
  const common = useT('common');
  const leave = useRoom((s) => s.leave);
  const busy = useRoom((s) => s.busy);
  // A public lobby goes on without whoever opened it: only a game among friends closes behind its host.
  const what = useRoom((s) => (s.room?.status === 'playing' ? 'leavePlaying' : s.room?.members.find((member) => member.me)?.host && !s.room.public ? 'leaveHost' : null));
  return (
    <Sheet open={open} onClose={onClose} title={t('leaveTitle')} closeLabel={common('close')} tone="wine">
      {what ? <ReadText size={15} tone="ink-200" lineHeight={15 * SNUG}>{t(what)}</ReadText> : null}
      <View style={{ marginTop: 16, gap: 12 }}>
        <Button variant="danger" wide disabled={busy} onPress={() => void leave()}>
          {t('confirmLeave')}
        </Button>
        <Button variant="secondary" wide onPress={onClose}>
          {t('stay')}
        </Button>
      </View>
    </Sheet>
  );
}

/** How long a public lobby has to start by itself, counted down: a leaf of its own, so that only the clock is drawn again each second. */
function StartsIn() {
  const t = useT('room');
  const toStart = useSecondsToStart();
  return (
    <View role="timer">
      <PixelText size={36} tone="cream" lineHeight={36} style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {toStart === null || toStart > 0 ? t('startsIn', { time: clock(toStart ?? 0) }) : t('startsSoon')}
      </PixelText>
    </View>
  );
}

/** Someone at the table: their rat, their name, and what they are to the game. The player's own line has the way to name themselves. */
const Seat = memo(function Seat({ userId, name, avatar, host, bot, me, first }: { userId: string; name: string; avatar: string | null; host: boolean; bot: boolean; me: boolean; first: boolean }) {
  const t = useT('room');
  return (
    <View
      role="listitem"
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, ...(first ? null : { borderTopWidth: 2, borderTopColor: COLORS['night-900'] }) }}
    >
      <MemberRat member={{ userId, avatar }} />
      <ReadText size={15} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{name}</ReadText>
      {host ? <Tag item>{t('host')}</Tag> : null}
      {bot ? <Tag item>{t('bot')}</Tag> : null}
      {me ? <Tag tone="good" item>{t('you')}</Tag> : null}
      {me ? <RenameButton /> : null}
    </View>
  );
});

/**
 * The lobby: the code to share, the life everyone will live, who is in, and the start, which is the host's. A public one leads with how long until it
 * starts by itself, and anyone in it may start it. Each seat is drawn again only when what it shows changes, not for another player coming or going.
 */
function Lobby({ room }: { room: RoomState }) {
  const t = useT('room');
  const track = useTrack();
  const paceOf = usePaceOf();
  const { text } = useWords();
  const { locale } = useSettings();
  const nameOf = useNameOf();
  const busy = useRoom((s) => s.busy);
  const start = useRoom((s) => s.start);
  const leave = useRoom((s) => s.leave);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const here = room.members.filter((member) => !member.left);
  const me = here.find((member) => member.me);
  const enough = here.length >= MIN_MEMBERS;
  const url = roomLink(locale, room.code);
  const members = t('members', { count: here.length, max: MAX_MEMBERS });
  // The phone always has a share sheet; a browser may not (the web shows Share only where it has one, and the public Invite copies the link without).
  const canShare = canShareLink();

  const share = async () => {
    try {
      if (await shareLink(t('title'), t('inviteText', { code: room.code }), url)) track({ name: 'share', what: 'invite' });
    } catch {
      // The share sheet would not open: the code is on screen, and the link can be copied.
    }
  };
  const copyLink = async () => {
    if (await copy(url, () => setCopied(true))) track({ name: 'share', what: 'invite' });
  };

  return (
    <RoomPage
      title={t('title')}
      fixed={
        <>
          <Heard />
          <Toast message={copied ? t('copied') : null} onDone={() => setCopied(false)} />
        </>
      }
    >
      {room.public ? (
        // A public game is found, not shared: its clock comes first. Someone may still be invited to it.
        <View role="region" aria-label={t('searching')} style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <PixelText size={18} tone="gold-500" style={{ textAlign: 'center' }}>{t('searching')}</PixelText>
          <StartsIn />
          <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ textAlign: 'center' }}>{t('fillWithBots')}</ReadText>
          {/* A round a day: each plays theirs when they can, and a notice says when the next is theirs. */}
          {room.seconds >= HOUR ? <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ textAlign: 'center' }}>{t('paceDay')}</ReadText> : null}
          <Button variant="secondary" onPress={() => void (canShare ? share() : copyLink())}>
            {t('invite')}
          </Button>
        </View>
      ) : (
        <View role="region" aria-label={t('code')} style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <ReadText size={12} tone="ink-300" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{t('code')}</ReadText>
          <PixelText size={44} tone="gold-500" lineHeight={44} style={{ textAlign: 'center', letterSpacing: 44 * 0.18 }}>{room.code}</PixelText>
          {/* Both ways out where there is a share sheet (the phone always has one); the browser's may be missing: only the link to copy. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {canShare ? (
              <Button variant="secondary" onPress={() => void share()}>
                {t('share')}
              </Button>
            ) : null}
            <Button variant="secondary" onPress={() => void copyLink()}>
              {t('copyLink')}
            </Button>
          </View>
        </View>
      )}
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Well style={{ width: 68, height: 68 }}>
            <Sprite id={portraitArt(room.lifeId, 22)} fallback={{ w: 64, h: 64 }} />
          </Well>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText size={12} tone="ink-300">{t('everyone')}</ReadText>
            <PixelText size={18} numberOfLines={1}>{text.lives[room.lifeId]?.name ?? room.lifeId}</PixelText>
            <ReadText size={13} tone="ink-200">{t('round', { time: paceOf(room.seconds) })}</ReadText>
          </View>
        </View>
      </Panel>
      {/* What a newcomer needs before the first round: three rules, and what can be done to the others. */}
      <View role="region" aria-label={t('rules.title')}>
        <Panel title={t('rules.title')}>
          <View role="list" style={{ gap: 4 }}>
            {[t('rules.same'), t('rules.clock', { time: paceOf(room.seconds) }), t('rules.win'), ...(room.public ? [t('rules.idle')] : [])].map((rule) => (
              <DiscItem key={rule}>{rule}</DiscItem>
            ))}
          </View>
          <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ marginTop: 8 }}>{t('rules.others')}</ReadText>
        </Panel>
      </View>
      <View role="region" aria-label={members}>
        <Panel title={members}>
          <View role="list">
            {here.map((member, at) => (
              <Seat
                key={member.userId}
                userId={member.userId}
                name={nameOf(member)}
                avatar={member.avatar}
                host={member.host && !room.public}
                bot={member.bot !== null}
                me={member.me}
                first={at === 0}
              />
            ))}
          </View>
        </Panel>
      </View>
      {room.public ? (
        // Anyone here may start it now, with rats in the empty seats, rather than wait for its clock.
        <Button variant="primary" wide disabled={busy} onPress={() => void start()}>
          {t('startNow')}
        </Button>
      ) : me?.host ? (
        <View style={{ gap: 6 }}>
          <Button variant="primary" wide disabled={busy || !enough} onPress={() => void start()}>
            {t('start')}
          </Button>
          {enough ? null : <ReadText size={13} tone="ink-300" style={{ textAlign: 'center' }}>{t('needsTwo')}</ReadText>}
        </View>
      ) : (
        <View accessible role="status">
          <PixelText size={15} tone="ink-200" style={{ textAlign: 'center' }}>{t('waitingHost')}</PixelText>
        </View>
      )}
      <Refusal />
      <ShoutButton />
      <Button variant="quiet" wide disabled={busy} onPress={() => (me?.host && !room.public ? setAsking(true) : void leave())}>
        {t('leave')}
      </Button>
      <LeaveSheet open={asking} onClose={() => setAsking(false)} />
    </RoomPage>
  );
}

/** The way for the player to name themselves where the others will see it: in the lobby, before the game begins. Asked about in a sheet. */
function RenameButton() {
  const t = useT('room');
  const ranks = useT('rankings');
  const common = useT('common');
  const community = useCommunity();
  const refresh = useRoom((s) => s.refresh);
  const named = useRoom((s) => s.room?.members.find((member) => member.me)?.name != null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'refused' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  if (community === null) return null;
  const save = async () => {
    if (busy) return;
    const asked = name.trim();
    // How it is written is checked here, before anyone is asked. What it says is the database's to judge.
    if (!NAME.test(asked)) return setProblem('invalid');
    setBusy(true);
    const answer = await community.rename(asked);
    setBusy(false);
    if (answer !== 'ok') return setProblem(answer);
    setOpen(false);
    await refresh();
  };
  return (
    <>
      <Button
        variant="quiet"
        size={13}
        padX={8}
        onPress={() => {
          setName('');
          setProblem(null);
          setOpen(true);
        }}
      >
        {t(named ? 'renameShort' : 'nameYourself')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('renameTitle')} closeLabel={common('close')}>
        <View style={{ gap: 12 }}>
          <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG}>{t('renameAbout')}</ReadText>
          <View style={{ gap: 4 }}>
            <ReadText size={13} tone="ink-200">{ranks('name')}</ReadText>
            <TextField label={ranks('name')} value={name} onChangeText={setName} maxLength={16} returnKeyType="go" onSubmitEditing={() => void save()} />
          </View>
          {problem ? (
            <View accessible role="alert">
              <ReadText size={13} tone="wine-300">{ranks(problem)}</ReadText>
            </View>
          ) : null}
          <Button variant="primary" wide disabled={busy} onPress={() => void save()}>
            {ranks('save')}
          </Button>
        </View>
      </Sheet>
    </>
  );
}

/** A player's rat, as they dressed it, or the one their id gives them. */
export function MemberRat({ member, size = 'sm' }: { member: Pick<RoomMember, 'userId' | 'avatar'>; size?: 'sm' | 'md' }) {
  return <RatAvatar look={ratLookOf(member.avatar, member.userId)} size={size} />;
}
