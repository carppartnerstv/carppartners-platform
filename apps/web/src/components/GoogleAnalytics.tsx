'use client';

import Script from 'next/script';

// No lo importes/renderices incondicionalmente: solo debe montarse cuando
// ya hay consentimiento analítico (lo decide CookieConsentGate). Next.js
// inyecta el <script> en el momento en que este componente se monta en el
// cliente — mientras no se monte, no hay ninguna petición a
// googletagmanager.com ni ninguna cookie _ga.
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
