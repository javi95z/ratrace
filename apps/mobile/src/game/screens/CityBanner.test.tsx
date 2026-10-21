// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { CityBanner, edgeBands, skyCover } from './CityBanner';

afterEach(cleanup);

describe('the banner of a city', () => {
  it('draws the city in the light asked for, and says where it is on the picture itself', async () => {
    const { container } = renderGame(<CityBanner cityId="madrid" light="crisis" />, memoryServices());
    await screen.findByText('MADRID');
    expect(container.querySelector('[data-city-light]')?.getAttribute('data-city-light')).toBe('crisis');
    expect(container.querySelector('[data-sprite="skyline.madrid.crisis"]')).toBeTruthy();
    expect(container.querySelector('[data-sprite="icon.city_madrid"]')).toBeTruthy();
  });

  it('is drawn by night where no light is named', async () => {
    const { container } = renderGame(<CityBanner cityId="tokyo" />, memoryServices(), 'es');
    await screen.findByText('TOKIO');
    expect(container.querySelector('[data-sprite="skyline.tokyo"]')).toBeTruthy();
  });

  it('carries the sky of the picture out to both edges: the same picture behind it, covering the banner and centred', () => {
    // A banner of 366 by 66 for a skyline of 312 by 66: as wide as the banner, as tall as that makes it, its middle on the banner's.
    const cover = skyCover(366, 66, { w: 312, h: 66 });
    expect(cover.w).toBe(366);
    expect(cover.h).toBeCloseTo(77.423, 3);
    expect(cover.x).toBe(0);
    expect(cover.y).toBeCloseTo(-5.712, 3);
    // A taller banner than the picture would be: as tall, as wide as that makes it.
    expect(skyCover(100, 66, { w: 312, h: 66 })).toEqual({ w: 312, h: 66, x: -106, y: 0 });
  });

  it('lets the skyline fade at its edges in three steps where it reaches them, and draws it whole where it does not', () => {
    // On a phone of 402 the banner is 366 and the skyline 312: it stays inside the middle, where nothing is faded.
    expect(edgeBands(366, 312)).toEqual([{ from: 0, to: 366, alpha: 1 }]);
    // On a phone of 360 the banner is 324 and the skyline's first and last six points are under the steps.
    const bands = edgeBands(324, 312);
    expect(bands.map((band) => band.alpha)).toEqual([0.35, 0.7, 1, 0.7, 0.35]);
    expect(bands[0].from).toBeCloseTo(6.48, 5);
    expect(bands[2]).toEqual({ from: expect.closeTo(19.44, 5), to: expect.closeTo(304.56, 5), alpha: 1 });
    expect(bands[4].to).toBeCloseTo(317.52, 5);
  });
});
