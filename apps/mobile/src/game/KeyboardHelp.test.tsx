// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../testing/render';
import { settled } from '../testing/renders';
import { KeyboardControls } from './KeyboardHelp';
import { Preferences } from './screens/Settings';

afterEach(cleanup);

it('has no keys on the phone: nothing in the settings, no reference, nothing listening', async () => {
  renderGame(
    <>
      <KeyboardControls />
      <Preferences />
    </>,
    memoryServices(),
  );
  await settled();
  expect(screen.queryByRole('button', { name: 'Keyboard controls' })).toBeNull();
  expect(document.documentElement.dataset.input).toBeUndefined();
});
