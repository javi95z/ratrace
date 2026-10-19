'use client';

import { careerArt } from '@ratrace/content';
import { quoteCareer } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useT, useWords } from '@/game/context';
import { Bare, Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

/**
 * A career a card offers, before it is taken: every rung with what it pays in the player's city
 * today, its status and the experience it asks, the rung the card starts the player on marked. The
 * job they have now is said beside it, to weigh one against the other.
 */
export function CareerPreview({ careerId, startLevel, shown, onClose }: { careerId: string; startLevel: number; shown: GameView; onClose(): void }) {
  const t = useT('work');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const quote = quoteCareer(content, shown, careerId);
  const titles = text.careers[careerId].levels;
  const now = shown.player.life.career;
  const top = quote.ladder[quote.ladder.length - 1];
  return (
    <Sheet open onClose={onClose} title={text.careers[careerId].name} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Bare className="size-8">
            <Sprite id={careerArt(careerId)} />
          </Bare>
          <p className="text-[13px] leading-snug text-ink-200">
            {t('previewStart', { title: titles[startLevel], pay: common('perYear', { amount: fmt.money(quote.ladder[startLevel].payAnnual) }) })}{' '}
            {t('previewTop', { title: titles[top.level], pay: common('perYear', { amount: fmt.money(top.payAnnual) }) })}
          </p>
        </div>
        {now ? <p className="text-[12px] text-ink-300">{t('previewNow', { title: text.careers[now.id].levels[now.level], career: text.careers[now.id].name })}</p> : null}
        <ol reversed className="flex flex-col-reverse gap-2">
          {quote.ladder.map((rung) => {
            const start = rung.level === startLevel;
            return (
              <li key={rung.level} aria-current={start ? 'step' : undefined} className={`px-2.5 py-2 ${start ? 'bevel frame-gold bg-night-600' : 'frame bg-night-700'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="pixel text-[16px]">{titles[rung.level]}</span>
                  <span className="pixel shrink-0 text-[15px] text-gold-500">{common('perYear', { amount: fmt.money(rung.payAnnual) })}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {start ? <Tag tone="good">{t('previewYouStart')}</Tag> : null}
                  {rung.status > 0 ? <Tag tone="good">{t('status', { n: rung.status })}</Tag> : null}
                  {rung.level > startLevel ? <Tag>{t('previewNeeds', { skill: rung.minSkill })}</Tag> : null}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-[12px] text-ink-300">{t('previewNote', { city: names.cities[shown.player.cityId] })}</p>
      </div>
    </Sheet>
  );
}
