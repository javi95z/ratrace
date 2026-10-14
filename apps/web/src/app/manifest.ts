import type { MetadataRoute } from 'next';

/** Install metadata shared by all languages; `/` chooses the player's language on first launch. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'The Rat Race',
    short_name: 'Rat Race',
    description: 'Forty years, twenty rounds. Get rich, gain status and escape the rat race.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#141b33',
    theme_color: '#141b33',
    categories: ['games', 'strategy'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
