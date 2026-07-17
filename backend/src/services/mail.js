// =====================================================================
// Servicio de envío de emails por SMTP (cuenta de correo ya existente,
// no un proveedor tipo Resend). Un SMTP mal configurado o caído NUNCA debe
// tumbar el backend ni romper el flujo que lo dispara (registro, contacto,
// etc.) — todo error se loguea y se traga aquí.
// =====================================================================
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const hasSmtpConfig = !!(config.mail.smtpHost && config.mail.smtpUser && config.mail.smtpPass);

// Timeouts cortos: si el puerto SMTP está bloqueado por un firewall (sin
// RST, el paquete simplemente se pierde), sin esto nodemailer espera su
// timeout por defecto (2 minutos) tanto en verify() como en sendMail() —
// aquí lo acotamos a unos segundos para que un SMTP inalcanzable degrade
// rápido en vez de dejar la petición/verificación colgada.
const SMTP_CONNECTION_TIMEOUT_MS = 8_000;
const SMTP_SOCKET_TIMEOUT_MS = 15_000;

export const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: config.mail.smtpHost,
      port: config.mail.smtpPort,
      secure: config.mail.smtpSecure,
      auth: { user: config.mail.smtpUser, pass: config.mail.smtpPass },
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    })
  : null;

// Se llama una vez al arrancar el servidor (server.js). Nunca lanza.
export async function verifyMailConnection() {
  if (!transporter) {
    console.warn(
      '[mail] SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS) — los emails se omitirán.',
    );
    return;
  }
  try {
    await transporter.verify();
    console.log('[mail] Conexión SMTP verificada correctamente.');
  } catch (err) {
    console.error('[mail] No se pudo verificar la conexión SMTP:', err.message);
  }
}

/**
 * Envía un email. Nunca lanza — si falla (o si SMTP no está configurado),
 * loguea y devuelve { sent: false } para que el flujo que lo llama pueda
 * seguir adelante igualmente (p. ej. el registro no debe fallar si el email
 * de bienvenida no sale).
 */
export async function sendMail({ to, subject, html, text }) {
  if (!transporter) {
    console.warn(`[mail] SMTP no configurado; se omite envío a ${to} ("${subject}")`);
    return { sent: false };
  }
  try {
    await transporter.sendMail({ from: config.mail.from, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error(`[mail] Error enviando a ${to} ("${subject}"):`, err.message);
    return { sent: false };
  }
}
