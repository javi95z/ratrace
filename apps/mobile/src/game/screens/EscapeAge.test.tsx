// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SceneView } from '../../testing/scene';

/*
 * The web's EscapeAge.test.tsx on the phone, on the scenes themselves (the route the shots draw). The engineer of the scenes, played by the saver,
 * gets out of the rat race in her fifteenth round (round 14), which she lives at 50: the rules count her out at 50 (the badges' age, the score's
 * rounds left). She is 52 once that round is played.
 */

afterEach(cleanup);

/** A scene's store is built and its steps are taken on a machine that may be busy. */
const WAIT = { timeout: 15_000 };

describe('the age a life left the rat race at', () => {
  it('is the same in the HUD and in the moment that tells it', async () => {
    render(<SceneView name="moment-escape" />);
    const title = await screen.findByRole('heading', { name: 'Out of the rat race!' }, WAIT);
    const moment = title.closest('[aria-modal="true"]') as HTMLElement;
    expect(within(moment).getByText(/^At 50, your income pays for your whole life/)).toBeTruthy();
    expect(screen.getAllByText('Escaped at 50').length).toBeGreaterThan(0);
    expect(screen.queryByText(/At 52, your income/)).toBeNull();
  }, 30_000);

  it('is the same everywhere on the end screen: what the life came to, its figures, its line and its tale', async () => {
    render(<SceneView name="end-escaped" />);
    expect(await screen.findByRole('heading', { name: 'The end' }, WAIT)).toBeTruthy();
    expect(screen.getByText('You left the rat race at 50.')).toBeTruthy();
    // The figure's box: the first one up from its label that holds more than the label (its value, above it).
    let figure = await screen.findByText('Out of the rat race at', {}, WAIT);
    while (figure.textContent === 'Out of the rat race at') figure = figure.parentElement!;
    expect(figure.textContent).toBe('50Out of the rat race at');
    const line = (await screen.findAllByRole('listitem', {}, WAIT)).find((item) => item.textContent?.endsWith('Out of the rat race'))!;
    expect(line.textContent).toBe('50Out of the rat race');
    expect(screen.getByText(/At 50 you left the rat race: your income paid for your life without you\./)).toBeTruthy();
    expect(screen.queryByText(/At 52 you left the rat race/)).toBeNull();
  }, 30_000);
});
