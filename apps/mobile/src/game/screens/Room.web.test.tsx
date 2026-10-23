// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { roomServer } from '../../../../web/src/testing/roomServer';
import { clipboard } from '../../testing/fakes';
import { memoryServices, renderGame } from '../../testing/render';
import type { Services } from '../context';
import { Room } from './Room';

/*
 * The room's way out on the web export: the Next web shows Share only where the browser has a share sheet, and a public game's Invite copies the link
 * (with the toast) where it has none. jsdom has neither a share sheet nor, by default, a clipboard: each test gives the navigator what its browser has.
 */

vi.setConfig({ testTimeout: 120_000 });

const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function inRooms() {
  const server = roomServer();
  const counted: unknown[] = [];
  const services: Services = { ...memoryServices(), rooms: () => server.link(HOST), schedule: () => () => {}, track: (event) => void counted.push(event) };
  return { server, services, counted };
}

const board = { text: null as string | null };
afterEach(() => {
  cleanup();
  board.text = null;
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { clipboard?: unknown }).clipboard;
});

/** A browser with a clipboard that takes the text, and a share sheet if `sheet`. */
function browser(sheet: boolean) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async (text: string) => void (board.text = text)) }, configurable: true });
  const share = vi.fn<(data: ShareData) => Promise<void>>(async () => undefined);
  if (sheet) Object.assign(navigator, { share });
  return share;
}

/** A private game's lobby, and its code. */
async function privateLobby(services: Services) {
  renderGame(<Room />, services);
  fireEvent.click(await screen.findByRole('button', { name: 'Start a game' }));
  const sheet = (await screen.findByRole('heading', { name: 'Start a game' })).closest('[aria-modal="true"]') as HTMLElement;
  fireEvent.click(within(sheet).getByRole('button', { name: 'Start the game' }));
  return screen.findByRole('region', { name: 'Game code' });
}

describe('a private game on a browser with no share sheet', () => {
  it('shows only Copy link, which copies the link and says so', async () => {
    browser(false);
    const { services, counted } = inRooms();
    const code = await privateLobby(services);
    expect(within(code).queryByRole('button', { name: 'Share' })).toBeNull();
    fireEvent.click(within(code).getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Link copied.')).toBeTruthy();
    const shown = within(code).getByText(/^[A-Z0-9]{6}$/).textContent;
    expect(board.text).toBe(`https://ratrace-plum.vercel.app/en/room?code=${shown}`);
    expect(counted).toContainEqual({ name: 'share', what: 'invite' });
    expect(clipboard.text).toBeNull();
  });
});

describe('a private game on a browser with a share sheet', () => {
  it('shows Share beside Copy link, and Share hands the sheet the title, the words and the link', async () => {
    const share = browser(true);
    const { services, counted } = inRooms();
    const code = await privateLobby(services);
    expect(within(code).getByRole('button', { name: 'Copy link' })).toBeTruthy();
    fireEvent.click(within(code).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const shown = within(code).getByText(/^[A-Z0-9]{6}$/).textContent;
    expect(share.mock.calls[0][0]).toEqual({
      title: 'Multiplayer',
      text: expect.stringContaining(shown as string),
      url: `https://ratrace-plum.vercel.app/en/room?code=${shown}`,
    });
    await waitFor(() => expect(counted).toContainEqual({ name: 'share', what: 'invite' }));
    expect(board.text).toBeNull();
  });
});

describe('a public game', () => {
  const clock = async (services: Services) => {
    renderGame(<Room />, services);
    fireEvent.click(await screen.findByRole('button', { name: 'Quick game' }));
    return screen.findByRole('region', { name: 'Looking for players' });
  };

  it('invites with the clipboard and its toast where the browser has no share sheet', async () => {
    browser(false);
    const { services, counted } = inRooms();
    fireEvent.click(within(await clock(services)).getByRole('button', { name: 'Invite someone' }));
    expect(await screen.findByText('Link copied.')).toBeTruthy();
    expect(board.text).toMatch(/^https:\/\/ratrace-plum\.vercel\.app\/en\/room\?code=[A-Z0-9]{6}$/);
    expect(counted).toContainEqual({ name: 'share', what: 'invite' });
  });

  it('invites through the share sheet where the browser has one, and copies nothing', async () => {
    const share = browser(true);
    const { services } = inRooms();
    fireEvent.click(within(await clock(services)).getByRole('button', { name: 'Invite someone' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].url).toMatch(/^https:\/\/ratrace-plum\.vercel\.app\/en\/room\?code=[A-Z0-9]{6}$/);
    expect(board.text).toBeNull();
    expect(screen.queryByText('Link copied.')).toBeNull();
  });
});
