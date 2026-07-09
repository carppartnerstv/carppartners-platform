import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPage, getPageMetadata } from '@/lib/pages';
import { StaticPageLayout, StaticPageContent } from '@/components/StaticPageLayout';

const SLUG = 'politica-de-cookies';

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata(SLUG);
}

export default async function PoliticaDeCookiesPage() {
  const page = await getPage(SLUG);
  if (!page) notFound();
  return (
    <StaticPageLayout title={page.title}>
      <StaticPageContent html={page.content} />
    </StaticPageLayout>
  );
}
