// @vitest-environment jsdom
import type { RatLook } from '@ratrace/core/game/avatar';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { settled } from '../../testing/renders';
import { RatEditor } from './RatEditor';

/*
 * The rat's editor with the keyboard on the web (docs/keyboard.md): the rat, the row of parts and the choices are a Tab stop each; the arrows move
 * within each, passing over a prize not won yet.
 */

afterEach(cleanup);

const LOOK: RatLook = { colour: 'sky', body: 'grey', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null };
type Laid = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void };
const key = (init: KeyboardEventInit, on: Element = document.activeElement ?? document.body) => act(() => void fireEvent.keyDown(on, init));
const radios = () => within(screen.getByRole('radiogroup')).getAllByRole('radio');
const checked = () => radios().find((radio) => radio.getAttribute('aria-checked') === 'true')?.getAttribute('aria-label');
const focused = () => document.activeElement?.getAttribute('aria-label');

async function hats() {
  renderGame(<RatEditor look={LOOK} earned={{}} rank="sewer" badgeName={(id) => id} rankName={(id) => id} onSave={() => {}} onClose={() => {}} part="hat" />, memoryServices());
  await act(async () => (screen.getByTestId('rat-editor') as Laid).__reactLayoutHandler?.({ nativeEvent: { layout: { x: 0, y: 0, width: 369, height: 640 } } }));
  await settled();
  return radios().filter((radio) => radio.getAttribute('data-locked') === null).map((radio) => radio.getAttribute('aria-label'));
}

describe('the rat\'s editor with the keyboard', () => {
  it('moves along the choices with the arrows, one Tab stop, passing over a prize not won', async () => {
    const open = await hats();
    expect(radios().filter((radio) => radio.getAttribute('tabindex') === '0')).toHaveLength(1);
    act(() => radios()[0].focus());
    await key({ key: 'ArrowRight' });
    await waitFor(() => expect(checked()).toBe(open[1]));
    expect(focused()).toBe(open[1]);
    await key({ key: 'End' });
    await waitFor(() => expect(checked()).toBe(open[open.length - 1]));
    await key({ key: 'ArrowRight' });
    await waitFor(() => expect(checked()).toBe('None'));
    await key({ key: 'ArrowDown' });
    await waitFor(() => expect(checked()).toBe(radios()[5].getAttribute('aria-label')));
  });

  it('picks the part beside with the arrows of the row of parts, and steps the rat\'s choice with its own', async () => {
    const open = await hats();
    const tab = screen.getByRole('tab', { name: 'Headwear' });
    expect(tab.getAttribute('tabindex')).toBe('0');
    act(() => tab.focus());
    await key({ key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Eyes' }).getAttribute('aria-selected')).toBe('true'));
    expect(focused()).toBe('Eyes');
    await key({ key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByRole('radiogroup').getAttribute('aria-label')).toBe('Headwear'));
    const rat = screen.getByRole('slider');
    act(() => rat.focus());
    await key({ key: 'ArrowRight' });
    await waitFor(() => expect(checked()).toBe(open[1]));
    await key({ key: 'ArrowLeft' });
    await key({ key: 'ArrowLeft' });
    await waitFor(() => expect(checked()).toBe(open[open.length - 1]));
  });
});
