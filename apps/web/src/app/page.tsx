import type { Metadata } from 'next';
import { LandingPageClient } from './LandingPageClient';

export const metadata: Metadata = {
  title: 'Carp Partners TV — Streaming de carpfishing: series, documentales y técnicas de pesca de carpa',
  description:
    'Carp Partners TV es la plataforma de streaming especializada en carpfishing en España. Series, documentales y técnicas de pesca de carpa en HD/4K, contenido nuevo cada semana, desde 6,67€/mes.',
};

export default function LandingPage() {
  return <LandingPageClient />;
}
