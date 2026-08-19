import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPage, getPageMetadata } from '@/lib/pages';
import { AboutView } from '@/components/AboutView';

const SLUG = 'sobre-carp-partners';

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata(SLUG);
}

// Diseño propio (AboutView), no el genérico de StaticPageLayout — el
// contenido visual ya no depende de `page.content`. Se mantiene la
// comprobación de que la página siga existiendo en /admin/paginas (para
// título/meta SEO) para no dejar la ruta huérfana si se borra desde ahí.
export default async function SobreCarpPartnersPage() {
  const page = await getPage(SLUG);
  if (!page) notFound();
  return <AboutView />;
}
