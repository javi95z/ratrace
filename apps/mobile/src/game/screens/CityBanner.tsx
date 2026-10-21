import { cityArt, cityIcon } from '@ratrace/content';
import type { CityLight } from '@ratrace/content';
import { useState } from 'react';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Sprite } from '../../ui/Sprite';
import { spriteBox, spriteOf, type Size } from '../../ui/sprites';
import { PixelText } from '../../ui/text';
import { COLORS, EXTRA } from '../../ui/theme';
import { useWords } from '../context';

/** The size of a skyline whose art is missing (the web's). */
const FALLBACK = { w: 312, h: 66 };

/**
 * The picture stretched behind the skyline, as the web's `background-size: cover; background-position: center` lays it in a banner of
 * `width` by `height`: as large as covers the banner, keeping its shape, its middle on the banner's middle (so it hangs over two sides).
 */
export function skyCover(width: number, height: number, art: Size): { w: number; h: number; x: number; y: number } {
  const times = Math.max(width / art.w, height / art.h);
  const w = art.w * times;
  const h = art.h * times;
  return { w, h, x: (width - w) / 2, y: (height - h) / 2 };
}

/**
 * The web's mask on the skyline, `linear-gradient(to right, transparent 0 2%, 35 % 2% 4%, 70 % 4% 6%, black 6% 94%, …)`: the edges of
 * the banner step out in three bands, so the skyline has no hard side against the sky behind it. The bands that show something, in
 * points across a banner `width` wide, with how much of the skyline each lets through. A skyline that stays inside the middle 88 % (a
 * phone of 402: 312 in 366) is not touched by them, and is one band, drawn whole.
 */
export function edgeBands(width: number, art: number): Array<{ from: number; to: number; alpha: number }> {
  const left = (width - art) / 2;
  if (left >= width * 0.06) return [{ from: 0, to: width, alpha: 1 }];
  const at = (share: number) => width * share;
  return [
    { from: at(0.02), to: at(0.04), alpha: 0.35 },
    { from: at(0.04), to: at(0.06), alpha: 0.7 },
    { from: at(0.06), to: at(0.94), alpha: 1 },
    { from: at(0.94), to: at(0.96), alpha: 0.7 },
    { from: at(0.96), to: at(0.98), alpha: 0.35 },
  ];
}

/**
 * The city the player lives in, as a banner the width of whatever it sits in. The skyline is drawn
 * pixel for pixel in the middle; behind it the same picture, stretched and dimmed, carries its sky
 * and its lights out to both edges, so the banner is never a small strip with empty sides.
 */
export function CityBanner({ cityId, light = 'night' }: { cityId: string; light?: CityLight }) {
  const { names } = useWords();
  const id = cityArt(cityId, light);
  const sprite = spriteOf(id);
  // One art pixel a point: the phone's stage (the web's `--art` is 2 only on a desk's wide column).
  const art = spriteBox(id, 1, 1, FALLBACK);
  const [width, setWidth] = useState<number | null>(null);
  const name = names.cities[cityId];
  const sky = width === null || !sprite ? null : skyCover(width, art.h, art);
  // Until the banner is measured, the skyline is drawn whole, in the middle.
  const bands = width === null ? null : edgeBands(width, art.w);
  const left = width === null ? 0 : (width - art.w) / 2;
  return (
    // The double frame is drawn outside the box, so the box that clips the pictures is the one inside it.
    <Framed kind="double" style={{ marginHorizontal: 6, marginBottom: 6, marginTop: 4, height: art.h, backgroundColor: COLORS['night-900'] }}>
      <View {...{ dataSet: { cityLight: light } }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flex: 1, overflow: 'hidden' }}>
        {sky && width !== null ? (
          // Drawn in a canvas the banner's size, where it falls: a box of the phone stands on whole device pixels, the browser's background does not.
          <View style={{ position: 'absolute', left: 0, top: 0, opacity: 0.4 }}>
            <Sprite id={id} size={{ w: width, h: art.h }} place={sky} />
          </View>
        ) : null}
        {bands === null || bands.length === 1 ? (
          // Whole, in the middle.
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' }}>
            <Sprite id={id} scale="art" alt={name} fallback={FALLBACK} />
          </View>
        ) : (
          bands.map((band, i) => (
            // Each band shows the part of the skyline under it, as much of it as the mask lets through.
            <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: band.from, width: band.to - band.from, overflow: 'hidden', opacity: band.alpha }}>
              <View style={{ position: 'absolute', top: 0, left: left - band.from }}>
                <Sprite id={id} scale="art" alt={band.alpha === 1 ? name : ''} fallback={FALLBACK} />
              </View>
            </View>
          ))
        )}
        {/* Where you are, on the picture itself. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: EXTRA.label, paddingVertical: 2, paddingLeft: 2, paddingRight: 8 }}
        >
          <Sprite id={cityIcon(cityId)} />
          <PixelText size={15} lineHeight={15} style={{ letterSpacing: 15 * 0.08 }}>{name.toUpperCase()}</PixelText>
        </View>
      </View>
    </Framed>
  );
}
