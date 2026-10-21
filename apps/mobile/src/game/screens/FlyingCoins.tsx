import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFly } from '../../ui/animations';
import { useSound, useStill } from '../context';
import { Loop } from './Loop';

/** Coins flown from each line, and in all: a handful says "money came in" without burying the screen. */
const PER_SOURCE = 3;
const MAX_COINS = 12;
const STAGGER_MS = 90;
const FLIGHT_MS = 700;
/** A coin is drawn 24 points square, centred on where it is (the web's `size-6 -ml-3 -mt-3`). */
const COIN = 24;

/** Something on the screen a coin can fly from or to: a view, asked where it stands on the screen when the flight begins. */
export interface CoinPlace {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

/** A box on the screen, in points from its top left. */
export type Box = { x: number; y: number; w: number; h: number };

/** One coin of a flight: where it starts (its middle, in the layer it is drawn in), how far it goes, and how long it waits. */
export interface Coin {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
}

/**
 * The coins of one flight, as the web works them out: from the middle of each place money came in, `PER_SOURCE` each and `MAX_COINS` in all,
 * one after another `STAGGER_MS` apart, to the middle of where it lands. The places are taken in the order they are read on the page (the web's
 * is the order of the page's elements: top to bottom), and everything is placed in the layer the coins are drawn in, whose top left is `origin`.
 */
export function coinsFor(sources: readonly Box[], target: Box, origin: { x: number; y: number }): Coin[] {
  const tx = target.x + target.w / 2 - origin.x;
  const ty = target.y + target.h / 2 - origin.y;
  const flown: Coin[] = [];
  const read = [...sources].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const from of read) {
    const x = from.x + from.w / 2 - origin.x;
    const y = from.y + from.h / 2 - origin.y;
    for (let i = 0; i < PER_SOURCE && flown.length < MAX_COINS; i++) flown.push({ x, y, dx: tx - x, dy: ty - y, delay: flown.length * STAGGER_MS });
  }
  return flown;
}

/** Where a place stands on the screen now. */
const measured = (place: CoinPlace): Promise<Box> =>
  new Promise((done) => {
    place.measureInWindow((x, y, w, h) => done({ x, y, w, h }));
  });

type Flight = { id: number; coins: Coin[] };

/**
 * The places of a page, by name, and the flights over it: kept outside React, so that putting a place on the list draws nothing, and a flight draws the
 * layer of coins alone. A name can have several places (each line of a ledger that paid); a flight lands on the first place of its name.
 */
function coinStore() {
  const places = new Map<string, Set<CoinPlace>>();
  let layer: CoinPlace | null = null;
  let flights: readonly Flight[] = [];
  let last = 0;
  const watchers = new Set<() => void>();
  const tell = () => watchers.forEach((watcher) => watcher());
  return {
    add(name: string, place: CoinPlace): () => void {
      const named = places.get(name) ?? new Set<CoinPlace>();
      named.add(place);
      places.set(name, named);
      return () => void named.delete(place);
    },
    setLayer(place: CoinPlace | null): void {
      layer = place;
    },
    /** Measures the flight's places where they stand now, and puts its coins in the layer: its number, or null where nothing flies. */
    async fly(from: string, to: string): Promise<number | null> {
      const goal = [...(places.get(to) ?? [])][0];
      const sources = [...(places.get(from) ?? [])];
      const over = layer;
      if (over === null || goal === undefined || sources.length === 0) return null;
      const [origin, target, ...boxes] = await Promise.all([over, goal, ...sources].map(measured));
      const coins = coinsFor(boxes, target, origin);
      if (coins.length === 0) return null;
      last += 1;
      flights = [...flights, { id: last, coins }];
      tell();
      return last;
    },
    land(id: number): void {
      if (!flights.some((flight) => flight.id === id)) return;
      flights = flights.filter((flight) => flight.id !== id);
      tell();
    },
    flights: () => flights,
    subscribe(watcher: () => void): () => void {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
  };
}
type CoinStore = ReturnType<typeof coinStore>;

const Coins = createContext<CoinStore | null>(null);

/**
 * The page coins fly over (the web's `[data-coin-from]` and `[data-coin-to]`, and the HUD's `[data-hud-cash]`): the places money comes in and is
 * kept put themselves on its list by name (`useCoinTarget`), and a flight (`FlyingCoins`) measures them where they stand when it begins. The coins
 * are drawn in its layer (`CoinFlights`), over the page. Play is one: the HUD's cash is `cash`, a card's result and the ledger name their lines.
 */
export function CoinTargets({ children }: { children: ReactNode }) {
  const [store] = useState(coinStore);
  return <Coins.Provider value={store}>{children}</Coins.Provider>;
}

/**
 * Puts a view on the page's list of places coins fly from or to, by `name`, for as long as it is on screen: its `ref`. Outside a page coins fly
 * over (the HUD on a page of its own), it does nothing.
 */
export function useCoinTarget(name: string): (place: CoinPlace | null) => (() => void) | undefined {
  const store = useContext(Coins);
  return useCallback((place: CoinPlace | null) => (store !== null && place !== null ? store.add(name, place) : undefined), [store, name]);
}

const noFlights = (): readonly Flight[] => [];
const noWatching = () => () => undefined;

/** One coin, turning as it flies its arc, on the phone's animation thread: React draws it once, when it takes off. */
function FlyingCoin({ coin }: { coin: Coin }) {
  const fly = useFly({ dx: coin.dx, dy: coin.dy, delayMs: coin.delay });
  return (
    <Animated.View style={[{ position: 'absolute', left: coin.x - COIN / 2, top: coin.y - COIN / 2, width: COIN, height: COIN }, fly]}>
      <Loop name="coin" ms={90} size={{ w: COIN, h: COIN }} />
    </Animated.View>
  );
}

/**
 * The layer the coins of a page are drawn in: over the whole screen, taking no touch and saying nothing to a screen reader (the web's
 * `fixed inset-0 z-50`). Play gives it as its screen's `fixed`, which is drawn after the page that scrolls, so the coins pass over the HUD
 * that sticks, and under a sheet and the top inset, as on the web. Drawn again only when a flight takes off or lands.
 */
export function CoinFlights() {
  const store = useContext(Coins);
  const own = useCallback((place: CoinPlace | null) => store?.setLayer(place), [store]);
  const flights = useSyncExternalStore(store?.subscribe ?? noWatching, store?.flights ?? noFlights, store?.flights ?? noFlights);
  return (
    <View
      ref={own}
      testID="coin-layer"
      collapsable={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}
    >
      {flights.flatMap((flight) => flight.coins.map((coin, i) => <FlyingCoin key={`${flight.id}-${i}`} coin={coin} />))}
    </View>
  );
}

/**
 * Coins that fly, once, from every place named `from` to the place named `to`, after `startMs`: money that came in going where it is kept (the
 * cash in the HUD, from a card that paid; the total of the ledger, from its lines that paid on their own). The places are measured when the flight
 * begins, so they are where the lines have settled. Decoration only; nothing at all where motion is left out, or outside a page coins fly over.
 */
export function FlyingCoins({ from, to, startMs }: { from: string; to: string; startMs: number }) {
  const still = useStill();
  const sound = useSound();
  const store = useContext(Coins);
  useEffect(() => {
    if (still || store === null) return;
    let gone = false;
    let flight: number | null = null;
    const take = setTimeout(() => {
      void store.fly(from, to).then((id) => {
        if (id === null) return;
        // Measured after the page it flew over had gone: it lands at once.
        if (gone) return store.land(id);
        flight = id;
        sound('coin');
      });
    }, startMs);
    // Gone once the last has landed, so nothing is left in the page.
    const clear = setTimeout(() => {
      if (flight !== null) store.land(flight);
      flight = null;
    }, startMs + MAX_COINS * STAGGER_MS + FLIGHT_MS + 200);
    return () => {
      gone = true;
      clearTimeout(take);
      clearTimeout(clear);
      if (flight !== null) store.land(flight);
    };
    // Once for the step on screen: the places and the start do not change while it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, store]);
  return null;
}
