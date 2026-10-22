// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { rulesOf } from '@/testing/stylesheet';
import { Bar, Button, Panel, Segmented, Toggle } from './kit';

afterEach(cleanup);

describe('Button', () => {
  const classesOf = (className?: string) => {
    render(<Button className={className}>Go</Button>);
    const classes = screen.getByRole('button', { name: 'Go' }).className.split(' ');
    cleanup();
    return classes;
  };

  it('is 17 with 16 in each side and 8 above and below, of its own', () => {
    expect(classesOf()).toEqual(expect.arrayContaining(['px-4', 'py-2', 'text-[17px]', 'min-h-11']));
  });

  it('takes a screen\'s own size and sides in place of its own: the screen\'s are drawn, not lost to the Button\'s written after them', () => {
    // The basket's button beside the round's (Play), and the savings' two beside their figure (Finance).
    const basket = classesOf('shrink-0 px-3 text-[14px]');
    expect(basket).toEqual(expect.arrayContaining(['shrink-0', 'px-3', 'text-[14px]', 'py-2']));
    expect(basket).not.toContain('px-4');
    expect(basket).not.toContain('text-[17px]');
    const save = classesOf('shrink-0 px-2 text-[13px]');
    expect(save).toEqual(expect.arrayContaining(['px-2', 'text-[13px]']));
    expect(save.filter((name) => /^(px-|text-\[)/.test(name))).toEqual(['px-2', 'text-[13px]']);
    // A size alone keeps the Button's sides; padding all round takes the place of both of its own.
    expect(classesOf('self-start text-[14px]')).toEqual(expect.arrayContaining(['px-4', 'py-2', 'text-[14px]']));
    const padded = classesOf('p-1');
    expect(padded).toContain('p-1');
    expect(padded).not.toContain('px-4');
    expect(padded).not.toContain('py-2');
    expect(padded).toContain('text-[17px]');
    expect(classesOf('text-sm')).not.toContain('text-[17px]');
  });

  it('keeps its own size and sides for anything else a screen gives it: a place, a colour, a size at another width', () => {
    // One side of a screen's (`pl-2`) is written after the Button's two, so it is drawn with them: the Button keeps the other.
    for (const className of ['mt-2', 'flex-1', 'w-full', 'max-sm:hidden', 'sm:px-2 sm:text-[13px]', 'text-ink-900', 'pl-2', 'pt-1']) {
      expect(classesOf(className), className).toEqual(expect.arrayContaining(['px-4', 'py-2', 'text-[17px]', ...className.split(' ')]));
    }
  });

  it('gives up its own where the stylesheet would draw them over a screen\'s, and keeps them where it would not: the order the stylesheet compiles', async () => {
    const order = (await rulesOf('px-4 py-2 text-[17px] p-1 px-3 px-2 pl-2 pt-1 text-sm text-[14px] text-[13px]')).map((rule) => rule.selector.slice(1).replace(/\\/g, ''));
    const at = (name: string) => {
      expect(order, name).toContain(name);
      return order.indexOf(name);
    };
    // Written before the Button's own, so lost to them if both were kept: the Button leaves its own out.
    for (const name of ['p-1', 'px-3', 'px-2']) expect(at(name), name).toBeLessThan(at('px-4'));
    expect(at('p-1')).toBeLessThan(at('py-2'));
    for (const name of ['text-sm', 'text-[14px]', 'text-[13px]']) expect(at(name), name).toBeLessThan(at('text-[17px]'));
    // Written after them, so drawn over them with both kept: the Button keeps its own.
    expect(at('pl-2')).toBeGreaterThan(at('px-4'));
    expect(at('pt-1')).toBeGreaterThan(at('py-2'));
  });
});

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
  const lit = (bar: HTMLElement) => Number(bar.querySelector('[data-lamps]')?.getAttribute('data-lit'));

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

describe('a frame and a shadow of its own', () => {
  it('are never two classes of one element: the frame\'s box-shadow comes after a `shadow-*` or `ring-*` in the stylesheet and takes its place, so a frame names what it stands in as `--glow`', () => {
    const FRAMES = ['frame', 'bevel', 'sunk', 'frame-raised', 'lamp', 'frame-double', 'tab'];
    const files = readdirSync(join(__dirname, '..'), { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
    const both: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      for (const [, classes] of source.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
        const names = classes.split(/\s+/);
        if (names.some((name) => FRAMES.includes(name)) && names.some((name) => /^(shadow|ring|inset-shadow|inset-ring)-/.test(name))) both.push(`${file}: ${classes}`);
      }
    }
    expect(both).toEqual([]);
  });
});
