import { MAX_MEMBERS, memberName } from '@ratrace/core/game/room';
import type { RoomMember } from '@ratrace/core/game/room';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { adjustedRead } from '../../ui/fonts';
import { GOLD } from '../../ui/frames';
import { Raised } from '../../ui/kit';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText } from '../../ui/text';
import { useClock, useRoom, useRooms } from '../context';
import { useGo } from '../pages';
import { useT } from '../words';

/*
 * The way back to a game with others from the front door (`RoomCard`, Room.tsx's on the web, which Room.tsx hands on by the same names), and the
 * room's clocks and names it shares with the room's pages. A file of its own: the front door draws it with nothing of the room's pages, nor of the
 * life played in a room, loaded for it, so the web's first page carries none of them (each page of the web export loads its own code).
 */

/** Seconds as a clock reads them: 1:30; hours and minutes for a round of a day, 23h 05m. */
export const clock = (seconds: number) =>
  seconds >= 3_600 ? `${Math.floor(seconds / 3_600)}h ${String(Math.floor((seconds % 3_600) / 60)).padStart(2, '0')}m` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** What a member is called: their name, the rat their id makes of them, or the kind of rat a bot is. */
export function useNameOf() {
  const t = useT('room');
  return useCallback((member: Pick<RoomMember, 'name' | 'bot' | 'userId'>) => memberName(t, member), [t]);
}

/**
 * The whole seconds left until `at` (by the server's clock, `skew` ahead of the phone's), read as the screen is drawn; drawn again once a second, as
 * the count changes, and never more (the web draws it four times a second). Null without `at`. Read by the game's clock (`useClock`), the one the
 * room store takes its skew by: the phone's, or a scene's held at its day (as the web's shot holds the browser's), where the count stands still.
 */
export function useCountdown(at: number | null, skew: number): number | null {
  const [, tick] = useState(0);
  const now = useClock();
  useEffect(() => {
    if (at === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      const ms = at - (now() + skew);
      if (ms <= 0) return;
      // A moment past the next whole second, when the count reads one less.
      timer = setTimeout(() => {
        tick((n) => n + 1);
        next();
      }, (ms % 1_000 || 1_000) + 5);
    };
    next();
    return () => clearTimeout(timer);
  }, [at, skew, now]);
  return at === null ? null : Math.max(0, Math.ceil((at - (now() + skew)) / 1_000));
}

/**
 * When a moment of the server's clock (`at`) comes by the phone's: the server's minus the room's `skew`, taken once for that moment. The skew is
 * measured again at every look at the room and moves by a few milliseconds each time; read with it, the clocks would be drawn again, and set again,
 * for every look. The moment changes, and is taken again, when the room gives another (a round turned, a lobby's start moved).
 */
function useLocal(at: number | null): number | null {
  const rooms = useRooms();
  return useMemo(() => (at === null ? null : at - rooms.getState().skew), [at, rooms]);
}

/** The seconds left before a public lobby starts by itself, by the server's clock, counted down as the page is shown. Null for any other room. */
export function useSecondsToStart(): number | null {
  const startsAt = useLocal(useRoom((s) => (s.room?.status === 'open' ? s.room.startsAt : null)));
  return useCountdown(startsAt, 0);
}

/** The seconds left before the room's deadline, by the server's clock, counted down as the page is shown. Null outside play. Not counted while not `shown`. */
export function useSecondsLeft(shown = true): number | null {
  const deadline = useLocal(useRoom((s) => s.room?.deadline ?? null));
  const seconds = useRoom((s) => s.room?.seconds ?? 0);
  const left = useCountdown(shown ? deadline : null, 0);
  return left === null ? null : Math.min(seconds, left);
}

/** A member's place: one more than everyone still in with a higher score, so that a tie shares it. */
export function rankOf(members: readonly RoomMember[], member: RoomMember): number {
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
  const go = useGo();
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
      onPress={() => go.push('room')}
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
