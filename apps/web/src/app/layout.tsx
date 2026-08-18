import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/context/SessionContext';
import { CookieConsentGate } from '@/components/CookieConsentGate';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Carp Partners TV',
  description: 'La plataforma de vídeo especializada en carpfishing',
};

// maximumScale:1 evita el zoom automático de iOS/Android al enfocar un
// <input> — sin esto, tocar un campo de texto en móvil hacía zoom y la
// página quedaba desencuadrada al perder el foco.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#06090c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${sora.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.30.0/dist/tabler-icons.min.css"
        />
      </head>
      <body className="bg-surface text-white min-h-screen antialiased">
        <SessionProvider>
          <CookieConsentGate>{children}</CookieConsentGate>
        </SessionProvider>
      </body>
    </html>
  );
}
