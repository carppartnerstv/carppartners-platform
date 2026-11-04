/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@carp-partners/api-client', '@carp-partners/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
      { protocol: 'https', hostname: '*.vimeocdn.com' },
      // Imágenes subidas por el admin (portadas, avatares, carrusel, páginas),
      // servidas por el backend bajo /uploads/* — ambos dominios de
      // producción (ver backend/.env.example: PUBLIC_URL vs PUBLIC_WEB_URL).
      { protocol: 'https', hostname: 'carppartners.tv' },
      { protocol: 'https', hostname: 'www.carppartners.tv' },
      { protocol: 'https', hostname: 'app.carppartners.tv' },
      // Desarrollo local: backend en :3001. Si pruebas desde el móvil por la
      // IP de la LAN en vez de localhost, actualiza el hostname aquí igual
      // que ya haces con NEXT_PUBLIC_API_URL/CORS_ORIGINS si cambia tu IP.
      { protocol: 'http', hostname: 'localhost', port: '3001' },
      { protocol: 'http', hostname: '192.168.1.51', port: '3001' },
    ],
  },
};

module.exports = nextConfig;
