'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { useStill } from '@/game/motion';
import { ageAt } from '@/game/present';
import type { Stage } from '@/game/store';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Panel } from '@/ui/kit';
import { Toast } from '@/ui/overlay';
import { useIsDesk } from '@/ui/useMedia';
import { KeyboardHint, useKeyboardContext, useKeyboardScope } from '@/ui/keyboard';
import { CardStage, Outcome } from './Cards';
import { End } from './End';
import { Basket, BasketList, Finance } from './Finance';
import { Guide } from './Guide';
import { Hud } from './Hud';
import { Moments } from './Moments';
import { PageTurn } from './PageTurn';
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
        <Button variant="primary" wide data-primary-action aria-keyshortcuts="Control+Enter Meta+Enter" onClick={leaveNews}>
          {cardsWait ? news('toCards') : news('toFinance')}
          <KeyboardHint>Ctrl/⌘ ↵</KeyboardHint>
        </Button>
      );
    case 'outcome':
      return (
        <Button variant="primary" wide data-primary-action aria-keyshortcuts="Control+Enter Meta+Enter" onClick={afterCard}>
          {cardsWait ? cards('next') : cards('toFinance')}
          <KeyboardHint>Ctrl/⌘ ↵</KeyboardHint>
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
            <Button variant="primary" wide disabled={busy} data-primary-action aria-keyshortcuts="Control+Enter Meta+Enter" onClick={() => void play()}>
              {finance('play')}
              <KeyboardHint>Ctrl/⌘ ↵</KeyboardHint>
            </Button>
          </div>
        </div>
      );
    case 'resolve':
      return (
        <Button variant="primary" wide data-primary-action aria-keyshortcuts="Control+Enter Meta+Enter" onClick={next}>
          {view.finished ? resolve('finish') : resolve('next')}
          <KeyboardHint>Ctrl/⌘ ↵</KeyboardHint>
        </Button>
      );
    default:
      return null;
  }
}

/**
 * What the stage of the round shows, under the tip of the guide when one is due.
 * A card is the exception: its choices are the stage, so the tip follows them and never pushes them off a small screen.
 */
function StageView({ stage, desk }: { stage: Stage; desk: boolean }) {
  const body = <StageBody stage={stage} desk={desk} />;
  if (stage !== 'cards') {
    return (
      <>
        <Guide />
        {body}
      </>
    );
  }
  return (
    <>
      {body}
      <div className="pt-3">
        <Guide />
      </div>
    </>
  );
}

/** On a wide screen the headlines sit at the side, so the round opens on its own title. */
function StageBody({ stage, desk }: { stage: Stage; desk: boolean }) {
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

/** What a room adds to the screens of a life: its bar, what stands in for the next thing to do while the player waits, its order after a round, and at the end. */
export interface RoomSlots {
  bar: ReactNode;
  /** Shown in place of the round's own button, while the player has played and waits for the others. Null otherwise. */
  actions: ReactNode | null;
  /** Below the ledger of a round. */
  resolved: ReactNode;
  /** Above the end of the life. */
  end: ReactNode;
}

/**
 * A life being played: the HUD, the stage of the round, and the next thing to do.
 * A phone stacks them, with the profile and the orders in sheets. From 1024px they sit in three
 * columns: who you are, the round, and the world with this round's orders.
 * In a room, `room` adds the room's bar, its wait and its order.
 */
export function Play({ room }: { room?: RoomSlots } = {}) {
  const common = useT('common');
  const profile = useT('profile');
  const news = useT('news');
  const finance = useT('finance');
  const keyboard = useT('keyboard.skip');
  const router = useRouter();
  const desk = useIsDesk();
  const status = useGame((s) => s.status);
  const stage = useGame((s) => s.stage);
  const view = useGame((s) => s.view);
  const moved = useGame((s) => s.moved);
  const fault = useGame((s) => s.fault);
  const clearMoved = useGame((s) => s.clearMoved);
  const unreachable = useGame((s) => s.unreachable);
  const clearUnreachable = useGame((s) => s.clearUnreachable);
  const fellBack = useGame((s) => s.fellBack);
  const clearFellBack = useGame((s) => s.clearFellBack);
  const play = useT('play');
  const cards = useT('cards');
  const { content, text } = useWords();
  const lifeId = useGame((s) => s.lifeId);
  const stageRef = useRef<HTMLElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  useKeyboardContext(stage === 'cards' ? 'cards' : stage === 'finance' ? 'finance' : 'play');
  useKeyboardScope(
    (event) => {
      if (event.repeat || event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || document.querySelector('[role="dialog"]')) return false;
      const action = document.querySelector<HTMLButtonElement>('[data-primary-action]:not(:disabled)');
      if (!action) return false;
      action.click();
      return true;
    },
    { active: status === 'playing', priority: 10 },
  );

  // No life to play: the front door is where one is started. A room says itself where to go.
  useEffect(() => {
    if (status === 'none' && !room) router.replace('/');
  }, [status, router, room]);

  // A sheet belongs to the stage it was opened in.
  useEffect(() => {
    setBasketOpen(false);
  }, [stage, desk]);

  // Two years go by as a round turns: the calendar loses a page. Not on opening a life already under way,
  // and never where motion is left out.
  const still = useStill();
  const round = view?.round ?? null;
  const lastRound = useRef<number | null>(null);
  const [turn, setTurn] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => {
    if (round === null) return;
    const was = lastRound.current;
    lastRound.current = round;
    if (was !== null && round > was && !still) setTurn({ from: ageAt(content, was), to: ageAt(content, round) });
  }, [round, still, content]);
  const pageTurn = turn ? <PageTurn key={turn.to} from={turn.from} to={turn.to} onDone={() => setTurn(null)} /> : null;

  // A new stage starts at its top and takes the focus, so a screen reader says where the player now is
  // and the keyboard carries on from there.
  const playing = status === 'playing' && view !== null;
  useEffect(() => {
    if (!playing) return;
    window.scrollTo?.({ top: 0 });
    stageRef.current?.focus({ preventScroll: true });
  }, [stage, playing]);

  if (fault) return <Fault />;
  if (status !== 'playing' || !view) return <Waiting>{common('loading')}</Waiting>;
  if (stage === 'end') return <End extra={room?.end} />;

  // Another tab played this life on: the store has already opened it as it now stands, and the player is told why the screen changed.
  // A ranked life is played by the server. When it did not answer, nothing was played, and the player is told to try again;
  // and when it could not be reached at the start, the life began on the device, and the player is told that too.
  // In a room the life moves on with the room, which says itself how many rounds the clock played: no word of another tab.
  const said = moved && !room ? 'moved' : unreachable ? 'unreachable' : fellBack ? 'fellBack' : null;
  const heard = said === 'moved' ? clearMoved : said === 'unreachable' ? clearUnreachable : clearFellBack;
  const notice = <Toast message={said ? play(said) : null} onDone={heard} ms={6_000} />;

  const actions = room?.actions ?? <Actions stage={stage} desk={desk} onBasket={() => setBasketOpen(true)} />;
  const hasActions = stage !== 'cards' || room?.actions != null;
  const afterStage = room && stage === 'resolve' ? <div className="mt-4 px-3">{room.resolved}</div> : null;
  const heading = <h1 className="sr-only">{play('heading', { life: text.lives[lifeId ?? '']?.name ?? '', age: ageAt(content, view.round) })}</h1>;
  // What the stage is called, for someone who cannot see it change.
  const stageName =
    stage === 'news' ? news('title') : stage === 'cards' ? cards('progress', { n: Math.min(view.answered + 1, view.hand.length), total: view.hand.length }) : play(`stages.${stage}`);
  const skipLinks = (
    <nav aria-label={keyboard('stage')} className="skip-links">
      <a href="#round-stage" className="pixel frame-raised bg-gold-500 px-3 py-2 text-ink-900">{keyboard('stage')}</a>
      {desk ? <a href="#player-profile" className="pixel frame-raised bg-gold-500 px-3 py-2 text-ink-900">{keyboard('profile')}</a> : null}
      {desk ? <a href="#round-news" className="pixel frame-raised bg-gold-500 px-3 py-2 text-ink-900">{keyboard('news')}</a> : null}
      {desk && stage === 'finance' ? <a href="#round-orders" className="pixel frame-raised bg-gold-500 px-3 py-2 text-ink-900">{keyboard('orders')}</a> : null}
      {hasActions ? <a href="#round-actions" className="pixel frame-raised bg-gold-500 px-3 py-2 text-ink-900">{keyboard('actions')}</a> : null}
    </nav>
  );

  if (desk) {
    // The side columns give way first on a narrow desktop, so the round in the middle never drops below a phone's width.
    return (
      <div className="mx-auto grid min-h-dvh w-full max-w-[1480px] grid-cols-[minmax(280px,372px)_minmax(360px,1fr)_minmax(260px,340px)] gap-4 px-4">
        {skipLinks}
        <aside id="player-profile" tabIndex={-1} aria-label={profile('title')} className="no-scrollbar sticky top-0 flex max-h-dvh flex-col gap-3 overflow-y-auto overflow-x-hidden pb-5 pt-2">
          {heading}
          {/* No negative margin to line it up: a column that scrolls down would then scroll sideways too. */}
          <Hud skyline={false} flush />
          <ProfileBody />
          <Leave />
        </aside>

        <div className="@container flex min-h-dvh min-w-0 flex-col">
          {/* Art is drawn at twice its size only where the column has room for a card that wide. */}
          {room ? <div className="mx-auto w-full max-w-[680px] pt-3">{room.bar}</div> : null}
          <main id="round-stage" ref={stageRef} tabIndex={-1} aria-label={stageName} className={`mx-auto w-full max-w-[680px] pt-5 outline-none @min-[640px]:[--art:2] ${stage === 'finance' ? 'flex-1 pb-6' : 'pb-4'}`}>
            <StageView stage={stage} desk />
            {afterStage}
          </main>
          {hasActions ? (
            // The finances are long, so their button stays in reach at the bottom. Everywhere else it follows what was just read.
            <div id="round-actions" tabIndex={-1} className={stage === 'finance' ? 'sticky bottom-0 z-20 bg-night-800 pb-5 pt-3' : 'pb-8'}>
              <div className="mx-auto w-full max-w-md px-3">{actions}</div>
            </div>
          ) : null}
        </div>

        <aside id="round-news" tabIndex={-1} aria-label={news('title')} className="no-scrollbar sticky top-0 flex max-h-dvh flex-col gap-3 overflow-y-auto overflow-x-hidden py-5">
          <Headlines />
          {stage === 'finance' ? (
            <div id="round-orders" tabIndex={-1}><Panel title={finance('basketTitle')}><BasketList /></Panel></div>
          ) : null}
        </aside>
        {notice}
        {pageTurn}
        <Moments />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {skipLinks}
      {heading}
      {/* The skyline opens and closes a round. In between, the room goes to the cards and the finances. */}
      <Hud compact={stage !== 'news' && stage !== 'resolve'} onProfile={() => setProfileOpen(true)} />
      {room ? <div className="px-3 pt-2">{room.bar}</div> : null}
      <main id="round-stage" ref={stageRef} tabIndex={-1} aria-label={stageName} className={`flex-1 pt-3 outline-none ${hasActions ? (stage === 'finance' ? 'pb-36' : 'pb-28') : 'pb-8'}`}>
        <StageView stage={stage} desk={false} />
        {afterStage}
      </main>
      {hasActions ? (
        <div id="round-actions" tabIndex={-1} className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-night-900 px-3 pt-3">
          <div className="mx-auto w-full max-w-md">{actions}</div>
        </div>
      ) : null}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      {basketOpen && stage === 'finance' ? <Basket onClose={() => setBasketOpen(false)} /> : null}
      {notice}
      {pageTurn}
      <Moments />
    </div>
  );
}
