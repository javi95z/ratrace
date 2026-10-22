import { lives, portraitArt } from '@ratrace/content';
import { ratLookOf } from '@ratrace/core/game/avatar';
import { MAX_MEMBERS, memberName, MIN_MEMBERS, ROUND_SECONDS } from '@ratrace/core/game/room';
import type { PublicPace, RoomMember, RoomState, RoundSeconds } from '@ratrace/core/game/room';
import type { GameStore } from '@ratrace/core/game/store';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { copy } from '../../ui/copy';
import { adjustedRead } from '../../ui/fonts';
import { CREAM, GOLD } from '../../ui/frames';
import { Framed } from '../../ui/Frame';
import { Button, Notice, Panel, Raised, Segmented, Tag, Well } from '../../ui/kit';
import { Loading } from '../../ui/Loading';
import { Sheet, Toast } from '../../ui/overlay';
import { Screen } from '../../ui/Page';
import { RatAvatar } from '../../ui/RatAvatar';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { TextField } from '../../ui/TextField';
import { COLORS } from '../../ui/theme';
import { GameScope, useCommunity, useProfile, useRoom, useSettings, useTrack, useWords } from '../context';
import { lifeRows } from '../lives';
import { shareLink } from '../sharing';
import { SITE_URL } from '../site';
import { useT } from '../words';
import { BackLink } from './BackLink';
import { LifeBrief, LifeSummary } from './LifeSummary';
import { Play } from './Play';
import { NAME } from './Rankings';

/*
 * The web's Room.tsx, on the phone: the way into a game with others (a public one, one of the player's own, one joined by its code or by an
 * invitation's link), its lobby, and the way back to it from the front door (`RoomCard`). The life played in a room (its bar, its order, its loans,
 * its shouts, its end) is Task 10's: `RoomPlay` is where it goes.
 */

/** The refusals the server gives in words of its own. Any other is told as a refusal with no reason. */
const REFUSALS = new Set(['unknown-room', 'started', 'full', 'other-version', 'in-a-room', 'locked-life', 'cannot-room', 'unreachable', 'alone', 'not-host', 'not-over']);
/** Seconds as a clock reads them: 1:30; hours and minutes for a round of a day, 23h 05m. */
const clock = (seconds: number) =>
  seconds >= 3_600 ? `${Math.floor(seconds / 3_600)}h ${String(Math.floor((seconds % 3_600) / 60)).padStart(2, '0')}m` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
/** A round of a day is a day; one of hours, its hours; a quick one, its clock. */
const DAY = 86_400;
const HOUR = 3_600;
function usePaceOf() {
  const t = useT('room');
  return (seconds: number) => (seconds === DAY ? t('day') : seconds >= HOUR ? t('hours', { n: seconds / HOUR }) : clock(seconds));
}
/** What a member is called: their name, the rat their id makes of them, or the kind of rat a bot is. */
function useNameOf() {
  const t = useT('room');
  return useCallback((member: Pick<RoomMember, 'name' | 'bot' | 'userId'>) => memberName(t, member), [t]);
}

/** A room's code as the web keeps one typed or brought by a link: its letters and digits, in capitals, six at most. */
const codeOf = (given: string): string => given.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);

/**
 * The whole seconds left until `at` (by the server's clock, `skew` ahead of the phone's), read as the screen is drawn; drawn again once a second, as
 * the count changes, and never more (the web draws it four times a second). Null without `at`.
 */
function useCountdown(at: number | null, skew: number): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (at === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      const ms = at - (Date.now() + skew);
      if (ms <= 0) return;
      // A moment past the next whole second, when the count reads one less.
      timer = setTimeout(() => {
        tick((n) => n + 1);
        next();
      }, (ms % 1_000 || 1_000) + 5);
    };
    next();
    return () => clearTimeout(timer);
  }, [at, skew]);
  return at === null ? null : Math.max(0, Math.ceil((at - (Date.now() + skew)) / 1_000));
}

/** The seconds left before a public lobby starts by itself, by the server's clock, counted down as the page is shown. Null for any other room. */
function useSecondsToStart(): number | null {
  const startsAt = useRoom((s) => (s.room?.status === 'open' ? s.room.startsAt : null));
  const skew = useRoom((s) => s.skew);
  return useCountdown(startsAt, skew);
}

/** The seconds left before the room's deadline, by the server's clock, counted down as the page is shown. Null outside play. */
function useSecondsLeft(): number | null {
  const deadline = useRoom((s) => s.room?.deadline ?? null);
  const seconds = useRoom((s) => s.room?.seconds ?? 0);
  const skew = useRoom((s) => s.skew);
  const left = useCountdown(deadline, skew);
  return left === null ? null : Math.min(seconds, left);
}

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

/** The server's words for a refusal, as the phone tells them: a version this app is not on is the app's to update, not a page's to reload. */
function useRefusalText() {
  const t = useT('room');
  const phone = useT('phone');
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
  const t = useT('room');
  const phone = useT('phone');
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
    // The web's words say to reload the page: on the phone, a game on rules the app lacks waits for an update of it.
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
  return <RoomPlay game={game} />;
}

/**
 * The life lived in the room, on the screens of any life. What the room puts round it (its bar, the order after each round, its end, the shouts and
 * the clock's rounds) is Task 10's, through Play's room slots.
 */
function RoomPlay({ game }: { game: GameStore }) {
  return (
    <GameScope game={game}>
      <Play />
    </GameScope>
  );
}

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
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 }}>
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
function LeaveSheet({ room, open, onClose }: { room: RoomState; open: boolean; onClose(): void }) {
  const t = useT('room');
  const common = useT('common');
  const leave = useRoom((s) => s.leave);
  const busy = useRoom((s) => s.busy);
  const me = room.members.find((member) => member.me);
  // A public lobby goes on without whoever opened it: only a game among friends closes behind its host.
  const what = room.status === 'playing' ? t('leavePlaying') : me?.host && !room.public ? t('leaveHost') : null;
  return (
    <Sheet open={open} onClose={onClose} title={t('leaveTitle')} closeLabel={common('close')} tone="wine">
      {what ? <ReadText size={15} tone="ink-200" lineHeight={15 * SNUG}>{what}</ReadText> : null}
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

/** The link to a room, the web's own (`/<locale>/room?code=`): it opens the web's game, wherever it is opened. The app's own room opens by `theratrace://room?code=`. */
const linkTo = (locale: string, code: string): string => `${SITE_URL.origin}/${locale}/room?code=${code}`;

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
      {host ? <Tag>{t('host')}</Tag> : null}
      {bot ? <Tag>{t('bot')}</Tag> : null}
      {me ? <Tag tone="good">{t('you')}</Tag> : null}
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
  const url = linkTo(locale, room.code);
  const members = t('members', { count: here.length, max: MAX_MEMBERS });

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
    <RoomPage title={t('title')} fixed={<Toast message={copied ? t('copied') : null} onDone={() => setCopied(false)} />}>
      {room.public ? (
        // A public game is found, not shared: its clock comes first. Someone may still be invited to it.
        <View role="region" aria-label={t('searching')} style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <PixelText size={18} tone="gold-500" style={{ textAlign: 'center' }}>{t('searching')}</PixelText>
          <StartsIn />
          <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ textAlign: 'center' }}>{t('fillWithBots')}</ReadText>
          {/* A round a day: each plays theirs when they can, and a notice says when the next is theirs. */}
          {room.seconds >= HOUR ? <ReadText size={13} tone="ink-300" lineHeight={13 * SNUG} style={{ textAlign: 'center' }}>{t('paceDay')}</ReadText> : null}
          <Button variant="secondary" onPress={() => void share()}>
            {t('invite')}
          </Button>
        </View>
      ) : (
        <View role="region" aria-label={t('code')} style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <ReadText size={12} tone="ink-300" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{t('code')}</ReadText>
          <PixelText size={44} tone="gold-500" lineHeight={44} style={{ textAlign: 'center', letterSpacing: 44 * 0.18 }}>{room.code}</PixelText>
          {/* The phone always has a share sheet: both ways out are there (the web shows Share only where the browser has one). */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <Button variant="secondary" onPress={() => void share()}>
              {t('share')}
            </Button>
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
              <View key={rule} role="listitem" style={{ flexDirection: 'row', paddingLeft: 8, gap: 8 }}>
                <ReadText size={14} lineHeight={14 * SNUG}>{'•'}</ReadText>
                <ReadText size={14} lineHeight={14 * SNUG} style={{ flex: 1 }}>{rule}</ReadText>
              </View>
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
      {/* Here the web has the way to shout to the others, and what they shout: Task 10's, with the room's play. */}
      <Button variant="quiet" wide disabled={busy} onPress={() => (me?.host && !room.public ? setAsking(true) : void leave())}>
        {t('leave')}
      </Button>
      <LeaveSheet room={room} open={asking} onClose={() => setAsking(false)} />
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

/** A member's place: one more than everyone still in with a higher score, so that a tie shares it. */
function rankOf(members: readonly RoomMember[], member: RoomMember): number {
  const score = member.standing?.score ?? Number.NEGATIVE_INFINITY;
  return 1 + members.filter((other) => !other.left && (other.standing?.score ?? Number.NEGATIVE_INFINITY) > score).length;
}

/** True while the player is in a game that is not over: waiting to start, or in play, whoever it waits for. */
export function useRoomLive(): boolean {
  return useRoom((s) => {
    const me = s.room?.members.find((member) => member.me);
    return s.status === 'in' && (s.room?.status === 'open' || s.room?.status === 'playing') && me !== undefined && !me.left;
  });
}

/** The letter spacing of a pixel button set in the page's 15 (0.03 of it), kept by its title and the line under it, as Home's buttons keep it. */
const CARD_SPACING = 15 * 0.03;

/**
 * The way to multiplayer from the front door: there only for a player with an account, and back to their game when they are in one, saying how it
 * stands. When it waits for them it is the door's first button, in gold.
 */
export function RoomCard({ primary = false }: { primary?: boolean }) {
  const t = useT('home');
  const router = useRouter();
  const nameOf = useNameOf();
  const status = useRoom((s) => s.status);
  const room = useRoom((s) => s.room);
  const left = useSecondsLeft();
  const toStart = useSecondsToStart();
  const lobbies = useRoom((s) => s.lobbies);
  const lookForLobbies = useRoom((s) => s.lookForLobbies);
  // Out of any game, the door says how many public games are waiting for players now.
  useEffect(() => {
    if (status === 'none') void lookForLobbies();
  }, [status, lookForLobbies]);
  if (status === 'booting' || status === 'unavailable') return null;
  const inRoom = status === 'in' && room !== null && room.status !== 'closed';
  // A game that is over is kept for its result, and a rematch, until the player leaves it: it is not a game to go back to.
  const over = inRoom && room?.status === 'finished' && room.rematch?.open !== true;
  const me = room?.members.find((member) => member.me);
  let detail: string | null = null;
  if (inRoom && room) {
    const here = room.members.filter((member) => !member.left);
    if (room.status === 'open') detail = room.public && toStart !== null ? t('roomSearching', { time: clock(toStart) }) : t('roomLobby', { count: here.length, max: MAX_MEMBERS });
    else if (room.status === 'playing') {
      const waitingFor = here.filter((member) => !member.ready && !member.me);
      detail = me && !me.ready ? t('roomTurn', { time: left === null ? '—' : clock(left) }) : t('roomWaiting', { names: waitingFor.map(nameOf).join(', ') });
    } else if (room.rematch?.open) detail = t('roomRematch');
    else if (me && !me.left && me.standing) detail = t('roomPlace', { place: rankOf(room.members, me), total: here.length });
    else detail = t('roomDone');
  } else if (lobbies && lobbies.live + lobbies.slow > 0) detail = t('roomOpenNow', { count: lobbies.live + lobbies.slow });
  const icon = over ? 'icon.room_podium' : room?.rematch?.open && inRoom ? 'icon.room_rematch' : inRoom && room?.status === 'open' ? 'icon.room_lobby' : 'icon.multiplayer';
  return (
    <Raised
      role="link"
      tone={primary ? GOLD : {}}
      bg={primary ? 'gold-500' : 'night-600'}
      style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 2 }}
      onPress={() => router.push('/room')}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Sprite id={icon} />
        <PixelText size={primary ? 19 : 17} tone={primary ? 'ink-900' : 'cream'} style={{ textAlign: 'center', letterSpacing: CARD_SPACING }}>
          {over ? t('roomResult') : inRoom ? t('inRoom') : t('room')}
        </PixelText>
      </View>
      {detail ? (
        // In the reading face inside the pixel button: it keeps the button's font-size-adjust and its 1.1 line, as the front door's details do.
        <ReadText size={adjustedRead(13)} tone={primary ? 'ink-700' : 'ink-200'} lineHeight={13 * 1.1} style={{ textAlign: 'center', letterSpacing: CARD_SPACING }}>
          {detail}
        </ReadText>
      ) : null}
    </Raised>
  );
}
