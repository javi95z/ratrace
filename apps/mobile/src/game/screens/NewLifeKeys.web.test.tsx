// @vitest-environment jsdom
import { lives, textFor } from '@ratrace/content';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { KeyboardControls } from '../KeyboardHelp';
import { AmountSheet } from './AmountSheet';
import { NewLife } from './NewLife';

/*
 * The keyboard on the web away from a round (docs/keyboard.md): the life picker's arrows and letters, and an amount given with Ctrl/⌘ + Enter.
 */

afterEach(cleanup);

const key = (init: KeyboardEventInit, on: Element = document.activeElement ?? document.body) => act(() => void fireEvent.keyDown(on, init));
const { text } = textFor('en');
const open = lives.filter((life) => life.unlock === 'default');
const tile = (id: string) => document.querySelector<HTMLElement>(`[data-life="${id}"]`) as HTMLElement;
const chosen = () => document.querySelector('[data-life][aria-checked="true"]')?.getAttribute('data-life');

describe('the life picker with the keyboard', () => {
  it('is one Tab stop; the arrows, Home and End choose the open lives in their order, letters one by its name', async () => {
    renderGame(
      <>
        <KeyboardControls />
        <NewLife />
      </>,
      memoryServices(),
    );
    await waitFor(() => expect(tile(open[0].id)).toBeTruthy());
    await waitFor(() => expect(chosen()).toBe(open[0].id));
    expect(tile(open[0].id).getAttribute('tabindex')).toBe('0');
    expect(tile(open[1].id).getAttribute('tabindex')).toBe('-1');
    act(() => tile(open[0].id).focus());
    await key({ key: 'ArrowRight' });
    await waitFor(() => expect(chosen()).toBe(open[1].id));
    await waitFor(() => expect(document.activeElement).toBe(tile(open[1].id)));
    await key({ key: 'End' });
    await waitFor(() => expect(chosen()).toBe(open[open.length - 1].id));
    await key({ key: 'Home' });
    await waitFor(() => expect(chosen()).toBe(open[0].id));
    // Letters: the first open life whose name starts with them.
    const target = open[open.length - 1];
    await key({ key: text.lives[target.id].name[0] });
    await waitFor(() => expect(text.lives[chosen() ?? ''].name.toLocaleLowerCase().startsWith(text.lives[target.id].name[0].toLocaleLowerCase())).toBe(true));
    // And the reference says so.
    await key({ key: '?' }, document.body);
    const sheet = (await screen.findByRole('heading', { name: 'Keyboard controls' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getAllByText((_, element) => element?.textContent === '↑ / ↓ · Home / End').length).toBeGreaterThan(0);
  });
});

describe('an amount with the keyboard', () => {
  it('is given with Ctrl/⌘ + Enter from anywhere in its sheet, never for a key held down, and moved with the slider\'s keys', async () => {
    const onConfirm = vi.fn(() => true);
    renderGame(
      <>
        <KeyboardControls />
        <AmountSheet title="Save" max={100_000} start={10_000} onClose={() => {}} onConfirm={onConfirm} />
      </>,
      memoryServices(),
    );
    const slider = await screen.findByRole('slider');
    act(() => slider.focus());
    await key({ key: 'ArrowRight', shiftKey: true });
    const now = Number(slider.getAttribute('aria-valuenow'));
    expect(now).toBeGreaterThan(10_000);
    await key({ key: 'Enter', ctrlKey: true, repeat: true });
    expect(onConfirm).not.toHaveBeenCalled();
    await key({ key: 'Enter', metaKey: true });
    expect(onConfirm).toHaveBeenCalledWith(now);
  });
});
