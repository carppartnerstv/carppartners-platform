// =====================================================================
// Rutas de autenticación.  (Briefing 4.1, 4.2)
//   POST /auth/register      registro
//   POST /auth/login         login -> access + refresh
//   POST /auth/refresh       renueva access usando refresh
//   POST /auth/logout        revoca el refresh token
//   GET  /auth/me            datos del usuario + estado de suscripción
//   POST /auth/set-password  flujo "establece tu contraseña" (migración WP)
// =====================================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
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
import { asyncHandler, badRequest, unauthorized } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.js';

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
