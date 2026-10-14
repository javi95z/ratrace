// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Bar, Panel, Segmented, Toggle } from './kit';

afterEach(cleanup);

describe('Panel', () => {
  it('hangs its title on a tab, as a heading, and answers to a name', () => {
    render(
      <Panel title="News" label="News">
        <p>inside</p>
      </Panel>,
    );
    const panel = screen.getByRole('region', { name: 'News' });
    const title = within(panel).getByRole('heading', { level: 2, name: 'News' });
    // Named by its own heading, so a screen reader says the name once.
    expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
    expect(panel.hasAttribute('aria-label')).toBe(false);
    // The tab stands over the top edge, so the panel leaves room above itself for it.
    expect(title.className).toMatch(/\babsolute\b/);
    expect(panel.className).toMatch(/\brelative\b/);
    expect(panel.className).toMatch(/\bmt-3\b/);
  });

  it('takes a name of its own when it has no title to be named by', () => {
    render(
      <Panel label="Gauges">
        <p>inside</p>
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Gauges' }).getAttribute('aria-label')).toBe('Gauges');
  });

  it('leaves no room for a tab it does not have', () => {
    const { container } = render(
      <Panel>
        <p>inside</p>
      </Panel>,
    );
    expect(container.querySelector('section')?.className).not.toMatch(/\bmt-3\b/);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('Bar', () => {
  const lit = (bar: HTMLElement) => [...bar.querySelectorAll('span')].filter((cell) => /\blamp\b/.test(cell.className)).length;

  it('lights its lamps from the left, and says how far along it is', () => {
    render(<Bar value={5} max={16} label="Progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Progress' });
    expect(lit(bar)).toBe(5);
    expect(bar.getAttribute('aria-valuenow')).toBe('31');
    expect(bar.querySelector('[data-door]')).toBeNull();
  });

  it('ends at a door that stays shut until the last lamp is lit', () => {
    const { rerender } = render(<Bar value={15} max={16} label="Rat race" door />);
    const door = () => screen.getByRole('progressbar').querySelector('[data-door]');
    expect(door()?.getAttribute('data-door')).toBe('shut');
    rerender(<Bar value={16} max={16} label="Rat race" door />);
    expect(door()?.getAttribute('data-door')).toBe('open');
    rerender(<Bar value={40} max={16} label="Rat race" door />);
    expect(door()?.getAttribute('data-door')).toBe('open');
    // The door is not a lamp: sixteen is still all there are.
    expect(lit(screen.getByRole('progressbar'))).toBe(16);
  });
});

describe('choices with pictures', () => {
  it('uses one Tab stop and moves selection with the appropriate arrows, Home and End', async () => {
    const user = userEvent.setup();
    function Choices() {
      const [value, setValue] = useState('a');
      return <Segmented<string> label="How" value={value} onChange={setValue} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }]} />;
    }
    render(<Choices />);
    const radios = () => screen.getAllByRole('radio');
    radios()[0].focus();
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'C' }));
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'C' }));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'A' }));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'C' }));
  });

  it('draws the picture of each choice that has one', () => {
    render(<Segmented label="How" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A', icon: 'icon.cash' }, { value: 'b', label: 'B' }]} />);
    const [a, b] = screen.getAllByRole('radio');
    expect(a.querySelector('img')?.getAttribute('src')).toContain('icon.cash');
    expect(b.querySelector('img')).toBeNull();
  });

  it('draws the picture of a switch before its label', () => {
    render(<Toggle on={false} onChange={() => {}} label="Health insurance" icon="icon.insurance" />);
    const control = screen.getByRole('switch', { name: 'Health insurance' });
    expect(control.querySelector('img')?.getAttribute('src')).toContain('icon.insurance');
  });
});
