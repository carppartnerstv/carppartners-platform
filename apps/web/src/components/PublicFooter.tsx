import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface FooterLink {
  label: string;
  href?: string;
}

const FOOTER_COLS: { title: string; links: FooterLink[] }[] = [
  { title: 'Plataforma', links: [
    { label: 'Catálogo', href: '/#catalogo' },
    { label: 'Series' },
    { label: 'Documentales' },
    { label: 'Planes', href: '/#planes' },
  ] },
  { title: 'Empresa', links: [
    { label: 'Sobre nosotros', href: '/sobre-carp-partners' },
    { label: 'Contacto', href: '/contacto' },
    { label: 'Trabaja con nosotros' },
  ] },
  { title: 'Ayuda', links: [
    { label: 'Centro de ayuda' }, { label: 'Cuenta' }, { label: 'Dispositivos' }, { label: 'Estado' },
  ] },
];

const SOCIAL_LINKS = [
  { icon: 'brand-youtube', href: 'https://www.youtube.com/@CarpPartners' },
  { icon: 'brand-tiktok', href: 'https://www.tiktok.com/@carppartners' },
  { icon: 'brand-instagram', href: 'https://www.instagram.com/carp_partners/' },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Privacidad', href: '/politica-de-privacidad' },
  { label: 'Términos', href: '/terminos-de-uso' },
  { label: 'Cookies', href: '/politica-de-cookies' },
  { label: 'Aviso legal', href: '/aviso-legal' },
];

// Pie de página público compartido por la landing y las páginas fijas.
export function PublicFooter() {
  return (
    <footer className="px-6 md:px-14 pt-[50px] pb-10" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
        <div>
          <Image src="/carp-partners-logo blanc.png" alt="Carp Partners TV" width={100} height={17} className="h-6 w-auto mb-4" />
          <p className="text-[13.5px] leading-relaxed mb-[18px] max-w-[260px]" style={{ color: '#7d8d86' }}>
            La primera plataforma de streaming especializada en carpfishing. Hecha en España.
          </p>
          <div className="flex gap-2.5">
            {SOCIAL_LINKS.map(({ icon, href }) => (
              <a
                key={icon} href={href} target="_blank" rel="noopener noreferrer"
                className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-colors hover:text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9aa9a3' }}
              >
                <i className={`ti ti-${icon} text-[19px]`} />
              </a>
            ))}
          </div>
        </div>
        {FOOTER_COLS.map(col => (
          <div key={col.title}>
            <div className="text-[13px] font-semibold mb-4" style={{ color: '#cdd6d2' }}>{col.title}</div>
            {col.links.map(l => l.href ? (
              <Link key={l.label} href={l.href} className="block text-[13.5px] py-1.5 transition-colors hover:text-white/70" style={{ color: '#7d8d86' }}>{l.label}</Link>
            ) : (
              <div key={l.label} className="text-[13.5px] py-1.5 cursor-pointer transition-colors hover:text-white/70" style={{ color: '#7d8d86' }}>{l.label}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="max-w-[1100px] mx-auto mt-9 pt-6 flex items-center justify-between flex-wrap gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-[12.5px]" style={{ color: '#6a7a73' }}>© 2026 Carp Partners TV. Todos los derechos reservados.</div>
        <div className="flex gap-[22px] text-[12.5px]" style={{ color: '#6a7a73' }}>
          {LEGAL_LINKS.map(l => (
            <Link key={l.label} href={l.href!} className="hover:text-white/50 transition-colors">{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
