// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/play',
}));

beforeEach(() => setWidth('phone'));
afterEach(cleanup);

async function open(locale: 'en' | 'es' = 'en') {
  const services = memoryServices();
  await services.sessions.start('nurse');
  const user = userEvent.setup();
  renderGame(<Play />, services, locale);
  await screen.findByRole('heading', { name: locale === 'en' ? 'News' : 'Noticias' });
  return user;
}

describe('the figures of the HUD', () => {
  it('open a sheet of what they mean and what they are made of, over a dimmed page', async () => {
    const user = await open();
    const cash = screen.getByRole('button', { name: /Cash/ });
    expect(cash.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(cash);
    const about = screen.getByRole('dialog', { name: 'Cash' });
    expect(about.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('[data-sheet-backdrop]')).toBeTruthy();
    expect(within(about).getByText(/The money you have on hand/)).toBeTruthy();
    expect(within(about).getByText('Net worth')).toBeTruthy();

    await user.click(within(about).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Flow/ }));
    const lines = screen.getByRole('dialog', { name: 'Flow' });
    expect(within(lines).getByText('Salary')).toBeTruthy();
    expect(within(lines).getByText('Living costs')).toBeTruthy();
    // A nurse starts with no debt and nothing invested: lines that would only say zero are left out.
    expect(within(lines).queryByText('Debts')).toBeNull();
    expect(within(lines).queryByText('Rent')).toBeNull();
  });

  it('show status by source, adding up to the figure, in the language in use', async () => {
    const user = await open('es');
    const status = screen.getByRole('button', { name: /Estatus/ });
    await user.click(status);
    const parts = screen.getByRole('dialog', { name: 'Estatus' });
    for (const label of ['Puesto', 'Casa', 'Ciudad', 'Estilo de vida', 'Cosas', 'Estatus ahora', 'Media de la vida']) expect(within(parts).getByText(label)).toBeTruthy();
    const figures = [...parts.querySelectorAll('div.pixel')].map((cell) => Number((cell.textContent ?? '').replace('+', '')));
    const [job, home, city, lifestyle, things, now] = figures;
    expect(job + home + city + lifestyle + things).toBe(now);
    expect(status.textContent).toContain(String(now));
  });

  it('say what status is for: the score as it stands today, and how much of it is money and how much status', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: /Status/ }));
    const score = within(screen.getByRole('dialog', { name: 'Status' })).getByRole('region', { name: 'Your score today' });
    const wealth = Number(within(score).getByText(/ for net worth$/).textContent?.split(' ')[0]);
    const status = Number(within(score).getByText(/ for status$/).textContent?.split(' ')[0]);
    // The two parts add up to the figure, which is the engine's own: nobody has got out of the rat race at twenty-two.
    expect(score.querySelector('.text-\\[22px\\]')?.textContent).toBe(String(wealth + status));
    expect(within(score).getByText(/^The score adds the points of your net worth to your average status\./)).toBeTruthy();
  });

  it('close on Escape, and hand the focus back to the figure that was tapped', async () => {
    const user = await open();
    const status = screen.getByRole('button', { name: /Status/ });
    await user.click(status);
    expect(screen.getByRole('dialog', { name: 'Status' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(status);
  });
});
