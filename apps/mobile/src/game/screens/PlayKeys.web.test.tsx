// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Unreachable } from '@ratrace/core/session/errors';
import type { GameSession } from '@ratrace/core/session/types';
import { memoryServices, renderGame } from '../../testing/render';
import { KeyboardControls } from '../KeyboardHelp';
import { Play } from './Play';

/*
 * A life played with the keyboard alone on the web (docs/keyboard.md): Ctrl/⌘ + Enter presses the stage's safe main action (never for a key held
 * down, never under a sheet), a digit answers a card with the choice it numbers (never a held one the next card too), the arrows move among the
 * choices, and `?` opens the reference of what applies here.
 */

afterEach(cleanup);

const key = (init: KeyboardEventInit, on: Element = document.activeElement ?? document.body) => act(() => void fireEvent.keyDown(on, init));
const stageName = () => screen.getByRole('main').getAttribute('aria-label');
/** Text drawn in runs of different faces (a key's ⌘ and ↵): found by the whole of an element's own words. */
const words = (text: string) => (_: string, element: Element | null) => element?.textContent === text && [...(element.children ?? [])].every((child) => child.textContent !== text);

async function playing() {
  const services = memoryServices();
  await services.sessions.start('nurse');
  renderGame(
    <>
      <KeyboardControls />
      <Play />
    </>,
    services,
  );
  await waitFor(() => expect(stageName()).toBe('News'));
}

describe('a life played with the keyboard', () => {
  it('leaves the news with Ctrl/⌘ + Enter, but not for a key held down, and not with Enter alone', async () => {
    await playing();
    await key({ key: 'Enter' });
    await key({ key: 'Enter', ctrlKey: true, repeat: true });
    expect(stageName()).toBe('News');
    // Whatever has the focus: the button itself, which keeps a plain Enter for itself.
    const button = document.querySelector<HTMLElement>('[data-primary-action]') as HTMLElement;
    act(() => button.focus());
    await key({ key: 'Enter', metaKey: true });
    await waitFor(() => expect(stageName()).not.toBe('News'));
  });

  it('answers a card with the digit of its choice, moves among the choices with the arrows, and never answers the next card with a held digit', async () => {
    await playing();
    await key({ key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(stageName()).toMatch(/^Card 1 of/));
    const choices = within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button');
    // Met with the keyboard, the card puts its first choice in focus.
    await waitFor(() => expect(document.activeElement).toBe(choices[0]));
    // The arrows: down to the second, End to the last, Home back to the first.
    await key({ key: 'ArrowDown' });
    expect(document.activeElement).toBe(choices[1]);
    await key({ key: 'End' });
    expect(document.activeElement).toBe(choices[choices.length - 1]);
    await key({ key: 'Home' });
    expect(document.activeElement).toBe(choices[0]);
    // A digit past the choices shown takes nothing; a held one nothing either.
    await key({ key: '9' });
    await key({ key: '1', repeat: true });
    expect(stageName()).toMatch(/^Card 1 of/);
    await key({ key: '1' });
    await waitFor(() => expect(stageName()).toBe('What happened'));
  });

  it('answers no card under a sheet that is open, with a digit or the arrows', async () => {
    await playing();
    await key({ key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(stageName()).toMatch(/^Card 1 of/));
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const sheet = await screen.findByRole('dialog', { name: 'Settings' });
    await waitFor(() => expect(document.activeElement).toBe(sheet.querySelector('[data-sheet-panel]')));
    await key({ key: '1' }, document.body);
    await key({ key: 'ArrowDown' }, document.body);
    expect(stageName()).toMatch(/^Card 1 of/);
    expect(sheet.contains(document.activeElement)).toBe(true);
  });

  it('presses nothing under a sheet that is open', async () => {
    await playing();
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    await key({ key: 'Enter', ctrlKey: true });
    expect(stageName()).toBe('News');
  });

  it('opens the reference with ?, saying what applies to the stage, and not over another sheet or from a field', async () => {
    await playing();
    await key({ key: '?' });
    const sheet = (await screen.findByRole('heading', { name: 'Keyboard controls' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByText(words('Ctrl/⌘ + Enter'))).toBeTruthy();
    expect(within(sheet).queryByText(words('↑ / ↓ · 1–4'))).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Keyboard controls' })).toBeNull());
    // On a card, the card's keys.
    await key({ key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(stageName()).toMatch(/^Card 1 of/));
    await key({ key: '?' });
    expect(within((await screen.findByRole('heading', { name: 'Keyboard controls' })).closest('[aria-modal="true"]') as HTMLElement).getByText(words('↑ / ↓ · 1–4'))).toBeTruthy();
  });

  it('shows a shortcut\'s badge only once the player uses a keyboard, and hides it at a pointer\'s touch', async () => {
    await playing();
    expect(screen.queryByText(words('Ctrl/⌘ ↵'))).toBeNull();
    expect(document.documentElement.dataset.input).toBe('pointer');
    await key({ key: 'Tab' });
    expect(document.documentElement.dataset.input).toBe('keyboard');
    expect(screen.getByText(words('Ctrl/⌘ ↵'))).toBeTruthy();
    act(() => void fireEvent.pointerDown(document.body));
    expect(screen.queryByText(words('Ctrl/⌘ ↵'))).toBeNull();
  });

  it('in the finances, [ and ] move between the tabs from anywhere, and ↓ ↑ among a panel\'s rows, Escape going back to its tab', async () => {
    await playing();
    // Through the round with the keyboard alone: the news, each card by its first choice, what it did, to the finances.
    for (let step = 0; step < 20 && stageName() !== 'Your finances'; step++) {
      const name = stageName() ?? '';
      if (/^Card/.test(name)) await key({ key: '1' }, document.body);
      else await key({ key: 'Enter', ctrlKey: true }, document.body);
      await waitFor(() => expect(stageName()).not.toBe(name));
    }
    expect(stageName()).toBe('Your finances');
    const tab = (name: string) => screen.getByRole('tab', { name });
    await key({ key: ']' }, document.body);
    await waitFor(() => expect(document.activeElement).toBe(tab('Market')));
    expect(tab('Market').getAttribute('aria-selected')).toBe('true');
    await key({ key: '[' }, document.body);
    await waitFor(() => expect(document.activeElement).toBe(tab('Portfolio')));
    // The market's rows: ↓ to the next, End the last, Escape back to the tab.
    await key({ key: ']' }, document.body);
    const rows = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('[data-finance-item]')];
      expect(found.length).toBeGreaterThan(2);
      return found;
    });
    act(() => rows[0].focus());
    await key({ key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
    await key({ key: 'End' });
    expect(document.activeElement).toBe(rows[rows.length - 1]);
    await key({ key: 'Escape' });
    expect(document.activeElement).toBe(tab('Market'));
    // And the reference says what the finances' keys are.
    await key({ key: '?' }, document.body);
    const sheet = (await screen.findByRole('heading', { name: 'Keyboard controls' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByText(words('[ / ]'))).toBeTruthy();
  });

  it('puts the first choice in focus again once a card comes back from an answer the server never gave (busy until then)', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    // A ranked life: the answer is the server's, and this one never comes back. The card turns, then returns, still busy, to be answered again.
    const served: GameSession = {
      gameId: real.gameId, lifeId: real.lifeId, served: true, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [],
      answerCard: async () => {
        await new Promise((done) => setTimeout(done, 300));
        throw new Unreachable();
      },
      playRound: (choices) => real.playRound(choices),
    };
    services.sessions.resume = async () => ({ lost: null, session: served });
    renderGame(
      <>
        <KeyboardControls />
        <Play />
      </>,
      services,
    );
    await waitFor(() => expect(stageName()).toBe('News'));
    await key({ key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(stageName()).toMatch(/^Card 1 of/));
    const first = () => within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[0];
    await waitFor(() => expect(document.activeElement).toBe(first()));
    await key({ key: '1' });
    await waitFor(() => expect(stageName()).toBe('What happened'));
    // Back on the card, and once the answer is given up, the first choice has the focus again.
    await waitFor(() => expect(stageName()).toMatch(/^Card 1 of/), { timeout: 3000 });
    await waitFor(() => expect(document.activeElement).toBe(first()), { timeout: 3000 });
  });
});
