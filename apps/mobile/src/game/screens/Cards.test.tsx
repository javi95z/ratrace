// @vitest-environment jsdom
import { cardArt, content, lives, textFor } from '@ratrace/content';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { cardRarity } from '@ratrace/core/game/present';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile } from '@ratrace/core/session/types';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { previewCard, quoteItem } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import type { Locale } from '@ratrace/i18n';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, spriteRenders } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { COLORS, EXTRA } from '../../ui/theme';
import { rea, SPRING_MS } from '../../ui/testing/reanimated';
import { useGame, useGuide, useSettings } from '../context';
import type { Services } from '../context';
import { CardStage, HeldShine, SWIPE, tiltOf } from './Cards';
import { Play } from './Play';

// The gesture handler's native side cannot be loaded here: a stand-in that keeps each pan the card is given, for the test to drive as a finger would.
type PanEvent = { translationX: number; velocityX?: number; canceled?: boolean };
type Pan = { enabled?: boolean; activeOffsetX?: [number, number]; failOffsetY?: [number, number]; onUpdate(event: PanEvent): void; onDeactivate(event: PanEvent): void };
const pans = vi.hoisted(() => [] as Pan[]);
vi.mock('react-native-gesture-handler', () => ({
  usePanGesture: (config: Pan) => {
    pans.push(config);
    return config;
  },
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  pans.length = 0;
  rea.assigned.length = 0;
});
afterEach(cleanup);

const { text } = textFor('en');
const pan = () => pans[pans.length - 1];
const choices = () => within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button');
const saved = async (services: Services) => (await services.store.loadGame()) as SavedGame;

/** The round store as it stands, and its actions, as a screen's own buttons would take them. */
const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}

/** The card stage of a life just begun, the news read: the first card of the hand is waiting. */
async function onTheCards(services: Services, ui: ReactNode = <CardStage />, locale: Locale = 'en') {
  renderGame(
    <>
      {ui}
      <Probe />
    </>,
    services,
    locale,
  );
  await waitFor(() => expect(probe.state?.status).toBe('playing'));
  await act(async () => probe.state?.leaveNews());
  expect(probe.state?.stage).toBe('cards');
}

/** A device whose life deals `cardId` as the card waiting, as the player stands (`change` makes them someone else). The answer is the real game's. */
async function dealt(lifeId: string, cardId: string, change: (view: GameView) => GameView = (view) => view, store = new MemoryStore()): Promise<Services> {
  const services = memoryServices(store);
  const real = await services.sessions.start(lifeId);
  const view = (): GameView => {
    const now = real.view();
    return change({ ...now, hand: [cardId, ...now.hand.slice(1)] });
  };
  const session: GameSession = { gameId: real.gameId, lifeId: real.lifeId, view, history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (orders) => real.playRound(orders) };
  services.sessions.resume = async () => ({ lost: null, session });
  return services;
}

/** A device whose player has asked for less motion. */
async function stillStore(): Promise<MemoryStore> {
  const store = new MemoryStore();
  await store.saveProfile({ ...newProfile(), settings: { sound: false, reducedMotion: true } });
  return store;
}

/** A life whose every answer waits until the test lets it go, as a game played by a slow machine would. */
function slowly(services: Services): { release(): void } {
  let release = () => {};
  const resume = services.sessions.resume.bind(services.sessions);
  services.sessions.resume = async () => {
    const found = await resume();
    const session = found.session;
    if (!session) return found;
    const answer = session.answerCard.bind(session);
    const held = Object.assign(Object.create(session) as GameSession, {
      answerCard: async (option: number) => {
        await new Promise<void>((resolve) => (release = resolve));
        return answer(option);
      },
    });
    return { ...found, session: held };
  };
  return { release: () => release() };
}

/** The box inside a choice that eases into its look (pressed, taken, stepped back). */
const settling = (choice: HTMLElement) => choice.firstElementChild as HTMLElement;

/** A finger on the card: dragged to `x` points sideways and let go there, and what the game does with it. */
async function swipe(x: number, velocityX = 0) {
  await act(async () => {
    pan().onUpdate({ translationX: x / 2 });
    pan().onUpdate({ translationX: x });
    pan().onDeactivate({ translationX: x, velocityX, canceled: false });
    await new Promise((done) => setTimeout(done, 20));
  });
}

describe('the card waiting', () => {
  it('shows the card, where it is in the hand, and every choice that can be taken as a button', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    const view = probe.state?.view as GameView;
    const def = content.cards.find((card) => card.id === view.hand[0])!;
    const written = text.cards[def.id];
    expect(screen.getByText(`Card 1 of ${view.hand.length} · ${def.category === 'world' ? 'World event' : text.categories[def.category]}`)).toBeTruthy();
    const card = screen.getByRole('article');
    expect(within(card).getByRole('heading', { name: written.title })).toBeTruthy();
    expect(within(card).getByText(written.body)).toBeTruthy();
    expect(card.querySelector(`[data-sprite="${cardArt[def.id]}"]`)).not.toBeNull();
    // The choices, named for the card: the ones that can be taken, in their order.
    const shown = previewCard(content, view, def.id).flatMap((preview, index) => (preview.available ? [index] : []));
    expect(screen.getByRole('group', { name: `Your choices: ${written.title}` })).toBeTruthy();
    expect(choices().map((choice) => choice.textContent?.startsWith(written.options[shown[choices().indexOf(choice)]].label))).toEqual(shown.map(() => true));
  });

  it('shows no choice that cannot be taken', async () => {
    const services = memoryServices();
    // Played on, without the screen, to a card with a choice that is locked.
    let session = await services.sessions.start('nurse');
    const waiting = () => {
      const view = session.view();
      return view.phase === 'cards' ? previewCard(content, view, view.hand[view.answered]) : [];
    };
    for (let tries = 0; !waiting().some((option) => option.lock !== null); tries++) {
      if (tries > 2000) throw new Error('no life met a locked choice');
      if (session.view().finished) session = await services.sessions.start('nurse');
      else if (session.view().phase === 'cards') await session.answerCard(waiting().findIndex((option) => option.available));
      else await session.playRound({ orders: [] });
    }
    const open = waiting().filter((option) => option.available).length;
    renderGame(
      <>
        <CardStage />
        <Probe />
      </>,
      memoryServices(services.store),
    );
    await waitFor(() => expect(probe.state?.status).toBe('playing'));
    if (probe.state?.stage === 'news') await act(async () => probe.state?.leaveNews());
    expect(choices()).toHaveLength(open);
    expect(screen.queryByText('Locked')).toBeNull();
  });

  it('says what a thing it hands over would add to the status of this player, not what it is worth alone', async () => {
    // A nurse who already wears an Omega, dealt the call about a Rolex: the better watch counts whole, the Omega only for a share.
    const omega = (view: GameView): GameView => ({ ...view, player: { ...view.player, cash: 5_000_000, life: { ...view.player.life, items: [...view.player.life.items, { itemId: 'watch_omega', value: 700_000, roundsLeft: null, paid: 700_000, age: 0 }] } } });
    const services = await dealt('nurse', 'life_rolex_call', omega);
    await onTheCards(services);
    const view = probe.state?.view as GameView;
    const adds = quoteItem(content, view, 'watch_rolex').statusReal;
    const worth = content.items.find((item) => item.id === 'watch_rolex')?.status ?? 0;
    expect(adds).toBeLessThan(worth);
    const group = screen.getByRole('group', { name: /^Your choices/ });
    expect(within(group).getByText(`Status +${adds}`)).toBeTruthy();
    expect(within(group).queryByText(`Status +${worth}`)).toBeNull();
  });

  it('gives each outcome a choice may bring with its chance, and says so of a choice there thanks to the player\'s trade', async () => {
    const services = await dealt('engineer', 'world_ai_boom');
    await onTheCards(services);
    const [, , lead] = choices();
    // The engineer's trade opens the third choice: it says so, beside its name.
    expect(within(lead).getByText('Thanks to your trade')).toBeTruthy();
    // Its two outcomes, each with its chance, in gold.
    const def = content.cards.find((card) => card.id === 'world_ai_boom')!;
    expect(def.options[2].outcomes).toHaveLength(2);
    expect(within(lead).getAllByText(/^\d+(\.\d+)?\s?%$/)).toHaveLength(2);
  });

  it('can show the career a choice leads to, the city it moves to and what prison is, each in a sheet', async () => {
    const teaching = await dealt('nurse', 'career_teaching');
    await onTheCards(teaching);
    fireEvent.click(screen.getByRole('button', { name: 'See the Education career' }));
    expect(await screen.findByRole('heading', { name: 'Education' })).toBeTruthy();
    cleanup();
    const moving = await dealt('nurse', 'career_relocation');
    await onTheCards(moving);
    fireEvent.click(screen.getByRole('button', { name: 'See London beside your city' }));
    // The city's sheet, named for it: its year beside the one lived, as the finances compare it (`CityPreview`), and nothing to order.
    const city = (await screen.findByRole('heading', { name: 'London' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(city).getByRole('region', { name: 'London' }).textContent).toContain('Left over a year');
    expect(within(city).queryByRole('button', { name: 'Move here' })).toBeNull();
    cleanup();
    const accused = await dealt('nurse', 'crime_wrongly_accused');
    await onTheCards(accused);
    // A choice that may end in prison: what prison is, beside the choices, never inside one.
    const see = screen.getByRole('button', { name: 'What happens in prison?' });
    // Already 44 high on its own: it reaches nothing past it.
    expect(Number.parseFloat(see.style.minHeight)).toBe(44);
    expect([see.style.paddingTop, see.style.paddingBottom, see.style.marginTop, see.style.marginBottom]).toEqual(['', '', '', '']);
    expect(within(screen.getByRole('group', { name: /^Your choices/ })).queryByText('What happens in prison?')).toBeNull();
    fireEvent.click(see);
    expect(await screen.findByRole('heading', { name: 'Prison' })).toBeTruthy();
    // A card with no such choice has no such link.
    cleanup();
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    expect(screen.queryByRole('button', { name: 'What happens in prison?' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^See / })).toBeNull();
  });

  it('gives a link under a choice the 44 a thumb needs in its own box, reaching no further than the gaps to the choices round it: what they lack, it takes under it', async () => {
    // The engineer offered a transfer east: two choices that move the city, the first of them with a choice under it, the second the last.
    const services = await dealt('engineer', 'career_transfer_east');
    await onTheCards(services);
    const px = (value: string) => Number.parseFloat(value || '0');
    const gap = (box: HTMLElement) => px(box.style.rowGap || box.style.gap);
    const links = screen.getAllByRole('button', { name: /beside your city$/ });
    expect(links).toHaveLength(2);
    // Each underlined by the kit's LinkText, a line under every line its words wrap to (one, until the phone has laid them out).
    for (const link of links) expect(link.querySelectorAll('[data-testid="underline"]')).toHaveLength(1);
    const group = screen.getByRole('group', { name: /^Your choices/ });
    const stage = group.parentElement as HTMLElement;
    for (const [i, link] of links.entries()) {
      expect(link.getAttribute('hitSlop')).toBeNull();
      const line = px((link.querySelector('[dir]') as HTMLElement).style.lineHeight);
      expect(line).toBeCloseTo(12 * 1.45, 5);
      const [padTop, padBottom, marginTop, marginBottom] = [link.style.paddingTop, link.style.paddingBottom, link.style.marginTop, link.style.marginBottom].map(px);
      // Its own box, padding and all: the 44.
      expect(line + padTop + padBottom, `link ${i}`).toBeGreaterThanOrEqual(44);
      // Above it, no further than the gap to its choice (whose frame's strips take no touch).
      const wrapper = link.parentElement?.parentElement as HTMLElement;
      expect(-marginTop, `link ${i}`).toBe(padTop);
      expect(padTop, `link ${i}`).toBeLessThanOrEqual(gap(wrapper));
      // Below it, no further than the gap to what follows: the next choice, or after the last one the next thing of the stage.
      const below = i === 0 ? gap(group) : gap(stage);
      expect(-marginBottom, `link ${i}`).toBeLessThanOrEqual(below);
      // What the gaps lack is room it takes under it, in the layout.
      expect(padBottom + marginBottom, `link ${i}`).toBeGreaterThan(0);
    }
    expect([gap(links[0].parentElement?.parentElement as HTMLElement), gap(group), gap(stage)]).toEqual([4, 10, 12]);
  });

  it('shows the choice tapped as taken at once, and the others stepping back, while the answer is on its way', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const answer = slowly(services);
    await onTheCards(services);
    const [first, second] = choices();
    fireEvent.click(second);
    await waitFor(() => expect(second.getAttribute('aria-selected')).toBe('true'));
    expect(first.getAttribute('aria-selected')).not.toBe('true');
    // The taken one goes down 2 and the others step back to half, once their 150 ms have run; every choice waits for the answer. Each eases on a
    // timer of its own, which lands a moment apart from the other's: both are waited for, never one read once the other has landed.
    await waitFor(() => {
      expect(settling(first).style.opacity).toBe('0.5');
      expect(settling(second).style.transform).toBe('translateY(2px)');
    });
    expect(settling(second).style.opacity).toBe('1');
    expect(first.getAttribute('aria-disabled')).toBe('true');
    await act(async () => answer.release());
    await waitFor(() => expect(probe.state?.stage).toBe('outcome'));
  });

  it('eases the choice taken down and the others back over the web\'s 150 ms, on Tailwind\'s curve, on the phone\'s animation thread; at once where motion is left out', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const answer = slowly(services);
    await onTheCards(services);
    rea.assigned.length = 0;
    fireEvent.click(choices()[1]);
    await waitFor(() => expect(probe.state?.picked).toBe(1));
    // The web's `transition-[transform,opacity]`: 150 ms on cubic-bezier(0.4, 0, 0.2, 1), for the taken one down and the other back.
    const eased = rea.assigned.filter((one) => one.kind === 'timing' && one.duration === 150);
    expect(eased).toEqual(expect.arrayContaining([expect.objectContaining({ to: 2, curve: [0.4, 0, 0.2, 1] }), expect.objectContaining({ to: 0.5, curve: [0.4, 0, 0.2, 1] })]));
    await act(async () => answer.release());
    await waitFor(() => expect(probe.state?.stage).toBe('outcome'));
    cleanup();
    // Where motion is left out, the look is there at once: nothing eases.
    const still = memoryServices(await stillStore());
    await still.sessions.start('nurse');
    const held = slowly(still);
    await onTheCards(still);
    rea.assigned.length = 0;
    const [first] = choices();
    fireEvent.click(choices()[1]);
    await waitFor(() => expect(settling(first).style.opacity).toBe('0.5'));
    expect(rea.assigned.filter((one) => one.kind === 'timing' && one.duration === 150)).toEqual([]);
    await act(async () => held.release());
  });
});

describe('a card with two choices, swiped', () => {
  it('takes the second choice when let go past 90 points to the right, the first past 90 to the left', async () => {
    expect(SWIPE).toBe(90);
    const right = memoryServices();
    await right.sessions.start('nurse');
    await onTheCards(right);
    // The nurse's first card has two choices that can be taken (its third is out of her reach).
    const shown = previewCard(content, probe.state?.view as GameView, (probe.state?.view as GameView).hand[0]).flatMap((preview, index) => (preview.available ? [index] : []));
    expect(shown).toHaveLength(2);
    expect(pan().enabled).toBe(true);
    await swipe(SWIPE + 1);
    await waitFor(() => expect(probe.state?.stage).toBe('outcome'));
    expect((await saved(right)).log[0].picks).toEqual([shown[1]]);
    cleanup();
    const left = memoryServices();
    await left.sessions.start('nurse');
    await onTheCards(left);
    await swipe(-(SWIPE + 1));
    await waitFor(() => expect(probe.state?.stage).toBe('outcome'));
    expect((await saved(left)).log[0].picks).toEqual([shown[0]]);
  });

  it('follows the finger, tilting up to 6 degrees over 160 points, and springs back as the web\'s does when let go short of 90: nothing is chosen', async () => {
    expect([tiltOf(0), tiltOf(80), tiltOf(-80), tiltOf(160), tiltOf(400), tiltOf(-400)]).toEqual([0, 3, -3, 6, 6, -6]);
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    const card = screen.getByRole('article');
    const moved = () => {
      for (let box: HTMLElement | null = card; box; box = box.parentElement) if (box.style.transform.includes('rotate')) return box.style.transform;
      return '';
    };
    await act(async () => pan().onUpdate({ translationX: 80 }));
    expect(moved()).toBe('translateX(80px) rotate(3deg)');
    await act(async () => {
      pan().onDeactivate({ translationX: SWIPE - 1, velocityX: 250, canceled: false });
      await new Promise((done) => setTimeout(done, 20));
    });
    // Back to where it was, on the web's spring (motion's drag snap: stiffness 200, damping 40, from the speed it was let go at).
    expect(rea.assigned.filter((one) => one.kind === 'spring')).toEqual([{ kind: 'spring', to: 0, duration: SPRING_MS, spring: { stiffness: 200, damping: 40, mass: 1, velocity: 250 } }]);
    await act(async () => new Promise((done) => setTimeout(done, SPRING_MS + 10)));
    expect(moved()).toBe('translateX(0px) rotate(0deg)');
    expect(probe.state?.stage).toBe('cards');
    expect((await saved(services)).state.answered).toBe(0);
  });

  it('picks nothing when the swipe is cut short by the phone (a cancel), wherever it was let go', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    await act(async () => {
      pan().onDeactivate({ translationX: 200, velocityX: 0, canceled: true });
      await new Promise((done) => setTimeout(done, 20));
    });
    expect(probe.state?.stage).toBe('cards');
  });

  it('says on either side what a swipe picks, to the eye only, and how to answer', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    const view = probe.state?.view as GameView;
    const written = text.cards[view.hand[0]];
    // (Each arrow is a run of its own font: the side is read as a whole.)
    const sides = [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].find((box) => box.textContent?.startsWith('←'));
    expect([...(sides?.children ?? [])].map((side) => side.textContent)).toEqual([`← ${written.options[0].label}`, `${written.options[1].label} →`]);
    // A swipe cannot be taken back: the buttons say the same to a screen reader, so the two sides are hidden from it, and each is cut to one line.
    for (const side of sides?.children ?? []) expect(side.className).toMatch(/r-textOverflow-/);
    expect(screen.getByText('Swipe the card, or tap a choice')).toBeTruthy();
  });

  it('runs on the phone\'s animation thread: the pan\'s callbacks are worklets, and a frame of it draws nothing of the card again', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    expect(String(pan().onUpdate)).toMatch(/['"]worklet['"]/);
    expect(String(pan().onDeactivate)).toMatch(/['"]worklet['"]/);
    const art = cardArt[(probe.state?.view as GameView).hand[0]];
    const before = spriteRenders.get(art);
    expect(before).toBeGreaterThan(0);
    await act(async () => {
      for (let x = 0; x <= 80; x += 4) pan().onUpdate({ translationX: x });
    });
    expect(spriteRenders.get(art)).toBe(before);
    expect(choices()).toHaveLength(2);
  });
});

describe('a card that is not swiped', () => {
  it('has its choices pressed when it has three: no swipe, and nothing said of one', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('engineer');
    await session.answerCard(0);
    // The engineer's second card, the office lottery: three choices.
    renderGame(
      <>
        <CardStage />
        <Probe />
      </>,
      services,
    );
    await waitFor(() => expect(probe.state?.stage).toBe('cards'));
    expect(choices()).toHaveLength(3);
    expect(pan().enabled).toBe(false);
    expect(screen.queryByText('Swipe the card, or tap a choice')).toBeNull();
    await swipe(200);
    expect(probe.state?.stage).toBe('cards');
    expect((await saved(services)).state.answered).toBe(1);
  });

  it('has its choices pressed where motion is left out', async () => {
    const services = memoryServices(await stillStore());
    await services.sessions.start('nurse');
    await onTheCards(services);
    expect(choices()).toHaveLength(2);
    expect(pan().enabled).toBe(false);
    expect(screen.queryByText('Swipe the card, or tap a choice')).toBeNull();
    await swipe(200);
    expect(probe.state?.stage).toBe('cards');
  });

  it('is not swiped while an answer is on its way: the swipe makes no second move', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const answer = slowly(services);
    await onTheCards(services);
    fireEvent.click(choices()[0]);
    await waitFor(() => expect(probe.state?.busy).toBe(true));
    expect(pan().enabled).toBe(false);
    await swipe(200);
    await act(async () => answer.release());
    await waitFor(() => expect(probe.state?.stage).toBe('outcome'));
    const save = await saved(services);
    expect(save.state.answered).toBe(1);
    expect(save.log[0].picks).toEqual([0]);
  });
});

describe('a tap or a swipe too many', () => {
  it('makes one move for two quick swipes', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    const first = pan();
    await act(async () => {
      first.onDeactivate({ translationX: 150, velocityX: 0, canceled: false });
      first.onDeactivate({ translationX: 150, velocityX: 0, canceled: false });
      await new Promise((done) => setTimeout(done, 20));
    });
    await waitFor(() => expect(probe.state?.stage).toBe('outcome'));
    await settled();
    const save = await saved(services);
    expect(save.state.answered).toBe(1);
    expect(save.log[0].picks).toHaveLength(1);
  });

  it('makes one move for a double tap on a choice', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    const choice = choices()[0];
    fireEvent.click(choice);
    fireEvent.click(choice);
    await waitFor(() => expect(probe.state?.stage).toBe('outcome'));
    await settled();
    const save = await saved(services);
    expect(save.state.answered).toBe(1);
    expect(save.log[0].picks).toEqual([0]);
  });
});

describe('the look of a rare card', () => {
  /** What a card's picture shines with: the rainbow drawn into it, the band of light over it, the sparks thrown from the card. */
  const shine = () => {
    const card = screen.getByRole('article');
    const picture = card.querySelector('[data-sprite]') as HTMLElement;
    return {
      rainbow: picture.querySelectorAll('[data-skia="Group"]').length > 0,
      glint: [...card.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].some((el) => el.style.backgroundColor !== '' && el.style.backgroundColor === glint()),
      sparks: card.querySelectorAll('[aria-hidden="true"] > div').length,
    };
  };
  const glint = () => {
    const probeEl = document.createElement('div');
    probeEl.style.backgroundColor = EXTRA.glint;
    return probeEl.style.backgroundColor;
  };
  const frameColour = () => {
    const card = screen.getByRole('article');
    const strips = [...card.querySelectorAll<HTMLElement>('div')].filter((el) => el.style.position === 'absolute' && el.style.top === '-2px');
    return strips[0]?.style.backgroundColor;
  };
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };

  it('is a legendary card turning over in a gold frame, a rainbow sliding across its picture, a band of light, and sparks', async () => {
    expect(cardRarity(content.cards.find((card) => card.id === 'red_appointment')!)).toBe('legendary');
    await onTheCards(await dealt('nurse', 'red_appointment'));
    expect(shine()).toMatchObject({ rainbow: true, glint: true });
    expect(shine().sparks).toBe(16);
    expect(frameColour()).toBe(rgb(COLORS['gold-900']));
    // Its rainbow and its light run for as long as it is on screen.
    expect(rea.assigned.filter((one) => one.kind === 'repeat')).toHaveLength(2);
  });

  it('is a rare card in a gold frame that catches the light now and then: no rainbow, no sparks', async () => {
    expect(cardRarity(content.cards.find((card) => card.id === 'crime_fake_mba')!)).toBe('rare');
    await onTheCards(await dealt('nurse', 'crime_fake_mba'));
    expect(shine()).toEqual({ rainbow: false, glint: true, sparks: 0 });
    expect(frameColour()).toBe(rgb(COLORS['gold-900']));
  });

  it('is a card like any other in a dark frame, and shines with nothing; nor does a rare one where motion is left out', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await onTheCards(services);
    expect(shine()).toEqual({ rainbow: false, glint: false, sparks: 0 });
    expect(frameColour()).toBe(rgb(COLORS['ink-900']));
    cleanup();
    await onTheCards(await dealt('nurse', 'red_appointment', undefined, await stillStore()));
    expect(shine()).toEqual({ rainbow: false, glint: false, sparks: 0 });
  });

  it('stands still where a scene holds it: the rainbow and the light at one moment of their run, the sparks at their end', async () => {
    await onTheCards(await dealt('nurse', 'red_appointment'), (
      <HeldShine value={{ holo: 0.5, glint: 0.2, spark: 1 }}>
        <CardStage />
      </HeldShine>
    ));
    expect(shine()).toMatchObject({ rainbow: true, glint: true });
    // Nothing of it runs on: no loop is started, and every spark stands where its flight ends (gone).
    expect(rea.assigned.filter((one) => one.kind === 'repeat')).toHaveLength(0);
    const sparks = [...screen.getByRole('article').querySelectorAll<HTMLElement>('[aria-hidden="true"] > div')];
    expect(sparks).toHaveLength(16);
    for (const spark of sparks) expect(spark.style.opacity).toBe('0');
  });
});

describe('in Russian', () => {
  it('writes every choice whole: a long name wraps in its button, never cut short', async () => {
    const services = await dealt('engineer', 'world_ai_boom');
    await onTheCards(services, <CardStage />, 'ru');
    const written = textFor('ru').text.cards.world_ai_boom;
    const buttons = within(screen.getByRole('group', { name: /^Твои варианты/ })).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const [i, button] of buttons.entries()) {
      // (A Russian title is set a word at a time, each space with the web's word spacing: the whole name is the button's text.)
      expect(button.textContent).toContain(written.options[i].label);
      // No line of a choice is cut to fit: nothing in it is held to one line or clamped.
      for (const line of button.querySelectorAll<HTMLElement>('div, span')) {
        expect(line.className, written.options[i].label).not.toMatch(/r-textOverflow-|r-WebkitLineClamp-/);
        expect(line.style.webkitLineClamp ?? '', written.options[i].label).toBe('');
      }
    }
    expect(buttons[2].textContent).toContain('Благодаря профессии');
  });
});

describe('what is drawn again', () => {
  it('is not drawn again by what it does not show: the profile read again, a tip read, the sound turned off, a store change of nothing it reads', async () => {
    const services = memoryServices(await stillStore());
    await services.sessions.start('nurse');
    const renders: Renders = { count: 0 };
    let hands: { read(tip: string): void; setSound(on: boolean): void } | null = null;
    function Hands() {
      const guide = useGuide();
      const { setSound } = useSettings();
      hands = { read: guide.read, setSound };
      return null;
    }
    await onTheCards(
      services,
      <>
        <Counted into={renders}>
          <CardStage />
        </Counted>
        <Hands />
      </>,
    );
    await settled();
    const before = renders.count;
    await settled(() => hands!.read('cards'));
    await settled(() => hands!.setSound(true));
    await settled(() => probe.state?.clearMoved());
    await settled(() => probe.state?.clearRefusal());
    expect(renders.count).toBe(before);
    // And what it shows does draw it again: the answer on its way.
    await settled(() => probe.state?.pick(0));
    expect(renders.count).toBeGreaterThan(before);
  });

  it('is not drawn again by them with motion on either: a legendary card, swipeable, its rainbow, light and sparks running', async () => {
    const services = await dealt('nurse', 'red_appointment');
    const renders: Renders = { count: 0 };
    let hands: { read(tip: string): void; setSound(on: boolean): void } | null = null;
    function Hands() {
      const guide = useGuide();
      const { setSound } = useSettings();
      hands = { read: guide.read, setSound };
      return null;
    }
    await onTheCards(
      services,
      <>
        <Counted into={renders}>
          <CardStage />
        </Counted>
        <Hands />
      </>,
    );
    // The motion-on tree is there: the swipe, the rainbow, the sparks.
    expect(pan().enabled).toBe(true);
    expect(screen.getByRole('article').querySelector('[data-sprite] [data-skia="Group"]')).not.toBeNull();
    expect(screen.getByRole('article').querySelectorAll('[aria-hidden="true"] > div')).toHaveLength(16);
    // Everything that comes in once has come in (the turn over, 0.7 s; the sparks, 1.13 s); the loops are next drawn at 3.6 s and 4 s.
    await settled(undefined, 1_300);
    const before = renders.count;
    await settled(() => hands!.read('cards'));
    await settled(() => hands!.setSound(true));
    await settled(() => probe.state?.clearMoved());
    await settled(() => probe.state?.clearRefusal());
    expect(renders.count).toBe(before);
  });
});

/** Answers the first card of a life with the option given, on the play screen, and gives the card and the screen of its result. */
async function answer(lifeId: string, pick: (options: number) => number) {
  const services = memoryServices();
  const session = await services.sessions.start(lifeId);
  const def = content.cards.find((card) => card.id === session.view().hand[0])!;
  const shown = previewCard(content, session.view(), def.id).flatMap((preview, index) => (preview.available ? [index] : []));
  const index = shown[pick(shown.length)];
  renderGame(<Play />, services);
  fireEvent.click(await screen.findByRole('button', { name: 'See what life brings' }));
  await waitFor(() => expect(screen.getByRole('group', { name: /^Your choices/ })).toBeTruthy());
  fireEvent.click(choices()[shown.indexOf(index)]);
  await screen.findByRole('heading', { name: 'What happened' });
  return { def, index, services, written: text.cards[def.id] };
}

describe('what a card did', () => {
  for (const lifeId of ['nurse', 'engineer', 'civil_servant']) {
    it(`shows the card again, the choice, what followed and what changed (${lifeId})`, async () => {
      const { def, index, written } = await answer(lifeId, () => 0);
      const card = screen.getByRole('article');
      expect(within(card).getByRole('heading', { name: written.title })).toBeTruthy();
      // The picture of the card is there again, not only its name.
      expect(card.querySelector(`[data-sprite="${cardArt[def.id]}"]`)).not.toBeNull();
      expect(within(card).getByText(`You chose: ${written.options[index].label}`)).toBeTruthy();

      const dice = (def.options[index].outcomes ?? []).length > 0;
      if (dice) {
        // One of the lines the dice could give, and how likely it was.
        const said = written.options[index].outcomes.filter((line) => within(card).queryByText(line) !== null);
        expect(said).toHaveLength(1);
        expect(within(card).getByText('chance of this being what came up')).toBeTruthy();
        expect(within(card).getByText(/^\d+(\.\d+)?\s?%$/)).toBeTruthy();
      } else {
        expect(within(card).getByText(written.options[index].after ?? 'no line')).toBeTruthy();
        expect(within(card).queryByText('chance of this being what came up')).toBeNull();
      }
      expect(screen.getByRole('region', { name: 'What changes' })).toBeTruthy();
    });
  }

  it('says how likely what came up was, when there were dice', async () => {
    // The engineer's second card, the office lottery, with a ticket bought: the dice say how it went.
    const services = memoryServices();
    const session = await services.sessions.start('engineer');
    await session.answerCard(0);
    renderGame(<Play />, services);
    await screen.findByRole('group', { name: /^Your choices/ });
    fireEvent.click(choices()[1]);
    await screen.findByRole('heading', { name: 'What happened' });
    const card = screen.getByRole('article');
    const written = text.cards.luck_lottery.options[1];
    expect(written.outcomes.filter((line) => within(card).queryByText(line) !== null)).toHaveLength(1);
    expect(within(card).getByText('chance of this being what came up')).toBeTruthy();
    expect(within(card).getByText(/^\d+(\.\d+)?\s?%$/)).toBeTruthy();
  });

  it('says that nothing changes when nothing does, instead of showing an empty box', async () => {
    // The first option of a card is the one that costs and buys nothing: often it changes nothing at all.
    const { def } = await answer('nurse', () => 0);
    const first = def.options[0];
    const plain = Object.keys(first.effects ?? {}).length === 0 && (first.outcomes ?? []).length === 0;
    const changes = screen.getByRole('region', { name: 'What changes' });
    if (plain) expect(within(changes).getByText('Nothing changes')).toBeTruthy();
    else expect(changes.textContent?.length ?? 0).toBeGreaterThan('What changes'.length);
  });

  it('does not go back over the options that were not taken', async () => {
    await answer('engineer', () => 0);
    expect(screen.queryByRole('button', { name: /did not choose/ })).toBeNull();
    expect(screen.queryByRole('group', { name: /^Your choices/ })).toBeNull();
  });

  it('tells what the cash came to when a card took more than there was: the credit card\'s line', async () => {
    // The engineer of screen-seed-2: the dentist's bill, the third card of the first round, is more than the cash left.
    let ids = 0;
    const store = new MemoryStore();
    const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(ids += 1)}`, newSeed: () => 'screen-seed-2', now: () => 1_000 + ids });
    const services: Services = { sessions, store, tapGuardMs: 0 };
    const session = await sessions.start('engineer');
    for (let i = 0; i < 2; i++) await session.answerCard(previewCard(content, session.view(), session.view().hand[i]).findIndex((preview) => preview.available));
    expect(session.view().hand[2]).toBe('health_dental');
    renderGame(<Play />, services);
    await screen.findByRole('group', { name: /^Your choices/ });
    fireEvent.click(choices()[0]);
    await screen.findByRole('heading', { name: 'What happened' });
    const line = screen.getByText(text.ledger.creditCardDraw);
    expect(line.parentElement?.parentElement?.textContent).toMatch(/^.+\+\$[\d,.]+$/);
  });
});

describe('the money a card paid', () => {
  const coins = () => document.querySelectorAll('[data-testid="coin-layer"] > div');

  it('flies to the cash in the HUD once the result has risen; none flies from a card that paid nothing', async () => {
    // The nurse's first card, a freelance gig taken: it pays.
    await answer('nurse', (shown) => shown - 1);
    expect(coins()).toHaveLength(0);
    await waitFor(() => expect(coins()).toHaveLength(3), { timeout: 2_000 });
    cleanup();
    // Turned down: nothing comes in.
    await answer('nurse', () => 0);
    await act(async () => new Promise((done) => setTimeout(done, 700)));
    expect(coins()).toHaveLength(0);
  });
});
