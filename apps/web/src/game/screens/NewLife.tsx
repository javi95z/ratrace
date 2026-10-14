'use client';

import { lives, portraitArt } from '@ratrace/content';
import { useState } from 'react';
import { useGame, useProfile, useRanking, useT, useWords } from '@/game/context';
import { ageAt } from '@/game/present';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Segmented, Tag, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { WeeklyChallenge } from './Challenge';

/** Choose who to be. A locked life shows what unlocks it. */
export function NewLife() {
  const t = useT('newLife');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
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
  // Which lives are open is the profile's to say. Nothing is judged here.
  const { unlocked } = useProfile();
  /** The week's challenge asked for, the attempt or a practice, while the questions on the way to it are asked. Null for the life chosen below. */
  const [challenge, setChallenge] = useState<{ lifeId: string; week: string; attempt: boolean } | null>(null);

  /**
   * Starts the chosen life, or the week's challenge when that is what was asked for. `replace` names
   * the ranked life in progress elsewhere that the player has said may end for it.
   */
  const begin = async (replace?: string, asked = challenge) => {
    setAsking(false);
    setFailed(false);
    setAway(false);
    setStarting(true);
    try {
      const options = asked
        ? { ranked: asked.attempt && ranking === 'yes', challenge: asked.week, replace }
        : { ranked: ranking === 'yes' && wantRanked, replace };
      // Nothing began if the player has a ranked life in progress somewhere else: they are asked what to do about it.
      // Replaced, not pushed: the Back button must not lead here again from a life, one tap away from ending it.
      if (await start(asked ? asked.lifeId : chosen, options)) router.replace('/play');
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

      <WeeklyChallenge
        starting={starting}
        onStart={(week, attempt) => {
          const asked = { lifeId: week.lifeId, week: week.week, attempt };
          setChallenge(asked);
          if (inProgress) setAsking(true);
          else void begin(undefined, asked);
        }}
      />

      <div role="radiogroup" aria-label={t('title')} className="flex flex-col gap-3">
        {lives.map((life) => {
          const written = text.lives[life.id];
          const locked = life.unlock !== 'default' && !Object.hasOwn(unlocked, life.id);
          const on = chosen === life.id;
          return (
            <button
              key={life.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked}
              onClick={() => setChosen(life.id)}
              className={`frame-raised flex gap-3 p-2 text-left ${on ? 'frame-gold bg-night-600' : 'bg-night-700'} ${locked ? 'opacity-60' : ''}`}
            >
              <Well className="size-[68px]">
                <Sprite id={locked ? 'icon.locked' : portraitArt(life.id, 22)} fallback={{ w: 64, h: 64 }} />
              </Well>
              <span className="min-w-0 flex-1">
                <span className="pixel block text-[18px]">{written.name}</span>
                {locked ? (
                  <span className="mt-1 block text-[13px] text-ink-200">
                    <span className="pixel text-gold-500">{t('unlock')}: </span>
                    {written.unlock}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[12px] text-ink-200">
                    {t('startsIn', { city: names.cities[life.start.cityId], cash: fmt.money(life.start.cash) })}
                  </span>
                )}
                <span className="mt-1.5 flex flex-col items-start gap-1">
                  <Tag tone="good">{written.perk}</Tag>
                  <Tag tone="bad">{written.handicap}</Tag>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-10 bg-night-900 px-3 pt-3">
        <div className="mx-auto w-full max-w-md">
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
              setChallenge(null);
              if (inProgress) setAsking(true);
              else void begin(undefined, null);
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
