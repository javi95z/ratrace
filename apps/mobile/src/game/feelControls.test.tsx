// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { HapticProvider } from '../ui/haptic';
import type { Haptic } from '../ui/haptic';
import { Segmented, Toggle } from '../ui/kit';
import { Tabs } from '../ui/overlay';
import { Picker } from '../ui/Picker';

/*
 * The kit's controls say to the touch what a phone's own controls say (ui/haptic.tsx): a switch turned, another choice taken. A choice already on,
 * a button pressed, says nothing.
 */

afterEach(cleanup);

function feeling(ui: (felt: Haptic[]) => React.ReactElement) {
  const felt: Haptic[] = [];
  render(<HapticProvider value={(kind) => void felt.push(kind)}>{ui(felt)}</HapticProvider>);
  return felt;
}

function Switch() {
  const [on, setOn] = useState(false);
  return <Toggle on={on} onChange={setOn} label="Sound" />;
}

test('a switch is felt as it turns, on and then off', () => {
  const felt = feeling(() => <Switch />);
  fireEvent.click(screen.getByRole('switch', { name: /Sound/ }));
  fireEvent.click(screen.getByRole('switch', { name: /Sound/ }));
  expect(felt).toEqual(['toggleOn', 'toggleOff']);
});

function Choices() {
  const [value, setValue] = useState<'a' | 'b'>('a');
  return <Segmented<'a' | 'b'> label="Pace" value={value} onChange={setValue} options={[{ value: 'a', label: 'Slow' }, { value: 'b', label: 'Fast' }]} />;
}

test('a segment is felt as another choice is taken, never for the one already on', () => {
  const felt = feeling(() => <Choices />);
  fireEvent.click(screen.getByRole('radio', { name: /Slow/ }));
  expect(felt).toEqual([]);
  fireEvent.click(screen.getByRole('radio', { name: /Fast/ }));
  expect(felt).toEqual(['select']);
});

function Strip() {
  const [value, setValue] = useState<'one' | 'two'>('one');
  return <Tabs<'one' | 'two'> label="Finance" value={value} onChange={setValue} tabs={[{ id: 'one', label: 'Portfolio' }, { id: 'two', label: 'Market' }]} />;
}

test('a tab is felt as another is taken, never for the one in front', () => {
  const felt = feeling(() => <Strip />);
  fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }));
  expect(felt).toEqual([]);
  fireEvent.click(screen.getByRole('tab', { name: 'Market' }));
  expect(felt).toEqual(['select']);
});

function Pick() {
  const [value, setValue] = useState<string | null>('a');
  return <Picker label="City" value={value} onChange={setValue} closeLabel="Close" options={[{ value: 'a', label: 'Madrid' }, { value: 'b', label: 'Tokyo' }]} />;
}

test('a picker is felt as another option is taken, never for the one already chosen, nor for opening it', async () => {
  const felt = feeling(() => <Pick />);
  fireEvent.click(screen.getByRole('button', { name: /City/ }));
  fireEvent.click(await screen.findByRole('radio', { name: /Tokyo/ }));
  expect(felt).toEqual(['select']);
});
