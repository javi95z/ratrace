import { afterEach, expect, test, vi } from 'vitest';
import { registerWorker } from './register.web';

/** A browser's `navigator.serviceWorker`, whose `register` answers with a registration that can be told to look for a new worker. */
function workers(refused?: () => Promise<never>) {
  const update = vi.fn(async () => undefined);
  const register = refused ? vi.fn(refused) : vi.fn(async () => ({ update }));
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
  return { register, update };
}

const readyState = (state: DocumentReadyState) => Object.defineProperty(document, 'readyState', { value: state, configurable: true });
const settle = () => new Promise((done) => setTimeout(done, 0));

afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  readyState('complete');
});

test('a production page registers /sw.js for the whole site, the worker file never taken from the browser\'s cache, and looks for a new one back online', async () => {
  const { register, update } = workers();
  readyState('complete');
  const stop = registerWorker(true);
  await settle();
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  window.dispatchEvent(new Event('online'));
  expect(update).toHaveBeenCalledTimes(1);
  stop();
  window.dispatchEvent(new Event('online'));
  expect(update).toHaveBeenCalledTimes(1);
});

test('a page still loading registers once it has loaded, not before', async () => {
  const { register } = workers();
  readyState('loading');
  const stop = registerWorker(true);
  await settle();
  expect(register).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('load'));
  await settle();
  expect(register).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('load'));
  await settle();
  expect(register).toHaveBeenCalledTimes(1);
  stop();
});

test('a page left before it loaded registers nothing', async () => {
  const { register } = workers();
  readyState('loading');
  registerWorker(true)();
  window.dispatchEvent(new Event('load'));
  await settle();
  expect(register).not.toHaveBeenCalled();
});

test('the development server and the tests register nothing: a cached development build would hide its own changes', async () => {
  const { register } = workers();
  registerWorker(false)();
  // As this run is: neither a development server nor a test is a production build.
  registerWorker();
  await settle();
  expect(register).not.toHaveBeenCalled();
});

test('a browser with no workers, or one that refuses this one, still opens the game', async () => {
  expect(() => registerWorker(true)()).not.toThrow();
  const { register } = workers(async () => {
    throw new Error('SecurityError');
  });
  const stop = registerWorker(true);
  await settle();
  expect(register).toHaveBeenCalledTimes(1);
  // Back online with no registration: nothing to update, nothing thrown.
  expect(() => window.dispatchEvent(new Event('online'))).not.toThrow();
  stop();
});
