// =====================================================================
// Rutas de autenticación.  (Briefing 4.1, 4.2)
//   POST   /auth/register      registro
//   POST   /auth/login         login -> access + refresh
//   POST   /auth/refresh       renueva access usando refresh
//   POST   /auth/logout        revoca el refresh token
//   GET    /auth/me            datos del usuario + estado de suscripción
//   POST   /auth/forgot-password  solicita enlace de recuperación (por email)
//   POST   /auth/set-password  flujo "establece tu contraseña" (migración WP,
//                               alta manual desde el panel, y recuperación)
//   POST   /auth/change-password  cambio de contraseña estando ya autenticado
//   PUT    /auth/me            edita el nombre propio ("Editar perfil")
//   POST   /auth/me/avatar     sube/reemplaza la foto de perfil propia
//   DELETE /auth/me/avatar     elimina la foto de perfil propia
// =====================================================================
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { config } from '../config/index.js';
import {
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
} from '../config/redis.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';
import { asyncHandler, badRequest, unauthorized, HttpError } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { sendMail } from '../services/mail.js';
import { welcomeEmail, passwordResetEmail } from '../services/mailTemplates.js';

const FORGOT_PASSWORD_TTL_MS = 30 * 60 * 1000; // 30 minutos

// ─── Subida de la foto de perfil propia (mismo patrón que el avatar de crew,
// pero en su propia carpeta: backend/uploads/avatars/) ───────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_AVATAR_DIR = path.resolve(__dirname, '../../uploads/avatars');
fs.mkdirSync(USER_AVATAR_DIR, { recursive: true });

const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, USER_AVATAR_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, unique);
  },
});

const avatarMulter = multer({
  storage: avatarStorage,
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AVATAR_MIME.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Tipo no válido. Usa JPG, PNG o WebP.', 'INVALID_TYPE'));
  },
});

function avatarUpload(req, res, next) {
  avatarMulter.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Imagen demasiado grande. Máximo 5 MB.', 'FILE_TOO_LARGE'));
    }
    return next(err instanceof HttpError ? err : new HttpError(400, err.message ?? 'Error de subida', 'UPLOAD_ERROR'));
  });
}

function deleteFileIfExists(filePath) {
  fs.unlink(filePath, () => {}); // fire-and-forget; si no existe, sin error
}

export const authRouter = Router();

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  name: z.string().min(1).optional(),
});

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? 'Datos inválidos', 'VALIDATION');
  }
  return result.data;
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user);
  await storeRefreshToken(user.id, jti);
  return { accessToken, refreshToken };
}

// --- Registro --------------------------------------------------------
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name } = parse(credsSchema, req.body);

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing) throw badRequest('Ese email ya está registrado', 'EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await queryOne(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, role, avatar_url, stripe_customer_id`,
      [email.toLowerCase(), passwordHash, name ?? null],
    );

    const tokens = await issueTokens(user);
    // No se espera (fire-and-forget): un SMTP lento no debe retrasar el alta.
    sendMail({ to: user.email, ...welcomeEmail({ name: user.name }) });
    res.status(201).json({ user, ...tokens });
  }),
);

// --- Login -----------------------------------------------------------
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parse(credsSchema.pick({ email: true, password: true }), req.body);

    const user = await queryOne(
      `SELECT id, email, name, role, avatar_url, stripe_customer_id, password_hash
         FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );

    // Mensaje genérico para no revelar si el email existe.
    if (!user || !user.password_hash) {
      throw unauthorized('Email o contraseña incorrectos', 'BAD_CREDENTIALS');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw unauthorized('Email o contraseña incorrectos', 'BAD_CREDENTIALS');

    delete user.password_hash;
    const tokens = await issueTokens(user);
    res.json({ user, ...tokens });
  }),
);

// --- Refresh ---------------------------------------------------------
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) throw badRequest('Falta refreshToken', 'NO_REFRESH');

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw unauthorized('Refresh token inválido o expirado', 'REFRESH_INVALID');
    }

    // Comprobar que sigue vigente en Redis (no fue revocado).
    if (!(await isRefreshTokenValid(payload.sub, payload.jti))) {
      throw unauthorized('Refresh token revocado', 'REFRESH_REVOKED');
    }

    const user = await queryOne(
      'SELECT id, email, name, role, avatar_url, stripe_customer_id FROM users WHERE id = $1',
      [payload.sub],
    );
    if (!user) throw unauthorized('Usuario no existe', 'USER_NOT_FOUND');

    // Rotación: revocamos el refresh usado y emitimos uno nuevo.
    await revokeRefreshToken(payload.sub, payload.jti);
    const tokens = await issueTokens(user);
    res.json({ user, ...tokens });
  }),
);

// --- Logout ----------------------------------------------------------
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await revokeRefreshToken(payload.sub, payload.jti);
      } catch {
        /* token ya inválido: nada que revocar */
      }
    }
    res.status(204).end();
  }),
);

// --- Datos del usuario actual + estado de suscripción ----------------
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sub = await queryOne(
      `SELECT plan, status, period_end, cancelled_at
         FROM subscriptions
        WHERE user_id = $1
        ORDER BY period_end DESC NULLS LAST
        LIMIT 1`,
      [req.user.id],
    );
    res.json({ user: req.user, subscription: sub });
  }),
);

// --- Solicitar enlace de recuperación de contraseña -------------------
// Reutiliza password_set_token/password_set_expires (misma columna que el
// alta manual desde el panel y la migración de WordPress) con una caducidad
// más corta. Responde SIEMPRE igual, exista o no la cuenta — no revela si un
// email está registrado — y no espera al envío del correo (evita también que
// la latencia del SMTP filtre esa misma información por temporización).
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const schema = z.object({ email: z.string().email() });
    const { email } = parse(schema, req.body);

    const user = await queryOne(
      'SELECT id, name FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + FORGOT_PASSWORD_TTL_MS);
      await query(
        `UPDATE users SET password_set_token = $1, password_set_expires = $2 WHERE id = $3`,
        [token, expires, user.id],
      );
      const resetUrl = `${config.publicWebUrl}/set-password?token=${token}`;
      sendMail({ to: email.toLowerCase(), ...passwordResetEmail({ name: user.name, resetUrl }) });
    }

    res.json({ ok: true });
  }),
);

// --- Establecer contraseña (usuarios migrados desde WordPress) -------
authRouter.post(
  '/set-password',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      token: z.string().min(10),
      password: z.string().min(8),
    });
    const { token, password } = parse(schema, req.body);

    const user = await queryOne(
      `SELECT id FROM users
        WHERE password_set_token = $1
          AND password_set_expires > now()`,
      [token],
    );
    if (!user) throw badRequest('Enlace inválido o caducado', 'TOKEN_INVALID');

    const passwordHash = await bcrypt.hash(password, 12);
    await query(
      `UPDATE users
          SET password_hash = $1, password_set_token = NULL, password_set_expires = NULL
        WHERE id = $2`,
      [passwordHash, user.id],
    );
    res.json({ ok: true });
  }),
);

// --- Cambiar contraseña (usuario ya autenticado, desde su Perfil) ----
authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1, 'Introduce tu contraseña actual'),
      newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
    });
    const { currentPassword, newPassword } = parse(schema, req.body);

    const user = await queryOne(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id],
    );
    const ok = user?.password_hash && (await bcrypt.compare(currentPassword, user.password_hash));
    if (!ok) throw badRequest('La contraseña actual no es correcta', 'BAD_CURRENT_PASSWORD');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
    res.json({ ok: true });
  }),
);

// --- Editar perfil propio ("Editar perfil" en Perfil) -----------------
// El email NO es editable aquí: está ligado a la facturación de Stripe.
authRouter.put(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ name: z.string().min(1, 'El nombre no puede estar vacío') });
    const { name } = parse(schema, req.body);

    const user = await queryOne(
      `UPDATE users SET name = $1 WHERE id = $2
       RETURNING id, email, name, role, avatar_url, stripe_customer_id`,
      [name, req.user.id],
    );
    res.json({ user });
  }),
);

authRouter.post(
  '/me/avatar',
  requireAuth,
  avatarUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No se recibió ninguna imagen', 'NO_FILE');

    const current = await queryOne('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    if (current?.avatar_url) {
      const oldFilename = path.basename(current.avatar_url);
      deleteFileIfExists(path.join(USER_AVATAR_DIR, oldFilename));
    }

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    const user = await queryOne(
      `UPDATE users SET avatar_url = $1 WHERE id = $2
       RETURNING id, email, name, role, avatar_url, stripe_customer_id`,
      [avatarUrl, req.user.id],
    );
    res.json({ user });
  }),
);

authRouter.delete(
  '/me/avatar',
  requireAuth,
  asyncHandler(async (req, res) => {
    const current = await queryOne('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    if (current?.avatar_url) {
      const filename = path.basename(current.avatar_url);
      deleteFileIfExists(path.join(USER_AVATAR_DIR, filename));
    }
    await query('UPDATE users SET avatar_url = NULL WHERE id = $1', [req.user.id]);
    res.status(204).end();
  }),
);
