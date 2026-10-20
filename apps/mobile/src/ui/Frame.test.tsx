// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Text } from 'react-native';
import { Framed } from './Frame';
import { anchorsOf } from './frames';

test('Framed draws its strips on the first render and leaves the children alone', () => {
  const { container } = render(
    <Framed kind="bevel" tone={{}}>
      <Text>hello</Text>
    </Framed>,
  );
  const root = container.firstElementChild as HTMLElement;
  const kids = Array.from(root.children) as HTMLElement[];
  const n = anchorsOf('bevel', {}).length;
  expect(kids).toHaveLength(n + 1);
  for (const strip of kids.slice(0, n)) {
    expect(strip.style.position).toBe('absolute');
    expect(strip.style.backgroundColor).not.toBe('');
  }
  expect(kids[n].textContent).toBe('hello');
  expect(kids[n].style.position).not.toBe('absolute');
});
