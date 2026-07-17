// =====================================================================
// Motor de layout de emails transaccionales — UNA tabla HTML (compatible
// con Gmail/Outlook: <table> + estilos inline, sin flexbox/grid) cuyo
// contenido cambia según el tipo de correo. Basado en el prototipo
// design_handoff_carp_partners_tv/prototype/Carp Partners - Email Template.dc.html
// (recreado desde cero, sin copiar su HTML/CSS literal).
//
// Bloques, en este orden — los marcados "opcional" solo se pintan si se
// pasa el dato correspondiente:
//   1. Header (logo sobre fondo negro)               — siempre
//   2. Imagen hero                                    — opcional
//   3. Eyebrow + título + 1-2 párrafos de cuerpo       — siempre (bodyText2 opcional)
//   4. Bloque de cita del mensaje original             — opcional (respuesta a contacto)
//   5. Botón CTA principal                             — opcional
//   6. Enlace de respaldo en texto plano                — opcional (solo si hay link)
//   7. Nota de caducidad/seguridad                     — opcional
//   8. Lista de ventajas con check                     — opcional (bienvenida)
//   9. Despedida (2 líneas)                            — siempre (línea 2 opcional)
//  10. Footer (redes, enlaces legales, baja)            — siempre
// =====================================================================

// El asset del logo SIEMPRE se sirve desde producción, nunca desde
// PUBLIC_WEB_URL: si en local esa variable apunta a localhost, ningún
// cliente de correo real (Gmail, Outlook...) podría cargar la imagen,
// porque localhost no es accesible fuera de la máquina que lo ejecuta. Los
// enlaces de los botones sí usan PUBLIC_WEB_URL (esos si tiene sentido
// probarlos en local, porque los abre la misma persona que está probando).
const EMAIL_ASSET_BASE_URL = 'https://app.carppartners.tv';
const LOGO_URL = `${EMAIL_ASSET_BASE_URL}/carp-partners-logo%20blanc.png`;

const OUTER_BG = '#e7e9ea'; // fondo del "lienzo" del cliente de correo (Gmail/Outlook en claro)
const CARD_BG = '#0e151a';
const HEADER_BG = '#06090c';
const FOOTER_BG = '#080d11';
const BORDER = '#1c262c';
const BRAND = '#68140b';
const BRAND_BRIGHT = '#cf4a35';
const TEXT_BODY = '#c4d0cb';
const TEXT_MUTED = '#9aa9a3';
const TEXT_DIM = '#7d8d86';
const TEXT_FAINT = '#6a7a73';
const TEXT_FOOTER = '#4f5c57';
const TEXT_COPYRIGHT = '#424d49';
const PERK_TEXT = '#dfe7e3';

const FONT_HEADING = "Sora, Arial, sans-serif";
const FONT_BODY = "Inter, Arial, sans-serif";

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Convierte saltos de línea de un texto de usuario (p. ej. el mensaje de
// contacto) en <br> — se usa después de escapar, nunca antes.
function nl2br(escaped) {
  return escaped.replace(/\n/g, '<br>');
}

/**
 * @param {object} p
 * @param {string} p.eyebrow        Etiqueta corta sobre el título (p. ej. "Bienvenido a bordo")
 * @param {string} p.heading        Título principal (h1)
 * @param {string} p.bodyText1      Primer párrafo de cuerpo
 * @param {string} [p.bodyText2]    Segundo párrafo, opcional
 * @param {string} [p.heroImageUrl] Imagen ancha bajo el header, opcional
 * @param {string} [p.heroImageAlt]
 * @param {string} [p.quoteLabel]   Etiqueta del bloque de cita (por defecto "Tu mensaje original")
 * @param {string} [p.quoteText]    Texto citado — si se pasa, se pinta el bloque
 * @param {{label:string,url:string}} [p.button]        Botón CTA principal
 * @param {{label:string,url:string}} [p.linkFallback]   Enlace de respaldo en texto plano
 * @param {string} [p.note]         Nota de caducidad/seguridad
 * @param {string[]} [p.perks]      Lista de ventajas con check (bienvenida)
 * @param {string} p.signOffLine1   Primera línea de despedida
 * @param {string} [p.signOffLine2] Segunda línea de despedida, opcional
 * @param {string} [p.previewText]  Texto de vista previa (preheader), invisible en el cuerpo
 */
export function renderEmailLayout(p) {
  const heroBlock = p.heroImageUrl ? `
    <tr>
      <td style="padding:0">
        <img src="${p.heroImageUrl}" alt="${escapeHtml(p.heroImageAlt ?? '')}" width="640" style="display:block;width:100%;max-width:640px;height:auto" />
      </td>
    </tr>` : '';

  const bodyText2Block = p.bodyText2 ? `
        <p style="font-family:${FONT_BODY};font-size:15px;line-height:1.7;color:${TEXT_BODY};margin:14px 0 0;text-align:left">${escapeHtml(p.bodyText2)}</p>` : '';

  const quoteBlock = p.quoteText ? `
    <tr>
      <td style="padding:0 44px 8px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-left:3px solid ${BRAND};border-radius:8px">
          <tr><td style="padding:16px 18px">
            <div style="font-family:${FONT_BODY};font-size:11.5px;font-weight:600;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">${escapeHtml(p.quoteLabel ?? 'Tu mensaje original')}</div>
            <div style="font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:#a9b8b1;font-style:italic">${nl2br(escapeHtml(p.quoteText))}</div>
          </td></tr>
        </table>
      </td>
    </tr>` : '';

  const buttonBlock = p.button ? `
    <tr>
      <td style="padding:26px 44px 10px;text-align:center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td style="border-radius:9px;background:${BRAND}">
          <a href="${p.button.url}" style="display:inline-block;padding:14px 32px;font-family:${FONT_BODY};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px">${escapeHtml(p.button.label)}</a>
        </td></tr></table>
      </td>
    </tr>` : '';

  const linkFallbackBlock = p.linkFallback ? `
    <tr>
      <td style="padding:14px 44px 0;text-align:center">
        <p style="font-family:${FONT_BODY};font-size:12.5px;line-height:1.6;color:${TEXT_FAINT};margin:0">${escapeHtml(p.linkFallback.label)}<br/><a href="${p.linkFallback.url}" style="color:${BRAND_BRIGHT};word-break:break-all">${escapeHtml(p.linkFallback.url)}</a></p>
      </td>
    </tr>` : '';

  const noteBlock = p.note ? `
    <tr>
      <td style="padding:22px 44px 0;text-align:center">
        <p style="font-family:${FONT_BODY};font-size:12.5px;line-height:1.6;color:${TEXT_DIM};margin:0">${escapeHtml(p.note)}</p>
      </td>
    </tr>` : '';

  const perksBlock = (p.perks && p.perks.length > 0) ? `
    <tr>
      <td style="padding:34px 44px 6px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${p.perks.map((perk) => `
          <tr><td style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.07)">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:26px;vertical-align:top;padding-top:2px;font-family:${FONT_BODY};font-size:14px;color:${BRAND_BRIGHT};font-weight:700">&#10003;</td>
              <td style="font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${PERK_TEXT}">${escapeHtml(perk)}</td>
            </tr></table>
          </td></tr>`).join('')}
        </table>
      </td>
    </tr>` : '';

  const signOffLine2Block = p.signOffLine2 ? `
        <p style="font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${TEXT_MUTED};margin:0">${escapeHtml(p.signOffLine2)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(p.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${OUTER_BG};font-family:${FONT_BODY}">
  ${p.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(p.previewText)}</div>` : ''}
  <div style="background:${OUTER_BG};padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:${CARD_BG};border-radius:14px;overflow:hidden;border:1px solid ${BORDER}">
      <tr>
        <td style="background:${HEADER_BG};padding:28px 40px;text-align:center;border-bottom:1px solid ${BORDER}">
          <img src="${LOGO_URL}" alt="Carp Partners TV" width="150" style="display:inline-block;height:auto" />
        </td>
      </tr>
      ${heroBlock}
      <tr>
        <td style="padding:44px 44px 8px;text-align:center">
          <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:rgba(104,20,11,0.18);color:${BRAND_BRIGHT};font-family:${FONT_BODY};font-size:11.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:22px">${escapeHtml(p.eyebrow)}</div>
          <h1 style="font-family:${FONT_HEADING};font-weight:800;font-size:26px;line-height:1.25;letter-spacing:-0.01em;color:#ffffff;margin:0 0 16px">${escapeHtml(p.heading)}</h1>
          <p style="font-family:${FONT_BODY};font-size:15px;line-height:1.7;color:${TEXT_BODY};margin:0;text-align:left">${escapeHtml(p.bodyText1)}</p>${bodyText2Block}
        </td>
      </tr>
      ${quoteBlock}
      ${buttonBlock}
      ${linkFallbackBlock}
      ${noteBlock}
      ${perksBlock}
      <tr><td style="padding:34px 44px 44px">
        <div style="height:1px;background:rgba(255,255,255,0.08)"></div>
      </td></tr>
      <tr>
        <td style="padding:0 44px 40px;text-align:center">
          <p style="font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${TEXT_MUTED};margin:0 0 4px">${escapeHtml(p.signOffLine1)}</p>${signOffLine2Block}
        </td>
      </tr>
      <tr>
        <td style="background:${FOOTER_BG};padding:30px 44px;text-align:center;border-top:1px solid ${BORDER}">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px"><tr>
            <td style="padding:0 7px"><a href="https://www.youtube.com/@CarpPartners" style="display:inline-block;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.06);text-align:center;line-height:30px;font-family:${FONT_BODY};font-size:11px;color:${TEXT_FAINT};text-decoration:none">YT</a></td>
            <td style="padding:0 7px"><a href="https://www.tiktok.com/@carppartners" style="display:inline-block;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.06);text-align:center;line-height:30px;font-family:${FONT_BODY};font-size:11px;color:${TEXT_FAINT};text-decoration:none">TT</a></td>
            <td style="padding:0 7px"><a href="https://www.instagram.com/carp_partners/" style="display:inline-block;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.06);text-align:center;line-height:30px;font-family:${FONT_BODY};font-size:11px;color:${TEXT_FAINT};text-decoration:none">IG</a></td>
          </tr></table>
          <p style="font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${TEXT_FAINT};margin:0 0 6px">Carp Partners TV &middot; La plataforma del carpfishing en España</p>
          <p style="font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${TEXT_COPYRIGHT};margin:0">
            <a href="${EMAIL_ASSET_BASE_URL}/perfil" style="color:${TEXT_DIM};text-decoration:underline">Gestionar preferencias</a> &middot;
            <a href="${EMAIL_ASSET_BASE_URL}/perfil" style="color:${TEXT_DIM};text-decoration:underline">Darse de baja</a> &middot;
            <a href="${EMAIL_ASSET_BASE_URL}/contacto" style="color:${TEXT_DIM};text-decoration:underline">Ayuda</a>
          </p>
          <p style="font-family:${FONT_BODY};font-size:11px;color:${TEXT_COPYRIGHT};margin:14px 0 0">&copy; ${new Date().getFullYear()} Carp Partners TV. Todos los derechos reservados.</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
