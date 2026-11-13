// =====================================================================
// Lectura del buzón real (IMAP) para la pestaña "Correo" del panel admin —
// ver config IMAP_* en config/index.js. Una conexión nueva por operación
// (no una persistente compartida entre requests): más simple y evita que
// una conexión se quede colgada entre peticiones de un panel admin de uso
// esporádico, a costa de un pequeño coste de reconexión en cada llamada.
// =====================================================================
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { config } from '../config/index.js';
import { HttpError } from '../utils/errors.js';

export function isImapConfigured() {
  return !!(config.imap.host && config.imap.user && config.imap.pass);
}

async function withImapClient(fn) {
  if (!isImapConfigured()) {
    throw new HttpError(503, 'IMAP no configurado (IMAP_HOST/IMAP_USER/IMAP_PASS)', 'IMAP_NOT_CONFIGURED');
  }
  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.imap.user, pass: config.imap.pass },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

function addressText(addr) {
  return addr?.[0]?.name || addr?.[0]?.address || null;
}

// HTML de un email real (firmas, tablas, estilos inline) necesita una lista
// bastante más permisiva que la del editor de texto enriquecido del panel
// (RICH_TEXT_SANITIZE_OPTIONS en admin.js) — pero sigue fuera cualquier
// cosa ejecutable: nada de <script>, manejadores onX, ni esquemas que no
// sean http(s)/mailto (salvo data: en <img>, donde no hay riesgo de
// ejecución — mailparser ya convierte las imágenes cid: incrustadas a
// data: URLs al parsear).
const EMAIL_HTML_SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'div', 'span', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'img', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'center', 'font', 'pre', 'code', 'small', 'sub', 'sup',
  ],
  allowedAttributes: {
    '*': ['style', 'class', 'align', 'valign', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'bgcolor'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    font: ['color', 'face', 'size'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

/** Carpetas del buzón (INBOX, Enviados, Spam...). */
export async function listFolders() {
  return withImapClient(async (client) => {
    const list = await client.list();
    return list.map((f) => ({
      path: f.path,
      name: f.name,
      specialUse: f.specialUse ?? null,
    }));
  });
}

/**
 * Lista mensajes de una carpeta, más recientes primero, con paginación.
 * Sin `q`/`unreadOnly` usa un simple rango de secuencia (barato); con
 * cualquiera de los dos, primero resuelve con SEARCH qué mensajes
 * coinciden y pagina sobre ese resultado.
 */
export async function listMessages({ folder = 'INBOX', limit = 30, offset = 0, q = '', unreadOnly = false }) {
  return withImapClient(async (client) => {
    const mailbox = await client.mailboxOpen(folder, { readOnly: true });

    let uids; // más recientes al final, como las devuelve IMAP
    let total;

    if (q || unreadOnly) {
      const query = unreadOnly ? { seen: false } : {};
      if (q) query.or = [{ subject: q }, { from: q }, { text: q }];
      const found = await client.search(query, { uid: true });
      uids = Array.isArray(found) ? found : [];
      total = uids.length;
    } else {
      total = mailbox.exists;
      uids = null; // usamos rango de secuencia directamente, más abajo
    }

    const page = uids
      ? [...uids].reverse().slice(offset, offset + limit)
      : null;

    const range = page
      ? page // array de UIDs concretos
      : (() => {
          const end = Math.max(1, total - offset);
          const start = Math.max(1, end - limit + 1);
          return end < 1 ? null : `${start}:${end}`;
        })();

    if (!range || (Array.isArray(range) && range.length === 0)) {
      return { messages: [], total };
    }

    const messages = [];
    for await (const msg of client.fetch(range, { uid: true, envelope: true, flags: true, size: true }, { uid: !!page })) {
      messages.push({
        uid: msg.uid,
        subject: msg.envelope?.subject ?? '(sin asunto)',
        from: addressText(msg.envelope?.from),
        fromAddress: msg.envelope?.from?.[0]?.address ?? null,
        date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
        seen: msg.flags?.has('\\Seen') ?? false,
        size: msg.size ?? null,
      });
    }
    // El rango de secuencia llega en orden ascendente (más antiguo primero);
    // el de UIDs concretos ya viene en orden "más reciente primero" por el
    // reverse() de arriba, pero fetch() no garantiza devolverlos en ESE
    // orden — se reordena aquí por fecha para que ambos casos salgan igual.
    messages.sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));

    return { messages, total };
  });
}

/** Mensaje completo (cuerpo ya saneado) + adjuntos (solo metadatos, sin descargar el contenido). */
export async function getMessage({ folder = 'INBOX', uid }) {
  return withImapClient(async (client) => {
    await client.mailboxOpen(folder, { readOnly: true });
    const downloaded = await client.download(String(uid), undefined, { uid: true });
    if (!downloaded?.content) throw new HttpError(404, 'Mensaje no encontrado', 'MESSAGE_NOT_FOUND');

    const parsed = await simpleParser(downloaded.content);

    return {
      uid,
      messageId: parsed.messageId ?? null,
      subject: parsed.subject ?? '(sin asunto)',
      from: parsed.from?.text ?? null,
      fromAddress: parsed.from?.value?.[0]?.address ?? null,
      to: parsed.to?.text ?? null,
      date: parsed.date ? parsed.date.toISOString() : null,
      html: parsed.html ? sanitizeHtml(parsed.html, EMAIL_HTML_SANITIZE_OPTIONS) : null,
      text: parsed.text ?? null,
      attachments: (parsed.attachments ?? []).map((a) => ({
        filename: a.filename ?? null,
        contentType: a.contentType,
        size: a.size,
      })),
    };
  });
}

/** Marca/desmarca un mensaje como leído. */
export async function setMessageSeen({ folder = 'INBOX', uid, seen }) {
  return withImapClient(async (client) => {
    await client.mailboxOpen(folder);
    if (seen) await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    else await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true });
  });
}
