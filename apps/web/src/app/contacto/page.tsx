import type { Metadata } from 'next';
import { getPageMetadata } from '@/lib/pages';
import { ContactPageView } from '@/components/ContactPageView';

const SLUG = 'contacto';

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata(SLUG);
}

export default function ContactoPage() {
  return <ContactPageView />;
}
