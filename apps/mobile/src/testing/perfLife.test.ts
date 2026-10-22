import { rarityOf } from '@ratrace/content';
import { bots, content } from '@ratrace/content';
import { expect, test, vi } from 'vitest';

// The fixture's module also writes the life where the phone keeps it (the device's database, not loaded here): only the life is played.
vi.mock('../kvStore', () => ({ KvStore: class {} }));

const { EARLY_ESCAPE, earlyEscape } = await import('./perfLife');

test('the early escape is a life whose next round leaves the rat race and earns a legendary badge: two sheets at once', async () => {
  const { session } = await earlyEscape();
  expect(session.view()).toMatchObject({ round: EARLY_ESCAPE.round, phase: 'finance', finished: false });
  expect(session.view().player.escapedAtRound).toBeNull();
  const saver = bots.find((bot) => bot.id === EARLY_ESCAPE.bot)!;
  const played = await session.playRound({ orders: saver.orders(content, session.view()) });
  expect(played.events.some((event) => event.kind === 'escaped')).toBe(true);
  expect(played.earned.filter((id) => rarityOf(id) === 'legendary')).toEqual(['escaped_before_40']);
}, 60_000);
