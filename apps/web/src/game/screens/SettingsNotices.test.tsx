// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Community } from '@ratrace/online/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Preferences } from './Settings';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string; style?: CSSProperties }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

// A browser that can be told, and is: the notices are turned on, and each has a switch of its own.
vi.mock('@/pwa/notifications', () => ({
  canNotify: () => true,
  currentSubscription: async () => ({ endpoint: 'https://push.example/1' }),
  subscribe: async () => ({ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }),
  unsubscribe: async () => 'https://push.example/1',
}));

afterEach(cleanup);

function community(over: Partial<Community> = {}) {
  const asked: string[] = [];
  const all = {
    me: async () => null,
    notifyMe: async () => true,
    stopNotifying: async () => true,
    marketNotice: async (endpoint: string) => (asked.push(`read ${endpoint}`), true),
    setMarketNotice: async (endpoint: string, on: boolean) => (asked.push(`set ${endpoint} ${on}`), true),
    ...over,
  } as unknown as Community;
  return { all, asked };
}

describe('the notices in Settings', () => {
  it.each([
    ['en', 'Tell me when my market moves'],
    ['es', 'Avisarme si se mueve mi mercado'],
    ['ru', 'Сообщать, если мой рынок сдвинулся'],
  ] as const)('lets the player turn off the market notice on its own, in %s', { timeout: 20_000 }, async (locale, label) => {
    setWidth('phone');
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), community: () => all }, locale);
    const toggle = await screen.findByRole('switch', { name: new RegExp(label) });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await userEvent.setup().click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(asked).toEqual(['read https://push.example/1', 'set https://push.example/1 false']);
  });

  it('keeps the switch where it was if the change could not be kept, and shows none until the server says', async () => {
    setWidth('phone');
    const failing = community({ setMarketNotice: async () => false });
    renderGame(<Preferences />, { ...memoryServices(), community: () => failing.all }, 'en');
    const toggle = await screen.findByRole('switch', { name: /Tell me when my market moves/ });
    await userEvent.setup().click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    cleanup();
    const unknown = community({ marketNotice: async () => null });
    renderGame(<Preferences />, { ...memoryServices(), community: () => unknown.all }, 'en');
    await screen.findByRole('switch', { name: /Turn on notifications/ });
    expect(screen.queryByRole('switch', { name: /Tell me when my market moves/ })).toBeNull();
  });
});
