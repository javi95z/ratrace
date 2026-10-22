// @vitest-environment jsdom
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { runScene, sceneStore } from '@ratrace/core/testing/scenes';
import { cleanup, screen, within } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '@/game/context';
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

beforeEach(() => setWidth('phone'));
afterEach(cleanup);

/** Takes a scene's steps on the game once it has opened, as the kit's scene page does. */
function Script({ name }: { name: string }) {
  const latest = useRef<(RoundState & RoundActions) | null>(null);
  const status = useGame((state) => {
    latest.current = state;
    return state.status;
  });
  const started = useRef(false);
  useEffect(() => {
    if (status === 'booting' || started.current) return;
    started.current = true;
    void runScene(name, { getState: () => latest.current as RoundState & RoundActions });
  }, [status, name]);
  return null;
}

// The engineer of the scenes, played by the saver, gets out of the rat race in her fifteenth round (round 14), which she lives at 50:
// the rules count her out at 50 (the badges' age, the score's rounds left). She is 52 once that round is played.
describe('the age a life left the rat race at', () => {
  it('is the same in the HUD and in the moment that tells it', async () => {
    renderGame(<><Script name="moment-escape" /><Play /></>, memoryServices(await sceneStore('moment-escape')));
    const moment = await screen.findByRole('dialog', { name: 'Out of the rat race!' }, { timeout: 10_000 });
    expect(within(moment).getByText(/^At 50, your income pays for your whole life/)).toBeTruthy();
    expect(screen.getAllByText('Escaped at 50').length).toBeGreaterThan(0);
    expect(screen.queryByText(/At 52, your income/)).toBeNull();
  }, 30_000);

  it('is the same everywhere on the end screen: what the life came to, its figures, its line and its tale', async () => {
    renderGame(<Play />, memoryServices(await sceneStore('end-escaped')));
    expect(await screen.findByRole('heading', { name: 'The end' }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText('You left the rat race at 50.')).toBeTruthy();
    const figure = screen.getByText('Out of the rat race at').parentElement!;
    expect(within(figure).getByText('50')).toBeTruthy();
    const line = screen.getAllByRole('listitem').find((item) => item.textContent?.endsWith('Out of the rat race'))!;
    expect(line.textContent).toBe('50Out of the rat race');
    expect(screen.getByText(/At 50 you left the rat race: your income paid for your life without you\./)).toBeTruthy();
    expect(screen.queryByText(/At 52 you left the rat race/)).toBeNull();
  }, 30_000);
});
