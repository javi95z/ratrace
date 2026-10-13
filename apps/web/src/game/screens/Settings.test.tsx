// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, locale, ...rest }: { href: string; children: ReactNode; className?: string; locale?: string; 'aria-current'?: 'true' }) => (
    <a href={locale ? `/${locale}${href}` : href} className={className} aria-current={rest['aria-current']}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/play',
}));

beforeEach(() => setWidth('phone'));
afterEach(cleanup);

async function open() {
  const services = memoryServices();
  await services.sessions.start('nurse');
  const user = userEvent.setup();
  renderGame(<Play />, services);
  await screen.findByRole('heading', { name: 'News' });
  const gear = screen.getByRole('button', { name: 'Open settings' });
  await user.click(gear);
  return { services, user, gear, sheet: screen.getByRole('dialog', { name: 'Settings' }) };
}

describe('the settings of a life in progress', () => {
  it('say where the game stands: who, how far along, what it is worth, and that it is saved', async () => {
    const { sheet } = await open();
    const game = within(sheet).getByRole('region', { name: 'Your game' });
    expect(within(game).getByText('Nurse')).toBeTruthy();
    expect(within(game).getByText(/Age 22 · Madrid · Nurse/)).toBeTruthy();
    expect(within(game).getByText('Round 1 of 20')).toBeTruthy();
    expect(within(game).getByText('40 years left')).toBeTruthy();
    expect(within(game).getByRole('progressbar', { name: 'How far along your life is' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(game).getByText('Net worth')).toBeTruthy();
    expect(within(game).getByText('Score')).toBeTruthy();
    expect(within(game).getByText('Saved on this device after every step')).toBeTruthy();
  });

  it('say so when the device is not saving', async () => {
    const services = memoryServices(undefined, { savingOff: true });
    await services.sessions.start('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const sheet = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(sheet).queryByText(/Saved on this device/)).toBeNull();
    expect(within(sheet).getByRole('alert').textContent).toMatch(/not saving/);
  });

  it('change what can be set, and keep it', async () => {
    const { services, user, sheet } = await open();
    const motion = within(sheet).getByRole('switch', { name: /Reduce motion/ });
    const tips = within(sheet).getByRole('switch', { name: /Tips from the guide/ });
    expect(motion.getAttribute('aria-checked')).toBe('false');
    expect(tips.getAttribute('aria-checked')).toBe('true');

    await user.click(motion);
    await user.click(tips);
    expect(motion.getAttribute('aria-checked')).toBe('true');
    expect(tips.getAttribute('aria-checked')).toBe('false');
    await waitFor(async () => {
      const profile = await services.store.loadProfile();
      expect(profile.settings.reducedMotion).toBe(true);
      expect(profile.guide.off).toBe(true);
    });

    // The guide can be had back: it is not gone for good.
    await user.click(tips);
    await waitFor(async () => expect((await services.store.loadProfile()).guide.off).toBe(false));

    const languages = within(within(sheet).getByRole('group', { name: 'Language' })).getAllByRole('link');
    expect(languages.map((link) => [link.textContent, link.getAttribute('href'), link.getAttribute('aria-current')])).toEqual([
      ['English', '/en/play', 'true'],
      ['Español', '/es/play', null],
    ]);
  });

  it('lead back to the front door, and close without leaving', async () => {
    const { user, gear, sheet } = await open();
    expect(within(sheet).getByRole('link', { name: /Back to the home screen/ }).getAttribute('href')).toBe('/');
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(gear);
    expect(router.push).not.toHaveBeenCalled();
  });
});
