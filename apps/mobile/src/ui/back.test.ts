import { expect, test } from 'vitest';
import { sheetOpened, sheetsGone } from './back';

/** Whether a promise has settled, after the microtasks that were already queued. */
async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => (done = true));
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

test('with no sheet open there is nothing to wait for', async () => {
  expect(await settled(sheetsGone())).toBe(true);
});

test('it waits for every sheet that is open, and is told once the last has dismissed', async () => {
  const first = sheetOpened();
  const second = sheetOpened();
  const gone = sheetsGone();
  expect(await settled(gone)).toBe(false);
  first();
  expect(await settled(gone)).toBe(false);
  second();
  await expect(gone).resolves.toBeUndefined();
});

test('a sheet that says it has dismissed twice is counted once', async () => {
  const first = sheetOpened();
  const second = sheetOpened();
  first();
  first();
  const gone = sheetsGone();
  expect(await settled(gone)).toBe(false);
  second();
  await expect(gone).resolves.toBeUndefined();
});

test('everyone who waits is told, and a sheet that opens afterwards is waited for by the next to ask', async () => {
  const sheet = sheetOpened();
  const [a, b] = [sheetsGone(), sheetsGone()];
  sheet();
  await Promise.all([a, b]);
  const later = sheetOpened();
  const next = sheetsGone();
  expect(await settled(next)).toBe(false);
  later();
  await expect(next).resolves.toBeUndefined();
});
