import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Carp Partners TV',
    short_name: 'Carp Partners TV',
    description: 'La plataforma de vídeo especializada en carpfishing',
    start_url: '/',
    display: 'standalone',
    background_color: '#06090c',
    theme_color: '#06090c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
