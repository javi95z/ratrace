// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

afterEach(cleanup);

/** The finances of the first round (a life whose cards are answered opens there) of a first life, guided, for a life that begins as given. */
async function firstFinances(lifeId: string) {
  setWidth('phone');
  const services = { ...memoryServices(), introduceTabs: true };
  const session = await services.sessions.start(lifeId);
  while (session.view().phase === 'cards') await session.answerCard(0);
  renderGame(<Play />, services);
  return screen.findAllByRole('tab');
}

describe('the tabs of a first life', () => {
  it('keep the debt tab for later for someone who owes nothing', async () => {
    const tabs = await firstFinances('nurse');
    expect(tabs.map((tab) => tab.textContent)).not.toContain('Debt');
  });

  it('show it from the first round to someone who already owes something', async () => {
    const tabs = await firstFinances('engineer');
    expect(tabs.map((tab) => tab.textContent)).toContain('Debt');
  });
});
