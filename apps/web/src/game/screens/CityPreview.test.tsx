// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '@/testing/render';
import { CityPreview } from './Finance';

afterEach(cleanup);

describe('a city a card offers to move to', () => {
  it('compares it with the city lived in, and orders nothing: the card says what the move costs', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<CityPreview cityId="london" view={session.view()} onClose={() => {}} />, services);
    const sheet = await screen.findByRole('dialog', { name: 'London' });
    expect(within(sheet).getByText('Left over a year')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Move here' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: '← All cities' })).toBeNull();
  });
});
