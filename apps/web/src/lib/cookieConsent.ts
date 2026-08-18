export interface ConsentState {
  analytics: boolean;
}

const CONSENT_COOKIE = 'cp_consent';
const CONSENT_MAX_AGE_DAYS = 365;

export function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    if (typeof parsed?.analytics === 'boolean') return { analytics: parsed.analytics };
    return null;
  } catch {
    return null;
  }
}

export function writeConsentCookie(consent: ConsentState) {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify({ analytics: consent.analytics, ts: Date.now() }));
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax${secure}`;
}

// Al revocar el consentimiento analítico, el script de GA deja de cargarse
// en la siguiente carga, pero las cookies que ya hubiera escrito (_ga,
// _ga_<id>, _gid) no se limpian solas — hay que borrarlas explícitamente.
export function deleteGoogleAnalyticsCookies() {
  if (typeof document === 'undefined') return;
  const names = document.cookie
    .split('; ')
    .map((c) => c.split('=')[0])
    .filter((n) => n === '_ga' || n === '_gid' || n.startsWith('_ga_'));
  const hostname = window.location.hostname;
  for (const name of names) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${name}=; path=/; domain=${hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${name}=; path=/; domain=.${hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}
