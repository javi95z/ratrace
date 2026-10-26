// @vitest-environment jsdom
import { challengeOf, CONTENT_VERSION, lives, weekOf } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kv, memoryServices, renderGame, router } from '../../testing/render';
import { SettingsSheet } from './Settings';

afterEach(cleanup);

/** The screen the sheet is opened from: it holds whether the sheet is open, as a screen does. */
function Host({ shown, onClosed }: { shown: GameView; onClosed?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <SettingsSheet
      open={open}
      onClose={() => {
        setOpen(false);
        onClosed?.();
      }}
      shown={shown}
    />
  );
}

const TITLES = { en: 'Settings', es: 'Ajustes', ru: 'Настройки' } as const;
const GAME = { en: 'Your game', es: 'Tu partida', ru: 'Твоя игра' } as const;

/** A life begun on a device (to its end, if asked), and its settings sheet open over it. */
async function open(options: { challenge?: boolean; finished?: boolean; inRoom?: boolean; services?: ReturnType<typeof memoryServices>; onClosed?: () => void; locale?: 'en' | 'es' | 'ru' } = {}) {
  const services = options.services ?? memoryServices();
  const locale = options.locale ?? 'en';
  const week = challengeOf(weekOf(Date.now()), lives);
  const session = await services.sessions.start(options.challenge && week ? week.lifeId : 'nurse', options.challenge && week ? { challenge: week.week } : undefined);
  while (options.finished && !session.view().finished) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
  const lived = session.view();
  // A life in a game with friends is marked as one.
  const view: GameView = options.inRoom ? { ...lived, player: { ...lived.player, life: { ...lived.player.life, flags: { ...lived.player.life.flags, in_room: 1 } } } } : lived;
  renderGame(<Host shown={view} onClosed={options.onClosed} />, services, locale);
  const sheet = await screen.findByRole('heading', { name: TITLES[locale] });
  // The game on the device is opened as the sheet is drawn: the sheet reads who is living the life from it.
  if (locale === 'en') await screen.findByText(options.challenge ? 'Challenge practice' : 'Your game');
  else await screen.findByLabelText(GAME[locale]);
  return { services, view, sheet: sheet.closest('[aria-modal="true"]') as HTMLElement };
}

/** The sheet with this title, where several are open. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

describe('the settings of a life in progress', () => {
  it('say which kind of life is being lived: the player\'s own game, or a practice of the week\'s challenge', async () => {
    const own = await open();
    expect(within(own.sheet).getByText('Your game')).toBeTruthy();
    expect(within(own.sheet).queryByText('Challenge practice')).toBeNull();
    expect(within(own.sheet).queryByText('Ranked life')).toBeNull();
    cleanup();
    const practice = await open({ challenge: true });
    expect(within(practice.sheet).getByText('Challenge practice')).toBeTruthy();
    expect(within(practice.sheet).queryByText('Your game')).toBeNull();
  });

  it('say where the game stands: who, how far along, and what it is worth', async () => {
    const { sheet } = await open();
    const game = within(sheet).getByLabelText('Your game');
    expect(within(game).getByText('Nurse')).toBeTruthy();
    expect(within(game).getByText(/Age 22 · Madrid/)).toBeTruthy();
    expect(within(game).getByText('Round 1 of 20')).toBeTruthy();
    expect(within(game).getByText('40 years left')).toBeTruthy();
    expect(within(game).getByRole('progressbar', { name: 'How far along your life is' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(game).getByText(/ pts$/)).toBeTruthy();
    // Saving that works says nothing.
    expect(within(game).queryByRole('alert')).toBeNull();
  });

  it('say so when the device is not saving', async () => {
    const { sheet } = await open({ services: memoryServices(undefined, { savingOff: true }) });
    expect(within(sheet).queryByText(/Saved on this device/)).toBeNull();
    expect(within(sheet).getByRole('alert').textContent).toMatch(/not saving/);
  });

  it('change what can be set, and keep it', async () => {
    const { services, sheet } = await open();
    const sound = within(sheet).getByRole('switch', { name: /^Sound/ });
    const motion = within(sheet).getByRole('switch', { name: /Reduce motion/ });
    const tips = within(sheet).getByRole('switch', { name: /Tips from the guide/ });
    expect(within(sheet).getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'true']);

    fireEvent.click(sound);
    fireEvent.click(motion);
    fireEvent.click(tips);
    expect(sound.getAttribute('aria-checked')).toBe('false');
    expect(motion.getAttribute('aria-checked')).toBe('true');
    expect(tips.getAttribute('aria-checked')).toBe('false');
    await waitFor(async () => {
      const profile = await services.store.loadProfile();
      expect(profile.settings.sound).toBe(false);
      expect(profile.settings.reducedMotion).toBe(true);
      expect(profile.guide.off).toBe(true);
    });

    // The guide can be had back: it is not gone for good.
    fireEvent.click(tips);
    await waitFor(async () => expect((await services.store.loadProfile()).guide.off).toBe(false));
  });

  it('open How to play over themselves, with the guide on or off, and are there again once it is closed', async () => {
    const { sheet } = await open();
    fireEvent.click(within(sheet).getByRole('switch', { name: /Tips from the guide/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'How to play' }));
    const reading = await waitFor(() => sheetTitled('How to play'));
    expect(within(reading).getByRole('heading', { name: 'The words of the game' })).toBeTruthy();
    fireEvent.click(within(reading).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'How to play' })).toBeNull());
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
  });

  it('leave a press silent on the phone until its click is turned on, kept on the phone, and offered only with the sound on', async () => {
    const { sheet } = await open();
    const click = () => within(sheet).queryByRole('switch', { name: /^Click on every press/ });
    expect(click()?.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(click()!);
    expect(click()?.getAttribute('aria-checked')).toBe('true');
    expect(kv.get('ratrace:tapSound')).toBe('1');
    // With the sound off there is nothing to click: the choice is out of sight, and kept.
    fireEvent.click(within(sheet).getByRole('switch', { name: /^Sound/ }));
    await waitFor(() => expect(click()).toBeNull());
    fireEvent.click(within(sheet).getByRole('switch', { name: /^Sound/ }));
    await waitFor(() => expect(click()?.getAttribute('aria-checked')).toBe('true'));
  });

  it('offer the languages of the game, each under its own name, the one in use marked, and speak the one chosen from then on', async () => {
    const { sheet } = await open();
    const group = within(sheet).getByRole('radiogroup', { name: 'Language' });
    const choices = within(group).getAllByRole('radio');
    expect(choices.map((choice) => [choice.textContent, choice.getAttribute('aria-checked')])).toEqual([
      ['English', 'true'],
      ['Español', 'false'],
      ['Русский', 'false'],
    ]);
    fireEvent.click(within(group).getByRole('radio', { name: 'Español' }));
    // The sheet speaks Spanish at once, and the choice is the one marked.
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeTruthy();
    expect(within(sheet).getByRole('radiogroup', { name: 'Idioma' })).toBeTruthy();
    expect(within(sheet).getByRole('radio', { name: 'Español' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByRole('radio', { name: 'English' }).getAttribute('aria-checked')).toBe('false');
  });

  it('draw each language\'s name in its own typeface: the Cyrillic pixel face for Russian, even on a page that is not Russian, the game\'s pixel face for the others', async () => {
    const { sheet } = await open();
    const fontOf = (name: string) => (within(sheet).getByText(name) as HTMLElement).style.fontFamily;
    expect(fontOf('Русский')).toContain('Oswald');
    expect(fontOf('English')).toContain('Jersey15');
    expect(fontOf('Español')).toContain('Jersey15');
  });

  it('show which game this is, for a report of something amiss', async () => {
    const { sheet } = await open();
    expect(within(sheet).getByText(`Version ${CONTENT_VERSION} · engine ${ENGINE_VERSION}`)).toBeTruthy();
  });

  it('lead back to the front door once the sheet has gone, and close without leaving', async () => {
    const onClosed = vi.fn();
    const { sheet } = await open({ onClosed });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    cleanup();

    const again = await open({ onClosed });
    fireEvent.click(within(again.sheet).getByRole('link', { name: /Back to the home screen/ }));
    // The sheet is closed first, and the page moves on when it is gone: never with a sheet still leaving.
    expect(onClosed).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
  });
});

describe('ending the life from its settings', () => {
  it('asks first, and keeps the life if the answer is no', async () => {
    const { services, sheet } = await open();
    fireEvent.click(within(sheet).getByRole('button', { name: 'End this life' }));
    const ask = sheetTitled('End this life?');
    expect(within(ask).getByText('Nurse, Age 22. It ends here and is not recorded.')).toBeTruthy();
    // A life of the player's own is not a ranked one or an attempt: nothing is said of either.
    expect(within(ask).queryByText(/ranked life|attempt/)).toBeNull();
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'End this life?' })).toBeNull());
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(await services.store.loadGame()).not.toBeNull();
  });

  it('ends the life once the sheets have closed, and the game goes back to no life', async () => {
    const { services, sheet } = await open();
    fireEvent.click(within(sheet).getByRole('button', { name: 'End this life' }));
    fireEvent.click(within(sheetTitled('End this life?')).getByRole('button', { name: 'End it' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Settings|End this life\?/ })).toBeNull());
    await waitFor(async () => expect(await services.store.loadGame()).toBeNull());
  });

  it('is not offered for a life that is over: there is nothing left to end', async () => {
    const { sheet } = await open({ finished: true });
    expect(within(sheet).getByLabelText('Your game')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'End this life' })).toBeNull();
  });

  it('is offered for a life in progress, and not for a life of a game with friends, which has its own way out', async () => {
    const alone = await open();
    expect(within(alone.sheet).getByRole('button', { name: 'End this life' })).toBeTruthy();
    cleanup();
    const together = await open({ inRoom: true });
    expect(within(together.sheet).queryByRole('button', { name: 'End this life' })).toBeNull();
  });
});

describe('the settings in another language', () => {
  it('speak Russian with every word of it', async () => {
    const { sheet } = await open({ locale: 'ru' });
    expect(within(sheet).getByRole('radiogroup', { name: 'Язык' })).toBeTruthy();
    // (A Russian title is cut into one piece for each typeface it needs, so a name is read from the whole text.)
    const said = (role: string) => within(sheet).getAllByRole(role).map((el) => el.textContent);
    expect(said('button')).toContain('Завершить эту жизнь');
    expect(said('link').join()).toContain('На главный экран');
    expect(said('switch').join()).toContain('Звук');
  });
});
