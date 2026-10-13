// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sprite, spriteOf } from './Sprite';

afterEach(cleanup);

describe('Sprite', () => {
  it('draws a thing not owned yet as its outline in a colour of the palette, with no name of its own', () => {
    const { container } = render(<Sprite id="item.watch_rolex" alt="Rolex Submariner" silhouette />);
    expect(container.querySelector('img')).toBeNull();
    const shadow = container.querySelector('[data-silhouette="item.watch_rolex"]') as HTMLElement;
    expect(shadow.getAttribute('aria-hidden')).toBe('true');
    expect(shadow.style.maskImage).toContain('/sprites/items/item.watch_rolex.png');
    expect(shadow.style.width).toBe('64px');
    expect(shadow.className).toContain('bg-night-500');
  });

  it('shows the placeholder, once reported, when a sprite it knows does not arrive', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Sprite id="item.watch_omega" alt="Omega" />);
    const img = container.querySelector('img') as HTMLImageElement;
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    const placeholder = container.querySelector('[data-sprite-missing="item.watch_omega"]') as HTMLElement;
    expect(placeholder.getAttribute('aria-label')).toBe('Omega');
    expect(placeholder.style.width).toBe('64px');
    expect(warn).toHaveBeenCalledWith('sprite did not load: item.watch_omega');
    warn.mockRestore();
  });

  it('draws a sprite at its own size, pixel for pixel', () => {
    const { container } = render(<Sprite id="item.watch_rolex" alt="Rolex Submariner" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/sprites/items/item.watch_rolex.png');
    expect(img.alt).toBe('Rolex Submariner');
    expect(img.className).toContain('sprite');
    expect(img.style.width).toBe('64px');
    expect(img.style.height).toBe('64px');
  });

  it('scales by whole numbers, or follows the stage', () => {
    const twice = render(<Sprite id="car.porsche_911" scale={2} />).container.querySelector('img') as HTMLImageElement;
    expect(twice.style.width).toBe('192px');
    expect(twice.style.height).toBe('96px');
    const staged = render(<Sprite id="card.bar" scale="art" />).container.querySelector('img') as HTMLImageElement;
    expect(staged.style.width).toBe('calc(288px * var(--art))');
  });

  it('is hidden from a screen reader when it only decorates', () => {
    const img = render(<Sprite id="icon.cash" />).container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.alt).toBe('');
  });

  it('draws a placeholder for a sprite that does not exist, and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = render(<Sprite id="item.jetpack" alt="Jetpack" fallback={{ w: 64, h: 64 }} />).container;
    render(<Sprite id="item.jetpack" />);
    expect(first.querySelector('img')).toBeNull();
    const placeholder = first.querySelector('[data-sprite-missing="item.jetpack"]') as HTMLElement;
    expect(placeholder.getAttribute('role')).toBe('img');
    expect(placeholder.getAttribute('aria-label')).toBe('Jetpack');
    expect(placeholder.style.width).toBe('64px');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('sprite missing: item.jetpack');
    warn.mockRestore();
  });

  it('knows the size of a sprite, and that a stranger has none', () => {
    expect(spriteOf('skyline.madrid')).toEqual({ src: 'skylines/skyline.madrid.png', w: 312, h: 66 });
    expect(spriteOf('constructor')).toBeNull();
    expect(spriteOf('nope')).toBeNull();
  });
});
