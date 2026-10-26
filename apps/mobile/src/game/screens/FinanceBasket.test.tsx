// @vitest-environment jsdom
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import type { GameSession } from '@ratrace/core/session/types';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { gestures } from '../../ui/testing/gestures';
import { useGame } from '../context';
import { BasketList } from './Finance';

/*
 * The round's orders, on the phone, swiped to the left to take one out (`ui/SwipeAway.tsx`, its gesture held in its own test): the order swiped is
 * the one taken out, whatever its place, the others keep their rows, and it can be put back as with its button.
 */

afterEach(cleanup);

const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}

async function toFinance(session: GameSession) {
  while (session.view().phase === 'cards') await session.answerCard(0);
}

type Pan = { activeOffsetX?: number[]; onActivate?: () => void; onUpdate?: (event: object) => void; onDeactivate?: (event: object) => void };
/** The rows' pans as they were last drawn, in the list's order. */
const rowPans = (rows: number) => (gestures.pans.slice(-rows) as unknown as Pan[]);
/** A flick to the left of the pan given, as the handler sends it. */
function flick(pan: Pan) {
  act(() => {
    pan.onActivate?.();
    pan.onUpdate?.({ translationX: -40, velocityX: -1500 });
  });
  act(() => pan.onDeactivate?.({ translationX: -40, velocityX: -1500 }));
}

it('takes out the order swiped, the others keeping their rows, and offers to undo it', async () => {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  await toFinance(session);
  renderGame(
    <>
      <BasketList />
      <Probe />
    </>,
    services,
  );
  await waitFor(() => expect(probe.state?.view).toBeTruthy());
  act(() => {
    probe.state!.addOrder({ type: 'buy', assetId: 'sp500', amount: 100_000 });
    probe.state!.addOrder({ type: 'buy', assetId: 'msci_world', amount: 100_000 });
  });
  const names = () => screen.queryAllByRole('button', { name: /^Remove: / }).map((one) => one.getAttribute('aria-label'));
  expect(names()).toEqual(['Remove: Buy S&P 500 · $1,000', 'Remove: Buy MSCI World · $1,000']);
  gestures.pans.length = 0;
  act(() => probe.state!.setOrder(() => false, null));
  const [first] = rowPans(2);
  expect(first.activeOffsetX).toEqual([-14, 14]);
  flick(first);
  await waitFor(() => expect(names()).toEqual(['Remove: Buy MSCI World · $1,000']));
  expect(probe.state!.orders).toEqual([{ type: 'buy', assetId: 'msci_world', amount: 100_000 }]);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
});
