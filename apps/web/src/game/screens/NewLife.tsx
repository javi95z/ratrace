'use client';

import { lives, portraitArt } from '@ratrace/content';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useGame, useProfile, useRanking, useRuns, useT, useWords } from '@/game/context';
import { ageAt } from '@ratrace/core/game/present';
import { unlockProgress } from '@ratrace/core/game/unlockProgress';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Segmented, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { useKeyboardContext } from '@/ui/keyboard';
import { Difficulty, LifeBrief, LifeSummary } from './LifeSummary';

/** Choose who to be. A locked life shows what unlocks it. */
export function NewLife() {
  useKeyboardContext('new-life');
  const t = useT('newLife');
  const common = useT('common');
  const { content, text } = useWords();
  const router = useRouter();
  const start = useGame((s) => s.start);
  const elsewhere = useGame((s) => s.elsewhere);
  const continueElsewhere = useGame((s) => s.continueElsewhere);
  const clearElsewhere = useGame((s) => s.clearElsewhere);
  const inProgress = useGame((s) => s.status === 'playing' && s.stage !== 'end');
  const living = useGame((s) => s.lifeId);
  const round = useGame((s) => s.view?.round ?? 0);
  const [chosen, setChosen] = useState(lives[0].id);
  const [starting, setStarting] = useState(false);
  const [asking, setAsking] = useState(false);
  /** The last try to start a life came to nothing, for a reason that is not the player's. */
  const [failed, setFailed] = useState(false);
  /** The ranked life in progress elsewhere could not be asked for just now. */
  const [away, setAway] = useState(false);
  // A ranked life is played by the server. It is offered when there is someone to play it for and a way to reach it.
  const ranking = useRanking();
  const [wantRanked, setWantRanked] = useState(true);
  const lifeList = useRef<HTMLDivElement>(null);
  const typed = useRef('');
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (typeTimer.current) clearTimeout(typeTimer.current);
  }, []);
  // Which lives are open is the profile's to say. Nothing is judged here.
  const { unlocked } = useProfile();
  const runs = useRuns();
  const available = lives.filter((life) => life.unlock === 'default' || Object.hasOwn(unlocked, life.id));
  const locked = lives.filter((life) => !available.includes(life));
  const [showLocked, setShowLocked] = useState(false);
  const chooseAndFocus = (id: string) => {
    setChosen(id);
    const button = lifeList.current?.querySelector<HTMLElement>(`[data-life="${id}"]`);
    button?.focus();
    button?.scrollIntoView?.({ block: 'nearest' });
  };
  const moveLife = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || available.length === 0) return;
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (direction || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const at = Math.max(0, available.findIndex((life) => life.id === chosen));
      const next = event.key === 'Home' ? available[0] : event.key === 'End' ? available.at(-1)! : available[(at + direction + available.length) % available.length];
      chooseAndFocus(next.id);
      return;
    }
    if (event.key.length !== 1 || !/[\p{L}\p{N}]/u.test(event.key)) return;
    typed.current += event.key.toLocaleLowerCase();
    if (typeTimer.current) clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => { typed.current = ''; }, 700);
    const match = available.find((life) => text.lives[life.id].name.toLocaleLowerCase().startsWith(typed.current));
    if (match) {
      event.preventDefault();
      chooseAndFocus(match.id);
    }
  };
  /**
   * Starts the chosen life. `replace` names the ranked life in progress elsewhere that the player
   * has said may end for it.
   */
  const begin = async (replace?: string) => {
    setAsking(false);
    setFailed(false);
    setAway(false);
    setStarting(true);
    try {
      const options = { ranked: ranking === 'yes' && wantRanked, replace };
      // Nothing began if the player has a ranked life in progress somewhere else: they are asked what to do about it.
      // Replaced, not pushed: the Back button must not lead here again from a life, one tap away from ending it.
      if (await start(chosen, options)) router.replace('/play');
    } catch (error) {
      console.error('the life could not be started:', error);
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };
  /** Goes on with the ranked life in progress elsewhere, in place of starting one. */
  const takeUp = async () => {
    setAway(false);
    setStarting(true);
    try {
      const answer = await continueElsewhere();
      if (answer === 'taken') router.replace('/play');
      // Gone, there is nothing in the way any more, and the sheet has closed by itself.
      else if (answer === 'away') setAway(true);
    } catch (error) {
      console.error('the life could not be taken up:', error);
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 pt-4 ${ranking === 'yes' ? 'pb-52' : ranking === 'offline' ? 'pb-36' : 'pb-28'}`}>
      <div className="mb-3 flex items-center gap-2">
        <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
          ←
        </Link>
        <h1 className="pixel text-[24px] text-gold-500">{t('title')}</h1>
      </div>

      {/* The lives that can be lived, two to a row; the one chosen opens across the row with what it is. */}
      <div ref={lifeList} role="radiogroup" aria-label={t('title')} onKeyDown={moveLife} className="grid grid-flow-row-dense grid-cols-2 gap-2">
        {available.map((life) => {
          const on = chosen === life.id;
          return (
            <button
              key={life.id}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-life={life.id}
              onClick={() => setChosen(life.id)}
              className={`frame-raised flex min-h-[72px] items-center gap-2 p-1.5 text-left ${on ? 'frame-gold col-span-2 bg-cream text-ink-900' : 'bg-night-700 text-ink-200'}`}
            >
              {/* The portrait at its own size: drawn at 64 pixels, any other size blurs it. */}
              <Well className="size-[68px] shrink-0">
                <Sprite id={portraitArt(life.id, 22)} fallback={{ w: 64, h: 64 }} />
              </Well>
              {on ? (
                <LifeSummary lifeId={life.id} light />
              ) : (
                <LifeBrief lifeId={life.id} />
              )}
            </button>
          );
        })}
      </div>

      {/* What is still locked waits at the foot, folded: what unlocks each is there for whoever wants to know. */}
      {locked.length > 0 ? (
        <section className="mt-3">
          <button
            type="button"
            aria-expanded={showLocked}
            onClick={() => setShowLocked((open) => !open)}
            className="frame-raised flex min-h-11 w-full items-center justify-between gap-2 bg-night-800 px-3 text-left text-[14px] text-ink-200"
          >
            <span className="flex items-center gap-2">
              <Sprite id="icon.locked" />
              {t('lockedMany', { count: locked.length })}
            </span>
            <span aria-hidden className="pixel text-ink-300">
              {showLocked ? '▴' : '▾'}
            </span>
          </button>
          {showLocked ? (
            <ul className="mt-2 flex flex-col gap-2">
              {locked.map((life) => {
                const progress = unlockProgress(life.unlock, runs?.length ?? null);
                return (
                  <li key={life.id} className="frame-raised flex items-center gap-3 bg-night-800 p-1.5">
                    {/* Only the shape of who it is: the portrait waits for whoever opens the life. */}
                    <Well className="relative size-[68px]">
                      <Sprite id={portraitArt(life.id, 22)} fallback={{ w: 64, h: 64 }} silhouette />
                      <span className="absolute bottom-0.5 right-0.5">
                        <Sprite id="icon.locked" fallback={{ w: 16, h: 16 }} />
                      </span>
                    </Well>
                    <span className="min-w-0 flex-1">
                      <span className="pixel block text-[15px]">{text.lives[life.id].name}</span>
                      <span className="block text-[12px] leading-snug text-ink-200">
                        <span className="text-gold-500">{t('unlock')}: </span>
                        {text.lives[life.id].unlock}
                      </span>
                      {progress ? <span className="block text-[12px] leading-snug text-teal-300">{t('progressFinished', { n: progress.have, total: progress.need })}</span> : null}
                      <span className="block text-[12px] italic leading-snug text-ink-300">{t(`hints.${life.id}`)}</span>
                    </span>
                    <Difficulty lifeId={life.id} />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-10 bg-night-900 pt-3">
        {/* As wide as the page above it: the same column, the same margins. */}
        <div className="mx-auto w-full max-w-md px-3">
          {ranking === 'yes' ? (
            <div className="mb-2">
              {/* Two ways to play, side by side, each saying in a few words what it is. */}
              <Segmented<'ranked' | 'free'>
                label={t('mode')}
                value={wantRanked ? 'ranked' : 'free'}
                onChange={(mode) => setWantRanked(mode === 'ranked')}
                options={[
                  { value: 'ranked', label: t('modeRanked'), hint: t('modeRankedHint') },
                  { value: 'free', label: t('modeFree'), hint: t('modeFreeHint') },
                ]}
              />
            </div>
          ) : null}
          {ranking === 'offline' ? (
            <p role="status" className="mb-2 text-center text-[12px] text-ink-200">
              {t('noConnection')}
            </p>
          ) : null}
          {failed ? (
            <p role="alert" className="frame mb-2 bg-wine-900 px-3 py-2 text-center text-[13px]">
              {t('failed')}
            </p>
          ) : null}
          {inProgress ? <p className="mb-2 text-center text-[12px] text-wine-300">{t('replace')}</p> : null}
          {/* A life in progress is not ended by one tap: the question is asked first, and its answer sits somewhere else. */}
          <Button
            variant="primary"
            wide
            disabled={starting}
            onClick={() => {
              if (inProgress) setAsking(true);
              else void begin();
            }}
          >
            {t('start')}
          </Button>
        </div>
      </div>

      {/* Saying yes replaces this page with the game, so the sheet keeps no entry of its own in the history. */}
      <Sheet open={asking && inProgress} onClose={() => setAsking(false)} title={t('confirmTitle')} closeLabel={common('close')} back={false}>
        <p className="text-[15px] leading-snug text-ink-200">{t('confirmBody', { life: text.lives[living ?? '']?.name ?? '', age: ageAt(content, round) })}</p>
        <div className="mt-4 flex flex-col gap-3">
          <Button variant="primary" wide onClick={() => setAsking(false)}>
            {t('confirmNo')}
          </Button>
          <Button variant="danger" wide disabled={starting} onClick={() => void begin()}>
            {t('confirmYes')}
          </Button>
        </div>
      </Sheet>

      {/* A player has one ranked life in progress. One on another device is never ended by starting here: it is asked about. */}
      <Sheet open={elsewhere !== null} onClose={clearElsewhere} title={t('elsewhereTitle')} closeLabel={common('close')} back={false}>
        {elsewhere ? (
          <>
            <p className="text-[15px] leading-snug text-ink-200">{t('elsewhereBody', { life: text.lives[elsewhere.lifeId]?.name ?? elsewhere.lifeId, round: Math.min(elsewhere.round + 1, content.rounds), total: content.rounds })}</p>
            {elsewhere.here ? null : <p className="mt-2 text-[14px] leading-snug text-ink-200">{t('elsewhereOther')}</p>}
            {away ? (
              <p role="alert" className="frame mt-3 bg-wine-900 px-3 py-2 text-[13px]">
                {t('elsewhereAway')}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-3">
              {elsewhere.here ? (
                <Button variant="primary" wide disabled={starting} onClick={() => void takeUp()}>
                  {t('elsewhereTake')}
                </Button>
              ) : null}
              <Button variant="danger" wide disabled={starting} onClick={() => void begin(elsewhere.gameId)}>
                {t('elsewhereEnd')}
              </Button>
              <Button variant="quiet" wide onClick={clearElsewhere}>
                {common('cancel')}
              </Button>
            </div>
          </>
        ) : null}
      </Sheet>
    </main>
  );
}
