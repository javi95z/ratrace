// @vitest-environment jsdom
import { messagesFor } from '@ratrace/i18n';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Counted } from '../game/events';
import { Home } from '../game/screens/Home';
import { GameProvider } from '../game/context';
import type { Services } from '../game/context';
import { speaking } from '../testing/memoryServices';
import { memoryServices, renderGame } from '../testing/render';
import { InstallApp, InstallProvider, installPlatform, useInstallOffer, ViewportSync } from './install';
import type { BeforeInstallPromptEvent } from './install';

/*
 * The web export's offer to install the game (install.web.tsx), the Next web's (`apps/web/src/pwa/runtime.tsx`, `InstallApp.tsx`, `ViewportSync.tsx`):
 * Chrome's own prompt where it gives one, the steps in a sheet where it does not (iOS Safari has none), from the second visit until the player
 * says no, and the install counted once, whoever ends it.
 */

const en = messagesFor('en');
const KEY = 'ratrace.installOffer';

/** The counts a draw sends, and the draw: the offer inside the provider, as the layout mounts it. */
function draw(ui = <InstallApp />, locale: 'en' | 'es' | 'ru' = 'en') {
  const counted: Counted[] = [];
  const services: Services = { ...memoryServices(), track: (event) => void counted.push(event) };
  renderGame(<InstallProvider>{ui}</InstallProvider>, services, locale);
  return counted;
}

/** What Chromium dispatches when the page may be installed: the event with the prompt, and the player's answer to it. */
function offered(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn(async () => {});
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  Object.defineProperties(event, { prompt: { value: prompt }, userChoice: { value: Promise.resolve({ outcome, platform: 'web' }) } });
  return { event, prompt };
}

/** The sheet the steps open in: the one whose heading is `name`. */
const sheetNamed = async (name: string) => (await screen.findByRole('heading', { name })).closest('[aria-modal="true"]') as HTMLElement;

const agent = (value: string) => Object.defineProperty(navigator, 'userAgent', { value, configurable: true });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'matchMedia');
  Reflect.deleteProperty(navigator, 'userAgent');
  Reflect.deleteProperty(window, 'visualViewport');
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.style.removeProperty('--viewport-nudge');
});

describe('the offer', () => {
  it('recognises iPhones and iPads, including iPadOS in desktop mode', () => {
    expect(installPlatform({ userAgent: 'Mozilla iPhone', platform: 'iPhone', maxTouchPoints: 5 })).toBe('ios');
    expect(installPlatform({ userAgent: 'Mozilla Macintosh', platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
    expect(installPlatform({ userAgent: 'Mozilla Macintosh', platform: 'MacIntel', maxTouchPoints: 0 })).toBe('browser');
  });

  it('opens short, local steps when the browser has no native prompt, in the page\'s language', async () => {
    draw(<InstallApp />, 'es');
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar' }));
    const sheet = await sheetNamed('Instalar The Rat Race');
    expect(sheet.textContent).toContain('Abre el menú del navegador');
    expect(sheet.textContent).toContain('sin internet');
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows the Safari steps on iOS: Share, Add to Home Screen, Add', async () => {
    agent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1');
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Install' }));
    const sheet = await sheetNamed(en.install.howTitle);
    expect(sheet.textContent).toContain(en.install.iosIntro);
    for (const step of [en.install.iosShare, en.install.iosHome, en.install.iosAdd]) expect(sheet.textContent).toContain(step);
    expect(sheet.textContent).not.toContain(en.install.browserMenu);
  });

  it('uses Chrome\'s own prompt, and disappears once it is accepted', async () => {
    draw();
    await screen.findByRole('button', { name: 'Install' });
    const { event, prompt } = offered();
    act(() => void window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install' })).toBeNull());
    expect(screen.queryByRole('heading', { name: en.install.howTitle })).toBeNull();
  });

  it('keeps the offer, and the steps for next time, when the prompt is turned down', async () => {
    draw();
    await screen.findByRole('button', { name: 'Install' });
    const { event, prompt } = offered('dismissed');
    act(() => void window.dispatchEvent(event));
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    // The prompt is spent: Chrome gives one event for one prompt, so the next press shows the steps.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(await sheetNamed(en.install.howTitle)).toBeTruthy();
  });

  it('has the browser\'s prompt from before the game was drawn: the event comes once, and the game takes a while to open', async () => {
    const { event, prompt } = offered();
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Install' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    // Taken once: the next draw does not find it again.
    cleanup();
    draw();
    await screen.findByRole('button', { name: 'Install' });
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(await sheetNamed(en.install.howTitle)).toBeTruthy();
    expect(prompt).toHaveBeenCalledOnce();
  });

  it('shows nothing when it already runs as an installed app', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    });
    draw();
    await waitFor(() => expect(document.body.textContent).not.toContain(en.install.title));
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('draws nothing where no provider stands, so a screen alone grows no control', () => {
    renderGame(<InstallApp />, memoryServices());
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('draws nothing on the server: it is decided once the browser has it', () => {
    function Probe() {
      const offer = useInstallOffer();
      return <p>{offer.shown ? 'offer' : 'no offer'}</p>;
    }
    window.localStorage.setItem(KEY, JSON.stringify({ visits: 5 }));
    const html = renderToString(
      <GameProvider services={speaking(memoryServices(), 'en')}>
        <InstallProvider>
          <InstallApp />
          <Probe />
        </InstallProvider>
      </GameProvider>,
    );
    expect(html).toContain('no offer');
    expect(html).not.toContain(en.install.title);
  });
});

describe('counting the install', () => {
  it('counts app_installed once, whoever ends the install, and the offer goes', async () => {
    const counted = draw();
    await screen.findByRole('button', { name: 'Install' });
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(counted).toEqual([{ name: 'app_installed' }]);
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
    // The event comes once; if it came twice it would still be one install.
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(counted).toEqual([{ name: 'app_installed' }]);
  });

  it('counts nothing for an offer taken up and turned down, or a page opened as the installed app', async () => {
    const counted = draw();
    await screen.findByRole('button', { name: 'Install' });
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await sheetNamed(en.install.howTitle);
    expect(counted).toEqual([]);
  });

  it('stops listening when it goes', async () => {
    const counted = draw();
    await screen.findByRole('button', { name: 'Install' });
    cleanup();
    window.dispatchEvent(new Event('appinstalled'));
    expect(counted).toEqual([]);
  });
});

describe('from the second visit', () => {
  /** What the offer decides, as Home asks it. */
  function Probe() {
    const offer = useInstallOffer();
    return (
      <div>
        <p>{offer.shown ? 'offer' : 'no offer'}</p>
        <button onClick={offer.dismiss}>dismiss</button>
      </div>
    );
  }
  const visit = () => render(<Probe />);
  const kept = () => JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as { visits?: number; dismissed?: boolean };

  it('makes none on the first visit, and one on the second', async () => {
    visit();
    expect(await screen.findByText('no offer')).toBeTruthy();
    expect(kept()).toEqual({ visits: 1 });
    cleanup();
    // A new visit: a new tab, or a later day, which sessionStorage forgets.
    window.sessionStorage.clear();
    visit();
    expect(await screen.findByText('offer')).toBeTruthy();
    expect(kept()).toEqual({ visits: 2 });
  });

  it('counts a visit once however often Home is shown in it', async () => {
    visit();
    await screen.findByText('no offer');
    cleanup();
    visit();
    cleanup();
    visit();
    expect(await screen.findByText('no offer')).toBeTruthy();
    expect(kept().visits).toBe(1);
    expect(window.sessionStorage.getItem(KEY)).toBe('1');
  });

  it('keeps a no for good: the next visits make no offer, and what else was kept stays', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ visits: 3 }));
    visit();
    expect(await screen.findByText('offer')).toBeTruthy();
    fireEvent.click(screen.getByText('dismiss'));
    expect(screen.getByText('no offer')).toBeTruthy();
    expect(kept()).toEqual({ visits: 4, dismissed: true });
    cleanup();
    window.sessionStorage.clear();
    visit();
    expect(await screen.findByText('no offer')).toBeTruthy();
    expect(kept()).toEqual({ visits: 5, dismissed: true });
  });

  it('makes none where the browser keeps nothing', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    visit();
    expect(await screen.findByText('no offer')).toBeTruthy();
    fireEvent.click(screen.getByText('dismiss'));
    expect(screen.getByText('no offer')).toBeTruthy();
  });
});

describe('on the front door', () => {
  it('is at the foot of Home from the second visit, and goes with a no', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ visits: 1 }));
    renderGame(
      <InstallProvider>
        <Home />
      </InstallProvider>,
      memoryServices(),
    );
    const offer = await screen.findByRole('region', { name: en.install.title });
    expect(offer.textContent).toContain(en.install.hint);
    // After the small print's neighbours: the offer comes before the link to the legal notice, the very foot.
    expect(offer.compareDocumentPosition(screen.getByRole('link', { name: en.legal.link })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(offer).getByRole('button', { name: en.install.dismiss }));
    await waitFor(() => expect(screen.queryByRole('region', { name: en.install.title })).toBeNull());
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}').dismissed).toBe(true);
  });

  it('is not there on the first visit', async () => {
    renderGame(
      <InstallProvider>
        <Home />
      </InstallProvider>,
      memoryServices(),
    );
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('region', { name: en.install.title })).toBeNull();
  });
});

describe('the installed page on an iPhone', () => {
  /** A visible area that is not where the layout puts it (a status bar changed under the page). */
  function viewport(offsetTop: number) {
    const target = new EventTarget();
    Object.defineProperty(window, 'visualViewport', { value: Object.assign(target, { offsetTop, offsetLeft: 0 }), configurable: true });
    return target;
  }
  const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));

  it('scrolls by nothing and measures again when the visible area is out of place', async () => {
    const view = viewport(24);
    window.scrollTo = vi.fn() as typeof window.scrollTo;
    render(<ViewportSync />);
    view.dispatchEvent(new Event('resize'));
    await frame();
    await frame();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: window.scrollY, left: 0 });
    expect(['0', '1']).toContain(document.documentElement.style.getPropertyValue('--viewport-nudge'));
  });

  it('leaves a page that is in place alone, and stops listening when it goes', async () => {
    const view = viewport(0);
    window.scrollTo = vi.fn() as typeof window.scrollTo;
    const { unmount } = render(<ViewportSync />);
    view.dispatchEvent(new Event('resize'));
    await frame();
    await frame();
    expect(window.scrollTo).not.toHaveBeenCalled();
    unmount();
    Object.assign(view, { offsetTop: 24 });
    view.dispatchEvent(new Event('resize'));
    await frame();
    await frame();
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--viewport-nudge')).toBe('');
  });
});
