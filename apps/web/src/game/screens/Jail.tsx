'use client';

import { cardArt } from '@ratrace/content';
import { useT, useWords } from '@/game/context';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

/**
 * What prison does to a life, in a sheet: what stops while inside, what goes on, and what it costs
 * going in and coming out. `left` is the rounds still to serve, for someone already inside.
 */
export function JailSheet({ open, onClose, left = 0 }: { open: boolean; onClose(): void; left?: number }) {
  const t = useT('jail');
  const common = useT('common');
  const { content } = useWords();
  const { statusLost, rungsLost } = content.life.jail;
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      <div className="frame leading-[0]">
        <Sprite id={cardArt.crime_jail_cellmate ?? ''} scale="art" alt="" fallback={{ w: 288, h: 120 }} />
      </div>
      {left > 0 ? <p className="pixel mt-3 text-[15px] text-wine-300">{t('left', { n: left })}</p> : null}
      <p className="mt-3 text-[14px] text-ink-200">{t('inside')}</p>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[14px] leading-snug">
        <li>{t('noPay')}</li>
        <li>{t('noFocus')}</li>
        <li>{t('noCareer')}</li>
        <li>{t('cards')}</li>
        <li>{t('goesOn')}</li>
      </ul>
      <p className="mt-3 text-[14px] leading-snug">{t('enter', { status: statusLost })}</p>
      <p className="mt-1 text-[14px] leading-snug">{t('leave', { n: rungsLost })}</p>
    </Sheet>
  );
}
