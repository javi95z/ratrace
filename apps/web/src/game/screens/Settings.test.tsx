// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import { RankedSessions } from '@/session/ranked';
import { GameSessions } from '@/session/sessions';
import { rankedServer } from '@/testing/rankedServer';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, locale, ...rest }: { href: string; children: ReactNode; className?: string; locale?: string; 'aria-current'?: 'true'; lang?: string; style?: CSSProperties }) => (
    <a href={locale ? `/${locale}${href}` : href} className={className} aria-current={rest['aria-current']} lang={rest.lang} style={rest.style}>
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

/** The sessions of a device that has a server of ranked lives to ask. */
function withRanked() {
  const server = rankedServer();
  const store = new MemoryStore();
  let ids = 0;
  let clock = 0;
  const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
  const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
  const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => server.api, store, content, lives, versions, deps), versions);
  return { sessions, store, tapGuardMs: 0 };
}

describe('the settings of a life in progress', () => {
  it('say which kind of life is being lived: a ranked one, or the player\'s own game', async () => {
    for (const [ranked, said, unsaid] of [[true, 'Ranked life', 'Your game'], [false, 'Your game', 'Ranked life']] as const) {
      const services = withRanked();
      await services.sessions.start('nurse', { ranked });
      const user = userEvent.setup();
      renderGame(<Play />, services);
      await screen.findByRole('heading', { name: 'News' });
      await user.click(screen.getByRole('button', { name: 'Open settings' }));
      const sheet = screen.getByRole('dialog', { name: 'Settings' });
      expect(within(sheet).getByText(said), said).toBeTruthy();
      expect(within(sheet).queryByText(unsaid), said).toBeNull();
      cleanup();
    }
  });

  it('say where the game stands: who, how far along, and what it is worth', async () => {
    const { sheet } = await open();
    const game = within(sheet).getByRole('region', { name: 'Your game' });
    expect(within(game).getByText('Nurse')).toBeTruthy();
    expect(within(game).getByText(/Age 22 · Madrid/)).toBeTruthy();
    expect(within(game).getByText('Round 1 of 20')).toBeTruthy();
    expect(within(game).getByText('40 years left')).toBeTruthy();
    expect(within(game).getByRole('progressbar', { name: 'How far along your life is' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(game).getByText(/ pts$/)).toBeTruthy();
    // Saving that works says nothing.
    expect(within(game).queryByRole('alert')).toBeNull();
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
      ['Русский', '/ru/play', null],
    ]);
    // Each name is written in its own language, and says so to whoever reads the page aloud.
    expect(languages.map((link) => link.getAttribute('lang'))).toEqual(['en', 'es', 'ru']);
    // The two typefaces of the game draw no Cyrillic, and on this English page what stands in for them while they
    // load would draw «Русский» in a system face among pixel labels. That one name asks for the Cyrillic pixel face itself.
    expect(languages.map((link) => link.style.fontFamily)).toEqual(['', '', 'var(--font-pixel-cyrillic-alone), var(--font-pixel)']);
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
