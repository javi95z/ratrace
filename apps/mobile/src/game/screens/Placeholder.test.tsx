// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { WordsProvider } from '../words';
import { Home, PAGES, Placeholder } from './Placeholder';

vi.mock('../../ui/Sprite', () => ({ Sprite: ({ id }: { id: string }) => <div data-sprite={id} /> }));
const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) }));
vi.mock('expo-router', () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('the routes are the web\'s pages', () => {
  expect(PAGES).toEqual(['new', 'play', 'challenge', 'collection', 'records', 'rankings', 'room', 'player', 'legal']);
});

test('home lists every other page under the web\'s title for it, and a press opens it', () => {
  render(<WordsProvider locale="es"><Home /></WordsProvider>);
  expect(screen.getByText('THE RAT RACE')).toBeTruthy();
  for (const [page, title] of [['new', 'Elige una vida'], ['challenge', 'Reto de la semana'], ['room', 'Multijugador'], ['legal', 'Privacidad']] as const) {
    fireEvent.click(screen.getByText(title));
    expect(router.push).toHaveBeenLastCalledWith(`/${page}`);
  }
  expect(router.push).toHaveBeenCalledTimes(4);
});

test('a placeholder shows its page\'s title from the web\'s words and goes back', () => {
  render(<WordsProvider locale="ru"><Placeholder page="rankings" /></WordsProvider>);
  expect(screen.getByText('РЕЙТИНГИ')).toBeTruthy();
  fireEvent.click(screen.getByText('Назад'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('with nothing to go back to, back opens home', () => {
  router.canGoBack.mockReturnValueOnce(false);
  render(<WordsProvider locale="en"><Placeholder page="play" /></WordsProvider>);
  expect(screen.getByText('YOUR LIFE')).toBeTruthy();
  fireEvent.click(screen.getByText('Back'));
  expect(router.replace).toHaveBeenCalledWith('/');
});
