'use client';

import { useEffect, useState } from 'react';
import { avatarOf, ratLookOf } from '@ratrace/core/game/avatar';
import type { RatLook } from '@ratrace/core/game/avatar';
import { useAccount, useAccountSettled, useCommunity, useProfile, useRuns, useT, useWords } from '@/game/context';
import { Link } from '@/i18n/navigation';
import { Button, Panel } from '@/ui/kit';
import { Toast } from '@/ui/overlay';
import { GROUND, RatLayers } from '@/ui/RatAvatar';
import { RatEditor } from './RatEditor';
import { FIELD, NAME } from './Rankings';
import { RankCard, useRankName } from './RankCard';
import { progressOf } from '@ratrace/content';

/**
 * How the others see the player: the rat they play as, in rooms and rankings, and the name under
 * it. Only for someone signed in, whose profile the server keeps.
 */
export function PlayerProfile() {
  const t = useT('player');
  const ranks = useT('rankings');
  const common = useT('common');
  const { state } = useAccount();
  const settled = useAccountSettled();
  const community = useCommunity();
  const [me, setMe] = useState<{ nickname: string | null; friendCode: string; avatar: string | null } | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'refused' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const runs = useRuns();
  const profile = useProfile();
  const { fmt, text } = useWords();
  const rankName = useRankName();

  useEffect(() => {
    if (community === null) return;
    let live = true;
    void community.me().then((found) => {
      if (!live) return;
      setMe(found);
      setName(found?.nickname ?? '');
    });
    return () => {
      live = false;
    };
  }, [community]);

  const userId = state.kind === 'member' ? state.userId : null;
  const header = (
    <div className="flex items-center gap-2">
      <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
        ←
      </Link>
      <h1 className="pixel text-[24px] text-gold-500">{t('title')}</h1>
    </div>
  );
  if (userId === null || community === null) {
    // Until the account has tried to sign in, nobody being signed in is no reason to ask for it.
    if (!settled && state.kind === 'offline') return <main className="mx-auto flex min-h-safe w-full max-w-md flex-col gap-4 px-3 pb-10 pt-4">{header}</main>;
    return (
      <main className="mx-auto flex min-h-safe w-full max-w-md flex-col gap-4 px-3 pb-10 pt-4">
        {header}
        <p className="frame bg-night-700 p-3 text-[14px] text-ink-200">{t('signIn')}</p>
      </main>
    );
  }

  const look = ratLookOf(me?.avatar, userId);
  const colour = look.colour;
  const pick = async (next: RatLook) => {
    const avatar = avatarOf(next);
    if (avatar === avatarOf(look)) return;
    const before = me;
    // Shown at once; put back if the server would not keep it.
    setMe((was) => (was ? { ...was, avatar } : was));
    // Kept quietly: the rat above already shows the change. Only a failure is told.
    if (!(await community.setAvatar(avatar))) {
      setMe(before ?? null);
      setTold(t('notSaved'));
    }
  };
  const rename = async () => {
    const asked = name.trim();
    // How it is written is checked here, before anyone is asked. What it says is the database's to judge.
    if (!NAME.test(asked)) return setProblem('invalid');
    setBusy(true);
    const answer = await community.rename(asked);
    setBusy(false);
    if (answer !== 'ok') return setProblem(answer);
    setProblem(null);
    setEditing(false);
    setMe((was) => (was ? { ...was, nickname: asked } : was));
    setTold(t('saved'));
  };
  const copy = async () => {
    if (!me?.friendCode) return;
    try {
      await navigator.clipboard.writeText(me.friendCode);
      setTold(t('copied'));
    } catch {
      // The browser keeps the clipboard to itself: the code is on screen to be copied by hand.
    }
  };
  const lives = runs ?? [];
  const best = lives.reduce<number | null>((top, run) => (top === null || run.score > top ? run.score : top), null);
  const together = lives.filter((run) => run.room).length;
  const figures = [
    { label: t('lives'), value: fmt.number(lives.length) },
    { label: t('best'), value: best === null ? '—' : fmt.number(best) },
    { label: t('badges'), value: fmt.number(Object.keys(profile.badges).length) },
    { label: t('games'), value: fmt.number(together) },
  ];

  return (
    <main className="mx-auto flex min-h-safe w-full max-w-md flex-col gap-4 px-3 pb-10 pt-4">
      {header}

      {/* The player as the others see them: their rat on their colour, their name, and the code to be followed by. */}
      <section aria-label={t('preview')} className="bevel relative overflow-hidden bg-night-700 px-3 pb-4 pt-5">
        <span aria-hidden className={`absolute inset-x-0 top-0 h-24 opacity-60 ${GROUND[colour]}`} />
        <div className="relative flex flex-col items-center gap-2">
          <span className={`frame-double inline-flex leading-[0] [--ring:var(--color-gold-500)] ${GROUND[colour]}`}>
            {/* The rat at the size it was drawn: every pixel of it, none smudged. */}
            <RatLayers look={look} className={`size-32 ${me === undefined ? 'invisible' : ''}`} />
          </span>
          {editing ? (
            <form
              className="flex w-full flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void rename();
              }}
            >
              <input aria-label={ranks('name')} value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus className={FIELD} />
              {problem ? (
                <p role="alert" className="text-[13px] text-wine-300">
                  {ranks(problem)}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  wide
                  onClick={() => {
                    setEditing(false);
                    setProblem(null);
                    setName(me?.nickname ?? '');
                  }}
                >
                  {common('cancel')}
                </Button>
                <Button variant="primary" wide type="submit" disabled={busy}>
                  {ranks('save')}
                </Button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(true)} aria-label={t('rename')} className="group flex min-h-11 items-center gap-2 px-2">
              <span className="pixel text-[24px] leading-none">{me === undefined ? '\u00a0' : (me?.nickname ?? t('noName'))}</span>
              <span aria-hidden className="text-[14px] text-ink-300 group-hover:text-gold-500">✎</span>
            </button>
          )}
          {me?.friendCode ? (
            <button type="button" onClick={() => void copy()} className="frame-raised flex min-h-11 items-center gap-2 bg-night-800 px-3 text-[13px] text-ink-200">
              {ranks('code')} <span className="pixel tracking-[0.15em] text-gold-500">{me.friendCode}</span>
              <span className="text-ink-300">· {t('copy')}</span>
            </button>
          ) : null}
          <p className="text-center text-[12px] leading-snug text-ink-300">{t('about')}</p>
        </div>
      </section>

      <RankCard />

      {/* What the player has lived, at a glance: this device's records. */}
      <section aria-label={t('figures')} className="grid grid-cols-4 gap-2">
        {figures.map((figure) => (
          <div key={figure.label} className="frame flex flex-col items-center gap-0.5 bg-night-800 px-1 py-2 text-center">
            <span className="pixel text-[18px] leading-none text-gold-500">{figure.value}</span>
            <span className="text-[11px] leading-tight text-ink-300">{figure.label}</span>
          </div>
        ))}
      </section>

      {/* The rat, a part at a time; the one above shows each choice at once. */}
      <Panel title={t('rat')} label={t('rat')}>
        <RatEditor
          look={look}
          earned={profile.badges}
          rank={progressOf(profile.rank.points).rank}
          badgeName={(id) => text.badges[id]?.name ?? id}
          rankName={rankName}
          onPick={(next) => void pick(next)}
          onLocked={setTold}
        />
      </Panel>

      {/* Where the rest of the player's game is. */}
      <nav aria-label={t('more')} className="grid grid-cols-3 gap-2">
        <Link href="/records" className="frame-raised flex min-h-11 items-center justify-center bg-night-700 px-2 text-center text-[13px]">
          {t('toRecords')}
        </Link>
        <Link href="/collection" className="frame-raised flex min-h-11 items-center justify-center bg-night-700 px-2 text-center text-[13px]">
          {t('toCollection')}
        </Link>
        <Link href="/rankings" className="frame-raised flex min-h-11 items-center justify-center bg-night-700 px-2 text-center text-[13px]">
          {t('toRankings')}
        </Link>
      </nav>
      <Toast message={told} onDone={() => setTold(null)} />
    </main>
  );
}
