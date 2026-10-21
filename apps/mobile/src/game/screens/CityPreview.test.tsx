// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import { quoteMove } from '@ratrace/engine';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { useGame } from '../context';
import { CityPreview } from './Finance';

afterEach(cleanup);

/** The texts in `container` whose words are these (each a whole text: its runs by font inside it). */
const texts = (container: HTMLElement, words: string) => [...container.querySelectorAll<HTMLElement>('[dir="auto"]')].filter((line) => line.textContent === words);

/** The city's sheet, for the life on the device, once the game is open on it. */
function London({ onClose }: { onClose(): void }) {
  const view = useGame((s) => s.view);
  return view ? <CityPreview cityId="london" view={view} onClose={onClose} /> : null;
}

describe('a city a card offers to move to', () => {
  it('compares it with the city lived in, and orders nothing: the card says what the move costs', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    const quote = quoteMove(content, session.view(), 'london');
    renderGame(<CityPreview cityId="london" view={session.view()} onClose={() => {}} />, services);
    const sheet = (await screen.findByRole('heading', { name: 'London' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(texts(sheet, 'Left over a year')).toHaveLength(1);
    // Its year beside the one lived, the same comparison as in the finances.
    expect(sheet.textContent).toContain(`${formatFor('en').compact(quote.here.leftAnnual)}→${formatFor('en').compact(quote.there.leftAnnual)}`);
    expect(within(sheet).getByRole('region', { name: 'London' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Move here' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: /All cities/ })).toBeNull();
    // Nor what the move costs: the card says that.
    expect(sheet.textContent).not.toMatch(/Moving costs/);
  });

  it('closes when asked, having ordered nothing', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const onClose = vi.fn();
    renderGame(<London onClose={onClose} />, services);
    expect(await screen.findByRole('heading', { name: 'London' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('is nothing for a city the game does not know', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<CityPreview cityId="atlantis" view={session.view()} onClose={() => {}} />, services);
    await waitFor(() => expect(screen.queryByRole('heading')).toBeNull());
  });
});
