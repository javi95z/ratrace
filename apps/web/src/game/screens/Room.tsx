'use client';

import { lives, portraitArt } from '@ratrace/content';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { GameScope, useGame, useProfile, useRoom, useSettings, useT, useWords } from '@/game/context';
import type { GameStore } from '@/game/store';
import { Link } from '@/i18n/navigation';
import { MAX_MEMBERS, MIN_MEMBERS, ROUND_SECONDS } from '@/game/room';
import type { RoomMember, RoomState, RoundSeconds } from '@/game/room';
import { Button, Panel, Segmented, Tag, Well } from '@/ui/kit';
import { Sheet, Toast } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { Play } from './Play';
import type { RoomSlots } from './Play';

/** The refusals the server gives in words of its own. Any other is told as a refusal with no reason. */
const REFUSALS = new Set(['unknown-room', 'started', 'full', 'other-version', 'in-a-room', 'locked-life', 'cannot-room', 'unreachable', 'alone', 'not-host']);
/** Seconds as a clock reads them: 1:30; hours and minutes for a round of a day, 23h 05m. */
const clock = (seconds: number) =>
  seconds >= 3_600 ? `${Math.floor(seconds / 3_600)}h ${String(Math.floor((seconds % 3_600) / 60)).padStart(2, '0')}m` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
/** A round of a day is a day; a quick one, its clock. */
const DAY = 86_400;
/** Four characters of a player's id, for one with no name. */
const tagOf = (userId: string) => userId.slice(0, 4).toUpperCase();

/** What a member is called: their name, or the rat their id makes of them. */
function useNameOf() {
  const t = useT('room');
  return (member: RoomMember) => member.name ?? t('nameless', { tag: tagOf(member.userId) });
}

/** The members still in, best first by the score the last round left them with; those who left after them. */
function ordered(members: readonly RoomMember[]): RoomMember[] {
  const score = (member: RoomMember) => member.standing?.score ?? Number.NEGATIVE_INFINITY;
  return [...members].sort((a, b) => Number(a.left) - Number(b.left) || score(b) - score(a));
}

/** The seconds left before the room's deadline, by the server's clock, counted down as the page is shown. Null outside play. */
function useSecondsLeft(): number | null {
  const deadline = useRoom((s) => s.room?.deadline ?? null);
  const seconds = useRoom((s) => s.room?.seconds ?? 0);
  const skew = useRoom((s) => s.skew);
  // The clock is read as the page is drawn; the timer only draws it again.
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return deadline === null ? null : Math.min(seconds, Math.max(0, Math.ceil((deadline - (Date.now() + skew)) / 1000)));
}

/** A page of the rooms: its way back, its title, and what it holds. */
function Page({ title, children }: { title: string; children: ReactNode }) {
  const common = useT('common');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-3 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 shrink-0 items-center justify-center bg-night-700 text-[18px] text-ink-200">
          ←
        </Link>
        <h1 className="pixel text-[24px] text-gold-500">{title}</h1>
      </div>
      {children}
    </main>
  );
}

/** Why the last thing asked of the room did not happen, if it did not. Framed on a page; plain inside a sheet, which is framed itself. */
function Refusal({ plain = false }: { plain?: boolean }) {
  const t = useT('room');
  const refusal = useRoom((s) => s.refusal);
  if (refusal === null) return null;
  return (
    <p role="alert" className={plain ? 'text-[14px] text-wine-300' : 'frame bg-wine-900 px-3 py-2 text-[14px]'}>
      {t(`refused.${REFUSALS.has(refusal) ? refusal : 'refused'}`)}
    </p>
  );
}

/**
 * Playing with friends: the way into a room, its lobby, and the life lived in it. It needs an
 * account and a connection, and says so where there is neither.
 */
export function Room() {
  const t = useT('room');
  const common = useT('common');
  const status = useRoom((s) => s.status);
  const room = useRoom((s) => s.room);
  const game = useRoom((s) => s.game);
  const refresh = useRoom((s) => s.refresh);
  const leave = useRoom((s) => s.leave);
  const otherRules = useRoom((s) => s.otherRules);

  if (status === 'booting') {
    return (
      <Page title={t('title')}>
        <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p>
      </Page>
    );
  }
  if (status === 'unavailable') {
    return (
      <Page title={t('title')}>
        <p className="frame bg-night-700 px-3 py-3 text-[15px]">{t('needAccount')}</p>
      </Page>
    );
  }
  if (status === 'away') {
    return (
      <Page title={t('title')}>
        <p className="frame bg-night-700 px-3 py-3 text-[15px]">{t('away')}</p>
        <Button wide onClick={() => void refresh()}>
          {t('retry')}
        </Button>
      </Page>
    );
  }
  if (status === 'none' || room === null) return <Door />;
  if (room.status === 'open') return <Lobby room={room} />;
  if (otherRules) {
    return (
      <Page title={t('title')}>
        <p role="status" className="frame bg-night-700 px-3 py-3 text-[15px]">
          {t('otherRules')}
        </p>
        <Button wide onClick={() => void leave()}>
          {t('leave')}
        </Button>
      </Page>
    );
  }
  if (room.status === 'closed') {
    return (
      <Page title={t('title')}>
        <p role="status" className="frame bg-night-700 px-3 py-3 text-[15px]">
          {t('closed')}
        </p>
        <Button variant="primary" wide onClick={() => void leave()}>
          {t('leave')}
        </Button>
      </Page>
    );
  }
  if (game === null) {
    return (
      <Page title={t('title')}>
        <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p>
      </Page>
    );
  }
  return <RoomPlay room={room} game={game} />;
}

/** In no room: open one, or join one with a code. A link with a code fills it in. */
function Door() {
  const t = useT('room');
  const busy = useRoom((s) => s.busy);
  const join = useRoom((s) => s.join);
  const closed = useRoom((s) => s.closed);
  const clearClosed = useRoom((s) => s.clearClosed);
  const [opening, setOpening] = useState(false);
  const [code, setCode] = useState('');
  // An invitation is a link with the room's code: it is waiting here, to be joined with one press.
  useEffect(() => {
    const given = new URLSearchParams(window.location.search).get('code');
    if (given) setCode(given.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6));
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    clearClosed();
    void join(code);
  };

  return (
    <Page title={t('title')}>
      <ul className="flex flex-col gap-1.5 text-[15px] leading-snug text-ink-200">
        {(['introSame', 'introWho', 'introPace'] as const).map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="text-gold-500">
              ▸
            </span>
            <span>{t(line)}</span>
          </li>
        ))}
      </ul>
      {closed ? (
        <p role="status" className="frame bg-night-700 px-3 py-2 text-[14px]">
          {t('closed')}
        </p>
      ) : null}
      <Button variant="primary" wide disabled={busy} onClick={() => setOpening(true)}>
        {t('open')}
      </Button>
      <Panel title={t('join')}>
        <form onSubmit={submit} className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[12px] text-ink-300">{t('code')}</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6))}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              maxLength={6}
              className="pixel frame sunk min-h-11 w-full bg-night-900 px-3 text-[22px] tracking-[0.3em] text-cream placeholder:text-ink-500"
              placeholder="······"
            />
          </label>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {t('enter')}
          </Button>
        </form>
      </Panel>
      <Refusal />
      <OpenSheet open={opening} onClose={() => setOpening(false)} />
    </Page>
  );
}

/** One of the lives the player may live, each with its face: a choice in two columns, moved through with the arrows. */
function LifePicker({ label, lives: choices, value, onChange }: { label: string; lives: Array<{ id: string; name: string }>; value: string; onChange(id: string): void }) {
  const group = useRef<HTMLDivElement>(null);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const at = Math.max(0, choices.findIndex((life) => life.id === value));
    const next = event.key === 'Home' ? choices[0] : event.key === 'End' ? choices[choices.length - 1] : choices[(at + step + choices.length) % choices.length];
    onChange(next.id);
    group.current?.querySelector<HTMLElement>(`[data-life="${next.id}"]`)?.focus();
  };
  return (
    <div ref={group} role="radiogroup" aria-label={label} onKeyDown={move} className="grid grid-cols-2 gap-2">
      {choices.map((life) => {
        const on = life.id === value;
        return (
          <button
            key={life.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-life={life.id}
            onClick={() => onChange(life.id)}
            className={`frame-raised flex min-h-[72px] items-center gap-2 px-1 py-1 text-left ${on ? 'frame-cream bg-cream text-ink-900' : 'bg-night-600 text-ink-200'}`}
          >
            <Sprite id={portraitArt(life.id, 22)} className="shrink-0" fallback={{ w: 64, h: 64 }} />
            <span className="min-w-0 text-[13px] leading-tight">{life.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Opening a room: its life, from those the player may live, and how long a round may take. */
function OpenSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('room');
  const common = useT('common');
  const { text } = useWords();
  const { unlocked } = useProfile();
  const busy = useRoom((s) => s.busy);
  const openRoom = useRoom((s) => s.open);
  const available = lives.filter((life) => life.unlock === 'default' || Object.hasOwn(unlocked, life.id));
  const [lifeId, setLifeId] = useState(available[0]?.id ?? 'nurse');
  const [seconds, setSeconds] = useState<RoundSeconds>(180);
  const go = async () => {
    if (await openRoom(lifeId, seconds)) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('open')} closeLabel={common('close')}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-[13px] text-ink-300">{t('pace')}</p>
          <Segmented<RoundSeconds> label={t('pace')} value={seconds} onChange={setSeconds} options={ROUND_SECONDS.map((value) => ({ value, label: value === DAY ? t('day') : clock(value) }))} />
          <p className="mt-1.5 text-[13px] text-ink-300">{t(seconds === DAY ? 'paceDay' : 'paceLive')}</p>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] text-ink-300">{t('life')}</p>
          <LifePicker label={t('life')} lives={available.map((life) => ({ id: life.id, name: text.lives[life.id]?.name ?? life.id }))} value={lifeId} onChange={setLifeId} />
        </div>
        <Refusal plain />
        <Button variant="primary" wide disabled={busy} onClick={() => void go()}>
          {t('create')}
        </Button>
      </div>
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
  const what = room.status === 'playing' ? t('leavePlaying') : me?.host ? t('leaveHost') : null;
  return (
    <Sheet open={open} onClose={onClose} title={t('leaveTitle')} closeLabel={common('close')} tone="wine">
      {what ? <p className="text-[15px] leading-snug text-ink-200">{what}</p> : null}
      <div className="mt-4 flex flex-col gap-3">
        <Button variant="danger" wide disabled={busy} onClick={() => void leave()}>
          {t('confirmLeave')}
        </Button>
        <Button wide onClick={onClose}>
          {t('stay')}
        </Button>
      </div>
    </Sheet>
  );
}

/** The lobby: the code to share, the life everyone will live, who is in, and the start, which is the host's. */
function Lobby({ room }: { room: RoomState }) {
  const t = useT('room');
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

  const invite = async () => {
    const url = `${window.location.origin}/${locale}/room?code=${room.code}`;
    const words = t('inviteText', { code: room.code });
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: t('title'), text: words, url });
        return;
      }
      await navigator.clipboard.writeText(`${words} ${url}`);
      setCopied(true);
    } catch {
      // Sharing was turned down, or the browser keeps the clipboard to itself: the code is on screen to be read out.
    }
  };

  return (
    <Page title={t('title')}>
      <section aria-label={t('code')} className="flex flex-col items-center gap-2 py-2 text-center">
        <p className="text-[12px] uppercase tracking-wider text-ink-300">{t('code')}</p>
        <p className="pixel text-[44px] leading-none tracking-[0.18em] text-gold-500">{room.code}</p>
        <Button onClick={() => void invite()}>{t('invite')}</Button>
      </section>
      <Panel>
        <div className="flex items-center gap-3">
          <Well className="size-[68px] shrink-0">
            <Sprite id={portraitArt(room.lifeId, 22)} fallback={{ w: 64, h: 64 }} />
          </Well>
          <div className="min-w-0">
            <p className="text-[12px] text-ink-300">{t('everyone')}</p>
            <p className="pixel truncate text-[18px]">{text.lives[room.lifeId]?.name ?? room.lifeId}</p>
            <p className="text-[13px] text-ink-200">{t('round', { time: room.seconds === DAY ? t('day') : clock(room.seconds) })}</p>
          </div>
        </div>
      </Panel>
      <Panel title={t('members', { count: here.length, max: MAX_MEMBERS })} label={t('members', { count: here.length, max: MAX_MEMBERS })}>
        <ul className="divide-y-2 divide-night-900">
          {here.map((member) => (
            <li key={member.userId} className="flex min-h-11 items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[15px]">{nameOf(member)}</span>
              {member.host ? <Tag>{t('host')}</Tag> : null}
              {member.me ? <Tag tone="good">{t('you')}</Tag> : null}
            </li>
          ))}
        </ul>
      </Panel>
      {me?.host ? (
        <div className="flex flex-col gap-1.5">
          <Button variant="primary" wide disabled={busy || !enough} onClick={() => void start()}>
            {t('start')}
          </Button>
          {enough ? null : <p className="text-center text-[13px] text-ink-300">{t('needsTwo')}</p>}
        </div>
      ) : (
        <p role="status" className="pixel animate-blink text-center text-[15px] text-ink-200">
          {t('waitingHost')}
        </p>
      )}
      <Refusal />
      <Button variant="quiet" wide disabled={busy} onClick={() => (me?.host ? setAsking(true) : void leave())}>
        {t('leave')}
      </Button>
      <LeaveSheet room={room} open={asking} onClose={() => setAsking(false)} />
      <Toast message={copied ? t('copied') : null} onDone={() => setCopied(false)} />
    </Page>
  );
}

/** The members of the room in order, with what the last round left each of them. Bare: whoever holds it frames it. */
function Standings({ room }: { room: RoomState }) {
  const t = useT('room');
  const { fmt } = useWords();
  const nameOf = useNameOf();
  return (
    <div>
      <p aria-hidden className="text-right text-[11px] uppercase tracking-wider text-ink-300">
        {t('score')}
      </p>
      <ol className="divide-y-2 divide-night-900">
        {ordered(room.members).map((member, at) => (
          <li key={member.userId} className={`flex min-h-11 items-center gap-3 py-1.5 ${member.left ? 'opacity-60' : ''}`}>
            <span className="pixel w-5 shrink-0 text-[16px] text-ink-300">{member.left ? '·' : at + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[15px]">{nameOf(member)}</span>
                {member.me ? <Tag tone="good">{t('you')}</Tag> : null}
              </span>
              {member.left ? (
                <span className="block text-[12px] text-ink-300">{t('left')}</span>
              ) : member.standing?.escaped ? (
                <span className="block text-[12px] text-teal-300">{t('escaped')}</span>
              ) : null}
            </span>
            <span className="pixel shrink-0 text-[18px] text-gold-500">
              {member.standing ? fmt.number(member.standing.score) : '—'}
              <span className="sr-only"> {t('score')}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Above the round: the time left, who has played, and the way to the room's order and to leaving. */
function RoomBar({ room }: { room: RoomState }) {
  const t = useT('room');
  const common = useT('common');
  const nameOf = useNameOf();
  const left = useSecondsLeft();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const here = room.members.filter((member) => !member.left);
  const ready = here.filter((member) => member.ready).length;
  const time = left === null ? '—' : clock(left);
  const low = left !== null && left <= 20;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t('bar', { time, ready, total: here.length })}
        onClick={() => setOpen(true)}
        className="frame-raised flex min-h-11 w-full items-center gap-3 bg-night-700 px-3 py-1.5 text-left"
      >
        <span aria-hidden className={`pixel min-w-14 shrink-0 text-[22px] tabular-nums ${low ? 'text-wine-300' : 'text-gold-500'}`}>
          {time}
        </span>
        <span aria-hidden className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {here.map((member) => (
            <span
              key={member.userId}
              title={nameOf(member)}
              className={`pixel flex size-7 shrink-0 items-center justify-center text-[13px] ${member.ready ? 'bg-teal-600 text-cream' : 'bg-night-900 text-ink-300'} ${member.me ? 'ring-2 ring-inset ring-gold-500' : ''}`}
            >
              {nameOf(member).slice(0, 1).toUpperCase()}
            </span>
          ))}
        </span>
        <span aria-hidden className="pixel shrink-0 text-[15px] text-ink-300">
          ▸
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('standings')} closeLabel={common('close')}>
        <p className="mb-2 text-[13px] text-ink-300">{t('timeLeft', { time })}</p>
        <Standings room={room} />
        {room.status === 'playing' ? (
          <div className="mt-4 border-t-2 border-night-900 pt-3">
            <Button variant="quiet" wide onClick={() => setLeaving(true)}>
              {t('leave')}
            </Button>
          </div>
        ) : null}
      </Sheet>
      <LeaveSheet room={room} open={leaving} onClose={() => setLeaving(false)} />
    </>
  );
}

/** In place of the round's button, once the player has played: who the room is waiting for, and how long it may. */
function Waiting({ room }: { room: RoomState }) {
  const t = useT('room');
  const nameOf = useNameOf();
  const left = useSecondsLeft();
  const here = room.members.filter((member) => !member.left);
  const choosing = here.filter((member) => !member.ready).map(nameOf);
  return (
    <div className="flex flex-col items-center gap-0.5 py-1 text-center">
      <p className="pixel text-[17px] text-cream">
        {t('waiting')}
        {/* The clock is in the room's bar for a screen reader; said here every second it would drown the rest. */}
        {left === null ? null : (
          <span aria-hidden className="ml-2 tabular-nums text-gold-500">
            {clock(left)}
          </span>
        )}
      </p>
      <div role="status">
        <p className="text-[13px] text-ink-200">{t('waitingCount', { ready: here.length - choosing.length, total: here.length })}</p>
        {choosing.length > 0 ? <p className="text-[13px] text-ink-300">{t('choosing', { names: choosing.join(', ') })}</p> : null}
      </div>
    </div>
  );
}

/** The life lived in the room, on the screens of any life, with the room around it. */
function RoomPlay({ room, game }: { room: RoomState; game: GameStore }) {
  return (
    <GameScope game={game}>
      <RoomScreens room={room} />
    </GameScope>
  );
}

function RoomScreens({ room }: { room: RoomState }) {
  const t = useT('room');
  const missed = useRoom((s) => s.missed);
  const clearMissed = useRoom((s) => s.clearMissed);
  const leave = useRoom((s) => s.leave);
  const busy = useRoom((s) => s.busy);
  const stage = useGame((s) => s.stage);
  const me = room.members.find((member) => member.me);
  const here = room.members.filter((member) => !member.left);
  const place = ordered(room.members).findIndex((member) => member.me) + 1;
  // Played, and waiting for the others: whether this page sent the round or the page before it did.
  const waiting = room.status === 'playing' && me?.ready === true && stage === 'finance';
  const order = room.status === 'finished' ? t('final') : t('afterRound', { n: room.round });
  const slots: RoomSlots = {
    bar: <RoomBar room={room} />,
    actions: waiting ? <Waiting room={room} /> : null,
    resolved: (
      <Panel title={order} label={order}>
        <Standings room={room} />
      </Panel>
    ),
    end: (
      <Panel title={t('final')} label={t('final')}>
        {place > 0 ? <p className="pixel mb-2 text-[20px] text-gold-500">{t('place', { place, total: here.length })}</p> : null}
        <Standings room={room} />
        <div className="mt-3 border-t-2 border-night-900 pt-3">
          <Button wide disabled={busy} onClick={() => void leave()}>
            {t('leave')}
          </Button>
        </div>
      </Panel>
    ),
  };
  return (
    <>
      <Play room={slots} />
      <Toast message={missed > 0 ? t('missed', { count: missed }) : null} onDone={clearMissed} ms={6_000} />
    </>
  );
}

/** The way to the rooms from the front door: there only for a player with an account, and back to their room when they are in one. */
export function RoomCard() {
  const t = useT('home');
  const status = useRoom((s) => s.status);
  const room = useRoom((s) => s.room);
  if (status === 'booting' || status === 'unavailable') return null;
  const inRoom = status === 'in' && room !== null && room.status !== 'closed';
  const detail = !inRoom
    ? null
    : room.status === 'open'
      ? t('roomLobby', { code: room.code })
      : room.status === 'playing'
        ? t('roomPlaying', { code: room.code, round: room.round + 1, total: room.rounds })
        : t('roomOver', { code: room.code });
  return (
    <Link href="/room" className="pixel frame-raised flex min-h-12 flex-col items-center justify-center gap-0.5 bg-night-600 px-4 py-2 text-center text-cream">
      <span className="flex items-center gap-2 text-[17px]">
        <Sprite id="icon.skill_network" />
        {inRoom ? t('inRoom') : t('room')}
      </span>
      {detail ? <span className="font-sans text-[13px] font-normal text-ink-200">{detail}</span> : null}
    </Link>
  );
}
