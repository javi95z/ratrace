// @vitest-environment jsdom
import { content } from '@ratrace/content';
import type { GameView } from '@ratrace/engine';
import type { GameSession } from '@ratrace/core/session/types';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HudScene } from '../../testing/hudScene';
import { memoryServices, renderGame } from '../../testing/render';
import { JailSheet } from './Jail';

afterEach(cleanup);

/** A nurse with rounds left to serve: the game on the device, its view telling of the sentence (as the web's test has it). */
async function inside(rounds: number) {
  const services = memoryServices();
  const real = await services.sessions.start('nurse');
  const view = (): GameView => {
    const now = real.view();
    return { ...now, player: { ...now.player, life: { ...now.player.life, jailRounds: rounds } } };
  };
  const session: GameSession = { gameId: real.gameId, lifeId: real.lifeId, view, history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices) };
  services.sessions.resume = async () => ({ lost: null, session });
  renderGame(<HudScene />, services);
  await screen.findByText('Age 22');
}

const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

describe('prison', () => {
  it('is explained from the tag that says the player is inside, with the rounds left', async () => {
    await inside(2);
    fireEvent.click(screen.getByRole('button', { name: /^In prison/ }));
    const sheet = sheetTitled('Prison');
    expect(within(sheet).getByText('2 rounds left to serve')).toBeTruthy();
    expect(within(sheet).getByText('While inside:')).toBeTruthy();
    for (const line of ['No salary.', 'Your career stands still.', 'Only prison cards come up.']) expect(within(sheet).getByText(line)).toBeTruthy();
    expect(within(sheet).getByText(`Going in costs ${content.life.jail.statusLost} status.`)).toBeTruthy();
    expect(within(sheet).getByText(new RegExp(`^Coming out, you drop ${content.life.jail.rungsLost} rung`))).toBeTruthy();
    // The prison, drawn.
    expect(sheet.querySelector('[data-sprite="card.crime_jail_cellmate"]')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Prison' })).toBeNull());
  });

  it('is not said of someone who is not inside', async () => {
    await inside(0);
    expect(screen.queryByRole('button', { name: /^In prison/ })).toBeNull();
  });

  it('asked from elsewhere (beside a card whose choices may end in it), says nothing of rounds left', async () => {
    renderGame(<JailSheet open onClose={() => {}} />, memoryServices());
    const sheet = (await screen.findByRole('heading', { name: 'Prison' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByText('Only prison cards come up.')).toBeTruthy();
    expect(within(sheet).queryByText(/left to serve/)).toBeNull();
  });
});
