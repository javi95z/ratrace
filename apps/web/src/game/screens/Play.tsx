'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import type { Stage } from '@/game/store';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Panel } from '@/ui/kit';
import { Toast } from '@/ui/overlay';
import { useIsDesk } from '@/ui/useMedia';
import { CardStage, Outcome } from './Cards';
import { End } from './End';
import { Basket, BasketList, Finance } from './Finance';
import { Hud } from './Hud';
import { Headlines, NewsPanel, RoundOpener } from './News';
import { Leave, ProfileBody, ProfileSheet } from './Profile';
import { Resolve } from './Resolve';

/**
 * The one thing to do next, where a thumb rests. In the finance phase it also says what the round
 * will leave in cash, and on a phone it opens the list of orders. Null where the screen itself is the choice.
 */
function Actions({ stage, desk, onBasket }: { stage: Stage; desk: boolean; onBasket(): void }) {
  const news = useT('news');
  const cards = useT('cards');
  const finance = useT('finance');
  const resolve = useT('resolve');
  const { fmt } = useWords();
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  const orders = useGame((s) => s.orders);
  const busy = useGame((s) => s.busy);
  const leaveNews = useGame((s) => s.leaveNews);
  const afterCard = useGame((s) => s.afterCard);
  const play = useGame((s) => s.play);
  const next = useGame((s) => s.next);
  if (!view) return null;
  const cardsWait = view.phase === 'cards';

  switch (stage) {
    case 'news':
      return (
        <Button variant="primary" wide onClick={leaveNews}>
          {cardsWait ? news('toCards') : news('toFinance')}
        </Button>
      );
    case 'outcome':
      return (
        <Button variant="primary" wide onClick={afterCard}>
          {cardsWait ? cards('next') : cards('toFinance')}
        </Button>
      );
    case 'finance':
      return (
        <div className="flex flex-col gap-2">
          {preview ? (
            <p className="flex items-baseline justify-between gap-3 text-[13px] text-ink-200">
              <span>{finance('afterRound')}</span>
              <span className={`pixel text-[17px] ${preview.cashAfter < 0 ? 'text-wine-300' : 'text-cream'}`}>{fmt.money(preview.cashAfter)}</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            {desk ? null : (
              <Button variant="quiet" onClick={onBasket} className="shrink-0 px-3 text-[14px]">
                {finance('basket', { count: orders.length })}
              </Button>
            )}
            <Button variant="primary" wide disabled={busy} onClick={() => void play()}>
              {finance('play')}
            </Button>
          </div>
        </div>
      );
    case 'resolve':
      return (
        <Button variant="primary" wide onClick={next}>
          {view.finished ? resolve('finish') : resolve('next')}
        </Button>
      );
    default:
      return null;
  }
}

/** What the stage of the round shows. On a wide screen the headlines sit at the side, so the round opens on its own title. */
function StageView({ stage, desk }: { stage: Stage; desk: boolean }) {
  switch (stage) {
    case 'news':
      return <div className="px-3">{desk ? <RoundOpener /> : <NewsPanel />}</div>;
    case 'cards':
      return <CardStage />;
    case 'outcome':
      return <Outcome />;
    case 'finance':
      return <Finance />;
    case 'resolve':
      return <Resolve />;
    default:
      return null;
  }
}

/** The game refused a step. The life is saved as it stood before it; this is the way out. */
function Fault() {
  const t = useT('play');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-4">
      <div role="alert" className="frame bg-wine-900 p-4">
        <h1 className="pixel text-[20px]">{t('faultTitle')}</h1>
        <p className="mt-2 text-[14px] leading-snug">{t('faultBody')}</p>
      </div>
      <Link href="/new" className="pixel frame-raised frame-gold flex min-h-12 items-center justify-center bg-gold-500 px-4 text-[17px] text-ink-900">
        {t('newLife')}
      </Link>
      <Link href="/" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-4 text-[15px] text-cream">
        {t('home')}
      </Link>
    </main>
  );
}

const Waiting = ({ children }: { children: ReactNode }) => (
  <main className="flex min-h-dvh items-center justify-center">
    <p className="pixel animate-blink text-ink-300">{children}</p>
  </main>
);

/**
 * A life being played: the HUD, the stage of the round, and the next thing to do.
 * A phone stacks them, with the profile and the orders in sheets. From 1024px they sit in three
 * columns: who you are, the round, and the world with this round's orders.
 */
export function Play() {
  const common = useT('common');
  const profile = useT('profile');
  const news = useT('news');
  const finance = useT('finance');
  const router = useRouter();
  const desk = useIsDesk();
  const status = useGame((s) => s.status);
  const stage = useGame((s) => s.stage);
  const view = useGame((s) => s.view);
  const moved = useGame((s) => s.moved);
  const fault = useGame((s) => s.fault);
  const clearMoved = useGame((s) => s.clearMoved);
  const play = useT('play');
  const [profileOpen, setProfileOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);

  // No life to play: the front door is where one is started.
  useEffect(() => {
    if (status === 'none') router.replace('/');
  }, [status, router]);

  // A sheet belongs to the stage it was opened in.
  useEffect(() => {
    setBasketOpen(false);
  }, [stage, desk]);

  if (fault) return <Fault />;
  if (status !== 'playing' || !view) return <Waiting>{common('loading')}</Waiting>;
  if (stage === 'end') return <End />;

  // Another tab played this life on: the store has already opened it as it now stands, and the player is told why the screen changed.
  const notice = <Toast message={moved ? play('moved') : null} onDone={clearMoved} ms={6_000} />;

  const actions = <Actions stage={stage} desk={desk} onBasket={() => setBasketOpen(true)} />;
  const hasActions = stage !== 'cards';

  if (desk) {
    // The side columns give way first on a narrow desktop, so the round in the middle never drops below a phone's width.
    return (
      <div className="mx-auto grid min-h-dvh w-full max-w-[1480px] grid-cols-[minmax(280px,372px)_minmax(360px,1fr)_minmax(260px,340px)] gap-4 px-4">
        <aside aria-label={profile('title')} className="no-scrollbar sticky top-0 flex max-h-dvh flex-col gap-3 overflow-y-auto pb-5 pt-2">
          <div className="-mx-3">
            <Hud skyline={false} />
          </div>
          <ProfileBody />
          <Leave />
        </aside>

        <div className="@container flex min-h-dvh min-w-0 flex-col">
          {/* Art is drawn at twice its size only where the column has room for a card that wide. */}
          <main className={`mx-auto w-full max-w-[680px] pt-5 @min-[640px]:[--art:2] ${stage === 'finance' ? 'flex-1 pb-6' : 'pb-4'}`}>
            <StageView stage={stage} desk />
          </main>
          {hasActions ? (
            // The finances are long, so their button stays in reach at the bottom. Everywhere else it follows what was just read.
            <div className={stage === 'finance' ? 'sticky bottom-0 z-20 bg-night-800 pb-5 pt-3' : 'pb-8'}>
              <div className="mx-auto w-full max-w-md px-3">{actions}</div>
            </div>
          ) : null}
        </div>

        <aside aria-label={news('title')} className="no-scrollbar sticky top-0 flex max-h-dvh flex-col gap-3 overflow-y-auto py-5">
          <Headlines hint={false} />
          {stage === 'finance' ? (
            <Panel title={finance('basketTitle')}>
              <BasketList />
            </Panel>
          ) : null}
        </aside>
        {notice}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* The skyline opens and closes a round. In between, the room goes to the cards and the finances. */}
      <Hud compact={stage !== 'news' && stage !== 'resolve'} onProfile={() => setProfileOpen(true)} />
      <main className={`flex-1 pt-3 ${hasActions ? (stage === 'finance' ? 'pb-36' : 'pb-28') : 'pb-8'}`}>
        <StageView stage={stage} desk={false} />
      </main>
      {hasActions ? (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-night-900 px-3 pt-3">
          <div className="mx-auto w-full max-w-md">{actions}</div>
        </div>
      ) : null}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      {basketOpen && stage === 'finance' ? <Basket onClose={() => setBasketOpen(false)} /> : null}
      {notice}
    </div>
  );
}
