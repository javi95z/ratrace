import { registerAsset } from 'react-native-web/dist/modules/AssetRegistry';
import { expect, test, vi } from 'vitest';
import { uriOf } from './assetUri.web';

test('an asset of the bundle is its address: a registry number as react-native-web serves it, an object with an address, the address itself', () => {
  const id = registerAsset({ httpServerLocation: '/assets/assets/fonts', name: 'Exo2_400Regular_Slant', type: 'ttf', scales: [1] });
  expect(uriOf(id)).toBe('/assets/assets/fonts/Exo2_400Regular_Slant.ttf');
  expect(uriOf({ uri: '/a.ttf' })).toBe('/a.ttf');
  expect(uriOf('/b.ttf')).toBe('/b.ttf');
  expect(uriOf({ uri: '' })).toBeNull();
  expect(uriOf(987654)).toBeNull();
  vi.stubGlobal('devicePixelRatio', 3);
  expect(uriOf(registerAsset({ httpServerLocation: '/assets', name: 'x', type: 'png', scales: [1, 3] }))).toBe('/assets/x@3x.png');
  vi.unstubAllGlobals();
});
