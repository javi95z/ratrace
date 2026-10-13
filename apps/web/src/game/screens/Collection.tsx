'use client';

import { badgeArt, badges, itemArt } from '@ratrace/content';
import { useId, useState } from 'react';
import { useProfile, useT, useWords } from '@/game/context';
import { Link } from '@/i18n/navigation';
import { Bare } from '@/ui/kit';
import { Tabs } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

type Tab = 'items' | 'badges';

/** Every thing in the game, grouped as the shop groups them: in colour once owned in any life, a shadow until then. */
function Things() {
  const t = useT('collection');
  const { content, text, names } = useWords();
  const { gallery } = useProfile();
  const ladders = [...new Set(content.items.map((item) => item.ladder))];

  return (
    <div className="flex flex-col gap-4">
      <p className="pixel text-center text-[15px] text-gold-500">{t('itemsCount', { n: gallery.filter((id) => content.items.some((item) => item.id === id)).length, total: content.items.length })}</p>
      {ladders.map((ladder) => (
        <section key={ladder}>
          <h2 className="pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500">{text.ladders[ladder]}</h2>
          <ul className="grid grid-cols-2 gap-2 @min-[560px]:grid-cols-4">
            {content.items
              .filter((item) => item.ladder === ladder)
              .map((item) => {
                const owned = gallery.includes(item.id);
                return (
                  <li key={item.id} className={`flex flex-col items-center gap-1 p-2 text-center ${owned ? 'bevel frame-gold bg-night-600 text-cream' : 'frame bg-night-700 text-ink-200'}`}>
                    {/* The name stands under the picture, so the picture itself says nothing more. */}
                    <Bare className="w-full py-1.5">
                      <Sprite id={itemArt(item.id)} silhouette={!owned} fallback={{ w: 64, h: 64 }} />
                    </Bare>
                    <span className="text-[13px] leading-tight">{names.items[item.id]}</span>
                    {owned ? null : <span className="text-[11px] leading-tight text-ink-300">{t('notOwned')}</span>}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** All thirty badges with how each is earned. Earned ones are drawn, with the day; the rest show the lock. */
function Badges() {
  const t = useT('collection');
  const labels = useT('badges');
  const { text, fmt } = useWords();
  const { badges: earned } = useProfile();
  const groups = [...new Set(badges.map((badge) => badge.group))];

  return (
    <div className="flex flex-col gap-4">
      <p className="pixel text-center text-[15px] text-gold-500">{t('badgesCount', { n: badges.filter((badge) => Object.hasOwn(earned, badge.id)).length, total: badges.length })}</p>
      {groups.map((group) => (
        <section key={group}>
          <h2 className="pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500">{text.badgeGroups[group]}</h2>
          <ul className="flex flex-col gap-2">
            {badges
              .filter((badge) => badge.group === group)
              .map((badge) => {
                const got = Object.hasOwn(earned, badge.id) ? earned[badge.id] : null;
                return (
                  <li key={badge.id} className={`flex items-center gap-3 p-2 ${got ? 'bevel frame-gold bg-night-600' : 'frame bg-night-700'}`}>
                    <Sprite id={badgeArt(got ? badge.id : 'locked')} fallback={{ w: 64, h: 64 }} />
                    <div className="min-w-0 flex-1">
                      <p className={`pixel text-[16px] ${got ? '' : 'text-ink-200'}`}>{text.badges[badge.id].name}</p>
                      <p className="text-[13px] leading-snug text-ink-200">{text.badges[badge.id].how}</p>
                      <p className={`mt-0.5 text-[12px] ${got ? 'text-teal-300' : 'text-ink-300'}`}>{got ? labels('earnedOn', { date: fmt.day(got.at) }) : labels('notYet')}</p>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The gallery of everything ever owned and every badge ever earned, across all lives. */
export function Collection() {
  const t = useT('collection');
  const common = useT('common');
  const [tab, setTab] = useState<Tab>('items');
  const ids = useId();

  return (
    <main className="@container mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-3 pb-10 pt-4">
      <div className="mb-1 flex items-center gap-2">
        <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
          ←
        </Link>
        <h1 className="pixel text-[24px] text-gold-500">{t('title')}</h1>
      </div>
      <p className="mb-2 text-[13px] text-ink-300">{t('intro')}</p>
      <div className="-mx-3">
        <Tabs<Tab> label={t('title')} idPrefix={ids} tabs={[{ id: 'items', label: t('items') }, { id: 'badges', label: t('badges') }]} value={tab} onChange={setTab} />
      </div>
      <div role="tabpanel" id={`${ids}-panel-${tab}`} aria-labelledby={`${ids}-tab-${tab}`} className="pt-2">
        {tab === 'items' ? <Things /> : <Badges />}
      </div>
    </main>
  );
}
