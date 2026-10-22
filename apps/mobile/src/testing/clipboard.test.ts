import { expect, test } from 'vitest';
import { copy } from '../ui/copy';
import { clipboard } from './fakes';

// A screen's test copies on the clipboard's stand-in (setup.ts), and reads what was put on it.
test('a screen\'s test copies on the stand-in clipboard, which a test can make refuse', async () => {
  let told = 0;
  await expect(copy('K7Q2XM', () => told++)).resolves.toBe(true);
  expect(clipboard.text).toBe('K7Q2XM');
  clipboard.refuses = true;
  await expect(copy('other', () => told++)).resolves.toBe(false);
  expect(clipboard.text).toBe('K7Q2XM');
  expect(told).toBe(1);
});

test('each test starts with an empty clipboard that takes what it is given', () => {
  expect(clipboard).toEqual({ text: null, refuses: false });
});
