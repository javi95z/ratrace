// @vitest-environment jsdom
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile } from '@ratrace/core/session/types';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from '../context';
import { speaking } from '../../testing/memoryServices';
import { heard, memoryServices, renderGame } from '../../testing/render';
import { Counted } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { StickyScreen } from '../../ui/Sticky';
import { rea } from '../../ui/testing/reanimated';
import { CoinFlights, CoinTargets, coinsFor, FlyingCoins, useCoinTarget } from './FlyingCoins';
import { Hud } from './Hud';
import { Play } from './Play';

beforeEach(() => {
  rea.assigned.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/** What is drawn once the game is open on its life, as Play waits for it. */
function Playing({ children }: { children: ReactNode }) {
  const playing = useGame((s) => s.status === 'playing' && s.view !== null);
  return playing ? children : null;
}

/** Somewhere on the page a coin flies from or to, by name. */
function Spot({ name, id }: { name: string; id: string }) {
  return <View ref={useCoinTarget(name)} testID={id} style={{ width: 10, height: 10 }} />;
}

type Box = { left: number; top: number; width: number; height: number };
/** Where a view of the page stands on the screen, as the phone measures it there. */
function standAt(element: Element, box: Box) {
  (element as HTMLElement).getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => box }) as DOMRect;
}
const coins = () => [...document.querySelectorAll<HTMLElement>('[data-testid="coin-layer"] > div')];
const layer = () => document.querySelector<HTMLElement>('[data-testid="coin-layer"]') as HTMLElement;

/** The coins flown: their place (the box of each, 24 square, centred on where it is) and how far each goes, and when. */
const placed = () => coins().map((coin) => ({ left: coin.style.left, top: coin.style.top, width: coin.style.width, height: coin.style.height }));

describe('the coins of a flight', () => {
  it('leave from the middle of each line that paid, three a line and twelve in all, one after another, for the middle of where they land', () => {
    const line = (top: number) => ({ x: 20, y: top, w: 100, h: 20 });
    // Two lines: three coins each, from each line's middle, 90 ms apart; each flies the rest of the way to the target's middle.
    expect(coinsFor([line(300), line(340)], { x: 10, y: 40, w: 120, h: 50 }, { x: 0, y: 0 })).toEqual([
      { x: 70, y: 310, dx: 0, dy: -245, delay: 0 },
      { x: 70, y: 310, dx: 0, dy: -245, delay: 90 },
      { x: 70, y: 310, dx: 0, dy: -245, delay: 180 },
      { x: 70, y: 350, dx: 0, dy: -285, delay: 270 },
      { x: 70, y: 350, dx: 0, dy: -285, delay: 360 },
      { x: 70, y: 350, dx: 0, dy: -285, delay: 450 },
    ]);
    // Five lines: the first four give their three, and the fifth none (the web's handful).
    const five = coinsFor([0, 1, 2, 3, 4].map((i) => line(100 + i * 30)), { x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0 });
    expect(five).toHaveLength(12);
    expect(five[11]).toMatchObject({ y: 200, delay: 990 });
    // In the order they are read on the page, top to bottom then left to right, whatever order they were put on it in.
    expect(coinsFor([line(340), line(300)], { x: 10, y: 40, w: 120, h: 50 }, { x: 0, y: 0 })[0].y).toBe(310);
    // Placed in the layer they are drawn in, wherever that is on the screen.
    expect(coinsFor([line(300)], { x: 10, y: 40, w: 120, h: 50 }, { x: 0, y: 62 })[0]).toEqual({ x: 70, y: 248, dx: 0, dy: -245, delay: 0 });
    expect(coinsFor([], { x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0 })).toEqual([]);
  });
});

/** The page of a flight: two lines that paid, where the cash is kept, and the layer the coins are drawn in over all of it. */
function Page({ startMs = 450, children }: { startMs?: number; children?: ReactNode }) {
  return (
    <CoinTargets>
      <Spot name="paid" id="paid-1" />
      <Spot name="paid" id="paid-2" />
      <Spot name="cash" id="cash" />
      <FlyingCoins from="paid" to="cash" startMs={startMs} />
      {children}
      <CoinFlights />
    </CoinTargets>
  );
}

function placeThePage() {
  standAt(screen.getByTestId('paid-1'), { left: 20, top: 300, width: 100, height: 20 });
  standAt(screen.getByTestId('paid-2'), { left: 20, top: 340, width: 100, height: 20 });
  standAt(screen.getByTestId('cash'), { left: 10, top: 40, width: 120, height: 50 });
}

describe('coins that fly', () => {
  it('fly once, after their start, from where money came in to where it is kept, measured where they stand when the flight begins, with the sound of a coin', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderGame(<Page />, memoryServices());
    // The game's settings are read: the flight waits for nothing else.
    await act(async () => undefined);
    placeThePage();
    await act(async () => vi.advanceTimersByTime(440));
    expect(coins()).toHaveLength(0);
    // Measured as the flight begins: the lines have settled where they are by now.
    standAt(screen.getByTestId('paid-2'), { left: 20, top: 360, width: 100, height: 20 });
    await act(async () => vi.advanceTimersByTime(20));
    expect(placed()).toEqual([
      ...Array(3).fill({ left: '58px', top: '298px', width: '24px', height: '24px' }),
      ...Array(3).fill({ left: '58px', top: '358px', width: '24px', height: '24px' }),
    ]);
    expect(heard).toEqual(['coin']);
    // Each a coin turning, at the web's pace.
    expect(coins()[0].querySelectorAll('[data-sprite^="anim.coin."]')).toHaveLength(4);
    expect(coins()[0].querySelector('[data-sprite="anim.coin.0"]')?.getAttribute('data-size')).toBe('24x24');
    // Each waits its turn, 90 ms after the one before, invisible, then flies the web's 700 ms and is gone where it lands.
    expect(coins()[0].style.opacity).toBe('0');
    expect(rea.assigned.filter((one) => one.duration >= 700).map((one) => one.duration)).toEqual([700, 790, 880, 970, 1060, 1150]);
    await act(async () => vi.advanceTimersByTime(700));
    expect(coins()[0].style.transform).toBe('translateX(0px) translateY(-245px) scale(0.7)');
    expect(coins()[0].style.opacity).toBe('0');
    expect(coins()[5].style.transform).toBe('translateX(0px) translateY(0px) scale(0.6)');
    // Gone once the last has landed, so nothing is left on the page: 12 × 90 + 700 + 200 after the start.
    await act(async () => vi.advanceTimersByTime(450 + 1_980 - 1_160 - 1));
    expect(coins()).toHaveLength(6);
    await act(async () => vi.advanceTimersByTime(2));
    expect(coins()).toHaveLength(0);
    // Once: nothing more flies.
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(coins()).toHaveLength(0);
    expect(heard).toEqual(['coin']);
  });

  it('take no touch and say nothing to a screen reader: decoration over the whole screen', () => {
    renderGame(<Page />, memoryServices());
    const over = layer();
    expect(over.style.position).toBe('absolute');
    expect([over.style.top, over.style.left, over.style.right, over.style.bottom]).toEqual(['0px', '0px', '0px', '0px']);
    expect(over.style.pointerEvents).toBe('none');
    expect(over.getAttribute('aria-hidden')).toBe('true');
  });

  it('do not fly where motion is left out, and make no sound', async () => {
    const store = new MemoryStore();
    await store.saveProfile({ ...newProfile(), settings: { sound: true, reducedMotion: true } });
    renderGame(<Page startMs={100} />, memoryServices(store));
    placeThePage();
    await act(async () => new Promise((done) => setTimeout(done, 200)));
    expect(coins()).toHaveLength(0);
    expect(heard).toEqual([]);
  });

  it('do not fly with nothing to fly from, or nowhere to land', async () => {
    renderGame(
      <CoinTargets>
        <Spot name="cash" id="cash" />
        <FlyingCoins from="paid" to="cash" startMs={0} />
        <FlyingCoins from="cash" to="nowhere" startMs={0} />
        <CoinFlights />
      </CoinTargets>,
      memoryServices(),
    );
    await act(async () => new Promise((done) => setTimeout(done, 50)));
    expect(coins()).toHaveLength(0);
    expect(heard).toEqual([]);
  });

  it('are drawn where the layer of coins stands: the screen below its top inset', async () => {
    renderGame(<Page startMs={0} />, memoryServices());
    placeThePage();
    standAt(layer(), { left: 0, top: 62, width: 402, height: 812 });
    await waitFor(() => expect(coins()).toHaveLength(6));
    expect(placed()[0]).toMatchObject({ left: '58px', top: '236px' });
  });

  it('are nothing outside a page that has a place for them: a Hud alone, a page with no layer', async () => {
    renderGame(
      <>
        <Spot name="paid" id="paid-1" />
        <Spot name="cash" id="cash" />
        <FlyingCoins from="paid" to="cash" startMs={0} />
      </>,
      memoryServices(),
    );
    await act(async () => new Promise((done) => setTimeout(done, 50)));
    expect(heard).toEqual([]);
    cleanup();
    renderGame(
      <CoinTargets>
        <Spot name="paid" id="paid-1" />
        <Spot name="cash" id="cash" />
        <FlyingCoins from="paid" to="cash" startMs={0} />
      </CoinTargets>,
      memoryServices(),
    );
    await act(async () => new Promise((done) => setTimeout(done, 50)));
    expect(heard).toEqual([]);
  });

  it('leave nothing behind when what flew them goes before they land', async () => {
    const services = speaking(memoryServices(), 'en');
    const page = (flying: boolean) => (
      <GameProvider services={services}>
        <CoinTargets>
          <Spot name="paid" id="paid-1" />
          <Spot name="cash" id="cash" />
          {flying ? <FlyingCoins from="paid" to="cash" startMs={0} /> : null}
          <CoinFlights />
        </CoinTargets>
      </GameProvider>
    );
    const { rerender } = render(page(true));
    standAt(screen.getByTestId('paid-1'), { left: 20, top: 300, width: 100, height: 20 });
    standAt(screen.getByTestId('cash'), { left: 10, top: 40, width: 120, height: 50 });
    await waitFor(() => expect(coins()).toHaveLength(3));
    rerender(page(false));
    expect(coins()).toHaveLength(0);
  });

  it('draw nothing at all when what flew them goes while their places are being measured: no flight is added to be taken away', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const services = speaking(memoryServices(), 'en');
    const layerDrawn: Renders = { count: 0 };
    const page = (flying: boolean) => (
      <GameProvider services={services}>
        <CoinTargets>
          <Spot name="paid" id="paid-1" />
          <Spot name="cash" id="cash" />
          {flying ? <FlyingCoins from="paid" to="cash" startMs={10} /> : null}
          <Counted into={layerDrawn}>
            <CoinFlights />
          </Counted>
        </CoinTargets>
      </GameProvider>
    );
    const { rerender } = render(page(true));
    // The game's settings are read: the flight waits for nothing else.
    await act(async () => undefined);
    // The flight takes off: its places are asked where they stand, and the phone answers a moment later.
    await act(async () => vi.advanceTimersByTime(10));
    // Gone before the answer.
    rerender(page(false));
    const before = layerDrawn.count;
    await act(async () => vi.advanceTimersByTime(50));
    expect(coins()).toHaveLength(0);
    expect(layerDrawn.count).toBe(before);
    expect(heard).toEqual([]);
  });

  it('draw nothing of the page again: a flight is the layer\'s, and nothing that names a place is told of it', async () => {
    const page: Renders = { count: 0 };
    renderGame(
      <CoinTargets>
        <Counted into={page}>
          <Spot name="paid" id="paid-1" />
          <Spot name="paid" id="paid-2" />
          <Spot name="cash" id="cash" />
        </Counted>
        <FlyingCoins from="paid" to="cash" startMs={0} />
        <CoinFlights />
      </CoinTargets>,
      memoryServices(),
    );
    placeThePage();
    await act(async () => undefined);
    const before = page.count;
    await waitFor(() => expect(coins()).toHaveLength(6));
    expect(page.count).toBe(before);
  });
});

describe('where the coins land', () => {
  it('is the cash of the HUD: the figure that is the player\'s cash says it is where money is kept', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(
      <CoinTargets>
        <Playing>
          <StickyScreen header={<Hud part="header" />} fixed={<CoinFlights />}>
            <Spot name="paid" id="paid-1" />
          </StickyScreen>
          <FlyingCoins from="paid" to="cash" startMs={50} />
        </Playing>
      </CoinTargets>,
      services,
    );
    const cash = (await screen.findByRole('button', { name: /Cash/ })).closest('[data-testid="stat"]') as HTMLElement;
    standAt(cash, { left: 12, top: 100, width: 120, height: 48 });
    standAt(screen.getByTestId('paid-1'), { left: 100, top: 400, width: 80, height: 20 });
    await waitFor(() => expect(coins()).toHaveLength(3));
    // From the line's middle (140, 410) to the cash's (72, 124).
    expect(placed()[0]).toMatchObject({ left: '128px', top: '398px' });
    expect(rea.assigned.length).toBeGreaterThan(0);
  });

  it('is over everything on the play screen, the HUD that sticks too: the layer is the screen\'s own, drawn after the page that scrolls', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('button', { name: /Cash/ });
    const over = layer();
    const cash = screen.getByRole('button', { name: /Cash/ });
    // A sibling of what holds the page (the scroll, the sticky HUD in it, the bar at its foot), and after it: drawn over all of it.
    const screenBox = over.parentElement as HTMLElement;
    const page = [...screenBox.children].find((child) => child.contains(cash)) as HTMLElement;
    expect(page).toBeTruthy();
    expect(page.contains(over)).toBe(false);
    const order = [...screenBox.children];
    expect(order.indexOf(over)).toBeGreaterThan(order.indexOf(page));
    expect(over.style.position).toBe('absolute');
    // Over the whole of the screen's box, not the column.
    expect([over.style.top, over.style.left, over.style.right, over.style.bottom]).toEqual(['0px', '0px', '0px', '0px']);
  });
});
