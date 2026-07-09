import type { Metadata } from 'next';
import type { PublicPage } from '@carp-partners/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetch server-side (generateMetadata + Server Components) — GET /pages/:slug
// es público, así que no necesita el apiClient del navegador ni tokens.
export async function getPage(slug: string): Promise<PublicPage | null> {
  try {
    // Tráfico bajo (Sobre nosotros, legales, Contacto) — revalidar cada 10s
    // en vez de cachear más tiempo, para que los cambios del panel admin se
    // reflejen casi al momento sin sacrificar el caché por completo.
    const res = await fetch(`${API_URL}/pages/${slug}`, { next: { revalidate: 10 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.page as PublicPage;
  } catch {
    return null;
  }
}

// Metadata SEO (título, descripción, og:image) a partir de los campos
// editables de la página, con fallback razonable si no se han rellenado.
export async function getPageMetadata(slug: string): Promise<Metadata> {
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: page.meta_title || `${page.title} — Carp Partners TV`,
    description: page.meta_description || undefined,
    openGraph: page.og_image
      ? { title: page.meta_title || page.title, description: page.meta_description || undefined, images: [page.og_image] }
      : undefined,
  };
}
