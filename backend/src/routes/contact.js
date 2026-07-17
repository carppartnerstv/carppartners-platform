// =====================================================================
// Formulario de contacto — público, sin login.
//   POST /contact   guarda la consulta y envía aviso al admin + acuse al usuario
// =====================================================================
import { Router } from 'express';
import { z } from 'zod';
import { queryOne } from '../config/db.js';
import { config } from '../config/index.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { contactLimiter } from '../middleware/rateLimit.js';
import { sendMail } from '../services/mail.js';
import { contactAdminNotification, contactAcknowledgmentEmail } from '../services/mailTemplates.js';

export const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email(),
  subject: z.string().optional(),
  message: z.string().min(1, 'El mensaje es obligatorio'),
});

contactRouter.post(
  '/contact',
  contactLimiter,
  asyncHandler(async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;

    await queryOne(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [d.name, d.email, d.subject || null, d.message],
    );

    // Ninguno de los dos se espera: guardar el mensaje ya es la parte que
    // importa, un SMTP lento no debe retrasar la respuesta al usuario.
    if (config.mail.admin) {
      sendMail({ to: config.mail.admin, ...contactAdminNotification(d) });
    }
    sendMail({ to: d.email, ...contactAcknowledgmentEmail({ name: d.name, subject: d.subject, message: d.message }) });

    res.status(201).json({ ok: true });
  }),
);
