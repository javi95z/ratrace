'use client';

import { lives, portraitArt } from '@ratrace/content';
import { useState } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Button, Tag, Well } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/** Choose who to be. A locked life shows what unlocks it. */
export function NewLife() {
  const t = useT('newLife');
  const common = useT('common');
  const { text, names, fmt } = useWords();
  const router = useRouter();
  const start = useGame((s) => s.start);
  const inProgress = useGame((s) => s.status === 'playing' && s.stage !== 'end');
  const [chosen, setChosen] = useState(lives[0].id);
  const [starting, setStarting] = useState(false);

  const begin = async () => {
    setStarting(true);
    try {
      await start(chosen);
      router.push('/play');
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 pb-28 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/" aria-label={common('back')} className="pixel frame flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
          ←
        </Link>
        <h1 className="pixel text-[24px] text-gold-500">{t('title')}</h1>
      </div>

      <div role="radiogroup" aria-label={t('title')} className="flex flex-col gap-3">
        {lives.map((life) => {
          const written = text.lives[life.id];
          const locked = life.unlock !== 'default';
          const on = chosen === life.id;
          return (
            <button
              key={life.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked}
              onClick={() => setChosen(life.id)}
              className={`frame flex gap-3 p-2 text-left ${on ? 'frame-gold bg-night-600' : 'bg-night-700'} ${locked ? 'opacity-60' : ''}`}
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
                  <span className="mt-0.5 block text-[12px] text-ink-300">
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
          {inProgress ? <p className="mb-2 text-center text-[12px] text-wine-300">{t('replace')}</p> : null}
          <Button variant="primary" wide disabled={starting} onClick={begin}>
            {t('start')}
          </Button>
        </div>
      </div>
    </main>
  );
}
