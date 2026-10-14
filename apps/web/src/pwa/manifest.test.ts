import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('the web app manifest', () => {
  it('launches as a standalone app with ordinary and maskable icons', () => {
    const value = manifest();
    expect(value).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', theme_color: '#141b33' });
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]));
  });
});
