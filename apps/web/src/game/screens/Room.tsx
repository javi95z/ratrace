'use client';

import { LoanOffers, PlayerSheet } from './RoomLoans';
import { badgeArt, lives, portraitArt } from '@ratrace/content';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { GameScope, useCommunity, useGame, useProfile, useRoom, useSettings, useT, useWords } from '@/game/context';
import type { GameStore } from '@/game/store';
import { Link } from '@/i18n/navigation';
import { MAX_MEMBERS, MIN_MEMBERS, ROUND_SECONDS, SHOUT_EVERY_MS, SHOUT_FACES, SHOUT_PHRASES } from '@/game/room';
import type { RoomMember, RoomState, RoundSeconds } from '@/game/room';
import { Button, Panel, Segmented, Tag, Well } from '@/ui/kit';
import { Sheet, Toast } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { LifeBrief, LifeSummary } from './LifeSummary';
import { Play } from './Play';
import { FIELD, NAME } from './Rankings';
import { RoomPaper } from '@/game/roomStory';
import type { RoomSlots } from './Play';

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
  // An invitation is a link with the room's code: it is shown as one, to be joined with one press.
  const [invited, setInvited] = useState<string | null>(null);
  useEffect(() => {
    const given = (new URLSearchParams(window.location.search).get('code') ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    if (given.length === 6) setInvited(given);
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    clearClosed();
    void join(code);
  };

  // Come by an invitation, the page is the invitation: the game to join, and the one button that joins it.
  if (invited) {
    return (
      <Page title={t('title')}>
        <section aria-label={t('invited')} className="frame-raised frame-gold flex flex-col items-center gap-3 bg-night-600 px-4 py-5 text-center">
          <Sprite id="icon.skill_network" className="!h-12 !w-12" />
          <p className="pixel text-[18px] leading-tight text-gold-500">{t('invited')}</p>
          <p className="pixel text-[52px] leading-none tracking-[0.16em] text-cream">{invited}</p>
          <p className="text-[14px] leading-snug text-ink-200">{t('invitedAbout')}</p>
          <Button
            variant="primary"
            wide
            disabled={busy}
            onClick={() => {
              clearClosed();
              void join(invited);
            }}
          >
            {t('joinInvite')}
          </Button>
        </section>
        {closed ? (
          <p role="status" className="frame bg-night-700 px-3 py-2 text-[14px]">
            {t('closed')}
          </p>
        ) : null}
        <Refusal />
      </Page>
    );
  }

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
    <div ref={group} role="radiogroup" aria-label={label} onKeyDown={move} className="grid grid-flow-row-dense grid-cols-2 gap-2">
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
            // The life chosen opens across both columns, with what it is: the rest stay small, so the list stays short.
            className={`frame-raised flex min-h-[72px] items-center gap-2 px-1 py-1 text-left ${on ? 'frame-cream col-span-2 bg-cream text-ink-900' : 'bg-night-600 text-ink-200'}`}
          >
            <Sprite id={portraitArt(life.id, 22)} className="shrink-0" fallback={{ w: 64, h: 64 }} />
            {on ? (
              <LifeSummary lifeId={life.id} light />
            ) : (
              <LifeBrief lifeId={life.id} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Opening a room: its life, from those the player may live, and how long a round may take. */
function OpenSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('room');
  const paceOf = usePaceOf();
  const common = useT('common');
  const { text } = useWords();
  const busy = useRoom((s) => s.busy);
  const openRoom = useRoom((s) => s.open);
  const available = useAvailableLives();
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
          <Segmented<RoundSeconds> label={t('pace')} value={seconds} onChange={setSeconds} options={ROUND_SECONDS.map((value) => ({ value, label: paceOf(value) }))} />
          <p className="mt-1.5 text-[13px] text-ink-300">{t(seconds >= HOUR ? 'paceDay' : 'paceLive')}</p>
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

/** The lives the player may live: those everyone has, and those they have unlocked. */
function useAvailableLives() {
  const { unlocked } = useProfile();
  return lives.filter((life) => life.unlock === 'default' || Object.hasOwn(unlocked, life.id));
}

/** A rematch of the room that is over: a life, which is the same one unless chosen otherwise, on the same pace. */
function RematchSheet({ room, open, onClose }: { room: RoomState; open: boolean; onClose(): void }) {
  const t = useT('room');
  const paceOf = usePaceOf();
  const common = useT('common');
  const { text } = useWords();
  const busy = useRoom((s) => s.busy);
  const rematch = useRoom((s) => s.rematch);
  const available = useAvailableLives();
  const [lifeId, setLifeId] = useState(available.some((life) => life.id === room.lifeId) ? room.lifeId : (available[0]?.id ?? 'nurse'));
  const go = async () => {
    if (await rematch(lifeId)) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('rematch')} closeLabel={common('close')}>
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-snug text-ink-200">{t('rematchAbout', { time: paceOf(room.seconds) })}</p>
        <div>
          <p className="mb-1.5 text-[13px] text-ink-300">{t('life')}</p>
          <LifePicker label={t('life')} lives={available.map((life) => ({ id: life.id, name: text.lives[life.id]?.name ?? life.id }))} value={lifeId} onChange={setLifeId} />
        </div>
        <Refusal plain />
        <Button variant="primary" wide disabled={busy} onClick={() => void go()}>
          {t('rematchCreate')}
        </Button>
      </div>
    </Sheet>
  );
}

/** What a room that is over offers next: its rematch to join once someone has opened it, or to open. */
function Rematch({ room }: { room: RoomState }) {
  const t = useT('room');
  const busy = useRoom((s) => s.busy);
  const join = useRoom((s) => s.join);
  const [asking, setAsking] = useState(false);
  if (room.status !== 'finished') return null;
  const waiting = room.rematch?.open ? room.rematch : null;
  if (waiting) {
    return (
      <div className="flex flex-col gap-1.5">
        <p role="status" className="text-center text-[14px] text-ink-200">
          {t('rematchWaiting')}
        </p>
        <Button variant="primary" wide disabled={busy} onClick={() => void join(waiting.code)}>
          {t('rematchJoin')}
        </Button>
      </div>
    );
  }
  // Opened and started already: there is nothing left to join.
  if (room.rematch !== null) return null;
  return (
    <>
      <Button variant="primary" wide disabled={busy} onClick={() => setAsking(true)}>
        {t('rematch')}
      </Button>
      <RematchSheet room={room} open={asking} onClose={() => setAsking(false)} />
    </>
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
  const paceOf = usePaceOf();
  const { text } = useWords();
  const { locale } = useSettings();
  const nameOf = useNameOf();
  const busy = useRoom((s) => s.busy);
  const start = useRoom((s) => s.start);
  const leave = useRoom((s) => s.leave);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  // The link is the page's own address with the code: known once the page is in a browser.
  const [url, setUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}/${locale}/room?code=${room.code}`);
    setCanShare(typeof navigator.share === 'function');
  }, [locale, room.code]);
  const here = room.members.filter((member) => !member.left);
  const me = here.find((member) => member.me);
  const enough = here.length >= MIN_MEMBERS;

  const share = async () => {
    if (url === null) return;
    try {
      await navigator.share({ title: t('title'), text: t('inviteText', { code: room.code }), url });
    } catch {
      // Sharing was turned down: the link and the code are on screen.
    }
  };
  const copy = async () => {
    if (url === null) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The browser keeps the clipboard to itself: the link is on screen to be copied by hand.
    }
  };

  return (
    <Page title={t('title')}>
      <section aria-label={t('code')} className="flex flex-col items-center gap-2 py-2 text-center">
        <p className="text-[12px] uppercase tracking-wider text-ink-300">{t('code')}</p>
        <p className="pixel text-[44px] leading-none tracking-[0.18em] text-gold-500">{room.code}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {canShare ? <Button onClick={() => void share()}>{t('share')}</Button> : null}
          <Button onClick={() => void copy()}>{t('copyLink')}</Button>
        </div>
      </section>
      <Panel>
        <div className="flex items-center gap-3">
          <Well className="size-[68px] shrink-0">
            <Sprite id={portraitArt(room.lifeId, 22)} fallback={{ w: 64, h: 64 }} />
          </Well>
          <div className="min-w-0">
            <p className="text-[12px] text-ink-300">{t('everyone')}</p>
            <p className="pixel truncate text-[18px]">{text.lives[room.lifeId]?.name ?? room.lifeId}</p>
            <p className="text-[13px] text-ink-200">{t('round', { time: paceOf(room.seconds) })}</p>
          </div>
        </div>
      </Panel>
      {/* What a newcomer needs before the first round: three rules, and what can be done to the others. */}
      <Panel title={t('rules.title')} label={t('rules.title')}>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px] leading-snug">
          <li>{t('rules.same')}</li>
          <li>{t('rules.clock', { time: paceOf(room.seconds) })}</li>
          <li>{t('rules.win')}</li>
        </ul>
        <p className="mt-2 text-[13px] leading-snug text-ink-300">{t('rules.others')}</p>
      </Panel>
      <Panel title={t('members', { count: here.length, max: MAX_MEMBERS })} label={t('members', { count: here.length, max: MAX_MEMBERS })}>
        <ul className="divide-y-2 divide-night-900">
          {here.map((member) => (
            <li key={member.userId} className="flex min-h-11 items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[15px]">{nameOf(member)}</span>
              {member.host ? <Tag>{t('host')}</Tag> : null}
              {member.me ? <Tag tone="good">{t('you')}</Tag> : null}
              {member.me ? <RenameButton named={member.name !== null} /> : null}
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
        <p role="status" className="pixel text-center text-[15px] text-ink-200">
          {t('waitingHost')}
        </p>
      )}
      <Refusal />
      <ShoutButton wide />
      <Heard room={room} />
      <Button variant="quiet" wide disabled={busy} onClick={() => (me?.host ? setAsking(true) : void leave())}>
        {t('leave')}
      </Button>
      <LeaveSheet room={room} open={asking} onClose={() => setAsking(false)} />
      <Toast message={copied ? t('copied') : null} onDone={() => setCopied(false)} />
    </Page>
  );
}

/** The way for the player to name themselves where the others will see it: in the lobby, before the game begins. */
function RenameButton({ named }: { named: boolean }) {
  const t = useT('room');
  const ranks = useT('rankings');
  const common = useT('common');
  const community = useCommunity();
  const refresh = useRoom((s) => s.refresh);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'refused' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  if (community === null) return null;
  const save = async () => {
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
        className="shrink-0 px-2 text-[13px]"
        onClick={() => {
          setName('');
          setProblem(null);
          setOpen(true);
        }}
      >
        {t(named ? 'renameShort' : 'nameYourself')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('renameTitle')} closeLabel={common('close')}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <p className="text-[14px] leading-snug text-ink-200">{t('renameAbout')}</p>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {ranks('name')}
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} className={FIELD} />
          </label>
          {problem ? (
            <p role="alert" className="text-[13px] text-wine-300">
              {ranks(problem)}
            </p>
          ) : null}
          <Button variant="primary" wide type="submit" disabled={busy}>
            {ranks('save')}
          </Button>
        </form>
      </Sheet>
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

/** The way to shout to the others: a face or a phrase from a short list, one every ten seconds. */
function ShoutButton({ wide = false }: { wide?: boolean }) {
  const t = useT('room');
  const common = useT('common');
  const shout = useRoom((s) => s.shout);
  const textOf = useShoutText();
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, [until]);
  const wait = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  // The sheet closes the moment a shout is chosen: the server is asked after, and the wait starts at once.
  const send = (n: number) => {
    setUntil(Date.now() + SHOUT_EVERY_MS);
    setOpen(false);
    void shout(n);
  };
  return (
    <>
      {wide ? (
        <Button wide aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <span aria-hidden>💬</span>
          {t('shoutTitle')}
        </Button>
      ) : (
        <button type="button" aria-haspopup="dialog" aria-label={t('shoutTitle')} onClick={() => setOpen(true)} className="frame-raised flex size-11 shrink-0 items-center justify-center bg-night-700 text-[20px]">
          <span aria-hidden>💬</span>
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('shoutTitle')} closeLabel={common('close')}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-6 gap-2">
            {SHOUT_FACES.map((face, n) => (
              <button key={face} type="button" disabled={wait > 0} aria-label={face} onClick={() => send(n)} className="frame-raised flex aspect-square items-center justify-center bg-night-700 text-[24px] disabled:opacity-50">
                {face}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PHRASES.map((key, at) => (
              <button
                key={key}
                type="button"
                disabled={wait > 0}
                onClick={() => send(SHOUT_FACES.length + at)}
                className="frame-raised min-h-11 bg-night-600 px-2 py-1.5 text-left text-[14px] leading-tight disabled:opacity-50"
              >
                {textOf(SHOUT_FACES.length + at)}
              </button>
            ))}
          </div>
          <p role="status" className="text-center text-[12px] text-ink-300">
            {wait > 0 ? t('shoutWait', { n: wait }) : t('shoutAbout')}
          </p>
        </div>
      </Sheet>
    </>
  );
}

/** What the others shouted, each for a moment at the top of the screen, as they come. */
function Heard({ room }: { room: RoomState }) {
  const heard = useRoom((s) => s.heard);
  const dismiss = useRoom((s) => s.dismissHeard);
  const nameOf = useNameOf();
  const textOf = useShoutText();
  const first = heard[0];
  useEffect(() => {
    if (!first) return;
    const timer = setTimeout(() => dismiss(first.key), SHOUT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [first, dismiss]);
  if (heard.length === 0) return null;
  return (
    <div role="status" aria-live="polite" className="top-safe pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pt-3">
      {heard.map((shout) => {
        const member = room.members.find((one) => one.userId === shout.userId);
        const name = member ? nameOf(member) : '';
        const face = shout.n < SHOUT_FACES.length;
        return (
          // Gold on the night, with a shadow under it: it sits over the game, and says someone is talking.
          <div key={shout.key} className="frame-raised frame-gold flex w-full max-w-sm animate-rise items-center gap-3 bg-night-600 px-3 py-2.5 shadow-[4px_4px_0_rgb(0_0_0/0.5)]">
            <span aria-hidden className="pixel flex size-11 shrink-0 items-center justify-center bg-gold-500 text-[20px] text-ink-900">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="pixel block truncate text-[12px] uppercase tracking-wider text-gold-200">{name}</span>
              <span className={face ? 'mt-0.5 inline-block animate-pop text-[34px] leading-none' : 'pixel mt-0.5 block text-[20px] leading-tight text-cream'}>{textOf(shout.n)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A member's place: one more than everyone still in with a higher score, so that a tie shares it. */
function rankOf(members: readonly RoomMember[], member: RoomMember): number {
  const score = member.standing?.score ?? Number.NEGATIVE_INFINITY;
  return 1 + members.filter((other) => !other.left && (other.standing?.score ?? Number.NEGATIVE_INFINITY) > score).length;
}

/**
 * The members of the room in order, with what the last round left each of them: their place and
 * how it moved, their net worth, their score and what the round added to it, and the face they put
 * on it. `live` adds where each is in the round being played. Bare: whoever holds it frames it.
 */
function Standings({ room, live = false, onPick }: { room: RoomState; live?: boolean; /** Opens another player still in a game in play, to offer them a loan. */ onPick?(member: RoomMember): void }) {
  const t = useT('room');
  const { fmt, names, text } = useWords();
  const nameOf = useNameOf();
  const list = ordered(room.members);
  const inPlay = live && room.status === 'playing';
  return (
    <div>
      <p aria-hidden className="text-right text-[11px] uppercase tracking-wider text-ink-300">
        {t('score')}
      </p>
      <ol className="divide-y-2 divide-night-900">
        {list.map((member, at) => {
          const standing = member.left ? null : member.standing;
          const tied = standing !== null && list.some((other) => other !== member && !other.left && other.standing?.score === standing.score);
          const before = standing?.before ?? null;
          // Places move by the order shown, the order the server kept the round before.
          const moved = before === null ? 0 : before.place - (at + 1);
          const gained = standing !== null && before !== null ? standing.score - before.score : 0;
          const pick = onPick && room.status === 'playing' && !member.me && !member.left ? () => onPick(member) : undefined;
          return (
            <li key={member.userId} className={member.left ? 'opacity-60' : ''}>
              {/* Another player still in the game opens, to offer them a loan. */}
              <Line pick={pick}>
              <span className="flex w-7 shrink-0 flex-col items-center leading-none">
                <span className="pixel text-[16px] text-ink-300">{member.left ? '·' : `${rankOf(room.members, member)}${tied ? '=' : ''}`}</span>
                {moved !== 0 ? (
                  <span role="img" aria-label={t(moved > 0 ? 'movedUp' : 'movedDown', { n: Math.abs(moved) })} className={`mt-0.5 text-[11px] ${moved > 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                    {moved > 0 ? '▲' : '▼'}
                    {Math.abs(moved)}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px]">{nameOf(member)}</span>
                  {member.me ? <Tag tone="good">{t('you')}</Tag> : null}
                </span>
                {standing && (standing.cityId || standing.career) ? (
                  <span className="block truncate text-[12px] text-ink-200">
                    {[standing.cityId ? names.cities[standing.cityId] : null, standing.career ? text.careers[standing.career.id]?.levels[standing.career.level] : null].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
                <span className="flex flex-wrap gap-x-2 text-[12px] text-ink-300">
                  {member.left ? <span>{t('left')}</span> : null}
                  {standing ? <span>{t('worth', { worth: fmt.compact(standing.netWorth) })}</span> : null}
                  {standing?.escaped ? <span className="text-teal-300">{t('escaped')}</span> : null}
                  {inPlay && !member.left ? <span className={member.ready ? 'text-teal-300' : ''}>{t(member.ready ? 'played' : 'playing')}</span> : null}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end leading-tight">
                <span className="pixel text-[18px] text-gold-500">
                  {member.standing ? fmt.number(member.standing.score) : '—'}
                  <span className="sr-only"> {t('score')}</span>
                </span>
                {gained !== 0 ? (
                  <span className={`text-[12px] ${gained > 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                    {gained > 0 ? '+' : '−'}
                    {fmt.number(Math.abs(gained))}
                  </span>
                ) : null}
              </span>
              </Line>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A line of the room's order: a button when it opens something, a plain line when it does not. */
function Line({ pick, children }: { pick?: () => void; children: ReactNode }) {
  const look = 'flex min-h-12 w-full items-center gap-3 py-1.5 text-left';
  return pick ? (
    <button type="button" aria-haspopup="dialog" onClick={pick} className={look}>
      {children}
    </button>
  ) : (
    <div className={look}>{children}</div>
  );
}

/** Above the round: the time left and how it runs out, who has played, the player's place, and the way to the room's order and to leaving. */
function RoomBar({ room }: { room: RoomState }) {
  const t = useT('room');
  const common = useT('common');
  const nameOf = useNameOf();
  const left = useSecondsLeft();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [picked, setPicked] = useState<RoomMember | null>(null);
  const here = room.members.filter((member) => !member.left);
  const ready = here.filter((member) => member.ready).length;
  const me = here.find((member) => member.me);
  const place = me?.standing ? rankOf(room.members, me) : null;
  const time = left === null ? '—' : clock(left);
  const low = left !== null && left <= 20;
  const share = left === null || room.seconds <= 0 ? 0 : Math.max(0, Math.min(1, left / room.seconds));
  const title = room.status === 'playing' ? t('sheetTitle', { round: Math.min(room.round + 1, room.rounds), total: room.rounds, time }) : t('final');
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t('bar', { time, ready, total: here.length })}
        onClick={() => setOpen(true)}
        className="frame-raised flex min-w-0 flex-1 flex-col bg-night-700 text-left"
      >
        <span className="flex min-h-11 w-full items-center gap-3 px-3 py-1.5">
          <span aria-hidden className={`pixel min-w-14 shrink-0 text-[22px] tabular-nums ${low ? 'text-wine-300' : 'text-gold-500'}`}>
            {time}
          </span>
          <span aria-hidden className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pt-1">
            {here.map((member) => (
              <span
                key={member.userId}
                title={nameOf(member)}
                className={`pixel relative flex size-7 shrink-0 items-center justify-center text-[13px] ${member.ready ? 'bg-teal-600 text-cream' : 'bg-night-900 text-ink-300'} ${member.me ? 'ring-2 ring-inset ring-gold-500' : ''}`}
              >
                {nameOf(member).slice(0, 1).toUpperCase()}
                {member.ready ? <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center bg-teal-300 font-sans text-[10px] font-bold leading-none text-night-900">✓</span> : null}
              </span>
            ))}
          </span>
          <span aria-hidden className="shrink-0 text-[12px] text-ink-300 max-sm:hidden">
            {t('playedShort', { ready, total: here.length })}
          </span>
          {place !== null ? (
            <span aria-hidden className="pixel shrink-0 text-[16px] text-cream">
              {t('placeShort', { place })}
            </span>
          ) : null}
          <span aria-hidden className="pixel shrink-0 text-[15px] text-ink-300">
            ▸
          </span>
        </span>
        {/* The round's time, running out: gold, and wine for the last seconds. */}
        {room.status === 'playing' && left !== null ? (
          <span aria-hidden className="block h-1 w-full bg-night-900">
            <span className={`block h-full transition-[width] duration-300 ease-linear ${low ? 'bg-wine-300' : 'bg-gold-500'}`} style={{ width: `${share * 100}%` }} />
          </span>
        ) : null}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} closeLabel={common('close')}>
        <Standings
          room={room}
          live
          onPick={(member) => {
            setOpen(false);
            setPicked(member);
          }}
        />
        {room.status === 'playing' ? <p className="mt-2 text-center text-[12px] text-ink-300">{t('loan.pickHint')}</p> : null}
        {room.status === 'playing' ? (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => setLeaving(true)} className="min-h-11 px-3 text-[13px] text-ink-300 underline underline-offset-4">
              {t('leave')}
            </button>
          </div>
        ) : null}
      </Sheet>
      <LeaveSheet room={room} open={leaving} onClose={() => setLeaving(false)} />
      <PlayerSheet member={picked} nameOf={nameOf} onClose={() => setPicked(null)} />
      <ShoutButton />
    </div>
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
  const nameOf = useNameOf();
  const missed = useRoom((s) => s.missed);
  const earned = useRoom((s) => s.earned);
  const { text } = useWords();
  const clearMissed = useRoom((s) => s.clearMissed);
  const leave = useRoom((s) => s.leave);
  const busy = useRoom((s) => s.busy);
  const stage = useGame((s) => s.stage);
  const me = room.members.find((member) => member.me);
  const here = room.members.filter((member) => !member.left);
  const place = me && !me.left && me.standing ? rankOf(room.members, me) : 0;
  // Played, and waiting for the others: whether this page sent the round or the page before it did.
  const waiting = room.status === 'playing' && me?.ready === true && stage === 'finance';
  const order = room.status === 'finished' ? t('final') : t('afterRound', { n: room.round });
  const slots: RoomSlots = {
    bar: (
      <div className="flex flex-col gap-2">
        <RoomBar room={room} />
        <LoanOffers room={room} nameOf={nameOf} />
      </div>
    ),
    actions: waiting ? <Waiting room={room} /> : null,
    resolved: (
      <Panel title={order} label={order}>
        <Standings room={room} />
      </Panel>
    ),
    end: (
      <Panel title={t('final')} label={t('final')}>
        {place > 0 ? <p className="pixel mb-2 text-[20px] text-gold-500">{t('place', { place, total: here.length })}</p> : null}
        {earned.length > 0 ? (
          <ul aria-label={t('newBadges')} className="mb-2 flex flex-col gap-1.5">
            {earned.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <Sprite id={badgeArt(id)} className="size-10 shrink-0" />
                <span className="text-[14px] leading-tight">
                  <span className="block text-[12px] text-ink-300">{t('newBadge')}</span>
                  <span className="pixel text-[16px] text-gold-500">{text.badges[id]?.name ?? id}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <Standings room={room} />
        <div className="mt-3 flex flex-col gap-2 border-t-2 border-night-900 pt-3">
          <Rematch room={room} />
          <Refusal plain />
          <Button wide disabled={busy} onClick={() => void leave()}>
            {t('leave')}
          </Button>
        </div>
      </Panel>
    ),
  };
  return (
    <>
      <RoomPaper.Provider value={room.members}>
        <Play room={slots} />
      </RoomPaper.Provider>
      <Heard room={room} />
      <Toast message={missed > 0 ? t('missed', { count: missed }) : null} onDone={clearMissed} ms={6_000} />
    </>
  );
}

/** True while the player is in a game that is not over: waiting to start, or in play, whoever it waits for. */
export function useRoomLive(): boolean {
  return useRoom((s) => {
    const me = s.room?.members.find((member) => member.me);
    return s.status === 'in' && (s.room?.status === 'open' || s.room?.status === 'playing') && me !== undefined && !me.left;
  });
}

/**
 * The way to multiplayer from the front door: there only for a player with an account, and back to
 * their game when they are in one, saying how it stands. When it waits for them it is the door's
 * first button, in gold.
 */
export function RoomCard({ primary = false }: { primary?: boolean }) {
  const t = useT('home');
  const nameOf = useNameOf();
  const status = useRoom((s) => s.status);
  const room = useRoom((s) => s.room);
  const left = useSecondsLeft();
  if (status === 'booting' || status === 'unavailable') return null;
  const inRoom = status === 'in' && room !== null && room.status !== 'closed';
  const me = room?.members.find((member) => member.me);
  let detail: string | null = null;
  if (inRoom && room) {
    const here = room.members.filter((member) => !member.left);
    if (room.status === 'open') detail = t('roomLobby', { count: here.length, max: MAX_MEMBERS });
    else if (room.status === 'playing') {
      const waitingFor = here.filter((member) => !member.ready && !member.me);
      detail = me && !me.ready ? t('roomTurn', { time: left === null ? '—' : clock(left) }) : t('roomWaiting', { names: waitingFor.map(nameOf).join(', ') });
    } else if (room.rematch?.open) detail = t('roomRematch');
    else if (me && !me.left && me.standing) detail = t('roomOver', { place: rankOf(room.members, me), total: here.length });
    else detail = t('roomDone');
  }
  return (
    <Link
      href="/room"
      className={`pixel frame-raised flex min-h-12 flex-col items-center justify-center gap-0.5 px-4 py-2 text-center ${primary ? 'frame-gold bg-gold-500 text-ink-900' : 'bg-night-600 text-cream'}`}
    >
      <span className={`flex items-center gap-2 ${primary ? 'text-[19px]' : 'text-[17px]'}`}>
        <Sprite id="icon.skill_network" />
        {inRoom ? t('inRoom') : t('room')}
      </span>
      {detail ? <span className={`font-sans text-[13px] font-normal ${primary ? 'text-ink-700' : 'text-ink-200'}`}>{detail}</span> : null}
    </Link>
  );
}
