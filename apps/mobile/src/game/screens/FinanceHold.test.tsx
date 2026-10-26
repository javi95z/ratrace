// @vitest-environment jsdom
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import type { GameSession } from '@ratrace/core/session/types';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import type { HoldAction } from '../../ui/holdMenu';
import { useGame } from '../context';
import { Play } from './Play';

/*
 * What a long press on a holding or a home offers, on the phone (`ui/holdMenu.tsx`, its sheet and its long press held in its own test): here the menus
 * each thing asks for, by its name, and what each choice does.
 */

const menus = vi.hoisted(() => new Map<string, readonly HoldAction[]>());
vi.mock('../../ui/holdMenu', () => ({
  HOLD_MS: 400,
  useHoldMenu: ({ title, actions }: { title: string; actions: readonly HoldAction[] }) => {
    menus.set(title, actions);
    return { held: {}, menu: null };
  },
}));

beforeEach(() => menus.clear());
afterEach(cleanup);

const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}
async function toFinance(session: GameSession) {
  while (session.view().phase === 'cards') await session.answerCard(0);
}
const labels = (title: string) => (menus.get(title) ?? []).map((action) => action.label);

it('offers a holding\'s buying more, its sale, and its sale whole: an order in the basket as any other', async () => {
  const services = memoryServices();
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start('heir');
  await toFinance(session);
  await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }] });
  await toFinance(session);
  const worth = session.view().player.positions.sp500.value;
  renderGame(
    <>
      <Play />
      <Probe />
    </>,
    services,
  );
  fireEvent.click(await screen.findByRole('tab', { name: 'Portfolio' }));
  await waitFor(() => expect(labels('S&P 500')).toEqual(['Buy more', 'Sell', 'Sell it all']));
  act(() => menus.get('S&P 500')!.find((action) => action.label === 'Sell it all')!.onPress());
  expect(probe.state!.orders).toEqual([{ type: 'sell', assetId: 'sp500', amount: worth }]);
});

it('offers no menu where nothing is held', async () => {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  await toFinance(session);
  renderGame(<Play />, services);
  fireEvent.click(await screen.findByRole('tab', { name: 'Portfolio' }));
  await screen.findByText('Your investments'.toUpperCase());
  expect([...menus.keys()]).toEqual([]);
});
