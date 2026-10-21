// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { useGame } from '../context';
import { CityPreview } from './PlayStandIns';

afterEach(cleanup);

/** The city's sheet, for the life on the device, once the game is open on it. */
function London({ onClose }: { onClose(): void }) {
  const view = useGame((s) => s.view);
  return view ? <CityPreview cityId="london" view={view} onClose={onClose} /> : null;
}

/*
 * The stand-ins of Play's parts that later tasks bring are all in one file, so each task deletes its own. What they must do meanwhile: keep a life
 * playable, and never leave a button that does nothing.
 */
describe('the city a card offers, until Task 14 brings its comparison', () => {
  it('opens a sheet named for the city, which closes', async () => {
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
    await services.sessions.start('nurse');
    renderGame(<CityPreview cityId="atlantis" view={(await services.sessions.resume()).session!.view()} onClose={() => {}} />, services);
    await waitFor(() => expect(screen.queryByRole('heading')).toBeNull());
  });
});
