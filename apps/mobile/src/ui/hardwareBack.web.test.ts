import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BackHandler } from 'react-native';
import { afterEach, expect, test, vi } from 'vitest';
import { onHardwareBack } from './hardwareBack.web';

afterEach(() => vi.restoreAllMocks());

test('the web has no Back button of the device to listen to: nothing is asked of BackHandler, which only says on the web that it is not there', () => {
  const asked = vi.spyOn(BackHandler, 'addEventListener');
  const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const handler = vi.fn(() => true);
  const stop = onHardwareBack(handler);
  stop();
  expect(asked).not.toHaveBeenCalled();
  expect(said).not.toHaveBeenCalled();
  expect(handler).not.toHaveBeenCalled();
});

test('the screens listen to the device\'s Back through the kit, never BackHandler itself', () => {
  const play = readFileSync(join(__dirname, '../game/screens/Play.tsx'), 'utf8');
  expect(play).not.toContain('BackHandler');
  expect(play).toContain("import { onHardwareBack } from '../../ui/hardwareBack';");
});
