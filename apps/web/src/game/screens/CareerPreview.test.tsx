// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '@/testing/render';
import { CareerPreview } from './CareerPreview';

afterEach(cleanup);

describe('a career a card offers', () => {
  it('shows every rung with its pay, the rung the player would start on, and what they leave behind', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    const law = content.careers.find((career) => career.id === 'law')!;
    renderGame(<CareerPreview careerId="law" startLevel={0} shown={session.view()} onClose={() => {}} />, services);
    const sheet = await screen.findByRole('dialog', { name: 'Law' });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(law.levels.length);
    expect(within(sheet).getByText('You start here')).toBeTruthy();
    expect(within(sheet).getByText(/^You start as .*, on .*\/yr\. At the very top, .*: .*\/yr\.$/)).toBeTruthy();
    expect(within(sheet).getByText(/you would leave that job and start again from no experience/)).toBeTruthy();
  });
});
