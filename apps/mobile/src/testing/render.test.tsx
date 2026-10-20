// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useRouter } from 'expo-router';
import { afterEach, expect, test } from 'vitest';
import { useSettings, useSound, useT, useWords } from '../game/context';
import { Sprite } from '../ui/Sprite';
import { device, heard, insets, kv, memoryServices, renderGame, router } from './render';

afterEach(cleanup);

/** A screen of the game: words, a number and a sprite, all of them the real ones. */
function Screen() {
  const t = useT('meta');
  const { fmt } = useWords();
  return (
    <>
      <div>{t('titles.new')}</div>
      <div>{fmt.money(1234567)}</div>
      <Sprite id="rat_gold" />
    </>
  );
}

test('draws a screen in English by default, and in the other languages of the game when asked', () => {
  renderGame(<Screen />, memoryServices());
  expect(screen.getByText('Choose a life')).toBeTruthy();
  cleanup();
  renderGame(<Screen />, memoryServices(), 'es');
  expect(screen.getByText('Elige una vida')).toBeTruthy();
  expect(document.body.textContent).toContain('12.346\u00a0$');
  cleanup();
  renderGame(<Screen />, memoryServices(), 'ru');
  expect(screen.getByText('Выбери жизнь')).toBeTruthy();
});

test('the language is the one asked for, whatever the phone speaks', () => {
  device.languages = ['ru'];
  renderGame(<Screen />, memoryServices(), 'es');
  expect(screen.getByText('Elige una vida')).toBeTruthy();
});

test('a language chosen on the screen is the language from then on, and the phone keeps nothing of it', () => {
  function Choose() {
    const { setLocale } = useSettings();
    return <button onClick={() => setLocale('ru')}>choose</button>;
  }
  renderGame(<><Choose /><Screen /></>, memoryServices());
  expect(screen.getByText('Choose a life')).toBeTruthy();
  fireEvent.click(screen.getByText('choose'));
  expect(screen.getByText('Выбери жизнь')).toBeTruthy();
  expect(kv.has('ratrace:locale')).toBe(false);
});

test('the native modules of the phone are stood in for: the router is a spy, a sprite is a box that names itself', () => {
  function Go() {
    const router = useRouter();
    return <button onClick={() => router.push('/new')}>go</button>;
  }
  renderGame(<><Go /><Screen /></>, memoryServices());
  expect(document.querySelector('[data-sprite="rat_gold"]')).not.toBeNull();
  fireEvent.click(screen.getByText('go'));
  expect(router.push).toHaveBeenCalledWith('/new');
  expect(router.canGoBack()).toBe(true);
  expect(insets).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
});

test('the sounds the game makes are written down, and the next test starts with none (1/2)', () => {
  let play: ReturnType<typeof useSound> = () => undefined;
  function Hear() {
    play = useSound();
    return null;
  }
  renderGame(<Hear />, memoryServices());
  play('coin');
  expect(heard).toEqual(['coin']);
  device.languages = ['ru'];
  kv.set('left', 'over');
  router.push('/left-over');
});

test('the sounds the game makes are written down, and the next test starts with none (2/2)', () => {
  expect(heard).toEqual([]);
  expect(kv.size).toBe(0);
  expect(device.languages).toEqual(['en']);
  expect(router.push).not.toHaveBeenCalled();
});

test('a life of a test begins with ids, seeds and a clock that never change from one run to the next', async () => {
  const begin = async () => {
    const { sessions, store } = memoryServices();
    await sessions.start('nurse');
    const saved = (await store.loadGame()) as { gameId: string; seed: string; updatedAt: number };
    return { id: saved.gameId, seed: saved.seed, at: saved.updatedAt };
  };
  const first = await begin();
  expect(first).toEqual({ id: 'id-1', seed: 'screen-seed-1', at: 1_001 });
  expect(await begin()).toEqual(first);
});

test('no tap is ever too soon unless a test asks for the guard, and saving works unless a test says it does not', () => {
  const plain = memoryServices();
  expect(plain.tapGuardMs).toBe(0);
  expect(plain.saving?.degraded()).toBe(false);
  const asked = memoryServices(undefined, { tapGuardMs: 400, savingOff: true });
  expect(asked.tapGuardMs).toBe(400);
  expect(asked.saving?.degraded()).toBe(true);
});

test('services made over a store find the life that store holds', async () => {
  const first = memoryServices();
  await first.sessions.start('nurse');
  const { session } = await memoryServices(first.store).sessions.resume();
  expect(session?.lifeId).toBe('nurse');
});
