// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '@/testing/render';
import { InstallApp } from './InstallApp';
import { installPlatform, PwaProvider } from './runtime';
import type { BeforeInstallPromptEvent } from './runtime';

const draw = (locale: 'en' | 'es' | 'ru' = 'en') => renderGame(<PwaProvider><InstallApp /></PwaProvider>, memoryServices(), locale);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('installing the app', () => {
  it('recognises iPhones and iPads, including iPadOS in desktop mode', () => {
    expect(installPlatform({ userAgent: 'Mozilla iPhone', platform: 'iPhone', maxTouchPoints: 5 })).toBe('ios');
    expect(installPlatform({ userAgent: 'Mozilla Macintosh', platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
    expect(installPlatform({ userAgent: 'Mozilla Macintosh', platform: 'MacIntel', maxTouchPoints: 0 })).toBe('browser');
  });

  it('opens short, local instructions when the browser has no native prompt', async () => {
    const user = userEvent.setup();
    draw('es');
    await user.click(await screen.findByRole('button', { name: 'Instalar' }));
    const sheet = screen.getByRole('dialog', { name: 'Instalar The Rat Race' });
    expect(sheet.textContent).toContain('Abre el menú del navegador');
    expect(sheet.textContent).toContain('sin internet');
  });

  it('uses Chromium’s native prompt and disappears after acceptance', async () => {
    const user = userEvent.setup();
    const nativePrompt = vi.fn(async () => {});
    draw();
    await screen.findByRole('button', { name: 'Install' });
    const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
    Object.defineProperties(event, {
      prompt: { value: nativePrompt },
      userChoice: { value: Promise.resolve({ outcome: 'accepted', platform: 'web' }) },
    });
    act(() => window.dispatchEvent(event));

    await user.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(nativePrompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install' })).toBeNull());
  });

  it('shows nothing when already running as an installed app', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    });
    draw();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install' })).toBeNull());
  });

  it('disappears when another browser control finishes installation', async () => {
    draw();
    await screen.findByRole('button', { name: 'Install' });
    act(() => window.dispatchEvent(new Event('appinstalled')));
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });
});
