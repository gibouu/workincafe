import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Work in Cafe',
    short_name: 'Workin',
    description: 'Find places to work or study outside the home.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2EDE3',
    theme_color: '#F2EDE3',
    categories: ['productivity', 'lifestyle', 'travel'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
